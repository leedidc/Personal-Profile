function renderCertificates() {
  const text = (ko, en) => window.portfolioI18n.text(ko, en);
  document.querySelectorAll('.cvx-card').forEach(card => {
    card.querySelectorAll('.cvx-badge,.cvx-bar,.cvx-dates').forEach(element => element.remove());
    const created = new Date(card.dataset.date + 'T00:00:00');
    const baseString = card.dataset.lastUpdate || card.dataset.date;
    const base = new Date(baseString + 'T00:00:00');
    const years = Number(card.dataset.years);
    const now = new Date();
    const badge = document.createElement('div'); badge.className = 'cvx-badge';
    const info = document.createElement('div'); info.className = 'cvx-dates';
    const first = document.createElement('div'); first.textContent = text('최초 취득: ', 'First issued: ') + card.dataset.date;
    const updated = document.createElement('div'); updated.textContent = text('갱신 기준: ', 'Validity base: ') + baseString;
    info.append(first, updated);
    if (years === 0) { badge.textContent = text('유효기간 없음', 'No expiry'); badge.classList.add('perm'); }
    else {
      const expiry = new Date(base); expiry.setFullYear(expiry.getFullYear() + years);
      const expired = now >= expiry;
      const remaining = Math.max(0, Math.ceil((expiry - now) / 86400000));
      badge.textContent = expired ? text('갱신 확인 필요', 'Renewal due') : text(remaining + '일 남음', remaining + ' days left');
      const bar = document.createElement('div'); bar.className = 'cvx-bar';
      const fill = document.createElement('div'); fill.className = 'cvx-fill';
      fill.style.width = Math.max(0, Math.min(100, (now - base) / (expiry - base) * 100)) + '%';
      bar.append(fill); card.append(bar);
      const end = document.createElement('div');
      end.textContent = text('만료 예정: ', 'Expires: ') + expiry.getFullYear() + '-' + String(expiry.getMonth() + 1).padStart(2, '0') + '-' + String(expiry.getDate()).padStart(2, '0');
      info.append(end);
    }
    card.append(badge, info);
  });
}
document.addEventListener('languagechange', renderCertificates);
renderCertificates();