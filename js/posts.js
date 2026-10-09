(() => {
  'use strict';
  const { createElement, validateIndex, validateDocument, categoryName, renderPost } = Posts;
  const status = document.getElementById('posts-status');
  const reader = document.getElementById('post-content');
  const categoryFilter = document.getElementById('category-filter');
  const search = document.getElementById('post-search');
  const retry = document.getElementById('retry-posts');
  let index;

  async function readJson(path) {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error('글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    return response.json();
  }

  function renderList() {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = index.posts
      .filter(
        (post) =>
          (categoryFilter.value === 'all' || post.categoryId === categoryFilter.value) &&
          post.title.toLocaleLowerCase().includes(query),
      )
      .sort((first, second) => second.date.localeCompare(first.date));
    const body = document.getElementById('posts-list');
    body.replaceChildren();
    for (const post of visible) {
      const row = createElement('tr');
      const title = createElement('th');
      title.scope = 'row';
      const link = createElement('a', 'post-title-link', post.title);
      link.href = './view.html?id=' + encodeURIComponent(post.id);
      title.append(link);
      const category = createElement('td');
      category.append(createElement('span', 'post-category', categoryName(index, post.categoryId)));
      const date = createElement('td');
      const time = createElement('time', '', post.date.replaceAll('-', '.'));
      time.dateTime = post.date;
      date.append(time);
      row.append(title, category, date);
      body.append(row);
    }
    document.getElementById('posts-table-wrap').hidden = !visible.length;
    status.textContent = visible.length
      ? visible.length + '개의 글'
      : index.posts.length
        ? '검색 결과가 없습니다.'
        : '아직 등록된 글이 없습니다.';
  }

  async function load() {
    retry.hidden = true;
    status.textContent = '글을 불러오는 중입니다.';
    try {
      index = validateIndex(await readJson('../data/posts/index.json'));
      if (reader) {
        const id = new URLSearchParams(location.search).get('id');
        const metadata = index.posts.find((post) => post.id === id);
        if (!metadata) {
          throw new Error('글을 찾을 수 없습니다. 삭제되었거나 주소가 변경되었을 수 있습니다.');
        }
        const documentData = validateDocument(
          await readJson('../data/posts/' + metadata.id + '.json'),
        );
        if (documentData.id !== metadata.id) {
          throw new Error('글 주소와 본문이 일치하지 않습니다.');
        }
        renderPost(reader, metadata, documentData, index);
        reader.hidden = false;
        status.textContent = '';
        document.title = metadata.title + ' | 글';
      } else {
        categoryFilter.replaceChildren(new Option('전체 분류', 'all'));
        for (const category of index.categories) {
          categoryFilter.add(new Option(category.name, category.id));
        }
        if (index.posts.some((post) => !post.categoryId)) {
          categoryFilter.add(new Option('미분류', ''));
        }
        document.getElementById('filters').hidden = false;
        renderList();
      }
    } catch (error) {
      status.textContent = error.message;
      retry.hidden = false;
    }
  }
  categoryFilter?.addEventListener('change', renderList);
  search?.addEventListener('input', renderList);
  document.getElementById('filters')?.addEventListener('submit', (event) => event.preventDefault());
  retry.addEventListener('click', load);
  load();
})();
