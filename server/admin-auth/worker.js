import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { verifyPassword } from './password.js';
import { handleContent, RequestError, requireValue } from './content.js';

const cookieName = '__Host-portfolio-admin';
const sessionLifetime = 2 * 60 * 60 * 1000;
const idleLifetime = 30 * 60 * 1000;
const loginWindow = 15 * 60 * 1000;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('hex');

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      ...extraHeaders,
    },
  });
}

function sessionCookie(token = '', lifetime = sessionLifetime / 1000) {
  return `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${lifetime}`;
}

function readSessionToken(request) {
  const cookies = (request.headers.get('Cookie') || '').split(';').map((value) => value.trim());
  const matches = cookies.filter((value) => value.startsWith(cookieName + '='));
  if (matches.length !== 1) {
    return '';
  }
  const token = matches[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

async function readBody(request, limit) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    throw new RequestError(415, 'JSON 요청만 허용합니다.');
  }
  const reader = request.body?.getReader();
  requireValue(Boolean(reader));
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new RequestError(413, '요청 내용이 너무 큽니다.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    requireValue(body && typeof body === 'object' && !Array.isArray(body));
    return body;
  } catch {
    throw new RequestError(400, '요청 내용을 확인해 주세요.');
  }
}

export class AdminState {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
  }

  async takeLoginAttempt(request) {
    const now = Date.now();
    const ipKey = digest(request.headers.get('CF-Connecting-IP') || 'unknown');
    await this.storage.transaction(async (transaction) => {
      let bucket = await transaction.get('login-attempts');
      if (!bucket || now - bucket.start >= loginWindow) {
        bucket = { start: now, total: 0, addresses: {} };
      }
      if (bucket.total >= 50 || (bucket.addresses[ipKey] || 0) >= 5) {
        throw new RequestError(429, '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.');
      }
      bucket.total += 1;
      bucket.addresses[ipKey] = (bucket.addresses[ipKey] || 0) + 1;
      await transaction.put('login-attempts', bucket);
    });
  }

  currentSessions(sessions = {}) {
    const now = Date.now();
    const version = digest(this.env.ADMIN_USERNAME + this.env.ADMIN_PASSWORD_HASH);
    return Object.fromEntries(
      Object.entries(sessions).filter(
        ([, session]) =>
          session.expires > now &&
          now - session.lastSeen < idleLifetime &&
          session.version === version,
      ),
    );
  }

  async login(request, body) {
    await this.takeLoginAttempt(request);
    requireValue(
      typeof body.username === 'string' &&
        body.username.length <= 64 &&
        typeof body.password === 'string' &&
        body.password.length > 0 &&
        body.password.length <= 128,
    );
    const passwordMatches = verifyPassword(body.password, this.env.ADMIN_PASSWORD_HASH);
    if (!passwordMatches || body.username !== this.env.ADMIN_USERNAME) {
      throw new RequestError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    const token = randomToken();
    const csrf = randomToken();
    const now = Date.now();
    const session = {
      csrf,
      expires: now + sessionLifetime,
      lastSeen: now,
      version: digest(this.env.ADMIN_USERNAME + this.env.ADMIN_PASSWORD_HASH),
      requests: { start: now, count: 0 },
    };
    await this.storage.transaction(async (transaction) => {
      const sessions = this.currentSessions(await transaction.get('sessions'));
      const previousToken = readSessionToken(request);
      if (previousToken) {
        delete sessions[digest(previousToken)];
      }
      const keys = Object.keys(sessions);
      if (keys.length >= 8) {
        delete sessions[keys[0]];
      }
      sessions[digest(token)] = session;
      await transaction.put('sessions', sessions);
    });
    return json({ csrf, expires: session.expires }, 200, { 'Set-Cookie': sessionCookie(token) });
  }

  async authorize(request, path) {
    const token = readSessionToken(request);
    if (!token) {
      throw new RequestError(401, '다시 로그인해 주세요. 편집 내용은 유지됩니다.');
    }
    return this.storage.transaction(async (transaction) => {
      const sessions = this.currentSessions(await transaction.get('sessions'));
      const session = sessions[digest(token)];
      if (!session) {
        throw new RequestError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
      }
      if (request.method !== 'GET') {
        const csrf = request.headers.get('X-CSRF-Token') || '';
        if (
          !/^[a-f0-9]{64}$/.test(csrf) ||
          !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))
        ) {
          throw new RequestError(403, '요청을 확인할 수 없습니다. 다시 로그인해 주세요.');
        }
      }
      const now = Date.now();
      if (now - session.requests.start >= 60000) {
        session.requests = { start: now, count: 0 };
      }
      if (++session.requests.count > 60) {
        throw new RequestError(429, '요청이 많습니다. 잠시 후 다시 시도해 주세요.');
      }
      session.lastSeen = now;
      if (path === '/logout') {
        delete sessions[digest(token)];
      }
      await transaction.put('sessions', sessions);
      return session;
    });
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');
      if (
        url.origin !== this.env.SITE_ORIGIN ||
        url.protocol !== 'https:' ||
        (origin && origin !== this.env.SITE_ORIGIN) ||
        (request.method !== 'GET' && origin !== this.env.SITE_ORIGIN) ||
        request.headers.get('Sec-Fetch-Site') === 'cross-site'
      ) {
        throw new RequestError(403, '허용되지 않은 요청입니다.');
      }
      if (!this.env.ADMIN_PASSWORD_HASH || !this.env.GITHUB_TOKEN || !this.env.ADMIN_USERNAME) {
        throw new RequestError(
          503,
          '비밀번호 로그인 서버 설정이 필요합니다. GitHub 토큰 로그인을 이용해 주세요.',
        );
      }
      const path = url.pathname.slice('/api/admin'.length);
      const allowed = {
        '/status': 'GET',
        '/login': 'POST',
        '/session': 'GET',
        '/logout': 'POST',
        '/portfolio': 'GET PUT',
        '/posts/snapshot': 'GET',
        '/posts/read': 'POST',
        '/posts/save': 'POST',
      };
      if (
        !url.pathname.startsWith('/api/admin/') ||
        url.search ||
        !Object.hasOwn(allowed, path) ||
        !allowed[path].split(' ').includes(request.method)
      ) {
        throw new RequestError(404, '요청한 관리 기능이 없습니다.');
      }
      if (path === '/status') {
        return json({ passwordLogin: true });
      }
      if (path === '/login') {
        return await this.login(request, await readBody(request, 2048));
      }
      const session = await this.authorize(request, path);
      if (path === '/session') {
        return json({ csrf: session.csrf, expires: session.expires });
      }
      if (path === '/logout') {
        return json({ loggedOut: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
      }
      const body = request.method === 'GET' ? null : await readBody(request, 6 * 1024 * 1024);
      return json(await handleContent(path, request.method, body, this.env.GITHUB_TOKEN));
    } catch (error) {
      if (error instanceof RequestError) {
        return json(
          { error: error.message },
          error.status,
          error.status === 429 ? { 'Retry-After': '900' } : {},
        );
      }
      if ([409, 422].includes(error.status)) {
        return json(
          {
            error:
              '다른 변경사항 또는 저장소 보호 규칙으로 저장하지 못했습니다. 편집 내용을 보관하고 최신 내용을 확인해 주세요.',
          },
          409,
        );
      }
      return json(
        { error: '관리 서버가 요청을 처리하지 못했습니다. 편집 내용은 유지됩니다.' },
        503,
      );
    }
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (url.pathname === '/') {
        return Response.redirect(url.origin + '/admin/', 302);
      }
      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        url.pathname = '/admin/index.html';
        return env.ASSETS.fetch(new Request(url, request));
      }
      return env.ASSETS.fetch(request);
    }
    const id = env.ADMIN_STATE.idFromName('administrator');
    return env.ADMIN_STATE.get(id).fetch(request);
  },
};
