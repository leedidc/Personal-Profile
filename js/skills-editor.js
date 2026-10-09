(() => {
  'use strict';
  const { skillCategories, skillGroups, skillLevels } = PortfolioConfig;
  const getElement = (id) => document.getElementById(id);
  let skillId;
  let applySkill;

  function fillOptions(id, options) {
    for (const { value, label } of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      getElement(id).append(option);
    }
  }
  fillOptions('skill-category', skillCategories);
  fillOptions('skill-group', skillGroups);
  fillOptions(
    'skill-level',
    skillLevels.map((value) => ({ value, label: value })),
  );

  function updateGroupField() {
    const engineering = getElement('skill-category').value === 'engineering';
    getElement('skill-group-field').hidden = !engineering;
    getElement('skill-group').disabled = !engineering;
  }
  getElement('skill-category').addEventListener('change', updateGroupField);

  function open(skill, onApply) {
    skillId = skill?.id || crypto.randomUUID();
    applySkill = onApply;
    getElement('skill-form').reset();
    getElement('skill-dialog-title').textContent = skill ? 'SKILL 수정' : 'SKILL 추가';
    getElement('skill-name').value = skill?.name || '';
    getElement('skill-description').value = skill?.description || '';
    getElement('skill-category').value = skill?.category || 'engineering';
    getElement('skill-group').value = skill?.group || skillGroups[0].value;
    getElement('skill-level').value = skill?.level || '미정';
    getElement('skill-error').textContent = '';
    updateGroupField();
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
      group: category === 'engineering' ? getElement('skill-group').value : '',
      level: getElement('skill-level').value,
    };
    try {
      PortfolioSkills.validateSkill(skill);
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
