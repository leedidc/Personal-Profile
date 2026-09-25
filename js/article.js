const articleList = document.getElementById('article-list');
let articleState = 'loading';
const articleMessages = { loading: ['글을 불러오는 중입니다…', 'Loading articles…'], empty: ['아직 등록된 글이 없습니다.', 'No articles yet.'], error: ['글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Unable to load articles. Please try again shortly.'] };
function renderArticleStatus() {
  if (articleState === 'ready') return;
  articleList.replaceChildren();
  const status = document.createElement('p');
  status.textContent = window.portfolioI18n.text(...articleMessages[articleState]);
  articleList.append(status);
  if (articleState === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'button';
    retry.textContent = window.portfolioI18n.text('다시 시도', 'Retry');
    retry.addEventListener('click', loadArticles);
    articleList.append(retry);
  }
}
async function loadArticles() {
  articleState = 'loading'; renderArticleStatus();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://profile-article-database.leedidc1227.workers.dev/articles', { signal: controller.signal });
    if (!response.ok) throw new Error('Article request failed');
    const articles = await response.json();
    if (!Array.isArray(articles)) throw new Error('Invalid articles');
    if (!articles.length) { articleState = 'empty'; renderArticleStatus(); return; }
    articleState = 'ready'; articleList.replaceChildren();
    articles.forEach(article => {
      const card = document.createElement('article'); card.className = 'article-card';
      const meta = document.createElement('div'); meta.className = 'article-meta';
      const category = document.createElement('span'); category.textContent = article.category || '';
      const date = document.createElement('span'); date.textContent = article.created_at || '';
      meta.append(category, date);
      const title = document.createElement('h2');
      const link = document.createElement('a');
      link.href = 'article-view.html?id=' + encodeURIComponent(article.id); link.textContent = article.title;
      title.append(link); card.append(meta, title); articleList.append(card);
    });
  } catch (_) { articleState = 'error'; renderArticleStatus(); }
  finally { clearTimeout(timeout); }
}
document.addEventListener('languagechange', renderArticleStatus);
loadArticles();