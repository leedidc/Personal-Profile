(() => {
  'use strict';
  const panel = document.querySelector('.visitor-map-card');
  const sessionKey = 'portfolio-visit-at-v1';
  const interval = 30 * 60 * 1000;
  const formatter = new Intl.NumberFormat('ko-KR');
  const regionNames = new Intl.DisplayNames(['ko'], { type: 'region' });
  let countries = [];
  let busy = false;

  function needsVisit() {
    if (location.origin !== PortfolioConfig.admin.publicOrigin) {
      return false;
    }
    try {
      const previous = Number(sessionStorage.getItem(sessionKey));
      return !previous || Date.now() - previous >= interval || previous > Date.now();
    } catch {
      return true;
    }
  }

  function rememberVisit() {
    try {
      sessionStorage.setItem(sessionKey, String(Date.now()));
    } catch {
      // 저장소 차단 시 식별자나 쿠키를 만들어 우회하지 않습니다.
    }
  }

  async function readJson(url, method = 'GET') {
    const response = await fetch(url, {
      method,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(PortfolioConfig.visitor.requestTimeoutMs),
    });
    if (!response.ok) {
      throw new Error('Statistics unavailable');
    }
    return response.json();
  }

  function validateStatistics(data) {
    if (data?.days !== 30 || !Array.isArray(data.countries) || data.countries.length > 250) {
      throw new Error('Invalid statistics');
    }
    const codes = new Set();
    let total = 0;
    for (const country of data.countries) {
      if (
        !/^[A-Z]{2}$/.test(country?.code || '') ||
        country.code === 'XX' ||
        codes.has(country.code) ||
        !Number.isSafeInteger(country.count) ||
        country.count < 1 ||
        country.count > 30000000
      ) {
        throw new Error('Invalid country statistics');
      }
      codes.add(country.code);
      total += country.count;
    }
    if (data.total !== total) {
      throw new Error('Invalid visit total');
    }
    return data;
  }

  function selectCountry(code) {
    const country = countries.find((entry) => entry.code === code);
    if (!country) {
      return;
    }
    const total = countries.reduce((sum, entry) => sum + entry.count, 0);
    document.getElementById('visitor-map-selection').textContent =
      regionNames.of(code) +
      ' · ' +
      formatter.format(country.count) +
      '회 · ' +
      ((country.count / total) * 100).toFixed(1) +
      '%';
    document.getElementById('visitor-country-select').value = code;
    panel.querySelectorAll('.visitor-map-point').forEach((point) => {
      point.setAttribute('aria-pressed', String(point.dataset.country === code));
    });
  }

  function renderStatistics(data, positions) {
    countries = data.countries;
    document.getElementById('visitor-total').textContent = formatter.format(data.total);
    document.getElementById('visitor-country-count').textContent = formatter.format(
      countries.length,
    );
    const select = document.getElementById('visitor-country-select');
    const points = document.getElementById('visitor-map-points');
    select.replaceChildren();
    points.replaceChildren();
    select.disabled = countries.length === 0;
    for (const country of countries) {
      const label = regionNames.of(country.code) + ' · ' + formatter.format(country.count) + '회';
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = label;
      select.append(option);
      const position = positions?.[country.code];
      if (
        !Array.isArray(position) ||
        position.length !== 2 ||
        !position.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
      ) {
        continue;
      }
      const point = document.createElement('button');
      point.type = 'button';
      point.className = 'visitor-map-point';
      point.dataset.country = country.code;
      point.setAttribute('aria-label', label + ', 국가 대표 위치');
      point.title = label;
      point.style.left = position[0] + '%';
      point.style.top = position[1] + '%';
      point.style.setProperty(
        '--point-size',
        Math.min(15, 7 + Math.log2(country.count + 1)) + 'px',
      );
      point.addEventListener('click', () => selectCountry(country.code));
      points.append(point);
    }
    if (countries.length) {
      selectCountry(countries[0].code);
    } else {
      const option = document.createElement('option');
      option.textContent = '아직 집계된 방문 없음';
      select.append(option);
      document.getElementById('visitor-map-selection').textContent =
        '첫 방문부터 국가별 점이 표시됩니다.';
    }
  }

  async function loadStatistics() {
    if (busy) {
      return;
    }
    busy = true;
    const record = needsVisit();
    try {
      const data = validateStatistics(
        await readJson(PortfolioConfig.visitor.statsEndpoint, record ? 'POST' : 'GET'),
      );
      if (record) {
        rememberVisit();
      }
      if (panel) {
        let positions = {};
        try {
          positions = await readJson('data/visitor-country-map.json');
        } catch {
          // 지도 좌표 파일이 없더라도 국가별 집계 목록은 표시합니다.
        }
        renderStatistics(data, positions);
        document.getElementById('visitor-map-retry').hidden = true;
      }
    } catch {
      if (panel) {
        document.getElementById('visitor-map-selection').textContent =
          '방문 통계를 불러오지 못했습니다.';
        document.getElementById('visitor-map-retry').hidden = false;
      }
    } finally {
      busy = false;
    }
  }
  if (panel) {
    document
      .getElementById('visitor-country-select')
      .addEventListener('change', (event) => selectCountry(event.target.value));
    document.getElementById('visitor-map-retry').addEventListener('click', loadStatistics);
  }
  if (panel || needsVisit()) {
    loadStatistics();
  }
})();
