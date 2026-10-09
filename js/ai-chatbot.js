(() => {
  'use strict';
  const { createElement } = Portfolio;
  const { chatbot } = PortfolioConfig;
  const getElement = (id) => document.getElementById(id);
  const panel = getElement('ai-chat-panel');
  const launcher = getElement('ai-chat-launcher');
  const form = getElement('ai-chat-form');
  const input = getElement('ai-chat-input');
  const messages = getElement('ai-chat-messages');
  const suggestions = getElement('ai-chat-suggestions');
  const status = getElement('ai-chat-status');
  let portfolio;
  let history = [];
  let pendingRequest = null;
  let conversationVersion = 0;

  function updateControls() {
    getElement('ai-chat-send').disabled = Boolean(pendingRequest) || !input.value.trim();
    for (const button of panel.querySelectorAll('[data-question], .ai-chat-retry')) {
      button.disabled = Boolean(pendingRequest);
    }
    messages.setAttribute('aria-busy', String(Boolean(pendingRequest)));
    status.textContent = pendingRequest ? '공개 이력을 확인하며 답변을 준비하고 있습니다…' : '';
  }

  function scrollToLatest() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendMessage(role, text) {
    const item = createElement(
      'li',
      'ai-chat-message ' + (role === 'user' ? 'is-user' : 'is-assistant'),
    );
    item.append(
      createElement('span', 'ai-chat-speaker', role === 'user' ? '내 질문' : 'AI 답변'),
      createElement('p', '', text),
    );
    messages.append(item);
    while (messages.children.length > 40) {
      messages.firstElementChild.remove();
    }
    scrollToLatest();
    return item;
  }

  async function sendQuestion(question, retryMessage) {
    question = question.trim();
    if (pendingRequest || !question || question.length > chatbot.maxQuestionLength) {
      return;
    }
    if (!retryMessage) {
      appendMessage('user', question);
    } else {
      retryMessage.remove();
    }
    messages.querySelectorAll('.ai-chat-retry').forEach((button) => button.remove());
    suggestions.hidden = true;
    const request = new AbortController();
    const version = conversationVersion;
    pendingRequest = request;
    updateControls();
    try {
      const reply = await PortfolioChatService.ask({
        portfolio,
        history,
        question,
        signal: request.signal,
      });
      if (version !== conversationVersion) {
        return;
      }
      history.push({ role: 'user', text: question }, { role: 'assistant', text: reply });
      history = history.slice(-chatbot.historyTurns * 2);
      appendMessage('assistant', reply);
    } catch (error) {
      if (version !== conversationVersion || error.name === 'AbortError') {
        return;
      }
      const failure = appendMessage('assistant', error.message);
      failure.classList.add('is-error');
      const retry = createElement('button', 'button small ai-chat-retry', '다시 시도');
      retry.type = 'button';
      retry.addEventListener('click', () => sendQuestion(question, failure));
      failure.append(retry);
      scrollToLatest();
    } finally {
      if (version === conversationVersion) {
        pendingRequest = null;
        updateControls();
      }
    }
  }

  function resetConversation() {
    conversationVersion += 1;
    pendingRequest?.abort();
    pendingRequest = null;
    history = [];
    input.value = '';
    messages.replaceChildren();
    suggestions.hidden = false;
    appendMessage(
      'assistant',
      portfolio.profile.name +
        '의 공개 포트폴리오를 안내해 드립니다. 경력, 자격증, 프로젝트나 연구에 대해 물어보세요.',
    );
    updateControls();
  }

  function closePanel() {
    panel.close();
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', () => {
    if (panel.open) {
      closePanel();
    } else {
      panel.show();
      launcher.setAttribute('aria-expanded', 'true');
      scrollToLatest();
      input.focus();
    }
  });
  getElement('ai-chat-close').addEventListener('click', closePanel);
  getElement('ai-chat-reset').addEventListener('click', () => {
    resetConversation();
    input.focus();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  });
  panel.querySelectorAll('.ai-chat-reference a').forEach((link) => {
    link.addEventListener('click', closePanel);
  });
  suggestions.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => sendQuestion(button.dataset.question));
  });
  input.maxLength = chatbot.maxQuestionLength;
  input.addEventListener('input', updateControls);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!pendingRequest && question && question.length <= chatbot.maxQuestionLength) {
      input.value = '';
      sendQuestion(question);
    }
  });

  function initialize(data) {
    portfolio = data;
    getElement('ai-chat-description').textContent =
      data.profile.name + '의 경력과 연구를 물어보세요.';
    resetConversation();
    launcher.hidden = false;
  }

  window.PortfolioChatbot = { initialize };
})();
