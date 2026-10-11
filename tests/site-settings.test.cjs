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
const original = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));

test('섹션 설정은 기존 내용과 순서를 보존하고 삭제·숨김은 공개 안내에서 제외한다', () => {
  const data = structuredClone(original);
  data.customSections = [{ key: 'custom-notes', title: '연구 노트' }];
  data['custom-notes'] = [
    {
      id: 'synthetic-note',
      name: '검증용 기록',
      subtitle: '',
      period: '',
      status: '',
      summary: '',
      details: [],
      logo: '',
    },
  ];
  data.sectionOrder = ['custom-notes', ...original.sectionOrder];
  data.sectionOptions = {
    education: { removed: true },
    certifications: { visible: false },
    'custom-notes': { title: '학습 일지' },
  };
  data.siteFeatures = { chatbot: false, posts: true };
  const saved = context.Portfolio.preparePortfolioForPublication(data);
  assert.deepEqual(saved, data);
  assert.deepEqual(saved.education, original.education);
  assert.deepEqual(saved.certifications, original.certifications);
  const visible = context.Portfolio.getSections(saved).filter(context.Portfolio.sectionVisible);
  assert.equal(visible[0].title, '학습 일지');
  assert.equal(
    visible.some((section) => section.key === 'education'),
    false,
  );
  const publicData = context.Portfolio.publicPortfolio(saved);
  assert.equal(publicData.education.length, 0);
  assert.equal(publicData.certifications.length, 0);
  assert.deepEqual(publicData['custom-notes'], data['custom-notes']);
  assert.deepEqual(data.education, original.education);
  assert.equal(context.Portfolio.featureEnabled(saved, 'chatbot'), false);
  assert.equal(context.Portfolio.featureEnabled({}, 'intro'), true);
});

test('잘못된 기능 값, 섹션 ID, 중복·이름·유효하지 않은 행을 거부한다', () => {
  const invalid = [
    { siteFeatures: { chatbot: 'false' } },
    { siteFeatures: { unknown: false } },
    { sectionOptions: { unknown: { visible: false } } },
    { sectionOptions: { education: { removed: 'yes' } } },
    { sectionOptions: { education: { title: ' ' } } },
    { sectionOptions: { education: { key: 'experience' } } },
    { customSections: [{ key: '__proto__', title: 'Bad' }] },
    {
      customSections: [
        { key: 'custom-a', title: 'A' },
        { key: 'custom-a', title: 'B' },
      ],
    },
    { customSections: [{ key: 'custom-a', title: 'A' }], 'custom-a': [{ id: 'test' }] },
  ];
  for (const fields of invalid) {
    assert.throws(() => context.Portfolio.validatePortfolio({ ...original, ...fields }));
  }
});
