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
  const steps = [
    {
      title: '브라우저에서 시작되는 연결',
      description: secure
        ? '지금 보고 있는 페이지는 HTTPS로 연결되어 있습니다. 브라우저가 사이트의 인증서를 확인하고 보안 연결을 맺습니다.'
        : '현재 페이지는 HTTPS로 연결되어 있지 않습니다. HTTPS로 접속하면 브라우저가 인증서를 확인하고 보안 연결을 맺습니다.',
    },
    {
      title: secure ? '통신 내용을 암호화합니다' : 'HTTPS는 통신 내용을 암호화합니다',
      description: secure
        ? '브라우저와 Cloudflare 사이의 통신은 TLS로 암호화됩니다. 전송 중 데이터가 변조되었는지도 확인합니다.'
        : 'HTTPS 연결에서는 TLS가 통신 내용을 암호화하고 변조를 감지합니다. 현재 페이지에는 HTTPS가 적용되어 있지 않습니다.',
    },
    {
      title: 'Cloudflare를 통해 전달합니다',
      description:
        '공개 사이트는 Cloudflare Pages에서 제공합니다. Cloudflare가 HTTPS 연결을 처리하고 페이지에 필요한 파일을 전달합니다.',
    },
    {
      title: '화면에 콘텐츠를 표시합니다',
      description:
        '브라우저가 전달받은 글과 이미지를 화면에 표시합니다. 포트폴리오와 게시글을 여기에서 둘러볼 수 있습니다.',
    },
  ];

  function renderStep(index) {
    const step = steps[index];
    document.getElementById('security-step-title').textContent = step.title;
    document.getElementById('security-step-description').textContent = step.description;
    dialog.querySelectorAll('[data-security-step]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.securityStep) === index));
    });
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
    card.classList.toggle('is-secure', secure);
    document.getElementById('connection-heading').textContent = secure
      ? '이 사이트는 보안 연결로 보호되고 있습니다.'
      : '현재 페이지는 HTTPS로 연결되지 않았습니다.';
    document.getElementById('connection-https').textContent = secure
      ? 'HTTPS 연결'
      : 'HTTPS 미적용';
    document.getElementById('connection-protections').hidden = !secure;
    const protocolLabel = document.getElementById('connection-protocol');
    protocolLabel.hidden = !Object.hasOwn(names, protocol);
    protocolLabel.textContent = Object.hasOwn(names, protocol) ? names[protocol] : '';
  }
  showPageConnection();
  window.addEventListener('load', showPageConnection, { once: true });
})();
