import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/admin-auth/worker.js';
import { VisitorStats } from '../server/admin-auth/visitor-stats.js';

const publicOrigin = 'https://portfolio.example';
const endpoint = 'https://admin.example/api/visitor-stats';

function setup() {
  const data = new Map();
  let alarm = null;
  let queue = Promise.resolve();
  const storage = {
    get: async (key) => structuredClone(data.get(key)),
    put: async (key, value) => data.set(key, structuredClone(value)),
    getAlarm: async () => alarm,
    setAlarm: async (time) => {
      alarm = time;
    },
    transaction: (callback) => {
      const result = queue.then(() => callback(storage));
      queue = result.catch(() => {});
      return result;
    },
  };
  const stats = new VisitorStats({ storage });
  const forwarded = [];
  const env = {
    PUBLIC_ORIGIN: publicOrigin,
    VISITOR_STATS: {
      idFromName: (name) => name,
      get: () => ({
        fetch: (request) => {
          forwarded.push(request);
          return stats.fetch(request);
        },
      }),
    },
  };
  return { stats, env, data, forwarded };
}

function request(env, country, { method = 'POST', headers = {}, body, path } = {}) {
  const req = new Request(path || endpoint, {
    method,
    headers: {
      Origin: publicOrigin,
      'CF-Connecting-IP': '192.0.2.90',
      'User-Agent': 'synthetic-browser',
      ...headers,
    },
    ...(body === undefined ? {} : { body }),
  });
  Object.defineProperty(req, 'cf', {
    value: {
      country,
      city: 'Synthetic city',
      latitude: '37.0',
      longitude: '127.0',
      tlsVersion: 'TLSv1.3',
      httpProtocol: 'HTTP/2',
    },
  });
  return worker.fetch(req, env);
}

test('동시 방문을 국가별로 집계하고 저장소·공개 응답에는 IP와 위치를 남기지 않는다', async () => {
  const { env, data, forwarded } = setup();
  await Promise.all(Array.from({ length: 12 }, () => request(env, 'KR')));
  await request(env, 'US');
  const response = await request(env, 'KR', { method: 'GET' });
  const result = await response.json();
  assert.equal(result.total, 13);
  assert.deepEqual(result.countries, [
    { code: 'KR', count: 12 },
    { code: 'US', count: 1 },
  ]);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), publicOrigin);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  for (const internal of forwarded) {
    assert.deepEqual(
      [...internal.headers],
      [['x-visitor-country', internal.headers.get('X-Visitor-Country')]],
    );
    assert.equal(internal.body, null);
    assert.equal(internal.cf, undefined);
  }
  const stored = JSON.stringify([...data]);
  assert.doesNotMatch(
    stored + JSON.stringify(result),
    /192\.0\.2|Synthetic|latitude|longitude|User-Agent|tlsVersion/,
  );
});

test('국가 조작·타 출처·요청 본문·미확인 국가를 통계에 반영하지 않는다', async () => {
  const { env, data } = setup();
  assert.equal(
    (await request(env, 'KR', { headers: { Origin: 'https://untrusted.example' } })).status,
    403,
  );
  const noOrigin = new Request(endpoint, { method: 'POST' });
  assert.equal((await worker.fetch(noOrigin, env)).status, 403);
  assert.equal((await request(env, 'KR', { method: 'PUT' })).status, 405);
  assert.equal((await request(env, 'KR', { body: '{"country":"US"}' })).status, 400);
  assert.equal((await request(env, undefined, { body: '' })).status, 200);
  for (const country of [undefined, null, 'XX', 'T1', '<script>']) {
    const response = await request(env, country, {
      headers: { 'CF-IPCountry': 'US', 'X-Visitor-Country': 'US' },
    });
    assert.equal((await response.json()).total, 0);
  }
  assert.equal(data.size, 0);
  const preflight = await request(env, 'KR', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), publicOrigin);
});

test('30일이 지난 일별 통계는 조회에서 제외하고 알람으로 삭제한다', async () => {
  const { env, data, stats } = setup();
  const now = Date.now();
  const date = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString().slice(0, 10);
  data.set('days', { [date(30)]: { KR: 50 }, [date(29)]: { US: 2 }, [date(0)]: { KR: 1 } });
  const response = await request(env, 'KR', { method: 'GET' });
  assert.equal((await response.json()).total, 3);
  await stats.alarm();
  assert.deepEqual(Object.keys(data.get('days')).sort(), [date(29), date(0)].sort());
});

test('연결 정보는 실제 요청 메타데이터의 TLS·HTTP 버전만 반환한다', async () => {
  const { env } = setup();
  const response = await request(env, 'KR', {
    method: 'GET',
    path: 'https://admin.example/api/connection',
  });
  assert.deepEqual(await response.json(), { tls: 'TLSv1.3', protocol: 'HTTP/2' });
  const unknown = new Request('https://admin.example/api/connection', {
    headers: { Origin: publicOrigin },
  });
  assert.deepEqual(await (await worker.fetch(unknown, env)).json(), { tls: null, protocol: null });
  const denied = await request(env, 'KR', {
    method: 'GET',
    path: 'https://admin.example/api/connection',
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(denied.status, 403);
});
