import '../../js/portfolio-config.js';
import '../../js/portfolio-core.js';
import '../../js/portfolio-skills.js';
import '../../js/posts-core.js';
import '../../js/portfolio-github.js';
import '../../js/posts-github.js';

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function requireValue(condition) {
  if (!condition) {
    throw new RequestError(400, '요청 내용을 확인해 주세요.');
  }
}

function validate(validator, value) {
  try {
    return validator(value);
  } catch {
    throw new RequestError(400, '저장할 내용의 형식과 허용된 주소를 확인해 주세요.');
  }
}

export async function handleContent(path, method, body, token) {
  if (path === '/portfolio' && method === 'GET') {
    return PortfolioStorage.loadPortfolio(token);
  }
  if (path === '/portfolio' && method === 'PUT') {
    requireValue(/^[a-f0-9]{40}$/.test(body.sha));
    const data = validate(Portfolio.preparePortfolioForPublication, body.data);
    return { sha: await PortfolioStorage.savePortfolio(token, data, body.sha) };
  }
  if (path === '/posts/snapshot' && method === 'GET') {
    return PostsStorage.loadSnapshot(token, true);
  }
  if (path === '/posts/read' && method === 'POST') {
    requireValue(/^[a-f0-9]{40}$/.test(body.headSha) && Posts.validId(body.id));
    return PostsStorage.loadDocument(token, { headSha: body.headSha }, body.id);
  }
  if (path === '/posts/save' && method === 'POST') {
    requireValue(/^[a-f0-9]{40}$/.test(body.headSha));
    validate(Posts.validateIndex, body.index);
    if (body.document != null) {
      validate(Posts.validateDocument, body.document);
      requireValue(body.index.posts.some((post) => post.id === body.document.id));
    }
    if (body.deletedId != null) {
      requireValue(
        Posts.validId(body.deletedId) &&
          !body.index.posts.some((post) => post.id === body.deletedId),
      );
    }
    // 브라우저가 보낸 트리 SHA를 신뢰하지 않고 현재 브랜치의 트리에서만 수정합니다.
    const current = await PostsStorage.loadSnapshot(token);
    if (current.headSha !== body.headSha) {
      throw new RequestError(
        409,
        '다른 변경사항이 저장되었습니다. 초안을 보관한 후 새로 불러와 주세요.',
      );
    }
    return PostsStorage.save(
      token,
      current,
      body.index,
      body.document ?? null,
      body.deletedId ?? null,
    );
  }
  throw new RequestError(404, '요청한 관리 기능이 없습니다.');
}
