(() => {
  'use strict';
  const { createElement } = Portfolio;
  const getElement = (id) => document.getElementById(id);
  let draft;
  let applyChanges;

  function setOption(key, field, value) {
    draft.sectionOptions ||= {};
    draft.sectionOptions[key] ||= {};
    draft.sectionOptions[key][field] = value;
  }

  function move(key, target) {
    const sections = Portfolio.getSections(draft);
    const active = sections.filter((section) => !section.removed);
    const current = active.findIndex((section) => section.key === key);
    if (target < 0 || target >= active.length || current === target) {
      return;
    }
    active.splice(target, 0, active.splice(current, 1)[0]);
    draft.sectionOrder = [...active, ...sections.filter((section) => section.removed)].map(
      (section) => section.key,
    );
    render();
    getElement('section-order-list').children[target].querySelector('select').focus();
  }

  function action(text, label, callback, extra = '') {
    const button = createElement('button', 'button small ' + extra, text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', callback);
    return button;
  }

  function render() {
    const sections = Portfolio.getSections(draft);
    const active = sections.filter((section) => !section.removed);
    const list = getElement('section-order-list');
    list.replaceChildren();
    active.forEach((section, index) => {
      const row = createElement('div', 'section-order-row');
      row.dataset.section = section.key;
      const identity = createElement('div', 'section-setting-identity');
      const name = createElement('input', 'section-name-input');
      name.type = 'text';
      name.value = section.title;
      name.maxLength = 60;
      name.required = true;
      name.setAttribute('aria-label', section.title + ' 섹션 이름');
      name.addEventListener('input', () => setOption(section.key, 'title', name.value));
      const label = createElement('label', 'setting-checkbox');
      const visible = createElement('input');
      visible.type = 'checkbox';
      visible.checked = section.visible !== false;
      visible.setAttribute('aria-label', section.title + ' 공개');
      visible.addEventListener('change', () => setOption(section.key, 'visible', visible.checked));
      label.append(visible, document.createTextNode('공개'));
      identity.append(name, label);
      const select = createElement('select', 'order-select');
      select.setAttribute('aria-label', section.title + ' 섹션 순서');
      active.forEach((_, position) => {
        const option = createElement('option', '', position + 1 + '번째');
        option.value = String(position);
        select.append(option);
      });
      select.value = String(index);
      select.addEventListener('change', () => move(section.key, Number(select.value)));
      const up = action(
        '↑',
        section.title + ' 섹션 위로 이동',
        () => move(section.key, index - 1),
        'icon',
      );
      const down = action(
        '↓',
        section.title + ' 섹션 아래로 이동',
        () => move(section.key, index + 1),
        'icon',
      );
      up.disabled = index === 0;
      down.disabled = index === active.length - 1;
      const remove = action(
        '삭제',
        section.title + ' 섹션 삭제',
        () => {
          if (
            confirm(
              '‘' +
                section.title +
                '’ 섹션을 화면에서 삭제할까요? 내용은 보관되며 여기서 복원할 수 있습니다.',
            )
          ) {
            setOption(section.key, 'removed', true);
            render();
            getElement('new-section-title').focus();
          }
        },
        'danger',
      );
      const actions = createElement('div', 'editor-actions');
      actions.append(select, up, down, remove);
      row.append(identity, actions);
      list.append(row);
    });
    const removed = getElement('removed-section-list');
    removed.replaceChildren();
    for (const section of sections.filter((section) => section.removed)) {
      const row = createElement('div', 'section-order-row');
      row.append(
        createElement('span', '', section.title),
        action('복원', section.title + ' 섹션 복원', () => {
          setOption(section.key, 'removed', false);
          render();
          list.querySelector(`[data-section="${section.key}"] input`).focus();
        }),
      );
      removed.append(row);
    }
    getElement('removed-sections').hidden = !removed.children.length;
  }

  getElement('add-section').addEventListener('click', () => {
    const title = getElement('new-section-title').value.trim();
    const error = getElement('section-order-error');
    error.textContent = '';
    if (!title || title.length > 60) {
      error.textContent = '새 섹션 이름을 60자 이내로 입력해 주세요.';
      return;
    }
    if ((draft.customSections || []).length >= 30) {
      error.textContent = '추가 섹션은 최대 30개까지 만들 수 있습니다.';
      return;
    }
    const order = Portfolio.getSections(draft).map((section) => section.key);
    const key = 'custom-' + crypto.randomUUID();
    draft.customSections ||= [];
    draft.customSections.push({ key, title });
    draft[key] = [];
    draft.sectionOrder = [...order, key];
    getElement('new-section-title').value = '';
    render();
    getElement('section-order-list').lastElementChild.querySelector('input').focus();
  });

  getElement('section-order-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      Portfolio.validatePortfolio(draft);
      applyChanges(draft);
      getElement('section-order-dialog').close();
    } catch (error) {
      getElement('section-order-error').textContent = error.message;
    }
  });
  getElement('section-order-dialog').addEventListener('close', () => {
    draft = null;
    applyChanges = null;
    getElement('section-order-list').replaceChildren();
    getElement('removed-section-list').replaceChildren();
  });
  window.SectionManager = {
    open(data, onApply) {
      draft = structuredClone(data);
      applyChanges = onApply;
      getElement('section-order-error').textContent = '';
      getElement('new-section-title').value = '';
      render();
      getElement('section-order-dialog').showModal();
    },
  };
})();
