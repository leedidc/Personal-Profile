(() => {
  'use strict';
  const dialog = document.getElementById('security-dialog');
  if (!dialog) {
    return;
  }
  const card = document.querySelector('.security-card');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const secure = location.protocol === 'https:' && window.isSecureContext;
  let visible = false;
  let selectedStep = 0;
  let connection = null;
  let connectionRequested = false;
  const steps = [
    {
      label: '01 · BROWSER & DNS',
      title: '먼저, 목적지를 확인합니다',
      description:
        '브라우저는 주소의 프로토콜과 도메인을 읽고 접속할 서버를 찾습니다. DNS는 이름을 접속 주소로 연결하고, TLS는 그 상대를 인증하는 역할을 맡습니다.',
      actions: [
        'https:// 주소로 보안 연결을 요청합니다.',
        '필요하면 DNS로 도메인에 해당하는 주소를 조회합니다. 캐시가 있으면 조회를 생략할 수 있습니다.',
        '이 사이트는 Cloudflare를 통해 페이지를 제공합니다.',
      ],
      observation: () =>
        '현재 페이지: ' +
        location.hostname +
        (secure
          ? ' · HTTPS로 접속했습니다.'
          : ' · HTTPS 연결이 아닌 미리보기 또는 HTTP 환경입니다.'),
    },
    {
      label: '02 · TLS HANDSHAKE',
      title: '상대를 확인하고, 내용을 암호화합니다',
      description:
        'TLS는 통신 상대의 인증, 전송 내용의 기밀성, 변조 탐지를 제공합니다. 아래 순서는 연결 원리를 요약한 것으로, 세션 재개나 프로토콜 버전에 따라 실제 메시지는 달라집니다.',
      actions: [
        '브라우저가 인증서의 신뢰 체인, 유효 기간, 접속 도메인 일치 여부 등을 검증합니다.',
        '양쪽이 암호 방식에 합의하고 키 교환으로 통신용 키를 도출합니다.',
        '암호화된 데이터와 인증 태그로 내용을 보호하고 전송 중 변조를 탐지합니다.',
      ],
      observation: () =>
        connection?.tls
          ? '방금 확인한 정보 API ↔ Cloudflare 연결: ' +
            connection.tls.replace('TLSv', 'TLS ') +
            (connection.protocol ? ' · ' + connection.protocol : '') +
            '. 현재 문서의 TLS 버전·인증서는 브라우저의 연결 정보에서 확인할 수 있습니다.'
          : '현재 문서의 TLS 버전과 인증서는 브라우저의 연결 정보에서 확인할 수 있습니다. 페이지 JavaScript는 인증서 검증 과정을 직접 관찰하지 않습니다.',
    },
    {
      label: '03 · CLOUDFLARE EDGE',
      title: 'Cloudflare가 요청을 받아 전달합니다',
      description:
        '공개 페이지는 Cloudflare Pages에서 제공됩니다. 브라우저의 HTTPS 연결은 Cloudflare에서 처리되고, 정적 파일과 별도 API 요청이 각 서비스로 전달됩니다.',
      actions: [
        'HTML·CSS·JavaScript와 이미지 등 페이지 파일을 내려줍니다.',
        '방문 통계와 관리자 기능은 별도 Cloudflare Worker가 처리합니다.',
        '관리자 API는 로그인 세션과 요청 출처를 검사하고, 저장 요청에는 CSRF 검증을 적용합니다.',
      ],
      observation: () =>
        '페이지 전달과 API 처리는 서로 다른 요청입니다. 이 흐름도는 특정 WAF 규칙의 차단 여부나 실제 네트워크 중계 경로를 측정하지 않습니다.',
    },
    {
      label: '04 · CONTENT & PRIVACY',
      title: '검증된 형식으로 화면에 표시합니다',
      description:
        '수신한 콘텐츠를 화면에 표시할 때도 입력 형식과 링크를 검증합니다. 국가별 방문 지도는 개별 접속 위치 대신 집계된 수치만 사용합니다.',
      actions: [
        '이력과 사용자 입력은 텍스트로 표시하고, 게시글은 허용된 Delta 서식으로 렌더링합니다.',
        '스크립트 URL이나 허용되지 않은 이미지 형식은 콘텐츠 검증에서 거부합니다.',
        '방문 통계 저장소에는 날짜별 국가 코드와 횟수만 남깁니다. IP·도시·개별 좌표는 전달하지 않습니다.',
      ],
      observation: () =>
        '상단의 내 IP 정보는 접속자 자신에게만 반환됩니다. 세계 지도에서 보이는 점은 해당 국가의 대표 위치입니다.',
    },
  ];

  function renderStep(index) {
    selectedStep = index;
    const step = steps[index];
    document.getElementById('security-step-label').textContent = step.label;
    document.getElementById('security-step-title').textContent = step.title;
    document.getElementById('security-step-description').textContent = step.description;
    document.getElementById('security-step-observation').textContent = step.observation();
    const actions = step.actions.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    });
    document.getElementById('security-step-actions').replaceChildren(...actions);
    dialog.querySelectorAll('[data-security-step]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.securityStep) === index));
    });
  }

  async function loadConnection() {
    if (connectionRequested) {
      return;
    }
    connectionRequested = true;
    try {
      const response = await fetch(PortfolioConfig.visitor.connectionEndpoint, {
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(PortfolioConfig.visitor.requestTimeoutMs),
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      connection = {
        tls: ['TLSv1.2', 'TLSv1.3'].includes(data?.tls) ? data.tls : null,
        protocol: ['HTTP/1.1', 'HTTP/2', 'HTTP/3'].includes(data?.protocol) ? data.protocol : null,
      };
      renderStep(selectedStep);
    } catch {
      connectionRequested = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-security], [data-security-step]');
    if (!button) {
      return;
    }
    const index = Number(button.dataset.securityStep ?? 1);
    if (!Number.isInteger(index) || !steps[index]) {
      return;
    }
    renderStep(index);
    if (!dialog.open) {
      dialog.showModal();
    }
    loadConnection();
  });
  document.getElementById('security-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    ) {
      dialog.close();
    }
  });

  function updateMotion() {
    card.classList.toggle('is-animating', visible && !document.hidden && !reducedMotion.matches);
  }
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    updateMotion();
  }).observe(card);
  reducedMotion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);

  function showPageConnection() {
    const protocol = performance.getEntriesByType('navigation')[0]?.nextHopProtocol;
    const names = { h2: 'HTTP/2', h3: 'HTTP/3', 'http/1.1': 'HTTP/1.1' };
    document.getElementById('connection-https').textContent = secure
      ? 'HTTPS 연결'
      : 'HTTPS가 아닌 환경';
    document.getElementById('connection-protocol').textContent = Object.hasOwn(names, protocol)
      ? names[protocol]
      : 'HTTP 버전 확인 불가';
  }
  showPageConnection();
  window.addEventListener('load', showPageConnection, { once: true });
})();
