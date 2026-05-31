const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbotWindow = document.getElementById('chatbot-window');
const chatClose = document.getElementById('chat-close');

const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');

/* =========================
   OPEN / CLOSE
========================= */

chatbotToggle.addEventListener('click', () => {
    chatbotWindow.classList.toggle('active');
});

chatClose.addEventListener('click', () => {
    chatbotWindow.classList.remove('active');
});

/* =========================
   AI REQUEST
========================= */

async function askAI(message) {

    const response = await fetch(
        'https://chatbot.leedidc1227.workers.dev',
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                message
            })
        }
    );

    if (!response.ok) {
        throw new Error('API Error');
    }

    const data = await response.json();

    return data.reply;
}

/* =========================
   SEND MESSAGE
========================= */

async function sendMessage() {

    const text = userInput.value.trim();

    if (!text) return;

    chatMessages.innerHTML += `
        <div class="user-message">
            ${text}
        </div>
    `;

    userInput.value = '';

    /* 로딩 메시지 */
    const loadingId = `loading-${Date.now()}`;

    chatMessages.innerHTML += `
        <div class="bot-message" id="${loadingId}">
            Thinking...
        </div>
    `;

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

    try {

        const reply = await askAI(text);

        document.getElementById(loadingId).outerHTML = `
            <div class="bot-message">
                ${reply}
            </div>
        `;

    } catch (error) {

        document.getElementById(loadingId).outerHTML = `
            <div class="bot-message">
                Failed to connect to AI assistant.
            </div>
        `;

        console.error(error);
    }

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', (e) => {

    if (e.key === 'Enter') {
        sendMessage();
    }

});