(() => {
  'use strict';

  const dialog = document.getElementById('resource-monitor-dialog');
  let requestVersion = 0;
  const status = document.getElementById('resource-monitor-status');
  const coverage = document.getElementById('resource-monitor-coverage');
  const changes = document.getElementById('resource-update-list');
  const errors = document.getElementById('resource-monitor-errors');
  const errorList = document.getElementById('resource-error-list');
  const officialHosts = new Set([
    'www.kisa.or.kr',
    'www.privacy.go.kr',
    'pipc.go.kr',
    'isms-p.or.kr',
    'www.krcert.or.kr',
    'isds.kisa.or.kr',
    'www.sen.go.kr',
  ]);
  const dateFormat = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  });

  function validEntry(entry, field) {
    if (
      !entry ||
      typeof entry.title !== 'string' ||
      entry.title.length > 300 ||
      typeof entry[field] !== 'string' ||
      entry[field].length > 1000 ||
      typeof entry.sourceUrl !== 'string' ||
      entry.sourceUrl.length > 1500
    ) {
      return false;
    }
    try {
      const url = new URL(entry.sourceUrl);
      return (
        url.protocol === 'https:' &&
        officialHosts.has(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port
      );
    } catch {
      return false;
    }
  }

  function validateReport(report) {
    const counts = [
      'resourcesChecked',
      'resourcesTotal',
      'boardsChecked',
      'boardsTotal',
      'filesChecked',
      'metadataOnlyFiles',
    ];
    if (
      !report ||
      report.schemaVersion !== 1 ||
      !['ok', 'partial'].includes(report.status) ||
      typeof report.checkedAt !== 'string' ||
      !Number.isFinite(Date.parse(report.checkedAt)) ||
      Date.parse(report.checkedAt) > Date.now() + 300000 ||
      !counts.every(
        (key) => Number.isInteger(report[key]) && report[key] >= 0 && report[key] <= 10000,
      ) ||
      report.resourcesChecked > report.resourcesTotal ||
      report.boardsChecked > report.boardsTotal ||
      !Array.isArray(report.changes) ||
      report.changes.length > 300 ||
      !report.changes.every(
        (entry) => validEntry(entry, 'kind') && Number.isFinite(Date.parse(entry.detectedAt)),
      ) ||
      !Array.isArray(report.errors) ||
      report.errors.length > 400 ||
      !report.errors.every((entry) => validEntry(entry, 'reason')) ||
      (report.status === 'ok' &&
        (report.errors.length ||
          report.resourcesChecked !== report.resourcesTotal ||
          report.boardsChecked !== report.boardsTotal))
    ) {
      throw new Error('점검 결과 형식 오류');
    }
    return report;
  }

  function addEntry(list, entry, detail) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.textContent = entry.title;
    link.href = entry.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const description = document.createElement('span');
    description.textContent = detail;
    item.append(link, description);
    list.append(item);
  }

  async function open(credential) {
    const version = ++requestVersion;
    changes.replaceChildren();
    errorList.replaceChildren();
    coverage.textContent = '';
    errors.textContent = '';
    status.textContent = '점검 결과를 불러오는 중입니다.';
    dialog.showModal();
    try {
      const report = validateReport(await PortfolioStorage.loadResourceUpdates(credential));
      if (version !== requestVersion || !dialog.open) {
        return;
      }
      const stale = Date.now() - Date.parse(report.checkedAt) > 72 * 60 * 60 * 1000;
      const result = stale
        ? '자동 점검이 지연되고 있습니다'
        : report.status === 'partial'
          ? '일부 출처 확인 필요'
          : '자동 점검 완료';
      status.textContent =
        result +
        ' · ' +
        dateFormat.format(new Date(report.checkedAt)) +
        ' · 변경 이력 ' +
        report.changes.length +
        '건';
      coverage.textContent =
        '자료 ' +
        report.resourcesChecked +
        '/' +
        report.resourcesTotal +
        '개 · 게시판 ' +
        report.boardsChecked +
        '/' +
        report.boardsTotal +
        '곳 · 파일 내용 ' +
        report.filesChecked +
        '개 비교 · 첨부 목록만 확인 ' +
        report.metadataOnlyFiles +
        '개';
      for (const item of report.changes) {
        addEntry(changes, item, item.kind + ' · ' + dateFormat.format(new Date(item.detectedAt)));
      }
      errors.textContent = report.errors.length
        ? '확인하지 못한 출처 ' + report.errors.length + '건 — 다음 점검에서 다시 확인합니다.'
        : '최근 90일 변경 감지 이력입니다. 최초 점검은 이후 비교를 위한 기준을 저장합니다.';
      for (const item of report.errors) {
        addEntry(errorList, item, item.reason);
      }
    } catch (error) {
      if (version !== requestVersion || !dialog.open) {
        return;
      }
      if (error.status === 401) {
        dialog.close();
        document.getElementById('status').textContent = error.message;
        AdminAuth.focusLogin();
        return;
      }
      status.textContent = error.message;
    }
  }

  function clear() {
    requestVersion += 1;
    changes.replaceChildren();
    errorList.replaceChildren();
    status.textContent = '';
    coverage.textContent = '';
    errors.textContent = '';
  }
  dialog.addEventListener('close', clear);
  window.ResourceMonitor = { open, clear };
})();
