(() => {
  'use strict';
  const { createElement } = Portfolio;
  const getElement = (id) => document.getElementById(id);
  let sections = [];
  let applyOrder;

  function move(index, target) {
    if (target < 0 || target >= sections.length || index === target) {
      return;
    }
    const [section] = sections.splice(index, 1);
    sections.splice(target, 0, section);
    render();
    getElement('section-order-list').children[target].querySelector('select').focus();
  }

  function moveButton(text, label, index, target) {
    const button = createElement('button', 'button small icon', text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.disabled = target < 0 || target >= sections.length;
    button.addEventListener('click', () => move(index, target));
    return button;
  }

  function render() {
    const list = getElement('section-order-list');
    list.replaceChildren();
    sections.forEach((section, index) => {
      const row = createElement('div', 'section-order-row');
      row.dataset.section = section.key;
      const select = createElement('select', 'order-select');
      select.setAttribute('aria-label', section.title + ' 섹션 순서');
      sections.forEach((_, position) => {
        const option = createElement('option', '', position + 1 + '번째');
        option.value = String(position);
        select.append(option);
      });
      select.value = String(index);
      select.addEventListener('change', () => move(index, Number(select.value)));
      const actions = createElement('div', 'editor-actions');
      actions.append(
        select,
        moveButton('↑', section.title + ' 섹션 위로 이동', index, index - 1),
        moveButton('↓', section.title + ' 섹션 아래로 이동', index, index + 1),
      );
      row.append(createElement('span', 'row-name', section.title), actions);
      list.append(row);
    });
  }

  function open(data, onApply) {
    sections = Portfolio.getSections(data);
    applyOrder = onApply;
    getElement('section-order-error').textContent = '';
    render();
    getElement('section-order-dialog').showModal();
  }

  getElement('section-order-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const order = sections.map((section) => section.key);
      Portfolio.validateSectionOrder(order);
      applyOrder(order);
      getElement('section-order-dialog').close();
    } catch (error) {
      getElement('section-order-error').textContent = error.message;
    }
  });
  getElement('section-order-dialog').addEventListener('close', () => {
    sections = [];
    applyOrder = null;
    getElement('section-order-list').replaceChildren();
  });
  window.SectionOrderEditor = { open };
})();
