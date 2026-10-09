(() => {
  'use strict';
  const root = document.getElementById('portfolio');
  function renderProfile(profile) {
    const { el, safeURL } = Portfolio;
    const heading = document.getElementById('profile-name');
    heading.replaceChildren(document.createTextNode(profile.name), el('span', '', profile.englishName));
    document.querySelector('.brand > span:last-child').textContent = profile.name;
    document.querySelector('.site-footer > span').textContent = profile.name;
    document.title = profile.name + ' | 포트폴리오';
    const links = document.getElementById('profile-links'); links.replaceChildren();
    if (profile.email) { const a = el('a', '', profile.email); a.href = 'mailto:' + profile.email; links.append(a); }
    for (const [key, label] of [['github', 'GitHub ↗'], ['linkedin', 'LinkedIn ↗']]) {
      const url = safeURL(profile[key]);
      if (url) { const a = el('a', '', label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; links.append(a); }
    }
    const github = document.querySelector('.header-github');
    github.hidden = !safeURL(profile.github);
    if (!github.hidden) github.href = safeURL(profile.github);
  }
  async function load() {
    try {
      const response = await fetch('data/portfolio.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error();
      const data = Portfolio.validate(await response.json());
      renderProfile(data.profile); Portfolio.render(root, data);
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
      const nav = [...document.querySelectorAll('nav a')];
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          nav.forEach(link => {
            const active = link.hash === '#' + entry.target.id;
            if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
          });
        }
      }, { rootMargin: '-12% 0px -60% 0px', threshold: 0 });
      document.querySelectorAll('.resume-section').forEach(section => observer.observe(section));
    } catch (_) {
      root.replaceChildren(Portfolio.el('p', 'load-message', '내용을 불러오지 못했습니다.'));
      const retry = Portfolio.el('button', 'button', '다시 불러오기');
      retry.type = 'button'; retry.addEventListener('click', load); root.append(retry);
    }
  }
  load();
})();
