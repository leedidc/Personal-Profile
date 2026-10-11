import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import worker, { AdminState } from '../server/admin-auth/worker.js';
import { hashPassword } from '../server/admin-auth/password.js';

const origin = 'https://portfolio.example';
const testPassword = 'synthetic-password-for-tests';
const hash = hashPassword(testPassword);

test('자료 점검 기록은 인증 후 고정된 GitHub 경로에서 읽고 쓰기는 허용하지 않는다', async () => {
  const { auth } = setup();
  const session = await login(auth);
  const originalFetch = globalThis.fetch;
  const report = { schemaVersion: 1, changes: [], errors: [] };
  try {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/contents\/data\/resource-updates\.json\?ref=main$/);
      assert.equal(options.headers.Authorization, 'Bearer synthetic-github-token');
      return Response.json({
        encoding: 'base64',
        content: Buffer.from(JSON.stringify(report)).toString('base64'),
      });
    };
    const response = await call(auth, '/resource-updates', session);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), report);
    assert.equal(
      (await call(auth, '/resource-updates', { ...session, method: 'POST', body: {} })).status,
      404,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function setup() {
  const data = new Map();
  const storage = {
    getAlarm: async () => data.get('alarm') || null,
    setAlarm: async (time) => data.set('alarm', time),
    get: async (key) => structuredClone(data.get(key)),
    put: async (key, value) => data.set(key, structuredClone(value)),
    transaction: async (callback) => callback(storage),
  };
  const env = {
    SITE_ORIGIN: origin,
    ADMIN_USERNAME: 'synthetic-admin',
    ADMIN_PASSWORD_HASH: hash,
    GITHUB_TOKEN: 'synthetic-github-token',
  };
  return { auth: new AdminState({ storage }, env), env, data };
}

function call(auth, path, { method = 'GET', body, cookie, csrf, headers = {} } = {}) {
  return auth.fetch(
    new Request(origin + '/api/admin' + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function login(auth) {
  const response = await call(auth, '/login', {
    method: 'POST',
    body: { username: 'synthetic-admin', password: testPassword },
  });
  assert.equal(response.status, 200);
  return { cookie: response.headers.get('Set-Cookie'), ...(await response.json()) };
}

test('비밀번호는 해시로 검증하고 보안 쿠키·만료·로그아웃·세션 폐기를 적용한다', async () => {
  const { auth, data, env } = setup();
  const session = await login(auth);
  assert.match(
    session.cookie,
    /__Host-portfolio-admin=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=7200/,
  );
  assert.equal((await call(auth, '/session', session)).status, 200);
  assert.doesNotMatch(JSON.stringify([...data]), new RegExp(testPassword));
  const loggedOut = await call(auth, '/logout', { ...session, method: 'POST', body: {} });
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await call(auth, '/session', session)).status, 401);
  const expired = await login(auth);
  const sessions = data.get('sessions');
  Object.values(sessions)[0].lastSeen = Date.now() - 31 * 60000;
  assert.equal((await call(auth, '/session', expired)).status, 401);
  const rotated = await login(auth);
  env.ADMIN_PASSWORD_HASH = hashPassword('another-synthetic-password');
  assert.equal((await call(auth, '/session', rotated)).status, 401);
});

test('인증 없는 저장·CSRF·외부 Origin·다른 저장소 경로를 거부한다', async () => {
  const { auth } = setup();
  assert.equal((await call(auth, '/portfolio', { method: 'PUT', body: {} })).status, 401);
  assert.equal((await call(auth, '/resource-updates')).status, 401);
  const session = await login(auth);
  assert.equal(
    (await call(auth, '/portfolio', { method: 'PUT', body: {}, cookie: session.cookie })).status,
    403,
  );
  assert.equal(
    (
      await call(auth, '/portfolio', {
        method: 'PUT',
        body: {},
        ...session,
        headers: { Origin: 'https://untrusted.example' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await call(auth, '/session', { ...session, headers: { 'Sec-Fetch-Site': 'cross-site' } }))
      .status,
    403,
  );
  assert.equal((await call(auth, '/repos/other/repo', session)).status, 404);
  assert.equal((await call(auth, '/portfolio?path=index.html', session)).status, 404);
  assert.equal(
    (
      await call(auth, '/login', {
        method: 'POST',
        body: {},
        headers: { 'Content-Type': 'text/plain' },
      })
    ).status,
    415,
  );
});

test('SQL 삽입 문자열·객체 입력은 인증을 우회하지 못하고 로그인 시도를 제한한다', async () => {
  const { auth } = setup();
  assert.equal(
    (
      await call(auth, '/login', {
        method: 'POST',
        body: { username: "' OR 1=1 --", password: "' OR '1'='1" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call(auth, '/login', {
        method: 'POST',
        body: { username: { $ne: null }, password: testPassword },
      })
    ).status,
    400,
  );
  for (let index = 0; index < 3; index++) {
    assert.equal(
      (
        await call(auth, '/login', {
          method: 'POST',
          body: { username: 'synthetic-admin', password: 'wrong' },
        })
      ).status,
      401,
    );
  }
  const limited = await call(auth, '/login', {
    method: 'POST',
    body: { username: 'synthetic-admin', password: testPassword },
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.ok(Number(limited.headers.get('Retry-After')) <= 900);
  assert.equal(
    (await call(auth, '/login', { method: 'POST', body: { username: 'x'.repeat(3000) } })).status,
    413,
  );
});

test('서버는 기존 SHA와 고정 콘텐츠 경로만 사용하고 토큰·번호 원문을 응답하지 않는다', async () => {
  const { auth } = setup();
  const session = await login(auth);
  const portfolio = JSON.parse(
    fs.readFileSync(new URL('../data/portfolio.json', import.meta.url), 'utf8'),
  );
  portfolio.certifications[0].maskedNumber = 'SYNTHETIC-98765';
  portfolio.skillCategories.push({
    value: 'custom-tools',
    label: '직접 만든 분류',
    groups: [{ value: 'custom-group', label: '직접 만든 세부 분류' }],
  });
  Object.assign(portfolio.skills[0], { category: 'custom-tools', group: 'custom-group' });
  portfolio.sectionOrder = portfolio.sectionOrder.toReversed();
  const oldFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async (url, options) => {
    called++;
    assert.equal(
      url,
      'https://api.github.com/repos/leedidc/Personal-Profile/contents/data/portfolio.json',
    );
    assert.equal(options.headers.Authorization, 'Bearer synthetic-github-token');
    assert.equal(options.headers['User-Agent'], 'Personal-Profile-Admin');
    const body = JSON.parse(options.body);
    assert.equal(body.sha, 'a'.repeat(40));
    assert.equal(body.branch, 'main');
    const content = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    assert.notEqual(content.certifications[0].maskedNumber, 'SYNTHETIC-98765');
    assert.deepEqual(content.skillCategories, portfolio.skillCategories);
    assert.deepEqual(content.sectionOrder, portfolio.sectionOrder);
    assert.equal(content.skills[0].category, 'custom-tools');
    return Response.json({ content: { sha: 'b'.repeat(40) } });
  };
  try {
    const response = await call(auth, '/portfolio', {
      ...session,
      method: 'PUT',
      body: { data: portfolio, sha: 'a'.repeat(40) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sha: 'b'.repeat(40) });
    assert.equal(called, 1);
    const invalidOrder = { ...portfolio, sectionOrder: ['education', 'education'] };
    assert.equal(
      (
        await call(auth, '/portfolio', {
          ...session,
          method: 'PUT',
          body: { data: invalidOrder, sha: 'a'.repeat(40) },
        })
      ).status,
      400,
    );
    assert.equal(called, 1);
    const invalidCategories = structuredClone(portfolio);
    invalidCategories.skillCategories.pop();
    assert.equal(
      (
        await call(auth, '/portfolio', {
          ...session,
          method: 'PUT',
          body: { data: invalidCategories, sha: 'a'.repeat(40) },
        })
      ).status,
      400,
    );
    assert.equal(called, 1);
    assert.equal(
      (
        await call(auth, '/portfolio', {
          ...session,
          method: 'PUT',
          body: { data: {}, sha: 'a'.repeat(40) },
        })
      ).status,
      400,
    );
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('글 저장은 실제 브랜치의 트리만 사용하며 오래된 커밋이면 쓰기 전에 거부한다', async () => {
  const { auth } = setup();
  const session = await login(auth);
  const headSha = 'a'.repeat(40);
  const treeSha = 'b'.repeat(40);
  const index = { version: 1, categories: [], posts: [] };
  const originalLoad = PostsStorage.loadSnapshot;
  const originalSave = PostsStorage.save;
  let writes = 0;
  PostsStorage.loadSnapshot = async () => ({ headSha, treeSha, index });
  PostsStorage.save = async (token, snapshot, nextIndex) => {
    assert.equal(token, 'synthetic-github-token');
    assert.equal(snapshot.treeSha, treeSha);
    writes++;
    return { ...snapshot, index: nextIndex };
  };
  try {
    const valid = await call(auth, '/posts/save', {
      ...session,
      method: 'POST',
      body: { headSha, treeSha: 'forged-tree', index },
    });
    assert.equal(valid.status, 200);
    assert.equal(writes, 1);
    const stale = await call(auth, '/posts/save', {
      ...session,
      method: 'POST',
      body: { headSha: 'c'.repeat(40), index },
    });
    assert.equal(stale.status, 409);
    assert.equal(writes, 1);
  } finally {
    PostsStorage.loadSnapshot = originalLoad;
    PostsStorage.save = originalSave;
  }
});

test('글·분류 저장의 GitHub 권한 오류와 요청 제한을 구분하고 외부 응답은 숨긴다', async () => {
  const { auth } = setup();
  const session = await login(auth);
  const headSha = 'a'.repeat(40);
  const treeSha = 'b'.repeat(40);
  const index = {
    version: 1,
    categories: [{ id: 'study', name: '학습' }],
    posts: [{ id: 'sample', title: '가상 글', date: '2026-10-10', categoryId: 'study' }],
  };
  const document = { version: 1, id: 'sample', content: { ops: [{ insert: '가상 본문\n' }] } };
  const originalFetch = globalThis.fetch;
  const cases = [
    {
      status: 403,
      message: 'Resource not accessible by personal access token',
      expected: /Contents/,
    },
    {
      status: 403,
      message: 'Resource not accessible by personal access token',
      document,
      expected: /Contents/,
    },
    { status: 403, message: 'API rate limit exceeded', expected: /요청 한도/ },
    {
      status: 403,
      message: 'Private diagnostic',
      headers: { 'X-RateLimit-Remaining': '0' },
      expected: /요청 한도/,
    },
    {
      status: 403,
      message: 'Private diagnostic',
      headers: { 'Retry-After': '60' },
      expected: /요청 한도/,
    },
    { status: 429, message: 'Private diagnostic', expected: /요청 한도/ },
    { status: 403, message: 'Private diagnostic', expected: /접근 권한/ },
    { status: 401, message: 'Private diagnostic', expected: /토큰/ },
    { status: 500, message: 'Private diagnostic', expected: /요청을 처리하지 못했습니다/ },
  ];
  try {
    for (const scenario of cases) {
      let writes = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer synthetic-github-token');
        if (url.endsWith('/git/ref/heads/main')) {
          return Response.json({ object: { sha: headSha } });
        }
        if (url.endsWith('/git/commits/' + headSha)) {
          return Response.json({ tree: { sha: treeSha } });
        }
        if (url.includes('/contents/data/posts/index.json?ref=')) {
          return Response.json({
            sha: 'c'.repeat(40),
            encoding: 'base64',
            content: Buffer.from(JSON.stringify(index)).toString('base64'),
          });
        }
        assert.ok(url.endsWith('/git/trees'), '실패 후 커밋이나 브랜치를 갱신하면 안 됩니다.');
        assert.equal(options.method, 'POST');
        const tree = JSON.parse(options.body);
        assert.equal(tree.base_tree, treeSha);
        assert.equal(tree.tree.length, scenario.document ? 2 : 1);
        writes++;
        return Response.json(
          { message: scenario.message, detail: 'synthetic-github-token' },
          {
            status: scenario.status,
            headers: scenario.headers,
          },
        );
      };
      const response = await call(auth, '/posts/save', {
        ...session,
        method: 'POST',
        body: { headSha, index, document: scenario.document ?? null },
      });
      assert.equal(response.status, 503);
      const result = await response.json();
      assert.match(result.error, scenario.expected);
      assert.doesNotMatch(result.error, /Private diagnostic|synthetic-github-token/);
      assert.equal(writes, 1, '실패한 쓰기를 자동으로 반복하지 않습니다.');
      assert.equal((await call(auth, '/session', session)).status, 200);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('관리자 진입 경로와 API 경로를 분리하고 공개 자산으로 인증을 우회하지 않는다', async () => {
  const paths = [];
  const env = {
    ASSETS: {
      fetch: async (request) => {
        paths.push(new URL(request.url).pathname);
        return new Response('admin page');
      },
    },
    ADMIN_STATE: {
      idFromName: () => 'administrator',
      get: () => ({ fetch: async () => new Response('unauthorized', { status: 401 }) }),
    },
  };
  const redirect = await worker.fetch(new Request(origin + '/'), env);
  assert.equal(redirect.headers.get('Location'), origin + '/admin/');
  assert.equal((await worker.fetch(new Request(origin + '/admin/'), env)).status, 200);
  assert.deepEqual(paths, ['/admin/index.html']);
  assert.equal((await worker.fetch(new Request(origin + '/api/admin/portfolio'), env)).status, 401);
  assert.equal(paths.length, 1);
});

test('보안 설정과 기록은 세션 인증을 요구하며 쓰기에 CSRF·revision을 검증한다', async () => {
  const { auth, data } = setup();
  assert.equal((await call(auth, '/security')).status, 401);
  assert.equal((await call(auth, '/security/revoke', { method: 'POST', body: {} })).status, 401);
  const session = await login(auth);
  const snapshot = await (await call(auth, '/security', session)).json();
  assert.equal(snapshot.settings.sessionMinutes, 120);
  assert.equal(snapshot.activeSessions, 1);
  const body = {
    revision: snapshot.revision,
    settings: { ...snapshot.settings, loginAttempts: 3 },
  };
  assert.equal(
    (await call(auth, '/security', { cookie: session.cookie, method: 'PUT', body })).status,
    403,
  );
  assert.equal(data.get('security-settings'), undefined);
  assert.equal((await call(auth, '/security', { ...session, method: 'PUT', body })).status, 200);
  assert.equal((await call(auth, '/security', { ...session, method: 'PUT', body })).status, 409);
  assert.equal(data.get('security-settings').settings.loginAttempts, 3);
  for (const settings of [
    { ...body.settings, loginAttempts: 999 },
    { ...body.settings, loginAttempts: '3' },
    { ...body.settings, sessionMinutes: 30, idleMinutes: 60 },
    { ...body.settings, disableCsrf: true },
    { ...body.settings, retentionDays: -1 },
  ]) {
    assert.equal(
      (
        await call(auth, '/security', {
          ...session,
          method: 'PUT',
          body: { revision: 1, settings },
        })
      ).status,
      400,
    );
  }
  const after = await (await call(auth, '/security', session)).json();
  assert.equal(after.revision, 1);
  assert.ok(after.events.some((event) => event.kind === 'settings_changed'));
  assert.equal(after.events.filter((event) => event.kind === 'settings_changed').length, 1);
  const text = JSON.stringify(after);
  for (const secret of [
    testPassword,
    hash,
    'synthetic-github-token',
    session.csrf,
    session.cookie,
  ]) {
    assert.ok(!text.includes(secret));
  }
});

test('설정한 로그인 제한·세션 시간과 다른 로그인 종료가 실제 인증에 적용된다', async () => {
  const { auth, data } = setup();
  const session = await login(auth);
  const second = await login(auth);
  const snapshot = await (await call(auth, '/security', session)).json();
  const settings = {
    ...snapshot.settings,
    loginAttempts: 3,
    loginWindowMinutes: 5,
    sessionMinutes: 30,
    idleMinutes: 5,
  };
  assert.equal(
    (await call(auth, '/security', { ...session, method: 'PUT', body: { revision: 0, settings } }))
      .status,
    200,
  );
  const revoked = await call(auth, '/security/revoke', { ...session, method: 'POST', body: {} });
  assert.deepEqual(await revoked.json(), { revoked: 1 });
  assert.equal((await call(auth, '/session', second)).status, 401);
  assert.equal((await call(auth, '/session', session)).status, 200);
  const body = { username: 'synthetic-admin', password: 'synthetic-wrong-password' };
  assert.equal((await call(auth, '/login', { method: 'POST', body })).status, 401);
  const limited = await call(auth, '/login', { method: 'POST', body });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) <= 300);
  assert.match((await limited.json()).error, /5분/);
  const bucket = data.get('login-attempts');
  bucket.start -= 301000;
  const renewed = await call(auth, '/login', {
    method: 'POST',
    body: { username: 'synthetic-admin', password: testPassword },
  });
  assert.equal(renewed.status, 200);
  assert.match(renewed.headers.get('Set-Cookie'), /Max-Age=1800/);
  const sessions = data.get('sessions');
  for (const value of Object.values(sessions)) {
    value.lastSeen = Date.now() - 301000;
  }
  assert.equal((await call(auth, '/session', session)).status, 401);
  assert.equal(
    (await call(auth, '/session', { cookie: renewed.headers.get('Set-Cookie') })).status,
    401,
  );
});

test('접속·인증 결과를 기록하되 IP·입력값·URL 쿼리·원문 헤더는 저장하지 않는다', async () => {
  const { auth, data } = setup();
  const headers = {
    'CF-Connecting-IP': '192.0.2.123',
    'CF-IPCountry': 'KR',
    'User-Agent': 'Chrome/123 synthetic-private-agent',
  };
  assert.equal(
    (
      await auth.fetch(
        new Request(origin + '/admin/posts.html?secret=synthetic-private-query', { headers }),
      )
    ).status,
    200,
  );
  assert.equal((await call(auth, '/session')).status, 401);
  assert.equal(
    data.get('security-events').length,
    1,
    '최초 세션 조회는 로그인 실패로 집계하지 않음',
  );
  assert.equal(
    (
      await call(auth, '/login', {
        method: 'POST',
        body: { username: 'synthetic-private-user', password: 'synthetic-private-password' },
        headers,
      })
    ).status,
    401,
  );
  await call(auth, '/login', {
    method: 'POST',
    body: { username: 'bad', password: 'bad' },
    headers: { ...headers, 'CF-Connecting-IP': '2001:db8:abcd:1234:1234:5678:abcd:1234' },
  });
  const session = await login(auth);
  const snapshot = await (await call(auth, '/security', session)).json();
  assert.ok(
    snapshot.events.some(
      (event) => event.ip === '192.0.2.*' && event.country === 'KR' && event.browser === 'Chrome',
    ),
  );
  assert.ok(snapshot.events.some((event) => event.ip === '2001:db8:…'));
  assert.ok(snapshot.events.some((event) => event.kind === 'login_success'));
  assert.equal(snapshot.events.filter((event) => event.kind === 'login_failure').length, 2);
  assert.equal((await call(auth, '/logout', { ...session, method: 'POST', body: {} })).status, 200);
  assert.equal(data.get('security-events').at(-1).kind, 'logout');
  const stored = JSON.stringify(data.get('security-events'));
  assert.doesNotMatch(
    stored,
    /192\.0\.2\.123|abcd:1234|synthetic-private|synthetic-password|Cookie|csrf/,
  );
});

test('기존 로그인에 시간 제한을 적용해도 만료 시각이 반복해서 줄거나 만료 세션이 되살아나지 않는다', async () => {
  const { auth, data } = setup();
  const session = await login(auth);
  const stored = Object.values(data.get('sessions'))[0];
  delete stored.issuedAt;
  const snapshot = await (await call(auth, '/security', session)).json();
  const settings = { ...snapshot.settings, sessionMinutes: 30 };
  assert.equal(
    (await call(auth, '/security', { ...session, method: 'PUT', body: { revision: 0, settings } }))
      .status,
    200,
  );
  const first = await (await call(auth, '/session', session)).json();
  const second = await (await call(auth, '/session', session)).json();
  assert.equal(first.expires, second.expires);
  const shortened = Object.values(data.get('sessions'))[0];
  shortened.issuedAt -= 31 * 60000;
  shortened.lastSeen = Date.now();
  assert.equal((await call(auth, '/session', session)).status, 401);
});

test('보안 기록은 최대 건수·보관 기간을 지키고 접근 없이도 알람으로 정리된다', async () => {
  const { auth, data } = setup();
  const now = Date.now();
  data.set(
    'security-events',
    Array.from({ length: 510 }, (_, i) => ({ time: now - 1000 - i, kind: 'page_access' })),
  );
  await auth.fetch(new Request(origin + '/admin/'));
  assert.equal(data.get('security-events').length, 500);
  assert.ok(data.get('alarm') > now);
  data.set('security-events', [
    { time: now - 31 * 86400000 },
    { time: now - 8 * 86400000 },
    { time: now },
  ]);
  await auth.alarm();
  assert.equal(data.get('security-events').length, 2);
  const session = await login(auth);
  const snapshot = await (await call(auth, '/security', session)).json();
  await call(auth, '/security', {
    ...session,
    method: 'PUT',
    body: { revision: 0, settings: { ...snapshot.settings, retentionDays: 7 } },
  });
  assert.ok(data.get('security-events').every((event) => event.time > now - 7 * 86400000));
  data.set('security-events', [{ time: now - 91 * 86400000 }]);
  data.delete('alarm');
  await auth.alarm();
  assert.deepEqual(data.get('security-events'), []);
  assert.equal(data.get('alarm'), undefined);
});

test('관리자 HTML의 서버 접속 기록과 API 공개 차단을 연결한다', async () => {
  const { auth, env, data } = setup();
  const assets = [];
  const deployed = {
    ...env,
    ASSETS: {
      fetch: async (request) => {
        assets.push(new URL(request.url).pathname);
        return new Response('synthetic admin');
      },
    },
    ADMIN_STATE: { idFromName: () => 'administrator', get: () => auth },
  };
  for (const path of ['/admin', '/admin/', '/admin/index.html', '/admin/posts.html']) {
    assert.equal((await worker.fetch(new Request(origin + path), deployed)).status, 200);
  }
  assert.equal(
    data.get('security-events').filter((event) => event.kind === 'page_access').length,
    4,
  );
  assert.equal(
    (await worker.fetch(new Request(origin + '/api/admin/security'), deployed)).status,
    401,
  );
  assert.equal(assets.length, 4);
  const configuration = JSON.parse(
    fs.readFileSync(new URL('../server/admin-auth/wrangler.json', import.meta.url)),
  );
  assert.ok(configuration.assets.run_worker_first.includes('/admin/*'));
});
