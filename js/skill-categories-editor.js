(() => {
  'use strict';
  const { createElement } = Portfolio;
  const getElement = (id) => document.getElementById(id);
  let categories = [];
  let skills = [];
  let applyCategories;

  function showError(message = '') {
    getElement('skill-categories-error').textContent = message;
  }

  function action(text, label, callback) {
    const button = createElement('button', 'button small', text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', callback);
    return button;
  }

  function move(items, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) {
      return;
    }
    items.splice(target, 0, items.splice(index, 1)[0]);
    render();
    const attribute = items === categories ? 'data-category' : 'data-group';
    getElement('skill-categories-list')
      .querySelector('[' + attribute + '="' + items[target].value + '"] input')
      .focus();
  }

  function remove(category, group = null) {
    const count = skills.filter(
      (skill) => skill.category === category.value && (!group || skill.group === group.value),
    ).length;
    if (count) {
      showError(count + '개 스킬이 사용 중입니다. 해당 스킬을 다른 분류로 옮긴 후 삭제해 주세요.');
      return;
    }
    const items = group ? category.groups : categories;
    items.splice(items.indexOf(group || category), 1);
    render();
  }

  function addNameField(item, label, className) {
    const field = createElement('label', 'field ' + className);
    const input = createElement('input');
    input.value = item.label;
    input.required = true;
    input.maxLength = 60;
    input.addEventListener('input', () => {
      item.label = input.value;
    });
    field.append(createElement('span', '', label), input);
    return field;
  }

  function orderActions(items, index, label, onDelete) {
    const controls = createElement('div', 'category-actions');
    const up = action('↑', label + ' 위로 이동', () => move(items, index, -1));
    const down = action('↓', label + ' 아래로 이동', () => move(items, index, 1));
    up.disabled = index === 0;
    down.disabled = index === items.length - 1;
    controls.append(up, down, action('삭제', label + ' 삭제', onDelete));
    return controls;
  }

  function addGroup(category) {
    if (category.groups.length >= 30) {
      showError('세부 분류는 최대 30개까지 등록할 수 있습니다.');
      return;
    }
    const group = { value: crypto.randomUUID(), label: '' };
    category.groups.push(group);
    render();
    getElement('skill-categories-list')
      .querySelector('[data-group="' + group.value + '"] input')
      .focus();
  }

  function render() {
    showError();
    const list = getElement('skill-categories-list');
    list.replaceChildren();
    categories.forEach((category, index) => {
      const card = createElement('section', 'skill-category-card');
      card.dataset.category = category.value;
      const label = '분류 ' + (index + 1);
      const row = createElement('div', 'skill-category-row');
      row.append(
        addNameField(category, label + ' 이름', 'category-name'),
        orderActions(categories, index, label, () => remove(category)),
      );
      card.append(row);
      const groups = createElement('div', 'skill-category-groups');
      category.groups.forEach((group, groupIndex) => {
        const row = createElement('div', 'skill-category-row');
        row.dataset.group = group.value;
        const label = '분류 ' + (index + 1) + '의 세부 분류 ' + (groupIndex + 1);
        row.append(
          addNameField(group, label + ' 이름', 'group-name'),
          orderActions(category.groups, groupIndex, label, () => remove(category, group)),
        );
        groups.append(row);
      });
      card.append(
        groups,
        action('+ 세부 분류 추가', label + ' 세부 분류 추가', () => addGroup(category)),
      );
      list.append(card);
    });
    if (!categories.length) {
      list.append(createElement('p', 'empty-row', '분류를 추가해 주세요.'));
    }
  }

  function open(data, onApply) {
    categories = structuredClone(PortfolioSkills.getCategories(data));
    skills = data.skills || [];
    applyCategories = onApply;
    render();
    getElement('skill-categories-dialog').showModal();
  }

  getElement('add-skill-category').addEventListener('click', () => {
    if (categories.length >= 30) {
      showError('분류는 최대 30개까지 등록할 수 있습니다.');
      return;
    }
    categories.push({ value: crypto.randomUUID(), label: '', groups: [] });
    render();
    getElement('skill-categories-list').lastElementChild.querySelector('input').focus();
  });

  getElement('skill-categories-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      for (const category of categories) {
        category.label = category.label.trim();
        for (const group of category.groups) {
          group.label = group.label.trim();
        }
      }
      PortfolioSkills.validateCategories(categories);
      for (const skill of skills) {
        PortfolioSkills.validateSkill(skill, categories);
      }
      applyCategories(structuredClone(categories));
      getElement('skill-categories-dialog').close();
    } catch (error) {
      showError(error.message);
    }
  });
  getElement('skill-categories-dialog').addEventListener('close', () => {
    categories = [];
    skills = [];
    applyCategories = null;
    getElement('skill-categories-list').replaceChildren();
    showError();
  });
  window.SkillCategoriesEditor = { open };
})();
