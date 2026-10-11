(() => {
  'use strict';

  const element = (id) => document.getElementById(id);
  const dialog = element('admin-security-dialog');
  const form = element('security-settings-form');
  const content = element('admin-security-content');
  const status = element('admin-security-status');
  const eventNames = {
    page_access: '관리자 화면 접속',
    login_success: '로그인 성공',
    login_failure: '로그인 실패',
    login_limited: '로그인 시도 차단',
    request_blocked: '관리 요청 거부',
    logout: '로그아웃',
    content_saved: '콘텐츠 저장',
    content_failed: '콘텐츠 저장 실패',
    settings_changed: '보안 설정 변경',
    sessions_revoked: '다른 로그인 종료',
  };
  const dateFormat = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Seoul',
  });
  const countries = new Intl.DisplayNames(['ko'], { type: 'region' });
  let credential = null;
  let snapshot = null;
  let version = 0;
  let page = 0;
  let busy = false;
  const pageSize = 20;

  function showStatus(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function setBusy(value) {
    busy = value;
    for (const control of content.querySelectorAll('button, select')) {
      control.disabled = value;
    }
    if (!value && snapshot) {
      renderEvents();
    }
  }

  function selectTab(name) {
    for (const button of dialog.querySelectorAll('[data-security-tab]')) {
      button.setAttribute('aria-pressed', String(button.dataset.securityTab === name));
    }
    element('security-settings-panel').hidden = name !== 'settings';
    element('security-events-panel').hidden = name !== 'events';
  }

  function renderEvents() {
    const filter = element('security-event-filter').value;
    const entries = snapshot.events.filter((entry) => filter === 'all' || entry.kind === filter);
    const pages = Math.max(1, Math.ceil(entries.length / pageSize));
    page = Math.min(page, pages - 1);
    const list = element('security-events');
    list.replaceChildren();
    for (const entry of entries.slice(page * pageSize, (page + 1) * pageSize)) {
      const item = document.createElement('li');
      item.className = 'security-event';
      item.dataset.failed = String(entry.status >= 400);
      const name = document.createElement('strong');
      name.textContent = eventNames[entry.kind] || '관리 작업';
      const time = document.createElement('time');
      time.dateTime = new Date(entry.time).toISOString();
      time.textContent = dateFormat.format(entry.time);
      const detail = document.createElement('small');
      const country = /^[A-Z]{2}$/.test(entry.country)
        ? countries.of(entry.country)
        : '국가 미확인';
      detail.textContent = `${entry.ip} · ${country} · ${entry.browser} · ${entry.path} · HTTP ${entry.status}`;
      item.append(name, time, detail);
      list.append(item);
    }
    element('security-events-summary').textContent = entries.length
      ? `${entries.length}건 · 한국 시간 · 최근 ${snapshot.settings.retentionDays}일, 최대 ${snapshot.maxEvents}건`
      : '표시할 기록이 없습니다. 기록은 이 기능이 적용된 이후부터 쌓입니다.';
    element('security-page').textContent = `${page + 1} / ${pages}`;
    element('security-previous').disabled = busy || page === 0;
    element('security-next').disabled = busy || page + 1 >= pages;
  }

  function validateSnapshot(data) {
    if (
      !data ||
      !Number.isSafeInteger(data.revision) ||
      !data.settings ||
      !Array.isArray(data.events) ||
      data.events.length > 500 ||
      !Number.isInteger(data.activeSessions) ||
      data.maxEvents !== 500 ||
      !data.events.every(
        (entry) =>
          Number.isFinite(entry.time) &&
          Number.isFinite(new Date(entry.time).getTime()) &&
          Number.isInteger(entry.status) &&
          typeof entry.kind === 'string' &&
          ['ip', 'country', 'browser', 'path'].every(
            (key) => typeof entry[key] === 'string' && entry[key].length <= 100,
          ),
      )
    ) {
      throw new Error('보안 정보를 확인하지 못했습니다. 다시 불러와 주세요.');
    }
    for (const input of form.querySelectorAll('select')) {
      if (
        ![...input.options].some((option) => Number(option.value) === data.settings[input.name])
      ) {
        throw new Error('보안 설정값을 확인하지 못했습니다.');
      }
    }
    return data;
  }

  function settingsFromForm() {
    return Object.fromEntries(
      [...form.querySelectorAll('select')].map((input) => [input.name, Number(input.value)]),
    );
  }

  function changed() {
    return (
      snapshot &&
      Object.entries(settingsFromForm()).some(([key, value]) => value !== snapshot.settings[key])
    );
  }

  async function refresh(requestVersion, updateSettings = true) {
    const data = validateSnapshot(await AdminAuth.request('/security', credential));
    if (requestVersion !== version || !dialog.open) {
      return;
    }
    // 기록만 갱신할 때는 편집 중인 설정과 기준 revision을 보존합니다.
    snapshot =
      updateSettings || !snapshot
        ? data
        : { ...data, settings: snapshot.settings, revision: snapshot.revision };
    if (updateSettings) {
      for (const input of form.querySelectorAll('select')) {
        input.value = String(snapshot.settings[input.name]);
      }
    }
    element('security-session-count').textContent = `현재 유효한 로그인 ${data.activeSessions}개`;
    content.hidden = false;
    renderEvents();
  }

  async function perform(operation, message) {
    if (busy || !credential) {
      return;
    }
    const requestVersion = version;
    setBusy(true);
    showStatus('처리 중입니다…');
    try {
      await operation(requestVersion);
      if (requestVersion === version && dialog.open) {
        showStatus(message);
      }
    } catch (error) {
      if (requestVersion === version && dialog.open) {
        if (error.status === 401) {
          clear();
          element('status').textContent = error.message;
          AdminAuth.focusLogin();
        } else {
          showStatus(error.message, true);
        }
      }
    } finally {
      if (requestVersion === version) {
        setBusy(false);
      }
    }
  }

  async function open(value) {
    clear();
    dialog.showModal();
    if (value?.type !== 'session' || location.origin !== PortfolioConfig.admin.origin) {
      showStatus(
        '보안 설정과 기록은 전용 관리자에서 아이디·비밀번호로 로그인한 후 확인할 수 있습니다.',
      );
      const link = element('security-server-link');
      link.href = PortfolioConfig.admin.origin + '/admin/';
      link.hidden = false;
      return;
    }
    credential = value;
    await perform((requestVersion) => refresh(requestVersion), '보안 정보를 불러왔습니다.');
  }

  function clear() {
    version += 1;
    credential = null;
    snapshot = null;
    busy = false;
    page = 0;
    form.reset();
    element('security-events').replaceChildren();
    element('security-events-summary').textContent = '';
    element('security-session-count').textContent = '';
    element('security-page').textContent = '';
    element('security-event-filter').value = 'all';
    element('security-server-link').hidden = true;
    content.hidden = true;
    showStatus('');
    selectTab('settings');
    setBusy(false);
    if (dialog.open) {
      dialog.close();
    }
  }

  dialog.addEventListener('close', () => {
    if (!dialog.open) {
      clear();
    }
  });
  for (const button of dialog.querySelectorAll('[data-security-tab]')) {
    button.addEventListener('click', () => selectTab(button.dataset.securityTab));
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!snapshot || busy) {
      return;
    }
    const settings = settingsFromForm();
    if (settings.idleMinutes > settings.sessionMinutes) {
      showStatus('유휴 시간은 최대 로그인 시간 이하여야 합니다.', true);
      return;
    }
    if (
      settings.retentionDays < snapshot.settings.retentionDays &&
      !confirm('보관 기간을 줄이면 해당 기간보다 오래된 기록은 삭제됩니다. 저장할까요?')
    ) {
      return;
    }
    perform(async (requestVersion) => {
      const saved = await AdminAuth.request('/security', credential, {
        method: 'PUT',
        body: { revision: snapshot.revision, settings },
      });
      if (requestVersion === version && dialog.open) {
        snapshot.revision = saved.revision;
        snapshot.settings = saved.settings;
        await refresh(requestVersion);
      }
    }, '보안 설정을 저장했습니다. 서버에 적용되었습니다.');
  });
  element('security-reload').addEventListener('click', () => {
    if (changed() && !confirm('저장하지 않은 보안 설정을 버리고 다시 불러올까요?')) {
      return;
    }
    perform((requestVersion) => refresh(requestVersion), '최신 보안 설정을 불러왔습니다.');
  });
  element('security-refresh').addEventListener('click', () => {
    perform((requestVersion) => refresh(requestVersion, false), '접속 기록을 갱신했습니다.');
  });
  element('security-revoke').addEventListener('click', () => {
    if (
      !confirm('현재 로그인을 제외한 모든 로그인을 종료할까요? 다른 기기는 다시 로그인해야 합니다.')
    ) {
      return;
    }
    perform(async (requestVersion) => {
      await AdminAuth.request('/security/revoke', credential, { method: 'POST', body: {} });
      if (requestVersion === version && dialog.open) {
        await refresh(requestVersion, false);
      }
    }, '다른 로그인을 모두 종료했습니다.');
  });
  element('security-event-filter').addEventListener('change', () => {
    page = 0;
    renderEvents();
  });
  element('security-previous').addEventListener('click', () => {
    page -= 1;
    renderEvents();
  });
  element('security-next').addEventListener('click', () => {
    page += 1;
    renderEvents();
  });
  window.AdminSecurityPanel = { open, clear };
})();
