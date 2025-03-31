/**
 * Pagetalk - 侧栏面板脚本
 * 实现标签页切换、聊天功能和设置管理
 */

// API 基础 URL
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// 全局状态管理
const state = {
    apiKey: '',
    model: 'gemini-2.0-flash',
    // 多助手相关配置
    agents: [],
    currentAgentId: null, // 当前选择的助手ID
    // 单个助手属性
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.95,
    autoExtract: true,
    pageContext: '',
    chatHistory: [], // 存储格式: { role: 'user'|'model', parts: Array<{text: string}|{inlineData: {mimeType: string, data: string}}>, id: string }
    isConnected: false,
    // 修改图片相关状态，支持多图片
    images: [], // 存储多个图片对象 { file, mimeType, dataUrl, id }
};

// 默认设置，当存储中没有对应值时使用
const defaultSettings = {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.95,
    autoExtract: true
};

// 默认助手
const defaultAgent = {
    id: 'default',
    name: '默认助手',
    systemPrompt: defaultSettings.systemPrompt,
    temperature: defaultSettings.temperature,
    maxTokens: defaultSettings.maxTokens,
    topP: defaultSettings.topP
};

// DOM元素
const elements = {
    tabs: document.querySelectorAll('.footer-tab'), // 修改为底部导航
    tabContents: document.querySelectorAll('.tab-content'),
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendMessage: document.getElementById('send-message'),
    extractPage: document.getElementById('extract-page'),
    contextStatus: document.getElementById('context-status'),
    connectionIndicator: document.getElementById('connection-indicator'),
    summarizeButton: document.getElementById('summarize-page'),

    // 聊天界面
    chatModelSelection: document.getElementById('chat-model-selection'),
    chatAgentSelection: document.getElementById('chat-agent-selection'),

    // Agent 设置
    agentName: document.getElementById('agent-name'),
    systemPrompt: document.getElementById('system-prompt'),
    temperature: document.getElementById('temperature'),
    temperatureValue: document.getElementById('temperature-value'),
    maxTokens: document.getElementById('max-tokens'),
    topP: document.getElementById('top-p'),
    topPValue: document.getElementById('top-p-value'),
    saveAgentSettings: document.getElementById('save-agent-settings'),
    agentConnectionStatus: document.getElementById('agent-connection-status'),

    // 助手列表
    agentsList: document.getElementById('agents-list'),
    addNewAgent: document.getElementById('add-new-agent'),

    // 删除确认对话框
    deleteConfirmDialog: document.getElementById('delete-confirm-dialog'),
    deleteAgentName: document.getElementById('delete-agent-name'),
    confirmDelete: document.getElementById('confirm-delete'),
    cancelDelete: document.getElementById('cancel-delete'),

    // 模型设置
    apiKey: document.getElementById('api-key'),
    modelSelection: document.getElementById('model-selection'),
    autoExtract: document.getElementById('auto-extract'),
    testConnection: document.getElementById('test-connection'),
    saveModelSettings: document.getElementById('save-model-settings'),
    connectionStatus: document.getElementById('connection-status'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    apiKeyInput: document.getElementById('api-key'),

    // 图片处理元素
    uploadImage: document.getElementById('upload-image'),
    fileInput: document.getElementById('file-input'),
    imagePreviewContainer: document.getElementById('image-preview-container'),
    imagesGrid: document.getElementById('images-grid'),
    imageModal: document.getElementById('image-modal'),
    modalImage: document.getElementById('modal-image'),
    closeModal: document.querySelector('.close-modal')
};

/**
 * 初始化应用
 */
function init() {
    // 加载存储的设置
    loadSettings();

    // 初始化事件监听器
    setupEventListeners();

    // 初始化模型选择列表
    initModelSelection();

    // 加载助手列表
    loadAgentsList();

    // 检查API连接状态
    updateConnectionStatus();

    // 检查是否需要自动提取页面内容
    if (state.autoExtract) {
        extractPageContent();
    }

    // 初始化图片粘贴功能
    setupImagePaste();

    // 设置输入框自适应高度
    setupAutoresizeTextarea();

    // 监听来自content script的消息
    window.addEventListener('message', handleContentScriptMessages);

    // 请求页面内容
    requestPageContent();

    // 添加关闭面板按钮事件
    const closeButton = document.getElementById('close-panel');
    if (closeButton) {
        closeButton.addEventListener('click', closePanel);
    }
}

/**
 * 初始化模型选择列表
 */
function initModelSelection() {
    const modelOptions = [
        { value: 'gemini-2.0-flash', text: 'Gemini 2.0 Flash' },
        { value: 'gemini-2.0-flash-thinking-exp-01-21', text: 'Gemini 2.0 Flash Thinking Exp 01-21' },
        { value: 'gemini-2.0-pro-exp-02-05', text: 'Gemini 2.0 Pro Exp 02-05' },
        { value: 'gemini-exp-1206', text: 'Gemini Exp 1206' },
        { value: 'gemini-2.5-pro-exp-03-25', text: 'Gemini 2.5 Pro Exp 03-25' }
    ];

    // 更新模型设置Tab中的选择器
    elements.modelSelection.innerHTML = ''; // 清空现有选项
    modelOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        elements.modelSelection.appendChild(optionElement);
    });

    // 确保当前选择的模型在列表中
    if (modelOptions.find(option => option.value === state.model)) {
        elements.modelSelection.value = state.model;
    } else {
        // 如果当前选择的模型不在列表中，选择第一个模型
        elements.modelSelection.value = modelOptions[0].value;
        state.model = modelOptions[0].value;
    }

    // 同步更新聊天页面的模型选择器
    if (elements.chatModelSelection) {
        elements.chatModelSelection.innerHTML = '';
        modelOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            elements.chatModelSelection.appendChild(optionElement);
        });
        elements.chatModelSelection.value = state.model;
    }
}

/**
 * 设置所有事件监听器
 */
