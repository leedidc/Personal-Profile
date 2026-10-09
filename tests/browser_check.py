"""Browser checks. Run: uv run --with playwright python tests/browser_check.py"""
import base64
import copy
import json
import os
from pathlib import Path
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".test-artifacts"
ARTIFACTS.mkdir(exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_port}"
original = json.loads((ROOT / "data/portfolio.json").read_text(encoding="utf-8"))
state = {"data": copy.deepcopy(original), "sha": "original-sha", "failure": None, "writes": 0}
errors = []

def mock_github(route):
    request = route.request
    assert request.headers.get("authorization") == "Bearer test-token-do-not-use"
    if request.url.endswith("/repos/leedidc/Personal-Profile"):
        route.fulfill(json={"permissions": {"push": True}})
    elif "/contents/data/portfolio.json" in request.url and request.method == "GET":
        route.fulfill(json={"sha": state["sha"], "encoding": "base64", "content": base64.b64encode(json.dumps(state["data"], ensure_ascii=False).encode()).decode()})
    elif "/contents/data/portfolio.json" in request.url and request.method == "PUT":
        if state["failure"]:
            route.fulfill(status=state["failure"], json={"message": "Simulated error"})
            return
        body = request.post_data_json
        assert body["sha"] == state["sha"]
        assert body["branch"] == "main"
        state["data"] = json.loads(base64.b64decode(body["content"]))
        state["sha"] = f"saved-{state['writes']}"
        state["writes"] += 1
        route.fulfill(json={"content": {"sha": state["sha"]}})
    else:
        raise AssertionError(request.url)

def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Horizontal page overflow"

def login(page):
    page.goto(BASE + "/admin")
    assert page.url.endswith("/admin/")
    expect(page.locator("#editor-panel")).to_be_hidden()
    page.locator("#token").fill("test-token-do-not-use")
    page.locator("#login-button").click()
    expect(page.locator("#editor-panel")).to_be_visible()
    expect(page.locator("#token")).to_have_value("")

