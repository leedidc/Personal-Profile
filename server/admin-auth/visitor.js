import { isIP } from 'node:net';

export function handleVisitor(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Cache-Control': 'private, no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    Vary: 'Origin',
  };
  if (origin && origin !== env.PUBLIC_ORIGIN) {
    return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers });
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'GET 요청만 허용합니다.' },
      { status: 405, headers: { ...headers, Allow: 'GET' } },
    );
  }

  // 접속자 자신의 Cloudflare 정보만 반환하며 세션·저장소에는 접근하지 않습니다.
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const country = request.cf?.country;
  return Response.json(
    {
      ip: isIP(ip) ? ip : null,
      country:
        typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX'
          ? country
          : null,
    },
    { headers },
  );
}