function setupEventListeners() {
    // 底部标签页切换
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 聊天功能
    elements.sendMessage.addEventListener('click', sendUserMessage);
    elements.userInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendUserMessage();
        }
    });

    if (elements.extractPage) {
        elements.extractPage.addEventListener('click', extractPageContent);
    }

    // 快捷操作按钮
    if (elements.summarizeButton) {
        elements.summarizeButton.addEventListener('click', () => {
            // 在输入框中填入"总结一下"
            elements.userInput.value = "总结一下";
            // 聚焦输入框
            elements.userInput.focus();
            // 自动发送消息
            sendUserMessage();
        });
    }

    // 聊天页面的模型选择事件
    if (elements.chatModelSelection) {
        elements.chatModelSelection.addEventListener('change', () => {
            state.model = elements.chatModelSelection.value;
            // 同步更新模型设置中的选择器
            elements.modelSelection.value = state.model;
            // 保存设置
            saveModelSettings(false);
        });
    }

    // 聊天页面的助手选择事件
    if (elements.chatAgentSelection) {
        elements.chatAgentSelection.addEventListener('change', () => {
            const selectedAgentId = elements.chatAgentSelection.value;
            switchAgent(selectedAgentId);
        });
    }

    // 清除上下文按钮
    document.getElementById('clear-context').addEventListener('click', clearContext);

    // 代理设置
    elements.temperature.addEventListener('input', () => {
        elements.temperatureValue.textContent = elements.temperature.value;
    });
    elements.topP.addEventListener('input', () => {
        elements.topPValue.textContent = elements.topP.value;
    });
    elements.saveAgentSettings.addEventListener('click', saveAgentSettings);

    // 助手列表操作
    if (elements.addNewAgent) {
        elements.addNewAgent.addEventListener('click', createNewAgent);
    }

    // 删除确认对话框操作
    if (elements.cancelDelete) {
        elements.cancelDelete.addEventListener('click', () => {
            elements.deleteConfirmDialog.style.display = 'none';
        });
    }

    if (elements.confirmDelete) {
        elements.confirmDelete.addEventListener('click', confirmDeleteAgent);
    }

    // 点击外部区域关闭删除确认框
    window.addEventListener('click', (e) => {
        if (e.target === elements.deleteConfirmDialog) {
            elements.deleteConfirmDialog.style.display = 'none';
        }
    });

    // 模型设置
    elements.testConnection.addEventListener('click', testApiConnection);
    elements.saveModelSettings.addEventListener('click', () => saveModelSettings(true));
    elements.modelSelection.addEventListener('change', () => {
        state.model = elements.modelSelection.value;
        // 同步更新聊天页面的模型选择器
        if (elements.chatModelSelection) {
            elements.chatModelSelection.value = state.model;
        }
    });

    // 图片上传相关事件
    if (elements.uploadImage) {
        elements.uploadImage.addEventListener('click', () => {
            elements.fileInput.click();
        });
    }

    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', handleImageSelect);
    }

    // 检测关闭模态框的点击
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', hideImageModal);
    }

    // 切换 API Key 可见性
    if (elements.toggleApiKey && elements.apiKeyInput) {
        elements.toggleApiKey.addEventListener('click', () => {
            const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
            elements.apiKeyInput.type = type;
            // 根据类型切换眼睛图标
            elements.toggleApiKey.querySelector('svg').classList.toggle('bi-eye-slash', elements.apiKeyInput.type === 'password');
            elements.toggleApiKey.querySelector('svg').classList.toggle('bi-eye', elements.apiKeyInput.type === 'text');
        });
    }

    // 关闭模态框的点击外部区域
    window.addEventListener('click', (e) => {
        if (e.target === elements.imageModal) {
            hideImageModal();
        }
    });
}

/**
 * 切换标签页
 * @param {string} tabId - 要显示的标签页ID
 */
function switchTab(tabId) {
    // 更新底部导航栏状态
    elements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));

    // 更新内容区域
    elements.tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
}

/**
 * 向聊天区域添加消息 - 使用markdown-it渲染
 * @param {string|null} content - 文本内容，可以为null
 * @param {'user'|'bot'} sender - 发送者
 * @param {boolean} [isStreaming=false] - 是否为流式消息
 * @param {Array<{dataUrl: string, mimeType: string}>} [images=[]] - 图片数组 (用于用户消息预览)
 * @param {HTMLElement|null} [insertAfterElement=null] - 可选，如果提供，则将消息插入此元素之后，否则追加到末尾
 * @returns {HTMLElement} 创建的消息元素
 */
function addMessageToChat(content, sender, isStreaming = false, images = [], insertAfterElement = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);

    // 为每条消息添加唯一ID
    const messageId = generateUniqueId();
    messageElement.dataset.messageId = messageId;

    // 插入或追加消息
    if (insertAfterElement && insertAfterElement.parentNode === elements.chatMessages) {
        insertAfterElement.insertAdjacentElement('afterend', messageElement);
    } else {
        elements.chatMessages.appendChild(messageElement);
    }

    // 滚动到新消息可见
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (isStreaming) {
        // 对于流式消息，只创建容器并返回引用
        return messageElement;
    }

    // --- 非流式消息或最终渲染逻辑 ---

    // 如果是用户消息并且有图片，添加图片预览
    if (sender === 'user' && images.length > 0) {
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'message-images';

        images.forEach((image, index) => {
            const img = document.createElement('img');
            img.className = 'message-image';
            img.src = image.dataUrl;
            img.alt = `上传图片 ${index + 1}`;
            img.dataset.index = index;

            // 点击图片可以查看大图
            img.addEventListener('click', () => {
                showFullSizeImage(image.dataUrl);
            });

            imagesContainer.appendChild(img);
        });

        messageElement.appendChild(imagesContainer);
    }

    // 处理文本内容
    if (content) {
        // 使用我们的Markdown渲染器进行渲染
        const formattedContent = window.MarkdownRenderer.render(content);
        messageElement.innerHTML += formattedContent; // 使用 += 以保留图片容器
    }

    // 为代码块添加复制按钮
    const codeBlocks = messageElement.querySelectorAll('.code-block');
    codeBlocks.forEach(addCopyButtonToCodeBlock);

    // 添加消息操作按钮 (复制、删除、重新生成)
    addMessageActionButtons(messageElement, content || ''); // 确保 content 不为 null

    // 再次滚动确保完全可见
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // 注意：历史记录的添加现在由调用者处理

    return messageElement;
}


/**
 * 复制代码块内容到剪贴板
 * @param {string} code - 代码内容
 * @param {HTMLElement} buttonElement - 复制按钮元素
 */
