import copy
from playwright.sync_api import expect

API = 'https://personal-profile-admin-auth.leedidc1227.workers.dev/api/'

def check_site_insights(browser, base, artifacts):
    errors = []
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    sample = {'days': 30, 'total': 18, 'countries': [{'code': 'KR', 'count': 12}, {'code': 'US', 'count': 5}, {'code': 'DE', 'count': 1}], 'since': '2026-10-10', 'through': '2026-10-10'}
    state = {'data': copy.deepcopy(sample), 'failed': False, 'visits': 0}

    def statistics(route):
        req = route.request
        assert not req.post_data
        assert 'cookie' not in req.headers
        assert 'authorization' not in req.headers
        assert 'referer' not in req.headers
        if req.method == 'POST':
            state['visits'] += 1
        if state['failed']:
            route.fulfill(status=503, json={'error': 'Synthetic error'})
        else:
            route.fulfill(json=state['data'])

    context.route(API + 'visitor-stats', statistics)
    context.route(API + 'visitor', lambda route: route.fulfill(json={'ip': '192.0.2.90', 'country': 'KR'}))
    # 실제 공개 도메인과 동일한 집계 분기를 로컬 모의 서버에서 검사합니다.
    def config(route):
        text = route.fetch().text().replace("publicOrigin: 'https://lee.chanhyeong.kro.kr'", "publicOrigin: '" + base + "'")
        route.fulfill(body=text, content_type='application/javascript')
    context.route('**/js/portfolio-config.js', config)
    page.goto(base)
    expect(page.locator('#connection-heading')).to_contain_text('HTTPS로 연결되지 않았습니다')
    expect(page.locator('#connection-protections')).to_be_hidden()
    expect(page.locator('#visitor-total')).to_have_text('18')
    expect(page.locator('#visitor-map-points button')).to_have_count(3)
    assert state['visits'] == 1
    expect(page.locator('#visitor-map-selection')).to_contain_text('대한민국')
    point = page.locator('[data-country="US"]')
    point.click()
    expect(page.locator('#visitor-map-selection')).to_contain_text('미국 · 5회')
    expect(point).to_have_attribute('aria-pressed', 'true')
    page.locator('#visitor-country-select').select_option('DE')
    expect(page.locator('#visitor-map-selection')).to_contain_text('독일 · 1회')
    assert '192.0.2.90' not in page.locator('.visitor-map-card').inner_text()
    for width in [1440, 768, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1100})
        page.locator('#site-insights').scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('.security-path [data-security-step="1"]').click()
        expect(page.locator('#security-dialog')).to_be_visible()
        expect(page.locator('#security-step-description')).to_contain_text('현재 페이지에는 HTTPS가 적용되어 있지 않습니다')
        for step in range(4):
            button = page.locator('#security-dialog [data-security-step="' + str(step) + '"]')
            button.click()
            expect(button).to_have_attribute('aria-pressed', 'true')
            expect(page.locator('#security-step-description')).not_to_be_empty()
        assert page.locator('#security-dialog').evaluate('el => el.scrollWidth <= el.clientWidth')
        page.keyboard.press('Escape')
        expect(page.locator('#security-dialog')).to_be_hidden()
        if width in [1440, 390, 320]:
            page.locator('#site-insights').screenshot(path=str(artifacts / f'site-insights-{width}.png'))
    page.set_viewport_size({'width': 1440, 'height': 1100})
    shield = page.locator('.network-visual')
    shield.focus()
    page.keyboard.press('Enter')
    expect(page.locator('#security-dialog')).to_be_visible()
    page.locator('#security-dialog-close').click()
    expect(shield).to_be_focused()
    page.reload()
    expect(page.locator('#visitor-total')).to_have_text('18')
    assert state['visits'] == 1
    page.goto(base + '/posts/')
    expect(page.locator('#posts-list')).to_be_visible()
    assert state['visits'] == 1
    page.evaluate("sessionStorage.setItem('portfolio-visit-at-v1', String(Date.now() - 31 * 60 * 1000))")
    page.reload()
    page.wait_for_timeout(300)
    assert state['visits'] == 2
    state['data'] = {**sample, 'total': 0, 'countries': []}
    page.goto(base)
    expect(page.locator('#visitor-total')).to_have_text('0')
    expect(page.locator('#visitor-map-points button')).to_have_count(0)
    expect(page.locator('#visitor-map-selection')).to_contain_text('첫 방문')
    state['failed'] = True
    page.reload()
    expect(page.locator('#visitor-map-retry')).to_be_visible()
    expect(page.locator('#profile h1')).to_be_visible()
    state['failed'] = False
    state['data'] = copy.deepcopy(sample)
    page.locator('#visitor-map-retry').click()
    expect(page.locator('#visitor-total')).to_have_text('18')
    state['data']['countries'][0]['code'] = '<script>'
    page.reload()
    expect(page.locator('#visitor-map-retry')).to_be_visible()
    expect(page.locator('#visitor-map-points button')).to_have_count(0)
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.security-path').evaluate("el => getComputedStyle(el, '::after').animationName === 'none'")
    assert not errors, errors
    context.close()

    # HTTPS와 로컬 HTTP에서 보안 상태를 다르게 표시하는지 확인합니다.
    secure_context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    secure_context.route(API + '**', lambda route: route.fulfill(status=503, json={}))

    def local_https_page(route):
        local_url = route.request.url.replace('https://portfolio.example', base, 1)
        route.fulfill(response=route.fetch(url=local_url))

    secure_context.route('https://portfolio.example/**', local_https_page)
    secure_page = secure_context.new_page()
    secure_page.on('pageerror', lambda error: errors.append(str(error)))
    secure_page.goto('https://portfolio.example/')
    expect(secure_page.locator('#connection-heading')).to_have_text('해당 사이트는 안전하게 보호되고 있습니다.')
    expect(secure_page.locator('#connection-https')).to_have_text('HTTPS 연결')
    expect(secure_page.locator('#connection-protections')).to_be_visible()
    for width in [1440, 390, 320]:
        secure_page.set_viewport_size({'width': width, 'height': 1100})
        assert secure_page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        secure_page.locator('.security-path [data-security-step="1"]').click()
        expect(secure_page.locator('#security-step-description')).to_contain_text('TLS로 암호화됩니다')
        secure_page.keyboard.press('Escape')
        secure_page.locator('#security-connection').screenshot(path=str(artifacts / f'security-status-{width}.png'))
    assert not errors, errors
    secure_context.close()
    print('PASS: HTTPS/HTTP status, concise connection flow, shield keyboard/dialog, country map, private aggregates, session deduplication, empty/error states and mobile/reduced motion.')
