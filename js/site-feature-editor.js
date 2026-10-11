(() => {
  'use strict';
  let applyChanges;
  const form = document.getElementById('site-feature-form');
  const dialog = document.getElementById('site-feature-dialog');
  const list = document.getElementById('site-feature-list');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const features = Object.fromEntries(
      PortfolioConfig.siteFeatures.map(({ key }) => [key, form.elements.namedItem(key).checked]),
    );
    applyChanges(features);
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    applyChanges = null;
    list.replaceChildren();
  });
  window.SiteFeatureEditor = {
    open(data, onApply) {
      applyChanges = onApply;
      list.replaceChildren();
      for (const feature of PortfolioConfig.siteFeatures) {
        const label = Portfolio.createElement('label', 'feature-setting');
        const input = Portfolio.createElement('input');
        input.type = 'checkbox';
        input.name = feature.key;
        input.checked = Portfolio.featureEnabled(data, feature.key);
        const text = Portfolio.createElement('span');
        text.append(
          Portfolio.createElement('strong', '', feature.label),
          Portfolio.createElement('small', '', feature.description),
        );
        label.append(input, text);
        list.append(label);
      }
      dialog.showModal();
    },
  };
})();
