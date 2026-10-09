(() => {
  'use strict';
  const { sections } = PortfolioConfig;
  const credentialNumberPrefixLength = 12;

  function maskCredentialNumber(value) {
    if (typeof value !== 'string' || value.length > 100) {
      throw new Error('자격증 번호 또는 등록번호를 확인해 주세요.');
    }

    const number = value.trim();
    if (!number) {
      return '';
    }
    if (!/^(?:[#A-Za-z0-9-]+|[#A-Za-z0-9-]*\*{3})$/.test(number)) {
      throw new Error('번호에는 영문, 숫자, #, - 또는 끝의 ***만 입력해 주세요.');
    }

    // 이미 가린 번호는 유지하고, 원문은 최소 끝 3자리를 제거합니다.
    const prefix = number.endsWith('***')
      ? number.slice(0, -3)
      : number.slice(0, Math.max(0, number.length - 3));
    return prefix.slice(0, credentialNumberPrefixLength) + '***';
  }

  function preparePortfolioForPublication(data) {
    // 공개 저장소에 보내기 전에 번호 원문을 제거합니다.
    const publicData = structuredClone(data);
    for (const section of sections.filter((item) => item.numberLabel)) {
      for (const row of publicData[section.key] || []) {
        row.maskedNumber = maskCredentialNumber(row.maskedNumber ?? '');
      }
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
        // 서버에서도 같은 검증을 사용하며 실제 요청은 발생하지 않습니다.
        return new URL(base + value, globalThis.location?.href || 'https://portfolio.invalid/')
          .href;
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
    if (
      data.profile.introduction !== undefined &&
      (typeof data.profile.introduction !== 'string' || data.profile.introduction.length > 3000)
    ) {
      throw new Error('자기소개는 3,000자 이내로 입력해 주세요.');
    }
    if (
      data.profile.interests !== undefined &&
      (!Array.isArray(data.profile.interests) ||
        data.profile.interests.length > 30 ||
        data.profile.interests.some(
          (interest) => typeof interest !== 'string' || interest.length > 100,
        ))
    ) {
      throw new Error('관심분야는 항목당 100자, 최대 30개까지 입력해 주세요.');
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
      const rows = section.key === 'skills' && data.skills === undefined ? [] : data[section.key];
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
        if (section.key === 'skills') {
          PortfolioSkills.validateSkill(row);
          continue;
        }
        for (const key of ['name', 'subtitle', 'period', 'status', 'summary']) {
          if (typeof row[key] !== 'string' || row[key].length > 5000) {
            throw new Error(section.title + ' 내용을 확인해 주세요.');
          }
        }
        if (!row.name.trim()) {
          throw new Error(section.title + ' 이름을 입력해 주세요.');
        }
        if (
          row.summaryEnglish !== undefined &&
          (typeof row.summaryEnglish !== 'string' || row.summaryEnglish.length > 500)
        ) {
          throw new Error('영문 전공·학위 또는 부서·직책을 확인해 주세요.');
        }
        if (
          section.numberLabel &&
          row.maskedNumber !== undefined &&
          maskCredentialNumber(row.maskedNumber) !== row.maskedNumber
        ) {
          throw new Error('공개 데이터에는 마스킹된 번호만 저장할 수 있습니다.');
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
        if (section.key === 'awards') {
          validateAwardResearch(row.research);
        }
        if (section.key === 'education' && row.courses !== undefined) {
          if (
            !Array.isArray(row.courses) ||
            row.courses.length > 100 ||
            row.courses.some((course) => typeof course !== 'string' || course.length > 5000)
          ) {
            throw new Error('이수과목을 확인해 주세요.');
          }
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

  function validateAwardResearch(research) {
    // 연구 설명이 없는 이전 데이터도 그대로 열 수 있습니다.
    if (research === undefined) {
      return;
    }
    if (
      !research ||
      typeof research.title !== 'string' ||
      !research.title.trim() ||
      research.title.length > 300 ||
      !Array.isArray(research.slides) ||
      research.slides.length < 1 ||
      research.slides.length > 12
    ) {
      throw new Error('연구 제목과 슬라이드 1~12장을 입력해 주세요.');
    }
    for (const slide of research.slides) {
      if (
        !slide ||
        typeof slide.title !== 'string' ||
        !slide.title.trim() ||
        slide.title.length > 160 ||
        typeof slide.body !== 'string' ||
        !slide.body.trim() ||
        slide.body.length > 3000
      ) {
        throw new Error('슬라이드 제목은 160자, 내용은 3,000자 이내로 입력해 주세요.');
      }
    }
    if (
      research.link !== undefined &&
      (typeof research.link !== 'string' ||
        research.link.length > 2000 ||
        (research.link && !getSafeUrl(research.link)))
    ) {
      throw new Error('연구 원문 링크는 https:// 주소로 입력해 주세요.');
    }
  }

  function renderProfile(root, profile, prefix = '') {
    const header = createElement('section', 'profile');
    const headingId = prefix + 'profile-name';
    header.setAttribute('aria-labelledby', headingId);
    const identity = createElement('div');
    const heading = createElement('h1', '', profile.name);
    heading.id = headingId;
    if (profile.englishName) {
      heading.append(createElement('span', '', profile.englishName));
    }
    identity.append(createElement('p', 'profile-label', '포트폴리오'), heading);
    const links = createElement('div', 'profile-links');
    links.id = prefix + 'profile-links';
    if (profile.email) {
      const email = createElement('a', '', profile.email);
      email.href = 'mailto:' + profile.email;
      links.append(email);
    }
    for (const [key, label] of [
      ['github', 'GitHub ↗'],
      ['linkedin', 'LinkedIn ↗'],
    ]) {
      const url = getSafeUrl(profile[key]);
      if (url) {
        const link = createElement('a', '', label);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.append(link);
      }
    }
    header.append(identity, links);
    root.replaceChildren(header);
    const introduction = profile.introduction?.trim();
    const interests = profile.interests?.filter((interest) => interest.trim()) || [];
    if (!introduction && !interests.length) {
      return;
    }
    const overview = createElement('div', 'profile-overview');
    if (introduction) {
      const section = createElement('section', 'profile-introduction');
      const title = createElement('h2', '', '자기소개');
      title.id = prefix + 'introduction-title';
      section.setAttribute('aria-labelledby', title.id);
      section.append(title, createElement('p', '', introduction));
      overview.append(section);
    }
    if (interests.length) {
      const section = createElement('section', 'profile-interests');
      const title = createElement('h2', '', '관심분야');
      title.id = prefix + 'interests-title';
      section.setAttribute('aria-labelledby', title.id);
      const list = createElement('ul', 'tags');
      interests.forEach((interest) => list.append(createElement('li', '', interest)));
      section.append(title, list);
      overview.append(section);
    }
    root.append(overview);
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

  function createCredentialNumberCell(maskedNumber = '', numberLabel) {
    const cell = createElement('td', 'credential-cell');
    const label = createElement('span', 'credential-label', numberLabel);
    const number = createElement(
      'span',
      'credential-number',
      maskCredentialNumber(maskedNumber) || '—',
    );
    cell.append(label, number);
    return cell;
  }

  function createCourseItem(course) {
    const item = createElement('li');
    const gradedCourse = course.match(/^(.*?)(\s+—\s+)([A-D][+0-]?|F|P|NP|PASS|FAIL)$/);
    if (gradedCourse) {
      item.append(
        createElement('span', 'course-name', gradedCourse[1]),
        createElement('span', 'sr-only', gradedCourse[2]),
        createElement('span', 'course-grade', gradedCourse[3]),
      );
    } else {
      item.append(createElement('span', 'course-name', course));
    }
    return item;
  }

  function createDisclosureIcon() {
    const icon = createElement('span', 'disclosure-icon');
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function createCourses(row) {
    const details = createElement('details', 'row-details course-details');
    details.open = row.courses.length <= 3;
    const summary = createElement('summary');
    summary.setAttribute('aria-label', row.name + ' 이수과목');
    const count = createElement('span', 'course-count', row.courses.length + '과목');
    summary.append(createElement('span', '', '이수과목'), createDisclosureIcon(), count);
    const list = createElement('ul', 'course-list');
    row.courses.forEach((course) => list.append(createCourseItem(course)));
    details.append(summary, list);
    return details;
  }

  function rowElement(row, base, section) {
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
    if (row.summaryEnglish) {
      content.append(createElement('p', 'row-subtitle summary-english', row.summaryEnglish));
    }
    if (row.details.length) {
      const list = createElement('ul');
      row.details.forEach((line) => list.append(createElement('li', '', line)));
      if (section.key === 'awards' || section.key === 'education') {
        list.className = section.key === 'education' ? 'education-details' : 'award-details';
        content.append(list);
      } else {
        const details = createElement('details', 'row-details');
        const summary = createElement('summary');
        summary.setAttribute('aria-label', row.name + ' 상세 내용');
        summary.append(
          createElement('span', 'when-closed', '자세히 보기'),
          createElement('span', 'when-open', '접기'),
          createDisclosureIcon(),
        );
        details.append(summary, list);
        content.append(details);
      }
    }
    if (section.key === 'education' && row.courses?.length) {
      content.append(createCourses(row));
    }
    if (row.technologies?.length) {
      const tags = createElement('div', 'tags');
      row.technologies.forEach((tag) => tags.append(createElement('span', '', tag)));
      content.append(tags);
    }
    if (section.key === 'awards' && row.research) {
      const button = createElement('button', 'button small research-open', '연구 내용 보기 →');
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label', row.name + ' 연구 내용 보기');
      button.addEventListener('click', () => AwardResearch.open(row, button));
      content.append(button);
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
    if (section.numberLabel) {
      tr.append(createCredentialNumberCell(row.maskedNumber, section.numberLabel));
    }
    return tr;
  }

  function table(section, rows, base, caption) {
    const wrap = createElement('div', 'table-wrap');
    const table = createElement('table', 'resume-table');
    if (section.numberLabel) {
      table.classList.add('credential-table');
    }
    if (section.key === 'awards') {
      table.classList.add('award-table');
    }
    if (section.key === 'education') {
      table.classList.add('education-table');
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
    rows.forEach((row) => body.append(rowElement(row, base, section)));
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
    sections.forEach((section) => {
      const rows = data[section.key] || [];
      if (section.key === 'skills' && !rows.length) {
        return;
      }
      const block = createElement('section', 'resume-section');
      block.id = prefix + section.key;
      const heading = createElement('div', 'section-heading');
      const title = createElement('h2');
      title.append(
        createElement('span', 'section-index', String(root.children.length + 1).padStart(2, '0')),
        document.createTextNode(section.title),
      );
      const count = createElement('span', 'section-count', String(rows.length));
      count.setAttribute('aria-label', rows.length + '개');
      heading.append(title, count);
      block.append(heading);
      if (section.key === 'skills') {
        PortfolioSkills.renderSkills(block, rows, prefix);
      } else if (section.key === 'projects') {
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
        block.append(table(section, rows, base));
      }
      root.append(block);
    });
  }
  globalThis.Portfolio = {
    sections,
    createElement,
    getSafeUrl,
    maskCredentialNumber,
    preparePortfolioForPublication,
    validatePortfolio,
    validateAwardResearch,
    createLogo,
    renderProfile,
    renderPortfolio,
  };
})();
