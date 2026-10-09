(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let initialized = false;

  function initializeNetworkTilt(visual) {
    const art = visual.querySelector('.network-art');
    let frame = null;
    let pointerPosition = null;

    function resetTilt() {
      cancelAnimationFrame(frame);
      frame = null;
      pointerPosition = null;
      art.style.removeProperty('--network-tilt-x');
      art.style.removeProperty('--network-tilt-y');
    }

    function updateTilt() {
      frame = null;
      const bounds = visual.getBoundingClientRect();
      const horizontal = (pointerPosition.x - bounds.left) / bounds.width - 0.5;
      const vertical = (pointerPosition.y - bounds.top) / bounds.height - 0.5;
      art.style.setProperty('--network-tilt-x', -vertical * 7 + 'deg');
      art.style.setProperty('--network-tilt-y', horizontal * 7 + 'deg');
    }

    visual.addEventListener('pointermove', (event) => {
      if (
        event.pointerType !== 'mouse' ||
        !finePointer.matches ||
        reducedMotion.matches ||
        !visual.classList.contains('is-animating')
      ) {
        return;
      }
      pointerPosition = { x: event.clientX, y: event.clientY };
      if (frame === null) {
        frame = requestAnimationFrame(updateTilt);
      }
    });
    visual.addEventListener('pointerleave', resetTilt);
    visual.addEventListener('pointercancel', resetTilt);
    finePointer.addEventListener('change', resetTilt);
    return resetTilt;
  }

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
    const resetTilt = initializeNetworkTilt(visual);
    let paused = false;
    let visible = false;

    function updateMotion() {
      const enabled = !paused && !reducedMotion.matches;
      const animating = enabled && visible && !document.hidden;
      visual.classList.toggle('is-animating', animating);
      if (!animating) {
        resetTilt();
      }
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

  function initializeNavigationIndicator() {
    const nav = document.querySelector('.portfolio-header nav');
    if (!nav) {
      return;
    }
    const indicator = document.createElement('span');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.hidden = true;
    nav.append(indicator);
    nav.classList.add('has-moving-indicator');
    let frame = null;

    function updateIndicator() {
      frame = null;
      const active = nav.querySelector('a[aria-current]:not([hidden])');
      indicator.hidden = !active;
      if (!active) {
        return;
      }
      const bounds = active.getBoundingClientRect();
      const offset = bounds.left - nav.getBoundingClientRect().left + nav.scrollLeft;
      indicator.style.width = bounds.width + 'px';
      indicator.style.transform = 'translateX(' + offset + 'px)';
    }

    function scheduleUpdate() {
      if (frame === null) {
        frame = requestAnimationFrame(updateIndicator);
      }
    }

    // 현재 메뉴의 접근성 표시는 기존 스크롤 추적을 그대로 따릅니다.
    new MutationObserver(scheduleUpdate).observe(nav, {
      attributes: true,
      attributeFilter: ['aria-current'],
      subtree: true,
    });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(nav);
    nav.querySelectorAll('a').forEach((link) => resizeObserver.observe(link));
    updateIndicator();
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
    initializeNavigationIndicator();
    initializeSectionMotion();
    initializeReadingProgress();
  }
  window.PortfolioEffects = { initialize };
})();
