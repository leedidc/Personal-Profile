import copy
import json

from playwright.sync_api import expect


def check_resource_library(browser, base, root, artifacts):
    original = json.loads((root / 'data/resources.json').read_text(encoding='utf-8'))
    resources = original['resources']
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/resources/')
    cards = page.locator('.resource-card')
    search = page.get_by_label('자료 검색')
    expect(cards).to_have_count(len(resources))
    expect(cards.locator('h3')).to_have_text([item['title'] for item in resources])
    expect(page.locator('#resources-checked')).to_contain_text(original['checkedOn'].replace('-', '.'))
    expect(page.locator('nav a[aria-current]')).to_have_text('자료실')
    for index, item in enumerate(resources):
        card = cards.nth(index)
        source = card.locator('.resource-source a')
        expect(source).to_have_attribute('href', item['sourceUrl'])
        expect(source).to_contain_text(item['sourceName'])
        expect(source).to_have_attribute('target', '_blank')
        expect(source).to_have_attribute('rel', 'noopener noreferrer')
        expect(card.locator('.resource-edition')).to_have_text(item['edition'])
        expect(card.locator('time')).to_have_attribute('datetime', item['publishedOn'])

    # 원문 이동은 새 탭으로 열리고 현재 자료실은 유지됩니다.
    context.route(resources[0]['sourceUrl'], lambda route: route.fulfill(body='Official source test page', content_type='text/plain'))
    link = cards.first.locator('.resource-source a')
    link.focus()
    with page.expect_popup() as popup:
        page.keyboard.press('Enter')
    popup.value.wait_for_load_state()
    assert popup.value.url == resources[0]['sourceUrl']
    assert popup.value.evaluate('window.opener === null')
    popup.value.close()
    expect(page).to_have_url(base + '/resources/')

    for category in original['categories']:
        button = page.locator(f'button[data-category="{category["id"]}"]')
        button.focus()
        page.keyboard.press('Enter')
        expect(button).to_have_attribute('aria-pressed', 'true')
        expected = [item['title'] for item in resources if item['categoryId'] == category['id']]
        expect(cards.locator('h3')).to_have_text(expected)
    page.locator('button[data-category="all"]').click()
    search.fill('pia')
    expect(cards).to_have_count(1)
    expect(cards.first).to_contain_text('개인정보 영향평가 수행안내서')
    search.fill('KISA 인증기준')
    expect(cards).to_have_count(1)
    search.press('Enter')
    expect(search).to_have_value('KISA 인증기준')
    search.fill('존재하지않는자료 <img src=x onerror=alert(1)>')
    expect(cards).to_have_count(0)
    expect(page.locator('#resources-empty')).to_be_visible()
    expect(page.locator('#resource-list img')).to_have_count(0)
    page.get_by_role('button', name='전체 자료 보기').click()
    expect(search).to_be_focused()
    expect(search).to_have_value('')
    expect(cards).to_have_count(len(resources))

    # 분류와 검색이 함께 적용되고 검색어를 지워도 선택 분류는 유지됩니다.
    page.locator('button[data-category="security"]').click()
    search.fill('PIA')
    expect(cards).to_have_count(0)
    search.fill('')
    expect(cards).to_have_count(sum(item['categoryId'] == 'security' for item in resources))
    page.locator('button[data-category="all"]').click()
    for width in [1440, 1024, 800, 768, 680, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert cards.evaluate_all('(items) => items.every(el => el.scrollWidth <= el.clientWidth)')
        if width in [1440, 390, 320]:
            page.screenshot(path=str(artifacts / f'resource-library-{width}.png'), full_page=True)

    for route in ['/', '/posts/']:
        page.goto(base + route)
        nav = page.locator('header nav a').filter(has_text='자료실')
        nav.click()
        expect(page).to_have_url(base + '/resources/')
        expect(cards).to_have_count(len(resources))

    # 서버 오류 뒤 재시도, 빈 목록, 잘못된 출처 주소를 확인합니다.
    state = {'data': copy.deepcopy(original), 'failed': True}

    def catalog_response(route):
        if state['failed']:
            route.fulfill(status=503, json={})
        else:
            route.fulfill(json=state['data'])

    page.route('**/data/resources.json', catalog_response)
    page.reload()
    expect(page.locator('#retry-resources')).to_be_visible()
    expect(page.locator('#resource-filters')).to_be_hidden()
    state['failed'] = False
    page.get_by_role('button', name='다시 불러오기').click()
    expect(cards).to_have_count(len(resources))
    for url in ['javascript:alert(1)', 'https://www.kisa.or.kr.evil.example/guide', 'http://www.kisa.or.kr/guide', 'https://user:password@www.kisa.or.kr/guide']:
        state['data'] = copy.deepcopy(original)
        state['data']['resources'][0]['sourceUrl'] = url
        page.reload()
        expect(cards).to_have_count(0)
        expect(page.locator('#retry-resources')).to_be_visible()

    state['data'] = copy.deepcopy(original)
    literal = '<img src=x onerror=alert(1)>안내서'
    state['data']['resources'][0]['title'] = literal
    state['data']['resources'][0]['sourceName'] = literal
    page.reload()
    expect(cards.first.locator('h3')).to_have_text(literal)
    expect(cards.first.locator('.resource-source')).to_contain_text(literal)
    expect(cards.locator('img')).to_have_count(0)
    state['data']['resources'] = []
    page.reload()
    expect(page.locator('#resources-status')).to_have_text('아직 등록된 자료가 없습니다.')
    expect(page.locator('#retry-resources')).to_be_hidden()
    assert not errors, errors
    context.close()

    touch = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = touch.new_page()
    page.goto(base + '/resources/')
    page.locator('button[data-category="privacy"]').tap()
    expect(page.locator('.resource-card')).to_have_count(sum(item['categoryId'] == 'privacy' for item in resources))
    page.get_by_label('자료 검색').fill('PIA')
    expect(page.locator('.resource-card')).to_have_count(1)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    touch.close()

    fallback = browser.new_context(java_script_enabled=False)
    page = fallback.new_page()
    page.goto(base + '/resources/')
    expect(page.locator('noscript a')).to_have_count(3)
    expect(page.get_by_role('heading', name='자료실', exact=True)).to_be_visible()
    fallback.close()
    print('PASS: resource library, official attribution, editions, category/search filters, safe links/text, keyboard/touch, mobile layout, retry and no-script fallback.')
