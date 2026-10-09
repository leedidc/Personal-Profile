(() => {
  'use strict';

  function open(award, trigger) {
    const { createElement, getSafeUrl, validateAwardResearch } = Portfolio;
    validateAwardResearch(award.research);
    const { title, slides, link } = award.research;
    let current = 0;
    let touchStart;
    const dialog = createElement('dialog', 'research-dialog');
    dialog.setAttribute('aria-labelledby', 'research-title');
    const header = createElement('header', 'research-header');
    const heading = createElement('div');
    const titleElement = createElement('h2', '', title);
    titleElement.id = 'research-title';
    heading.append(
      createElement('p', 'research-eyebrow', 'RESEARCH NOTES'),
      titleElement,
      createElement(
        'p',
        'research-award',
        [award.name, award.subtitle, award.period].filter(Boolean).join(' · '),
      ),
    );
    const close = createElement('button', 'research-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '연구 내용 닫기');
    close.addEventListener('click', () => dialog.close());
    header.append(heading, close);

    const stage = createElement('section', 'research-slide');
    stage.tabIndex = -1;
    stage.setAttribute('aria-labelledby', 'research-slide-title');
    const number = createElement('span', 'research-slide-number');
    number.setAttribute('aria-hidden', 'true');
    const content = createElement('div', 'research-slide-content');
    const slideTitle = createElement('h3');
    slideTitle.id = 'research-slide-title';
    const body = createElement('p', 'research-slide-body');
    content.append(slideTitle, body);
    stage.append(number, content);

    const footer = createElement('footer', 'research-footer');
    const progress = createElement('p', 'research-progress');
    progress.setAttribute('role', 'status');
    const controls = createElement('div', 'research-controls');
    const previous = createElement('button', 'button', '← 이전');
    const next = createElement('button', 'button primary', '다음 →');
    previous.type = 'button';
    next.type = 'button';
    previous.setAttribute('aria-label', '이전 슬라이드');
    next.setAttribute('aria-label', '다음 슬라이드');
    previous.addEventListener('click', () => showSlide(current - 1));
    next.addEventListener('click', () => showSlide(current + 1));
    controls.append(previous, next);
    footer.append(progress, controls);
    const source = getSafeUrl(link);
    if (source) {
      const anchor = createElement('a', 'research-source', '원문 · 관련 자료 ↗');
      anchor.href = source;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      footer.prepend(anchor);
    }
    dialog.append(header, stage, footer);

    function showSlide(index) {
      current = Math.max(0, Math.min(slides.length - 1, index));
      number.textContent = String(current + 1).padStart(2, '0');
      slideTitle.textContent = slides[current].title;
      body.textContent = slides[current].body;
      progress.textContent = `${current + 1} / ${slides.length}`;
      progress.setAttribute(
        'aria-label',
        `${current + 1} / ${slides.length} — ${slides[current].title}`,
      );
      previous.disabled = current === 0;
      next.disabled = current === slides.length - 1;
      stage.scrollTop = 0;
      if (
        (document.activeElement === previous && previous.disabled) ||
        (document.activeElement === next && next.disabled)
      ) {
        stage.focus({ preventScroll: true });
      }
    }

    dialog.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showSlide(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    stage.addEventListener('pointerdown', (event) => {
      touchStart = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
    });
    stage.addEventListener('pointerup', (event) => {
      if (!touchStart) {
        return;
      }
      const horizontal = event.clientX - touchStart.x;
      const vertical = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(horizontal) > 50 && Math.abs(horizontal) > Math.abs(vertical) * 2) {
        showSlide(current + (horizontal < 0 ? 1 : -1));
      }
    });
    stage.addEventListener('pointercancel', () => {
      touchStart = null;
    });
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove();
        trigger?.focus({ preventScroll: true });
      },
      { once: true },
    );
    document.body.append(dialog);
    showSlide(0);
    dialog.showModal();
    close.focus();
  }

  window.AwardResearch = { open };
})();
