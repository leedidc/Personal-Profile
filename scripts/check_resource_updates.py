"""공식 자료 개정 점검. 자료 목록은 수정하지 않고 관측 결과만 별도 저장합니다."""

import argparse
import copy
import hashlib
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
import truststore

from resource_monitor_sources import (
    BOARDS, canonical_url, digest, official_url, parse_board, parse_document,
)

ROOT = Path(__file__).resolve().parents[1]
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_HTML_BYTES = 8 * 1024 * 1024
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 PersonalProfileGuideMonitor/1.0")


def fetch_once(url, binary=False):
    """리디렉션도 출처를 검사하고 파일은 저장 없이 스트리밍 해시만 계산합니다."""
    started = time.monotonic()
    for redirect in range(5):
        official_url(url)
        with requests.get(url, timeout=(15, 45), stream=True, allow_redirects=False,
                          headers={"User-Agent": USER_AGENT}) as response:
            if response.is_redirect:
                from urllib.parse import urljoin
                url = urljoin(url, response.headers["Location"])
                continue
            response.raise_for_status()
            chunks = []
            hashed = hashlib.sha256()
            size = 0
            for chunk in response.iter_content(65536):
                if not chunk:
                    continue
                if size == 0 and binary and not chunk.startswith((b"%PDF-", b"PK\x03\x04", b"\xd0\xcf\x11\xe0")):
                    raise ValueError("첨부파일 대신 오류 페이지가 반환됨")
                size += len(chunk)
                if size > (MAX_FILE_BYTES if binary else MAX_HTML_BYTES) or time.monotonic() - started > 180:
                    raise ValueError("응답 크기 또는 다운로드 시간 제한 초과")
                if binary:
                    hashed.update(chunk)
                else:
                    chunks.append(chunk)
            if not size:
                raise ValueError("빈 응답")
            if binary:
                return hashed.hexdigest()
            encoding = response.encoding
            if not encoding or encoding.lower() == "iso-8859-1":
                encoding = "utf-8"
            return b"".join(chunks).decode(encoding)
    raise ValueError("리디렉션 횟수 초과")


def fetch(url, binary=False):
    for attempt in range(2):
        try:
            return fetch_once(url, binary)
        except requests.exceptions.SSLError:
            raise
        except requests.HTTPError as error:
            if attempt or error.response.status_code not in (429, 500, 502, 503, 504):
                raise
        except (requests.ConnectionError, requests.Timeout, requests.exceptions.ChunkedEncodingError):
            if attempt:
                raise
        time.sleep(2)


def error_message(error):
    # 예외의 원문 URL·세션 값은 공개 보고서에 싣지 않습니다.
    if isinstance(error, requests.HTTPError):
        return "HTTP " + str(error.response.status_code)
    if isinstance(error, requests.Timeout):
        return "응답 시간 초과"
    if isinstance(error, requests.exceptions.SSLError):
        return "기관 인증서 연결 확인 필요"
    if isinstance(error, requests.RequestException):
        return "기관 연결 실패"
    if isinstance(error, UnicodeError):
        return "문자 인코딩 확인 필요"
    if isinstance(error, ValueError):
        return str(error)
    raise error


def inspect_resource(resource, previous):
    record = copy.deepcopy(previous or {})
    errors = []
    changes = []
    source_url = resource["sourceUrl"]
    signature = digest({"url": source_url, "files": resource["downloads"]})
    # 편집자가 자료 출처를 교체하면 다른 문서의 이전 해시와 비교하지 않습니다.
    if record.get("catalogHash") != signature:
        record = {"catalogHash": signature, "fileHashes": {}}
    try:
        document = parse_document(fetch(source_url), source_url)
        if record.get("metadataHash") and record["metadataHash"] != document["metadataHash"]:
            changes.append("게시글·첨부 목록 변경")
        record["metadataHash"] = document["metadataHash"]
        files = document["files"]
    except (requests.RequestException, ValueError, UnicodeError) as error:
        errors.append(error_message(error))
        files = []

    # 접속 환경마다 다운로드 ID가 달라질 수 있으므로 방금 읽은 주소로 받고 파일명으로 비교합니다.
    downloads = {item["label"]: item["url"] for item in files if not item["sessionOnly"]}
    if "isms-p.or.kr/" in source_url:
        downloads.update({item["label"]: item["url"] for item in resource["downloads"] if not item.get("viaSourcePage")})
    checked_files = 0
    for label, url in sorted(downloads.items()):
        key = digest(label)
        try:
            current_hash = fetch(url, binary=True)
            old_hash = record["fileHashes"].get(key)
            if old_hash and old_hash != current_hash:
                changes.append("첨부파일 내용 변경")
            record["fileHashes"][key] = current_hash
            checked_files += 1
        except (requests.RequestException, ValueError, UnicodeError) as error:
            errors.append("첨부파일: " + error_message(error))
    record["checkedFiles"] = checked_files
    record["metadataOnlyFiles"] = sum(item["sessionOnly"] for item in files)
    return record, sorted(set(changes)), sorted(set(errors))