function copyCodeToClipboard(code, buttonElement) {
  // 通过postMessage请求父窗口执行复制操作
  window.parent.postMessage({
    action: 'copyText',
    text: code
  }, '*');

  // 更新按钮状态
  const originalHTML = buttonElement.innerHTML;
  buttonElement.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
  `;

  setTimeout(() => {
    buttonElement.innerHTML = originalHTML;
  }, 2000);
}

/**
 * 为代码块添加复制按钮
 * @param {HTMLElement} block - 代码块元素 (<pre>)
 */
function addCopyButtonToCodeBlock(block) {
    // 创建复制按钮元素
    const copyButton = document.createElement('button');
    copyButton.classList.add('code-copy-button');
    copyButton.title = "复制代码";

    // 创建SVG元素
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");

    const rectElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectElement.setAttribute("x", "9");
    rectElement.setAttribute("y", "9");
    rectElement.setAttribute("width", "13");
    rectElement.setAttribute("height", "13");
    rectElement.setAttribute("rx", "2");
    rectElement.setAttribute("ry", "2");

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    svg.appendChild(rectElement);
    svg.appendChild(pathElement);
    copyButton.appendChild(svg);

    // 添加点击事件
    copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        // 从data属性获取原始代码
        const encodedCode = block.getAttribute('data-code');
        if (encodedCode) { // Check if data-code exists
            const originalCode = decodeURIComponent(atob(encodedCode));
            copyCodeToClipboard(originalCode, copyButton);
        } else {
            console.warn('Code block missing data-code attribute.');
            // Fallback: try to copy innerText, might not be accurate
            copyCodeToClipboard(block.querySelector('code')?.innerText || '', copyButton);
        }
    });

    block.appendChild(copyButton);
}

/**
 * 复制消息内容到剪贴板
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} originalContent - 原始消息内容 (未经HTML格式化的)
 * @param {HTMLElement} buttonElement - 复制按钮元素
 */
function copyMessageContent(messageElement, originalContent, buttonElement) {
    // 确保换行符被正确处理，保留原始格式
    const formattedContent = originalContent.replace(/\n/g, '\r\n'); // 确保换行符在Windows和Mac上都能正常工作

    // 发送消息给父页面处理复制操作
    window.parent.postMessage({
        action: 'copyText',
        text: formattedContent
    }, '*');

    // 显示成功复制的视觉提示
    const originalSVG = buttonElement.querySelector('svg');
    const newSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    newSVG.setAttribute("viewBox", "0 0 24 24");
    newSVG.setAttribute("width", "14");
    newSVG.setAttribute("height", "14");
    newSVG.setAttribute("fill", "none");
    newSVG.setAttribute("stroke", "#34a853");
    newSVG.setAttribute("stroke-width", "2");

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", "M20 6L9 17l-5-5");
    newSVG.appendChild(pathElement);

    // 保存原始SVG
    const originalSVGCopy = originalSVG.cloneNode(true);

    // 替换SVG
    buttonElement.replaceChild(newSVG, originalSVG);

    // 2秒后恢复原始图标
    setTimeout(() => {
        buttonElement.replaceChild(originalSVGCopy, newSVG);
    }, 2000);
}

/**
 * 更新流式消息 - 使用markdown-it渲染
 */
function updateStreamingMessage(messageElement, content) {
    // 使用markdown-it渲染内容
    let formattedContent = window.MarkdownRenderer.render(content);

    // 添加流式光标
    const streamingCursor = document.createElement('span');
    streamingCursor.className = 'streaming-cursor';

    // 先清空消息元素，但保留操作按钮
    const messageActions = messageElement.querySelector('.message-actions');
    messageElement.innerHTML = formattedContent;
    if (messageActions) {
        messageElement.appendChild(messageActions);
    }
    messageElement.appendChild(streamingCursor);

    // 滚动到新消息可见
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * 完成机器人消息的最终渲染（流结束后调用）
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} finalContent - 最终的完整内容
 */
function finalizeBotMessage(messageElement, finalContent) {
    // 移除流式光标
    const streamingCursor = messageElement.querySelector('.streaming-cursor');
    if (streamingCursor) {
        streamingCursor.remove();
    }

    // 确保最终内容正确渲染 (可能 updateStreamingMessage 已完成大部分)
    messageElement.innerHTML = window.MarkdownRenderer.render(finalContent);

    // 为代码块添加复制按钮
    const codeBlocks = messageElement.querySelectorAll('.code-block');
    codeBlocks.forEach(addCopyButtonToCodeBlock);

    // 添加消息操作按钮 (复制、删除、重新生成)
    addMessageActionButtons(messageElement, finalContent); // 传入原始文本

    // 再次滚动确保完全可见
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * 添加消息操作按钮（复制、删除、重新生成）
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} content - 消息的原始文本内容
 */
function addMessageActionButtons(messageElement, content) {
    const messageId = messageElement.dataset.messageId;
    const sender = messageElement.classList.contains('user-message') ? 'user' : 'bot';

    // 检查是否已存在操作按钮容器，避免重复添加
    if (messageElement.querySelector('.message-actions')) {
        return;
    }

    // 添加消息操作按钮容器
    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';

    // 添加重新生成按钮 (仅对用户消息或模型消息)
    const regenerateButton = document.createElement('button');
    regenerateButton.className = 'message-action-btn regenerate-btn';
    regenerateButton.title = "重新生成";
    regenerateButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
        </svg>
    `;
    regenerateButton.addEventListener('click', (e) => {
        e.stopPropagation();
        regenerateMessage(messageId);
    });
    messageActions.appendChild(regenerateButton);


    // 添加删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'message-action-btn delete-btn';
    deleteButton.title = "删除消息";
    deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
    `;
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMessage(messageId);
    });
    messageActions.appendChild(deleteButton);


    // 只给机器人消息添加复制按钮
    if (sender === 'bot') {
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button'); // 使用与 addMessageToChat 中相同的类名
        copyButton.title = "复制全部";
        copyButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            copyMessageContent(messageElement, content, copyButton);
        });
        // 将复制按钮添加到操作容器的最前面
        messageActions.insertBefore(copyButton, messageActions.firstChild);
    }

    // 将操作容器添加到消息元素
    messageElement.appendChild(messageActions);
}


/**
 * 发送用户消息并获取AI响应
 */
async function sendUserMessage() {
    const userMessage = elements.userInput.value.trim();

    if (!userMessage && state.images.length === 0) return;

    // 检查API密钥
    if (!state.apiKey) {
        showConnectionStatus('请先在"模型"选项卡中设置API密钥', 'error');
        switchTab('model');
        return;
    }

    // 复制当前图片数组，避免后续操作影响
    const currentImages = [...state.images];

    // 添加用户消息到聊天（包含图片）
    const userMessageElement = addMessageToChat(userMessage, 'user', false, currentImages);
    const userMessageId = userMessageElement.dataset.messageId; // 获取刚创建的消息ID

    elements.userInput.value = '';
    resizeTextarea(); // 手动触发高度重新计算

    // 显示AI思考动画
    const thinkingElement = addThinkingAnimation();

    try {
        // 构建当前用户消息的 parts 数组
        const currentParts = [];
        if (userMessage) {
            currentParts.push({ text: userMessage });
        }
        if (currentImages.length > 0) {
            for (const image of currentImages) {
                const base64data = image.dataUrl.split(',')[1];
                currentParts.push({
                    inlineData: {
                        mimeType: image.mimeType,
                        data: base64data
                    }
                });
            }
        }

        // 将包含完整 parts 的用户消息添加到历史
        if (currentParts.length > 0) {
             state.chatHistory.push({
                 role: 'user',
                 parts: currentParts,
                 id: userMessageId // 使用从 addMessageToChat 获取的 ID
             });
        } else {
             // 如果没有文本也没有图片，则不发送也不添加到历史
             if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
             if (userMessageElement && userMessageElement.parentNode) userMessageElement.remove();
             return;
        }

        // 调用流式 Gemini API（带图片），并传入思考动画元素
        await callGeminiAPIWithImages(userMessage, currentImages, thinkingElement);

    } catch (error) {
        if (thinkingElement && thinkingElement.parentNode) {
             thinkingElement.remove();
        }
        console.error('Error caught in sendUserMessage:', error);
    }
}

/**
 * 添加AI思考动画到聊天区域，支持插入到特定元素之后
 * @param {HTMLElement|null} [insertAfterElement=null] - 如果提供，则将动画插入此元素之后，否则追加到末尾
 * @returns {HTMLElement} 创建的思考动画元素
 */
function addThinkingAnimation(insertAfterElement = null) {
    const thinkingElement = document.createElement('div');
    thinkingElement.classList.add('message', 'bot-message', 'thinking');

    const thinkingDots = document.createElement('div');
    thinkingDots.classList.add('thinking-dots');
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        thinkingDots.appendChild(dot);
    }
    thinkingElement.appendChild(thinkingDots);

    // 插入或追加
    if (insertAfterElement && insertAfterElement.parentNode === elements.chatMessages) {
        insertAfterElement.insertAdjacentElement('afterend', thinkingElement);
    } else {
        elements.chatMessages.appendChild(thinkingElement);
    }

    // 滚动到可见
    thinkingElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

    return thinkingElement;
}

/**
 * 核心 API 调用逻辑，支持插入或追加响应
 * @param {string} userMessage - 用户消息内容
 * @param {Array<{dataUrl: string, mimeType: string}>} images - 图片数组
 * @param {HTMLElement} thinkingElement - 思考动画元素
 * @param {Array|null} historyForApi - 用于 API 调用的历史记录 (null 表示使用全局历史)
 * @param {boolean} insertResponse - true: 插入响应, false: 追加响应
 * @param {number|null} [targetInsertionIndex=null] - 如果 insertResponse 为 true，则指定插入到 state.chatHistory 的索引
 * @param {HTMLElement|null} [insertAfterElement=null] - 如果 insertResponse 为 true，则指定插入到此 DOM 元素之后
 * @returns {Promise<void>}
 */
async function callGeminiAPIInternal(userMessage, images = [], thinkingElement, historyForApi, insertResponse = false, targetInsertionIndex = null, insertAfterElement = null) {
    let accumulatedText = '';
    let messageElement = null;
    let currentModel = state.model;
    let botMessageId = null;

    try {
        console.log(`使用模型 ${currentModel} 处理请求 (Insert: ${insertResponse})`);

        // 使用提供的历史记录 (historyForApi) 或默认历史记录 (state.chatHistory)
        const historyToSend = historyForApi ? [...historyForApi] : [...state.chatHistory]; // 修正：使用正确的参数名

        // 构建请求体
        const requestBody = {
            contents: [],
            generationConfig: {
                temperature: parseFloat(state.temperature),
                maxOutputTokens: parseInt(state.maxTokens),
                topP: parseFloat(state.topP)
            }
        };

        // --- 构建 contents 的逻辑 ---
        let systemContent = state.systemPrompt;
        if (state.pageContext) {
            systemContent += `\n\n以下是网页的内容，请根据这些内容回答用户问题：\n\n${state.pageContext}`;
        }
        if (systemContent) {
            requestBody.contents.push({ role: 'user', parts: [{ text: systemContent }] });
            requestBody.contents.push({ role: 'model', parts: [{ text: "OK." }] });
        }
        // 使用准备好的 historyToSend 进行迭代
        historyToSend.forEach(msg => { // 修正：使用 historyToSend
            if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
                 requestBody.contents.push({ role: msg.role, parts: msg.parts });
            } else {
                 console.warn("Skipping history message due to missing, invalid, or empty parts:", msg);
            }
        });
        const currentParts = [];
        if (userMessage) currentParts.push({ text: userMessage });
        if (images.length > 0) {
            for (const image of images) {
                const base64data = image.dataUrl.split(',')[1];
                currentParts.push({ inlineData: { mimeType: image.mimeType, data: base64data } });
            }
        }
        if (currentParts.length > 0) {
             requestBody.contents.push({ role: 'user', parts: currentParts });
        } else if (requestBody.contents.length === 0) {
             console.warn("Attempting to send an empty message with no history.");
             if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
             addMessageToChat("无法发送空消息。", 'bot'); // 添加到末尾
             return;
        }
        // --- 结束构建 contents 的逻辑 ---

        const endpoint = `${API_BASE_URL}/models/${currentModel}:streamGenerateContent?key=${state.apiKey}&alt=sse`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: '无法解析错误响应' } }));
            // 检查是否是图片不支持的错误
            if (images.length > 0 && errorData.error?.message?.includes('does not support image input')) {
                 // 直接抛出特定错误信息，让外层 catch 处理 UI 显示
                 throw new Error(`模型 ${currentModel} 不支持图片输入`);
            }
            // 其他错误，抛出通用错误
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        // 处理 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonString = line.substring(6).trim();
                    if (jsonString) {
                        try {
                            const chunkData = JSON.parse(jsonString);
                            const textChunk = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (textChunk !== undefined && textChunk !== null) {
                                if (thinkingElement && thinkingElement.parentNode) {
                                    thinkingElement.remove();
                                }
                                if (!messageElement) {
                                    // 创建流式消息元素，插入或追加
                                    messageElement = addMessageToChat(null, 'bot', true, [], insertResponse ? insertAfterElement : null);
                                    botMessageId = messageElement.dataset.messageId;
                                }
                                accumulatedText += textChunk;
                                updateStreamingMessage(messageElement, accumulatedText);
                            }
                        } catch (e) { console.error('Failed to parse JSON chunk:', jsonString, e); }
                    }
                }
            }
        }
        // 处理可能剩余的 buffer
        if (buffer.startsWith('data: ')) {
             const jsonString = buffer.substring(6).trim();
             if (jsonString) {
                 try {
                     const chunkData = JSON.parse(jsonString);
                     const textChunk = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                     if (textChunk !== undefined && textChunk !== null) {
                         if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
                         if (!messageElement) {
                             messageElement = addMessageToChat(null, 'bot', true, [], insertResponse ? insertAfterElement : null);
                             botMessageId = messageElement.dataset.messageId;
                         }
                         accumulatedText += textChunk;
                         updateStreamingMessage(messageElement, accumulatedText);
                     }
                 } catch (e) { console.error('Failed to parse final JSON chunk:', jsonString, e); }
             }
        }

        // 流结束
        if (messageElement) {
            finalizeBotMessage(messageElement, accumulatedText);
            const newAiResponseObject = {
                role: 'model',
                parts: [{ text: accumulatedText }],
                id: botMessageId
            };
            if (insertResponse && targetInsertionIndex !== null) {
                // 插入到历史记录的指定位置
                state.chatHistory.splice(targetInsertionIndex, 0, newAiResponseObject);
            } else {
                // 追加到历史记录末尾
                state.chatHistory.push(newAiResponseObject);
            }
        } else if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
            addMessageToChat("未能生成回复。", 'bot', false, [], insertResponse ? insertAfterElement : null); // 插入或追加错误消息
        }

        // 清除图片（仅在初始发送时）
        if (state.images.length > 0 && thinkingElement && historyForApi === null) { // 检查 historyForApi 是否为 null 来判断是否初始发送
             clearImages();
        }

    } catch (error) {
        console.error('API 调用失败:', error);
        if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
        }
        if (messageElement) {
            const errorText = `\n\n--- 获取响应时出错: ${error.message} ---`;
            accumulatedText += errorText;
            finalizeBotMessage(messageElement, accumulatedText);
        } else {
            addMessageToChat(`获取响应时出错: ${error.message}`, 'bot', false, [], insertResponse ? insertAfterElement : null); // 插入或追加错误消息
        }
    }
}

/**
 * 用于发送新消息 (追加)
 */
async function callGeminiAPIWithImages(userMessage, images = [], thinkingElement) {
    await callGeminiAPIInternal(userMessage, images, thinkingElement, null, false); // insertResponse = false, historyForApi = null
}

/**
 * 用于重新生成时插入响应
 */
async function callApiAndInsertResponse(userMessage, images = [], thinkingElement, historyForApi, targetInsertionIndex, insertAfterElement) {
    await callGeminiAPIInternal(userMessage, images, thinkingElement, historyForApi, true, targetInsertionIndex, insertAfterElement); // insertResponse = true
}


/**
 * 提取当前页面内容
 */
async function extractPageContent() {
    try {
        // 更新状态指示器
        elements.contextStatus.textContent = '上下文: 正在提取...';

        // 向content script发送消息，请求提取页面内容
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "extractContent"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        elements.contextStatus.textContent = '上下文: 提取失败';
                        return;
                    }

                    if (response && response.content) {
                        // 获取到页面内容
                        const content = response.content;

                        // 更新状态
                        state.pageContext = content;
                        elements.contextStatus.textContent = `上下文: ${content.length} 字符`;

                        // 显示成功消息
                        showConnectionStatus('成功提取页面内容', 'success');
                    } else {
                        elements.contextStatus.textContent = '上下文: 提取失败';
                    }
                });
            } else {
                elements.contextStatus.textContent = '上下文: 没有活动标签页';
            }
        });
    } catch (error) {
        console.error('提取页面内容时出错:', error);
        elements.contextStatus.textContent = '上下文: 提取失败';
    }
}

/**
 * 测试API连接
 */
async function testApiConnection() {
    const apiKey = elements.apiKey.value.trim();
    const model = elements.modelSelection.value;

    if (!apiKey) {
        showConnectionStatus('请输入API密钥', 'error');
        return;
    }

    elements.testConnection.disabled = true;
    elements.testConnection.textContent = 'Testing...';

    try {
        // 构建简单的测试请求
        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: '你好' }]
                }
            ]
        };

        // 发送请求
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        // 检查响应
        if (response.ok) {
            showConnectionStatus('Connection established ! API Key verified.', 'success');
            state.isConnected = true;
        } else {
            const error = await response.json();
            showConnectionStatus(`Connection failed: ${error.error?.message || '未知错误'}`, 'error');
            state.isConnected = false;
        }
    } catch (error) {
        showConnectionStatus(`Connection failed: ${error.message}`, 'error');
        state.isConnected = false;
    } finally {
        elements.testConnection.disabled = false;
        elements.testConnection.textContent = 'Test Connection';
        updateConnectionStatus();
    }
}

/**
 * 显示连接状态消息
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('success' 或 'error')
 */
function showConnectionStatus(message, type) {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = 'connection-status ' + type;

    // 显示消息
    elements.connectionStatus.style.display = 'block';

    // 3秒后隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            elements.connectionStatus.style.display = 'none';
        }, 3000);
    }
}

/**
 * 更新连接状态指示器
 */
function updateConnectionStatus() {
    elements.connectionIndicator.className = state.isConnected ? 'connected' : 'disconnected';
    elements.connectionIndicator.textContent = state.isConnected ? 'Connected' : 'Disconnected';
}

/**
 * 保存 Agent 设置
 */
function saveAgentSettings() {
    state.systemPrompt = elements.systemPrompt.value;
    state.temperature = elements.temperature.value;
    state.maxTokens = elements.maxTokens.value;
    state.topP = elements.topP.value;

    // 保存到存储
    chrome.storage.sync.set({
        systemPrompt: state.systemPrompt,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        topP: state.topP
    }, () => {
        // 在 Agent 页面显示保存成功消息，而不是模型设置页面
        showAgentStatusMessage('Saved', 'success');
    });
}

/**
 * 在 Agent 页面显示状态消息
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('success' 或 'error')
 */
function showAgentStatusMessage(message, type) {
    const agentStatus = document.getElementById('agent-connection-status');
    if (agentStatus) {
        agentStatus.textContent = message;
        agentStatus.className = 'connection-status ' + type;

        // 显示消息
        agentStatus.style.display = 'block';

        // 3秒后隐藏成功消息
        if (type === 'success') {
            setTimeout(() => {
                agentStatus.style.display = 'none';
            }, 3000);
        }
    }
}

/**
 * 保存模型设置
 * @param {boolean} showMessage - 是否显示保存成功的消息
 */
function saveModelSettings(showMessage = true) {
    // 如果从模型设置页面保存，则从页面元素获取值
    if (showMessage) {
        state.apiKey = elements.apiKey.value;
        state.model = elements.modelSelection.value;
        state.autoExtract = elements.autoExtract.checked;
    }

    // 保存到存储
    chrome.storage.sync.set({
        apiKey: state.apiKey,
        model: state.model,
        autoExtract: state.autoExtract
    }, () => {
        if (showMessage) {
			// 立即显示消息，无需等待3秒
            elements.connectionStatus.style.display = 'block';
            showConnectionStatus('Saved', 'success');
        }
        updateConnectionStatus();

        // 如果开启了自动提取，并且当前没有页面上下文，则尝试提取
        if (state.autoExtract && !state.pageContext) {
            extractPageContent();
        }
    });
}

/**
 * 从存储中加载设置
 */
function loadSettings() {
    chrome.storage.sync.get([
        'apiKey',
        'model',
        'systemPrompt',
        'temperature',
        'maxTokens',
        'topP',
        'autoExtract',
        ],
        (result) => {
            // 更新状态
            if (result.apiKey) state.apiKey = result.apiKey;
            if (result.model) state.model = result.model;
            // 修改系统提示词的处理逻辑，确保正确处理undefined和空字符串的情况
            state.systemPrompt = result.systemPrompt !== undefined ? result.systemPrompt : defaultSettings.systemPrompt;
            if (result.temperature) state.temperature = result.temperature;
            if (result.maxTokens) state.maxTokens = result.maxTokens;
            if (result.topP) state.topP = result.topP;
            if (result.autoExtract !== undefined)
                state.autoExtract = result.autoExtract;

            // 更新UI元素
            elements.apiKey.value = state.apiKey;
            elements.modelSelection.value = state.model;
            if (elements.chatModelSelection) {
                elements.chatModelSelection.value = state.model;
            }
            elements.systemPrompt.value = state.systemPrompt;
            elements.temperature.value = state.temperature;
            elements.temperatureValue.textContent = state.temperature;
            elements.maxTokens.value = state.maxTokens;
            elements.topP.value = state.topP;
            elements.topPValue.textContent = state.topP;
            elements.autoExtract.checked = state.autoExtract;

            // 检查API连接状态
            if (state.apiKey) {
                state.isConnected = true;
                updateConnectionStatus();
            }
        }
    );
}

/**
 * 清除上下文和聊天历史
 */
function clearContext() {
    // 清空聊天历史
    state.chatHistory = [];

    // 清除聊天消息显示
    elements.chatMessages.innerHTML = '';

    // 重新添加欢迎消息 - 使用DOM API
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'welcome-message';

    const welcomeTitle = document.createElement('h2');
    welcomeTitle.textContent = '欢迎使用 Pagetalk!';
    welcomeMessage.appendChild(welcomeTitle);

    // 添加快捷操作
    const quickActions = document.createElement('div');
    quickActions.className = 'quick-actions';

    const summarizeBtn = document.createElement('button');
    summarizeBtn.id = 'summarize-page';
    summarizeBtn.className = 'quick-action-btn';
    summarizeBtn.textContent = '总结一下';
    summarizeBtn.addEventListener('click', () => {
        elements.userInput.value = "总结一下";
        elements.userInput.focus();
        sendUserMessage();
    });

    quickActions.appendChild(summarizeBtn);
    welcomeMessage.appendChild(quickActions);

    elements.chatMessages.appendChild(welcomeMessage);

    // 清除上传的图片
    clearImages();

    // 显示清除成功的消息
    showConnectionStatus('聊天记录和上下文已清除', 'success');
}

/**
 * 设置图片粘贴功能
 */
function setupImagePaste() {
    // 监听粘贴事件
    elements.userInput.addEventListener('paste', async (e) => {
        // 检查剪贴板中是否有图片
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;

        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                // 阻止默认粘贴行为
                e.preventDefault();

                // 获取图片文件
                const blob = item.getAsFile();

                // 处理图片
                handleImageFile(blob);

                // 移除粘贴高亮效果，避免改变圆角样式
                elements.userInput.classList.add('paste-highlight');
                setTimeout(() => {
                    elements.userInput.classList.remove('paste-highlight');
                }, 500);

                break;
            }
        }
    });
}

/**
 * 处理图片文件选择
 * @param {Event} e - 文件选择事件
 */
function handleImageSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file && file.type.startsWith('image/')) {
                handleImageFile(file);
            }
        }
    }
    // 重置文件输入，以便于再次选择同一文件
    elements.fileInput.value = '';
}

/**
 * 处理图片文件
 * @param {File} file - 图片文件
 */
function handleImageFile(file) {
    if (!file) return;

    // 读取文件并显示预览
    const reader = new FileReader();

    reader.onload = (e) => {
        const imageData = {
            file: file,
            mimeType: file.type,
            dataUrl: e.target.result,
            id: generateUniqueId()
        };

        // 添加到图片数组
        state.images.push(imageData);

        // 更新预览区
        updateImagesPreview();
    };

    reader.readAsDataURL(file);
}

/**
 * 更新图片预览区域
 */
function updateImagesPreview() {
    // 先清空预览区
    elements.imagesGrid.innerHTML = '';

    // 如果没有图片，隐藏预览容器
    if (state.images.length === 0) {
        elements.imagePreviewContainer.style.display = 'none';
        elements.userInput.parentElement.classList.remove('has-image');
        return;
    }

    // 有图片时显示预览容器
    elements.imagePreviewContainer.style.display = 'block';
    elements.userInput.parentElement.classList.add('has-image');

    // 为每个图片创建预览
    state.images.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.id = image.id;

        // 创建图片元素
        const img = document.createElement('img');
        img.src = image.dataUrl;
        img.alt = `图片 ${index + 1}`;

        // 图片点击预览
        img.addEventListener('click', () => {
            showFullSizeImage(image.dataUrl);
        });

        // 创建操作按钮容器
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'image-actions';

        // 查看原图按钮
        const viewBtn = document.createElement('button');
        viewBtn.className = 'image-action-button';
        viewBtn.title = '查看原图';
        viewBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
            </svg>
        `;
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showFullSizeImage(image.dataUrl);
        });

        // 删除图片按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'image-action-button';
        deleteBtn.title = '删除图片';
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImageById(image.id);
        });

        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(deleteBtn);

        // 组装元素
        imageItem.appendChild(img);
        imageItem.appendChild(actionsDiv);

        // 添加到预览区
        elements.imagesGrid.appendChild(imageItem);
    });
}