try:
    with sync_playwright() as p:
        chrome = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe"
        browser = p.chromium.launch(executable_path=str(chrome) if chrome.exists() else None, headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
        page = context.new_page()
        page.goto(BASE)
        expect(page.locator(".resume-section")).to_have_count(5)
        expect(page.locator("#certifications tbody tr")).to_have_count(len(original["certifications"]))
        expect(page.locator("#projects .project-group")).to_have_count(2)
        page.locator("#experience details summary").first.click()
        expect(page.locator("#experience details").first).to_have_attribute("open", "")
        assert "8,000" in page.locator("#experience details").first.inner_text()
        page.locator("#experience details summary").first.click()
        page.evaluate("document.querySelectorAll('img').forEach(img => img.loading = 'eager')")
        page.wait_for_function("Array.from(document.images).every(img => img.complete)")
        assert page.locator(".org-logo img").count() == sum(len(original[s]) for s in ["education","experience","certifications","projects","activities"]), "Missing or failed organization logo"
        assert page.evaluate("Array.from(document.images).every(img => img.naturalWidth > 0)")
        no_overflow(page)
        page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)
        for width in [390, 320]:
            page.set_viewport_size({"width": width, "height": 844})
            page.goto(BASE)
            expect(page.locator(".resume-section")).to_have_count(5)
            no_overflow(page)
        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
        page.goto(BASE + "/html/certification.html")
        page.wait_for_url("**/#certifications")
        expect(page.locator("#certifications")).to_be_visible()

        admin = context.new_page()
        admin.route("https://api.github.com/**", mock_github)
        login(admin)
        expect(admin.locator("#publish")).to_be_disabled()
        assert admin.evaluate("localStorage.length === 0 && sessionStorage.length === 0")

        # Add a row, upload an image, preserve Unicode, and render untrusted text safely.
        admin.get_by_role("button", name="학력 추가", exact=True).click()
        admin.locator("#item-name").fill("검증용 <img src=x onerror=alert(1)>")
        admin.locator("#subtitle").fill("새 학교")
        admin.locator("#period").fill("2026.10 – 현재")
        admin.locator("#summary").fill("정보보안 전공")
        admin.locator("#logo-file").set_input_files(str(ROOT / "image/ssu.png"))
        admin.wait_for_function("document.querySelector('#logo-preview').src.startsWith('data:image/png')")
        admin.locator("#apply-item").click()
        expect(admin.locator(".editor-row")).to_have_count(3)
        assert state["writes"] == 0
        expect(admin.locator("#publish")).to_be_enabled()
        assert admin.locator(".editor-row").last.locator("img").count() == 1

        # Edit existing career details.
        admin.get_by_role("button", name="경력", exact=True).click()
        admin.get_by_role("button", name="한국전자통신연구원 수정", exact=True).click()
        admin.locator("#details").fill("검증용 상세 업무 1\n검증용 상세 업무 2")
        admin.locator("#apply-item").click()

        # Company/personal classification, reorder, cancellation, and deletion.
        admin.get_by_role("button", name="프로젝트", exact=True).click()
        admin.get_by_role("button", name="프로젝트 추가", exact=True).click()
        admin.locator("#item-name").fill("검증용 프로젝트")
        admin.locator("#category").select_option("company")
        admin.locator("#summary").fill("관리자 추가 검증")
        admin.locator("#technologies").fill("Python, FastAPI")
        admin.locator("#logo-select").select_option("image/etri.jpg")
        admin.locator("#apply-item").click()
        expect(admin.locator(".editor-row")).to_have_count(4)
        admin.get_by_role("button", name="검증용 프로젝트 위로 이동", exact=True).click()
        expect(admin.locator(".editor-row").nth(2)).to_contain_text("검증용 프로젝트")
        admin.get_by_role("button", name="검증용 프로젝트 아래로 이동", exact=True).click()
        expect(admin.locator(".editor-row").last).to_contain_text("검증용 프로젝트")
        admin.once("dialog", lambda dialog: dialog.dismiss())
        admin.get_by_role("button", name="검증용 프로젝트 삭제", exact=True).click()
        expect(admin.locator(".editor-row")).to_have_count(4)
        admin.once("dialog", lambda dialog: dialog.accept())
        admin.get_by_role("button", name="검증용 프로젝트 삭제", exact=True).click()
        expect(admin.locator(".editor-row")).to_have_count(3)

        admin.locator("#edit-profile").click()
        admin.locator("#profile-name-input").fill("이찬형 검증")
        admin.locator("#profile-form").get_by_role("button", name="적용", exact=True).click()
        admin.locator("#preview").click()
        expect(admin.locator("#preview-education tbody tr")).to_have_count(3)
        expect(admin.locator("#preview-dialog h1")).to_contain_text("이찬형 검증")
        assert admin.locator('#preview-dialog img[src="x"]').count() == 0
        admin.locator("#preview-dialog").get_by_role("button", name="닫기", exact=True).click()

        # A failed publish and SHA conflict must preserve the unsaved edits.
        for code, message in [(403, "권한"), (409, "다른 곳에서")]:
            state["failure"] = code
            admin.locator("#publish").click()
            expect(admin.locator("#status")).to_contain_text(message)
            expect(admin.locator("#unsaved")).to_be_visible()
            expect(admin.locator("#publish")).to_be_enabled()
            assert state["writes"] == 0
        state["failure"] = None
        admin.locator("#publish").click()
        expect(admin.locator("#status")).to_contain_text("저장했습니다")
        expect(admin.locator("#publish")).to_be_disabled()
        assert state["writes"] == 1
        assert state["data"]["profile"]["name"] == "이찬형 검증"
        assert state["data"]["education"][-1]["logo"].startswith("data:image/png;base64,")
        assert state["data"]["experience"][0]["details"] == ["검증용 상세 업무 1", "검증용 상세 업무 2"]

        # Public rendering uses the same persisted payload.
        saved = context.new_page()
        saved.route(BASE + "/data/portfolio.json", lambda route: route.fulfill(json=state["data"]))
        saved.goto(BASE)
        expect(saved.locator("#profile-name")).to_contain_text("이찬형 검증")
        expect(saved.locator("#education tbody tr")).to_have_count(3)

        admin.screenshot(path=str(ARTIFACTS / "admin.png"), full_page=True)
        admin.set_viewport_size({"width": 390, "height": 844})
        no_overflow(admin)
        admin.locator("#add-item").click()
        expect(admin.locator("#item-dialog")).to_be_visible()
        no_overflow(admin)
        admin.screenshot(path=str(ARTIFACTS / "admin-mobile.png"), full_page=True)
        admin.locator("#item-dialog").get_by_role("button", name="취소", exact=True).click()
        admin.locator("#logout").click()
        expect(admin.locator("#editor-panel")).to_be_hidden()
        expect(admin.locator("#login-form")).to_be_visible()
        assert admin.evaluate("localStorage.length === 0 && sessionStorage.length === 0")

        # A non-writer cannot enter the editing panel.
        denied = context.new_page()
        denied.route("https://api.github.com/**", lambda route: route.fulfill(json={"permissions": {"push": False}}))
        denied.goto(BASE + "/admin/")
        denied.locator("#token").fill("read-only-token")
        denied.locator("#login-button").click()
        expect(denied.locator("#status")).to_contain_text("수정할 수 있는 계정")
        expect(denied.locator("#editor-panel")).to_be_hidden()

        assert not errors, errors
        browser.close()
        print("PASS: public tables, logos, responsive layouts, expandable details, admin access, add/edit/delete/reorder, logo upload, preview, failed save, conflict, Unicode persistence, logout and read-only access.")
        print("Screenshots:", ARTIFACTS)
finally:
    server.shutdown()
