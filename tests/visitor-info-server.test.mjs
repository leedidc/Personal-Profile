import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/admin-auth/worker.js';

const publicOrigin = 'https://portfolio.example';
const endpoint = 'https://admin.example/api/visitor';

function visit(ip, country, options = {}) {
  const request = new Request(endpoint, {
    method: options.method || 'GET',
    headers: {
      Origin: publicOrigin,
      ...(ip ? { 'CF-Connecting-IP': ip } : {}),
      ...options.headers,
    },
  });
  Object.defineProperty(request, 'cf', { value: { country } });
  // 공개 요청이 인증 상태나 정적 자산 저장소를 사용하면 이 환경에서는 실패합니다.
  return worker.fetch(request, { PUBLIC_ORIGIN: publicOrigin });
}

test('접속자별 IP와 국가만 반환하고 캐시·쿠키·인증 저장소를 사용하지 않는다', async () => {
  const first = await visit('192.0.2.10', 'KR');
  const second = await visit('2001:db8::1234', 'US');
  assert.deepEqual(await first.json(), { ip: '192.0.2.10', country: 'KR' });
  assert.deepEqual(await second.json(), { ip: '2001:db8::1234', country: 'US' });
  assert.equal(first.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(first.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), publicOrigin);
  assert.equal(first.headers.get('Vary'), 'Origin');
  assert.equal(first.headers.get('Set-Cookie'), null);
  assert.equal(first.headers.get('Access-Control-Allow-Credentials'), null);
});

test('다른 출처와 쓰기 요청에는 방문자 정보를 반환하지 않는다', async () => {
  const denied = await visit('192.0.2.10', 'KR', {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(Object.hasOwn(await denied.json(), 'ip'), false);
  const post = await visit('192.0.2.10', 'KR', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET');
});

test('알 수 없는 접속 정보는 추정하거나 전달 헤더로 대체하지 않는다', async () => {
  for (const country of [undefined, null, 'XX', 'T1', '<script>']) {
    const response = await visit('', country, {
      headers: { 'X-Forwarded-For': '192.0.2.20', 'CF-IPCountry': 'KR' },
    });
    assert.deepEqual(await response.json(), { ip: null, country: null });
  }
  for (const ip of ['999.999.999.999', '192.0.2.10, 192.0.2.20', '<script>', '2001:invalid']) {
    const response = await visit(ip, 'KR');
    assert.deepEqual(await response.json(), { ip: null, country: 'KR' });
  }
});
