(() => {
  'use strict';
  const sections = [
    { key: 'education', title: '학력', columns: ['학교', '기간', '전공 · 학위'] },
    { key: 'experience', title: '경력', columns: ['회사', '기간', '부서 · 업무'] },
    { key: 'certifications', title: '자격', columns: ['자격명', '취득', '발급기관'] },
    { key: 'projects', title: '프로젝트', columns: ['프로젝트', '기간', '내용'] },
    { key: 'activities', title: '대외활동', columns: ['기관 · 활동', '기간', '내용'] }
  ];
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function safeURL(value, kind = 'link', base = './') {
    if (!value || typeof value !== 'string') return '';
    if (kind === 'image' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    try {
      if (kind === 'image' && /^(image|issuer)\/[a-z0-9_./-]+$/i.test(value) && !value.includes('..')) return new URL(base + value, location.href).href;
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function validate(data) {
    if (!data || data.version !== 1 || !data.profile || typeof data.profile !== 'object') throw new Error('포트폴리오 데이터 형식이 올바르지 않습니다.');
    for (const key of ['name', 'englishName', 'email', 'github', 'linkedin']) {
      if (typeof data.profile[key] !== 'string' || data.profile[key].length > 500) throw new Error('프로필 내용을 확인해 주세요.');
    }
    if (!data.profile.name.trim()) throw new Error('이름을 입력해 주세요.');
    if (data.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.profile.email)) throw new Error('이메일 주소를 확인해 주세요.');
    for (const key of ['github', 'linkedin']) if (data.profile[key] && !safeURL(data.profile[key])) throw new Error('프로필 링크는 https:// 주소로 입력해 주세요.');
    const ids = new Set();
    for (const section of sections) {
      const rows = data[section.key];
      if (!Array.isArray(rows) || rows.length > 500) throw new Error(section.title + ' 목록을 확인해 주세요.');
      for (const row of rows) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('항목 ID가 올바르지 않습니다.');
        ids.add(row.id);
        for (const key of ['name', 'subtitle', 'period', 'status', 'summary']) {
          if (typeof row[key] !== 'string' || row[key].length > 5000) throw new Error(section.title + ' 내용을 확인해 주세요.');
        }
        if (!row.name.trim()) throw new Error(section.title + ' 이름을 입력해 주세요.');
        if (typeof row.logo !== 'string' || (row.logo && !safeURL(row.logo, 'image'))) throw new Error('로고 주소를 확인해 주세요.');
        if (!Array.isArray(row.details) || row.details.length > 100 || row.details.some(x => typeof x !== 'string' || x.length > 5000)) throw new Error('상세 내용을 확인해 주세요.');
        if (section.key === 'projects') {
          if (!['personal', 'company'].includes(row.category)) throw new Error('프로젝트 구분을 선택해 주세요.');
          if (!Array.isArray(row.technologies) || row.technologies.length > 30 || row.technologies.some(x => typeof x !== 'string' || x.length > 100)) throw new Error('사용 기술을 확인해 주세요.');
          if (typeof row.link !== 'string' || (row.link && !safeURL(row.link))) throw new Error('프로젝트 링크는 https:// 주소로 입력해 주세요.');
        }
      }
    }
    if (new TextEncoder().encode(JSON.stringify(data)).length > 900000) throw new Error('데이터가 너무 큽니다. 로고 이미지 크기를 줄여 주세요.');
    return data;
  }
  function logo(row, base) {
    const wrap = el('span', 'org-logo');
    const fallback = el('span', 'logo-fallback', row.name.trim().slice(0, 2));
    fallback.setAttribute('aria-hidden', 'true');
    wrap.append(fallback);
    const src = safeURL(row.logo, 'image', base);
    if (src) {
      const img = el('img');
      img.src = src; img.alt = ''; img.loading = 'lazy'; img.width = 44; img.height = 44;
      img.addEventListener('error', () => img.remove());
      img.addEventListener('load', () => { fallback.hidden = true; });
      wrap.append(img);
    }
    return wrap;
  }
  function rowElement(row, base) {
    const tr = el('tr');
    const nameCell = el('th', 'name-cell'); nameCell.scope = 'row';
    const identity = el('div', 'identity');
    const text = el('div', 'identity-text');
    text.append(el('span', 'row-name', row.name));
    if (row.subtitle) text.append(el('span', 'row-subtitle', row.subtitle));
    identity.append(logo(row, base), text); nameCell.append(identity);
    const period = el('td', 'period-cell');
    period.append(el('span', 'period', row.period || '—'));
    if (row.status) period.append(el('span', ['재직', '재학'].includes(row.status) ? 'badge current' : 'badge', row.status));
    const content = el('td', 'content-cell');
    if (row.summary) content.append(el('p', 'row-summary', row.summary));
    if (row.details.length) {
      const details = el('details', 'row-details');
      const summary = el('summary');
      summary.setAttribute('aria-label', row.name + ' 상세 내용');
      summary.append(el('span', 'when-closed', '자세히 보기'), el('span', 'when-open', '접기'), el('span', 'chevron', '⌄'));
      const list = el('ul');
      row.details.forEach(line => list.append(el('li', '', line)));
      details.append(summary, list); content.append(details);
    }
    if (row.technologies?.length) {
      const tags = el('div', 'tags');
      row.technologies.forEach(tag => tags.append(el('span', '', tag)));
      content.append(tags);
    }
    const url = safeURL(row.link);
    if (url) { const a = el('a', 'project-link', '프로젝트 보기 ↗'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; content.append(a); }
    tr.append(nameCell, period, content);
    return tr;
  }
  function table(section, rows, base, caption) {
    const wrap = el('div', 'table-wrap');
    const table = el('table', 'resume-table');
    table.append(el('caption', 'sr-only', caption || section.title));
    const head = el('thead'), headRow = el('tr');
    section.columns.forEach(title => { const th = el('th', '', title); th.scope = 'col'; headRow.append(th); });
    head.append(headRow);
    const body = el('tbody');
    rows.forEach(row => body.append(rowElement(row, base)));
    if (!rows.length) { const tr = el('tr'), td = el('td', 'empty-row', '등록된 항목이 없습니다.'); td.colSpan = 3; tr.append(td); body.append(tr); }
    table.append(head, body); wrap.append(table);
    return wrap;
  }
  function render(root, data, base = './', prefix = '') {
    validate(data); root.replaceChildren();
    sections.forEach((section, index) => {
      const block = el('section', 'resume-section'); block.id = prefix + section.key;
      const heading = el('div', 'section-heading');
      const title = el('h2');
      title.append(el('span', 'section-index', String(index + 1).padStart(2, '0')), document.createTextNode(section.title));
      const count = el('span', 'section-count', String(data[section.key].length));
      count.setAttribute('aria-label', data[section.key].length + '개');
      heading.append(title, count); block.append(heading);
      if (section.key === 'projects') {
        for (const [category, title] of [['personal', '개인'], ['company', '회사']]) {
          const group = el('div', 'project-group');
          group.append(el('h3', 'group-heading', title), table(section, data.projects.filter(row => row.category === category), base, title + ' 프로젝트'));
          block.append(group);
        }
      } else block.append(table(section, data[section.key], base));
      root.append(block);
    });
  }
  window.Portfolio = { sections, el, safeURL, validate, logo, render };
})();