def merge_history(previous, changes, now):
    cutoff = (now - timedelta(days=90)).isoformat()
    history = [item for item in previous if item["detectedAt"] >= cutoff]
    # 같은 실행 재시도는 중복하지 않고, 다른 날의 추가 변경은 이력으로 남깁니다.
    known = {item["eventId"] for item in history}
    for item in changes:
        if item["eventId"] not in known:
            history.append(item)
            known.add(item["eventId"])
    return sorted(history, key=lambda item: item["detectedAt"], reverse=True)[:300]


def make_event(title, url, kind, now, fingerprint):
    return {"eventId": digest([url, kind, fingerprint, now.date().isoformat()]), "title": title,
            "sourceUrl": url, "kind": kind, "detectedAt": now.isoformat()}


def check(catalog, previous):
    # 1판은 접속 환경별 첨부 주소를 비교했으므로 새 비교 기준을 처음부터 수집합니다.
    if previous.get("comparisonVersion") != 2:
        previous = {}
    now = datetime.now(timezone.utc).replace(microsecond=0)
    events = []
    errors = []
    snapshots = copy.deepcopy(previous.get("snapshots", {}))
    boards = copy.deepcopy(previous.get("boards", {}))
    resources = catalog["resources"]
    successes = 0
    with ThreadPoolExecutor(max_workers=3) as executor:
        jobs = {executor.submit(inspect_resource, item, snapshots.get(item["id"])): item for item in resources}
        for future in as_completed(jobs):
            item = jobs[future]
            record, changes, failures = future.result()
            if not failures:
                successes += 1
                record["lastSuccessAt"] = now.isoformat()
            snapshots[item["id"]] = record
            for kind in changes:
                events.append(make_event(item["title"], item["sourceUrl"], kind, now, digest(record)))
            if failures:
                errors.append({"title": item["title"], "sourceUrl": item["sourceUrl"], "reason": " · ".join(failures)})
            print(f"자료 {successes + len(errors)}/{len(resources)}: {item['id']} — {'확인 실패' if failures else '확인'}", flush=True)

    board_successes = 0
    registered = {canonical_url(item["sourceUrl"]) for item in resources}
    for name, template in BOARDS:
        key = digest(template)
        known = boards.get(key)
        found = {}
        failed = False
        # 최근 3페이지의 새 게시물과 제목 변경을 확인합니다.
        for page in range(1, 4):
            url = template.format(page=page)
            try:
                found.update(parse_board(fetch(url), url))
            except (requests.RequestException, ValueError, UnicodeError) as error:
                errors.append({"title": name, "sourceUrl": url, "reason": error_message(error)})
                failed = True
                break
        if failed:
            continue
        board_successes += 1
        if known is not None:
            for url, title in found.items():
                if url not in known and url not in registered:
                    events.append(make_event(title, url, "새 게시물 · 개정본 여부 확인", now, digest(title)))
                elif url in known and known[url] != title:
                    events.append(make_event(title, url, "게시판 제목 변경", now, digest(title)))
        boards[key] = {**(known or {}), **found}
        print(name + ": 확인", flush=True)

    snapshots = {item["id"]: snapshots[item["id"]] for item in resources}
    return {
        "schemaVersion": 1, "comparisonVersion": 2, "checkedAt": now.isoformat(),
        "status": "ok" if not errors else "partial",
        "resourcesChecked": successes, "resourcesTotal": len(resources),
        "boardsChecked": board_successes, "boardsTotal": len(BOARDS),
        "filesChecked": sum(item.get("checkedFiles", 0) for item in snapshots.values()),
        "metadataOnlyFiles": sum(item.get("metadataOnlyFiles", 0) for item in snapshots.values()),
        "changes": merge_history(previous.get("changes", []), events, now), "errors": errors,
        "snapshots": snapshots, "boards": boards,
    }


def write_summary(report):
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    lines = ["## 공식 자료 자동 점검", "", f"점검 시각: {report['checkedAt']}", "",
             f"자료 {report['resourcesChecked']}/{report['resourcesTotal']} · 게시판 {report['boardsChecked']}/{report['boardsTotal']} · 파일 해시 {report['filesChecked']}개",
             f"첨부 목록만 확인하는 세션 전용 파일: {report['metadataOnlyFiles']}개", "",
             "최근 90일의 변경 감지 이력이며, 개정 확정이나 자료 자동 교체를 뜻하지 않습니다.", ""]
    for item in report["changes"]:
        title = item["title"].replace("<", "&lt;").replace(">", "&gt;").replace("[", "\\[").replace("]", "\\]")
        lines.append(f"- {item['kind']}: [{title}]({item['sourceUrl']})")
    lines.extend(["", f"확인 실패: {len(report['errors'])}건. 자세한 내용은 data/resource-updates.json을 확인하세요."])
    Path(summary).write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/resource-updates.json")
    args = parser.parse_args()
    truststore.inject_into_ssl()
    catalog = json.loads((ROOT / "data/resources.json").read_text(encoding="utf-8"))
    previous = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else {}
    report = check(catalog, previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {"schemaVersion": 1, "checkedAt": report["checkedAt"]}
    summary_path = args.output.with_name("resource-update-status.json")
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    write_summary(report)
    print(f"결과: 자료 {report['resourcesChecked']}/{report['resourcesTotal']}, 파일 {report['filesChecked']}, 오류 {len(report['errors'])}")


if __name__ == "__main__":
    main()