/**
 * 通过ID删除图片
 * @param {string} imageId - 要删除的图片ID
 */
function removeImageById(imageId) {
    // 从数组中移除图片
    state.images = state.images.filter(img => img.id !== imageId);

    // 更新预览区
    updateImagesPreview();
}

/**
 * 清除所有图片
 */
function clearImages() {
    state.images = [];
    updateImagesPreview();
}

/**
 * 显示图片的大图预览
 * @param {string} imageUrl - 图片URL
 */
function showFullSizeImage(imageUrl) {
    elements.modalImage.src = imageUrl;
    elements.imageModal.style.display = 'block';
}

/**
 * 隐藏图片预览模态框
 */
function hideImageModal() {
    elements.imageModal.style.display = 'none';
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 加载助手列表
 */
function loadAgentsList() {
    // 从存储中获取助手列表
    chrome.storage.sync.get(['agents', 'currentAgentId'], (result) => {
        // 如果存储中有助手列表，则使用存储中的
        if (result.agents && Array.isArray(result.agents) && result.agents.length > 0) {
            state.agents = result.agents;
        } else {
            // 否则使用默认助手创建一个新列表
            state.agents = [defaultAgent];
        }

        // 设置当前选中的助手
        if (result.currentAgentId && state.agents.find(a => a.id === result.currentAgentId)) {
            state.currentAgentId = result.currentAgentId;
        } else {
            // 默认选择第一个助手
            state.currentAgentId = state.agents[0].id;
        }

        // 更新界面
        updateAgentsList();
        loadCurrentAgentSettings();
        updateAgentSelectionInChat();
    });
}

/**
 * 更新助手列表UI
 */
function updateAgentsList() {
    if (!elements.agentsList) return;

    // 清空列表
    elements.agentsList.innerHTML = '';

    // 检查是否有助手
    if (!state.agents || state.agents.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = '<p>暂无助手，点击添加按钮创建</p>';
        elements.agentsList.appendChild(emptyState);
        return;
    }

    // 添加每个助手项
    state.agents.forEach(agent => {
        const agentItem = document.createElement('div');
        agentItem.className = 'agent-item';
        agentItem.dataset.id = agent.id;
        if (agent.id === state.currentAgentId) {
            agentItem.classList.add('active');
        }

        // 助手名称
        const nameSpan = document.createElement('span');
        nameSpan.className = 'agent-item-name';
        nameSpan.textContent = agent.name;

        // 操作按钮组
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'agent-item-actions';

        // 删除按钮 - 使用更明显的垃圾桶图标
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = '删除';
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteConfirmDialog(agent.id);
        });

        actionsDiv.appendChild(deleteBtn);

        // 点击整个助手项切换到该助手
        agentItem.addEventListener('click', () => {
            editAgent(agent.id);
        });

        agentItem.appendChild(nameSpan);
        agentItem.appendChild(actionsDiv);
        elements.agentsList.appendChild(agentItem);
    });
}

