document.getElementById('start-btn').addEventListener('click', startInterview);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('end-btn').addEventListener('click', endInterview);

let messages = [];
let currentProvider = 'claude';

function startInterview() {
    const interviewType = document.getElementById('interview-type').value;
    const customPrompt = document.getElementById('custom-prompt').value;
    currentProvider = document.getElementById('api-choice').value;

  document.querySelector('.setup-section').style.display = 'none';
    document.getElementById('interview-section').style.display = 'block';

  messages = [];
    document.getElementById('chat-messages').innerHTML = '';

  const initialMessage = customPrompt || `You are conducting a ${interviewType} interview. Ask the candidate your first question.`;
    getAIResponse(initialMessage);
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const userMessage = input.value.trim();

  if (!userMessage) return;

  messages.push({ role: 'user', content: userMessage });
    addMessageToChat('user', userMessage);

  input.value = '';
    document.getElementById('loading').style.display = 'block';

  getAIResponse();
}

function getAIResponse(initialPrompt = null) {
    const endpoint = currentProvider === 'claude' ? '/api/interview-claude' : '/api/interview-openai';
    const interviewType = document.getElementById('interview-type').value;
    const customPrompt = document.getElementById('custom-prompt').value;

  const payload = {
        messages: messages.length === 0 ? [{ role: 'user', content: initialPrompt }] : messages,
        interviewType: interviewType,
        customPrompt: customPrompt
  };

  fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
          document.getElementById('loading').style.display = 'none';
          if (data.error) {
                  addMessageToChat('assistant', `Error: ${data.error}`);
          } else {
                  messages.push({ role: 'assistant', content: data.content });
                  addMessageToChat('assistant', data.content);
          }
    })
    .catch(error => {
          document.getElementById('loading').style.display = 'none';
          addMessageToChat('assistant', `Error: ${error.message}`);
    });
}

function addMessageToChat(role, content) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function endInterview() {
    document.querySelector('.setup-section').style.display = 'block';
    document.getElementById('interview-section').style.display = 'none';
    messages = [];
}
