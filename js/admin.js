const API = 'https://profile-article-database.leedidc1227.workers.dev/articles';
const adminText = (ko, en) => window.portfolioI18n.text(ko, en);
const statusElement = document.getElementById('admin-status');
let adminStatus = ['', ''];
let adminArticles = [];
let memoryToken = '';
let quill;
function status(ko, en) { adminStatus = [ko, en]; statusElement.textContent = adminText(ko, en); }
function getToken() { try { return localStorage.getItem('admin_token') || memoryToken; } catch (_) { return memoryToken; } }
function headers() { return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }; }
function renderAdminArticles() {
  const list = document.getElementById('list'); list.replaceChildren();
  adminArticles.forEach(article => {
    const card = document.createElement('article'); card.className = 'compact-card';
    const title = document.createElement('h3'); title.textContent = article.title;
    const date = document.createElement('p'); date.className = 'muted'; date.textContent = article.created_at || '';
    const actions = document.createElement('div'); actions.className = 'actions';
    const edit = document.createElement('button'); edit.className = 'button'; edit.type = 'button'; edit.textContent = adminText('수정', 'Edit'); edit.addEventListener('click', () => editArticle(article.id));
    const remove = document.createElement('button'); remove.className = 'button'; remove.type = 'button'; remove.textContent = adminText('삭제', 'Delete'); remove.addEventListener('click', () => deleteArticle(article.id));
    actions.append(edit, remove); card.append(title, date, actions); list.append(card);
  });
}
async function loadArticles() {
  try {
    const response = await fetch(API); if (!response.ok) throw new Error();
    const articles = await response.json(); if (!Array.isArray(articles)) throw new Error();
    adminArticles = articles; renderAdminArticles();
  } catch (_) { status('목록을 불러오지 못했습니다.', 'Unable to load articles.'); }
}
function checkAuth() { document.getElementById('panel').hidden = !getToken(); if (getToken()) loadArticles(); }
document.getElementById('loginBox').addEventListener('submit', async event => {
  event.preventDefault();
  const token = document.getElementById('tokenInput').value.trim(); if (!token) return;
  try {
    const response = await fetch(API.replace('/articles', '/verify-admin'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    if (!response.ok) { status('토큰을 확인해 주세요.', 'Please check your token.'); return; }
    memoryToken = token; try { localStorage.setItem('admin_token', token); } catch (_) {}
    document.getElementById('tokenInput').value = ''; status('로그인했습니다.', 'Logged in.'); checkAuth();
  } catch (_) { status('서버에 연결하지 못했습니다.', 'Unable to connect to the server.'); }
});
document.getElementById('logout').addEventListener('click', () => { memoryToken = ''; try { localStorage.removeItem('admin_token'); } catch (_) {} document.getElementById('panel').hidden = true; adminArticles = []; renderAdminArticles(); status('로그아웃했습니다.', 'Logged out.'); });
document.getElementById('create').addEventListener('click', async () => {
  const title = document.getElementById('title').value.trim();
  if (!quill || !title || (!quill.getText().trim() && !quill.root.querySelector('img'))) { status('제목과 본문을 입력해 주세요.', 'Enter a title and content.'); return; }
  const button = document.getElementById('create'); button.disabled = true;
  try {
    const response = await fetch(API, { method: 'POST', headers: headers(), body: JSON.stringify({ title, content: quill.root.innerHTML }) });
    if (!response.ok) throw new Error();
    document.getElementById('title').value = ''; quill.setContents([]); status('등록했습니다.', 'Article created.'); await loadArticles();
  } catch (_) { status('등록하지 못했습니다. 인증 상태를 확인해 주세요.', 'Unable to create the article. Check your authentication.'); }
  finally { button.disabled = false; }
});
async function editArticle(id) {
  const title = prompt(adminText('새 제목', 'New title')); if (!title) return;
  const content = prompt(adminText('새 본문 (HTML)', 'New content (HTML)')); if (!content) return;
  try { const response = await fetch(API + '/' + encodeURIComponent(id), { method: 'PUT', headers: headers(), body: JSON.stringify({ title, content }) }); if (!response.ok) throw new Error(); status('수정했습니다.', 'Article updated.'); await loadArticles(); }
  catch (_) { status('수정하지 못했습니다.', 'Unable to update the article.'); }
}
async function deleteArticle(id) {
  if (!confirm(adminText('이 게시글을 삭제할까요?', 'Delete this article?'))) return;
  try { const response = await fetch(API + '/' + encodeURIComponent(id), { method: 'DELETE', headers: headers() }); if (!response.ok) throw new Error(); status('삭제했습니다.', 'Article deleted.'); await loadArticles(); }
  catch (_) { status('삭제하지 못했습니다.', 'Unable to delete the article.'); }
}
document.addEventListener('languagechange', () => { statusElement.textContent = adminText(...adminStatus); renderAdminArticles(); });
if (typeof Quill === 'function') {
  quill = new Quill('#editor', { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], [{ header: [1, 2, false] }], ['link', 'image']] } });
  quill.root.setAttribute('aria-labelledby', 'editor-label');
} else { document.getElementById('create').disabled = true; status('편집기를 불러오지 못했습니다. 페이지를 새로고침해 주세요.', 'Unable to load the editor. Please reload the page.'); }
checkAuth();