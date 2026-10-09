(() => {
  'use strict';

  const { repository, branch, contentPath, apiVersion, requestTimeoutMs } = PortfolioConfig.github;
  const contentEndpoint = `/repos/${repository}/contents/${contentPath}`;
  const encodingChunkSize = 8192;

  const errorMessages = {
    401: '인증이 만료되었거나 토큰이 올바르지 않습니다. 편집 내용은 유지됩니다.',
    403: '저장소 접근 권한 또는 API 사용 한도를 확인해 주세요. 저장에는 Contents 읽기 및 쓰기 권한이 필요합니다.',
    404: '저장소 또는 포트폴리오 파일에 접근할 수 없습니다. 토큰의 저장소 선택을 확인해 주세요.',
    409: '다른 곳에서 내용이 변경되었습니다. 변경 내용을 따로 보관한 뒤 ‘새로 불러오기’를 눌러 주세요.',
    422: `저장하지 못했습니다. 토큰 권한과 ${branch} 브랜치의 보호 규칙을 확인해 주세요.`,
  };

  function encodePortfolio(data) {
    // GitHub Contents API는 UTF-8 파일 내용을 Base64 문자열로 받습니다.
    const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n');
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += encodingChunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + encodingChunkSize));
    }

    return btoa(binary);
  }

  function decodePortfolio(content) {
    const binary = atob(content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    return JSON.parse(json);
  }

  async function requestGitHub(path, token, options = {}) {
    let response;

    try {
      response = await fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': apiVersion,
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new Error(
        'GitHub에 연결하지 못했습니다. 입력한 내용은 유지됩니다. 연결 상태를 확인해 주세요.',
      );
    }

    if (!response.ok) {
      throw new Error(
        errorMessages[response.status] || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    return response.json();
  }

  async function verifyWriteAccess(token) {
    const repositoryInfo = await requestGitHub(`/repos/${repository}`, token);

    if (!repositoryInfo.permissions?.push) {
      throw new Error('이 저장소를 수정할 수 있는 계정의 토큰으로 로그인해 주세요.');
    }
  }

  async function loadPortfolio(token) {
    const remote = await requestGitHub(`${contentEndpoint}?ref=${branch}`, token);

    if (remote.encoding !== 'base64' || !remote.content || !remote.sha) {
      throw new Error('포트폴리오 파일을 읽을 수 없습니다.');
    }

    return {
      data: Portfolio.validatePortfolio(decodePortfolio(remote.content)),
      sha: remote.sha,
    };
  }

  async function savePortfolio(token, data, sha) {
    const publicData = Portfolio.preparePortfolioForPublication(data);

    // 마지막으로 읽은 SHA를 전달하면 다른 편집자의 변경을 덮어쓰지 않습니다.
    const saved = await requestGitHub(contentEndpoint, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Update portfolio from admin',
        content: encodePortfolio(publicData),
        sha,
        branch,
      }),
    });

    if (!saved.content?.sha) {
      throw new Error('저장 결과를 확인하지 못했습니다. GitHub 저장소를 확인해 주세요.');
    }

    return saved.content.sha;
  }

  window.PortfolioStorage = { loadPortfolio, savePortfolio, verifyWriteAccess };
})();
