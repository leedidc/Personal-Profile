from datetime import datetime, timezone

from playwright.sync_api import expect


ENDPOINT = 'https://personal-profile-admin-auth.leedidc1227.workers.dev/api/visitor'


def check_visitor_info(browser, base, artifacts):
    errors = []
    fixed_time = datetime(2026, 10, 10, tzinfo=timezone.utc)
    for zone, expected_date, expected_hour in [
        ('Asia/Seoul', '2026. 10. 10.', '09:00:00'),
        ('America/New_York', '2026. 10. 09.', '20:00:00'),
    ]:
        context = browser.new_context(timezone_id=zone, viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        payload = {'ip': '192.0.2.10', 'country': 'KR'}
        page.route(ENDPOINT, lambda route: route.fulfill(json=payload))
        page.clock.install(time=fixed_time)
        page.clock.pause_at(fixed_time)
        page.goto(base)
        expect(page.locator('#visitor-info')).to_be_visible()
        expect(page.locator('#visitor-ip')).to_have_text('192.0.2.10')
        expect(page.locator('#visitor-country')).to_have_text('대한민국')
        flag = page.locator('#visitor-country img')
        expect(flag).to_be_visible()
        expect(flag).to_have_attribute('src', 'image/flags/kr.svg')
        expect(flag).to_have_attribute('alt', '')
        assert flag.evaluate('el => el.naturalWidth > 0')
        expect(page.locator('#visitor-time')).to_contain_text(expected_date)
        expect(page.locator('#visitor-time')).to_contain_text(expected_hour)
        expect(page.locator('#visitor-time')).to_have_attribute('title', zone)
        page.clock.run_for(1100)
        expect(page.locator('#visitor-time')).to_contain_text(expected_hour[:-2] + '01')
        assert page.evaluate('localStorage.length === 0 && sessionStorage.length === 0')

        payload.update(ip='2001:db8:1234:5678:abcd:ef01:2345:6789', country='US')
        page.reload()
        expect(page.locator('#visitor-ip')).to_have_text(payload['ip'])
        expect(page.locator('#visitor-country')).to_have_text('미국')
        expect(flag).to_be_visible()
        expect(flag).to_have_attribute('src', 'image/flags/us.svg')
        for width in [1440, 768, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 1000})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('#visitor-info').evaluate('el => el.scrollWidth <= el.clientWidth')
            assert page.locator('#visitor-country').evaluate('el => el.scrollWidth <= el.clientWidth')
            if zone == 'Asia/Seoul' and width in [1440, 320]:
                page.screenshot(path=str(artifacts / f'visitor-info-{width}.png'))
                page.locator('#visitor-info').screenshot(path=str(artifacts / f'visitor-country-flag-{width}.png'))

        if zone == 'Asia/Seoul':
            for code in ['XX', 'ZZ', 'AA', 'T1', None]:
                payload.update(country=code)
                page.reload()
                expect(page.locator('#visitor-country')).to_have_text('확인 불가')
                expect(flag).to_have_count(0)
            payload.update(country='KR')
            page.route('**/image/flags/kr.svg', lambda route: route.abort())
            page.reload()
            expect(page.locator('#visitor-country')).to_have_text('대한민국')
            expect(flag).to_have_count(0)
            page.unroute('**/image/flags/kr.svg')

        payload.update(ip='<img src=x onerror=alert(1)>', country='<script>')
        page.reload()
        expect(page.locator('#visitor-ip')).to_have_text('확인 불가')
        expect(page.locator('#visitor-country')).to_have_text('확인 불가')
        expect(page.locator('#visitor-info img, #visitor-info script')).to_have_count(0)

        page.unroute(ENDPOINT)
        page.route(ENDPOINT, lambda route: route.abort())
        page.reload()
        expect(page.locator('#visitor-ip')).to_have_text('확인 불가')
        expect(page.locator('#profile-name')).to_be_visible()
        page.clock.run_for(1100)
        assert page.locator('#visitor-time').inner_text()
        context.close()

    context = browser.new_context()
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    pending_requests = []
    page.route(ENDPOINT, lambda route: pending_requests.append(route))
    page.goto(base, wait_until='domcontentloaded')
    expect(page.locator('#visitor-ip')).to_have_text('확인 중…')
    expect(page.locator('#visitor-ip')).to_have_text('확인 불가', timeout=8000)
    expect(page.locator('#visitor-country')).to_have_text('확인 불가')
    expect(page.locator('#profile-name')).to_be_visible()
    for route in pending_requests:
        route.abort()
    context.close()
    assert not errors, errors
    print('PASS: visitor local clock, time zones, IPv4/IPv6, local country flags, mobile layout, unknown countries, failed image, unavailable data and timeout.')
