const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadPortfolioScripts(fetch) {
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

  for (const filename of [
    'portfolio-config.js',
    'portfolio-core.js',
    'portfolio-skills.js',
    'portfolio-github.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', filename), 'utf8'), context);
  }

  return context;
}

test('번호는 끝 3자리 이상을 가리고 이미 가린 값은 유지한다', () => {
  const { Portfolio } = loadPortfolioScripts();
  const cases = [
    ['', ''],
    ['12', '***'],
    ['123', '***'],
    ['  DEMO-123  ', 'DEMO-***'],
    ['EXAMPLE-123456789', 'EXAMPLE-1234***'],
    ['#DEMO-***', '#DEMO-***'],
  ];

  for (const [input, expected] of cases) {
    assert.equal(Portfolio.maskCredentialNumber(input), expected);
    assert.equal(Portfolio.maskCredentialNumber(expected), expected);
  }

  for (const input of [null, 123, '<script>', 'DEMO***123']) {
    assert.throws(() => Portfolio.maskCredentialNumber(input));
  }
});

test('공개 데이터는 번호 원문을 거부하고 기존의 번호 없는 자격을 허용한다', () => {
  const { Portfolio } = loadPortfolioScripts();
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
  delete data.certifications[0].maskedNumber;
  assert.doesNotThrow(() => Portfolio.validatePortfolio(data));

  data.certifications[0].maskedNumber = 'DEMO-123456789';
  assert.throws(() => Portfolio.validatePortfolio(data), /마스킹/);
  delete data.certifications[0].maskedNumber;
  data.languages[0].maskedNumber = 'EXAM-123456';
  assert.throws(() => Portfolio.validatePortfolio(data), /마스킹/);
});

test('GitHub 요청 본문에는 원문 없이 마스킹된 번호만 포함한다', async () => {
  let requestBody;
  const { PortfolioStorage } = loadPortfolioScripts(async (url, options) => {
    assert.match(url, /contents\/data\/portfolio\.json$/);
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: { sha: 'next-sha' } }) };
  });
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
  const syntheticNumber = 'PRIVATE-EXAMPLE-123456';
  data.certifications[0].maskedNumber = syntheticNumber;
  const syntheticRegistration = 'EXAM-987654';
  data.languages[0].maskedNumber = syntheticRegistration;

  const sha = await PortfolioStorage.savePortfolio('test-token', data, 'previous-sha');
  const publishedJson = Buffer.from(requestBody.content, 'base64').toString('utf8');
  const publishedData = JSON.parse(publishedJson);

  assert.equal(sha, 'next-sha');
  assert.equal(requestBody.sha, 'previous-sha');
  assert.equal(requestBody.branch, 'main');
  assert.ok(!publishedJson.includes(syntheticNumber));
  assert.ok(!publishedJson.includes(syntheticRegistration));
  assert.equal(publishedData.languages[0].maskedNumber, 'EXAM-987***');
  assert.equal(data.languages[0].maskedNumber, syntheticRegistration);
  assert.equal(publishedData.certifications[0].maskedNumber, 'PRIVATE-EXAM***');
  assert.equal(data.certifications[0].maskedNumber, syntheticNumber);
});

test('프로필 확장 필드는 이전 데이터를 허용하고 잘못된 입력을 거부한다', () => {
  const { Portfolio } = loadPortfolioScripts();
  const original = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
  const legacy = structuredClone(original);
  delete legacy.profile.introduction;
  delete legacy.profile.interests;
  assert.doesNotThrow(() => Portfolio.validatePortfolio(legacy));

  for (const [key, value] of [
    ['introduction', {}],
    ['introduction', 'a'.repeat(3001)],
    ['interests', 'security'],
    ['interests', [null]],
    ['interests', ['a'.repeat(101)]],
    ['interests', Array(31).fill('security')],
  ]) {
    const data = structuredClone(original);
    data.profile[key] = value;
    assert.throws(() => Portfolio.validatePortfolio(data));
  }
  const data = structuredClone(original);
  data.education[0].summaryEnglish = {};
  assert.throws(() => Portfolio.validatePortfolio(data), /영문/);
});
