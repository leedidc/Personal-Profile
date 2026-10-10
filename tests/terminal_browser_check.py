import copy
import json
from playwright.sync_api import expect


def check_terminal(browser, base, root, artifacts):
    data = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    requests = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.goto(base)
    launcher = page.locator('#terminal-launcher')
    dialog = page.locator('#portfolio-terminal')
    output = page.locator('#terminal-output')
    command_input = page.locator('#terminal-input')
    expect(launcher).to_be_visible()
    expect(dialog).not_to_be_visible()
    launcher.click()
    expect(dialog).to_be_visible()
    expect(command_input).to_be_focused()
    expect(launcher).to_have_attribute('aria-expanded', 'true')
    assert page.evaluate("document.documentElement.classList.contains('terminal-open')")

    def run(command):
        command_input.fill(command)
        command_input.press('Enter')
        return output.locator('.terminal-entry').last

    page.locator('[data-terminal-command="whoami"]').click()
    expect(output).to_contain_text(data['profile']['introduction'])
    expect(output).to_contain_text(data['profile']['name'])
    result = run('skills Python')
    python_skill = next(skill for skill in data['skills'] if skill['name'] == 'Python')
    expect(result).to_contain_text('Python · ' + python_skill['level'])
    expect(result).not_to_contain_text('Excel')
    result = run('SKILLS')
    for category in data['skillCategories']:
        expect(result).to_contain_text('[' + category['label'] + ']')
    result = run('projects Python')
    for project in data['projects']:
        if 'Python' in project['technologies']:
            expect(result).to_contain_text(project['name'])
            expect(result).to_contain_text(project['summary'])
    result = run('certs')
    for row in data['certifications']:
        expect(result).to_contain_text(row['name'])
        if row.get('maskedNumber'):
            expect(result).not_to_contain_text(row['maskedNumber'])
    result = run('contact')
    expect(result.locator('a[href^="mailto:"]')).to_have_attribute('href', 'mailto:' + data['profile']['email'])
    expect(result.locator('a[href^="https://github.com/"]')).to_have_attribute('rel', 'noopener noreferrer')
    result = run('posts')
    expect(result.locator('a')).to_have_attribute('href', 'posts/')
    result = run('help')
    expect(result).to_contain_text('skills Python')
    expect(result).to_contain_text('clear')

    command_input.fill('draft')
    command_input.press('ArrowUp')
    expect(command_input).to_have_value('help')
    command_input.press('ArrowUp')
    expect(command_input).to_have_value('posts')
    command_input.press('ArrowDown')
    command_input.press('ArrowDown')
    expect(command_input).to_have_value('draft')
    command_input.fill('pro')
    command_input.press('Tab')
    expect(command_input).to_have_value('projects')
    expect(command_input).to_be_focused()
    command_input.fill('')
    command_input.press('Tab')
    expect(page.get_by_role('button', name='명령어 실행', exact=True)).to_be_focused()
    command_input.fill('whoami')
    before = output.locator('.terminal-entry').count()
    command_input.dispatch_event('keydown', {'key': 'Enter', 'isComposing': True})
    expect(output.locator('.terminal-entry')).to_have_count(before)
    result = run('<img src=x onerror=alert(1)>')
    expect(result).to_contain_text('<img src=x onerror=alert(1)>')
    expect(output.locator('img, script')).to_have_count(0)
    for unknown in ['constructor', 'toString', 'fetch("https://example.invalid")', 'help;alert(1)']:
        expect(run(unknown)).to_contain_text('알 수 없는 명령어')
    expect(run('whoami extra')).to_contain_text('whoami만 입력')
    expect(run('skills no-matching-skill')).to_contain_text('검색한 스킬이 없습니다')
    assert not any('example.invalid' in url or url.startswith('https://chatbot.') for url in requests)
    assert page.evaluate('localStorage.length === 0 && sessionStorage.length === 0')
    run('clear')
    expect(output.locator('.terminal-entry')).to_have_count(1)
    command_input.press('ArrowUp')
    expect(command_input).to_have_value('')
    run('whoami')
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
    expect(launcher).to_be_focused()
    expect(launcher).to_have_attribute('aria-expanded', 'false')
    assert page.evaluate("!document.documentElement.classList.contains('terminal-open')")
    launcher.click()
    expect(output).to_contain_text(data['profile']['introduction'])
    result = run('skills Python')
    result.locator('a[href="#skills"]').click()
    expect(dialog).not_to_be_visible()
    expect(page).to_have_url(base + '/#skills')

    for width, height in [(1440, 1000), (390, 844), (320, 568), (844, 390)]:
        page.set_viewport_size({'width': width, 'height': height})
        launcher_box = launcher.bounding_box()
        chat_box = page.locator('#ai-chat-launcher').bounding_box()
        assert launcher_box['x'] + launcher_box['width'] < chat_box['x']
        launcher.click()
        run('clear')
        run('whoami')
        box = dialog.bounding_box()
        assert box['x'] >= 0 and box['y'] >= 0
        assert box['x'] + box['width'] <= width and box['y'] + box['height'] <= height
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert dialog.evaluate('el => el.scrollWidth <= el.clientWidth')
        form_box = page.locator('#terminal-form').bounding_box()
        assert form_box['y'] + form_box['height'] <= height
        dialog.screenshot(path=str(artifacts / f'terminal-{width}.png'))
        run('exit')
        expect(dialog).not_to_be_visible()

    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('''() => {
      const viewport = new EventTarget();
      Object.assign(viewport, {height: 844, offsetTop: 0, scale: 1});
      Object.defineProperty(window, 'visualViewport', {value: viewport});
    }''')
    launcher.click()
    page.evaluate('''() => {
      Object.assign(visualViewport, {height: 360, offsetTop: 40});
      window.dispatchEvent(new Event('resize'));
    }''')
    expect(dialog).to_have_class('portfolio-terminal is-keyboard-open')
    box = dialog.bounding_box()
    assert box['y'] >= 40 and box['y'] + box['height'] <= 400
    form_box = page.locator('#terminal-form').bounding_box()
    assert form_box['y'] + form_box['height'] <= 400
    dialog.screenshot(path=str(artifacts / 'terminal-keyboard.png'))
    page.keyboard.press('Escape')

    # 관리자에서 바뀐 공개 데이터가 터미널에도 그대로 반영되는지 검사합니다.
    changed = copy.deepcopy(data)
    changed['profile']['name'] = '검증용 <img src=x onerror=alert(1)>'
    changed['skillCategories'][0]['label'] = '변경한 분류'
    changed['skills'] = [changed['skills'][0]]
    changed['skills'][0]['name'] = '검증 도구'
    changed['skills'][0]['level'] = '하'
    changed['projects'] = []
    changed['certifications'] = list(reversed(changed['certifications']))
    page.route('**/data/portfolio.json', lambda route: route.fulfill(json=changed))
    page.goto(base)
    launcher.click()
    expect(run('whoami')).to_contain_text(changed['profile']['name'])
    expect(output.locator('img')).to_have_count(0)
    result = run('skills')
    expect(result).to_contain_text('변경한 분류')
    expect(result).to_contain_text('검증 도구 · 하')
    expect(result).not_to_contain_text('Python')
    expect(run('projects')).to_contain_text('등록된 프로젝트가 없습니다')
    lines = run('certs').locator('.terminal-response').inner_text().splitlines()
    assert [line.split(' · ')[0] for line in lines] == [row['name'] for row in changed['certifications']]
    assert not errors, errors
    context.close()

    touch = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = touch.new_page()
    page.goto(base)
    page.locator('#terminal-launcher').tap()
    expect(page.locator('#terminal-input')).not_to_be_focused()
    page.locator('[data-terminal-command="skills"]').tap()
    expect(page.locator('#terminal-output')).to_contain_text(python_skill['name'])
    expect(page.locator('#terminal-input')).not_to_be_focused()
    page.locator('#terminal-input').tap()
    expect(page.locator('#terminal-input')).to_be_focused()
    touch.close()

    context = browser.new_context(reduced_motion='reduce')
    context.route('**/js/portfolio-terminal.js', lambda route: route.abort())
    page = context.new_page()
    page.goto(base)
    expect(page.locator('#terminal-launcher')).to_be_hidden()
    expect(page.locator('#profile h1')).to_be_visible()
    context.close()
    print('PASS: terminal commands/search, current portfolio data/order, safe text/links, no command execution/network/storage, shortcuts, history/completion, IME, dialog focus, mobile/keyboard and missing script fallback.')
