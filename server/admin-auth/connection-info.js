export function handleConnection(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (origin && origin !== env.PUBLIC_ORIGIN) {
    return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers });
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  return Response.json(
    {
      tls: ['TLSv1.2', 'TLSv1.3'].includes(request.cf?.tlsVersion) ? request.cf.tlsVersion : null,
      protocol: ['HTTP/1.1', 'HTTP/2', 'HTTP/3'].includes(request.cf?.httpProtocol)
        ? request.cf.httpProtocol
        : null,
    },
    { headers },
  );
}
