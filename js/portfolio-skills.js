(() => {
  'use strict';
  const { skillCategories, skillGroups, skillLevels } = PortfolioConfig;

  function getCategories(data = {}) {
    // 분류 설정이 없는 이전 파일은 기존 분류로 열되 원본 데이터는 변경하지 않습니다.
    return data.skillCategories !== undefined
      ? data.skillCategories
      : skillCategories.map((category) => ({
          ...category,
          groups: category.value === 'engineering' ? skillGroups : [],
        }));
  }

  function validateCategories(categories) {
    function validateOptions(options, limit) {
      if (!Array.isArray(options) || options.length > limit) {
        throw new Error('분류와 세부 분류는 각각 최대 30개까지 등록할 수 있습니다.');
      }
      const ids = new Set();
      const labels = new Set();
      for (const option of options) {
        if (
          !option ||
          typeof option.value !== 'string' ||
          !/^[a-z0-9][a-z0-9-]{0,79}$/.test(option.value) ||
          ids.has(option.value) ||
          typeof option.label !== 'string' ||
          !option.label.trim() ||
          option.label.length > 60 ||
          labels.has(option.label.trim().toLowerCase())
        ) {
          throw new Error('분류 이름은 중복 없이 1~60자로 입력하고 분류 ID를 확인해 주세요.');
        }
        ids.add(option.value);
        labels.add(option.label.trim().toLowerCase());
      }
    }
    validateOptions(categories, 30);
    for (const category of categories) {
      validateOptions(category.groups, 30);
    }
    return categories;
  }

  function validateSkill(skill, categories = getCategories()) {
    if (
      typeof skill.name !== 'string' ||
      !skill.name.trim() ||
      skill.name.length > 200 ||
      typeof skill.description !== 'string' ||
      skill.description.length > 500
    ) {
      throw new Error('도구 이름과 용도 설명을 확인해 주세요.');
    }
    if (
      !categories.some((category) => category.value === skill.category) ||
      !skillLevels.includes(skill.level)
    ) {
      throw new Error('스킬 분류와 숙련도를 선택해 주세요.');
    }
    const category = categories.find((item) => item.value === skill.category);
    if (skill.group !== '' && !category.groups.some((group) => group.value === skill.group)) {
      throw new Error('선택한 분류에 속한 세부 분류를 확인해 주세요.');
    }
  }

  function categoryLabel(skill, categories = getCategories()) {
    const category = categories.find((item) => item.value === skill.category);
    const group = category?.groups.find((item) => item.value === skill.group)?.label;
    return (category?.label || '') + (group ? ' · ' + group : '');
  }

  function renderSkills(root, skills, prefix, configuredCategories = getCategories()) {
    const { createElement } = Portfolio;
    const categories = configuredCategories.filter((category) =>
      skills.some((skill) => skill.category === category.value),
    );
    if (!categories.length) {
      return;
    }
    let selectedCategory = categories[0].value;
    let selectedGroup = '';
    const tabs = createElement('div', 'skill-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '스킬 분류');
    const panel = createElement('div', 'skills-panel');
    panel.id = prefix + 'skills-panel';
    panel.setAttribute('role', 'tabpanel');
    const groupFilters = createElement('div', 'skill-groups');
    groupFilters.setAttribute('role', 'group');
    groupFilters.setAttribute('aria-label', '세부 분류');
    const count = createElement('p', 'skills-count');
    count.setAttribute('role', 'status');
    const scroll = createElement('div', 'skills-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', '선택한 스킬 목록');
    const table = createElement('table', 'skills-table');
    const head = createElement('thead');
    const heading = createElement('tr');
    for (const label of ['도구 · 용도', '숙련도']) {
      const cell = createElement('th', '', label);
      cell.scope = 'col';
      heading.append(cell);
    }
    head.append(heading);
    const body = createElement('tbody');
    table.append(head, body);
    scroll.append(table);
    panel.append(groupFilters, count, scroll);
    root.append(tabs, panel);

    function renderRows() {
      const rows = skills.filter(
        (skill) => skill.category === selectedCategory && skill.group === selectedGroup,
      );
      body.replaceChildren();
      for (const skill of rows) {
        const row = createElement('tr');
        const name = createElement('th');
        name.scope = 'row';
        name.append(createElement('span', 'skill-name', skill.name));
        if (skill.description) {
          name.append(createElement('span', 'skill-description', skill.description));
        }
        const proficiency = createElement('td');
        const badge = createElement('span', 'skill-level', skill.level);
        badge.dataset.level = skill.level;
        proficiency.append(badge);
        row.append(name, proficiency);
        body.append(row);
      }
      const category = categories.find((item) => item.value === selectedCategory);
      const label =
        category.groups.find((group) => group.value === selectedGroup)?.label || category.label;
      count.textContent = label + ' · ' + rows.length + '개 도구';
      for (const button of groupFilters.children) {
        button.setAttribute('aria-pressed', String(button.dataset.group === selectedGroup));
      }
      scroll.scrollTop = 0;
    }

    function selectCategory(category) {
      selectedCategory = category.value;
      for (const button of tabs.children) {
        const selected = button.dataset.category === selectedCategory;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected) {
          panel.setAttribute('aria-labelledby', button.id);
        }
      }
      groupFilters.replaceChildren();
      groupFilters.setAttribute('aria-label', category.label + ' 세부 분류');
      const groups = category.groups.filter((group) =>
        skills.some((skill) => skill.category === selectedCategory && skill.group === group.value),
      );
      if (skills.some((skill) => skill.category === selectedCategory && skill.group === '')) {
        groups.push({ value: '', label: '미분류' });
      }
      groupFilters.hidden = !category.groups.length;
      if (!groups.some((group) => group.value === selectedGroup)) {
        selectedGroup = groups[0].value;
      }
      if (!groupFilters.hidden) {
        for (const group of groups) {
          const button = createElement('button', '', group.label);
          button.type = 'button';
          button.dataset.group = group.value;
          button.addEventListener('click', () => {
            selectedGroup = group.value;
            renderRows();
          });
          groupFilters.append(button);
        }
      }
      renderRows();
    }

    categories.forEach((category, index) => {
      const button = createElement('button');
      button.type = 'button';
      button.id = prefix + 'skill-tab-' + category.value;
      button.dataset.category = category.value;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panel.id);
      button.append(
        createElement('span', '', category.label),
        createElement(
          'span',
          'skill-tab-count',
          String(skills.filter((skill) => skill.category === category.value).length),
        ),
      );
      button.addEventListener('click', () => selectCategory(category));
      button.addEventListener('keydown', (event) => {
        let target;
        if (event.key === 'ArrowRight') {
          target = (index + 1) % categories.length;
        } else if (event.key === 'ArrowLeft') {
          target = (index - 1 + categories.length) % categories.length;
        } else if (event.key === 'Home') {
          target = 0;
        } else if (event.key === 'End') {
          target = categories.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        selectCategory(categories[target]);
        tabs.children[target].focus();
      });
      tabs.append(button);
    });
    selectCategory(categories[0]);
  }

  globalThis.PortfolioSkills = {
    getCategories,
    validateCategories,
    validateSkill,
    categoryLabel,
    renderSkills,
  };
})();
