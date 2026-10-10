import time
from playwright.sync_api import expect


def check_site_intro(browser, base, artifacts):
    errors = []
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='no-preference')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    started = time.monotonic()
    page.goto(base, wait_until='domcontentloaded')
    expect(page.locator('#site-intro')).to_be_visible()
    expect(page.locator('#site-intro-skip')).to_be_focused()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.wait_for_timeout(300)
    page.screenshot(path=str(artifacts / 'intro-locked.png'))
    page.wait_for_timeout(1100)
    page.screenshot(path=str(artifacts / 'intro-unlocked.png'))
    expect(page.locator('#site-intro')).to_have_count(0, timeout=3500)
    assert 2 <= time.monotonic() - started < 4
    assert page.evaluate("!document.documentElement.classList.contains('intro-playing')")
    expect(page.locator('#profile h1')).to_be_visible()
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#site-intro')).to_have_count(0)
    context.close()

    for width, height, action in [(390, 844, 'skip'), (320, 640, 'escape'), (844, 390, 'reduce')]:
        context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='no-preference')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base, wait_until='domcontentloaded')
        expect(page.locator('#site-intro')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        button = page.locator('#site-intro-skip').bounding_box()
        assert button['y'] + button['height'] <= height
        if action == 'skip':
            page.wait_for_timeout(350)
            page.screenshot(path=str(artifacts / 'intro-mobile.png'))
            page.locator('#site-intro-skip').click()
        elif action == 'escape':
            page.keyboard.press('Escape')
        else:
            page.emulate_media(reduced_motion='reduce')
        expect(page.locator('#site-intro')).to_have_count(0)
        assert page.evaluate("!document.documentElement.classList.contains('intro-playing')")
        page.locator('.header-github').focus()
        expect(page.locator('.header-github')).to_be_focused()
        context.close()

    context = browser.new_context(reduced_motion='reduce')
    page = context.new_page()
    page.goto(base)
    expect(page.locator('#site-intro')).to_have_count(0)
    expect(page.locator('#profile h1')).to_be_visible()
    context.close()

    context = browser.new_context()
    page = context.new_page()
    page.goto(base + '/#certifications')
    expect(page.locator('#site-intro')).to_have_count(0)
    context.close()

    for asset in ['js/site-intro.js', 'css/site-intro.css']:
        context = browser.new_context()
        context.route('**/' + asset, lambda route: route.abort())
        page = context.new_page()
        page.goto(base)
        expect(page.locator('#site-intro')).not_to_be_visible()
        expect(page.locator('#profile h1')).to_be_visible()
        assert page.evaluate("!document.documentElement.classList.contains('intro-playing')")
        context.close()

    context = browser.new_context()
    context.add_init_script("Object.defineProperty(window, 'sessionStorage', {get() {throw new DOMException('Blocked', 'SecurityError');}})")
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    expect(page.locator('#site-intro')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#profile h1')).to_be_visible()
    context.close()

    context = browser.new_context(java_script_enabled=False)
    page = context.new_page()
    page.goto(base)
    expect(page.locator('#site-intro')).not_to_be_visible()
    expect(page.locator('main noscript')).to_be_visible()
    context.close()
    assert not errors, errors
    print('PASS: 2.4-second intro, unlock frames, once per tab, keyboard/skip, mobile/landscape, reduced motion, deep links, blocked storage and missing assets/JavaScript.')
