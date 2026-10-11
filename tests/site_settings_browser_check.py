import base64
import copy
import json
from playwright.sync_api import expect


def check_site_settings(browser, base, root, artifacts):
    original = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    state = {'data': copy.deepcopy(original), 'sha': 'settings-sha', 'writes': 0, 'conflict': False}
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    errors = []
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))

    def github(route):
        request = route.request
        if request.url.endswith('/repos/leedidc/Personal-Profile'):
            route.fulfill(json={'permissions': {'push': True}})
        elif '/contents/data/portfolio.json' in request.url and request.method == 'GET':
            route.fulfill(json={'sha': state['sha'], 'encoding': 'base64', 'content': base64.b64encode(json.dumps(state['data']).encode()).decode()})
        elif '/contents/data/portfolio.json' in request.url and request.method == 'PUT':
            if state['conflict']:
                route.fulfill(status=409, json={'message': 'Synthetic conflict'})
                return
            body = request.post_data_json
            assert body['sha'] == state['sha']
            state['data'] = json.loads(base64.b64decode(body['content']))
            state['writes'] += 1
            state['sha'] = f"settings-{state['writes']}"
            route.fulfill(json={'content': {'sha': state['sha']}})
        else:
            raise AssertionError(request.url)

    context.route('https://api.github.com/**', github)
    context.route(base + '/data/portfolio.json', lambda route: route.fulfill(json=state['data']))
    context.route('https://personal-profile-admin-auth.leedidc1227.workers.dev/api/**', lambda route: route.fulfill(status=503, json={}))
    admin = context.new_page()
    admin.on('dialog', lambda dialog: dialog.accept())

    def login():
        admin.goto(base + '/admin/')
        admin.locator('#token').fill('synthetic-settings-token')
        admin.locator('#login-button').click()
        expect(admin.locator('#editor-panel')).to_be_visible()

    def save():
        admin.locator('#publish').click()
        expect(admin.locator('#status')).to_contain_text('저장했습니다')

    login()
    dialog = admin.locator('#section-order-dialog')
    admin.locator('#edit-section-order').click()
    admin.locator('#new-section-title').fill('취소할 섹션')
    admin.locator('#add-section').click()
    dialog.get_by_role('button', name='취소', exact=True).click()
    expect(admin.locator('#publish')).to_be_disabled()
    admin.locator('#edit-section-order').click()
    expect(dialog.locator('.section-order-row')).to_have_count(len(original['sectionOrder']))
    admin.locator('#new-section-title').fill('학습 일지')
    admin.locator('#add-section').click()
    new_row = dialog.locator('#section-order-list .section-order-row').last
    key = new_row.get_attribute('data-section')
    new_row.locator('select').select_option('0')
    admin.get_by_label('경력 공개', exact=True).uncheck()
    admin.get_by_role('button', name='학력 섹션 삭제', exact=True).click()
    expect(dialog.locator('#removed-section-list')).to_contain_text('학력')
    for width in [1440, 390, 320]:
        admin.set_viewport_size({'width': width, 'height': 900})
        assert dialog.evaluate('(node) => node.scrollWidth <= node.clientWidth')
        dialog.screenshot(path=str(artifacts / f'section-manager-{width}.png'))
    dialog.get_by_role('button', name='적용', exact=True).click()
    expect(admin.locator('#editor-tabs button[data-section="education"]')).to_have_count(0)
    admin.locator(f'#editor-tabs button[data-section="{key}"]').click()
    admin.locator('#add-item').click()
    admin.locator('#item-name').fill('가상 학습 기록 <img onerror=alert(1)>')
    admin.locator('#summary').fill('가상 기록의 요약')
    admin.locator('#details').fill('첫 번째 설명\n두 번째 설명')
    admin.locator('#apply-item').click()
    expect(admin.locator('#editor-list')).to_contain_text('가상 학습 기록')
    admin.locator('#preview').click()
    expect(admin.locator(f'#preview-{key}')).to_be_visible()
    expect(admin.locator('#preview-education, #preview-experience')).to_have_count(0)
    expect(admin.locator(f'#preview-{key} .row-name img')).to_have_count(0)
    admin.locator('#preview-dialog').get_by_role('button', name='닫기', exact=True).click()
    state['conflict'] = True
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('다른 곳에서 내용이 변경되었습니다')
    assert state['writes'] == 0
    state['conflict'] = False
    save()
    for section in original['sectionOrder']:
        assert state['data'][section] == original[section]
    assert state['data']['profile'] == original['profile']

    page = context.new_page()
    page.goto(base)
    expect(page.locator('#portfolio .resume-section').first).to_have_attribute('id', key)
    expect(page.locator('#education, #experience')).to_have_count(0)
    expect(page.locator('.portfolio-header nav a[href="#education"]')).to_have_count(0)
    # The chatbot context must omit sections that the administrator hid.
    chat_requests = []
    def chat_reply(route):
        chat_requests.append(route.request.post_data_json)
        route.fulfill(headers={'Access-Control-Allow-Origin': '*'}, json={'reply': '가상 응답'})
    page.route('https://chatbot.leedidc1227.workers.dev/**', chat_reply)
    page.evaluate('''async () => PortfolioChatService.ask({portfolio: await SiteFeatures.loadPortfolio(), question: '공개 이력'})''')
    hidden_context = json.loads(chat_requests[0]['message'].split('최신 공개 포트폴리오: ')[1].split('\n\n')[0])
    assert 'education' not in hidden_context and 'experience' not in hidden_context

    admin.locator('#edit-site-features').click()
    feature_dialog = admin.locator('#site-feature-dialog')
    for toggle in feature_dialog.locator('input[type=checkbox]').all():
        toggle.uncheck()
    feature_dialog.get_by_role('button', name='취소', exact=True).click()
    expect(admin.locator('#publish')).to_be_disabled()
    admin.locator('#edit-site-features').click()
    for toggle in feature_dialog.locator('input[type=checkbox]').all():
        expect(toggle).to_be_checked()
        toggle.uncheck()
    feature_dialog.screenshot(path=str(artifacts / 'site-feature-settings.png'))
    feature_dialog.get_by_role('button', name='적용', exact=True).click()
    save()
    requests = []
    page.on('request', lambda request: requests.append(request.url))
    page.emulate_media(reduced_motion='no-preference')
    page.reload()
    expect(page.locator('#profile h1')).to_be_visible()
    expect(page.locator('#site-intro')).to_have_count(0)
    for selector in ['#ai-chat-launcher', '#terminal-launcher', '#visitor-info', '#security-connection', '#site-insights']:
        expect(page.locator(selector)).to_be_hidden()
    expect(page.locator('.network-visual')).to_have_count(0)
    assert not any('/api/visitor' in url for url in requests), requests
    expect(page.locator('.portfolio-header nav a[href="posts/"]')).to_be_hidden()
    expect(page.locator('.portfolio-header nav a[href="resources/"]')).to_be_hidden()
    for route in ['/posts/', '/posts/view.html?id=ssl-tls-visibility-principles', '/resources/']:
        requests.clear()
        page.goto(base + route)
        expect(page.locator('.inactive-page')).to_contain_text('현재 운영하지 않는 페이지')
        assert not any('/api/visitor' in url or '/data/posts/' in url or url.endswith('/data/resources.json') for url in requests)

    # Re-enable pages while keeping the graph off; the original list remains usable.
    admin.locator('#edit-site-features').click()
    feature_dialog.locator('input[name=posts]').check()
    feature_dialog.locator('input[name=resources]').check()
    feature_dialog.get_by_role('button', name='적용', exact=True).click()
    save()
    page.goto(base + '/posts/')
    expect(page.locator('#posts-table-wrap')).to_be_visible()
    expect(page.locator('#posts-view-switch')).to_be_hidden()
    expect(page.locator('#study-map')).to_be_hidden()
    page.goto(base + '/resources/')
    expect(page.locator('.resource-card').first).to_be_visible()

    login()
    admin.locator('#edit-section-order').click()
    admin.get_by_role('button', name='학력 섹션 복원', exact=True).click()
    admin.get_by_label('경력 공개', exact=True).check()
    admin.get_by_label('학습 일지 섹션 이름', exact=True).fill('발표 · 기고')
    dialog.get_by_role('button', name='적용', exact=True).click()
    save()
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(base + '/#' + key)
        expect(page.locator('#education')).to_be_visible()
        expect(page.locator('#experience')).to_be_visible()
        expect(page.locator(f'#{key} h2')).to_contain_text('발표 · 기고')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        indices = page.locator('#portfolio .section-index').all_text_contents()
        assert indices == [str(i + 1).zfill(2) for i in range(len(indices))]
    assert not errors, errors
    context.close()
    print('PASS: custom sections, hide/remove/restore, ordering, safe text, preview, SHA save/conflict, feature toggles, disabled pages/requests and mobile.')
