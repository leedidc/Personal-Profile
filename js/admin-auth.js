(() => {
  'use strict';
  const endpoint = '/api/admin';
  const form = document.getElementById('login-form');
  const { origin: adminOrigin, publicOrigin } = PortfolioConfig.admin;
  let method = 'token';
  let passwordReady = false;

  async function request(path, credential, options = {}) {
    let response;
    try {
      response = await fetch(endpoint + path, {
        method: options.method || 'GET',
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(credential?.csrf ? { 'X-CSRF-Token': credential.csrf } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'same-origin',
        mode: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(
          options.method === 'PUT' || path === '/posts/save' ? 120000 : 20000,
        ),
      });
    } catch {
      throw new Error('인증 서버에 연결하지 못했습니다. 편집 내용은 유지됩니다.');
    }
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      throw new Error(
        '비밀번호 로그인 서버가 연결되지 않았습니다. GitHub 토큰 로그인을 이용해 주세요.',
      );
    }
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && credential?.type === 'session') {
        form.hidden = false;
      }
      const error = new Error(
        typeof data.error === 'string' ? data.error : '요청을 처리하지 못했습니다.',
      );
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function selectMethod(value) {
    method = value;
    for (const button of form.querySelectorAll('[data-login-method]')) {
      button.setAttribute('aria-pressed', String(button.dataset.loginMethod === method));
    }
    for (const name of ['password', 'token']) {
      const fields = document.getElementById('login-' + name + '-fields');
      fields.hidden = name !== method;
      for (const input of fields.querySelectorAll('input')) {
        input.disabled = fields.hidden;
      }
    }
    document.getElementById('token').value = '';
    document.getElementById('password').value = '';
  }

  for (const button of form.querySelectorAll('[data-login-method]')) {
    button.addEventListener('click', () => {
      if (
        button.dataset.loginMethod === 'password' &&
        !passwordReady &&
        location.origin === publicOrigin
      ) {
        const path = location.pathname.endsWith('posts.html') ? '/admin/posts.html' : '/admin/';
        location.assign(adminOrigin + path);
        return;
      }
      selectMethod(button.dataset.loginMethod);
    });
  }

  if (location.origin === adminOrigin) {
    for (const link of document.querySelectorAll('[data-public-path]')) {
      link.href = publicOrigin + link.dataset.publicPath;
    }
  }

  function offerPasswordLogin() {
    const notice = document.getElementById('password-login-notice');
    notice.hidden = false;
    if (location.origin === publicOrigin) {
      form.querySelector('[data-login-method="password"]').disabled = false;
      notice.textContent = '비밀번호 로그인은 전용 관리자 화면에서 열립니다.';
      if (location.pathname.endsWith('posts.html')) {
        notice.textContent += ' 이곳에 보관한 초안은 토큰 로그인 후 내보내기로 옮길 수 있습니다.';
      }
    }
  }

  async function login() {
    if (method === 'token') {
      const token = document.getElementById('token').value.trim();
      document.getElementById('token').value = '';
      if (!token) {
        throw new Error('GitHub 토큰을 입력해 주세요.');
      }
      return token;
    }
    if (!passwordReady) {
      throw new Error('비밀번호 로그인 서버 연결을 확인해 주세요.');
    }
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    document.getElementById('password').value = '';
    const session = await request('/login', null, { method: 'POST', body: { username, password } });
    if (!/^[a-f0-9]{64}$/.test(session.csrf) || !Number.isFinite(session.expires)) {
      throw new Error('로그인 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
    }
    return { type: 'session', csrf: session.csrf };
  }

  async function logout(credential) {
    if (credential?.type === 'session') {
      try {
        await request('/logout', credential, { method: 'POST', body: {} });
      } catch (error) {
        if (error.status !== 401) {
          throw error;
        }
      }
    }
  }

  async function restoreSession() {
    if (location.origin !== adminOrigin) {
      return null;
    }
    try {
      const session = await request('/session');
      if (!/^[a-f0-9]{64}$/.test(session.csrf) || !Number.isFinite(session.expires)) {
        return null;
      }
      selectMethod('password');
      return { type: 'session', csrf: session.csrf };
    } catch {
      return null;
    }
  }

  function focusLogin() {
    document.getElementById(method === 'token' ? 'token' : 'username').focus();
  }

  selectMethod('token');
  request('/status')
    .then((status) => {
      passwordReady = status.passwordLogin === true;
      form.querySelector('[data-login-method="password"]').disabled = !passwordReady;
      document.getElementById('password-login-notice').hidden = passwordReady;
      if (passwordReady && location.origin === adminOrigin) {
        selectMethod('password');
      } else if (!passwordReady) {
        offerPasswordLogin();
      }
    })
    .catch(() => {
      offerPasswordLogin();
    });
  window.AdminAuth = { login, logout, restoreSession, request, focusLogin };
})();
