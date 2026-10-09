(() => {
  'use strict';
  const { sections, el, validate, logo, safeURL } = Portfolio;
  const REPO = 'leedidc/Personal-Profile';
  const FILE = '/repos/' + REPO + '/contents/data/portfolio.json';
  const BRANCH = 'main';
  const $ = id => document.getElementById(id);
  let token = '', sha = '', data = null, dirty = false, busy = false;
  let sectionKey = 'education', editingId = null, logoValue = '', uploadVersion = 0;
  const logoOptions = [
    ['로고 없음', ''], ['Arizona State University', 'image/asu.webp'], ['숭실대학교', 'image/ssu.png'],
    ['한국전자통신연구원', 'image/etri.jpg'], ['IBK기업은행', 'image/ibk.png'], ['한국산업은행', 'image/kdb.png'],
    ['국방통합데이터센터', 'image/didc.jpg'], ['개인정보보호위원회', 'image/pipc.png'], ['한국정보보호산업협회', 'image/kisia.png'],
    ['한국인터넷진흥원', 'issuer/kisa.png'], ['한국방송통신전파진흥원', 'issuer/kca.png'], ['한국산업인력공단', 'issuer/hrdk.png'],
    ['한국데이터산업진흥원', 'issuer/kdata.png'], ['한국CPO포럼', 'issuer/cpo.jpg'], ['ISTQB', 'issuer/istqb.svg'],
    ['IREB', 'issuer/ireb.png'], ['한국산업기술보호협회', 'issuer/kait.png'], ['한국정보통신기술협회', 'issuer/tta.jpg'],
    ['한국정보통신진흥협회', 'issuer/kait_ict.png'], ['한국정보통신자격협회', 'issuer/icqa.png'],
    ['한국지능형사물인터넷협회', 'issuer/kiot.jpg'], ['Microsoft', 'issuer/ms.png'], ['Cloud Security Alliance', 'issuer/csa.svg'],
    ['개인정보 확장 프로그램', 'image/extension.jpg'], ['직접 선택', '__custom__']
  ];
  for (const [name, value] of logoOptions) { const option = el('option', '', name); option.value = value; $('logo-select').append(option); }
  function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
  function setDirty(value = true) {
    dirty = value; $('unsaved').hidden = !dirty; $('publish').disabled = busy || !dirty;
  }
  function setBusy(value) {
    busy = value; $('editor-panel').inert = busy;
    $('logout').disabled = busy; $('preview').disabled = busy; $('reload').disabled = busy;
    $('publish').disabled = busy || !dirty; $('publish').textContent = busy ? '저장 중…' : '사이트에 저장';
  }
  function encode(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  function decode(value) {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(value.replace(/\s/g, '')), char => char.charCodeAt(0))));
  }
  async function api(path, options = {}, authToken = token) {
    let response;
    try {
      response = await fetch('https://api.github.com' + path, {
        ...options,
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + authToken, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        cache: 'no-store', signal: AbortSignal.timeout(20000)
      });
    } catch (_) { throw new Error('GitHub에 연결하지 못했습니다. 입력한 내용은 유지됩니다. 연결 상태를 확인해 주세요.'); }
    if (!response.ok) {
      const messages = {
        401: '인증이 만료되었거나 토큰이 올바르지 않습니다. 편집 내용은 유지됩니다.',
        403: '저장소 접근 권한 또는 API 사용 한도를 확인해 주세요. 저장에는 Contents 읽기 및 쓰기 권한이 필요합니다.',
        404: '저장소 또는 포트폴리오 파일에 접근할 수 없습니다. 토큰의 저장소 선택을 확인해 주세요.',
        409: '다른 곳에서 내용이 변경되었습니다. 변경 내용을 따로 보관한 뒤 ‘새로 불러오기’를 눌러 주세요.',
        422: '저장하지 못했습니다. 토큰 권한과 main 브랜치의 보호 규칙을 확인해 주세요.'
      };
      throw new Error(messages[response.status] || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    return response.json();
  }
  async function readRemote(authToken = token) {
    const remote = await api(FILE + '?ref=' + BRANCH, {}, authToken);
    if (remote.encoding !== 'base64' || !remote.content || !remote.sha) throw new Error('포트폴리오 파일을 읽을 수 없습니다.');
    return { data: validate(decode(remote.content)), sha: remote.sha };
  }
  function action(text, label, callback, extra = '') {
    const button = el('button', 'button small ' + extra, text); button.type = 'button';
    button.setAttribute('aria-label', label); button.addEventListener('click', callback); return button;
  }
  function render() {
    const section = sections.find(item => item.key === sectionKey);
    $('section-title').textContent = section.title + ' · ' + data[sectionKey].length;
    $('add-item').setAttribute('aria-label', section.title + ' 추가');
    for (const button of $('editor-tabs').children) button.setAttribute('aria-pressed', String(button.dataset.section === sectionKey));
    const list = $('editor-list'); list.replaceChildren();
    data[sectionKey].forEach((row, index, rows) => {
      const article = el('article', 'editor-row');
      const identity = el('div', 'identity'), text = el('div', 'identity-text');
      text.append(el('span', 'row-name', row.name));
      const meta = [row.period, row.subtitle, sectionKey === 'projects' ? (row.category === 'personal' ? '개인' : '회사') : ''].filter(Boolean).join(' · ');
      text.append(el('span', 'row-subtitle', meta)); identity.append(logo(row, '../'), text);
      const actions = el('div', 'editor-actions');
      const move = direction => {
        const target = index + direction;
        [rows[index], rows[target]] = [rows[target], rows[index]];
        setDirty(); render();
      };
      const up = action('↑', row.name + ' 위로 이동', () => move(-1), 'icon'); up.disabled = index === 0;
      const down = action('↓', row.name + ' 아래로 이동', () => move(1), 'icon'); down.disabled = index === rows.length - 1;
      actions.append(up, down,
        action('수정', row.name + ' 수정', () => openItem(row)),
        action('삭제', row.name + ' 삭제', () => {
          if (!confirm('‘' + row.name + '’ 항목을 삭제할까요?')) return;
          data[sectionKey] = rows.filter(item => item.id !== row.id); setDirty(); render();
        }, 'danger'));
      article.append(identity, actions); list.append(article);
    });
    if (!data[sectionKey].length) list.append(el('p', 'empty-row', '등록된 항목이 없습니다.'));
  }
  for (const section of sections) {
    const button = el('button', '', section.title); button.type = 'button'; button.dataset.section = section.key;
    button.addEventListener('click', () => { sectionKey = section.key; render(); }); $('editor-tabs').append(button);
  }
  const reload = el('button', 'button', '새로 불러오기'); reload.id = 'reload'; reload.type = 'button';
  $('publish-actions').prepend(reload);
  reload.addEventListener('click', async () => {
    if (dirty && !confirm('저장하지 않은 변경사항을 버리고 새로 불러올까요?')) return;
    setBusy(true);
    try { const remote = await readRemote(); data = remote.data; sha = remote.sha; setDirty(false); render(); status('최신 내용을 불러왔습니다.'); }
    catch (error) { status(error.message, true); } finally { setBusy(false); }
  });
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const candidate = $('token').value.trim(); if (!candidate) return;
    $('login-button').disabled = true; status('로그인 중…');
    try {
      const repository = await api('/repos/' + REPO, {}, candidate);
      if (!repository.permissions?.push) throw new Error('이 저장소를 수정할 수 있는 계정의 토큰으로 로그인해 주세요.');
      const remote = await readRemote(candidate);
      token = candidate; data = remote.data; sha = remote.sha;
      $('token').value = ''; $('login-form').hidden = true; $('editor-panel').hidden = false;
      $('logout').hidden = false; $('publish-actions').hidden = false;
      setDirty(false); render(); status('');
    } catch (error) { status(error.message, true); }
    finally { $('login-button').disabled = false; }
  });
  $('logout').addEventListener('click', () => {
    if (dirty && !confirm('저장하지 않은 변경사항을 버리고 로그아웃할까요?')) return;
    token = ''; sha = ''; data = null; setDirty(false);
    $('editor-list').replaceChildren(); $('preview-content').replaceChildren();
    $('item-form').reset(); $('profile-form').reset(); logoValue = '';
    $('editor-panel').hidden = true; $('publish-actions').hidden = true; $('logout').hidden = true;
    $('login-form').hidden = false; status('로그아웃했습니다.'); $('token').focus();
  });
  function updateLogoPreview() {
    const image = $('logo-preview'), src = safeURL(logoValue, 'image', '../');
    image.hidden = !src; if (src) image.src = src; else image.removeAttribute('src');
  }
  $('logo-preview').addEventListener('error', () => { $('logo-preview').hidden = true; });
  function openItem(row) {
    uploadVersion++; $('apply-item').disabled = false;
    editingId = row?.id || null; const form = $('item-form'); form.reset();
    $('item-error').textContent = '';
    const section = sections.find(item => item.key === sectionKey);
    $('item-title').textContent = section.title + (row ? ' 수정' : ' 추가');
    const labels = {
      education: ['학교명', '영문 학교명 · 단과대학', '전공 · 학위'],
      experience: ['회사명', '영문명 · 약칭', '부서 · 직책'],
      certifications: ['자격명', '영문명 · 약칭', '발급기관'],
      projects: ['프로젝트명', '소속 · 구분', '프로젝트 내용'],
      activities: ['기관명', '활동명 · 소속', '활동 내용']
    }[sectionKey];
    ['name-label', 'subtitle-label', 'summary-label'].forEach((id, i) => { $(id).textContent = labels[i]; });
    $('period-label').textContent = sectionKey === 'certifications' ? '취득' : '기간';
    $('period').placeholder = sectionKey === 'certifications' ? '2026.06' : '2026.01 – 현재';
    ['project-category', 'project-technologies', 'project-link'].forEach(id => { $(id).hidden = sectionKey !== 'projects'; });
    for (const key of ['name', 'subtitle', 'period', 'status', 'summary', 'link']) form.elements.namedItem(key).value = row?.[key] || '';
    $('details').value = row?.details.join('\n') || '';
    $('category').value = row?.category || 'personal'; $('technologies').value = row?.technologies?.join(', ') || '';
    logoValue = row?.logo || '';
    $('logo-select').value = logoOptions.some(([, value]) => value === logoValue) ? logoValue : '__custom__';
    $('logo-url').value = /^https:/.test(logoValue) ? logoValue : '';
    updateLogoPreview(); $('item-dialog').showModal();
  }
  $('add-item').addEventListener('click', () => openItem(null));
  $('logo-select').addEventListener('change', () => {
    uploadVersion++;
    if ($('logo-select').value === '__custom__') { $('logo-url').focus(); return; }
    logoValue = $('logo-select').value; $('logo-url').value = ''; $('logo-file').value = ''; updateLogoPreview();
  });
  $('logo-url').addEventListener('input', () => {
    uploadVersion++; logoValue = $('logo-url').value.trim(); $('logo-select').value = '__custom__'; updateLogoPreview();
  });
  $('logo-file').addEventListener('change', async () => {
    const file = $('logo-file').files[0]; if (!file) return;
    const version = ++uploadVersion;
    $('item-error').textContent = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      $('item-error').textContent = '5MB 이하의 PNG, JPG, WebP 이미지를 선택해 주세요.'; return;
    }
    $('apply-item').disabled = true;
    let url;
    try {
      url = URL.createObjectURL(file); const image = new Image(); image.src = url; await image.decode();
      if (version !== uploadVersion || !$('item-dialog').open) return;
      const canvas = document.createElement('canvas'), scale = Math.min(1, 160 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      logoValue = canvas.toDataURL('image/png'); $('logo-select').value = '__custom__'; $('logo-url').value = ''; updateLogoPreview();
    } catch (_) { $('item-error').textContent = '이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.'; }
    finally { if (url) URL.revokeObjectURL(url); $('apply-item').disabled = false; }
  });
  $('item-form').addEventListener('submit', event => {
    event.preventDefault();
    if ($('apply-item').disabled) return;
    const fields = new FormData(event.currentTarget);
    const row = { id: editingId || crypto.randomUUID(), logo: logoValue, details: String(fields.get('details')).split('\n').map(x => x.trim()).filter(Boolean) };
    for (const key of ['name', 'subtitle', 'period', 'status', 'summary']) row[key] = String(fields.get(key)).trim();
    if (sectionKey === 'projects') {
      row.category = fields.get('category'); row.link = String(fields.get('link')).trim();
      row.technologies = String(fields.get('technologies')).split(',').map(x => x.trim()).filter(Boolean);
    }
    try {
      const next = structuredClone(data);
      const index = next[sectionKey].findIndex(item => item.id === editingId);
      if (index < 0) next[sectionKey].push(row); else next[sectionKey][index] = row;
      validate(next); data = next; setDirty(); render(); $('item-dialog').close();
      status('변경사항을 적용했습니다. ‘사이트에 저장’을 누르면 반영됩니다.');
    } catch (error) { $('item-error').textContent = error.message; }
  });
  $('edit-profile').addEventListener('click', () => {
    for (const [key, value] of Object.entries(data.profile)) {
      const input = $('profile-form').elements.namedItem(key); if (input) input.value = value;
    }
    $('profile-error').textContent = ''; $('profile-dialog').showModal();
  });
  $('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const next = structuredClone(data);
      next.profile = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()]));
      validate(next); data = next; setDirty(); $('profile-dialog').close(); status('프로필 변경사항을 적용했습니다.');
    } catch (error) { $('profile-error').textContent = error.message; }
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('preview').addEventListener('click', () => {
    const root = $('preview-content'); Portfolio.render(root, data, '../', 'preview-');
    const profile = el('div', 'profile');
    const heading = el('h1', '', data.profile.name); heading.append(el('span', '', data.profile.englishName));
    profile.append(heading, el('p', '', data.profile.email)); root.prepend(profile); $('preview-dialog').showModal();
  });
  $('publish').addEventListener('click', async () => {
    if (!dirty || busy || !token) return;
    try { validate(data); } catch (error) { status(error.message, true); return; }
    setBusy(true); status('사이트에 저장 중…');
    try {
      const saved = await api(FILE, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Update portfolio from admin', content: encode(data), sha, branch: BRANCH })
      });
      if (!saved.content?.sha) throw new Error('저장 결과를 확인하지 못했습니다. GitHub 저장소를 확인해 주세요.');
      sha = saved.content.sha; setDirty(false);
      status('저장했습니다. 사이트에 반영되기까지 잠시 걸릴 수 있습니다.');
    } catch (error) { status(error.message, true); }
    finally { setBusy(false); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
})();