/**
 * 加载并显示当前选中助手的设置
 */
function loadCurrentAgentSettings() {
    // 找到当前选中的助手
    const agent = state.agents.find(a => a.id === state.currentAgentId) || defaultAgent;

    // 更新状态
    state.systemPrompt = agent.systemPrompt;
    state.temperature = agent.temperature;
    state.maxTokens = agent.maxTokens;
    state.topP = agent.topP;

    // 更新界面
    if (elements.agentName) {
        elements.agentName.value = agent.name;
    }
    elements.systemPrompt.value = agent.systemPrompt;
    elements.temperature.value = agent.temperature;
    elements.temperatureValue.textContent = agent.temperature;
    elements.maxTokens.value = agent.maxTokens;
    elements.topP.value = agent.topP;
    elements.topPValue.textContent = agent.topP;
}

/**
 * 创建新助手
 */
function createNewAgent() {
    // 创建新助手
    const newAgent = {
        id: generateUniqueId(),
        name: `助手 ${state.agents.length + 1}`,
        systemPrompt: defaultSettings.systemPrompt,
        temperature: defaultSettings.temperature,
        maxTokens: defaultSettings.maxTokens,
        topP: defaultSettings.topP
    };

    // 添加到列表
    state.agents.push(newAgent);

    // 选择新助手
    state.currentAgentId = newAgent.id;

    // 更新界面
    updateAgentsList();
    loadCurrentAgentSettings();
    updateAgentSelectionInChat();

    // 提示用户
    showToast('新助手已创建', 'success');

    // 保存到存储
    saveAgentsList();
}

