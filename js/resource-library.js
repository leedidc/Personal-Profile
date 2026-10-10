(() => {
  'use strict';

  const status = document.getElementById('resources-status');
  const list = document.getElementById('resource-list');
  const filters = document.getElementById('resource-filters');
  const categories = document.getElementById('resource-categories');
  const search = document.getElementById('resource-search');
  const retry = document.getElementById('retry-resources');
  const empty = document.getElementById('resources-empty');
  const checked = document.getElementById('resources-checked');
  const sourceHosts = new Set(['isms-p.or.kr', 'www.privacy.go.kr', 'www.kisa.or.kr']);
  let catalog;
  let selectedCategory = 'all';

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function isText(value, maximum) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
  }

  function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function isOfficialUrl(value) {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        sourceHosts.has(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port
      );
    } catch {
      return false;
    }
  }

  function validateCatalog(data) {
    const invalid = () => {
      throw new Error('자료 목록의 형식을 확인할 수 없습니다.');
    };
    if (
      !data ||
      !isDate(data.checkedOn) ||
      !Array.isArray(data.categories) ||
      data.categories.length > 30 ||
      !Array.isArray(data.resources) ||
      data.resources.length > 300
    ) {
      invalid();
    }
    const categoryIds = new Set();
    const resourceIds = new Set();
    const validId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
    for (const category of data.categories) {
      if (
        !category ||
        !validId(category.id) ||
        category.id === 'all' ||
        categoryIds.has(category.id) ||
        !isText(category.name, 60)
      ) {
        invalid();
      }
      categoryIds.add(category.id);
    }
    for (const resource of data.resources) {
      if (
        !resource ||
        !validId(resource.id) ||
        resourceIds.has(resource.id) ||
        !categoryIds.has(resource.categoryId) ||
        !isText(resource.title, 180) ||
        !isText(resource.summary, 500) ||
        !isText(resource.edition, 100) ||
        !isText(resource.sourceName, 120) ||
        !isText(resource.sourceUrl, 1500) ||
        !isOfficialUrl(resource.sourceUrl) ||
        !isDate(resource.publishedOn) ||
        resource.publishedOn > data.checkedOn ||
        !Array.isArray(resource.keywords) ||
        resource.keywords.length > 20 ||
        !resource.keywords.every((word) => isText(word, 60))
      ) {
        invalid();
      }
      resourceIds.add(resource.id);
    }
    return data;
  }

  function categoryName(id) {
    return catalog.categories.find((category) => category.id === id).name;
  }

  function createResourceCard(resource) {
    const card = createElement('li', 'resource-card');
    const metadata = createElement('div', 'resource-card-top');
    metadata.append(
      createElement('span', 'resource-category', categoryName(resource.categoryId)),
      createElement('span', 'resource-edition', resource.edition),
    );
    const source = createElement('p', 'resource-source');
    const link = createElement('a', '', resource.sourceName + ' ↗');
    link.href = resource.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute(
      'aria-label',
      resource.title + ' — ' + resource.sourceName + ' 공식 원문 (새 탭)',
    );
    source.append(createElement('span', '', '출처'), link);
    const published = createElement('p', 'resource-published', '공식 게시일 ');
    const time = createElement('time', '', resource.publishedOn.replaceAll('-', '.'));
    time.dateTime = resource.publishedOn;
    published.append(time);
    card.append(
      metadata,
      createElement('h3', '', resource.title),
      createElement('p', 'resource-summary', resource.summary),
      source,
      published,
    );
    return card;
  }

  function renderList() {
    const terms = search.value.trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean);
    const visible = catalog.resources.filter((resource) => {
      const text = [
        resource.title,
        resource.summary,
        resource.sourceName,
        resource.edition,
        categoryName(resource.categoryId),
        ...resource.keywords,
      ]
        .join(' ')
        .toLocaleLowerCase('ko');
      return (
        (selectedCategory === 'all' || resource.categoryId === selectedCategory) &&
        terms.every((term) => text.includes(term))
      );
    });
    list.replaceChildren(...visible.map(createResourceCard));
    for (const button of categories.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.category === selectedCategory));
    }
    status.textContent = visible.length + ' / ' + catalog.resources.length + '개 자료';
    empty.hidden = visible.length > 0 || catalog.resources.length === 0;
    if (!catalog.resources.length) {
      status.textContent = '아직 등록된 자료가 없습니다.';
    }
  }

  function renderCategories() {
    categories.replaceChildren();
    for (const category of [{ id: 'all', name: '전체' }, ...catalog.categories]) {
      const count = catalog.resources.filter(
        (resource) => category.id === 'all' || resource.categoryId === category.id,
      ).length;
      const button = createElement('button', '', category.name);
      button.type = 'button';
      button.dataset.category = category.id;
      button.setAttribute('aria-controls', 'resource-list');
      const badge = createElement('span', 'resource-category-count', String(count));
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
      button.addEventListener('click', () => {
        selectedCategory = category.id;
        renderList();
      });
      categories.append(button);
    }
  }

  async function load() {
    retry.hidden = true;
    status.textContent = '자료를 불러오는 중입니다.';
    try {
      const response = await fetch('../data/resources.json', {
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error('자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      catalog = validateCatalog(await response.json());
      selectedCategory = 'all';
      search.value = '';
      renderCategories();
      renderList();
      checked.textContent = '출처 확인 ' + catalog.checkedOn.replaceAll('-', '.');
      checked.hidden = false;
      filters.hidden = false;
    } catch {
      list.replaceChildren();
      filters.hidden = true;
      checked.hidden = true;
      empty.hidden = true;
      status.textContent = '자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      retry.hidden = false;
    }
  }

  filters.addEventListener('submit', (event) => event.preventDefault());
  search.addEventListener('input', renderList);
  document.getElementById('reset-resource-filters').addEventListener('click', () => {
    search.value = '';
    selectedCategory = 'all';
    renderList();
    search.focus();
  });
  retry.addEventListener('click', load);
  load();
})();
