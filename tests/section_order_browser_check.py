import base64
import copy
import json
from playwright.sync_api import expect


def check_section_order(browser, base, root, artifacts):
    original = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    state = {'data': copy.deepcopy(original), 'sha': 'section-order-sha', 'writes': 0, 'conflict': False}
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
            state['sha'] = 'section-order-saved'
            route.fulfill(json={'content': {'sha': state['sha']}})
        else:
            raise AssertionError(request.url)

    context.route('https://api.github.com/**', github)
    context.route(base + '/data/portfolio.json', lambda route: route.fulfill(json=state['data']))

    def assert_order(page, expected, prefix=''):
        sections = page.locator('#preview-content .resume-section' if prefix else '#portfolio .resume-section')
        expect(sections).to_have_count(len(expected))
        assert sections.evaluate_all('(items) => items.map(item => item.id)') == [prefix + key for key in expected]
        expect(sections.locator('.section-index')).to_have_text([str(index + 1).zfill(2) for index in range(len(expected))])
        if not prefix:
            links = page.locator('.portfolio-header nav a[href^="#"]:visible')
            assert links.evaluate_all('(items) => items.map(item => item.hash.slice(1))') == expected
            expect(page.locator('.portfolio-header nav a[href="posts/"]')).to_have_text('글')
            expect(page.locator('.portfolio-header nav a[href="resources/"]')).to_have_text('자료실')

    page = context.new_page()
    page.goto(base)
    assert_order(page, original['sectionOrder'])
    page.locator('.portfolio-header nav a[href="#training"]').click()
    expect(page.locator('.portfolio-header nav a[aria-current]')).to_have_attribute('href', '#training')

    admin = context.new_page()
    admin.goto(base + '/admin/')
    admin.locator('#token').fill('synthetic-section-order-token')
    admin.locator('#login-button').click()
    expect(admin.locator('#editor-panel')).to_be_visible()
    tab = admin.locator('#editor-tabs button').nth(1)
    tab.focus()
    admin.keyboard.press('Enter')
    expect(tab).to_be_focused()
    expect(tab).to_have_attribute('aria-pressed', 'true')
    admin.get_by_role('button', name='섹션 순서', exact=True).click()
    dialog = admin.locator('#section-order-dialog')
    admin.get_by_label('교육 이수현황 섹션 순서', exact=True).select_option('0')
    dialog.get_by_role('button', name='취소', exact=True).click()
    expect(admin.locator('#publish')).to_be_disabled()
    admin.get_by_role('button', name='섹션 순서', exact=True).click()
    assert dialog.locator('.section-order-row').evaluate_all('(rows) => rows.map(row => row.dataset.section)') == original['sectionOrder']

    expected = list(original['sectionOrder'])
    expected.remove('training')
    expected.insert(0, 'training')
    admin.get_by_label('교육 이수현황 섹션 순서', exact=True).select_option('0')
    expect(dialog.get_by_role('button', name='교육 이수현황 섹션 위로 이동')).to_be_disabled()
    admin.get_by_role('button', name='수상 섹션 위로 이동', exact=True).click()
    index = expected.index('awards')
    expected[index - 1], expected[index] = expected[index], expected[index - 1]
    for width in [1440, 390, 320]:
        admin.set_viewport_size({'width': width, 'height': 844})
        assert dialog.evaluate('(el) => el.scrollWidth <= el.clientWidth')
        dialog.screenshot(path=str(artifacts / f'section-order-admin-{width}.png'))
    dialog.get_by_role('button', name='적용', exact=True).click()
    assert admin.locator('#editor-tabs button').evaluate_all('(items) => items.map(item => item.dataset.section)') == expected
    expect(admin.locator('#unsaved')).to_be_visible()
    admin.locator('#preview').click()
    assert_order(admin, expected, 'preview-')
    expect(admin.locator('#preview-training .row-name')).to_have_text([item['subtitle'] for item in original['training']])
    admin.locator('#preview-dialog').get_by_role('button', name='닫기', exact=True).click()

    state['conflict'] = True
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('다른 곳에서 내용이 변경되었습니다')
    assert state['writes'] == 0
    expect(admin.locator('#publish')).to_be_enabled()
    state['conflict'] = False
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    assert state['writes'] == 1
    saved = copy.deepcopy(state['data'])
    assert saved.pop('sectionOrder') == expected
    unchanged = copy.deepcopy(original)
    unchanged.pop('sectionOrder')
    assert saved == unchanged, 'Reordering sections changed content or item order'

    admin.reload()
    admin.locator('#token').fill('synthetic-section-order-token')
    admin.locator('#login-button').click()
    expect(admin.locator('#editor-panel')).to_be_visible()
    assert admin.locator('#editor-tabs button').evaluate_all('(items) => items.map(item => item.dataset.section)') == expected
    expect(admin.locator('#editor-tabs button[aria-pressed="true"]')).to_have_attribute('data-section', expected[0])
    page.reload()
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 844})
        page.goto(base + '/#' + expected[-1])
        assert_order(page, expected)
        expect(page.locator('.portfolio-header nav a[aria-current]')).to_have_attribute('href', '#' + expected[-1])
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('.portfolio-header nav a[href="#training"]').click()
        expect(page.locator('.portfolio-header nav a[aria-current]')).to_have_attribute('href', '#training')
        page.wait_for_function("""() => {
            const current = document.querySelector('nav a[aria-current]').getBoundingClientRect();
            const marker = document.querySelector('.nav-indicator').getBoundingClientRect();
            return Math.abs(current.left - marker.left) < 1 && Math.abs(current.width - marker.width) < 1;
        }""")

    state['data']['training'] = []
    state['data']['skills'] = []
    page.goto(base)
    assert_order(page, [key for key in expected if key not in ['training', 'skills']])
    expect(page.locator('nav a[href="#training"]')).to_be_hidden()
    expect(page.locator('nav a[href="#skills"]')).to_be_hidden()
    assert not errors, errors
    context.close()
    print('PASS: section order editing/cancel, preview, SHA conflict/save, reload, menu/number synchronization, deep links, mobile and optional sections; content and item order preserved.')
