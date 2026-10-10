(() => {
  'use strict';
  const status = document.getElementById('resource-monitor-status');
  const format = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  });

  async function loadCheckDate() {
    try {
      const response = await fetch('../data/resource-update-status.json', {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error('점검일 확인 실패');
      }
      const summary = await response.json();
      if (
        summary.schemaVersion !== 1 ||
        typeof summary.checkedAt !== 'string' ||
        !Number.isFinite(Date.parse(summary.checkedAt)) ||
        Date.parse(summary.checkedAt) > Date.now() + 300000
      ) {
        throw new Error('점검일 형식 오류');
      }
      status.textContent =
        '마지막 자동 점검 ' + format.format(new Date(summary.checkedAt)) + ' (한국 시간)';
      status.hidden = false;
    } catch {
      status.hidden = true;
    }
  }

  loadCheckDate();
})();
