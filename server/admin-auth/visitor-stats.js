const dayMilliseconds = 86400000;
const retentionDays = 30;

function pruneDays(days, now) {
  const firstDay = new Date(now - (retentionDays - 1) * dayMilliseconds).toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(days).filter(([date]) => date >= firstDay));
}

export class VisitorStats {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const country = request.headers.get('X-Visitor-Country');
    const record =
      request.method === 'POST' && /^[A-Z]{2}$/.test(country || '') && country !== 'XX';
    const days = await this.storage.transaction(async (storage) => {
      const current = pruneDays((await storage.get('days')) || {}, now);
      if (record) {
        current[today] ||= {};
        current[today][country] = Math.min((current[today][country] || 0) + 1, 1000000);
        await storage.put('days', current);
      }
      return current;
    });
    if (record && !(await this.storage.getAlarm())) {
      await this.storage.setAlarm(
        Math.floor(now / dayMilliseconds) * dayMilliseconds + dayMilliseconds,
      );
    }
    const totals = {};
    for (const countries of Object.values(days)) {
      for (const [code, count] of Object.entries(countries)) {
        totals[code] = (totals[code] || 0) + count;
      }
    }
    const countries = Object.entries(totals)
      .map(([code, count]) => ({ code, count }))
      .sort((first, second) => second.count - first.count || first.code.localeCompare(second.code));
    return Response.json({
      days: retentionDays,
      total: countries.reduce((total, country) => total + country.count, 0),
      countries,
      since: Object.keys(days).sort()[0] || today,
      through: today,
    });
  }

  async alarm() {
    const now = Date.now();
    const remaining = await this.storage.transaction(async (storage) => {
      const days = pruneDays((await storage.get('days')) || {}, now);
      await storage.put('days', days);
      return Object.keys(days).length;
    });
    if (remaining) {
      await this.storage.setAlarm(
        Math.floor(now / dayMilliseconds) * dayMilliseconds + dayMilliseconds,
      );
    }
  }
}

export async function handleVisitorStats(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    Vary: 'Origin',
  };
  if (
    (origin && origin !== env.PUBLIC_ORIGIN) ||
    (request.method === 'POST' && origin !== env.PUBLIC_ORIGIN)
  ) {
    return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers });
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (!['GET', 'POST'].includes(request.method)) {
    return Response.json(
      { error: '지원하지 않는 요청입니다.' },
      { status: 405, headers: { ...headers, Allow: 'GET, POST, OPTIONS' } },
    );
  }
  try {
    // 런타임에 따라 빈 POST도 스트림으로 전달되므로 실제 바이트만 검사합니다.
    if (request.method === 'POST' && request.body) {
      const reader = request.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        if (chunk.value.byteLength > 0) {
          await reader.cancel();
          return Response.json(
            { error: '방문 통계는 입력 데이터를 받지 않습니다.' },
            { status: 400, headers },
          );
        }
      }
    }
    const country = request.cf?.country;
    const validCountry =
      typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX';
    // 저장소에는 IP·헤더·도시·좌표를 넘기지 않고 국가 코드만 전달합니다.
    const internal = new Request('https://visitor-stats/countries', {
      method: request.method === 'POST' && validCountry ? 'POST' : 'GET',
      headers: validCountry ? { 'X-Visitor-Country': country } : {},
    });
    const id = env.VISITOR_STATS.idFromName('country-totals');
    const result = await env.VISITOR_STATS.get(id).fetch(internal);
    return new Response(result.body, {
      status: result.status,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch {
    return Response.json({ error: '방문 통계를 불러오지 못했습니다.' }, { status: 503, headers });
  }
}