/**
 * 编辑助手
 * @param {string} agentId - 要编辑的助手ID
 */
function editAgent(agentId) {
    // 设置当前选中的助手
    state.currentAgentId = agentId;

    // 更新界面
    updateAgentsList();
    loadCurrentAgentSettings();
    updateAgentSelectionInChat();

    // 保存到存储
    saveCurrentAgentId();
}

/**
 * 保存当前助手设置
 */
function saveAgentSettings() {
    // 获取当前编辑的助手
    const agent = state.agents.find(a => a.id === state.currentAgentId);
    if (!agent) return;

    // 更新助手信息
    agent.name = elements.agentName.value || '未命名助手';
    agent.systemPrompt = elements.systemPrompt.value;
    agent.temperature = elements.temperature.value;
    agent.maxTokens = elements.maxTokens.value;
    agent.topP = elements.topP.value;

    // 更新状态
    state.systemPrompt = agent.systemPrompt;
    state.temperature = agent.temperature;
    state.maxTokens = agent.maxTokens;
    state.topP = agent.topP;

    // 更新界面
    updateAgentsList();
    updateAgentSelectionInChat();

    // 保存到存储
    saveAgentsList();

    // 显示成功消息
    showAgentStatusMessage('Saved', 'success');
}

/**
 * 显示删除确认对话框
 * @param {string} agentId - 要删除的助手ID
 */
