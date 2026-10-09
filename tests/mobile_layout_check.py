from playwright.sync_api import expect


def check_mobile_layout(browser, base, artifacts):
    context = browser.new_context(is_mobile=True, has_touch=True, device_scale_factor=2)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for width, height in [(320, 568), (360, 740), (390, 844), (430, 932), (681, 900), (768, 1024), (844, 390)]:
        page.set_viewport_size({'width': width, 'height': height})
        for path, ready in [('/', '#skills'), ('/posts/', '#posts-list'), ('/posts/view.html?id=legacy-1', '.post-body'), ('/admin/', '#login-form'), ('/admin/posts.html', '#login-form')]:
            page.goto(base + path)
            expect(page.locator(ready)).to_be_visible()
            assert page.evaluate('(width) => document.documentElement.scrollWidth <= width + 1 && innerWidth <= width + 1', width), f'Overflow at {width}: {path}'
        if width == 320:
            page.goto(base)
            page.locator('#experience details summary').first.click()
            row = page.locator('#experience tbody tr').first
            assert row.locator('.content-cell').bounding_box()['width'] >= row.bounding_box()['width'] - 36
            page.locator('#experience').screenshot(path=str(artifacts / 'mobile-experience.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.add_init_script('''(() => {
      const viewport = new EventTarget();
      Object.assign(viewport, {height: 844, width: 390, offsetTop: 0, scale: 1});
      Object.defineProperty(window, 'visualViewport', {value: viewport});
      window.simulateKeyboardViewport = (height, offsetTop) => {
        Object.assign(viewport, {height, offsetTop});
        viewport.dispatchEvent(new Event('resize'));
      };
    })();''')
    page.goto(base)
    page.locator('#ai-chat-launcher').click()
    page.evaluate('simulateKeyboardViewport(380, 40)')
    expect(page.locator('#ai-chat-panel')).to_have_class('ai-chat-panel is-keyboard-open')
    panel = page.locator('#ai-chat-panel').bounding_box()
    send = page.locator('#ai-chat-send').bounding_box()
    assert panel['y'] >= 40 and panel['y'] + panel['height'] <= 420
    assert send['y'] + send['height'] <= 420, 'Chat send button behind virtual keyboard'
    page.locator('#ai-chat-panel').screenshot(path=str(artifacts / 'chat-keyboard-layout.png'))
    page.evaluate('simulateKeyboardViewport(844, 0)')
    expect(page.locator('#ai-chat-panel')).to_have_class('ai-chat-panel')
    assert not errors, errors
    context.close()
    print('PASS: touch/mobile layouts at 320–844px, landscape, public/admin routes and simulated on-screen keyboard.')
