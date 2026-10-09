"""Exercise posts with mocked GitHub transactions; never publish test data."""
import base64
import copy
import json
from urllib.parse import urlparse
from playwright.sync_api import expect


def check_posts(browser, base, root, artifacts):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    errors = []
    context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
    files = {str(path.relative_to(root)).replace("\\", "/"): json.loads(path.read_text(encoding="utf-8")) for path in (root / "data/posts").glob("*.json")}
    state = {"head": "head-0", "tree": "tree-0", "writes": 0, "failure": None, "pending": None}
    original_count = len(files["data/posts/index.json"]["posts"])

    def github(route):
        request = route.request
        assert request.headers.get("authorization") == "Bearer posts-test-token"
        path = urlparse(request.url).path.removeprefix("/repos/leedidc/Personal-Profile")
        if request.method == "GET":
            if not path:
                route.fulfill(json={"permissions": {"push": True}})
            elif path.startswith("/git/ref/heads/"):
                route.fulfill(json={"object": {"sha": state["head"]}})
            elif path.startswith("/git/commits/"):
                route.fulfill(json={"tree": {"sha": state["tree"]}})
            elif path.startswith("/contents/"):
                content = files[path.removeprefix("/contents/")]
                route.fulfill(json={"sha": "file-sha", "encoding": "base64", "content": base64.b64encode(json.dumps(content, ensure_ascii=False).encode()).decode()})
            else:
                raise AssertionError(path)
            return
        body = request.post_data_json
        if path == "/git/trees":
            assert body["base_tree"] == state["tree"]
            state["pending"] = body["tree"]
            route.fulfill(json={"sha": "next-tree"})
        elif path == "/git/commits":
            assert body["parents"] == [state["head"]]
            route.fulfill(json={"sha": "next-head"})
        elif path == "/git/refs/heads/main":
            assert body == {"sha": "next-head", "force": False}
            if state["failure"]:
                route.fulfill(status=state["failure"], json={"message": "Test conflict"})
                return
            for entry in state["pending"]:
                if entry.get("sha", "present") is None:
                    del files[entry["path"]]
                else:
                    files[entry["path"]] = json.loads(entry["content"])
            state["writes"] += 1
            state["head"] = "next-head"
            state["tree"] = "next-tree"
            route.fulfill(json={"object": {"sha": "next-head"}})
        else:
            raise AssertionError(path)

    def public_data(route):
        path = urlparse(route.request.url).path.lstrip("/")
        if path in files:
            route.fulfill(json=files[path])
        else:
            route.fulfill(status=404, body="Not found")

    context.route("https://api.github.com/**", github)
    context.route(base + "/data/posts/*.json", public_data)

    def login(page):
        page.goto(base + "/admin/posts.html")
        page.locator("#token").fill("posts-test-token")
        page.locator("#login-button").click()
        expect(page.locator("#workspace")).to_be_visible()
        expect(page.locator("#workspace")).to_be_enabled()
        expect(page.locator("#token")).to_have_value("")

    def no_overflow(page):
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.url

    public = context.new_page()
    public.goto(base + "/html/admin.html")
    expect(public).to_have_url(base + "/admin/posts.html")
    expect(public.locator("#login-form")).to_be_visible()
    public.goto(base + "/html/article.html")
    expect(public).to_have_url(base + "/posts/")
    expect(public.locator("#posts-list tr")).to_have_count(original_count)
    public.locator("#category-filter").select_option("microsoft")
    expect(public.locator("#posts-list tr")).to_have_count(1)
    public.locator("#post-search").fill("no matching title")
    expect(public.locator("#posts-status")).to_have_text("검색 결과가 없습니다.")
    public.goto(base + "/html/article-view.html?id=1")
    expect(public).to_have_url(base + "/posts/view.html?id=legacy-1")
    expect(public.locator("#post-content h1")).to_have_text("SC-200 Study Notes")
    expect(public.locator(".post-body h2")).to_have_text("SC-200")
    public.goto(base + "/posts/view.html?id=legacy-4")
    expect(public.locator(".post-body img")).to_have_count(1)
    public.wait_for_function("document.querySelector('.post-body img')?.naturalWidth > 0")
    public.goto(base + "/posts/view.html?id=missing")
    expect(public.locator("#posts-status")).to_contain_text("찾을 수 없습니다")

    page = context.new_page()
    page.on("dialog", lambda dialog: dialog.accept())
    login(page)
    page.locator("#new-category").fill("브라우저 테스트")
    page.locator("#add-category").click()
    page.locator("#save-categories").click()
    expect(page.locator("#status")).to_contain_text("분류를 저장했습니다")
    category = files["data/posts/index.json"]["categories"][-1]["id"]
    page.locator("#post-title").fill("공부 기록 <img onerror=alert(1)>")
    page.locator("#post-date").fill("2026-10-09")
    page.locator("#post-category").select_option(category)
    body = page.locator("#rich-editor .ql-editor")
    body.click()
    page.locator(".ql-bold").click()
    page.keyboard.insert_text("중요한 개념")
    page.locator(".ql-bold").click()
    page.keyboard.press("Enter")
    page.keyboard.insert_text("공부한 내용을 정리합니다.")
    page.keyboard.press("Enter")
    page.locator(".ql-list[value='bullet']").click()
    page.keyboard.insert_text("복습할 내용")
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")
    page.locator("#post-image").set_input_files(str(root / "image/mois.png"))
    expect(body.locator("img")).to_have_count(1)
    page.locator("#save-draft").click()
    expect(page.locator("#draft-status")).to_contain_text("초안 보관됨")
    expect(page.locator("#draft-list .sidebar-post")).to_have_count(1)
    assert len(files["data/posts/index.json"]["posts"]) == original_count
    page.locator("#preview-post").click()
    expect(page.locator("#preview-content h1")).to_have_text("공부 기록 <img onerror=alert(1)>")
    expect(page.locator("#preview-content h1 img")).to_have_count(0)
    expect(page.locator("#preview-content strong")).to_have_text("중요한 개념")
    expect(page.locator("#preview-content li")).to_have_text("복습할 내용")
    expect(page.locator("#preview-content img")).to_have_count(1)
    page.screenshot(path=str(artifacts / "posts-preview.png"), full_page=True)
    page.locator("#close-preview").click()
    page.reload()
    expect(page.locator("#workspace")).to_be_hidden()
    expect(page.locator("#token")).to_have_value("")
    login(page)
    page.locator("#draft-list .sidebar-post").first.click()
    expect(body.locator("strong")).to_have_text("중요한 개념")
    expect(body.locator("img")).to_have_count(1)
    page.locator("#publish-post").click()
    expect(page.locator("#status")).to_contain_text("GitHub에 게시했습니다")
    expect(page.locator("#draft-list .sidebar-post")).to_have_count(0)
    post = files["data/posts/index.json"]["posts"][0]
    assert post["categoryId"] == category
    assert len(state["pending"]) == 2
    assert files[f"data/posts/{post['id']}.json"]["content"]["ops"]
    public.goto(base + "/posts/")
    expect(public.locator("#posts-list tr")).to_have_count(original_count + 1)
    public.locator("#category-filter").select_option(category)
    expect(public.locator("#posts-list tr")).to_have_count(1)
    public.locator("#posts-list a").first.click()
    expect(public.locator(".post-body strong")).to_have_text("중요한 개념")
    expect(public.locator(".post-body img")).to_have_count(1)
    expect(public.locator(".post-category")).to_have_text("브라우저 테스트")
    expect(public.locator(".post-meta time")).to_have_text("2026.10.09")
    public.screenshot(path=str(artifacts / "posts-reader.png"), full_page=True)

    # Renames use category IDs; a used category cannot be removed.
    page.get_by_role("button", name="브라우저 테스트 분류 삭제", exact=True).click()
    expect(page.locator("#status")).to_contain_text("사용 중인 분류")
    page.get_by_role("textbox", name="분류 이름: 브라우저 테스트", exact=True).fill("학습 노트")
    page.locator("#save-categories").click()
    expect(page.locator("#status")).to_contain_text("분류를 저장했습니다")
    public.reload()
    expect(public.locator(".post-category")).to_have_text("학습 노트")

    # A non-fast-forward error must preserve both published files and editing content.
    before = copy.deepcopy(files)
    page.locator("#post-title").fill("수정한 제목")
    state["failure"] = 422
    page.locator("#publish-post").click()
    expect(page.locator("#status")).to_contain_text("충돌")
    expect(page.locator("#post-title")).to_have_value("수정한 제목")
    assert files == before
    state["failure"] = None
    page.locator("#publish-post").click()
    expect(page.locator("#status")).to_contain_text("GitHub에 게시했습니다")

    # Refreshing a conflicting snapshot must not silently authorize an old draft.
    page.locator("#post-title").fill("충돌한 초안")
    state["head"] = "external-head"
    page.locator("#publish-post").click()
    expect(page.locator("#status")).to_contain_text("다른 변경사항")
    page.locator("#refresh-posts").click()
    expect(page.locator("#status")).to_contain_text("최신 목록")
    page.locator("#publish-post").click()
    expect(page.locator("#status")).to_contain_text("이전 버전")
    page.locator("#published-list .sidebar-post").filter(has_text="수정한 제목").click()
    expect(page.locator("#post-title")).to_have_value("수정한 제목")

    for width in [1440, 390, 320]:
        page.set_viewport_size({"width": width, "height": 900})
        public.set_viewport_size({"width": width, "height": 900})
        no_overflow(page)
        no_overflow(public)
        public.goto(base + "/posts/")
        expect(public.locator("#posts-list tr")).to_have_count(original_count + 1)
        no_overflow(public)
    page.screenshot(path=str(artifacts / "posts-admin-mobile.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.evaluate("document.activeElement.blur(); window.scrollTo({top:0,behavior:'instant'})")
    page.screenshot(path=str(artifacts / "posts-admin.png"), full_page=True)
    page.locator("#delete-post").click()
    expect(page.locator("#status")).to_contain_text("글을 삭제했습니다")
    assert f"data/posts/{post['id']}.json" not in files
    assert len(files["data/posts/index.json"]["posts"]) == original_count
    # Unsaved categories travel with local drafts and downloaded backups.
    page.locator("#new-category").fill("저장 전 분류")
    page.locator("#add-category").click()
    page.locator("#post-title").fill("로컬 초안")
    page.locator("#post-category").select_option(label="저장 전 분류")
    body.fill("브라우저에만 보관할 내용")
    page.locator("#save-draft").click()
    expect(page.locator("#draft-status")).to_contain_text("초안 보관됨")
    with page.expect_download() as download_info:
        page.locator("#export-draft").click()
    backup = artifacts / "test-post-draft.json"
    download_info.value.save_as(str(backup))
    assert "posts-test-token" not in backup.read_text(encoding="utf-8")
    page.reload()
    login(page)
    page.locator("#draft-list .sidebar-post").filter(has_text="로컬 초안").click()
    expect(page.locator("#post-category option:checked")).to_have_text("저장 전 분류")
    expect(body).to_contain_text("브라우저에만 보관할 내용")
    page.locator("#new-post").click()
    page.locator("#draft-file").set_input_files(str(backup))
    expect(page.locator("#post-title")).to_have_value("로컬 초안")
    expect(body).to_contain_text("브라우저에만 보관할 내용")
    page.locator("#logout").click()
    expect(page.locator("#workspace")).to_be_hidden()
    assert page.evaluate("JSON.stringify(localStorage) + JSON.stringify(sessionStorage)").find("posts-test-token") == -1
    drafts = page.evaluate("PostsDrafts.list()")
    assert "posts-test-token" not in json.dumps(drafts)
    denied = context.new_page()
    denied.route("https://api.github.com/**", lambda route: route.fulfill(json={"permissions": {"push": False}}))
    denied.goto(base + "/admin/posts.html")
    denied.locator("#token").fill("read-only-token")
    denied.locator("#login-button").click()
    expect(denied.locator("#status")).to_contain_text("수정할 수 있는 계정")
    expect(denied.locator("#workspace")).to_be_hidden()
    assert not errors, errors
    context.close()
    print("PASS: posts migration, list/detail/filter, rich formatting, image upload, preview, local drafts, categories, atomic publishing, edit/delete, conflicts, access, token storage, mobile layouts.")
