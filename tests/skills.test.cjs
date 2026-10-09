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
const portfolio = () => JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));

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

test('스킬 숙련도와 공학 도구 분류, 중복 ID를 검증한다', () => {
  for (const change of [
    { level: '90%' },
    { category: 'unknown' },
    { category: 'engineering', group: '' },
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
