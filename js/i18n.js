/* Static UI translations live next to their English fallback in data-ko attributes. */
(() => {
  let language = 'ko';
  try { const saved = localStorage.getItem('portfolio_language'); if (saved === 'ko' || saved === 'en') language = saved; } catch (_) {}
  const originals = new WeakMap();
  function apply(root = document) {
    root.querySelectorAll('[data-ko], [data-ko-placeholder], [data-ko-aria]').forEach(element => {
      if (!originals.has(element)) originals.set(element, { text: element.textContent, placeholder: element.getAttribute('placeholder'), aria: element.getAttribute('aria-label') });
      const original = originals.get(element);
      if (element.hasAttribute('data-ko')) element.textContent = language === 'ko' ? element.dataset.ko : original.text;
      if (element.hasAttribute('data-ko-placeholder')) element.setAttribute('placeholder', language === 'ko' ? element.dataset.koPlaceholder : original.placeholder);
      if (element.hasAttribute('data-ko-aria')) element.setAttribute('aria-label', language === 'ko' ? element.dataset.koAria : original.aria);
    });
    document.documentElement.lang = language;
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  }
  window.portfolioI18n = { get language() { return language; }, text(ko, en) { return language === 'ko' ? ko : en; }, apply };
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem('portfolio_language', language); } catch (_) {}
    apply();
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
  }));
  apply();
})();