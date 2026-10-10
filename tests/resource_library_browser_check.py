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
    page_size = 12
    first_page = resources[:page_size]
    expect(cards).to_have_count(len(first_page))
    expect(cards.locator('h3')).to_have_text([item['title'] for item in first_page])
    expect(page.locator('#resources-checked')).to_contain_text(original['checkedOn'].replace('-', '.'))
    expect(page.locator('nav a[aria-current]')).to_have_text('자료실')
    # 모든 페이지를 순회해 누락·중복 없이 출처와 파일이 연결되는지 확인합니다.
    seen = []
    for offset in range(0, len(resources), page_size):
        batch = resources[offset:offset + page_size]
        expect(cards.locator('h3')).to_have_text([item['title'] for item in batch])
        actual = cards.evaluate_all('''items => items.map(card => ({
            title: card.querySelector('h3').textContent,
            source: card.querySelector('.resource-source a').getAttribute('href'),
            sourceName: card.querySelector('.resource-source a').textContent,
            edition: card.querySelector('.resource-edition').textContent,
            date: card.querySelector('time').dateTime,
            files: Array.from(card.querySelectorAll('.resource-downloads a'), a => a.getAttribute('href')),
            safeLinks: Array.from(card.querySelectorAll('a')).every(a => a.target === '_blank' && a.rel === 'noopener noreferrer')
        }))''')
        for card, item in zip(actual, batch):
            assert card['source'] == item['sourceUrl']
            assert item['sourceName'] in card['sourceName']
            assert card['edition'] == item['edition']
            assert card['date'] == item['publishedOn']
            assert card['files'] == [file['url'] for file in item['downloads']]
            assert card['safeLinks']
            seen.append(card['title'])
        if offset + page_size < len(resources):
            page.get_by_role('button', name='다음 →').click()
            expect(page.locator('#resource-list-title')).to_be_focused()
    assert seen == [item['title'] for item in resources]
    expect(page.locator('#resource-next')).to_be_disabled()
    page.locator('#resource-previous').click()
    expect(page.locator('#resource-next')).to_be_enabled()
    page.locator('button[data-category="all"]').click()
    expect(cards.locator('h3')).to_have_text([item['title'] for item in first_page])
    expect(page.locator('#resource-previous')).to_be_disabled()

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

    # 브라우저가 파일 다운로드로 처리하며 자료실은 그대로 유지되어야 합니다.
    file = resources[0]['downloads'][0]
    from urllib.parse import urljoin
    file_url = urljoin(base + '/resources/', file['url'])
    context.route(file_url, lambda route: route.fulfill(body='%PDF-1.4\n%%EOF', headers={
        'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="official-guide.pdf"',
    }))
    with page.expect_download() as downloaded:
        cards.first.locator('.resource-download').click()
    assert downloaded.value.failure() is None
    assert downloaded.value.suggested_filename.endswith('.pdf')
    expect(page).to_have_url(base + '/resources/')

    for category in original['categories']:
        button = page.locator(f'button[data-category="{category["id"]}"]')
        button.focus()
        page.keyboard.press('Enter')
        expect(button).to_have_attribute('aria-pressed', 'true')
        expected = [item['title'] for item in resources if item['categoryId'] == category['id']]
        expect(cards.locator('h3')).to_have_text(expected[:page_size])
        expect(page.locator('#resource-previous')).to_be_disabled()
    page.locator('button[data-category="all"]').click()
    search.fill('pia')
    expect(cards).to_have_count(1)
    expect(cards.first).to_contain_text('개인정보 영향평가 수행안내서')
    search.fill('ISMS-P 인증기준')
    expect(cards).to_have_count(1)
    search.press('Enter')
    expect(search).to_have_value('ISMS-P 인증기준')
    search.fill('존재하지않는자료 <img src=x onerror=alert(1)>')
    expect(cards).to_have_count(0)
    expect(page.locator('#resources-empty')).to_be_visible()
    expect(page.locator('#resource-list img')).to_have_count(0)
    page.get_by_role('button', name='전체 자료 보기').click()
    expect(search).to_be_focused()
    expect(search).to_have_value('')
    expect(cards).to_have_count(len(first_page))

    page.get_by_label('정렬', exact=True).select_option('recent')
    newest = sorted(resources, key=lambda item: item['publishedOn'], reverse=True)
    expect(cards.locator('h3')).to_have_text([item['title'] for item in newest[:page_size]])
    page.locator('#resource-next').click()
    search.fill('PIA')
    expect(cards).to_have_count(1)
    expect(page.locator('#resource-pagination')).to_be_hidden()
    search.fill('')
    expect(page.locator('#resource-previous')).to_be_disabled()
    page.get_by_label('정렬', exact=True).select_option('title')
    titles = cards.locator('h3').all_text_contents()
    assert page.evaluate('(titles) => titles.every((title, i) => !i || titles[i-1].localeCompare(title, "ko") <= 0)', titles)
    page.get_by_label('정렬', exact=True).select_option('default')

    multiple = next(item for item in resources if len(item['downloads']) > 1)
    search.fill(multiple['title'])
    card = cards.filter(has=page.get_by_role('heading', name=multiple['title'], exact=True))
    card.locator('summary').click()
    expect(card.locator('.resource-extra-files a').first).to_be_visible()
    expect(card.locator('.resource-extra-files a')).to_have_count(len(multiple['downloads']) - 1)
    search.fill('')

    # 분류와 검색이 함께 적용되고 검색어를 지워도 선택 분류는 유지됩니다.
    page.locator('button[data-category="security"]').click()
    search.fill('PIA')
    expect(cards).to_have_count(0)
    search.fill('')
    expect(cards).to_have_count(min(page_size, sum(item['categoryId'] == 'security' for item in resources)))
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
        expect(cards).to_have_count(len(first_page))

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
    expect(cards).to_have_count(len(first_page))
    for url in ['javascript:alert(1)', 'https://www.kisa.or.kr.evil.example/guide', 'http://www.kisa.or.kr/guide', 'https://user:password@www.kisa.or.kr/guide']:
        state['data'] = copy.deepcopy(original)
        state['data']['resources'][0]['sourceUrl'] = url
        page.reload()
        expect(cards).to_have_count(0)
        expect(page.locator('#retry-resources')).to_be_visible()

    for url in ['javascript:alert(1)', 'files/../private.pdf', '//evil.example/guide.pdf', 'https://www.kisa.or.kr.evil.example/file.pdf']:
        state['data'] = copy.deepcopy(original)
        state['data']['resources'][0]['downloads'][0]['url'] = url
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
    expect(page.locator('.resource-card')).to_have_count(min(page_size, sum(item['categoryId'] == 'privacy' for item in resources)))
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
    print('PASS: resource library, all catalog pages, official sources/files, downloads, sorting, category/search filters, safe links/text, keyboard/touch, mobile layout, retry and no-script fallback.')