function showDeleteConfirmDialog(agentId) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;

    // 设置要删除的助手信息
    elements.deleteAgentName.textContent = agent.name;
    elements.deleteConfirmDialog.dataset.agentId = agentId;

    // 显示对话框
    elements.deleteConfirmDialog.style.display = 'flex';
}

/**
 * 确认删除助手
 */
function confirmDeleteAgent() {
    const agentId = elements.deleteConfirmDialog.dataset.agentId;
    if (!agentId) return;

    // 检查是否是最后一个助手，不能删除最后一个
    if (state.agents.length <= 1) {
        showToast('至少保留一个助手', 'error');
        elements.deleteConfirmDialog.style.display = 'none';
        return;
    }

    // 从列表中移除
    state.agents = state.agents.filter(a => a.id !== agentId);

    // 如果删除的是当前选中的助手，则切换到第一个助手
    if (state.currentAgentId === agentId) {
        state.currentAgentId = state.agents[0].id;
        loadCurrentAgentSettings();
    }

    // 更新界面
    updateAgentsList();
    updateAgentSelectionInChat();

    // 隐藏对话框
    elements.deleteConfirmDialog.style.display = 'none';

    // 提示用户
    showToast('助手已删除', 'success');

    // 保存到存储
    saveAgentsList();
}

/**
 * 切换当前使用的助手
 * @param {string} agentId - 要切换到的助手ID
 */
function switchAgent(agentId) {
    // 检查是否存在这个助手
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;

    // 更新当前选中的助手
    state.currentAgentId = agentId;

    // 更新状态
    state.systemPrompt = agent.systemPrompt;
    state.temperature = agent.temperature;
    state.maxTokens = agent.maxTokens;
    state.topP = agent.topP;

    // 保存当前选中的助手ID
    saveCurrentAgentId();

    // 显示提示
    showToast(`已切换到助手: ${agent.name}`, 'success');
}

/**
 * 更新聊天界面中的助手选择器
 */
function updateAgentSelectionInChat() {
    if (!elements.chatAgentSelection) return;

    // 清空选择器
    elements.chatAgentSelection.innerHTML = '';

    // 添加所有助手选项
    state.agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        elements.chatAgentSelection.appendChild(option);
    });

    // 设置当前选中的助手
    elements.chatAgentSelection.value = state.currentAgentId;
}

/**
 * 保存助手列表到存储
 */
function saveAgentsList() {
    chrome.storage.sync.set({
        agents: state.agents,
        currentAgentId: state.currentAgentId
    });
}

/**
 * 保存当前选中的助手ID
 */
function saveCurrentAgentId() {
    chrome.storage.sync.set({
        currentAgentId: state.currentAgentId
    });
}

/**
 * 显示通知提示
 * @param {string} message - 消息内容
 * @param {string} type - 提示类型 ('success' 或 'error')
 */
function showToast(message, type) {
    // 检查是否已存在toast元素，如果没有则创建一个
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    // 设置消息和类型
    toast.textContent = message;
    toast.className = `toast ${type}`;

    // 显示toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 2秒后隐藏
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

/**
 * 处理来自content script的消息
 */
function handleContentScriptMessages(event) {
    const message = event.data;

    if (message.action === 'pageContentExtracted') {
        // 更新状态
        state.pageContext = message.content;

        if (elements.contextStatus) {
            elements.contextStatus.textContent = `上下文: ${message.content.length} 字符`;
        }

        // 显示成功消息
        showConnectionStatus('成功提取页面内容', 'success');

        // 如果设置了自动提取，继续处理
        if (state.autoExtract) {
            console.log('已自动提取页面内容');
        }
    }
    else if (message.action === 'pageContentLoaded') {
        // 面板加载完成，请求页面内容
        requestPageContent();
    }
    else if (message.action === 'copySuccess') {
        // 可以在这里显示一个短暂的成功提示，如果需要的话
        // showToast('已复制到剪贴板', 'success');
        console.log('复制成功');
    }
    // 新增：处理面板显示事件
    else if (message.action === 'panelShown') {
        // 确保在面板显示时立即调整文本框大小
        resizeTextarea();
    }
    // 新增：处理面板调整大小事件 (从 content.js 转发)
    else if (message.action === 'panelResized') {
        // 面板宽度变化时也可能需要调整textarea大小
        resizeTextarea();
        console.log('Panel resized event received in sidepanel');
    }
}

/**
 * 请求页面内容
 */
function requestPageContent() {
    // 通知父窗口提取页面内容
    window.parent.postMessage({
        action: 'requestPageContent'
    }, '*');

    if (elements.contextStatus) {
        elements.contextStatus.textContent = '上下文: 正在提取...';
    }
}

// 添加关闭面板功能
document.addEventListener('keydown', (e) => {
    // 按ESC键关闭面板
    if (e.key === 'Escape') {
        closePanel();
    }
});

// 关闭面板
function closePanel() {
    window.parent.postMessage({
        action: 'closePanel'
    }, '*');
}

/**
 * 根据内容调整文本框高度
 */
function resizeTextarea() {
    const textarea = elements.userInput;
    if (!textarea) return;

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto';

    // 计算新高度，限制在 min-height 和 max-height 之间
    const minHeight = 36;
    const maxHeight = 160;
    const scrollHeight = textarea.scrollHeight;

    let newHeight = Math.max(minHeight, scrollHeight);
    newHeight = Math.min(newHeight, maxHeight);

    textarea.style.height = newHeight + 'px';
}

/**
 * 设置输入框自适应高度的事件监听
 */
function setupAutoresizeTextarea() {
    const textarea = elements.userInput;
    if (!textarea) return;

    // 监听输入事件
    textarea.addEventListener('input', resizeTextarea);

    // 初始调整一次高度
    setTimeout(resizeTextarea, 0);
}

/**
 * 删除消息及其后续消息 (根据用户反馈调整，现在只删除目标轮次)
 * @param {string} messageId - 要删除的消息ID
 */
function deleteMessage(messageId) {
    // 查找要删除的消息在历史记录中的索引
    const messageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const currentMessage = state.chatHistory[messageIndex];
    let userIndex = -1;
    let aiIndex = -1;

    if (currentMessage.role === 'user') {
        userIndex = messageIndex;
        // 查找紧随其后的 AI 消息
        if (messageIndex + 1 < state.chatHistory.length && state.chatHistory[messageIndex + 1].role === 'model') {
            aiIndex = messageIndex + 1;
        }
    } else if (currentMessage.role === 'model') {
        aiIndex = messageIndex;
        // 查找之前的用户消息
        let prevIndex = messageIndex - 1;
        while (prevIndex >= 0 && state.chatHistory[prevIndex].role !== 'user') {
            prevIndex--;
        }
        if (prevIndex >= 0) {
            userIndex = prevIndex;
        }
    }

    // 如果找到了用户消息，则删除这一轮
    if (userIndex !== -1) {
        // 删除用户消息的 DOM
        const userElement = document.querySelector(`.message[data-message-id="${state.chatHistory[userIndex].id}"]`);
        if (userElement) userElement.remove();

        // 删除 AI 消息的 DOM (如果存在)
        if (aiIndex !== -1) {
            const aiElement = document.querySelector(`.message[data-message-id="${state.chatHistory[aiIndex].id}"]`);
            if (aiElement) aiElement.remove();
            // 从历史记录中删除 AI 和 User (注意顺序，先删后面的)
            state.chatHistory.splice(aiIndex, 1);
            state.chatHistory.splice(userIndex, 1);
        } else {
            // 只删除用户消息 (如果后面没有 AI 回复)
            state.chatHistory.splice(userIndex, 1);
        }
    } else if (aiIndex !== -1) {
        // 如果只找到了 AI 消息（理论上不应发生，但作为保险），只删除 AI 消息
        const aiElement = document.querySelector(`.message[data-message-id="${state.chatHistory[aiIndex].id}"]`);
        if (aiElement) aiElement.remove();
        state.chatHistory.splice(aiIndex, 1);
    }

    // saveChatHistory(); // 如果需要保存
}


/**
 * 从历史消息对象中提取文本和图片信息
 * @param {object} message - 来自 state.chatHistory 的消息对象
 * @returns {{text: string, images: Array<{dataUrl: string, mimeType: string}>}}
 */
function extractPartsFromMessage(message) {
    let text = '';
    const images = [];
    if (message && message.parts && Array.isArray(message.parts)) {
        message.parts.forEach(part => {
            if (part.text) {
                text += part.text; // 合并所有文本部分
            } else if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
                // 将 base64 数据转换回 dataUrl 格式，以便 API 调用函数使用
                images.push({
                    dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    mimeType: part.inlineData.mimeType
                });
            }
        });
    }
    return { text, images };
}


