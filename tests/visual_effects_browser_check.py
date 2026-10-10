from playwright.sync_api import expect


def wait_for_scroll_idle(page):
    page.evaluate("""() => new Promise(resolve => {
        let previous = window.scrollY;
        let stableFrames = 0;
        function check() {
            stableFrames = window.scrollY === previous ? stableFrames + 1 : 0;
            previous = window.scrollY;
            if (stableFrames >= 4) {
                resolve();
            } else {
                requestAnimationFrame(check);
            }
        }
        requestAnimationFrame(check);
    })""")


def check_visual_effects(browser, base, artifacts):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='no-preference')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    visual = page.locator('.network-visual')
    expect(visual).to_be_visible()
    expect(visual.locator('.network-caption')).to_have_text('SECURITY')
    expect(visual).to_have_attribute('aria-label', '보안 연결 안내')
    expect(visual).to_have_class('network-visual is-animating')
    radar = visual.locator('.network-radar')
    assert radar.evaluate("el => el.getAnimations()[0].playState === 'running'")
    visual.hover(position={'x': 35, 'y': 70})
    page.wait_for_function("document.querySelector('.network-art').style.getPropertyValue('--network-tilt-y') !== ''")
    assert visual.locator('.network-art').evaluate("el => getComputedStyle(el).transform !== 'none'")
    page.evaluate("window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'})")
    page.wait_for_function("getComputedStyle(document.getElementById('reading-progress')).transform === 'matrix(1, 0, 0, 1, 0, 0)'")
    expect(visual).to_have_class('network-visual')
    assert visual.evaluate("el => el.getAnimations({subtree: true}).every(animation => animation.playState === 'paused')")
    assert visual.locator('.network-art').evaluate("el => getComputedStyle(el).transform === 'none'")
    page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
    expect(visual).to_have_class('network-visual is-animating')
    page.locator('#skills').scroll_into_view_if_needed()
    expect(visual).to_have_class('network-visual')
    navigation = page.locator('.portfolio-header nav')
    indicator = navigation.locator('.nav-indicator')
    for destination in ['training', 'experience']:
        link = navigation.locator(f'a[href="#{destination}"]')
        link.focus()
        wait_for_scroll_idle(page)
        page.keyboard.press('Enter')
        wait_for_scroll_idle(page)
        expect(link).to_have_attribute('aria-current', 'location')
        expect(indicator).to_be_visible()
        page.wait_for_function("""() => {
            const active = document.querySelector('.portfolio-header nav a[aria-current]').getBoundingClientRect();
            const marker = document.querySelector('.nav-indicator').getBoundingClientRect();
            return Math.abs(active.left - marker.left) < 1 && Math.abs(active.width - marker.width) < 1;
        }""")
    page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
    expect(visual).to_have_class('network-visual is-animating')
    page.emulate_media(reduced_motion='reduce')
    expect(visual).to_have_class('network-visual')
    assert visual.evaluate('el => el.getAnimations({subtree: true}).length === 0')
    assert indicator.evaluate("el => getComputedStyle(el).transitionDuration === '0s'")
    expect(page.locator('#education .section-heading')).to_be_visible()
    page.emulate_media(reduced_motion='no-preference')
    expect(visual).to_have_class('network-visual is-animating')
    for width in [1440, 1024, 960, 950, 768, 390, 320, 960, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('#profile').screenshot(path=str(artifacts / f'visual-profile-{width}.png'), animations='disabled')
    assert not errors, errors
    context.close()

    touch = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='no-preference')
    page = touch.new_page()
    page.goto(base)
    page.locator('.network-visual').scroll_into_view_if_needed()
    page.locator('.network-art').tap()
    assert page.locator('.network-art').evaluate("el => el.style.getPropertyValue('--network-tilt-y') === ''")
    expect(page.locator('#security-dialog')).to_be_visible()
    page.locator('#security-dialog-close').tap()
    navigation = page.locator('.portfolio-header nav')
    navigation.locator('a[href="#awards"]').tap()
    expect(navigation.locator('a[href="#awards"]')).to_have_attribute('aria-current', 'location')
    page.wait_for_function("""() => {
        const active = document.querySelector('.portfolio-header nav a[aria-current]').getBoundingClientRect();
        const marker = document.querySelector('.nav-indicator').getBoundingClientRect();
        return Math.abs(active.left - marker.left) < 1 && Math.abs(active.width - marker.width) < 1;
    }""")
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    touch.close()

    fallback = browser.new_context(reduced_motion='reduce')
    fallback.route('**/js/portfolio-effects.js', lambda route: route.abort())
    page = fallback.new_page()
    page.goto(base)
    expect(page.locator('#profile h1')).to_be_visible()
    expect(page.locator('#education')).to_be_visible()
    expect(page.locator('#skills')).to_be_visible()
    expect(page.locator('.network-visual')).to_have_count(0)
    fallback.close()
    print('PASS: security caption, radar and pointer motion, sliding navigation, keyboard/touch, reduced motion, off-screen pause/resume, reading progress, responsive layout and content fallback.')
