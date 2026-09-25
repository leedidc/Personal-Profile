const articleId = new URLSearchParams(location.search).get('id');
let viewState = 'loading';
const viewMessages = { loading: ['글을 불러오는 중입니다…', 'Loading article…'], missing: ['게시글을 찾을 수 없습니다.', 'Article not found.'], error: ['글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Unable to load this article. Please try again shortly.'], ready: ['', ''] };
function renderViewStatus() { document.getElementById('article-status').textContent = window.portfolioI18n.text(...viewMessages[viewState]); }
async function loadArticle() {
  if (!articleId) { viewState = 'missing'; renderViewStatus(); return; }
  renderViewStatus();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://profile-article-database.leedidc1227.workers.dev/articles/' + encodeURIComponent(articleId), { signal: controller.signal });
    if (response.status === 404) { viewState = 'missing'; renderViewStatus(); return; }
    if (!response.ok) throw new Error('Article request failed');
    const article = await response.json();
    if (!article || typeof article.title !== 'string' || typeof article.content !== 'string') throw new Error('Invalid article');
    document.getElementById('title').textContent = article.title;
    document.getElementById('meta').textContent = [article.category, article.created_at].filter(Boolean).join(' · ');
    // Content is HTML authored through the existing authenticated administration API.
    document.getElementById('content').innerHTML = article.content;
    document.title = article.title + ' | Chanhyeong Lee';
    viewState = 'ready'; renderViewStatus();
  } catch (_) { viewState = 'error'; renderViewStatus(); }
  finally { clearTimeout(timeout); }
}
document.addEventListener('languagechange', renderViewStatus);
loadArticle();