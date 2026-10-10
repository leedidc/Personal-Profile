(() => {
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

  try {
    intro.showModal();
    document.documentElement.classList.add('intro-playing');
    timeout = setTimeout(finish, durationMs);
  } catch {
    finish();
    return;
  }
})();
