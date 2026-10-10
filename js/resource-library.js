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
  const pagination = document.getElementById('resource-pagination');
  const pageStatus = document.getElementById('resource-page-status');
  const previous = document.getElementById('resource-previous');
  const next = document.getElementById('resource-next');
  const sort = document.getElementById('resource-sort');
  const pageSize = 12;
  const sourceHosts = new Set([
    'isms-p.or.kr',
    'www.privacy.go.kr',
    'pipc.go.kr',
    'www.kisa.or.kr',
    'www.krcert.or.kr',
    'isds.kisa.or.kr',
    'www.sen.go.kr',
  ]);
  const fileFormats = new Set(['PDF', 'HWP', 'HWPX', 'XLS', 'XLSX', 'ZIP', 'PPTX']);
  let catalog;
  let selectedCategory = 'all';
  let currentPage = 1;

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
        !resource.keywords.every((word) => isText(word, 60)) ||
        !Array.isArray(resource.downloads) ||
        resource.downloads.length === 0 ||
        resource.downloads.length > 10 ||
        !resource.downloads.every(
          (file) =>
            file &&
            isText(file.label, 200) &&
            isText(file.url, 1500) &&
            isOfficialUrl(file.url) &&
            fileFormats.has(file.format) &&
            (file.viaSourcePage === undefined ||
              (file.viaSourcePage === true && file.url === resource.sourceUrl)),
        )
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

  function createDownloadLink(file, title, primary) {
    const action = file.viaSourcePage ? '공식 페이지에서 다운로드 ↗' : file.format + ' 다운로드 ↓';
    const link = createElement(
      'a',
      primary ? 'resource-download' : '',
      primary ? action : file.label,
    );
    link.href = file.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', title + ' — ' + file.label + ' 다운로드');
    return link;
  }

  function createDownloads(resource) {
    const actions = createElement('div', 'resource-downloads');
    actions.append(createDownloadLink(resource.downloads[0], resource.title, true));
    if (resource.downloads.length > 1) {
      const details = createElement('details', 'resource-extra-files');
      const summary = createElement(
        'summary',
        '',
        '추가 파일 ' + (resource.downloads.length - 1) + '개',
      );
      const files = createElement('ul', '');
      for (const file of resource.downloads.slice(1)) {
        const item = createElement('li', '');
        item.append(createDownloadLink(file, resource.title, false));
        files.append(item);
      }
      details.append(summary, files);
      actions.append(details);
    }
    return actions;
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
      createDownloads(resource),
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
    if (sort.value === 'recent') {
      visible.sort((first, second) => second.publishedOn.localeCompare(first.publishedOn));
    } else if (sort.value === 'title') {
      visible.sort((first, second) => first.title.localeCompare(second.title, 'ko'));
    }
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const offset = (currentPage - 1) * pageSize;
    list.replaceChildren(...visible.slice(offset, offset + pageSize).map(createResourceCard));
    pagination.hidden = totalPages <= 1;
    previous.disabled = currentPage === 1;
    next.disabled = currentPage === totalPages;
    pageStatus.textContent = currentPage + ' / ' + totalPages + ' 페이지';
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
        resetPage();
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
      sort.value = 'default';
      currentPage = 1;
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
      pagination.hidden = true;
      status.textContent = '자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      retry.hidden = false;
    }
  }

  function resetPage() {
    currentPage = 1;
    renderList();
  }

  function changePage(direction) {
    currentPage += direction;
    renderList();
    const heading = document.getElementById('resource-list-title');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start' });
  }

  filters.addEventListener('submit', (event) => event.preventDefault());
  search.addEventListener('input', resetPage);
  sort.addEventListener('change', resetPage);
  previous.addEventListener('click', () => changePage(-1));
  next.addEventListener('click', () => changePage(1));
  document.getElementById('reset-resource-filters').addEventListener('click', () => {
    search.value = '';
    selectedCategory = 'all';
    sort.value = 'default';
    resetPage();
    search.focus();
  });
  retry.addEventListener('click', load);
  load();
})();
