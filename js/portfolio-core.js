(() => {
  'use strict';
  const { sections } = PortfolioConfig;
  const certificateNumberPrefixLength = 12;

  function maskCertificateNumber(value) {
    if (typeof value !== 'string' || value.length > 100) {
      throw new Error('자격증 번호를 확인해 주세요.');
    }

    const number = value.trim();
    if (!number) {
      return '';
    }
    if (!/^(?:[#A-Za-z0-9-]+|[#A-Za-z0-9-]*\*{3})$/.test(number)) {
      throw new Error('자격증 번호에는 영문, 숫자, #, - 또는 끝의 ***만 입력해 주세요.');
    }

    // 이미 가린 번호는 유지하고, 원문은 최소 끝 3자리를 제거합니다.
    const prefix = number.endsWith('***')
      ? number.slice(0, -3)
      : number.slice(0, Math.max(0, number.length - 3));
    return prefix.slice(0, certificateNumberPrefixLength) + '***';
  }

  function preparePortfolioForPublication(data) {
    // 공개 저장소에 보내기 전에 번호 원문을 제거합니다.
    const publicData = structuredClone(data);
    for (const certificate of publicData.certifications || []) {
      certificate.maskedNumber = maskCertificateNumber(certificate.maskedNumber ?? '');
    }
    return validatePortfolio(publicData);
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function getSafeUrl(value, kind = 'link', base = './') {
    if (!value || typeof value !== 'string') {
      return '';
    }
    if (kind === 'image' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) {
      return value;
    }
    try {
      if (
        kind === 'image' &&
        /^(image|issuer)\/[a-z0-9_./-]+$/i.test(value) &&
        !value.includes('..')
      ) {
        return new URL(base + value, location.href).href;
      }
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function validatePortfolio(data) {
    if (!data || data.version !== 1 || !data.profile || typeof data.profile !== 'object') {
      throw new Error('포트폴리오 데이터 형식이 올바르지 않습니다.');
    }
    for (const key of ['name', 'englishName', 'email', 'github', 'linkedin']) {
      if (typeof data.profile[key] !== 'string' || data.profile[key].length > 500) {
        throw new Error('프로필 내용을 확인해 주세요.');
      }
    }
    if (!data.profile.name.trim()) {
      throw new Error('이름을 입력해 주세요.');
    }
    if (data.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.profile.email)) {
      throw new Error('이메일 주소를 확인해 주세요.');
    }
    for (const key of ['github', 'linkedin']) {
      if (data.profile[key] && !getSafeUrl(data.profile[key])) {
        throw new Error('프로필 링크는 https:// 주소로 입력해 주세요.');
      }
    }
    const ids = new Set();
    for (const section of sections) {
      const rows = data[section.key];
      if (!Array.isArray(rows) || rows.length > 500) {
        throw new Error(section.title + ' 목록을 확인해 주세요.');
      }
      for (const row of rows) {
        if (
          !row ||
          typeof row !== 'object' ||
          typeof row.id !== 'string' ||
          !row.id ||
          ids.has(row.id)
        ) {
          throw new Error('항목 ID가 올바르지 않습니다.');
        }
        ids.add(row.id);
        for (const key of ['name', 'subtitle', 'period', 'status', 'summary']) {
          if (typeof row[key] !== 'string' || row[key].length > 5000) {
            throw new Error(section.title + ' 내용을 확인해 주세요.');
          }
        }
        if (!row.name.trim()) {
          throw new Error(section.title + ' 이름을 입력해 주세요.');
        }
        if (
          section.key === 'certifications' &&
          row.maskedNumber !== undefined &&
          maskCertificateNumber(row.maskedNumber) !== row.maskedNumber
        ) {
          throw new Error('공개 데이터에는 마스킹된 자격증 번호만 저장할 수 있습니다.');
        }
        if (typeof row.logo !== 'string' || (row.logo && !getSafeUrl(row.logo, 'image'))) {
          throw new Error('로고 주소를 확인해 주세요.');
        }
        if (
          !Array.isArray(row.details) ||
          row.details.length > 100 ||
          row.details.some((x) => typeof x !== 'string' || x.length > 5000)
        ) {
          throw new Error('상세 내용을 확인해 주세요.');
        }
        if (section.key === 'projects') {
          if (!['personal', 'company'].includes(row.category)) {
            throw new Error('프로젝트 구분을 선택해 주세요.');
          }
          if (
            !Array.isArray(row.technologies) ||
            row.technologies.length > 30 ||
            row.technologies.some((x) => typeof x !== 'string' || x.length > 100)
          ) {
            throw new Error('사용 기술을 확인해 주세요.');
          }
          if (typeof row.link !== 'string' || (row.link && !getSafeUrl(row.link))) {
            throw new Error('프로젝트 링크는 https:// 주소로 입력해 주세요.');
          }
        }
      }
    }
    if (new TextEncoder().encode(JSON.stringify(data)).length > 900000) {
      throw new Error('데이터가 너무 큽니다. 로고 이미지 크기를 줄여 주세요.');
    }
    return data;
  }

  function createLogo(row, base) {
    const wrap = createElement('span', 'org-logo');
    const fallback = createElement('span', 'logo-fallback', row.name.trim().slice(0, 2));
    fallback.setAttribute('aria-hidden', 'true');
    wrap.append(fallback);
    const src = getSafeUrl(row.logo, 'image', base);
    if (src) {
      const img = createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 44;
      img.height = 44;
      img.addEventListener('error', () => img.remove());
      img.addEventListener('load', () => {
        fallback.hidden = true;
      });
      wrap.append(img);
    }
    return wrap;
  }

  function createCertificateNumberCell(maskedNumber = '') {
    const cell = createElement('td', 'credential-cell');
    const label = createElement('span', 'credential-label', '자격증 번호');
    const number = createElement(
      'span',
      'credential-number',
      maskCertificateNumber(maskedNumber) || '—',
    );
    cell.append(label, number);
    return cell;
  }

  function rowElement(row, base, sectionKey) {
    const tr = createElement('tr');
    const nameCell = createElement('th', 'name-cell');
    nameCell.scope = 'row';
    const identity = createElement('div', 'identity');
    const text = createElement('div', 'identity-text');
    text.append(createElement('span', 'row-name', row.name));
    if (row.subtitle) {
      text.append(createElement('span', 'row-subtitle', row.subtitle));
    }
    identity.append(createLogo(row, base), text);
    nameCell.append(identity);
    const period = createElement('td', 'period-cell');
    period.append(createElement('span', 'period', row.period || '—'));
    if (row.status) {
      period.append(
        createElement(
          'span',
          ['재직', '재학'].includes(row.status) ? 'badge current' : 'badge',
          row.status,
        ),
      );
    }
    const content = createElement('td', 'content-cell');
    if (row.summary) {
      content.append(createElement('p', 'row-summary', row.summary));
    }
    if (row.details.length) {
      const details = createElement('details', 'row-details');
      const summary = createElement('summary');
      summary.setAttribute('aria-label', row.name + ' 상세 내용');
      summary.append(
        createElement('span', 'when-closed', '자세히 보기'),
        createElement('span', 'when-open', '접기'),
        createElement('span', 'chevron', '⌄'),
      );
      const list = createElement('ul');
      row.details.forEach((line) => list.append(createElement('li', '', line)));
      details.append(summary, list);
      content.append(details);
    }
    if (row.technologies?.length) {
      const tags = createElement('div', 'tags');
      row.technologies.forEach((tag) => tags.append(createElement('span', '', tag)));
      content.append(tags);
    }
    const url = getSafeUrl(row.link);
    if (url) {
      const a = createElement('a', 'project-link', '프로젝트 보기 ↗');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      content.append(a);
    }
    tr.append(nameCell, period, content);
    if (sectionKey === 'certifications') {
      tr.append(createCertificateNumberCell(row.maskedNumber));
    }
    return tr;
  }

  function table(section, rows, base, caption) {
    const wrap = createElement('div', 'table-wrap');
    const table = createElement('table', 'resume-table');
    if (section.key === 'certifications') {
      table.classList.add('certifications-table');
    }
    table.append(createElement('caption', 'sr-only', caption || section.title));
    const head = createElement('thead');
    const headRow = createElement('tr');
    section.columns.forEach((title) => {
      const th = createElement('th', '', title);
      th.scope = 'col';
      headRow.append(th);
    });
    head.append(headRow);
    const body = createElement('tbody');
    rows.forEach((row) => body.append(rowElement(row, base, section.key)));
    if (!rows.length) {
      const tr = createElement('tr');
      const td = createElement('td', 'empty-row', '등록된 항목이 없습니다.');
      td.colSpan = section.columns.length;
      tr.append(td);
      body.append(tr);
    }
    table.append(head, body);
    wrap.append(table);
    return wrap;
  }

  function renderPortfolio(root, data, base = './', prefix = '') {
    validatePortfolio(data);
    root.replaceChildren();
    sections.forEach((section, index) => {
      const block = createElement('section', 'resume-section');
      block.id = prefix + section.key;
      const heading = createElement('div', 'section-heading');
      const title = createElement('h2');
      title.append(
        createElement('span', 'section-index', String(index + 1).padStart(2, '0')),
        document.createTextNode(section.title),
      );
      const count = createElement('span', 'section-count', String(data[section.key].length));
      count.setAttribute('aria-label', data[section.key].length + '개');
      heading.append(title, count);
      block.append(heading);
      if (section.key === 'projects') {
        for (const [category, title] of [
          ['personal', '개인'],
          ['company', '회사'],
        ]) {
          const group = createElement('div', 'project-group');
          group.append(
            createElement('h3', 'group-heading', title),
            table(
              section,
              data.projects.filter((row) => row.category === category),
              base,
              title + ' 프로젝트',
            ),
          );
          block.append(group);
        }
      } else {
        block.append(table(section, data[section.key], base));
      }
      root.append(block);
    });
  }
  window.Portfolio = {
    sections,
    createElement,
    getSafeUrl,
    maskCertificateNumber,
    preparePortfolioForPublication,
    validatePortfolio,
    createLogo,
    renderPortfolio,
  };
})();
