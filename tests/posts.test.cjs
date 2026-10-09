const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadScripts(fetch) {
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    structuredClone,
    AbortSignal,
    URL,
    atob,
    fetch,
  });
  context.window = context;
  for (const filename of ['portfolio-config.js', 'posts-core.js', 'posts-storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', filename), 'utf8'), context);
  }
  return context;
}
const index = {
  version: 1,
  categories: [{ id: 'study', name: '학습' }],
  posts: [{ id: 'test-post', title: '가상 학습 글', date: '2026-10-09', categoryId: 'study' }],
};
const documentData = {
  version: 1,
  id: 'test-post',
  content: { ops: [{ insert: '안전한 본문\n' }] },
};
const snapshot = { headSha: 'original-head', treeSha: 'original-tree', index };
const response = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });

test('본문의 스크립트 URL, SVG, 알 수 없는 서식, 빈 글과 용량 초과를 거부한다', () => {
  const { Posts } = loadScripts();
  for (const operation of [
    { insert: 'link', attributes: { link: 'javascript:alert(1)' } },
    { insert: { image: 'data:image/svg+xml;base64,AAAA' } },
    { insert: { image: 'https://user:password@example.test/image.png' } },
    { insert: 'text', attributes: { onclick: 'alert(1)' } },
    { insert: 'text', attributes: { color: 'url(https://example.test)' } },
    { delete: 1 },
  ]) {
    assert.throws(() => Posts.validateDocument({ ...documentData, content: { ops: [operation] } }));
  }
  assert.throws(
    () => Posts.validateDocument({ ...documentData, content: { ops: [{ insert: '\n' }] } }),
    /본문을/,
  );
  assert.throws(
    () =>
      Posts.validateDocument({
        ...documentData,
        content: { ops: [{ insert: 'x'.repeat(Posts.maxDocumentBytes) }] },
      }),
    /3MB/,
  );
  assert.doesNotThrow(() =>
    Posts.validateDocument({ ...documentData, content: { ops: [{ insert: '\n' }] } }, true),
  );
  assert.doesNotThrow(() =>
    Posts.validateDocument({
      ...documentData,
      content: {
        ops: [
          {
            insert: '<script>literal text</script>',
            attributes: { bold: true, link: 'https://example.test/' },
          },
        ],
      },
    }),
  );
});

test('분류와 글 ID, 게시일 및 분류 참조의 일관성을 검사한다', () => {
  const { Posts } = loadScripts();
  assert.doesNotThrow(() => Posts.validateIndex(index));
  for (const fields of [{ id: '../outside' }, { date: '2026-02-30' }, { categoryId: 'missing' }]) {
    assert.throws(() =>
      Posts.validateIndex({ ...index, posts: [{ ...index.posts[0], ...fields }] }),
    );
  }
  assert.throws(() =>
    Posts.validateIndex({
      ...index,
      categories: [...index.categories, { id: 'other', name: ' 학습 ' }],
    }),
  );
  assert.throws(() => Posts.validateIndex({ ...index, posts: [...index.posts, ...index.posts] }));
});

test('목록과 본문을 동일한 트리·커밋에 기록하고 기존 HEAD를 부모로 사용한다', async () => {
  const requests = [];
  const { PostsStorage } = loadScripts(async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer fake-test-token');
    requests.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (url.includes('/git/ref/')) {
      return response({ object: { sha: snapshot.headSha } });
    }
    if (url.endsWith('/git/trees')) {
      return response({ sha: 'new-tree' });
    }
    if (url.endsWith('/git/commits')) {
      return response({ sha: 'new-head' });
    }
    return response({ object: { sha: 'new-head' } });
  });
  const saved = await PostsStorage.save('fake-test-token', snapshot, index, documentData);
  assert.equal(saved.headSha, 'new-head');
  assert.equal(requests[1].body.base_tree, snapshot.treeSha);
  assert.deepEqual(
    requests[1].body.tree.map((entry) => entry.path),
    ['data/posts/index.json', 'data/posts/test-post.json'],
  );
  assert.deepEqual(JSON.parse(requests[1].body.tree[1].content), documentData);
  assert.deepEqual(requests[2].body.parents, [snapshot.headSha]);
  assert.deepEqual(requests[3].body, { sha: 'new-head', force: false });
  assert.equal(
    JSON.stringify(requests.map((request) => request.body)).includes('fake-test-token'),
    false,
  );
});

test('다른 HEAD가 있으면 쓰기를 시작하지 않고 마지막 충돌도 강제 갱신하지 않는다', async () => {
  let calls = 0;
  const conflict = loadScripts(async () => {
    calls += 1;
    return response({ object: { sha: 'someone-elses-head' } });
  });
  await assert.rejects(
    conflict.PostsStorage.save('fake', snapshot, index, documentData),
    /다른 변경사항/,
  );
  assert.equal(calls, 1);
  const racing = loadScripts(async (url, options) => {
    if (url.includes('/git/ref/')) {
      return response({ object: { sha: snapshot.headSha } });
    }
    if (options.method === 'PATCH') {
      assert.equal(JSON.parse(options.body).force, false);
      return response({}, 422);
    }
    return response({ sha: 'new-object' });
  });
  await assert.rejects(racing.PostsStorage.save('fake', snapshot, index, documentData), /충돌/);
});

test('큰 파일은 Contents에서 얻은 동일한 blob SHA로 읽는다', async () => {
  const urls = [];
  const { PostsStorage } = loadScripts(async (url) => {
    urls.push(url);
    if (url.includes('/contents/')) {
      return response({ encoding: 'none', sha: 'body-blob-sha', content: '' });
    }
    return response({
      sha: 'body-blob-sha',
      encoding: 'base64',
      content: Buffer.from(JSON.stringify(documentData)).toString('base64'),
    });
  });
  const loaded = await PostsStorage.loadDocument('fake', snapshot, 'test-post');
  assert.equal(loaded.content.ops[0].insert, '안전한 본문\n');
  assert.match(urls[0], /ref=original-head$/);
  assert.match(urls[1], /git\/blobs\/body-blob-sha$/);
});
