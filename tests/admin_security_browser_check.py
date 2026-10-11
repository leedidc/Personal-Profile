import copy
import json
import time
from playwright.sync_api import expect


def check_admin_security(browser, base, root, artifacts):
    portfolio = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    state = {
        'authenticated': False, 'writes': 0, 'reads': 0, 'revoked': 0, 'conflict': False,
        'revision': 0,
        'settings': {'sessionMinutes': 120, 'idleMinutes': 30, 'loginAttempts': 5, 'loginWindowMinutes': 15, 'retentionDays': 30},
    }
    now = int(time.time() * 1000)
    events = [
        {'time': now - index * 1000, 'kind': 'login_failure' if index % 2 else 'page_access',
         'status': 401 if index % 2 else 200, 'ip': '192.0.2.*', 'country': 'KR', 'browser': 'Chrome', 'path': '/admin/'}
        for index in range(45)
    ]
    events[0]['browser'] = '<img src=x onerror=alert(1)>'
    csrf = 'd' * 64
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    errors = []
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
    config = (root / 'js/portfolio-config.js').read_text(encoding='utf-8').replace(
        "origin: 'https://personal-profile-admin-auth.leedidc1227.workers.dev'", "origin: '" + base + "'")
    context.route(base + '/js/portfolio-config.js', lambda route: route.fulfill(content_type='application/javascript', body=config))

    def api(route):
        request = route.request
        path = request.url.split('/api/admin')[1]
        assert 'authorization' not in request.headers
        if path == '/status':
            route.fulfill(json={'passwordLogin': True})
            return
        if path == '/login':
            assert request.post_data_json == {'username': 'synthetic-admin', 'password': 'synthetic-security-password'}
            state['authenticated'] = True
            route.fulfill(json={'csrf': csrf, 'expires': now + 7200000})
            return
        if not state['authenticated']:
            route.fulfill(status=401, json={'error': '로그인이 만료되었습니다. 다시 로그인해 주세요.'})
            return
        if request.method != 'GET':
            assert request.headers['x-csrf-token'] == csrf
        if path == '/session':
            route.fulfill(json={'csrf': csrf, 'expires': now + 7200000})
        elif path == '/portfolio' and request.method == 'GET':
            route.fulfill(json={'data': portfolio, 'sha': 'synthetic-security-sha'})
        elif path == '/security' and request.method == 'GET':
            state['reads'] += 1
            route.fulfill(json={'settings': state['settings'], 'revision': state['revision'], 'events': events, 'maxEvents': 500, 'activeSessions': 1 if state['revoked'] else 2})
        elif path == '/security' and request.method == 'PUT':
            if state['conflict']:
                route.fulfill(status=409, json={'error': '다른 곳에서 보안 설정이 변경되었습니다. 다시 불러온 후 저장해 주세요.'})
                return
            body = request.post_data_json
            assert body['revision'] == state['revision']
            state['settings'] = copy.deepcopy(body['settings'])
            state['revision'] += 1
            state['writes'] += 1
            route.fulfill(json={'settings': state['settings'], 'revision': state['revision']})
        elif path == '/security/revoke':
            state['revoked'] += 1
            route.fulfill(json={'revoked': 1})
        elif path == '/logout':
            state['authenticated'] = False
            route.fulfill(json={'loggedOut': True})
        else:
            raise AssertionError(path)

    context.route(base + '/api/admin/**', api)
    page = context.new_page()
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(base + '/admin/')
    expect(page.locator('#open-admin-security')).to_be_hidden()
    assert state['reads'] == 0

    def login():
        page.locator('#username').fill('synthetic-admin')
        page.locator('#password').fill('synthetic-security-password')
        page.locator('#login-button').click()
        expect(page.locator('#login-form')).to_be_hidden()

    login()
    page.locator('#open-admin-security').click()
    expect(page.locator('#admin-security-content')).to_be_visible()
    expect(page.locator('#security-session-count')).to_contain_text('2개')
    dialog = page.locator('#admin-security-dialog')
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1100})
        assert dialog.evaluate('(node) => node.scrollWidth <= node.clientWidth')
        dialog.screenshot(path=str(artifacts / f'admin-security-settings-{width}.png'))
    page.locator('#security-session').select_option('60')
    page.locator('#security-idle').select_option('15')
    page.locator('#security-save').click()
    expect(page.locator('#admin-security-status')).to_contain_text('서버에 적용')
    assert state['settings']['sessionMinutes'] == 60
    assert state['writes'] == 1
    page.locator('#security-session').select_option('30')
    page.locator('#security-idle').select_option('60')
    page.locator('#security-save').click()
    expect(page.locator('#admin-security-status')).to_contain_text('이하여야')
    assert state['writes'] == 1
    page.locator('#security-idle').select_option('15')
    state['conflict'] = True
    page.locator('#security-save').click()
    expect(page.locator('#admin-security-status')).to_contain_text('다른 곳에서')
    expect(page.locator('#security-session')).to_have_value('30')
    state['conflict'] = False
    page.locator('#security-reload').click()
    expect(page.locator('#security-session')).to_have_value('60')
    page.locator('#security-revoke').click()
    expect(page.locator('#admin-security-status')).to_contain_text('다른 로그인을 모두 종료')
    expect(page.locator('#security-session-count')).to_contain_text('1개')
    assert state['revoked'] == 1
    page.locator('[data-security-tab="events"]').click()
    expect(page.locator('.security-event')).to_have_count(20)
    expect(page.locator('#security-page')).to_have_text('1 / 3')
    expect(page.locator('#security-events img')).to_have_count(0)
    page.locator('#security-next').click()
    expect(page.locator('#security-page')).to_have_text('2 / 3')
    page.locator('#security-event-filter').select_option('login_failure')
    expect(page.locator('#security-events-summary')).to_contain_text('22건')
    expect(page.locator('#security-events')).not_to_contain_text('관리자 화면 접속')
    page.locator('#security-next').click()
    expect(page.locator('.security-event')).to_have_count(2)
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1100})
        assert dialog.evaluate('(node) => node.scrollWidth <= node.clientWidth')
        dialog.screenshot(path=str(artifacts / f'admin-security-events-{width}.png'))
    page.locator('#security-event-filter').select_option('logout')
    expect(page.locator('#security-events-summary')).to_contain_text('표시할 기록이 없습니다')
    expect(page.locator('#security-next')).to_be_disabled()
    expect(page.locator('#security-previous')).to_be_disabled()
    state['authenticated'] = False
    page.locator('#security-refresh').click()
    expect(dialog).to_be_hidden()
    expect(page.locator('#login-form')).to_be_visible()
    expect(page.locator('#security-events')).to_be_empty()
    login()
    page.locator('#open-admin-security').click()
    expect(page.locator('#security-session')).to_have_value('60')
    page.keyboard.press('Escape')
    expect(dialog).to_be_hidden()
    expect(page.locator('#security-events')).to_be_empty()
    assert page.evaluate("!JSON.stringify({...localStorage, ...sessionStorage}).includes('192.0.2')")
    page.locator('#logout').click()
    expect(page.locator('#open-admin-security')).to_be_hidden()
    # 토큰 인증으로 서버 기록 API에 접근하거나 GitHub 토큰을 전달하지 않습니다.
    count = state['reads']
    page.evaluate("AdminSecurityPanel.open('synthetic-github-token')")
    expect(page.locator('#security-server-link')).to_be_visible()
    expect(page.locator('#admin-security-content')).to_be_hidden()
    assert state['reads'] == count
    assert not errors, errors
    context.close()
    print('PASS: private security panel, settings persistence/conflicts, session revocation, record filtering/pagination, safe rendering, expiry cleanup and responsive layouts.')
