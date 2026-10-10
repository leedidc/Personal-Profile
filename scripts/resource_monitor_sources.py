"""공식 자료실의 게시물과 첨부파일만 읽습니다. 외부 JavaScript는 실행하지 않습니다."""

import hashlib
import json
import re
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

OFFICIAL_HOSTS = {
    "www.kisa.or.kr", "www.privacy.go.kr", "pipc.go.kr", "isms-p.or.kr",
    "www.krcert.or.kr", "isds.kisa.or.kr", "www.sen.go.kr",
}
BOARDS = [
    ("KISA 가이드라인", "https://www.kisa.or.kr/2060207?page={page}"),
    ("KISA 안내서", "https://www.kisa.or.kr/2060307?page={page}"),
    ("개인정보보호위원회 안내서", "https://pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS217&mCode=G010030000&pageIndex={page}"),
    ("개인정보 포털 안내서", "https://www.privacy.go.kr/front/bbs/bbsList.do?bbsNo=BBSMSTR_000000000049&pageIndex={page}"),
    ("ISMS-P 자료실", "https://isms-p.or.kr/ntcn/rcsrm/selectGnrlRcsrmList.do?pageIndex={page}"),
    ("CSAP 자료실", "https://isms-p.or.kr/ntcn/rcsrm/selectGnrlVrtlRcsrmList.do?pageIndex={page}"),
    ("보호나라 보안 자료", "https://www.krcert.or.kr/kr/bbs/list.do?menuNo=205021&bbsId=B0000127&pageIndex={page}"),
    ("정보보호 공시 자료실", "https://isds.kisa.or.kr/kr/bbs/list.do?bbsId=B0000011&menuNo=204948&pageIndex={page}"),
]


def official_url(url):
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.hostname not in OFFICIAL_HOSTS
            or parts.username or parts.password or parts.port not in (None, 443)):
        raise ValueError("공식 출처 밖의 주소")
    return url


def canonical_url(url):
    parts = urlsplit(official_url(url))
    query = parse_qs(parts.query)
    if parts.hostname == "www.krcert.or.kr":
        query.setdefault("menuNo", ["205021"])
    elif parts.hostname == "isds.kisa.or.kr":
        query.setdefault("menuNo", ["204948"])
    keys = ["postSeq", "nttId", "bbsId", "bbsNo", "bbscttNo", "searchRcsrmMngId", "q_bbsDocNo", "q_bbsSn", "menuNo"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path.split(";")[0],
                      urlencode(sorted((key, query[key][0]) for key in keys if key in query)), ""))


def compact(text):
    return re.sub(r"\s+", " ", text).strip()


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def document_files(soup, source_url):
    files = {}
    for anchor in soup.select("a"):
        action = anchor.get("onclick", "")
        href = anchor.get("href", "")
        label = compact(anchor.get("alt") or anchor.get_text(" ", strip=True))
        extension = re.search(r"\.(pdf|hwpx?|xlsx?|zip|pptx)\b", label, re.I)
        if not extension:
            continue
        label = label[:extension.end()]
        kisa = re.search(r"fnPostAttachDownload\((\d+),\s*'?(\d+)'?,\s*(\d+),\s*'([^']+)'", action)
        pipc = re.search(r"fn_egov_downFile\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'", action)
        other = re.search(r"fileDown\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'", action)
        url = None
        session_only = "fileDownController.downloadFile(" in action
        if session_only:
            # 암호화된 세션별 파일 ID를 개정으로 오인하거나 공개 데이터에 보관하지 않습니다.
            url = source_url
        elif kisa and kisa[1] != "99999999":
            url = urljoin(source_url, "/post/fileDownload") + "?" + urlencode(dict(zip(
                ["menuSeq", "postSeq", "attachSeq", "lang_type"], kisa.groups())))
        elif pipc:
            url = urljoin(source_url, "/np/cmm/fms/FileDown.do") + "?" + urlencode(dict(zip(
                ["atchFileId", "fileSn", "fileExtsn"], pipc.groups())))
        elif other:
            url = urljoin(source_url, "/common/cmm/fms/FileDown.do") + "?" + urlencode(dict(zip(
                ["atchFileId", "fileSn", "bbsId"], other.groups())))
        elif "/cmm/fms/FileDown.do?" in href or "/component/file/ND_fileDownload.do?" in href:
            url = urljoin(source_url, href)
        if url:
            official_url(url)
            files[(label, url)] = {"label": label, "url": url, "sessionOnly": session_only}
    return sorted(files.values(), key=lambda item: (item["label"], item["url"]))


def parse_document(html, url):
    soup = BeautifulSoup(html, "html.parser")
    host = urlsplit(url).hostname
    selectors = {
        "www.kisa.or.kr": (".board_detail_info h2", ".board_detail_contents"),
        "pipc.go.kr": (".tbView .txt_ct", ".tbl_cnts"),
        "www.privacy.go.kr": (".oneView_title", ".oneView_body"),
        "isms-p.or.kr": ("td.title", ".notice_detail"),
        "www.krcert.or.kr": (".board-header .b_title", "article.board > .content"),
        "isds.kisa.or.kr": (".board_view h4", ".board_con"),
        "www.sen.go.kr": (".vtitle", ".bd-view__vcontent"),
    }
    title_selector, body_selector = selectors[host]
    title = soup.select_one(title_selector)
    body = soup.select_one(body_selector)
    files = document_files(soup, url)
    if title is None or body is None or not files:
        raise ValueError("게시글 구조 또는 첨부파일을 확인할 수 없음")
    # 조회수·다운로드 횟수·세션 값과 사이트 공통 영역은 비교에서 제외합니다.
    for node in body.select("script, style, .file_down, .downloadTims, input, .btn_wrap"):
        node.decompose()
    metadata = {"title": compact(title.get_text(" ", strip=True)),
                "body": compact(body.get_text(" ", strip=True)),
                "files": sorted(item["label"] for item in files)}
    return {"metadataHash": digest(metadata), "files": files}


def parse_board(html, url):
    soup = BeautifulSoup(html, "html.parser")
    posts = {}
    for anchor in soup.select("a"):
        href = anchor.get("href", "")
        action = href + " " + anchor.get("onclick", "")
        target = None
        if re.search(r"/\d+/form\?postSeq=", href) or "selectBoardArticle.do?" in href or "/bbs/view.do?" in href:
            target = urljoin(url, href)
        elif match := re.search(r"\$bbs\.view\('([\d]+)'", action):
            target = "https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=" + match[1]
        elif match := re.search(r"fn_goView\('([^']+)'", action):
            target = url.split("?")[0].replace("List.do", "Detail.do") + "?searchRcsrmMngId=" + match[1]
        if target:
            title = compact(anchor.get_text(" ", strip=True))
            if not title:
                continue
            target = canonical_url(target)
            # 게시판 아이콘의 N 표시는 시간이 지나면 사라지므로 비교하지 않습니다.
            title = re.sub(r"\s+(?:새글|NEW|new|N)$", "", title)
            posts[target] = title[:300]
    if not posts:
        raise ValueError("게시판 목록 구조를 확인할 수 없음")
    return posts
