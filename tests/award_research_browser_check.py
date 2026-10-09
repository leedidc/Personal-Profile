"""Award research navigation and editor checks, using the existing mocked save flow."""
import copy
from playwright.sync_api import expect


def check_research_reader(page, original, artifacts):
    for index, award in enumerate(original['awards']):
        button = page.locator('#awards tbody tr').nth(index).locator('.research-open')
        research = award.get('research')
        if not research:
            expect(button).to_have_count(0)
            continue
        button.click()
        dialog = page.locator('.research-dialog')
        expect(dialog).to_be_visible()
        expect(dialog.locator('#research-title')).to_have_text(research['title'])
        expect(dialog.get_by_role('button', name='이전 슬라이드', exact=True)).to_be_disabled()
        for slide_index, slide in enumerate(research['slides']):
            expect(dialog.locator('#research-slide-title')).to_have_text(slide['title'])
            expect(dialog.locator('.research-slide-body')).to_have_text(slide['body'])
            expect(dialog.locator('.research-progress')).to_have_text(f"{slide_index + 1} / {len(research['slides'])}")
            if slide_index < len(research['slides']) - 1:
                dialog.get_by_role('button', name='다음 슬라이드', exact=True).click()
        expect(dialog.get_by_role('button', name='다음 슬라이드', exact=True)).to_be_disabled()
        page.keyboard.press('ArrowRight')
        expect(dialog.locator('#research-slide-title')).to_have_text(research['slides'][-1]['title'])
        if len(research['slides']) > 1:
            page.keyboard.press('ArrowLeft')
            expect(dialog.locator('#research-slide-title')).to_have_text(research['slides'][-2]['title'])
        page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(button).to_be_focused()

    research_award = next((award for award in original['awards'] if award.get('research')), None)
    if not research_award:
        return
    button = page.get_by_role('button', name=research_award['name'] + ' 연구 내용 보기', exact=True)
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1000 if width == 1440 else 844})
        button.click()
        dialog = page.locator('.research-dialog')
        expect(dialog.locator('.research-progress')).to_have_text(f"1 / {len(research_award['research']['slides'])}")
        assert dialog.evaluate('(element) => element.scrollWidth <= element.clientWidth')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        if width != 320:
            page.screenshot(path=str(artifacts / f'award-research-{width}.png'))
        stage = dialog.locator('.research-slide')
        stage.dispatch_event('pointerdown', {'pointerType': 'touch', 'clientX': 250, 'clientY': 200})
        stage.dispatch_event('pointerup', {'pointerType': 'touch', 'clientX': 100, 'clientY': 205})
        next_index = min(1, len(research_award['research']['slides']) - 1)
        expect(dialog.locator('#research-slide-title')).to_have_text(research_award['research']['slides'][next_index]['title'])
        dialog.get_by_role('button', name='연구 내용 닫기', exact=True).click()
    page.set_viewport_size({'width': 1440, 'height': 1000})


def edit_research_slides(admin, research):
    if not research:
        research = {'title': '가상 연구', 'slides': [{'title': '연구 주제', 'body': '검증용 내용'}]}
        admin.locator('#add-research-slide').click()
    expected = copy.deepcopy(research)
    expected['title'] = '검증용 연구 <img src=x onerror=alert(1)>'
    expected['link'] = 'https://example.test/paper.pdf'
    expected['slides'][0] = {'title': '검증용 연구 배경', 'body': '<script>alert(1)</script>\n안전한 연구 설명'}
    admin.locator('#research-editor-title').fill(expected['title'])
    admin.locator('#research-slide-0-title').fill(expected['slides'][0]['title'])
    admin.locator('#research-slide-0-body').fill(expected['slides'][0]['body'])
    admin.locator('#research-editor-link').fill('http://example.test/unsafe')
    admin.locator('#apply-item').click()
    expect(admin.locator('#item-error')).to_contain_text('https://')
    expect(admin.locator('#item-dialog')).to_be_visible()
    admin.locator('#research-editor-link').fill(expected['link'])
    count = len(expected['slides'])
    admin.locator('#add-research-slide').click()
    admin.locator('#apply-item').click()
    expect(admin.locator('#item-dialog')).to_be_visible()
    new_slide = {'title': '검증용 제안', 'body': '추가한 슬라이드의 내용'}
    admin.locator(f'#research-slide-{count}-title').fill(new_slide['title'])
    admin.locator(f'#research-slide-{count}-body').fill(new_slide['body'])
    admin.get_by_role('button', name=f'{count + 1}번 슬라이드 위로', exact=True).click()
    expected['slides'].insert(count - 1, new_slide)
    admin.get_by_role('button', name=f'{count + 1}번 슬라이드 삭제', exact=True).click()
    expected['slides'].pop()
    expect(admin.locator('.research-slide-editor input')).to_have_count(count)
    for index, slide in enumerate(expected['slides']):
        expect(admin.locator(f'#research-slide-{index}-title')).to_have_value(slide['title'])
    admin.set_viewport_size({'width': 320, 'height': 844})
    assert admin.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert admin.locator('#item-dialog').evaluate('(element) => element.scrollWidth <= element.clientWidth')
    admin.set_viewport_size({'width': 1440, 'height': 1000})
    return expected


def check_research_preview(admin, expected):
    button = admin.locator('#preview-awards .research-open').first
    button.click()
    dialog = admin.locator('.research-dialog')
    expect(dialog.locator('#research-title')).to_have_text(expected['title'])
    expect(dialog.locator('.research-slide-body')).to_have_text(expected['slides'][0]['body'])
    expect(dialog.locator('.research-source')).to_have_attribute('href', expected['link'])
    expect(dialog.locator('script, img')).to_have_count(0)
    admin.keyboard.press('ArrowRight')
    expect(dialog.locator('#research-slide-title')).to_have_text(expected['slides'][min(1, len(expected['slides']) - 1)]['title'])
    admin.keyboard.press('Escape')
    expect(dialog).to_have_count(0)
    expect(admin.locator('#preview-dialog')).to_be_visible()
    expect(button).to_be_focused()
