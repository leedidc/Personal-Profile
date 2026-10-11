(() => {
  'use strict';
  const dataUrl = new URL('../data/portfolio.json', document.currentScript.src);
  let request;
  let settings = null;

  function loadPortfolio() {
    if (!request) {
      request = fetch(dataUrl, { cache: 'no-cache', signal: AbortSignal.timeout(6000) })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('사이트 설정을 불러오지 못했습니다.');
          }
          const data = await response.json();
          if (!data || data.version !== 1) {
            throw new Error('사이트 설정 형식을 확인해 주세요.');
          }
          settings = data;
          return data;
        })
        .catch((error) => {
          request = null;
          throw error;
        });
    }
    return request;
  }

  function enabled(key) {
    return settings?.siteFeatures?.[key] !== false;
  }

  function applyNavigation() {
    document.documentElement.classList.toggle('site-motion-disabled', !enabled('motion'));
    for (const link of document.querySelectorAll('nav a')) {
      const path = new URL(link.href).pathname;
      if (/\/posts\/(?:index\.html)?$/.test(path)) {
        link.hidden = !enabled('posts');
      } else if (/\/resources\/(?:index\.html)?$/.test(path)) {
        link.hidden = !enabled('resources');
      }
    }
  }

  function closePage(title) {
    const main = document.querySelector('main');
    const heading = document.createElement('h1');
    heading.textContent = title;
    const message = document.createElement('p');
    message.textContent = '현재 운영하지 않는 페이지입니다.';
    const link = document.createElement('a');
    link.href = '../';
    link.textContent = '포트폴리오로 돌아가기';
    link.className = 'button';
    main.classList.add('inactive-page');
    main.replaceChildren(heading, message, link);
    document.title = title + ' | 포트폴리오';
  }

  const ready = loadPortfolio().catch(() => null);
  ready.then(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyNavigation, { once: true });
    } else {
      applyNavigation();
    }
  });
  window.SiteFeatures = { ready, enabled, loadPortfolio, closePage };
})();
