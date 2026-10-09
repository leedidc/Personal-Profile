(() => {
  'use strict';

  const maxDocumentBytes = 3 * 1024 * 1024;
  const idPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

  function createElement(tag, className = '', text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function safeLink(value) {
    if (typeof value !== 'string' || value.length > 2000) {
      return '';
    }
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  }

  function safeImage(value) {
    if (typeof value !== 'string') {
      return '';
    }
    if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value)) {
      return value;
    }
    return safeLink(value);
  }

  function validText(value, maximum, required = true) {
    return typeof value === 'string' && value.length <= maximum && (!required || value.trim());
  }

  function validId(value) {
    return typeof value === 'string' && idPattern.test(value);
  }

  function validateMetadata(post, categories) {
    if (!post || !validId(post.id) || !validText(post.title, 200)) {
      throw new Error('글 제목을 200자 이내로 입력해 주세요.');
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
      !Number.isFinite(Date.parse(post.date)) ||
      new Date(post.date).toISOString().slice(0, 10) !== post.date
    ) {
      throw new Error('올바른 게시일을 선택해 주세요.');
    }
    if (post.categoryId !== '' && !categories.some((category) => category.id === post.categoryId)) {
      throw new Error('등록된 분류를 선택해 주세요.');
    }
    return post;
  }

  function validateIndex(index) {
    if (
      !index ||
      index.version !== 1 ||
      !Array.isArray(index.categories) ||
      !Array.isArray(index.posts) ||
      index.categories.length > 100 ||
      index.posts.length > 2000
    ) {
      throw new Error('글 목록 형식이 올바르지 않습니다.');
    }
    const ids = new Set();
    const names = new Set();
    for (const category of index.categories) {
      if (
        !category ||
        !validId(category.id) ||
        !validText(category.name, 60) ||
        ids.has(category.id) ||
        names.has(category.name.trim().toLowerCase())
      ) {
        throw new Error('분류 이름은 중복 없이 60자 이내로 입력해 주세요.');
      }
      ids.add(category.id);
      names.add(category.name.trim().toLowerCase());
    }
    const postIds = new Set();
    for (const post of index.posts) {
      validateMetadata(post, index.categories);
      if (postIds.has(post.id)) {
        throw new Error('중복된 글이 있습니다.');
      }
      postIds.add(post.id);
    }
    return index;
  }

  function validateAttributes(attributes = {}) {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
      throw new Error('본문 서식이 올바르지 않습니다.');
    }
    const validators = {
      bold: (value) => value === true,
      italic: (value) => value === true,
      underline: (value) => value === true,
      strike: (value) => value === true,
      code: (value) => value === true,
      blockquote: (value) => value === true,
      header: (value) => [1, 2, 3].includes(value),
      list: (value) => ['ordered', 'bullet', 'checked', 'unchecked'].includes(value),
      indent: (value) => Number.isInteger(value) && value >= 1 && value <= 4,
      align: (value) => ['center', 'right', 'justify'].includes(value),
      color: (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
      background: (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
      link: (value) => Boolean(safeLink(value)),
      alt: (value) => validText(value, 300, false),
      'code-block': (value) =>
        value === true || (typeof value === 'string' && /^[a-z0-9#+-]{1,30}$/i.test(value)),
    };
    for (const [key, value] of Object.entries(attributes)) {
      if (!Object.hasOwn(validators, key) || !validators[key](value)) {
        throw new Error('지원하지 않는 서식 또는 안전하지 않은 링크가 있습니다.');
      }
    }
  }

  function validateDocument(documentData, allowEmpty = false) {
    if (
      !documentData ||
      documentData.version !== 1 ||
      !validId(documentData.id) ||
      !Array.isArray(documentData.content?.ops) ||
      documentData.content.ops.length > 30000
    ) {
      throw new Error('본문 형식이 올바르지 않습니다.');
    }
    if (new TextEncoder().encode(JSON.stringify(documentData)).length > maxDocumentBytes) {
      throw new Error('글 한 편은 이미지 포함 3MB까지 저장할 수 있습니다. 이미지를 줄여 주세요.');
    }
    let hasContent = false;
    for (const operation of documentData.content.ops) {
      if (
        !operation ||
        Object.keys(operation).some((key) => !['insert', 'attributes'].includes(key))
      ) {
        throw new Error('본문 형식이 올바르지 않습니다.');
      }
      validateAttributes(operation.attributes);
      if (typeof operation.insert === 'string') {
        hasContent ||= Boolean(operation.insert.trim());
      } else if (
        operation.insert &&
        Object.keys(operation.insert).length === 1 &&
        safeImage(operation.insert.image)
      ) {
        hasContent = true;
      } else {
        throw new Error('본문에는 텍스트와 PNG·JPEG·WebP 이미지, HTTPS 이미지만 넣을 수 있습니다.');
      }
    }
    if (!allowEmpty && !hasContent) {
      throw new Error('본문을 입력해 주세요.');
    }
    return documentData;
  }

  function createInline(insert, attributes = {}) {
    let element;
    if (typeof insert === 'string') {
      element = createElement('span', '', insert);
    } else {
      element = createElement('img');
      element.src = safeImage(insert.image);
      element.alt = attributes.alt || '';
      element.loading = 'lazy';
    }
    for (const [key, tag] of [
      ['bold', 'strong'],
      ['italic', 'em'],
      ['underline', 'u'],
      ['strike', 's'],
      ['code', 'code'],
    ]) {
      if (attributes[key]) {
        const wrapper = createElement(tag);
        wrapper.append(element);
        element = wrapper;
      }
    }
    if (attributes.color) {
      element.style.color = attributes.color;
    }
    if (attributes.background) {
      element.style.backgroundColor = attributes.background;
    }
    if (attributes.link) {
      const link = createElement('a');
      link.href = safeLink(attributes.link);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(element);
      element = link;
    }
    return element;
  }

  function renderContent(root, documentData) {
    validateDocument(documentData, true);
    root.replaceChildren();
    let fragments = [];
    let lists = [];
    let codeBlock = null;

    function appendLine(attributes = {}) {
      if (attributes['code-block']) {
        if (!codeBlock) {
          codeBlock = createElement('code');
          const pre = createElement('pre');
          pre.append(codeBlock);
          root.append(pre);
        }
        codeBlock.append(...fragments, document.createTextNode('\n'));
        fragments = [];
        lists = [];
        return;
      }
      codeBlock = null;
      let line;
      if (attributes.list) {
        const level = Math.min(attributes.indent || 0, lists.length);
        const tag = attributes.list === 'ordered' ? 'ol' : 'ul';
        if (lists[level]?.tagName.toLowerCase() !== tag) {
          lists = lists.slice(0, level);
        }
        if (!lists[level]) {
          const list = createElement(tag);
          if (level > 0) {
            lists[level - 1].lastElementChild.append(list);
          } else {
            root.append(list);
          }
          lists[level] = list;
        }
        lists = lists.slice(0, level + 1);
        line = createElement('li');
        if (['checked', 'unchecked'].includes(attributes.list)) {
          line.classList.add('check-item');
          const checkbox = createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = attributes.list === 'checked';
          checkbox.disabled = true;
          checkbox.setAttribute('aria-label', checkbox.checked ? '완료' : '미완료');
          line.append(checkbox);
        }
        lists[level].append(line);
      } else {
        lists = [];
        line = createElement(
          attributes.header
            ? 'h' + (attributes.header + 1)
            : attributes.blockquote
              ? 'blockquote'
              : 'p',
        );
        root.append(line);
      }
      if (attributes.align) {
        line.classList.add('text-' + attributes.align);
      }
      if (attributes.indent && !attributes.list) {
        line.classList.add('indent-' + attributes.indent);
      }
      line.append(...(fragments.length ? fragments : [createElement('br')]));
      fragments = [];
    }

    for (const operation of documentData.content.ops) {
      if (typeof operation.insert !== 'string') {
        fragments.push(createInline(operation.insert, operation.attributes));
        continue;
      }
      const parts = operation.insert.split('\n');
      parts.forEach((part, index) => {
        if (part) {
          fragments.push(createInline(part, operation.attributes));
        }
        if (index < parts.length - 1) {
          appendLine(operation.attributes);
        }
      });
    }
    if (fragments.length) {
      appendLine();
    }
  }

  function categoryName(index, categoryId) {
    return index.categories.find((category) => category.id === categoryId)?.name || '미분류';
  }

  function renderPost(root, metadata, documentData, index) {
    const heading = createElement('header', 'post-heading');
    const meta = createElement('div', 'post-meta');
    const date = createElement('time', '', metadata.date.replaceAll('-', '.'));
    date.dateTime = metadata.date;
    meta.append(
      createElement('span', 'post-category', categoryName(index, metadata.categoryId)),
      date,
    );
    heading.append(meta, createElement('h1', '', metadata.title));
    const body = createElement('div', 'post-body');
    renderContent(body, documentData);
    root.replaceChildren(heading, body);
  }

  window.Posts = {
    createElement,
    safeLink,
    safeImage,
    validId,
    validateIndex,
    validateMetadata,
    validateDocument,
    renderContent,
    renderPost,
    categoryName,
    maxDocumentBytes,
  };
})();
