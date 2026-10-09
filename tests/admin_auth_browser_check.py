import copy
import json
from playwright.sync_api import expect


def check_admin_auth(browser, base, root, artifacts):
    portfolio = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    index = json.loads((root / 'data/posts/index.json').read_text(encoding='utf-8'))
    state = {'authenticated': False, 'portfolio': copy.deepcopy(portfolio), 'index': index, 'writes': 0, 'logins': 0}
    csrf = 'a' * 64
    context = browser.new_context(viewport={'width': 320, 'height': 844})
    errors = []
    github_requests = []
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
    context.route('https://api.github.com/**', lambda route: (github_requests.append(route.request.url), route.abort()))

    def api(route):
        request = route.request
        path = request.url.split('/api/admin')[1]
        body = request.post_data_json if request.method != 'GET' else None
        if path == '/status':
            route.fulfill(json={'passwordLogin': True})
        elif path == '/login':
            state['logins'] += 1
            state['authenticated'] = body == {'username': 'synthetic-admin', 'password': 'synthetic-browser-password'}
            if state['authenticated']:
                route.fulfill(json={'csrf': csrf, 'expires': 9999999999999})
            else:
                route.fulfill(status=401, json={'error': '아이디 또는 비밀번호가 올바르지 않습니다.'})
        elif not state['authenticated']:
            route.fulfill(status=401, json={'error': '로그인이 만료되었습니다. 다시 로그인해 주세요.'})
        else:
            if path != '/session':
                assert request.headers.get('x-csrf-token') == csrf
            assert 'authorization' not in request.headers
            if path == '/session':
                route.fulfill(json={'csrf': csrf, 'expires': 9999999999999})
            elif path == '/portfolio' and request.method == 'GET':
                route.fulfill(json={'data': state['portfolio'], 'sha': 'test-sha'})
            elif path == '/portfolio' and request.method == 'PUT':
                assert body['sha'] == 'test-sha'
                state['portfolio'] = body['data']
                state['writes'] += 1
                route.fulfill(json={'sha': 'saved-sha'})
            elif path == '/posts/snapshot':
                route.fulfill(json={'headSha': 'test-head', 'treeSha': 'test-tree', 'index': state['index']})
            elif path == '/posts/save':
                assert body['headSha'] == 'test-head'
                assert 'treeSha' not in body
                state['index'] = body['index']
                route.fulfill(json={'headSha': 'saved-head', 'treeSha': 'saved-tree', 'index': state['index']})
            elif path == '/logout':
                state['authenticated'] = False
                route.fulfill(json={'loggedOut': True})
            else:
                raise AssertionError(path)

    context.route(base + '/api/admin/**', api)
    page = context.new_page()

    def login():
        page.locator('#username').fill('synthetic-admin')
        page.locator('#password').fill('synthetic-browser-password')
        page.locator('#login-button').click()
        expect(page.locator('#login-form')).to_be_hidden()
        expect(page.locator('#password')).to_have_value('')
        assert page.evaluate("!JSON.stringify({...localStorage, ...sessionStorage}).includes('synthetic-browser-password')")

    page.goto(base + '/admin/')
    page.get_by_role('button', name='아이디 · 비밀번호', exact=True).click()
    page.locator('#username').fill("' OR 1=1 --")
    page.locator('#password').fill('wrong')
    page.locator('#login-button').click()
    expect(page.locator('#status')).to_contain_text('올바르지 않습니다')
    page.locator('#login-form').screenshot(path=str(artifacts / 'password-login-mobile.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    login()
    page.locator('#edit-profile').click()
    page.locator('#profile-form [name="introduction"]').fill('인증 만료 후에도 보존할 편집 내용')
    page.locator('#profile-form').get_by_role('button', name='적용', exact=True).click()
    state['authenticated'] = False
    page.locator('#publish').click()
    expect(page.locator('#login-form')).to_be_visible()
    login()
    page.locator('#publish').click()
    expect(page.locator('#status')).to_contain_text('저장했습니다')
    assert state['portfolio']['profile']['introduction'] == '인증 만료 후에도 보존할 편집 내용'
    assert state['writes'] == 1
    for key in portfolio:
        if key != 'profile':
            assert state['portfolio'][key] == portfolio[key]
    page.locator('#logout').click()
    expect(page.locator('#login-form')).to_be_visible()
    assert not state['authenticated']

    page.goto(base + '/admin/posts.html')
    page.get_by_role('button', name='아이디 · 비밀번호', exact=True).click()
    login()
    expect(page.locator('#workspace')).to_be_visible()
    page.locator('#new-category').fill('인증 검증 분류')
    page.locator('#add-category').click()
    state['authenticated'] = False
    page.locator('#save-categories').click()
    expect(page.locator('#login-form')).to_be_visible()
    login()
    page.locator('#save-categories').click()
    expect(page.locator('#status')).to_contain_text('저장')
    assert any(category['name'] == '인증 검증 분류' for category in state['index']['categories'])
    page.locator('#logout').click()
    expect(page.locator('#login-form')).to_be_visible()
    assert not state['authenticated']
    config = (root / 'js/portfolio-config.js').read_text(encoding='utf-8')
    config = config.replace("origin: 'https://personal-profile-admin-auth.leedidc1227.workers.dev'", "origin: '" + base + "'")
    context.route(base + '/js/portfolio-config.js', lambda route: route.fulfill(content_type='application/javascript', body=config))
    state['authenticated'] = True
    login_count = state['logins']
    for path in ['/admin/', '/admin/posts.html']:
        page.goto(base + path)
        expect(page.locator('#login-form')).to_be_hidden()
        page.reload()
        expect(page.locator('#login-form')).to_be_hidden()
    assert state['logins'] == login_count
    page.locator('#logout').click()
    expect(page.locator('#login-form')).to_be_visible()
    page.reload()
    expect(page.locator('#login-form')).to_be_visible()
    assert not github_requests, github_requests
    assert not errors, errors
    context.close()
    print('PASS: password login, error display, mobile form, session reauthentication with edit preservation, portfolio/posts saves and logout without browser GitHub credentials.')

    redirect_context = browser.new_context()
    config = (root / 'js/portfolio-config.js').read_text(encoding='utf-8')
    config = config.replace("publicOrigin: 'https://lee.chanhyeong.kro.kr'", "publicOrigin: '" + base + "'")
    redirect_context.route(base + '/js/portfolio-config.js', lambda route: route.fulfill(content_type='application/javascript', body=config))
    redirect_context.route(base + '/api/admin/**', lambda route: route.fulfill(status=404, body='no server'))
    admin_origin = 'https://personal-profile-admin-auth.leedidc1227.workers.dev'
    redirect_context.route(admin_origin + '/**', lambda route: route.fulfill(content_type='text/html', body='<title>관리자</title>'))
    redirect_page = redirect_context.new_page()
    for path in ['/admin/', '/admin/posts.html']:
        redirect_page.goto(base + path)
        expect(redirect_page.locator('#password-login-notice')).to_contain_text('전용 관리자 화면')
        redirect_page.get_by_role('button', name='아이디 · 비밀번호', exact=True).click()
        expect(redirect_page).to_have_url(admin_origin + path)
    redirect_context.close()
    print('PASS: public admin pages open the dedicated password login host without sending credentials across origins.')
