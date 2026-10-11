"""Check exploration, changing published data, paging and accessible mobile navigation."""
import copy
import json

from playwright.sync_api import expect


def check_study_map(browser, base, root, artifacts):
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base + "/posts/")
    expect(page.locator("#study-map")).to_be_visible()
    expect(page.locator("#posts-table-wrap")).to_be_hidden()
    page.locator("#study-map").screenshot(path=str(artifacts / "study-map-desktop.png"))
    actual = json.loads((root / "data/posts/index.json").read_text(encoding="utf-8"))
    if actual["posts"]:
        post = actual["posts"][0]
        page.locator("#category-filter").select_option(post["categoryId"])
        expect(page.locator("#study-map-heading")).to_have_text(next(
            (category["name"] for category in actual["categories"] if category["id"] == post["categoryId"]), "미분류"))
        page.locator("#study-map").screenshot(path=str(artifacts / "study-map-posts.png"))

    fixture = {
        "version": 1,
        "categories": [{"id": f"topic-{i}", "name": f"주제 {i}"} for i in range(9)],
        "posts": [
            {"id": f"note-{i}", "title": f"네트워크 학습 {i:02}", "date": "2026-10-10", "categoryId": "topic-0"}
            for i in range(17)
        ] + [{"id": "unfiled", "title": "분류 없는 기록", "date": "2026-10-09", "categoryId": ""}],
    }
    state = {"index": copy.deepcopy(fixture), "fail": False}

    def load_index(route):
        if state["fail"]:
            route.fulfill(status=503, body="Unavailable")
        else:
            route.fulfill(json=state["index"])

    page.route("**/data/posts/index.json", load_index)
    page.reload()
    expect(page.locator("#study-map-summary")).to_have_text("10개 주제 · 18개의 글")
    category_nodes = page.locator('.study-map-node[data-kind="category"]')
    expect(category_nodes).to_have_count(6)
    expect(category_nodes.first).to_contain_text("주제 0")
    page.locator("#study-map-next").click()
    expect(category_nodes).to_have_count(4)
    expect(category_nodes.last).to_contain_text("미분류")
    page.locator("#study-map-previous").click()
    category_nodes.first.focus()
    page.keyboard.press("Enter")
    expect(page.locator("#category-filter")).to_have_value("topic-0")
    expect(page.locator("#study-map-back")).to_be_focused()

    # Every published note remains reachable as the collection grows.
    seen = []
    post_nodes = page.locator('.study-map-node[data-kind="post"]')
    for count in [6, 6, 5]:
        expect(post_nodes).to_have_count(count)
        seen.extend(post_nodes.evaluate_all("nodes => nodes.map(node => node.dataset.id)"))
        if len(seen) < 17:
            page.locator("#study-map-next").click()
    assert seen == [post["id"] for post in fixture["posts"][:17]]
    post_nodes.first.focus()
    page.keyboard.press("Space")
    expect(post_nodes.first).to_have_attribute("aria-pressed", "true")
    expect(post_nodes.first).to_be_focused()
    expect(page.locator("#study-map-results a")).to_have_count(1)
    selected_id = post_nodes.first.get_attribute("data-id")
    expect(page.locator("#study-map-results a")).to_have_attribute("href", "./view.html?id=" + selected_id)
    page.locator("#study-map-results a").click()
    expect(page).to_have_url(base + "/posts/view.html?id=" + selected_id)

    # Search and both views use the same current category and published data.
    page.goto(base + "/posts/")
    page.locator("#post-search").fill("학습 13")
    expect(category_nodes).to_have_count(1)
    category_nodes.first.click()
    expect(post_nodes).to_have_count(1)
    page.locator("#show-post-list").click()
    expect(page.locator("#study-map")).to_be_hidden()
    expect(page.locator("#posts-table-wrap")).to_be_visible()
    expect(page.locator("#posts-list tr")).to_have_count(1)
    page.locator("#show-study-map").click()
    expect(page.locator("#study-map")).to_be_visible()
    expect(post_nodes).to_have_count(1)
    page.locator("#post-search").fill("no matching title")
    expect(post_nodes).to_have_count(0)
    expect(page.locator("#study-map-results")).to_contain_text("검색 결과가 없습니다")
    page.locator("#post-search").fill("")
    page.locator("#category-filter").select_option("topic-8")
    expect(page.locator("#study-map-results")).to_contain_text("아직 연결된 글이 없습니다")
    page.locator("#study-map-back").click()
    expect(page.locator('.study-map-node[data-id="topic-8"]')).to_be_focused()

    # Administrator renames, additions and deletions appear without rewriting the catalog.
    state["index"]["categories"][0]["name"] = '<img src=x onerror=alert(1)> 새 주제'
    state["index"]["posts"] = [{"id": "replacement", "title": "<script> 새 기록", "date": "2026-10-11", "categoryId": "topic-0"}]
    page.reload()
    expect(category_nodes.first).to_contain_text('<img src=x onerror=alert(1)> 새 주제')
    expect(page.locator("#study-map img, #study-map script")).to_have_count(0)
    category_nodes.first.click()
    expect(post_nodes).to_have_count(1)
    expect(post_nodes.first).to_contain_text("<script> 새 기록")
    expect(page.locator("#study-map-results strong")).to_have_text("<script> 새 기록")
    assert page.locator('.study-map-node[data-id="note-0"]').count() == 0

    state["index"] = copy.deepcopy(fixture)
    for width in [1024, 820, 768, 390, 320]:
        page.set_viewport_size({"width": width, "height": 900})
        page.reload()
        expect(category_nodes.first).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        # Labels, touch targets and center never overlap at desktop/mobile breakpoints.
        assert page.locator("#study-map-canvas").evaluate("""canvas => {
            const bounds = canvas.getBoundingClientRect();
            const boxes = [...canvas.querySelectorAll('button, .study-map-root')].map(node => node.getBoundingClientRect());
            return boxes.every((box, index) => box.width >= 44 && box.height >= 44 &&
                box.left >= bounds.left && box.right <= bounds.right &&
                boxes.slice(index + 1).every(other => box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top));
        }"""), f"Overlapping nodes at {width}px"
        assert page.locator("#study-map-connections line").first.evaluate("node => getComputedStyle(node).animationName") == "none"
        category_nodes.first.click()
        post_nodes.first.click()
        expect(page.locator("#study-map-results a")).to_have_count(1)
        if width == 390:
            page.screenshot(path=str(artifacts / "study-map-mobile.png"), full_page=True)

    state["index"] = {"version": 1, "categories": [], "posts": []}
    page.reload()
    expect(page.locator("#study-map-summary")).to_have_text("0개 주제 · 0개의 글")
    expect(page.locator("#study-map-results")).to_contain_text("아직 연결된 글이 없습니다")
    state["fail"] = True
    page.reload()
    expect(page.locator("#retry-posts")).to_be_visible()
    expect(page.locator("#study-map")).to_be_hidden()
    state["fail"] = False
    page.locator("#retry-posts").click()
    expect(page.locator("#study-map")).to_be_visible()
    assert not errors, errors
    context.close()
    print("PASS: study map navigation, search, pagination, updated data, safe text, mobile, keyboard and reduced motion.")
