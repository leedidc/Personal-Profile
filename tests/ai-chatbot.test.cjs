const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const portfolio = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));

function loadService(fetch) {
  const context = vm.createContext({
    fetch,
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
  });
  context.window = context;
  for (const file of ['portfolio-config.js', 'portfolio-skills.js', 'ai-chatbot-service.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
  }
  return context;
}

test('최신 공개 이력과 순서를 전달하고 연락처·번호·예상하지 못한 필드는 제외한다', async () => {
  const data = structuredClone(portfolio);
  data.profile.email = 'private-marker@example.test';
  data.profile.apiKey = 'synthetic-secret-not-for-transmission';
  data.certifications[0].maskedNumber = 'SYNTHETIC-***';
  data.certifications.reverse();
  data.skillCategories = [
    {
      value: 'custom-toolset',
      label: '편집한 도구 분류',
      groups: [{ value: 'custom-analysis', label: '편집한 세부 분류' }],
    },
  ];
  data.skills = [
    {
      id: 'test-skill',
      name: '검증용 도구',
      category: 'custom-toolset',
      group: 'custom-analysis',
      level: '미정',
      description: '검증용 설명',
      apiKey: 'synthetic-secret',
    },
  ];
  data.awards[0].research.slides[0].body = '관리자가 수정한 최신 연구 내용';
  const before = JSON.stringify(data);
  const { PortfolioChatService } = loadService(async (url, options) => {
    assert.equal(url, 'https://chatbot.leedidc1227.workers.dev');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
    const { message } = JSON.parse(options.body);
    const source = JSON.parse(message.split('최신 공개 포트폴리오: ')[1].split('\n\n')[0]);
    assert.deepEqual(
      source.certifications.map((row) => row.name),
      data.certifications.map((row) => row.name),
    );
    assert.equal(source.awards[0].research.slides[0].body, '관리자가 수정한 최신 연구 내용');
    assert.deepEqual(
      source.training.map((item) => item.subtitle),
      data.training.map((item) => item.subtitle),
    );
    assert.deepEqual(
      source.training.map((item) => item.summary),
      data.training.map((item) => item.summary),
    );
    assert.deepEqual(source.skills, [
      {
        name: '검증용 도구',
        category: '편집한 도구 분류',
        group: '편집한 세부 분류',
        level: '미정',
        description: '검증용 설명',
      },
    ]);
    assert.doesNotMatch(
      message,
      /private-marker|synthetic-secret|SYNTHETIC|maskedNumber|data:image/,
    );
    return { ok: true, json: async () => ({ reply: '공개 자료를 바탕으로 한 답변' }) };
  });
  assert.equal(
    await PortfolioChatService.ask({ portfolio: data, question: '보유 자격증은?' }),
    '공개 자료를 바탕으로 한 답변',
  );
  assert.equal(JSON.stringify(data), before);
});

test('이전 대화는 최근 네 차례만 보내고 답변의 길이를 제한한다', async () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    text: index % 2 ? '답'.repeat(5000) : `question-${index}`,
  }));
  const { PortfolioChatService } = loadService(async (_, options) => {
    const { message } = JSON.parse(options.body);
    const conversation = JSON.parse(message.split('이전 대화: ')[1].split('\n\n')[0]);
    assert.equal(conversation.length, 8);
    assert.equal(conversation[0].text, 'question-4');
    assert.equal(conversation[1].text.length, 2000);
    assert.match(message, /후속 질문/);
    return { ok: true, json: async () => ({ reply: '답변' }) };
  });
  await PortfolioChatService.ask({ portfolio, history, question: '후속 질문' });
});

test('빈 질문과 길이 제한 초과는 서버로 보내지 않는다', async () => {
  let calls = 0;
  const { PortfolioChatService } = loadService(() => {
    calls += 1;
  });
  for (const question of [' ', '가'.repeat(1001)]) {
    await assert.rejects(PortfolioChatService.ask({ portfolio, question }), /1,000/);
  }
  assert.equal(calls, 0);
});

test('사용량 제한과 인증 오류를 구분하고 서버의 원문 오류를 노출하지 않는다', async () => {
  for (const [status, expected] of [
    [429, /사용량 한도/],
    [403, /허용하지/],
    [500, /연결하지/],
  ]) {
    const { PortfolioChatService } = loadService(async () => ({
      ok: false,
      status,
      json: async () => ({ error: 'synthetic-server-secret' }),
    }));
    await assert.rejects(
      PortfolioChatService.ask({ portfolio, question: '소개해 주세요' }),
      expected,
    );
  }
});

test('잘못된 JSON·빈 답변·과도한 답변을 거부한다', async () => {
  for (const result of [
    null,
    {},
    { reply: '' },
    { reply: '가'.repeat(12001) },
    { error: 'synthetic-secret', reply: '답변' },
  ]) {
    const { PortfolioChatService } = loadService(async () => ({
      ok: true,
      json: async () => result,
    }));
    await assert.rejects(
      PortfolioChatService.ask({ portfolio, question: '소개해 주세요' }),
      /정상적인 답변/,
    );
  }
  const { PortfolioChatService } = loadService(async () => ({
    ok: true,
    json: async () => {
      throw new Error('not-json');
    },
  }));
  await assert.rejects(
    PortfolioChatService.ask({ portfolio, question: '소개해 주세요' }),
    /답변을 읽지/,
  );
});

test('응답 시간 초과와 새 대화로 인한 취소를 구분한다', async () => {
  const context = loadService(
    (_, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
  );
  context.PortfolioConfig.chatbot.requestTimeoutMs = 10;
  await assert.rejects(
    context.PortfolioChatService.ask({ portfolio, question: '소개해 주세요' }),
    /응답이 늦어/,
  );
  const controller = new AbortController();
  const request = context.PortfolioChatService.ask({
    portfolio,
    question: '소개해 주세요',
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(request, (error) => error.name === 'AbortError');
});
