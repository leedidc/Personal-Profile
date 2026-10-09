(() => {
  'use strict';
  const { skillCategories, skillGroups, skillLevels } = PortfolioConfig;

  function validateSkill(skill) {
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
      !skillCategories.some((category) => category.value === skill.category) ||
      !skillLevels.includes(skill.level)
    ) {
      throw new Error('스킬 분류와 숙련도를 선택해 주세요.');
    }
    if (
      skill.category === 'engineering'
        ? !skillGroups.some((group) => group.value === skill.group)
        : skill.group !== ''
    ) {
      throw new Error('공학 도구의 세부 분류를 확인해 주세요.');
    }
  }

  function categoryLabel(skill) {
    const category = skillCategories.find((item) => item.value === skill.category)?.label || '';
    const group = skillGroups.find((item) => item.value === skill.group)?.label;
    return category + (group ? ' · ' + group : '');
  }

  function renderSkills(root, skills, prefix) {
    const { createElement } = Portfolio;
    const categories = skillCategories.filter((category) =>
      skills.some((skill) => skill.category === category.value),
    );
    let selectedCategory = categories[0].value;
    let selectedGroup = '';
    const introduction = createElement(
      'p',
      'skills-introduction',
      '분류를 선택하면 도구의 용도와 숙련도를 확인할 수 있습니다.',
    );
    const tabs = createElement('div', 'skill-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '스킬 분류');
    const panel = createElement('div', 'skills-panel');
    panel.id = prefix + 'skills-panel';
    panel.setAttribute('role', 'tabpanel');
    const groupFilters = createElement('div', 'skill-groups');
    groupFilters.setAttribute('role', 'group');
    groupFilters.setAttribute('aria-label', '공학 도구 세부 분류');
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
    root.append(
      introduction,
      tabs,
      panel,
      createElement(
        'p',
        'skills-note',
        '숙련도는 본인 평가입니다. ‘미정’은 아직 정하지 않은 항목입니다.',
      ),
    );

    function renderRows() {
      const rows = skills.filter(
        (skill) =>
          skill.category === selectedCategory &&
          (selectedCategory !== 'engineering' || skill.group === selectedGroup),
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
      const label =
        selectedCategory === 'engineering'
          ? skillGroups.find((group) => group.value === selectedGroup).label
          : skillCategories.find((category) => category.value === selectedCategory).label;
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
      groupFilters.hidden = selectedCategory !== 'engineering';
      if (selectedCategory === 'engineering') {
        const groups = skillGroups.filter((group) =>
          skills.some((skill) => skill.category === 'engineering' && skill.group === group.value),
        );
        if (!groups.some((group) => group.value === selectedGroup)) {
          selectedGroup = groups[0].value;
        }
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

  window.PortfolioSkills = { validateSkill, categoryLabel, renderSkills };
})();
