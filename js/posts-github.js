(() => {
  'use strict';
  const { repository, branch, apiVersion, requestTimeoutMs } = PortfolioConfig.github;
  const endpoint = '/repos/' + repository;
  const indexPath = 'data/posts/index.json';

  async function request(path, token, options = {}) {
    let response;
    try {
      response = await fetch('https://api.github.com' + endpoint + path, {
        ...options,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': apiVersion,
          Authorization: 'Bearer ' + token,
          ...(typeof window === 'undefined' ? { 'User-Agent': 'Personal-Profile-Admin' } : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new Error('GitHub에 연결하지 못했습니다. 편집 내용은 유지됩니다.');
    }
    if (!response.ok) {
      const messages = {
        401: '토큰이 만료되었거나 올바르지 않습니다.',
        403: 'Contents 쓰기 권한과 GitHub 요청 한도를 확인해 주세요.',
        404: '글 파일이나 저장소를 찾을 수 없습니다.',
        409: '다른 변경사항이 저장되었습니다. 초안을 보관한 후 새로 불러와 주세요.',
        422: '변경 충돌 또는 브랜치 보호로 저장하지 못했습니다. 초안을 보관하고 최신 내용을 불러와 주세요.',
      };
      const error = new Error(
        messages[response.status] || 'GitHub 저장에 실패했습니다. 편집 내용은 유지됩니다.',
      );
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function readJson(path, token, headSha) {
    let file = await request('/contents/' + path + '?ref=' + encodeURIComponent(headSha), token);
    // 1MB를 넘는 본문은 동일한 파일 SHA의 blob에서 읽습니다.
    if (file.encoding !== 'base64' && file.sha) {
      file = await request('/git/blobs/' + file.sha, token);
    }
    if (file.encoding !== 'base64' || !file.content || !file.sha) {
      throw new Error('글 파일을 읽지 못했습니다.');
    }
    const binary = atob(file.content.replace(/\s/g, ''));
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      ),
    );
  }

  async function loadSnapshot(token, verifyAccess = false) {
    if (token?.type === 'session') {
      const snapshot = await AdminAuth.request('/posts/snapshot', token);
      Posts.validateIndex(snapshot.index);
      return snapshot;
    }
    if (verifyAccess) {
      const repositoryInfo = await request('', token);
      if (!repositoryInfo.permissions?.push) {
        throw new Error('이 저장소를 수정할 수 있는 계정의 토큰이 필요합니다.');
      }
    }
    const reference = await request('/git/ref/heads/' + branch, token);
    const headSha = reference.object.sha;
    const commit = await request('/git/commits/' + headSha, token);
    const index = Posts.validateIndex(await readJson(indexPath, token, headSha));
    return { headSha, treeSha: commit.tree.sha, index };
  }

  async function loadDocument(token, snapshot, id) {
    if (!Posts.validId(id)) {
      throw new Error('글 주소가 올바르지 않습니다.');
    }
    if (token?.type === 'session') {
      const documentData = await AdminAuth.request('/posts/read', token, {
        method: 'POST',
        body: { headSha: snapshot.headSha, id },
      });
      Posts.validateDocument(documentData);
      if (documentData.id !== id) {
        throw new Error('글과 본문이 일치하지 않습니다.');
      }
      return documentData;
    }
    const documentData = Posts.validateDocument(
      await readJson('data/posts/' + id + '.json', token, snapshot.headSha),
    );
    if (documentData.id !== id) {
      throw new Error('글과 본문이 일치하지 않습니다.');
    }
    return documentData;
  }

  async function save(token, snapshot, nextIndex, documentData = null, deletedId = null) {
    Posts.validateIndex(nextIndex);
    if (documentData) {
      Posts.validateDocument(documentData);
      if (!nextIndex.posts.some((post) => post.id === documentData.id)) {
        throw new Error('본문에 해당하는 목록 항목이 없습니다.');
      }
    }
    if (
      deletedId &&
      (!Posts.validId(deletedId) || nextIndex.posts.some((post) => post.id === deletedId))
    ) {
      throw new Error('삭제할 글을 확인해 주세요.');
    }
    if (token?.type === 'session') {
      const saved = await AdminAuth.request('/posts/save', token, {
        method: 'POST',
        body: { headSha: snapshot.headSha, index: nextIndex, document: documentData, deletedId },
      });
      Posts.validateIndex(saved.index);
      return saved;
    }
    const reference = await request('/git/ref/heads/' + branch, token);
    if (reference.object.sha !== snapshot.headSha) {
      throw new Error('다른 변경사항이 저장되었습니다. 초안을 보관한 후 새로 불러와 주세요.');
    }
    const tree = [
      {
        path: indexPath,
        mode: '100644',
        type: 'blob',
        content: JSON.stringify(nextIndex, null, 2) + '\n',
      },
    ];
    if (documentData) {
      tree.push({
        path: 'data/posts/' + documentData.id + '.json',
        mode: '100644',
        type: 'blob',
        content: JSON.stringify(documentData, null, 2) + '\n',
      });
    }
    if (deletedId) {
      tree.push({
        path: 'data/posts/' + deletedId + '.json',
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }
    // 목록과 본문을 한 커밋에 저장하고 기존 HEAD를 부모로 사용해 동시 편집을 보호합니다.
    const nextTree = await request('/git/trees', token, {
      method: 'POST',
      body: JSON.stringify({ base_tree: snapshot.treeSha, tree }),
    });
    const commit = await request('/git/commits', token, {
      method: 'POST',
      body: JSON.stringify({
        message: documentData
          ? 'Publish post: ' + nextIndex.posts.find((post) => post.id === documentData.id).title
          : 'Update posts and categories',
        tree: nextTree.sha,
        parents: [snapshot.headSha],
      }),
    });
    await request('/git/refs/heads/' + branch, token, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return { headSha: commit.sha, treeSha: nextTree.sha, index: structuredClone(nextIndex) };
  }

  globalThis.PostsStorage = { loadSnapshot, loadDocument, save };
})();
