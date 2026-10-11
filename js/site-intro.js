(async () => {
  'use strict';
  const intro = document.getElementById('site-intro');
  if (!intro) {
    return;
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const durationMs = 2400;
  if (
    reducedMotion.matches ||
    document.hidden ||
    location.hash ||
    performance.getEntriesByType('navigation')[0]?.type === 'back_forward' ||
    getComputedStyle(intro).getPropertyValue('--intro-ready').trim() !== '1'
  ) {
    intro.remove();
    return;
  }

  let finished = false;
  let timeout;

  function finish() {
    if (finished) {
      return;
    }
    finished = true;
    clearTimeout(timeout);
    document.documentElement.classList.remove('intro-pending');
    document.documentElement.classList.remove('intro-playing');
    if (intro.open) {
      intro.close();
    }
    intro.remove();
    reducedMotion.removeEventListener('change', onMotionChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', finish);
  }

  function onMotionChange() {
    if (reducedMotion.matches) {
      finish();
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      finish();
    }
  }

  document.getElementById('site-intro-skip').addEventListener('click', finish);
  intro.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish();
  });
  intro.addEventListener('close', finish);
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', finish);

  // 설정을 기다리는 동안 본문이 먼저 노출되지 않게 하되 느린 응답이 입장을 막지 않게 합니다.
  if (window.SiteFeatures) {
    document.documentElement.classList.add('intro-pending');
    let waiting;
    const data = await Promise.race([
      SiteFeatures.ready,
      new Promise((resolve) => {
        waiting = setTimeout(() => resolve(null), 1000);
      }),
    ]);
    clearTimeout(waiting);
    if (finished || !data || !SiteFeatures.enabled('intro') || !SiteFeatures.enabled('motion')) {
      document.documentElement.classList.remove('intro-pending');
      finish();
      return;
    }
  }
  try {
    intro.showModal();
    document.documentElement.classList.remove('intro-pending');
    document.documentElement.classList.add('intro-playing');
    timeout = setTimeout(finish, durationMs);
  } catch {
    document.documentElement.classList.remove('intro-pending');
    finish();
    return;
  }
})();
