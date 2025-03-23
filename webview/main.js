// 初始化 vscode API
const vscode = acquireVsCodeApi();

// 全局状态
let pendingMessageElement = null;
let currentBotMessage = '';

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    setupMessageListeners();
});

// 初始化UI
function initializeUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="chat-container">
            <div id="chat-messages" class="chat-messages"></div>
            <div class="chat-input">
                <textarea id="message-input" placeholder="输入消息..."></textarea>
                <button id="send-button">发送</button>
            </div>
        </div>
    `;

    // 添加事件监听器
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
    }
});

// 设置消息监听器
function setupMessageListeners() {
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'add-message':
                addMessage(message.value.sender, message.value.message, message.value.pending);
                break;
            case 'update-message':
                updatePendingMessage(message.value.sender, message.value.message);
                break;
            case 'clear-chat':
                clearChat();
                break;
            case 'streamed-response':
                handleStreamedResponse(message.text);
                break;
        }
    });
}

    sendButton.addEventListener('click', sendMessage);
}

// 发送消息
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (!message) return;

    // 清空输入框
    messageInput.value = '';

    // 添加用户消息到界面
    addMessage('user', message);

    // 发送消息到扩展
    vscode.postMessage({
        type: 'send-message',
        value: message
    });
}

// 处理流式响应
function handleStreamedResponse(text) {
    if (!pendingMessageElement) {
        addMessage('bot', text, true); // 创建新的待处理消息
    } else {
        currentBotMessage += text;
        pendingMessageElement.textContent = currentBotMessage; // 更新现有消息
    }
}

// 添加消息到界面 (修改以支持部分消息)
function addMessage(sender, message, pending = false) {
    const chatMessages = document.getElementById('chat-messages');
    let messageElement;

    if (sender === 'bot' && pending) {
        messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.textContent = message;
        pendingMessageElement = messageElement;
        currentBotMessage = message; // 初始化当前 bot 消息
        chatMessages.appendChild(messageElement);
    } else if (sender === 'bot' && pendingMessageElement) {
        pendingMessageElement.textContent = message; // 更新最终消息
        pendingMessageElement = null;
        currentBotMessage = '';
    } else {
        messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 清除聊天记录
function clearChat() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
}
