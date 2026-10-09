(() => {
  'use strict';

  const panel = document.getElementById('visitor-info');
  if (!panel) {
    return;
  }
  const clock = document.getElementById('visitor-time');
  const ipValue = document.getElementById('visitor-ip');
  const countryValue = document.getElementById('visitor-country');
  const unavailable = '확인 불가';
  const dateFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let clockTimer;

  function updateClock() {
    const now = new Date();
    clock.textContent = dateFormat.format(now);
    clock.dateTime = now.toISOString();
  }

  function stopClock() {
    clearInterval(clockTimer);
  }

  function startClock() {
    stopClock();
    if (!document.hidden) {
      updateClock();
      clockTimer = setInterval(updateClock, 1000);
    }
  }

  function countryName(code) {
    if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code) || code === 'XX') {
      return unavailable;
    }
    if (typeof Intl.DisplayNames === 'function') {
      const names = new Intl.DisplayNames(['ko'], { type: 'region' });
      return names.of(code) || code;
    }
    return code;
  }

  async function loadNetworkInfo() {
    const controller = new AbortController();
    const config = PortfolioConfig.visitor;
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(config.endpoint, {
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('Visitor information unavailable');
      }
      const data = await response.json();
      ipValue.textContent =
        typeof data?.ip === 'string' && /^[\da-fA-F.:]{3,45}$/.test(data.ip)
          ? data.ip
          : unavailable;
      countryValue.textContent = countryName(data?.country);
    } catch {
      ipValue.textContent = unavailable;
      countryValue.textContent = unavailable;
    } finally {
      clearTimeout(timeout);
    }
  }

  panel.hidden = false;
  clock.title = dateFormat.resolvedOptions().timeZone;
  document.addEventListener('visibilitychange', startClock);
  window.addEventListener('pagehide', stopClock);
  window.addEventListener('pageshow', startClock);
  startClock();
  loadNetworkInfo();
})();
