const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbotWindow = document.getElementById('chatbot-window');
const chatClose = document.getElementById('chat-close');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const sendBtn = document.getElementById('send-btn');
const chatText = (ko, en) => window.portfolioI18n.text(ko, en);
function setChatOpen(open) {
  chatbotWindow.classList.toggle('active', open);
  chatbotToggle.setAttribute('aria-expanded', String(open));
  if (open) userInput.focus(); else chatbotToggle.focus();
}
chatbotToggle.addEventListener('click', () => setChatOpen(!chatbotWindow.classList.contains('active')));
chatClose.addEventListener('click', () => setChatOpen(false));
chatbotWindow.addEventListener('keydown', event => { if (event.key === 'Escape') setChatOpen(false); });
function appendMessage(text, className) {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  chatMessages.append(element);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return element;
}
document.getElementById('chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const message = userInput.value.trim();
  if (!message || sendBtn.disabled) return;
  appendMessage(message, 'user-message');
  userInput.value = '';
  sendBtn.disabled = true;
  const pending = appendMessage(chatText('답변을 준비하고 있습니다…', 'Thinking…'), 'bot-message');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('https://chatbot.leedidc1227.workers.dev', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }), signal: controller.signal
    });
    if (!response.ok) throw new Error('Chat request failed');
    const data = await response.json();
    if (typeof data.reply !== 'string') throw new Error('Invalid chat response');
    pending.textContent = data.reply;
  } catch (_) {
    pending.textContent = chatText('연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Unable to connect. Please try again shortly.');
  } finally {
    clearTimeout(timeout);
    sendBtn.disabled = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});