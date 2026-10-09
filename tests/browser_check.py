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
from posts_browser_check import check_posts
from award_research_browser_check import check_research_reader, edit_research_slides, check_research_preview

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
        expect(page.locator('#profile-links a[href^="mailto:"]')).to_have_attribute("href", "mailto:" + original["profile"]["email"])
        expect(page.locator(".profile-introduction p")).to_have_text(original["profile"]["introduction"])
        expect(page.locator(".profile-interests li")).to_have_text(original["profile"]["interests"])
        expect(page.locator("#education .summary-english").first).to_have_text(original["education"][0]["summaryEnglish"])
        expect(page.locator("#experience .row-subtitle").first).to_have_text(original["experience"][0]["subtitle"])
        expect(page.locator(".resume-section")).to_have_count(7)
        expect(page.locator("#certifications tbody tr")).to_have_count(len(original["certifications"]))
        expect(page.locator("#certifications thead th")).to_have_count(4)
        expect(page.locator("#certifications .row-name")).to_have_text([row["name"] for row in original["certifications"]])
        expect(page.locator("#certifications .credential-number")).to_have_count(len(original["certifications"]))
        masked_count = sum(bool(row.get("maskedNumber")) for row in original["certifications"])
        expect(page.locator("#certifications .credential-number").filter(has_text="***")).to_have_count(masked_count)
        expect(page.locator("#languages tbody tr")).to_have_count(1)
        expect(page.locator("#languages")).to_contain_text("800점")
        expect(page.locator("#languages .period")).to_have_text("2026.08.30")
        expect(page.locator("#languages .credential-number")).to_have_text(original["languages"][0]["maskedNumber"])
        expect(page.locator("#education .course-details")).to_have_count(2)
        for index, school in enumerate(original["education"]):
            school_row = page.locator("#education tbody tr").nth(index)
            expect(school_row.locator(".education-details li")).to_have_text(school["details"])
            for detail in school_row.locator(".education-details li").all():
                expect(detail).to_be_visible()
            expect(school_row.locator("details:not(.course-details)")).to_have_count(0)
        expect(page.locator("#education .course-details").first.locator("li")).to_have_count(2)
        school_courses = page.locator("#education .course-details").nth(1)
        school_courses.locator("summary").focus()
        page.keyboard.press("Enter")
        expect(school_courses).to_have_attribute("open", "")
        expect(school_courses.locator("li")).to_have_count(10)
        expect(school_courses.locator("li")).to_have_text(original["education"][1]["courses"])
        expect(school_courses).to_contain_text("융합보안프로젝트1")
        school_courses.locator("summary").click()
        expect(school_courses.locator("li").first).to_be_hidden()
        expect(page.locator("#projects .project-group")).to_have_count(2)
        expect(page.locator("#awards tbody tr")).to_have_count(4)
        expect(page.locator("#awards tbody tr").first).to_contain_text("행정안전부 장관상")
        for index, award in enumerate(original["awards"]):
            award_row = page.locator("#awards tbody tr").nth(index)
            expect(award_row.locator(".award-details li")).to_have_text(award["details"])
            for detail in award_row.locator(".award-details li").all():
                expect(detail).to_be_visible()
        page.locator("#experience details summary").first.click()
        expect(page.locator("#experience details").first).to_have_attribute("open", "")
        assert "8,000" in page.locator("#experience details").first.inner_text()
        page.locator("#experience details summary").first.click()
        page.evaluate("document.querySelectorAll('img').forEach(img => img.loading = 'eager')")
        page.wait_for_function("Array.from(document.images).every(img => img.complete)")
        assert page.locator(".org-logo img").count() == sum(len(original[s]) for s in ["education","experience","certifications","languages","projects","activities","awards"]), "Missing or failed organization logo"
        assert page.evaluate("Array.from(document.images).every(img => img.naturalWidth > 0)")
        check_research_reader(page, original, ARTIFACTS)
        no_overflow(page)
        page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)
        page.locator("#awards").screenshot(path=str(ARTIFACTS / "award-details-desktop.png"))
        for width in [390, 320]:
            page.set_viewport_size({"width": width, "height": 844})
            page.goto(BASE)
            expect(page.locator(".resume-section")).to_have_count(7)
            no_overflow(page)
        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
        page.locator("#awards").screenshot(path=str(ARTIFACTS / "award-details-mobile.png"))
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
        admin.locator("#summary-english").fill("Information Security")
        expect(admin.locator("#education-courses")).to_be_visible()
        expect(admin.locator("#credential-number-field")).to_be_hidden()
        synthetic_courses = ["TEST 101 — 검증용 과목 — A+", "<img src=x onerror=alert(1)>"]
        admin.locator("#courses").fill("\n".join(synthetic_courses))
        admin.locator("#logo-file").set_input_files(str(ROOT / "image/ssu.png"))
        admin.wait_for_function("document.querySelector('#logo-preview').src.startsWith('data:image/png')")
        admin.locator("#apply-item").click()
        expect(admin.locator(".editor-row")).to_have_count(3)
        assert state["writes"] == 0
        expect(admin.locator("#publish")).to_be_enabled()
        assert admin.locator(".editor-row").last.locator("img").count() == 1

        # 가상 번호로 원문이 편집 결과·미리보기·저장 요청에 남지 않는지 확인합니다.
        synthetic_number = "TEST-2026-987654"
        masked_number = "TEST-2026-98***"
        admin.get_by_role("button", name="자격", exact=True).click()
        first_certificate = original["certifications"][0]
        expect(admin.locator(".editor-row").first).to_contain_text(first_certificate["subtitle"])
        admin.get_by_label(first_certificate["name"] + " 표시 순서", exact=True).select_option("2")
        expected_certificate_ids = [row["id"] for row in original["certifications"]]
        expected_certificate_ids.insert(2, expected_certificate_ids.pop(0))
        expect(admin.locator(".editor-row .row-name").nth(2)).to_have_text(first_certificate["name"])
        assert state["writes"] == 0
        admin.get_by_role("button", name="자격 추가", exact=True).click()
        expect(admin.locator("#subtitle-label")).to_have_text("영문 전체 명칭 (한글 자격만)")
        expect(admin.locator("#credential-number-field")).to_be_visible()
        admin.locator("#item-name").fill("번호 마스킹 검증용 자격")
        admin.locator("#period").fill("2026.10.09")
        admin.locator("#summary").fill("검증용 기관")
        admin.locator("#credential-number").fill(synthetic_number)
        admin.locator("#apply-item").click()
        expect(admin.locator("#credential-number")).to_have_value("")
        admin.get_by_role("button", name="번호 마스킹 검증용 자격 수정", exact=True).click()
        expect(admin.locator("#credential-number")).to_have_value(masked_number)
        admin.locator("#apply-item").click()

        # 어학 등록번호도 추가·재편집·저장 과정에서 같은 마스킹 기준을 적용합니다.
        synthetic_registration = "EXAM-654321"
        masked_registration = "EXAM-654***"
        admin.get_by_role("button", name="어학", exact=True).click()
        admin.get_by_role("button", name="어학 추가", exact=True).click()
        expect(admin.locator("#education-courses")).to_be_hidden()
        expect(admin.locator("#credential-number-label")).to_have_text("등록번호")
        admin.locator("#item-name").fill("검증용 어학시험")
        admin.locator("#summary").fill("B2")
        admin.locator("#period").fill("2026.10.09")
        admin.locator("#credential-number").fill(synthetic_registration)
        admin.locator("#apply-item").click()
        expect(admin.locator("#credential-number")).to_have_value("")
        admin.get_by_role("button", name="검증용 어학시험 수정", exact=True).click()
        expect(admin.locator("#credential-number")).to_have_value(masked_registration)
        admin.locator("#apply-item").click()

        # Edit existing career details.
        admin.get_by_role("button", name="경력", exact=True).click()
        admin.get_by_role("button", name=original["experience"][1]["name"] + " 위로 이동", exact=True).click()
        expected_experience_ids = [row["id"] for row in original["experience"]]
        expected_experience_ids[0], expected_experience_ids[1] = expected_experience_ids[1], expected_experience_ids[0]
        expect(admin.locator(".editor-row .row-name").first).to_have_text(original["experience"][1]["name"])
        admin.get_by_role("button", name="한국전자통신연구원 수정", exact=True).click()
        expect(admin.locator("#subtitle")).to_have_value(original["experience"][0]["subtitle"])
        admin.locator("#details").fill("검증용 상세 업무 1\n검증용 상세 업무 2")
        admin.locator("#apply-item").click()

        # 수상 편집 내용이 미리보기와 저장 결과에 반영되는지 확인합니다.
        admin.get_by_role("button", name="수상", exact=True).click()
        expect(admin.locator(".editor-row")).to_have_count(4)
        admin.get_by_role("button", name="행정안전부 장관상 수정", exact=True).click()
        expect(admin.locator("#period-label")).to_have_text("수상일")
        expect(admin.locator("#status-label")).to_have_text("부문")
        admin.locator("#details").fill("검증용 수상 내용")
        expected_research = edit_research_slides(admin, original['awards'][0].get('research'))
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
        expect(admin.locator("#profile-email")).to_have_value(original["profile"]["email"])
        expect(admin.locator("#profile-introduction")).to_have_value(original["profile"]["introduction"])
        expect(admin.locator("#profile-interests")).to_have_value("\n".join(original["profile"]["interests"]))
        admin.locator("#profile-name-input").fill("이찬형 검증")
        admin.locator("#profile-english").fill("Example Person")
        admin.locator("#profile-email").fill("editor@example.test")
        admin.locator("#profile-github").fill("https://github.com/example")
        admin.locator("#profile-linkedin").fill("https://www.linkedin.com/in/example/")
        introduction = '검증용 자기소개\n<img src=x onerror=alert(1)>'
        interests = ["보안 검증", "<script>alert(1)</script>"]
        admin.locator("#profile-introduction").fill(introduction)
        admin.locator("#profile-interests").fill("\n".join(interests))
        admin.set_viewport_size({"width": 320, "height": 844})
        no_overflow(admin)
        admin.set_viewport_size({"width": 1440, "height": 1000})
        admin.locator("#profile-form").get_by_role("button", name="적용", exact=True).click()
        admin.locator("#preview").click()
        expect(admin.locator("#preview-education tbody tr")).to_have_count(3)
        for index, school in enumerate(original["education"]):
            preview_row = admin.locator("#preview-education tbody tr").nth(index)
            expect(preview_row.locator(".education-details li")).to_have_text(school["details"])
            expect(preview_row.locator("details:not(.course-details)")).to_have_count(0)
        expect(admin.locator("#preview-awards tbody tr")).to_have_count(4)
        expect(admin.locator("#preview-awards tbody tr").first.locator(".award-details")).to_have_text("검증용 수상 내용")
        expect(admin.locator("#preview-awards tbody tr").first.locator(".award-details")).to_be_visible()
        check_research_preview(admin, expected_research)
        expect(admin.locator("#preview-certifications .credential-number").last).to_have_text(masked_number)
        assert synthetic_number not in admin.locator("#preview-content").inner_html()
        expect(admin.locator("#preview-languages .credential-number").last).to_have_text(masked_registration)
        expect(admin.locator("#preview-education .course-details").last.locator("li")).to_have_text(synthetic_courses)
        expect(admin.locator("#preview-education .course-grade").last).to_have_text("A+")
        assert synthetic_registration not in admin.locator("#preview-content").inner_html()
        expect(admin.locator("#preview-dialog h1")).to_contain_text("이찬형 검증")
        expect(admin.locator("#preview-dialog .profile-introduction p")).to_have_text(introduction)
        expect(admin.locator("#preview-dialog .profile-interests li")).to_have_text(interests)
        expect(admin.locator('#preview-profile-links a[href^="mailto:"]')).to_have_attribute("href", "mailto:editor@example.test")
        assert admin.locator("#preview-content script").count() == 0
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
        assert state["data"]["certifications"][-1]["maskedNumber"] == masked_number
        assert synthetic_number not in json.dumps(state["data"])
        assert synthetic_registration not in json.dumps(state["data"])
        assert state["data"]["languages"][-1]["maskedNumber"] == masked_registration
        assert state["data"]["education"][-1]["courses"] == synthetic_courses
        assert state["data"]["education"][-1]["summaryEnglish"] == "Information Security"
        assert [row["id"] for row in state["data"]["certifications"][:-1]] == expected_certificate_ids
        assert [row["id"] for row in state["data"]["experience"]] == expected_experience_ids
        assert state["data"]["awards"][0]["details"] == ["검증용 수상 내용"]
        assert state['data']['awards'][0]['research'] == expected_research
        assert state['data']['awards'][1:] == original['awards'][1:]
        assert state["data"]["profile"]["name"] == "이찬형 검증"
        assert state["data"]["education"][-1]["logo"].startswith("data:image/png;base64,")
        assert next(row for row in state["data"]["experience"] if row["id"] == "exp-etri")["details"] == ["검증용 상세 업무 1", "검증용 상세 업무 2"]
        assert state["data"]["profile"]["introduction"] == introduction
        assert state["data"]["profile"]["interests"] == interests

        # Public rendering uses the same persisted payload.
        saved = context.new_page()
        saved.route(BASE + "/data/portfolio.json", lambda route: route.fulfill(json=state["data"]))
        saved.goto(BASE)
        expect(saved.locator("#profile-name")).to_contain_text("이찬형 검증")
        expect(saved.locator("#profile-name span")).to_have_text("Example Person")
        expect(saved.locator(".brand-mark")).to_have_text("EP")
        expect(saved.locator(".site-footer > span")).to_have_text("이찬형 검증")
        expect(saved.locator(".header-github")).to_have_attribute("href", "https://github.com/example")
        expect(saved.locator('#profile-links a[href^="mailto:"]')).to_have_attribute("href", "mailto:editor@example.test")
        expect(saved.locator('#profile-links a[href^="https://www.linkedin.com"]')).to_have_attribute("href", "https://www.linkedin.com/in/example/")
        expect(saved.locator(".profile-introduction p")).to_have_text(introduction)
        expect(saved.locator(".profile-interests li")).to_have_text(interests)
        assert saved.locator('#profile img[src="x"], #profile script').count() == 0
        expect(saved.locator("#certifications .row-name")).to_have_text([row["name"] for row in state["data"]["certifications"]])
        expect(saved.locator("#experience .row-name")).to_have_text([row["name"] for row in state["data"]["experience"]])
        expect(saved.locator("#education tbody tr")).to_have_count(3)
        expect(saved.locator("#certifications .credential-number").last).to_have_text(masked_number)
        assert synthetic_number not in saved.content()
        assert synthetic_registration not in saved.content()
        expect(saved.locator("#languages .credential-number").last).to_have_text(masked_registration)
        expect(saved.locator("#education .course-details").last.locator("li")).to_have_text(synthetic_courses)

        admin.screenshot(path=str(ARTIFACTS / "admin.png"), full_page=True)
        admin.set_viewport_size({"width": 390, "height": 844})
        no_overflow(admin)
        admin.set_viewport_size({"width": 320, "height": 844})
        no_overflow(admin)
        admin.set_viewport_size({"width": 390, "height": 844})
        admin.locator("#add-item").click()
        expect(admin.locator("#item-dialog")).to_be_visible()
        no_overflow(admin)
        admin.screenshot(path=str(ARTIFACTS / "admin-mobile.png"), full_page=True)
        admin.locator("#item-dialog").get_by_role("button", name="취소", exact=True).click()
        admin.locator("#logout").click()
        expect(admin.locator("#editor-panel")).to_be_hidden()
        expect(admin.locator("#login-form")).to_be_visible()
        assert admin.evaluate("localStorage.length === 0 && sessionStorage.length === 0")

        # 저장 후 다시 로그인해도 순서와 프로필이 유지됩니다.
        login(admin)
        admin.get_by_role("button", name="자격", exact=True).click()
        expect(admin.locator(".editor-row .row-name")).to_have_text([row["name"] for row in state["data"]["certifications"]])
        admin.locator("#edit-profile").click()
        expect(admin.locator("#profile-introduction")).to_have_value(introduction)
        expect(admin.locator("#profile-interests")).to_have_value("\n".join(interests))
        admin.locator("#profile-introduction").fill("")
        admin.locator("#profile-interests").fill("")
        admin.locator("#profile-form").get_by_role("button", name="적용", exact=True).click()
        admin.locator("#preview").click()
        expect(admin.locator("#preview-content .profile-overview")).to_have_count(0)
        admin.locator("#preview-dialog").get_by_role("button", name="닫기", exact=True).click()

        # 새 프로필 필드가 없는 기존 데이터도 공개 화면에서 열립니다.
        legacy_data = copy.deepcopy(original)
        del legacy_data["profile"]["introduction"]
        del legacy_data["profile"]["interests"]
        for award in legacy_data['awards']:
            award.pop('research', None)
        legacy = context.new_page()
        legacy.route(BASE + "/data/portfolio.json", lambda route: route.fulfill(json=legacy_data))
        legacy.goto(BASE)
        expect(legacy.locator(".resume-section")).to_have_count(7)
        expect(legacy.locator(".profile-overview")).to_have_count(0)
        expect(legacy.locator('.research-open')).to_have_count(0)

        # A non-writer cannot enter the editing panel.
        denied = context.new_page()
        denied.route("https://api.github.com/**", lambda route: route.fulfill(json={"permissions": {"push": False}}))
        denied.goto(BASE + "/admin/")
        denied.locator("#token").fill("read-only-token")
        denied.locator("#login-button").click()
        expect(denied.locator("#status")).to_contain_text("수정할 수 있는 계정")
        expect(denied.locator("#editor-panel")).to_be_hidden()

        check_posts(browser, BASE, ROOT, ARTIFACTS)
        assert not errors, errors
        browser.close()
        print("PASS: public tables, logos, responsive layouts, expandable details, admin access, add/edit/delete/reorder, logo upload, preview, failed save, conflict, Unicode persistence, logout and read-only access.")
        print("Screenshots:", ARTIFACTS)
finally:
    server.shutdown()
