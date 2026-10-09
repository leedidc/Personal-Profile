(() => {
  'use strict';
  const {
    sections,
    createElement,
    validatePortfolio,
    createLogo,
    getSafeUrl,
    maskCredentialNumber,
  } = Portfolio;
  const getElement = (id) => document.getElementById(id);
  // 토큰과 저장 전 변경사항은 현재 페이지의 메모리에만 유지합니다.
  let token = '';
  let sha = '';
  let data = null;
  let dirty = false;
  let busy = false;
  let sectionKey = 'education';
  let editingId = null;
  let logoValue = '';
  let uploadVersion = 0;
  const { logoOptions, editorLabels } = PortfolioConfig;
  const { loadPortfolio, savePortfolio, verifyWriteAccess } = PortfolioStorage;
  for (const [name, value] of logoOptions) {
    const option = createElement('option', '', name);
    option.value = value;
    getElement('logo-select').append(option);
  }

  function showStatus(message, error = false) {
    getElement('status').textContent = message;
    getElement('status').classList.toggle('error', error);
  }

  function setDirty(value = true) {
    dirty = value;
    getElement('unsaved').hidden = !dirty;
    getElement('publish').disabled = busy || !dirty;
  }

  function setBusy(value) {
    busy = value;
    getElement('editor-panel').inert = busy;
    getElement('logout').disabled = busy;
    getElement('preview').disabled = busy;
    getElement('reload').disabled = busy;
    getElement('publish').disabled = busy || !dirty;
    getElement('publish').textContent = busy ? '저장 중…' : '사이트에 저장';
  }

  function createActionButton(text, label, callback, extra = '') {
    const button = createElement('button', 'button small ' + extra, text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', callback);
    return button;
  }

  function moveItem(id, targetIndex) {
    const rows = data[sectionKey];
    const currentIndex = rows.findIndex((row) => row.id === id);
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= rows.length ||
      currentIndex === targetIndex
    ) {
      return;
    }
    const [row] = rows.splice(currentIndex, 1);
    rows.splice(targetIndex, 0, row);
    setDirty();
    renderEditorList();
    getElement('editor-list').children[targetIndex].querySelector('.order-select').focus();
    showStatus(row.name + ' 항목을 ' + (targetIndex + 1) + '번째로 이동했습니다.');
  }

  function createOrderSelect(row, index, count) {
    const select = createElement('select', 'order-select');
    select.setAttribute('aria-label', row.name + ' 표시 순서');
    for (let position = 0; position < count; position++) {
      const option = createElement('option', '', position + 1 + '번째');
      option.value = String(position);
      select.append(option);
    }
    select.value = String(index);
    select.addEventListener('change', () => moveItem(row.id, Number(select.value)));
    return select;
  }

  function renderEditorList() {
    const section = sections.find((item) => item.key === sectionKey);
    getElement('section-title').textContent = section.title + ' · ' + data[sectionKey].length;
    getElement('add-item').setAttribute('aria-label', section.title + ' 추가');
    for (const button of getElement('editor-tabs').children) {
      button.setAttribute('aria-pressed', String(button.dataset.section === sectionKey));
    }
    const list = getElement('editor-list');
    list.replaceChildren();
    data[sectionKey].forEach((row, index, rows) => {
      const article = createElement('article', 'editor-row');
      const identity = createElement('div', 'identity');
      const text = createElement('div', 'identity-text');
      text.append(createElement('span', 'row-name', row.name));
      if (row.subtitle) {
        text.append(createElement('span', 'row-subtitle', row.subtitle));
      }
      if (row.summary) {
        text.append(createElement('span', 'row-summary', row.summary));
      }
      if (row.summaryEnglish) {
        text.append(createElement('span', 'row-subtitle summary-english', row.summaryEnglish));
      }
      const meta = [
        row.period,
        sectionKey === 'projects' ? (row.category === 'personal' ? '개인' : '회사') : '',
      ]
        .filter(Boolean)
        .join(' · ');
      text.append(createElement('span', 'row-subtitle', meta));
      identity.append(createLogo(row, '../'), text);
      const actions = createElement('div', 'editor-actions');
      const move = (direction) => moveItem(row.id, index + direction);
      const up = createActionButton('↑', row.name + ' 위로 이동', () => move(-1), 'icon');
      up.disabled = index === 0;
      const down = createActionButton('↓', row.name + ' 아래로 이동', () => move(1), 'icon');
      down.disabled = index === rows.length - 1;
      actions.append(
        createOrderSelect(row, index, rows.length),
        up,
        down,
        createActionButton('수정', row.name + ' 수정', () => openItemDialog(row)),
        createActionButton(
          '삭제',
          row.name + ' 삭제',
          () => {
            if (!confirm('‘' + row.name + '’ 항목을 삭제할까요?')) {
              return;
            }
            data[sectionKey] = rows.filter((item) => item.id !== row.id);
            setDirty();
            renderEditorList();
          },
          'danger',
        ),
      );
      article.append(identity, actions);
      list.append(article);
    });
    if (!data[sectionKey].length) {
      list.append(createElement('p', 'empty-row', '등록된 항목이 없습니다.'));
    }
  }
  for (const section of sections) {
    const button = createElement('button', '', section.title);
    button.type = 'button';
    button.dataset.section = section.key;
    button.addEventListener('click', () => {
      sectionKey = section.key;
      renderEditorList();
    });
    getElement('editor-tabs').append(button);
  }
  const reload = createElement('button', 'button', '새로 불러오기');
  reload.id = 'reload';
  reload.type = 'button';
  getElement('publish-actions').prepend(reload);
  reload.addEventListener('click', async () => {
    if (dirty && !confirm('저장하지 않은 변경사항을 버리고 새로 불러올까요?')) {
      return;
    }
    setBusy(true);
    try {
      const remote = await loadPortfolio(token);
      data = remote.data;
      sha = remote.sha;
      setDirty(false);
      renderEditorList();
      showStatus('최신 내용을 불러왔습니다.');
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  });
  getElement('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const candidate = getElement('token').value.trim();
    if (!candidate) {
      return;
    }
    getElement('login-button').disabled = true;
    showStatus('로그인 중…');
    try {
      await verifyWriteAccess(candidate);
      const remote = await loadPortfolio(candidate);
      token = candidate;
      data = remote.data;
      sha = remote.sha;
      getElement('token').value = '';
      getElement('login-form').hidden = true;
      getElement('editor-panel').hidden = false;
      getElement('logout').hidden = false;
      getElement('publish-actions').hidden = false;
      setDirty(false);
      renderEditorList();
      showStatus('');
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      getElement('login-button').disabled = false;
    }
  });
  getElement('logout').addEventListener('click', () => {
    if (dirty && !confirm('저장하지 않은 변경사항을 버리고 로그아웃할까요?')) {
      return;
    }
    token = '';
    sha = '';
    data = null;
    setDirty(false);
    getElement('editor-list').replaceChildren();
    getElement('preview-content').replaceChildren();
    getElement('item-form').reset();
    getElement('profile-form').reset();
    logoValue = '';
    getElement('editor-panel').hidden = true;
    getElement('publish-actions').hidden = true;
    getElement('logout').hidden = true;
    getElement('login-form').hidden = false;
    showStatus('로그아웃했습니다.');
    getElement('token').focus();
  });

  function updateLogoPreview() {
    const image = getElement('logo-preview');
    const src = getSafeUrl(logoValue, 'image', '../');
    image.hidden = !src;
    if (src) {
      image.src = src;
    } else {
      image.removeAttribute('src');
    }
  }
  getElement('logo-preview').addEventListener('error', () => {
    getElement('logo-preview').hidden = true;
  });

  function openItemDialog(row) {
    uploadVersion++;
    getElement('apply-item').disabled = false;
    editingId = row?.id || null;
    const form = getElement('item-form');
    form.reset();
    getElement('item-error').textContent = '';
    const section = sections.find((item) => item.key === sectionKey);
    getElement('item-title').textContent = section.title + (row ? ' 수정' : ' 추가');
    const labels = editorLabels[sectionKey];
    ['name-label', 'subtitle-label', 'summary-label'].forEach((id, i) => {
      getElement(id).textContent = labels[i];
    });
    getElement('name-help').hidden = sectionKey !== 'certifications';
    getElement('summary-english-field').hidden = !['education', 'experience'].includes(sectionKey);
    getElement('summary-english-label').textContent =
      sectionKey === 'education' ? '영문 전공 · 학위' : '영문 부서 · 직책';
    getElement('summary-english').value = row?.summaryEnglish || '';
    const isSingleDate = Boolean(section.numberLabel) || sectionKey === 'awards';
    getElement('period-label').textContent = section.columns[1];
    getElement('period').placeholder = isSingleDate ? '2026.10' : '2026.01 – 현재';
    if (section.numberLabel) {
      getElement('period').placeholder = '2026.10.09';
    }
    getElement('status-label').textContent = sectionKey === 'awards' ? '부문' : '상태';
    getElement('item-status').placeholder =
      sectionKey === 'awards' ? '논문 부문 등' : '재직, 재학, 졸업 등';
    ['project-category', 'project-technologies', 'project-link'].forEach((id) => {
      getElement(id).hidden = sectionKey !== 'projects';
    });
    getElement('credential-number-field').hidden = !section.numberLabel;
    getElement('credential-number-label').textContent = section.numberLabel || '';
    getElement('education-courses').hidden = sectionKey !== 'education';
    getElement('courses').value = row?.courses?.join('\n') || '';
    getElement('credential-number').value = row?.maskedNumber || '';
    for (const key of ['name', 'subtitle', 'period', 'status', 'summary', 'link']) {
      form.elements.namedItem(key).value = row?.[key] || '';
    }
    getElement('details').value = row?.details.join('\n') || '';
    getElement('category').value = row?.category || 'personal';
    getElement('technologies').value = row?.technologies?.join(', ') || '';
    logoValue = row?.logo || '';
    getElement('logo-select').value = logoOptions.some(([, value]) => value === logoValue)
      ? logoValue
      : '__custom__';
    getElement('logo-url').value = /^https:/.test(logoValue) ? logoValue : '';
    updateLogoPreview();
    getElement('item-dialog').showModal();
  }
  getElement('add-item').addEventListener('click', () => openItemDialog(null));
  getElement('item-dialog').addEventListener('close', () => {
    getElement('credential-number').value = '';
  });
  getElement('logo-select').addEventListener('change', () => {
    uploadVersion++;
    if (getElement('logo-select').value === '__custom__') {
      getElement('logo-url').focus();
      return;
    }
    logoValue = getElement('logo-select').value;
    getElement('logo-url').value = '';
    getElement('logo-file').value = '';
    updateLogoPreview();
  });
  getElement('logo-url').addEventListener('input', () => {
    uploadVersion++;
    logoValue = getElement('logo-url').value.trim();
    getElement('logo-select').value = '__custom__';
    updateLogoPreview();
  });
  getElement('logo-file').addEventListener('change', async () => {
    const file = getElement('logo-file').files[0];
    if (!file) {
      return;
    }
    // 로고 선택이 바뀌면 이전 업로드 결과를 적용하지 않습니다.
    const version = ++uploadVersion;
    getElement('item-error').textContent = '';
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      getElement('item-error').textContent = '5MB 이하의 PNG, JPG, WebP 이미지를 선택해 주세요.';
      return;
    }
    getElement('apply-item').disabled = true;
    let url;
    try {
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== uploadVersion || !getElement('item-dialog').open) {
        return;
      }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 160 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      logoValue = canvas.toDataURL('image/png');
      getElement('logo-select').value = '__custom__';
      getElement('logo-url').value = '';
      updateLogoPreview();
    } catch (_) {
      getElement('item-error').textContent = '이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.';
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
      getElement('apply-item').disabled = false;
    }
  });
  getElement('item-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (getElement('apply-item').disabled) {
      return;
    }
    const fields = new FormData(event.currentTarget);
    const row = {
      id: editingId || crypto.randomUUID(),
      logo: logoValue,
      details: String(fields.get('details'))
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
    };
    for (const key of ['name', 'subtitle', 'period', 'status', 'summary']) {
      row[key] = String(fields.get(key)).trim();
    }
    if (['education', 'experience'].includes(sectionKey)) {
      row.summaryEnglish = String(fields.get('summaryEnglish')).trim();
    }
    if (sectionKey === 'education') {
      row.courses = String(fields.get('courses'))
        .split('\n')
        .map((course) => course.trim())
        .filter(Boolean);
    }
    if (sectionKey === 'projects') {
      row.category = fields.get('category');
      row.link = String(fields.get('link')).trim();
      row.technologies = String(fields.get('technologies'))
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }
    try {
      const section = sections.find((item) => item.key === sectionKey);
      if (section.numberLabel) {
        row.maskedNumber = maskCredentialNumber(String(fields.get('maskedNumber') || ''));
        getElement('credential-number').value = row.maskedNumber;
      }
      const next = structuredClone(data);
      const index = next[sectionKey].findIndex((item) => item.id === editingId);
      if (index < 0) {
        next[sectionKey].push(row);
      } else {
        next[sectionKey][index] = row;
      }
      validatePortfolio(next);
      data = next;
      setDirty();
      renderEditorList();
      getElement('item-dialog').close();
      showStatus('변경사항을 적용했습니다. ‘사이트에 저장’을 누르면 반영됩니다.');
    } catch (error) {
      getElement('item-error').textContent = error.message;
    }
  });
  getElement('edit-profile').addEventListener('click', () => {
    getElement('profile-form').reset();
    for (const [key, value] of Object.entries(data.profile)) {
      const input = getElement('profile-form').elements.namedItem(key);
      if (input) {
        input.value = Array.isArray(value) ? value.join('\n') : value;
      }
    }
    getElement('profile-error').textContent = '';
    getElement('profile-dialog').showModal();
  });
  getElement('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const next = structuredClone(data);
      next.profile = Object.fromEntries(
        [...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()]),
      );
      next.profile.interests = next.profile.interests
        .split('\n')
        .map((interest) => interest.trim())
        .filter(Boolean);
      validatePortfolio(next);
      data = next;
      setDirty();
      getElement('profile-dialog').close();
      showStatus('프로필 변경사항을 적용했습니다.');
    } catch (error) {
      getElement('profile-error').textContent = error.message;
    }
  });
  document
    .querySelectorAll('[data-close]')
    .forEach((button) =>
      button.addEventListener('click', () => getElement(button.dataset.close).close()),
    );
  getElement('preview').addEventListener('click', () => {
    const root = getElement('preview-content');
    Portfolio.renderPortfolio(root, data, '../', 'preview-');
    const profile = createElement('div');
    Portfolio.renderProfile(profile, data.profile, 'preview-');
    root.prepend(profile);
    getElement('preview-dialog').showModal();
  });
  getElement('publish').addEventListener('click', async () => {
    if (!dirty || busy || !token) {
      return;
    }
    try {
      validatePortfolio(data);
    } catch (error) {
      showStatus(error.message, true);
      return;
    }
    setBusy(true);
    showStatus('사이트에 저장 중…');
    try {
      sha = await savePortfolio(token, data, sha);
      setDirty(false);
      showStatus('저장했습니다. 사이트에 반영되기까지 잠시 걸릴 수 있습니다.');
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
})();
