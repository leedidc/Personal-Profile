(() => {
  'use strict';
  const { createElement } = Portfolio;
  const title = document.getElementById('research-editor-title');
  const link = document.getElementById('research-editor-link');
  const list = document.getElementById('research-slides');
  const add = document.getElementById('add-research-slide');
  let slides = [];

  function render(focusIndex) {
    list.replaceChildren();
    slides.forEach((slide, index) => {
      const card = createElement('section', 'research-slide-editor');
      const header = createElement('div', 'research-editor-heading');
      header.append(createElement('h3', '', `슬라이드 ${index + 1}`));
      const actions = createElement('div', 'editor-actions');
      for (const [text, label, offset] of [
        ['↑', '위로', -1],
        ['↓', '아래로', 1],
        ['삭제', '삭제', 0],
      ]) {
        const button = createElement('button', 'button small', text);
        button.type = 'button';
        button.setAttribute('aria-label', `${index + 1}번 슬라이드 ${label}`);
        button.disabled =
          (offset === -1 && index === 0) || (offset === 1 && index === slides.length - 1);
        button.addEventListener('click', () => {
          const [moved] = slides.splice(index, 1);
          if (offset) {
            slides.splice(index + offset, 0, moved);
          }
          render(Math.min(slides.length - 1, Math.max(0, index + offset)));
          if (!slides.length) {
            add.focus();
          }
        });
        actions.append(button);
      }
      header.append(actions);
      card.append(header);
      for (const [key, label, maximum] of [
        ['title', '제목', 160],
        ['body', '내용', 3000],
      ]) {
        const field = createElement('div', 'field');
        const inputId = `research-slide-${index}-${key}`;
        const caption = createElement('label', '', label);
        caption.htmlFor = inputId;
        const input = createElement(key === 'body' ? 'textarea' : 'input');
        input.id = inputId;
        input.value = slide[key];
        input.maxLength = maximum;
        input.required = true;
        if (key === 'body') {
          input.rows = 5;
        }
        input.addEventListener('input', () => {
          slide[key] = input.value;
        });
        field.append(caption, input);
        card.append(field);
      }
      list.append(card);
    });
    add.disabled = slides.length >= 12;
    if (focusIndex !== undefined && focusIndex >= 0) {
      list.children[focusIndex]?.querySelector('input').focus();
    }
  }

  add.addEventListener('click', () => {
    if (slides.length < 12) {
      slides.push({ title: '', body: '' });
      render(slides.length - 1);
    }
  });

  function load(research) {
    title.value = research?.title || '';
    link.value = research?.link || '';
    slides = structuredClone(research?.slides || []);
    render();
  }

  function read() {
    if (!slides.length) {
      return;
    }
    const research = {
      title: title.value.trim(),
      link: link.value.trim(),
      slides: slides.map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })),
    };
    Portfolio.validateAwardResearch(research);
    return research;
  }

  window.AwardResearchEditor = { load, read };
})();
