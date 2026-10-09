import base64
import copy
import json
from playwright.sync_api import expect


def check_training(browser, base, root, artifacts):
    original = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    state = {'data': copy.deepcopy(original), 'sha': 'training-sha', 'writes': 0}
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    errors = []
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))

    def github(route):
        request = route.request
        if request.url.endswith('/repos/leedidc/Personal-Profile'):
            route.fulfill(json={'permissions': {'push': True}})
        elif '/contents/data/portfolio.json' in request.url and request.method == 'GET':
            encoded = base64.b64encode(json.dumps(state['data'], ensure_ascii=False).encode()).decode()
            route.fulfill(json={'sha': state['sha'], 'encoding': 'base64', 'content': encoded})
        elif '/contents/data/portfolio.json' in request.url and request.method == 'PUT':
            body = request.post_data_json
            assert body['sha'] == state['sha']
            state['data'] = json.loads(base64.b64decode(body['content']))
            state['writes'] += 1
            state['sha'] = 'training-saved-' + str(state['writes'])
            route.fulfill(json={'content': {'sha': state['sha']}})
        else:
            raise AssertionError(request.url)

    context.route('https://api.github.com/**', github)
    context.route(base + '/data/portfolio.json', lambda route: route.fulfill(json=state['data']))
    page = context.new_page()
    page.goto(base)
    expect(page.locator('#training .section-heading')).to_contain_text('교육 이수현황')
    for index, item in enumerate(original['training']):
        row = page.locator('#training tbody tr').nth(index)
        for field, selector in [('subtitle', '.row-name'), ('name', '.row-subtitle'), ('period', '.period'), ('summary', '.row-summary')]:
            expect(row.locator(selector)).to_have_text(item[field])
        expect(row.locator('.training-details li')).to_have_text(item['details'])
        for line in row.locator('.training-details li').all():
            expect(line).to_be_visible()
        expect(row.locator('details')).to_have_count(0)
    expect(page.locator('#activities .row-name')).to_have_text([item['name'] for item in original['activities']])
    for index, item in enumerate(original['activities']):
        row = page.locator('#activities tbody tr').nth(index)
        expect(row.locator('.period')).to_have_text(item['period'])
        if item['details']:
            row.locator('summary').click()
            expect(row.locator('li')).to_have_text(item['details'])
    for width in [320, 390, 768, 950, 960, 1024, 1200, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Overflow at {width}'
        for selector in ['#training', '#activities']:
            assert page.locator(selector).evaluate('(el) => el.scrollWidth <= el.clientWidth'), selector
        if width in [390, 1440]:
            page.locator('#training').screenshot(path=str(artifacts / f'training-{width}.png'))
            page.locator('#activities').screenshot(path=str(artifacts / f'activities-{width}.png'))

    admin = context.new_page()
    admin.set_viewport_size({'width': 390, 'height': 844})
    admin.goto(base + '/admin/')
    admin.locator('#token').fill('synthetic-training-token')
    admin.locator('#login-button').click()
    expect(admin.locator('#editor-panel')).to_be_visible()
    admin.get_by_role('button', name='교육 이수현황', exact=True).click()
    admin.get_by_role('button', name='교육 이수현황 추가', exact=True).click()
    expect(admin.locator('#details-label')).to_have_text('교육내용')
    expect(admin.locator('#education-courses')).to_be_hidden()
    expect(admin.locator('#summary-english-field')).to_be_hidden()
    admin.locator('#item-name').fill('검증 교육기관')
    admin.locator('#subtitle').fill('<img src=x onerror=alert(1)>')
    admin.locator('#period').fill('2026.10.01')
    admin.locator('#item-status').fill('이수')
    admin.locator('#summary').fill('8시간')
    admin.locator('#details').fill('검증용 교육내용')
    admin.locator('#apply-item').click()
    admin.get_by_role('button', name='검증 교육기관 수정', exact=True).click()
    admin.locator('#summary').fill('12시간')
    admin.locator('#apply-item').click()
    admin.get_by_label('검증 교육기관 표시 순서', exact=True).select_option('0')
    admin.locator('#preview').click()
    preview = admin.locator('#preview-training tbody tr').first
    expect(preview.locator('.row-summary')).to_have_text('12시간')
    expect(preview.locator('.row-name')).to_have_text('<img src=x onerror=alert(1)>')
    expect(preview.locator('.row-subtitle')).to_have_text('검증 교육기관')
    expect(preview.locator('img[src="x"]')).to_have_count(0)
    assert admin.locator('#preview-dialog').evaluate('(el) => el.scrollWidth <= el.clientWidth')
    admin.locator('#preview-dialog').get_by_role('button', name='닫기', exact=True).click()
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    assert state['writes'] == 1
    assert state['data']['training'][0]['summary'] == '12시간'
    assert state['data']['training'][1:] == original['training']
    for key in original:
        if key != 'training':
            assert state['data'][key] == original[key], key
    page.goto(base)
    expect(page.locator('#training .row-name').first).to_have_text('<img src=x onerror=alert(1)>')
    expect(page.locator('#training .row-subtitle').first).to_have_text('검증 교육기관')
    admin.on('dialog', lambda dialog: dialog.accept())
    admin.get_by_role('button', name='검증 교육기관 삭제', exact=True).click()
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    assert state['data'] == original
    assert not errors, errors
    context.close()
    print('PASS: training content, expanded activities, responsive layout, admin add/edit/reorder/delete, preview and SHA save with all other content preserved.')
