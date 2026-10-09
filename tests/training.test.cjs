const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ URL, TextEncoder });
for (const file of ['portfolio-config.js', 'portfolio-core.js', 'portfolio-skills.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}

test('교육 이수현황이 없는 기존 데이터와 비어 있는 목록을 보존한다', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
  delete data.training;
  const before = JSON.stringify(data);
  assert.equal(context.Portfolio.validatePortfolio(data), data);
  assert.equal(JSON.stringify(data), before);
  data.training = [];
  assert.doesNotThrow(() => context.Portfolio.validatePortfolio(data));
  assert.deepEqual(data.training, []);
  data.training = null;
  assert.throws(() => context.Portfolio.validatePortfolio(data), /교육 이수현황/);
});
