const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ URL, TextEncoder, structuredClone });
for (const file of ['portfolio-config.js', 'portfolio-core.js', 'portfolio-skills.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}
const keys = Array.from(context.Portfolio.sections, (section) => section.key);
const orderedKeys = (data) =>
  Array.from(context.Portfolio.getSections(data), (section) => section.key);

test('이전 데이터는 기본 순서를 유지하고 빠진 섹션만 뒤에 보완한다', () => {
  const legacy = {};
  assert.deepEqual(orderedKeys(legacy), keys);
  assert.deepEqual(legacy, {});
  const partial = { sectionOrder: ['awards', 'education'] };
  assert.deepEqual(orderedKeys(partial), [
    ...partial.sectionOrder,
    ...keys.filter((key) => !partial.sectionOrder.includes(key)),
  ]);
  assert.deepEqual(partial.sectionOrder, ['awards', 'education']);
});

test('잘못된 순서를 거부하고 공개 저장 시 섹션·항목 순서를 그대로 보존한다', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
  for (const order of [null, 'education', ['education', 'education'], ['unknown'], [123], [{}]]) {
    assert.throws(
      () => context.Portfolio.validatePortfolio({ ...data, sectionOrder: order }),
      /섹션 순서/,
    );
  }
  data.sectionOrder = keys.toReversed();
  const before = structuredClone(data);
  assert.deepEqual(orderedKeys(data), data.sectionOrder);
  assert.deepEqual(context.Portfolio.preparePortfolioForPublication(data), before);
  assert.deepEqual(data, before);
});
