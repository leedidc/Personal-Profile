import copy
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_resource_updates import check, inspect_resource, make_event, merge_history
from resource_monitor_sources import canonical_url, official_url, parse_board, parse_document


class ResourceMonitorTests(unittest.TestCase):
    source = "https://www.kisa.or.kr/2060204/form?postSeq=999"
    html = """<div class="board_detail_info"><h2>테스트 안내서</h2><span>조회 123</span></div>
    <div class="board_detail_contents">안내서 본문</div>
    <a onclick="fnPostAttachDownload(2060204, '999', 1, 'KO')">테스트.pdf (7MB)</a>"""

    def resource(self):
        return {"id": "sample", "title": "테스트", "sourceUrl": self.source,
                "downloads": [{"label": "테스트.pdf", "url": "https://www.kisa.or.kr/file.pdf"}]}

    def test_counters_do_not_create_revisions(self):
        first = parse_document(self.html, self.source)
        second = parse_document(self.html.replace("조회 123", "조회 900"), self.source)
        self.assertEqual(first, second)
        revised = parse_document(self.html.replace("안내서 본문", "수정된 내용"), self.source)
        self.assertNotEqual(first["metadataHash"], revised["metadataHash"])

    def test_session_ids_and_download_counts_are_not_revisions(self):
        html = """<td class="title">인증 안내서</td><div class="notice_detail"><div class="file_down">
        <a onclick="fileDownController.downloadFile('session-one','0')">안내서.pdf <span class="downloadTims">(다운로드 10 회)</span></a>
        </div>본문</div>"""
        url = "https://isms-p.or.kr/detail"
        first = parse_document(html, url)
        second = parse_document(html.replace("session-one", "session-two").replace("10 회", "11 회"), url)
        self.assertEqual(first, second)
        self.assertTrue(first["files"][0]["sessionOnly"])
        self.assertNotIn("session-one", str(first))

    def test_environment_specific_file_ids_do_not_create_revisions(self):
        html = '<div class="board-header"><h1 class="b_title">안내서</h1></div><article class="board"><section class="content">본문</section></article><a onclick="fileDown(\'encoded-a\',\'1\',\'B0000127\')">가이드.pdf</a>'
        url = 'https://www.krcert.or.kr/kr/bbs/view.do?nttId=1'
        first = parse_document(html, url)
        second = parse_document(html.replace('encoded-a', 'encoded-b'), url)
        self.assertEqual(first['metadataHash'], second['metadataHash'])
        self.assertNotEqual(first['files'][0]['url'], second['files'][0]['url'])

    def test_login_error_page_is_not_a_new_baseline(self):
        with self.assertRaises(ValueError):
            parse_document("<h1>접근 권한이 없습니다</h1>", self.source)

    def test_same_filename_content_change_is_detected(self):
        with patch("check_resource_updates.fetch", side_effect=lambda url, binary=False: "old-hash" if binary else self.html):
            previous, _, _ = inspect_resource(self.resource(), None)
        with patch("check_resource_updates.fetch", side_effect=lambda url, binary=False: "new-hash" if binary else self.html):
            current, changes, errors = inspect_resource(self.resource(), previous)
        self.assertIn("첨부파일 내용 변경", changes)
        self.assertEqual(errors, [])
        self.assertNotEqual(current["fileHashes"], previous["fileHashes"])

    def test_failure_keeps_previous_success_and_hashes(self):
        with patch("check_resource_updates.fetch", side_effect=lambda url, binary=False: "old" if binary else self.html):
            previous, _, _ = inspect_resource(self.resource(), None)
        previous["lastSuccessAt"] = "2026-10-01T00:00:00+00:00"
        saved = copy.deepcopy(previous)
        with patch("check_resource_updates.fetch", side_effect=ValueError("첨부파일 대신 오류 페이지가 반환됨")):
            current, changes, errors = inspect_resource(self.resource(), previous)
        self.assertEqual(previous, saved)
        self.assertEqual(current["fileHashes"], previous["fileHashes"])
        self.assertEqual(current["lastSuccessAt"], previous["lastSuccessAt"])
        self.assertEqual(changes, [])
        self.assertTrue(errors)

    def test_catalog_replacement_restarts_comparison(self):
        with patch("check_resource_updates.fetch", side_effect=lambda url, binary=False: "old" if binary else self.html):
            previous, _, _ = inspect_resource(self.resource(), None)
        updated = self.resource()
        updated["sourceUrl"] += "&version=2"
        with patch("check_resource_updates.fetch", side_effect=lambda url, binary=False: "new" if binary else self.html):
            _, changes, _ = inspect_resource(updated, previous)
        self.assertEqual(changes, [])

    def test_official_links_only(self):
        for url in ["http://www.kisa.or.kr/", "https://www.kisa.or.kr.evil.test/", "https://user:pass@www.kisa.or.kr/", "https://127.0.0.1/", "https://www.kisa.or.kr:8080/"]:
            with self.assertRaises(ValueError):
                official_url(url)

    def test_board_identifies_posts_without_navigation_and_sessions(self):
        html = """<a href="/2060204">메뉴</a><a href="/2060204/form?postSeq=10&amp;page=2">새 안내서 N</a>"""
        result = parse_board(html, "https://www.kisa.or.kr/2060207?page=1")
        self.assertEqual(result, {"https://www.kisa.or.kr/2060204/form?postSeq=10": "새 안내서"})
        self.assertEqual(canonical_url(self.source + "&page=10"), self.source)
        with self.assertRaises(ValueError):
            parse_board("<h1>시스템 점검 중</h1>", self.source)

    def test_changes_persist_across_quiet_runs(self):
        now = datetime(2026, 10, 11, tzinfo=timezone.utc)
        event = make_event("가이드", self.source, "첨부파일 내용 변경", now, "new")
        self.assertEqual(merge_history([event], [], now + timedelta(days=1)), [event])
        self.assertEqual(merge_history([event], [event], now), [event])
        self.assertEqual(merge_history([event], [], now + timedelta(days=91)), [])

    def test_new_board_posts_and_board_failure_preserve_baseline(self):
        board = [("테스트 게시판", "https://www.kisa.or.kr/2060207?page={page}")]
        html = '<a href="/2060204/form?postSeq=10">원래 안내서</a>'
        catalog = {"resources": []}
        with patch("check_resource_updates.BOARDS", board), patch("check_resource_updates.fetch", return_value=html):
            baseline = check(catalog, {})
        self.assertEqual(baseline["changes"], [])
        revised = html + '<a href="/2060204/form?postSeq=20">새 개정 안내서</a>'
        with patch("check_resource_updates.BOARDS", board), patch("check_resource_updates.fetch", return_value=revised):
            report = check(catalog, baseline)
        self.assertEqual(len(report["changes"]), 1)
        self.assertEqual(report["changes"][0]["title"], "새 개정 안내서")
        with patch("check_resource_updates.BOARDS", board), patch("check_resource_updates.fetch", side_effect=ValueError("구조 확인 실패")):
            failed = check(catalog, report)
        self.assertEqual(failed["status"], "partial")
        self.assertEqual(failed["boards"], report["boards"])
        self.assertEqual(failed["changes"], report["changes"])
        self.assertEqual(catalog, {"resources": []})


if __name__ == "__main__":
    unittest.main()
