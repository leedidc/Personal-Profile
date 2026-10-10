(() => {
  'use strict';

  function initialize(data) {
    const nav = document.querySelector('.portfolio-header nav');
    nav.replaceChildren();
    for (const section of Portfolio.getSections(data)) {
      const link = Portfolio.createElement('a', '', section.title);
      link.href = '#' + section.key;
      link.hidden = Boolean(section.optional && !data[section.key]?.length);
      nav.append(link);
    }
    const posts = Portfolio.createElement('a', '', '글');
    posts.href = 'posts/';
    nav.append(posts);
    const resources = Portfolio.createElement('a', '', '자료실');
    resources.href = 'resources/';
    nav.append(resources);

    const sections = [...document.querySelectorAll('#portfolio .resume-section')];
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    let frame = null;

    function updateCurrentSection() {
      frame = null;
      const documentRoot = document.documentElement;
      const readingLine = parseFloat(getComputedStyle(documentRoot).scrollPaddingTop) || 100;
      let current = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top > readingLine + 2) {
          break;
        }
        current = section;
      }
      // 마지막 섹션이 짧아서 상단까지 스크롤되지 않는 경우도 표시합니다.
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= documentRoot.scrollHeight - 2
      ) {
        current = sections.at(-1);
      }
      for (const link of links) {
        if (current && link.hash === '#' + current.id) {
          if (!link.hasAttribute('aria-current')) {
            link.setAttribute('aria-current', 'location');
          }
        } else {
          link.removeAttribute('aria-current');
        }
      }
    }

    function scheduleUpdate() {
      if (frame === null) {
        frame = requestAnimationFrame(updateCurrentSection);
      }
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    new ResizeObserver(scheduleUpdate).observe(document.body);
    updateCurrentSection();
  }

  window.PortfolioNavigation = { initialize };
})();
