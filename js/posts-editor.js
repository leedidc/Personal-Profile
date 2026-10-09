(() => {
  'use strict';
  const { createElement, validateIndex, validateMetadata, validateDocument } = Posts;
  const elements = Object.fromEntries(
    [...document.querySelectorAll('[id]')].map((element) => [element.id, element]),
  );
  let token = '';
  let snapshot;
  let workingIndex;
  let currentId;
  let editingBaseHead;
  let changed = false;
  let categoriesChanged = false;
  let busy = false;
  let draftTimer;
  let revision = 0;
  let editor;

  function showStatus(message, error = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('error', error);
  }

  function setBusy(value) {
    busy = value;
    elements.workspace.disabled = value;
    elements['new-post'].disabled = value;
    elements.logout.disabled = value;
    elements['login-button'].disabled = value;
    editor?.enable(!value);
  }

  async function perform(action) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function readMetadata() {
    return {
      id: currentId,
      title: elements['post-title'].value.trim(),
      date: elements['post-date'].value,
      categoryId: elements['post-category'].value,
    };
  }

  function readDocument() {
    return { version: 1, id: currentId, content: { ops: editor.getContents().ops } };
  }

  async function preserveDraft() {
    clearTimeout(draftTimer);
    if (!changed || !currentId) {
      return;
    }
    const savedRevision = revision;
    const documentData = validateDocument(readDocument(), true);
    await PostsDrafts.put({
      version: 1,
      metadata: readMetadata(),
      documentData,
      baseHead: editingBaseHead,
      categories: structuredClone(workingIndex.categories),
      savedAt: new Date().toISOString(),
    });
    if (savedRevision === revision) {
      elements['draft-status'].textContent = '이 브라우저에 초안 보관됨';
    }
    await renderDrafts();
  }

  function markChanged() {
    changed = true;
    revision += 1;
    elements['draft-status'].textContent = '초안 보관 중…';
    clearTimeout(draftTimer);
    draftTimer = setTimeout(
      () =>
        preserveDraft().catch((error) => {
          elements['draft-status'].textContent = '초안 보관 실패';
          showStatus(error.message, true);
        }),
      800,
    );
  }

  function renderCategories() {
    const selected = elements['post-category'].value;
    elements['post-category'].replaceChildren(new Option('미분류', ''));
    elements['category-list'].replaceChildren();
    for (const category of workingIndex.categories) {
      elements['post-category'].add(new Option(category.name, category.id));
      const row = createElement('div', 'category-row');
      const input = createElement('input');
      input.value = category.name;
      input.maxLength = 60;
      input.setAttribute('aria-label', '분류 이름: ' + category.name);
      input.addEventListener('input', () => {
        category.name = input.value;
        categoriesChanged = true;
        elements['save-categories'].disabled = false;
        const option = [...elements['post-category'].options].find(
          (item) => item.value === category.id,
        );
        option.textContent = input.value;
      });
      const remove = createElement('button', 'button small danger', '삭제');
      remove.type = 'button';
      remove.setAttribute('aria-label', category.name + ' 분류 삭제');
      remove.addEventListener('click', () =>
        perform(async () => {
          const drafts = await PostsDrafts.list();
          if (
            workingIndex.posts.some((post) => post.categoryId === category.id) ||
            elements['post-category'].value === category.id ||
            drafts.some((draft) => draft.metadata.categoryId === category.id)
          ) {
            throw new Error(
              '글 또는 초안에서 사용 중인 분류입니다. 먼저 해당 글의 분류를 바꿔 주세요.',
            );
          }
          workingIndex.categories = workingIndex.categories.filter(
            (item) => item.id !== category.id,
          );
          categoriesChanged = true;
          elements['save-categories'].disabled = false;
          renderCategories();
        }),
      );
      row.append(input, remove);
      elements['category-list'].append(row);
    }
    elements['post-category'].value = [...elements['post-category'].options].some(
      (option) => option.value === selected,
    )
      ? selected
      : '';
  }

  function renderPublished() {
    elements['published-list'].replaceChildren();
    for (const post of [...workingIndex.posts].sort((first, second) =>
      second.date.localeCompare(first.date),
    )) {
      const button = createElement('button', 'sidebar-post');
      button.type = 'button';
      button.setAttribute('aria-current', String(post.id === currentId));
      button.append(
        createElement('strong', '', post.title),
        createElement(
          'small',
          '',
          post.date + ' · ' + Posts.categoryName(workingIndex, post.categoryId),
        ),
      );
      button.addEventListener('click', () =>
        perform(async () => {
          await preserveDraft();
          const documentData = await PostsStorage.loadDocument(token, snapshot, post.id);
          openDocument(post, documentData, snapshot.headSha);
          showStatus('게시한 글을 불러왔습니다. 저장된 초안은 왼쪽 초안 목록에서 열 수 있습니다.');
        }),
      );
      elements['published-list'].append(button);
    }
    if (!workingIndex.posts.length) {
      elements['published-list'].append(
        createElement('p', 'editor-help', '아직 게시한 글이 없습니다.'),
      );
    }
  }

  async function renderDrafts() {
    const drafts = await PostsDrafts.list();
    elements['draft-list'].replaceChildren();
    for (const draft of drafts.sort((first, second) =>
      second.savedAt.localeCompare(first.savedAt),
    )) {
      const row = createElement('div', 'draft-row');
      const button = createElement('button', 'sidebar-post');
      button.type = 'button';
      button.append(
        createElement('strong', '', draft.metadata.title || '제목 없는 초안'),
        createElement('small', '', '초안 · ' + new Date(draft.savedAt).toLocaleString('ko-KR')),
      );
      button.addEventListener('click', () =>
        perform(async () => {
          if (currentId === draft.metadata.id && changed) {
            showStatus('현재 편집 중인 초안입니다.');
            return;
          }
          await preserveDraft();
          restoreDraft(draft);
        }),
      );
      const remove = createElement('button', 'button small danger', '삭제');
      remove.type = 'button';
      remove.setAttribute('aria-label', (draft.metadata.title || '제목 없는') + ' 초안 삭제');
      remove.addEventListener('click', () =>
        perform(async () => {
          if (!confirm('이 브라우저에 보관한 초안을 삭제할까요? 게시한 글은 유지됩니다.')) {
            return;
          }
          await PostsDrafts.remove(draft.metadata.id);
          if (currentId === draft.metadata.id) {
            newDocument();
          }
          await renderDrafts();
        }),
      );
      row.append(button, remove);
      elements['draft-list'].append(row);
    }
    if (!drafts.length) {
      elements['draft-list'].append(createElement('p', 'editor-help', '보관한 초안이 없습니다.'));
    }
  }

  function openDocument(metadata, documentData, baseHead) {
    clearTimeout(draftTimer);
    currentId = metadata.id;
    editingBaseHead = baseHead;
    changed = false;
    revision += 1;
    elements['post-title'].value = metadata.title;
    elements['post-date'].value = metadata.date;
    elements['post-category'].value = metadata.categoryId;
    editor.setContents(documentData.content, 'silent');
    editor.history.clear();
    editor.root.dataset.documentId = currentId;
    const published = workingIndex.posts.some((post) => post.id === currentId);
    elements['composer-title'].textContent = published ? '게시한 글 수정' : '새 글 작성';
    elements['publish-post'].textContent = published ? '수정 게시' : '게시하기';
    elements['delete-post'].hidden = !published;
    elements['draft-status'].textContent = published
      ? '게시한 내용'
      : '작성하면 초안이 자동 보관됩니다';
    renderPublished();
  }

  function restoreDraft(draft) {
    validateDocument(draft.documentData, true);
    const metadata = draft.metadata;
    if (
      draft.version !== 1 ||
      !metadata ||
      metadata.id !== draft.documentData.id ||
      typeof metadata.title !== 'string' ||
      metadata.title.length > 200 ||
      typeof metadata.date !== 'string' ||
      metadata.date.length > 10 ||
      typeof metadata.categoryId !== 'string' ||
      typeof draft.baseHead !== 'string' ||
      draft.baseHead.length > 100
    ) {
      throw new Error('초안 형식이 올바르지 않습니다.');
    }
    if (
      metadata.categoryId &&
      !workingIndex.categories.some((item) => item.id === metadata.categoryId)
    ) {
      const categories = validateIndex({
        version: 1,
        categories: draft.categories || [],
        posts: [],
      }).categories;
      const category = categories.find((item) => item.id === metadata.categoryId);
      if (!category) {
        throw new Error('초안의 분류 정보를 찾을 수 없습니다.');
      }
      const sameName = workingIndex.categories.find(
        (item) => item.name.trim().toLowerCase() === category.name.trim().toLowerCase(),
      );
      if (sameName) {
        metadata.categoryId = sameName.id;
      } else {
        const nextIndex = structuredClone(workingIndex);
        nextIndex.categories.push(category);
        workingIndex = validateIndex(nextIndex);
        categoriesChanged = true;
        elements['save-categories'].disabled = false;
        renderCategories();
      }
    }
    openDocument(metadata, draft.documentData, draft.baseHead);
    changed = true;
    elements['draft-status'].textContent = '보관한 초안';
    showStatus(
      draft.baseHead !== snapshot.headSha &&
        workingIndex.posts.some((post) => post.id === currentId)
        ? '이전 버전의 초안입니다. 게시한 최신 글을 확인한 후 필요한 내용을 옮겨 주세요.'
        : '초안을 불러왔습니다.',
    );
  }

  function newDocument() {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const id = 'post-' + crypto.randomUUID();
    openDocument(
      { id, title: '', date, categoryId: '' },
      { version: 1, id, content: { ops: [{ insert: '\n' }] } },
      snapshot.headSha,
    );
  }

  async function saveCategories() {
    validateIndex(workingIndex);
    const previousHead = snapshot.headSha;
    snapshot = await PostsStorage.save(token, snapshot, workingIndex);
    workingIndex = structuredClone(snapshot.index);
    if (editingBaseHead === previousHead) {
      editingBaseHead = snapshot.headSha;
    }
    categoriesChanged = false;
    elements['save-categories'].disabled = true;
    renderCategories();
    renderPublished();
    if (changed) {
      await preserveDraft();
    }
    showStatus('분류를 저장했습니다. 사이트 배포 후 반영됩니다.');
  }

  async function publish() {
    const metadata = validateMetadata(readMetadata(), workingIndex.categories);
    const documentData = validateDocument(readDocument());
    validateIndex(workingIndex);
    const existing = workingIndex.posts.some((post) => post.id === currentId);
    if (existing && editingBaseHead !== snapshot.headSha) {
      throw new Error(
        '이 초안은 이전 버전을 기준으로 작성되었습니다. 초안을 내려받고 게시한 최신 글을 열어 변경사항을 확인해 주세요.',
      );
    }
    await preserveDraft();
    const nextIndex = structuredClone(workingIndex);
    nextIndex.posts = nextIndex.posts.filter((post) => post.id !== currentId);
    nextIndex.posts.unshift(metadata);
    snapshot = await PostsStorage.save(token, snapshot, nextIndex, documentData);
    workingIndex = structuredClone(snapshot.index);
    categoriesChanged = false;
    elements['save-categories'].disabled = true;
    openDocument(metadata, documentData, snapshot.headSha);
    renderCategories();
    showStatus('GitHub에 게시했습니다. 배포가 끝나면 글 목록에 반영됩니다.');
    try {
      await PostsDrafts.remove(currentId);
      await renderDrafts();
    } catch {
      showStatus('GitHub에 게시했습니다. 브라우저에 남은 초안은 직접 삭제해 주세요.');
    }
  }

  function login(credential = null) {
    perform(async () => {
      const candidate = credential || (await AdminAuth.login());
      const latest = await PostsStorage.loadSnapshot(candidate, true);
      token = candidate;
      if (snapshot) {
        elements['login-form'].hidden = true;
        showStatus('다시 로그인했습니다. 작성 중인 내용은 그대로 유지됩니다.');
        return;
      }
      snapshot = latest;
      workingIndex = structuredClone(snapshot.index);
      if (!editor) {
        editor = PostsRichEditor.create(markChanged, (message) => showStatus(message, true));
      }
      elements['login-form'].hidden = true;
      elements.workspace.hidden = false;
      elements['new-post'].hidden = false;
      elements.logout.hidden = false;
      renderCategories();
      newDocument();
      await renderDrafts();
      showStatus('분류를 만들고 글을 작성해 보세요.');
    });
  }
  elements['login-form'].addEventListener('submit', (event) => {
    event.preventDefault();
    login();
  });
  AdminAuth.restoreSession().then((credential) => {
    if (credential && !token && !busy) {
      login(credential);
    }
  });
  for (const id of ['post-title', 'post-date', 'post-category']) {
    elements[id].addEventListener('input', markChanged);
  }
  elements['new-post'].addEventListener('click', () =>
    perform(async () => {
      await preserveDraft();
      newDocument();
      elements['post-title'].focus();
    }),
  );
  elements['save-draft'].addEventListener('click', () =>
    perform(async () => {
      changed = true;
      await preserveDraft();
      showStatus('초안을 이 브라우저에 보관했습니다.');
    }),
  );
  elements['save-categories'].addEventListener('click', () => perform(saveCategories));
  elements['publish-post'].addEventListener('click', () => perform(publish));
  elements['add-category'].addEventListener('click', () => {
    const name = elements['new-category'].value.trim();
    const nextIndex = structuredClone(workingIndex);
    nextIndex.categories.push({ id: 'category-' + crypto.randomUUID(), name });
    try {
      validateIndex(nextIndex);
    } catch (error) {
      showStatus(error.message, true);
      return;
    }
    workingIndex = nextIndex;
    categoriesChanged = true;
    elements['save-categories'].disabled = false;
    elements['new-category'].value = '';
    renderCategories();
    showStatus('분류를 추가했습니다. 분류 저장 또는 게시하기를 누르면 공개됩니다.');
  });
  elements['refresh-posts'].addEventListener('click', () =>
    perform(async () => {
      await preserveDraft();
      if (
        categoriesChanged &&
        !confirm('저장하지 않은 분류 변경을 버리고 최신 목록을 불러올까요?')
      ) {
        return;
      }
      snapshot = await PostsStorage.loadSnapshot(token);
      workingIndex = structuredClone(snapshot.index);
      categoriesChanged = false;
      elements['save-categories'].disabled = true;
      renderCategories();
      renderPublished();
      showStatus(
        '최신 목록을 불러왔습니다. 게시한 글을 선택하면 최신 본문을 열 수 있습니다. 현재 편집 내용은 유지됩니다.',
      );
    }),
  );
  elements['delete-post'].addEventListener('click', () =>
    perform(async () => {
      if (!confirm('이 글을 사이트에서 삭제할까요?')) {
        return;
      }
      await preserveDraft();
      const nextIndex = structuredClone(workingIndex);
      nextIndex.posts = nextIndex.posts.filter((post) => post.id !== currentId);
      snapshot = await PostsStorage.save(token, snapshot, nextIndex, null, currentId);
      workingIndex = structuredClone(snapshot.index);
      categoriesChanged = false;
      elements['save-categories'].disabled = true;
      renderCategories();
      newDocument();
      showStatus('글을 삭제했습니다. 배포 후 공개 목록에서 사라집니다. 보관한 초안은 유지됩니다.');
    }),
  );
  elements['preview-post'].addEventListener('click', () => {
    try {
      const metadata = validateMetadata(readMetadata(), workingIndex.categories);
      Posts.renderPost(
        elements['preview-content'],
        metadata,
        validateDocument(readDocument()),
        workingIndex,
      );
      elements['post-preview'].showModal();
    } catch (error) {
      showStatus(error.message, true);
    }
  });
  elements['close-preview'].addEventListener('click', () => elements['post-preview'].close());
  elements['import-draft'].addEventListener('click', () => elements['draft-file'].click());
  elements['draft-file'].addEventListener('change', () =>
    perform(async () => {
      const file = elements['draft-file'].files[0];
      elements['draft-file'].value = '';
      if (!file) {
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('4MB 이하의 초안 JSON 파일을 선택해 주세요.');
      }
      const draft = JSON.parse(await file.text());
      await preserveDraft();
      restoreDraft(draft);
      await preserveDraft();
    }),
  );
  elements['export-draft'].addEventListener('click', () => {
    const draft = {
      version: 1,
      metadata: readMetadata(),
      documentData: readDocument(),
      baseHead: editingBaseHead,
      categories: workingIndex.categories,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }),
    );
    const link = createElement('a');
    link.href = url;
    link.download = currentId + '-draft.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  elements.logout.addEventListener('click', () =>
    perform(async () => {
      await preserveDraft();
      if (categoriesChanged && !confirm('저장하지 않은 분류 변경을 버리고 로그아웃할까요?')) {
        return;
      }
      await AdminAuth.logout(token);
      token = '';
      snapshot = null;
      workingIndex = null;
      currentId = null;
      changed = false;
      categoriesChanged = false;
      clearTimeout(draftTimer);
      editor.setText('', 'silent');
      elements['login-form'].hidden = false;
      elements.workspace.hidden = true;
      elements.logout.hidden = true;
      elements['new-post'].hidden = true;
      elements['save-categories'].disabled = true;
      showStatus('로그아웃했습니다. 이 브라우저의 초안은 다음 로그인 후 다시 열 수 있습니다.');
    }),
  );
  window.addEventListener('beforeunload', (event) => {
    if (changed || categoriesChanged || busy) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
})();
