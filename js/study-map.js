(() => {
  'use strict';

  const section = document.getElementById('study-map');
  if (!section) {
    return;
  }

  const { createElement, categoryName } = Posts;
  const canvas = document.getElementById('study-map-canvas');
  const connections = document.getElementById('study-map-connections');
  const nodes = document.getElementById('study-map-nodes');
  const root = document.getElementById('study-map-root');
  const results = document.getElementById('study-map-results');
  const heading = document.getElementById('study-map-heading');
  const summary = document.getElementById('study-map-summary');
  const back = document.getElementById('study-map-back');
  const pagination = document.getElementById('study-map-pagination');
  const pageLabel = document.getElementById('study-map-page');
  const previous = document.getElementById('study-map-previous');
  const next = document.getElementById('study-map-next');
  let index;
  let posts = [];
  let categoryId = 'all';
  let selectedPostId = '';
  let page = 0;
  let pageSize = 6;
  let selectCategory;

  function entries() {
    if (categoryId !== 'all') {
      return posts.map((post) => ({ id: post.id, label: post.title, post }));
    }
    const categories = [...index.categories];
    if (index.posts.some((post) => !post.categoryId)) {
      categories.push({ id: '', name: '미분류' });
    }
    const searching = Boolean(document.getElementById('post-search').value.trim());
    return categories
      .map((category) => ({
        id: category.id,
        label: category.name,
        count: posts.filter((post) => post.categoryId === category.id).length,
      }))
      .filter((entry) => !searching || entry.count);
  }

  function positionFor(position, count, width) {
    const height = 440;
    const center = { x: width / 2, y: height / 2 };
    // 좁은 화면은 네 모서리에 배치해 글씨와 터치 영역을 줄이지 않습니다.
    if (width < 520) {
      const positions = [
        { x: 68, y: 72 },
        { x: width - 68, y: 72 },
        { x: width - 68, y: height - 72 },
        { x: 68, y: height - 72 },
      ];
      return { center, point: positions[position] };
    }
    const angle = -Math.PI / 2 + (position * Math.PI * 2) / Math.max(count, 1);
    return {
      center,
      point: {
        x: center.x + (center.x - 90) * Math.cos(angle),
        y: center.y + 164 * Math.sin(angle),
      },
    };
  }

  function drawConnection(center, point, active) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', center.x);
    line.setAttribute('y1', center.y);
    line.setAttribute('x2', point.x);
    line.setAttribute('y2', point.y);
    if (active) {
      line.classList.add('is-selected');
    }
    connections.append(line);
  }

  function renderResults(visibleEntries) {
    results.replaceChildren();
    heading.textContent = categoryId === 'all' ? '최근 공부 글' : categoryName(index, categoryId);
    let related =
      categoryId === 'all' ? posts.slice(0, 4) : visibleEntries.map((entry) => entry.post);
    if (selectedPostId) {
      related = related.filter((post) => post.id === selectedPostId);
    }
    if (!related.length) {
      results.append(
        createElement(
          'li',
          'study-map-empty',
          posts.length
            ? '주제를 선택해 연결된 글을 살펴보세요.'
            : document.getElementById('post-search').value.trim()
              ? '검색 결과가 없습니다.'
              : '아직 연결된 글이 없습니다.',
        ),
      );
      return;
    }
    for (const post of related) {
      const item = createElement('li', 'study-map-result');
      const link = createElement('a');
      link.href = './view.html?id=' + encodeURIComponent(post.id);
      link.append(
        createElement('span', 'study-map-result-category', categoryName(index, post.categoryId)),
      );
      link.append(createElement('strong', '', post.title));
      const meta = createElement('span', 'study-map-result-meta');
      const date = createElement('time', '', post.date.replaceAll('-', '.'));
      date.dateTime = post.date;
      meta.append(date, createElement('span', '', '글 읽기 ↗'));
      link.append(meta);
      item.append(link);
      results.append(item);
    }
  }

  function draw() {
    if (!index || section.hidden) {
      return;
    }
    const width = canvas.clientWidth;
    if (!width) {
      return;
    }
    pageSize = width < 520 ? 4 : 6;
    canvas.classList.toggle('is-compact', width < 520);
    const allEntries = entries();
    const pageCount = Math.max(1, Math.ceil(allEntries.length / pageSize));
    page = Math.min(page, pageCount - 1);
    const visibleEntries = allEntries.slice(page * pageSize, (page + 1) * pageSize);
    if (selectedPostId && !visibleEntries.some((entry) => entry.id === selectedPostId)) {
      selectedPostId = '';
    }
    nodes.replaceChildren();
    connections.replaceChildren();
    connections.setAttribute('viewBox', `0 0 ${width} 440`);
    root.textContent = categoryId === 'all' ? '공부 기록' : categoryName(index, categoryId);
    root.classList.toggle('is-category', categoryId !== 'all');
    summary.textContent = `${categoryId === 'all' ? allEntries.length + '개 주제 · ' : ''}${posts.length}개의 글`;
    back.hidden = categoryId === 'all';
    for (const [position, entry] of visibleEntries.entries()) {
      const { center, point } = positionFor(position, visibleEntries.length, width);
      const selected = Boolean(entry.post && entry.id === selectedPostId);
      drawConnection(center, point, selected);
      const button = createElement('button', 'study-map-node');
      button.type = 'button';
      button.dataset.id = entry.id;
      button.dataset.kind = entry.post ? 'post' : 'category';
      button.style.left = point.x + 'px';
      button.style.top = point.y + 'px';
      button.title = entry.label;
      button.setAttribute('aria-controls', 'study-map-results');
      button.setAttribute(
        'aria-label',
        entry.post ? entry.label + ' 선택' : `${entry.label}, ${entry.count}개의 글 보기`,
      );
      if (entry.post) {
        button.setAttribute('aria-pressed', String(selected));
      }
      const dot = createElement('span', 'study-map-dot');
      dot.setAttribute('aria-hidden', 'true');
      button.append(dot, createElement('span', 'study-map-node-label', entry.label));
      button.append(
        createElement(
          'span',
          'study-map-node-meta',
          entry.post ? entry.post.date.replaceAll('-', '.') : `${entry.count}개의 글`,
        ),
      );
      button.addEventListener('click', () => {
        if (!entry.post) {
          selectCategory(entry.id);
          back.focus({ preventScroll: true });
          return;
        }
        selectedPostId = selectedPostId === entry.id ? '' : entry.id;
        draw();
        Array.from(nodes.children)
          .find((node) => node.dataset.id === entry.id)
          ?.focus({ preventScroll: true });
        // 글 선택 후 링크가 화면 아래에 있으면 모바일에서도 바로 이어 읽을 수 있게 합니다.
        if (window.matchMedia('(max-width: 800px)').matches) {
          document
            .getElementById('study-map-detail')
            .scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
      });
      nodes.append(button);
    }
    pagination.hidden = pageCount <= 1;
    pageLabel.textContent = `${page + 1} / ${pageCount}`;
    previous.disabled = page === 0;
    next.disabled = page === pageCount - 1;
    renderResults(visibleEntries);
  }

  function changePage(direction) {
    page += direction;
    selectedPostId = '';
    draw();
    let target = direction > 0 ? next : previous;
    if (target.disabled) {
      target = direction > 0 ? previous : next;
    }
    target.focus();
  }

  back.addEventListener('click', () => {
    const previousCategory = categoryId;
    selectCategory('all');
    const categoryPosition = entries().findIndex((entry) => entry.id === previousCategory);
    page = Math.max(0, Math.floor(categoryPosition / pageSize));
    draw();
    Array.from(nodes.children)
      .find((node) => node.dataset.id === previousCategory)
      ?.focus({ preventScroll: true });
  });
  previous.addEventListener('click', () => changePage(-1));
  next.addEventListener('click', () => changePage(1));
  new ResizeObserver(draw).observe(canvas);

  window.StudyMap = {
    init(onCategorySelect) {
      selectCategory = onCategorySelect;
    },
    render(nextIndex, visiblePosts, nextCategoryId) {
      index = nextIndex;
      posts = visiblePosts;
      categoryId = nextCategoryId;
      selectedPostId = '';
      page = 0;
      draw();
    },
  };
})();
