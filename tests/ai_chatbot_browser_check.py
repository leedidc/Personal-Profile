from playwright.sync_api import expect


def check_chatbot(browser, base, artifacts):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    state = {'requests': [], 'mode': 'success'}

    def reply(route):
        state['requests'].append(route.request.post_data_json)
        headers = {'Access-Control-Allow-Origin': '*'}
        if state['mode'] == 'rate-limit':
            route.fulfill(status=429, headers=headers, json={'error': 'synthetic-private-error'})
        elif state['mode'] == 'delayed':
            state['pending'] = route
        else:
            route.fulfill(headers=headers, json={'reply': '최신 공개 이력에 따른 답변입니다. <img src=x onerror=alert(1)>'})

    context.route('https://chatbot.leedidc1227.workers.dev/**', reply)
    page.goto(base)
    expect(page.locator('#ai-chat-launcher')).to_be_visible()
    expect(page.locator('#ai-chat-panel')).to_be_hidden()
    assert not state['requests'], 'No AI request before a visitor asks a question'
    page.locator('#ai-chat-launcher').click()
    expect(page.locator('#ai-chat-input')).to_be_focused()
    expect(page.locator('#ai-chat-send')).to_be_disabled()
    page.get_by_role('button', name='보유 자격증', exact=True).click()
    expect(page.locator('#ai-chat-messages .is-assistant').last).to_contain_text('최신 공개 이력')
    expect(page.locator('#ai-chat-messages img')).to_have_count(0)
    assert 'maskedNumber' not in state['requests'][0]['message']
    expect(page.locator('#ai-chat-suggestions')).to_be_hidden()
    page.locator('#ai-chat-input').fill('그 자격에 대해 더 알려줘')
    page.locator('#ai-chat-input').press('Enter')
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(2)
    expect(page.locator('#ai-chat-messages .is-assistant')).to_have_count(3)
    assert '이전 대화: [{"role":"user"' in state['requests'][-1]['message']
    page.locator('#ai-chat-input').press('Escape')
    expect(page.locator('#ai-chat-panel')).to_be_hidden()
    expect(page.locator('#ai-chat-launcher')).to_be_focused()
    page.locator('#ai-chat-launcher').click()
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(2)

    state['mode'] = 'rate-limit'
    page.locator('#ai-chat-input').fill('연구를 소개해 줘')
    page.locator('#ai-chat-send').click()
    expect(page.locator('#ai-chat-messages .is-error')).to_contain_text('사용량 한도')
    expect(page.locator('#ai-chat-messages')).not_to_contain_text('synthetic-private-error')
    state['mode'] = 'success'
    page.get_by_role('button', name='다시 시도', exact=True).click()
    expect(page.locator('#ai-chat-messages .is-error')).to_have_count(0)
    expect(page.locator('#ai-chat-messages .is-assistant')).to_have_count(4)
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(3)

    state['mode'] = 'delayed'
    page.locator('#ai-chat-input').fill('응답 도중 초기화')
    page.locator('#ai-chat-send').click()
    expect(page.locator('#ai-chat-status')).to_contain_text('답변을 준비')
    page.locator('#ai-chat-reset').click()
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(0)
    expect(page.locator('#ai-chat-messages .is-assistant')).to_have_count(1)
    expect(page.locator('#ai-chat-suggestions')).to_be_visible()
    if 'pending' in state:
        state['pending'].fulfill(json={'reply': '초기화 전에 요청한 오래된 답변'})
    expect(page.locator('#ai-chat-messages')).not_to_contain_text('오래된 답변')
    state['mode'] = 'success'
    page.locator('#ai-chat-input').fill('새 질문')
    page.locator('#ai-chat-input').dispatch_event('keydown', {'key': 'Enter', 'isComposing': True})
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(0)
    page.locator('#ai-chat-input').press('Shift+Enter')
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(0)
    page.locator('#ai-chat-input').press('Enter')
    expect(page.locator('#ai-chat-messages .is-assistant')).to_have_count(2)
    assert '이전 대화: []' in state['requests'][-1]['message']
    assert page.evaluate("""localStorage.length === 0 && Object.entries(sessionStorage).every(
        ([key, value]) => key === 'portfolio-intro-seen-v1' && value === '1'
    )""")
    for width, height in [(1440, 1000), (390, 844), (320, 568)]:
        page.set_viewport_size({'width': width, 'height': height})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        panel = page.locator('#ai-chat-panel').bounding_box()
        assert panel['x'] >= 0 and panel['y'] >= 0
        assert panel['x'] + panel['width'] <= width
        expect(page.locator('#ai-chat-send')).to_be_visible()
        page.locator('#ai-chat-panel').screenshot(path=str(artifacts / f'ai-chatbot-{width}.png'))
    for width, height in [(320, 568), (390, 480)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.locator('#ai-chat-reset').click()
        expect(page.locator('#ai-chat-suggestions')).to_be_visible()
        panel = page.locator('#ai-chat-panel').bounding_box()
        notice = page.locator('.ai-chat-notice').bounding_box()
        assert notice['y'] + notice['height'] <= panel['y'] + panel['height'], 'Initial chat controls are clipped'
        page.locator('#ai-chat-panel').screenshot(path=str(artifacts / f'ai-chatbot-initial-{width}-{height}.png'))
    page.locator('.ai-chat-reference a').first.click()
    expect(page.locator('#ai-chat-panel')).to_be_hidden()
    page.reload()
    page.locator('#ai-chat-launcher').click()
    expect(page.locator('#ai-chat-messages .is-user')).to_have_count(0)
    assert not errors, errors
    context.close()
    print('PASS: chatbot suggestions, grounded request, follow-up, safe text, retry, cancellation, IME, responsive layout and memory-only history.')
