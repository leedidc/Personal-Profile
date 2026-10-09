const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ URL, TextEncoder, location: { href: 'https://example.test' } });
context.window = context;
for (const file of ['portfolio-config.js', 'portfolio-core.js', 'portfolio-skills.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}
const portfolio = () => ({
  ...JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/skills.json'), 'utf8')),
});

test('스킬이 없는 이전 데이터도 허용하며 숙련도나 기본 항목을 자동 생성하지 않는다', () => {
  const data = portfolio();
  delete data.skills;
  assert.equal(context.Portfolio.validatePortfolio(data), data);
  assert.equal(data.skills, undefined);
  const current = portfolio();
  const snapshot = JSON.stringify(current);
  context.Portfolio.validatePortfolio(current);
  assert.equal(JSON.stringify(current), snapshot);
});

test('스킬 숙련도와 분류 참조, 중복 ID를 검증한다', () => {
  for (const change of [
    { level: '90%' },
    { category: 'unknown' },
    { category: 'engineering', group: 'unknown' },
    { category: 'office', group: 'systems' },
    { name: '' },
    { description: 'x'.repeat(501) },
  ]) {
    const data = portfolio();
    Object.assign(data.skills[0], change);
    assert.throws(() => context.Portfolio.validatePortfolio(data));
  }
  const duplicate = portfolio();
  duplicate.skills[0].id = duplicate.certifications[0].id;
  assert.throws(() => context.Portfolio.validatePortfolio(duplicate), /ID/);
  for (const level of ['상', '중', '하', '미정']) {
    const data = portfolio();
    data.skills[0].level = level;
    assert.doesNotThrow(() => context.Portfolio.validatePortfolio(data));
  }
});

test('관리자 분류 이름·순서를 보존하고 임의의 분류와 미분류 스킬을 허용한다', () => {
  const data = portfolio();
  data.skillCategories.unshift({
    value: 'custom',
    label: '직접 만든 분류',
    groups: [{ value: 'custom-group', label: '직접 만든 세부 분류' }],
  });
  data.skills[0].category = 'custom';
  data.skills[0].group = 'custom-group';
  const before = JSON.stringify(data);
  assert.equal(context.Portfolio.validatePortfolio(data), data);
  assert.equal(JSON.stringify(data), before);
  assert.equal(
    context.PortfolioSkills.categoryLabel(data.skills[0], data.skillCategories),
    '직접 만든 분류 · 직접 만든 세부 분류',
  );
  data.skills[0].group = '';
  assert.doesNotThrow(() => context.Portfolio.validatePortfolio(data));
  const legacy = portfolio();
  delete legacy.skillCategories;
  const legacyBefore = JSON.stringify(legacy);
  assert.doesNotThrow(() => context.Portfolio.validatePortfolio(legacy));
  assert.equal(JSON.stringify(legacy), legacyBefore);
});

test('잘못된 분류 설정과 사용 중인 분류 삭제로 생기는 고아 스킬을 거부한다', () => {
  const invalid = [
    null,
    {},
    [],
    [{ value: 'invalid value', label: '분류', groups: [] }],
    [{ value: 'custom', label: ' ', groups: [] }],
    [{ value: 'custom', label: 'x'.repeat(61), groups: [] }],
    [{ value: 'custom', label: '분류', groups: null }],
  ];
  for (const categories of invalid) {
    const data = portfolio();
    data.skillCategories = categories;
    assert.throws(() => context.Portfolio.validatePortfolio(data));
  }
  for (const change of [
    (data) => data.skillCategories.push({ ...data.skillCategories[0] }),
    (data) => {
      data.skillCategories[1].label = data.skillCategories[0].label;
    },
    (data) => {
      data.skillCategories[0].groups = [
        { value: 'group', label: '동일' },
        { value: 'group', label: '다른 이름' },
      ];
    },
    (data) => {
      data.skillCategories[0].groups = [
        { value: 'one', label: '동일' },
        { value: 'two', label: '동일' },
      ];
    },
    (data) => {
      data.skillCategories = data.skillCategories.filter(
        (category) => category.value !== data.skills[0].category,
      );
    },
    (data) => {
      data.skillCategories.find((category) => category.value === 'engineering').groups = [];
    },
  ]) {
    const data = portfolio();
    change(data);
    assert.throws(() => context.Portfolio.validatePortfolio(data));
  }
  const empty = portfolio();
  empty.skillCategories = [];
  empty.skills = [];
  assert.doesNotThrow(() => context.Portfolio.validatePortfolio(empty));
});
