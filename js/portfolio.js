(() => {
  'use strict';
  const root = document.getElementById('portfolio');

  function updatePageProfile(profile) {
    const { getSafeUrl } = Portfolio;
    Portfolio.renderProfile(document.getElementById('profile'), profile);
    document.querySelector('.brand > span:last-child').textContent = profile.name;
    document.querySelector('.brand-mark').textContent = profile.englishName.trim()
      ? profile.englishName
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : profile.name.slice(0, 1);
    document.querySelector('.site-footer > span').textContent = profile.name;
    document.title = profile.name + ' | 포트폴리오';
    document.querySelector('meta[name="description"]').content =
      profile.introduction || profile.name + '의 포트폴리오';
    const github = document.querySelector('.header-github');
    github.hidden = !getSafeUrl(profile.github);
    if (!github.hidden) {
      github.href = getSafeUrl(profile.github);
    }
  }

  async function load() {
    try {
      const response = await fetch('data/portfolio.json', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error();
      }
      const data = Portfolio.validatePortfolio(await response.json());
      updatePageProfile(data.profile);
      Portfolio.renderPortfolio(root, data);
      PortfolioNavigation.initialize(data);
      window.PortfolioChatbot?.initialize(data);
      window.PortfolioEffects?.initialize();
      if (location.hash) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
      }
    } catch (_) {
      root.replaceChildren(
        Portfolio.createElement('p', 'load-message', '내용을 불러오지 못했습니다.'),
      );
      const retry = Portfolio.createElement('button', 'button', '다시 불러오기');
      retry.type = 'button';
      retry.addEventListener('click', load);
      root.append(retry);
    }
  }
  load();
})();
