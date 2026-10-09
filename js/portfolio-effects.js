(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let initialized = false;

  function initializeNetwork() {
    const overview = document.querySelector('#profile .profile-overview');
    const template = document.getElementById('network-visual-template');
    if (!overview || !template) {
      return;
    }
    const visual = template.content.firstElementChild.cloneNode(true);
    overview.classList.add('has-network-visual');
    overview.append(visual);
    const toggle = visual.querySelector('.network-motion-toggle');
    let paused = false;
    let visible = false;

    function updateMotion() {
      const enabled = !paused && !reducedMotion.matches;
      visual.classList.toggle('is-animating', enabled && visible && !document.hidden);
      toggle.disabled = reducedMotion.matches;
      toggle.textContent = reducedMotion.matches ? '모션 꺼짐' : paused ? '모션 재생' : '모션 정지';
      toggle.setAttribute('aria-label', '네트워크 ' + toggle.textContent);
    }
    toggle.addEventListener('click', () => {
      paused = !paused;
      updateMotion();
    });
    reducedMotion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateMotion);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      updateMotion();
    });
    observer.observe(visual);
    updateMotion();
  }

  function initializeSectionMotion() {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          // 기본 상태는 항상 보이며 화면에 들어온 순간에만 짧게 움직입니다.
          if (!reducedMotion.matches) {
            entry.target.classList.add('section-arrived');
          }
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: '0px 0px -24px 0px' },
    );
    document.querySelectorAll('#portfolio .resume-section').forEach((section) => {
      observer.observe(section);
    });
  }

  function initializeReadingProgress() {
    const bar = document.getElementById('reading-progress');
    let frame = null;
    function update() {
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
      bar.style.transform = 'scaleX(' + progress + ')';
      frame = null;
    }
    function scheduleUpdate() {
      if (frame === null) {
        frame = requestAnimationFrame(update);
      }
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    new ResizeObserver(scheduleUpdate).observe(document.body);
    update();
  }

  function initialize() {
    if (initialized) {
      return;
    }
    initialized = true;
    initializeNetwork();
    initializeSectionMotion();
    initializeReadingProgress();
  }
  window.PortfolioEffects = { initialize };
})();
