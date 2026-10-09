import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import worker, { AdminState } from '../server/admin-auth/worker.js';
import { hashPassword } from '../server/admin-auth/password.js';

const origin = 'https://portfolio.example';
const testPassword = 'synthetic-password-for-tests';
const hash = hashPassword(testPassword);

function setup() {
  const data = new Map();
  const storage = {
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
  assert.equal(limited.headers.get('Retry-After'), '900');
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
  const oldFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async (url, options) => {
    called++;
    assert.equal(
      url,
      'https://api.github.com/repos/leedidc/Personal-Profile/contents/data/portfolio.json',
    );
    assert.equal(options.headers.Authorization, 'Bearer synthetic-github-token');
    const body = JSON.parse(options.body);
    assert.equal(body.sha, 'a'.repeat(40));
    assert.equal(body.branch, 'main');
    const content = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    assert.notEqual(content.certifications[0].maskedNumber, 'SYNTHETIC-98765');
    assert.deepEqual(content.skillCategories, portfolio.skillCategories);
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
