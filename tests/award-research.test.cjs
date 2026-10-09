const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPortfolio(fetch) {
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    structuredClone,
    AbortSignal,
    URL,
    btoa,
    atob,
    fetch,
    location: { href: 'https://example.test/admin/' },
  });
  context.window = context;
  for (const name of [
    'portfolio-config.js',
    'portfolio-core.js',
    'portfolio-skills.js',
    'portfolio-github.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name), 'utf8'), context);
  }
  return context;
}

const research = {
  title: '가상 연구',
  slides: [{ title: '연구 배경', body: '검증용 설명' }],
  link: 'https://example.test/paper.pdf',
};

test('연구 설명은 선택이며, 빈 내용·과도한 길이·안전하지 않은 링크를 거부한다', () => {
  const { Portfolio } = loadPortfolio();
  assert.doesNotThrow(() => Portfolio.validateAwardResearch(undefined));
  assert.doesNotThrow(() => Portfolio.validateAwardResearch(research));
  for (const invalid of [
    null,
    {},
    { ...research, title: ' ' },
    { ...research, title: 'x'.repeat(301) },
    { ...research, slides: [] },
    { ...research, slides: Array(13).fill(research.slides[0]) },
    { ...research, slides: [null] },
    { ...research, slides: [{ title: 'x'.repeat(161), body: 'text' }] },
    { ...research, slides: [{ title: '제목', body: ' ' }] },
    { ...research, slides: [{ title: '제목', body: 'x'.repeat(3001) }] },
    ...[
      'javascript:alert(1)',
      'data:text/html,test',
      'http://example.test',
      'https://user:password@example.test',
      {},
    ].map((link) => ({ ...research, link })),
  ]) {
    assert.throws(() => Portfolio.validateAwardResearch(invalid));
  }
});

test('연구 슬라이드는 항목 순서와 기존 내용 그대로 SHA를 사용해 저장한다', async () => {
  let saved;
  const { PortfolioStorage } = loadPortfolio(async (_url, options) => {
    saved = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: { sha: 'next-sha' } }) };
  });
  const portfolio = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/portfolio.json'), 'utf8'),
  );
  portfolio.awards[0].research = structuredClone(research);
  await PortfolioStorage.savePortfolio('fake-token', portfolio, 'read-sha');
  assert.equal(saved.sha, 'read-sha');
  const decoded = JSON.parse(Buffer.from(saved.content, 'base64').toString('utf8'));
  assert.deepEqual(decoded, portfolio);
  portfolio.awards[0].research = { ...research, link: 'javascript:alert(1)' };
  await assert.rejects(() => PortfolioStorage.savePortfolio('fake-token', portfolio, 'read-sha'));
});