/**
 * 重新生成消息 - 新逻辑：只替换当前轮次的 AI 回复
 * @param {string} messageId - 要重新生成的消息ID (可以是用户或AI的ID)
 */
async function regenerateMessage(messageId) {
    // 1. 识别目标“轮”
    const clickedMessageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    if (clickedMessageIndex === -1) {
        console.error("Regenerate failed: Message not found in history.");
        return;
    }

    const clickedMessage = state.chatHistory[clickedMessageIndex];
    let userIndex = -1;
    let aiIndex = -1;
    let userMessageElement = null;

    if (clickedMessage.role === 'user') {
        userIndex = clickedMessageIndex;
        userMessageElement = document.querySelector(`.message[data-message-id="${clickedMessage.id}"]`);
        // 查找紧随其后的 AI 消息
        if (userIndex + 1 < state.chatHistory.length && state.chatHistory[userIndex + 1].role === 'model') {
            aiIndex = userIndex + 1;
        }
    } else if (clickedMessage.role === 'model') {
        aiIndex = clickedMessageIndex;
        // 查找之前的用户消息
        let prevIndex = clickedMessageIndex - 1;
        while (prevIndex >= 0 && state.chatHistory[prevIndex].role !== 'user') {
            prevIndex--;
        }
        if (prevIndex >= 0) {
            userIndex = prevIndex;
            userMessageElement = document.querySelector(`.message[data-message-id="${state.chatHistory[userIndex].id}"]`);
        }
    }

    // 如果找不到对应的用户消息，则无法继续
    if (userIndex === -1 || !userMessageElement) {
        console.error("Regenerate failed: Could not find the corresponding user message for this turn.");
        return;
    }

    // 2. 提取用户输入
    const userMessageData = state.chatHistory[userIndex];
    const { text: userMessageText, images: userImages } = extractPartsFromMessage(userMessageData);

    // 3. 准备 API 历史 (截至用户消息之前)
    const historyForApi = state.chatHistory.slice(0, userIndex + 1); // 包含当前用户消息

    // 4. 移除旧 AI 回复 (如果存在)
    let oldAiMessageId = null;
    if (aiIndex !== -1) {
        oldAiMessageId = state.chatHistory[aiIndex].id;
        const oldAiElement = document.querySelector(`.message[data-message-id="${oldAiMessageId}"]`);
        if (oldAiElement) {
            oldAiElement.remove();
        }
        state.chatHistory.splice(aiIndex, 1); // 从历史记录中移除
        console.log(`Removed old AI response at index ${aiIndex}`);
    }

    // 5. 调用 API 并插入新回复
    // 显示思考动画，插入到用户消息之后
    const thinkingElement = addThinkingAnimation(userMessageElement); // 传递参考元素

    try {
        // 调用 API 并将结果插入到 userIndex + 1 的位置
        await callApiAndInsertResponse(
            userMessageText,
            userImages,
            thinkingElement,
            historyForApi,
            userIndex + 1, // 目标插入索引
            userMessageElement // 插入到此元素之后
        );
    } catch (error) {
        console.error(`Regenerate (turn starting at user index ${userIndex}) failed:`, error);
        if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
        }
        // 可以在用户消息后插入错误提示
        addMessageToChat(`重新生成响应时出错: ${error.message}`, 'bot', false, [], userMessageElement);
    }
}

/**
 * 添加AI思考动画到聊天区域，支持插入到特定元素之后
 * @param {HTMLElement|null} [insertAfterElement=null] - 如果提供，则将动画插入此元素之后，否则追加到末尾
 * @returns {HTMLElement} 创建的思考动画元素
 */
function addThinkingAnimation(insertAfterElement = null) {
    const thinkingElement = document.createElement('div');
    thinkingElement.classList.add('message', 'bot-message', 'thinking');

    const thinkingDots = document.createElement('div');
    thinkingDots.classList.add('thinking-dots');
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        thinkingDots.appendChild(dot);
    }
    thinkingElement.appendChild(thinkingDots);

    // 插入或追加
    if (insertAfterElement && insertAfterElement.parentNode === elements.chatMessages) {
        insertAfterElement.insertAdjacentElement('afterend', thinkingElement);
    } else {
        elements.chatMessages.appendChild(thinkingElement);
    }

    // 滚动到可见
    thinkingElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

    return thinkingElement;
}


/**
 * 调用Gemini API，允许自定义历史上下文
 * @param {string} userMessage - 用户消息内容
 * @param {Array} customHistory - 可选的自定义历史上下文
 * @returns {Promise<string>} AI的响应
 */

// 初始化应用
document.addEventListener('DOMContentLoaded', init);
