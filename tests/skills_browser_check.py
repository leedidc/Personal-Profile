import base64
import copy
import json
import re
from playwright.sync_api import expect


def check_skills(browser, base, root, artifacts):
    data = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    state = {'data': copy.deepcopy(data), 'sha': 'test-skills-sha', 'writes': 0}
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))

    def github(route):
        request = route.request
        if request.url.endswith('/repos/leedidc/Personal-Profile'):
            route.fulfill(json={'permissions': {'push': True}})
        elif '/contents/data/portfolio.json' in request.url:
            if request.method == 'GET':
                route.fulfill(json={'sha': state['sha'], 'encoding': 'base64', 'content': base64.b64encode(json.dumps(state['data'], ensure_ascii=False).encode()).decode()})
            else:
                assert request.method == 'PUT'
                body = request.post_data_json
                assert body['sha'] == state['sha']
                state['data'] = json.loads(base64.b64decode(body['content']))
                state['writes'] += 1
                state['sha'] = f"saved-skills-{state['writes']}"
                route.fulfill(json={'content': {'sha': state['sha']}})
        else:
            raise AssertionError(request.url)

    context.route('https://api.github.com/**', github)
    context.route(base.rstrip('/') + '/data/portfolio.json', lambda route: route.fulfill(json=state['data']))
    page = context.new_page()
    page.goto(base)
    expect(page.locator('#skills')).to_be_visible()
    displayed = []
    for category, label in [('office', 'OA'), ('languages', '언어'), ('engineering', '공학 도구')]:
        page.get_by_role('tab', name=re.compile('^' + label)).click()
        groups = page.locator('#skills .skill-groups button').all() if category == 'engineering' else [None]
        for button in groups:
            group = button.get_attribute('data-group') if button else ''
            if button:
                button.click()
            selected = [skill for skill in data['skills'] if skill['category'] == category and skill['group'] == group]
            expect(page.locator('#skills .skill-name')).to_have_text([skill['name'] for skill in selected])
            expect(page.locator('#skills .skill-level')).to_have_text([skill['level'] for skill in selected])
            displayed.extend(skill['id'] for skill in selected)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert sorted(displayed) == sorted(skill['id'] for skill in data['skills'])
    page.get_by_role('tab', name=re.compile('^OA')).focus()
    page.keyboard.press('ArrowRight')
    expect(page.get_by_role('tab', name=re.compile('^언어'))).to_have_attribute('aria-selected', 'true')
    page.get_by_role('tab', name=re.compile('^공학 도구')).click()
    page.get_by_role('button', name='보안 분석 · 진단', exact=True).click()
    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('#skills').screenshot(path=str(artifacts / f'skills-{width}.png'))

    admin = context.new_page()
    admin.set_viewport_size({'width': 320, 'height': 844})
    admin.goto(base + '/admin/')
    admin.locator('#token').fill('skills-test-token')
    admin.locator('#login-button').click()
    expect(admin.locator('#editor-panel')).to_be_visible()
    admin.get_by_role('button', name='SKILL', exact=True).click()
    admin.get_by_role('button', name='SKILL 추가', exact=True).click()
    admin.locator('#skill-name').fill('검증용 도구')
    admin.locator('#skill-category').select_option('engineering')
    admin.locator('#skill-group').select_option('security-analysis')
    admin.locator('#skill-level').select_option('하')
    admin.locator('#skill-description').fill('<img src=x onerror=alert(1)>')
    assert admin.locator('#skill-dialog').evaluate('(el) => el.scrollWidth <= el.clientWidth')
    admin.locator('#skill-form').get_by_role('button', name='적용', exact=True).click()
    admin.get_by_role('button', name='검증용 도구 수정', exact=True).click()
    admin.locator('#skill-level').select_option('중')
    admin.locator('#skill-form').get_by_role('button', name='적용', exact=True).click()
    admin.get_by_role('combobox', name='검증용 도구 표시 순서', exact=True).select_option('0')
    admin.locator('#preview').click()
    preview = admin.locator('#preview-skills')
    preview.get_by_role('tab', name=re.compile('^공학 도구')).click()
    preview.get_by_role('button', name='보안 분석 · 진단', exact=True).click()
    expect(preview.locator('.skill-name').first).to_have_text('검증용 도구')
    expect(preview.locator('.skill-level').first).to_have_text('중')
    expect(preview.locator('img')).to_have_count(0)
    expect(preview.locator('.skill-description').first).to_have_text('<img src=x onerror=alert(1)>')
    admin.locator('#preview-dialog').get_by_role('button', name='닫기', exact=True).click()
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    assert state['data']['skills'][0]['name'] == '검증용 도구'
    for key in data:
        if key != 'skills':
            assert state['data'][key] == data[key]
    admin.on('dialog', lambda dialog: dialog.accept())
    admin.get_by_role('button', name='검증용 도구 삭제', exact=True).click()
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    assert state['data'] == data
    assert state['writes'] == 2
    assert not errors, errors
    context.close()
    print('PASS: skill categories, proficiency, ordering, keyboard, mobile, admin CRUD, preview, SHA save and existing data preservation.')
