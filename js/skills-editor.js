(() => {
  'use strict';
  const { skillLevels } = PortfolioConfig;
  const getElement = (id) => document.getElementById(id);
  let skillId;
  let applySkill;
  let categories = [];

  function fillOptions(id, options) {
    getElement(id).replaceChildren();
    for (const { value, label } of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      getElement(id).append(option);
    }
  }
  fillOptions(
    'skill-level',
    skillLevels.map((value) => ({ value, label: value })),
  );

  function updateGroupField(selected = '') {
    const groups =
      categories.find((item) => item.value === getElement('skill-category').value)?.groups || [];
    fillOptions('skill-group', [{ value: '', label: '미분류' }, ...groups]);
    getElement('skill-group').value = groups.some((group) => group.value === selected)
      ? selected
      : '';
    getElement('skill-group-field').hidden = !groups.length;
    getElement('skill-group').disabled = !groups.length;
  }
  getElement('skill-category').addEventListener('change', () => updateGroupField());

  function open(skill, onApply, configuredCategories) {
    categories = configuredCategories;
    skillId = skill?.id || crypto.randomUUID();
    applySkill = onApply;
    getElement('skill-form').reset();
    fillOptions('skill-category', categories);
    getElement('skill-dialog-title').textContent = skill ? 'SKILL 수정' : 'SKILL 추가';
    getElement('skill-name').value = skill?.name || '';
    getElement('skill-description').value = skill?.description || '';
    getElement('skill-category').value = skill?.category || categories[0]?.value || '';
    getElement('skill-level').value = skill?.level || '미정';
    getElement('skill-error').textContent = '';
    updateGroupField(skill?.group || '');
    getElement('skill-dialog').showModal();
  }

  getElement('skill-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const category = getElement('skill-category').value;
    const skill = {
      id: skillId,
      name: getElement('skill-name').value.trim(),
      description: getElement('skill-description').value.trim(),
      category,
      group: getElement('skill-group').value,
      level: getElement('skill-level').value,
    };
    try {
      PortfolioSkills.validateSkill(skill, categories);
      applySkill(skill);
      getElement('skill-dialog').close();
    } catch (error) {
      getElement('skill-error').textContent = error.message;
    }
  });
  getElement('skill-dialog').addEventListener('close', () => {
    applySkill = null;
    skillId = null;
    getElement('skill-form').reset();
  });
  window.SkillsEditor = { open };
})();
