import { isIP } from 'node:net';
import { RequestError, requireValue } from './content.js';

export const defaultSecuritySettings = Object.freeze({
  sessionMinutes: 120,
  idleMinutes: 30,
  loginAttempts: 5,
  loginWindowMinutes: 15,
  retentionDays: 30,
});
const choices = {
  sessionMinutes: [30, 60, 120, 240, 480],
  idleMinutes: [5, 15, 30, 60],
  loginAttempts: [3, 5, 10],
  loginWindowMinutes: [5, 15, 30, 60],
  retentionDays: [7, 30, 90],
};
const day = 86400000;
const maxEvents = 500;
const adminPages = new Set(['/admin', '/admin/', '/admin/index.html', '/admin/posts.html']);
const auditPaths = new Set([
  ...adminPages,
  '/api/admin/login',
  '/api/admin/logout',
  '/api/admin/session',
  '/api/admin/portfolio',
  '/api/admin/posts/save',
  '/api/admin/security',
  '/api/admin/security/revoke',
]);

export function isAdminPage(path) {
  return adminPages.has(path);
}

function maskAddress(value) {
  if (isIP(value) === 4) {
    return value.split('.').slice(0, 3).join('.') + '.*';
  }
  if (isIP(value) === 6) {
    // IPv4 혼합 표기도 원문이 남지 않도록 표준 IPv6로 변환합니다.
    const normalized = new URL('https://[' + value + ']/').hostname.slice(1, -1);
    return normalized.split(':').slice(0, 2).join(':') + ':…';
  }
  return '확인 불가';
}

function browserName(value) {
  if (/Edg\//.test(value)) {
    return 'Edge';
  }
  if (/Firefox\//.test(value)) {
    return 'Firefox';
  }
  if (/Chrome\//.test(value)) {
    return 'Chrome';
  }
  if (/Safari\//.test(value)) {
    return 'Safari';
  }
  return '기타';
}

export function auditKind(request, status) {
  const path = new URL(request.url).pathname;
  if (isAdminPage(path) && request.method === 'GET') {
    return 'page_access';
  }
  if (path === '/api/admin/login' && request.method === 'POST') {
    return status === 200 ? 'login_success' : status === 429 ? 'login_limited' : 'login_failure';
  }
  if (path === '/api/admin/logout' && status === 200) {
    return 'logout';
  }
  if (path === '/api/admin/security' && request.method === 'PUT' && status === 200) {
    return 'settings_changed';
  }
  if (path === '/api/admin/security/revoke' && status === 200) {
    return 'sessions_revoked';
  }
  if ([401, 403, 429].includes(status)) {
    // 첫 방문의 세션 확인 실패는 로그인 실패가 아닙니다.
    if (path === '/api/admin/session' && status === 401 && !request.headers.get('Cookie')) {
      return null;
    }
    return 'request_blocked';
  }
  if (
    (path === '/api/admin/portfolio' && request.method === 'PUT') ||
    (path === '/api/admin/posts/save' && request.method === 'POST')
  ) {
    return status === 200 ? 'content_saved' : 'content_failed';
  }
  return null;
}

export class AdminSecurity {
  constructor(storage) {
    this.storage = storage;
  }

  async configuration(storage = this.storage) {
    return (
      (await storage.get('security-settings')) || {
        revision: 0,
        settings: { ...defaultSecuritySettings },
      }
    );
  }

  retained(events, settings) {
    const cutoff = Date.now() - settings.retentionDays * day;
    return events.filter((event) => event.time > cutoff).slice(-maxEvents);
  }

  async record(request, kind, status) {
    const path = new URL(request.url).pathname;
    const country = request.cf?.country || request.headers.get('CF-IPCountry') || '';
    const event = {
      time: Date.now(),
      kind,
      status,
      path: auditPaths.has(path) ? path : '/api/admin/*',
      ip: maskAddress(request.headers.get('CF-Connecting-IP') || ''),
      country: /^[A-Z]{2}$/.test(country) && !['XX', 'T1'].includes(country) ? country : '',
      browser: browserName((request.headers.get('User-Agent') || '').slice(0, 512)),
    };
    await this.storage.transaction(async (transaction) => {
      const { settings } = await this.configuration(transaction);
      const events = (await transaction.get('security-events')) || [];
      events.push(event);
      await transaction.put('security-events', this.retained(events, settings));
      if (!(await transaction.getAlarm())) {
        await transaction.setAlarm(Date.now() + day);
      }
    });
  }

  async update(body) {
    requireValue(
      Number.isSafeInteger(body.revision) &&
        body.revision >= 0 &&
        body.settings &&
        typeof body.settings === 'object' &&
        !Array.isArray(body.settings),
    );
    requireValue(
      Object.keys(body.settings).length === Object.keys(choices).length &&
        Object.entries(choices).every(([key, values]) => values.includes(body.settings[key])) &&
        body.settings.idleMinutes <= body.settings.sessionMinutes,
    );
    return this.storage.transaction(async (transaction) => {
      const current = await this.configuration(transaction);
      if (body.revision !== current.revision) {
        throw new RequestError(
          409,
          '다른 곳에서 보안 설정이 변경되었습니다. 다시 불러온 후 저장해 주세요.',
        );
      }
      const next = { revision: current.revision + 1, settings: { ...body.settings } };
      await transaction.put('security-settings', next);
      const events = (await transaction.get('security-events')) || [];
      await transaction.put('security-events', this.retained(events, next.settings));
      return next;
    });
  }

  async snapshot() {
    return this.storage.transaction(async (transaction) => {
      const config = await this.configuration(transaction);
      const events = this.retained(
        (await transaction.get('security-events')) || [],
        config.settings,
      );
      return { ...config, events: events.reverse(), maxEvents };
    });
  }

  async prune() {
    await this.storage.transaction(async (transaction) => {
      const { settings } = await this.configuration(transaction);
      const events = this.retained((await transaction.get('security-events')) || [], settings);
      await transaction.put('security-events', events);
      if (events.length) {
        await transaction.setAlarm(Date.now() + day);
      }
    });
  }
}
