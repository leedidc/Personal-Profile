import copy
import re
from playwright.sync_api import expect


def check_skill_categories(admin, page, state, original, artifacts):
    original_writes = state['writes']
    manage = admin.locator('#manage-skill-categories')
    dialog = admin.locator('#skill-categories-dialog')
    cards = dialog.locator('.skill-category-card')

    # Closing a classification draft must not change either skills or saved settings.
    manage.click()
    cards.first.locator('.category-name input').fill('취소할 이름')
    dialog.get_by_role('button', name='취소', exact=True).click()
    manage.click()
    expect(cards.first.locator('.category-name input')).to_have_value(original['skillCategories'][0]['label'])
    cards.first.get_by_role('button', name='분류 1 삭제', exact=True).click()
    expect(dialog.locator('[role=alert]')).to_contain_text('사용 중')
    expect(cards).to_have_count(len(original['skillCategories']))

    office = dialog.locator('[data-category="office"]')
    office.locator('.category-name input').fill('업무 도구')
    office.get_by_role('button', name='분류 1 세부 분류 추가', exact=True).click()
    office.locator('.group-name input').fill('문서 작업')

    engineering = dialog.locator('[data-category="engineering"]')
    analysis = engineering.locator('[data-group="security-analysis"]')
    analysis.locator('input').fill('분석 <img src=x onerror=alert(1)>')
    analysis.get_by_role('button', name='분류 3의 세부 분류 2 삭제', exact=True).click()
    expect(dialog.locator('[role=alert]')).to_contain_text('사용 중')
    analysis.get_by_role('button', name='분류 3의 세부 분류 2 위로 이동', exact=True).click()
    engineering.get_by_role('button', name='분류 3 위로 이동', exact=True).click()
    engineering.get_by_role('button', name='분류 2 위로 이동', exact=True).click()
    expect(cards.first).to_have_attribute('data-category', 'engineering')
    expect(engineering.locator('[data-group]').first).to_have_attribute('data-group', 'security-analysis')

    dialog.locator('#add-skill-category').click()
    custom = cards.last
    custom_id = custom.get_attribute('data-category')
    custom_name = '검증용-' + 'LongCategory' * 4
    custom.locator('.category-name input').fill(custom_name)
    custom.get_by_role('button', name='분류 4 세부 분류 추가', exact=True).click()
    custom.locator('.group-name input').fill('새 세부 분류')
    group_id = custom.locator('[data-group]').get_attribute('data-group')
    assert dialog.evaluate('(el) => el.scrollWidth <= el.clientWidth')
    dialog.screenshot(path=str(artifacts / 'skill-categories-admin-mobile.png'))
    dialog.get_by_role('button', name='적용', exact=True).click()
    expect(dialog).not_to_be_visible()
    assert state['writes'] == original_writes
    assert state['data'] == original

    # A new category, including subcategories outside engineering, can be assigned to skills.
    admin.get_by_role('button', name='SKILL 추가', exact=True).click()
    admin.locator('#skill-name').fill('분류 검증용 도구')
    admin.locator('#skill-category').select_option(custom_id)
    admin.locator('#skill-group').select_option(group_id)
    admin.locator('#skill-level').select_option('상')
    admin.locator('#skill-description').fill('분류 편집 검증')
    admin.locator('#skill-form').get_by_role('button', name='적용', exact=True).click()
    admin.locator('#preview').click()
    preview = admin.locator('#preview-skills')
    expect(preview.get_by_role('tab').first).to_contain_text('공학 도구')
    expect(preview.locator('.skill-groups button').first).to_have_text('분석 <img src=x onerror=alert(1)>')
    expect(preview.locator('img')).to_have_count(0)
    preview.get_by_role('tab', name=re.compile('^업무 도구')).click()
    preview.get_by_role('button', name='미분류', exact=True).click()
    expect(preview.locator('.skill-name')).to_have_text([skill['name'] for skill in original['skills'] if skill['category'] == 'office'])
    preview.get_by_role('tab', name=re.compile('^검증용-')).click()
    expect(preview.locator('.skill-name')).to_have_text(['분류 검증용 도구'])
    expect(preview.locator('.skill-level')).to_have_text(['상'])
    expect(preview.locator('.skills-note')).to_have_count(0)
    assert admin.locator('#preview-dialog').evaluate('(el) => el.scrollWidth <= el.clientWidth')
    admin.locator('#preview-dialog').get_by_role('button', name='닫기', exact=True).click()
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    expected = copy.deepcopy(state['data'])
    assert expected['skillCategories'][0]['value'] == 'engineering'
    assert expected['skills'][:-1] == original['skills']
    for key in original:
        if key not in ['skills', 'skillCategories']:
            assert expected[key] == original[key]

    admin.reload()
    admin.locator('#token').fill('skills-test-token')
    admin.locator('#login-button').click()
    expect(admin.locator('#editor-panel')).to_be_visible()
    admin.get_by_role('button', name='SKILL', exact=True).click()
    manage.click()
    expect(cards.first).to_have_attribute('data-category', 'engineering')
    expect(dialog.locator('[data-category="office"] .category-name input')).to_have_value('업무 도구')
    dialog.get_by_role('button', name='취소', exact=True).click()
    for width in [320, 390, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.reload()
        page.locator('#skills').get_by_role('tab', name=re.compile('^검증용-')).click()
        expect(page.locator('#skills .skill-name')).to_have_text(['분류 검증용 도구'])
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('#skills').screenshot(path=str(artifacts / 'skill-categories-public.png'))

    # Move the tool first; deleting its now-unused category never deletes the tool itself.
    admin.get_by_role('button', name='분류 검증용 도구 수정', exact=True).click()
    admin.locator('#skill-category').select_option('languages')
    expect(admin.locator('#skill-group-field')).to_be_hidden()
    admin.locator('#skill-form').get_by_role('button', name='적용', exact=True).click()
    manage.click()
    custom = dialog.locator('[data-category="' + custom_id + '"]')
    custom.get_by_role('button', name='분류 4의 세부 분류 1 삭제', exact=True).click()
    expect(custom.locator('[data-group]')).to_have_count(0)
    custom.get_by_role('button', name='분류 4 삭제', exact=True).click()
    expect(custom).to_have_count(0)
    dialog.get_by_role('button', name='적용', exact=True).click()
    admin.locator('#publish').click()
    expect(admin.locator('#status')).to_contain_text('저장했습니다')
    assert state['data']['skills'][-1]['category'] == 'languages'
    assert state['data']['skills'][-1]['group'] == ''
    assert len(state['data']['skills']) == len(original['skills']) + 1
    assert all(category['value'] != custom_id for category in state['data']['skillCategories'])
    print('PASS: editable skill categories/subcategories, safe rename/reorder/delete, cancellation, reassignment, preview, reload and responsive rendering.')
