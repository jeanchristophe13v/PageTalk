/**
 * Pagetalk - 侧栏面板脚本
 * 实现标签页切换、聊天功能和设置管理
 */

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
    chatHistory: [],
    isConnected: false,
    // 修改图片相关状态，支持多图片
    images: [], // 存储多个图片对象
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
    
    // 监听来自content script的消息
    window.addEventListener('message', handleContentScriptMessages);
    
    // 请求页面内容
    requestPageContent();
    
    // 添加关闭面板按钮事件
    const closeButton = document.getElementById('close-panel');
    if (closeButton) {
        closeButton.addEventListener('click', closePanel);
    }
    
    // 请求页面内容
    setTimeout(requestPageContent, 500);
}

/**
 * 初始化模型选择列表
 */
function initModelSelection() {
    const modelOptions = [
        { value: 'gemini-2.0-flash', text: 'Gemini 2.0 Flash' },
        { value: 'gemini-2.0-flash-thinking-exp-01-21', text: 'Gemini 2.0 Flash Thinking Exp 01-21' },
        { value: 'gemini-2.0-pro-exp-02-05', text: 'Gemini 2.0 Pro Exp 02-05' },
        { value: 'gemini-exp-1206', text: 'Gemini Exp 1206' }
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
 * 向聊天区域添加消息 - 优化的 Markdown 渲染
 */
function addMessageToChat(content, sender, isStreaming = false, images = []) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    
    if (isStreaming) {
        // 对于流式消息，先创建一个空的容器
        elements.chatMessages.appendChild(messageElement);
        return messageElement;
    }
    
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
    
    // 预处理内容，规范化换行符并清理不必要的空白字符
    content = content.replace(/\r\n/g, '\n'); // 统一换行符为 \n
    content = content.replace(/^[\s\uFEFF\xA0]+/gm, ''); // 删除行首空白
    content = content.replace(/[ \t]+$/gm, ''); // 删除行尾空白
    
    // 处理连续三个以上的换行符，避免过多空白
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // 使用更先进的 Markdown 解析方法
    const formattedContent = renderMarkdown(content);
    
    // 添加到消息元素
    messageElement.innerHTML += formattedContent;
    
    // 为代码块添加复制按钮 - 使用DOM API而不是innerHTML
    const codeBlocks = messageElement.querySelectorAll('.code-block');
    codeBlocks.forEach(block => {
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
            const originalCode = decodeURIComponent(atob(encodedCode));
            copyCodeToClipboard(originalCode, copyButton);
        });
        
        block.appendChild(copyButton);
    });
    
    // 只给机器人消息添加复制按钮
    if (sender === 'bot') {
        // 创建复制按钮 - 使用DOM API
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = "复制全部";
        
        // 创建SVG元素
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        
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
            e.stopPropagation(); // 防止事件冒泡
            copyMessageContent(messageElement, content, copyButton);
        });
        
        messageElement.appendChild(copyButton);
    }
    
    elements.chatMessages.appendChild(messageElement);
    
    // 滚动到底部
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    // 添加到聊天历史
    if (!isStreaming) {
        state.chatHistory.push({
            role: sender === 'user' ? 'user' : 'model',
            content: content
        });
    }
    
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
 * 更新流式消息 - 使用优化的 Markdown 渲染
 */
function updateStreamingMessage(messageElement, content) {
    // 预处理内容，规范化换行符并清理不必要的空白字符
    content = content.replace(/\r\n/g, '\n'); // 统一换行符为 \n
    content = content.replace(/^[\s\uFEFF\xA0]+/gm, ''); // 删除行首空白
    content = content.replace(/[ \t]+$/gm, ''); // 删除行尾空白
    
    // 处理连续三个以上的换行符，避免过多空白
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // 使用更先进的 Markdown 解析方法
    let formattedContent = renderMarkdown(content);
    
    // 添加流式光标
    const streamingCursor = document.createElement('span');
    streamingCursor.className = 'streaming-cursor';
    
    // 先清空消息元素
    messageElement.innerHTML = formattedContent;
    messageElement.appendChild(streamingCursor);
    
    // 为代码块添加复制按钮
    const codeBlocks = messageElement.querySelectorAll('.code-block');
    codeBlocks.forEach(block => {
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
        
        // 添加点击事件处理
        copyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const encodedCode = block.getAttribute('data-code');
            const originalCode = decodeURIComponent(atob(encodedCode));
            copyCodeToClipboard(originalCode, copyButton);
        });
        
        block.appendChild(copyButton);
    });
    
    // 滚动到底部
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * 优化的 Markdown 渲染函数
 * @param {string} content - 原始 Markdown 内容
 * @returns {string} 渲染后的 HTML
 */
function renderMarkdown(content) {
    // 第一步：预处理特殊情况
    // 将连续的 Markdown 列表块识别并保护起来，避免段落处理干扰
    let processedContent = content;
    
    // 识别并临时替换代码块，避免其内部内容被处理
    const codeBlocks = [];
    processedContent = processedContent.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(match, lang, code) {
        const id = codeBlocks.length;
        codeBlocks.push({lang, code});
        return `__CODE_BLOCK_${id}__`;
    });
    
    // 识别内联代码并保护
    const inlineCodes = [];
    processedContent = processedContent.replace(/`([^`]+)`/g, function(match, code) {
        const id = inlineCodes.length;
        inlineCodes.push(code);
        return `__INLINE_CODE_${id}__`;
    });
    
    // 识别并标记表格，确保表格前后有换行
    const tables = [];
    processedContent = processedContent.replace(/^\|(.+)\|\r?\n\|([-:| ]+)\|\r?\n(\|(?:.+)\|\r?\n?)+/gm, function(match) {
        const id = tables.length;
        tables.push(match);
        return `\n\n__TABLE_${id}__\n\n`;
    });
    
    // 识别并标记列表区块，确保列表前后有换行
    const listBlocks = [];
    processedContent = processedContent.replace(/((?:(?:^|\n)(?:\s*[-*+]|\s*\d+\.) [^\n]+)+)/g, function(match) {
        const id = listBlocks.length;
        listBlocks.push(match);
        return `\n\n__LIST_BLOCK_${id}__\n\n`;
    });
    
    // 第二步：处理常规 Markdown 元素
    let html = processedContent
        // 处理标题，确保标题前后有换行
        .replace(/^### (.*$)/gim, '\n\n<h3>$1</h3>\n\n')
        .replace(/^## (.*$)/gim, '\n\n<h2>$1</h2>\n\n')
        .replace(/^# (.*$)/gim, '\n\n<h1>$1</h1>\n\n')
        .replace(/^#### (.*$)/gim, '\n\n<h4>$1</h4>\n\n')
        
        // 处理分隔线
        .replace(/^\-\-\-$/gim, '\n\n<hr>\n\n')
        
        // 处理粗体和斜体 - 在常规内容中应用
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 第三步：处理段落分隔
    // 将连续的两个或更多换行符识别为段落分隔
    html = html.replace(/\n\n+/g, '</p><p>');
    
    // 优化单个换行符处理 - 保留列表、表格等特殊元素中的换行
    // 只替换不在特殊标记前面的换行符
    html = html.replace(/\n(?!(?:__TABLE_|__LIST_BLOCK_|__CODE_BLOCK_|<\/p><p>))/g, '<br>');
    
    // 第四步：还原特殊元素
    // 还原表格
    tables.forEach((tableContent, id) => {
        // 将表格拆分为行
        const rows = tableContent.trim().split(/\r?\n/);
        let tableHtml = '<table class="markdown-table">';
        
        // 处理表头和内容
        rows.forEach((row, rowIndex) => {
            const cells = row.split('|').filter((cell, i, arr) => i > 0 && i < arr.length - 1).map(cell => cell.trim());
            
            if (rowIndex === 0) {
                tableHtml += '<thead><tr>';
                cells.forEach(cell => { 
                    // 处理表头单元格中的行内Markdown格式
                    const formattedCell = processInlineMarkdown(cell);
                    tableHtml += `<th>${formattedCell}</th>`; 
                });
                tableHtml += '</tr></thead><tbody>';
            } else if (rowIndex !== 1) { // 跳过分隔行
                tableHtml += '<tr>';
                cells.forEach(cell => { 
                    // 处理表格内容单元格中的行内Markdown格式
                    const formattedCell = processInlineMarkdown(cell);
                    tableHtml += `<td>${formattedCell}</td>`; 
                });
                tableHtml += '</tr>';
            }
        });
        
        tableHtml += '</tbody></table>';
        
        // 替换表格占位符，确保表格前后有适当的空间
        html = html.replace(`__TABLE_${id}__`, tableHtml);
    });
    
    // 还原内联代码
    inlineCodes.forEach((code, id) => {
        html = html.replace(`__INLINE_CODE_${id}__`, `<code class="inline-code">${escapeHtml(code)}</code>`);
    });
    
    // 还原代码块
    codeBlocks.forEach((block, id) => {
        const escapedCode = escapeHtml(block.code)
            .replace(/\n/g, '<br>');
        
        html = html.replace(
            `__CODE_BLOCK_${id}__`, 
            `<pre class="code-block${block.lang ? ' language-' + block.lang : ' language-plaintext'}" data-code="${btoa(encodeURIComponent(block.code))}"><code>${escapedCode}</code></pre>`
        );
    });
    
    // 第五步：还原并处理列表块
    listBlocks.forEach((block, id) => {
        html = html.replace(`__LIST_BLOCK_${id}__`, processListBlock(block));
    });
    
    // 第六步：修复剩余的结构问题
    // 清理嵌套段落标签问题
    html = html
        .replace(/<\/p><p><\/p><p>/g, '</p><p>')
        .replace(/<p><\/p>/g, '')
        .replace(/<br><\/p>/g, '</p>')  // 移除段落末尾的<br>
        .replace(/<p><br>/g, '<p>');    // 移除段落开头的<br>
    
    // 确保内容在段落内
    if (!html.startsWith('<p>')) {
        html = '<p>' + html;
    }
    if (!html.endsWith('</p>')) {
        html = html + '</p>';
    }
    
    return html;
}

/**
 * 处理列表块
 * @param {string} block - Markdown 列表块
 * @returns {string} 渲染成 HTML 的列表
 */
function processListBlock(block) {
    // 按行拆分
    const lines = block.split('\n');
    
    // 跟踪列表状态
    let html = '';
    let inList = false;
    let listType = '';
    let listLevel = 0;
    const listStack = [];
    
    // 处理每一行
    lines.forEach(line => {
        if (!line.trim()) return;
        
        // 检测列表类型和缩进
        const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
        const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
        
        if (unorderedMatch || orderedMatch) {
            const match = unorderedMatch || orderedMatch;
            const indent = match[1].length;
            let content = match[2];
            const type = unorderedMatch ? 'ul' : 'ol';
            
            // 处理列表项内容中的Markdown格式
            content = processInlineMarkdown(content);
            
            // 计算缩进级别 (每2个空格视为一级缩进)
            const level = Math.floor(indent / 2);
            
            // 处理列表嵌套
            if (!inList) {
                // 开始新列表
                html += `<${type}>`;
                listStack.push({type, level});
                inList = true;
            } else if (level > listLevel) {
                // 增加嵌套级别
                html += `<${type}>`;
                listStack.push({type, level});
            } else if (level < listLevel) {
                // 减少嵌套级别
                while (listStack.length > 0 && listStack[listStack.length - 1].level > level) {
                    const item = listStack.pop();
                    html += `</${item.type}>`;
                }
                
                // 如果当前级别的列表类型不同，关闭旧的并开始新的
                if (listStack.length > 0 && listStack[listStack.length - 1].type !== type) {
                    const item = listStack.pop();
                    html += `</${item.type}><${type}>`;
                    listStack.push({type, level});
                }
            } else if (listStack[listStack.length - 1].type !== type) {
                // 同级别但类型不同
                const item = listStack.pop();
                html += `</${item.type}><${type}>`;
                listStack.push({type, level});
            }
            
            // 更新当前列表级别
            listLevel = level;
            
            // 添加列表项
            html += `<li>${content}</li>`;
        }
    });
    
    // 关闭所有打开的列表
    while (listStack.length > 0) {
        const item = listStack.pop();
        html += `</${item.type}>`;
    }
    
    return html;
}

/**
 * 处理行内Markdown格式
 * @param {string} text - 需要处理的文本
 * @returns {string} 处理后的HTML
 */
function processInlineMarkdown(text) {
    // 检查是否包含有序列表项（以数字. 开头）- 将有序列表检查移到前面优先处理
    if (text.match(/^\s*\d+\.\s+/m)) {
        // 处理简单的有序列表
        const listItems = text.split(/\n/).map(line => {
            // 处理列表项 - 修改正则表达式以匹配行首的空格
            if (line.match(/^\s*\d+\.\s+/)) {
                // 移除列表标记和任何行首空格，并处理剩余内容中的行内格式
                const itemContent = line.replace(/^\s*\d+\.\s+/, '');
                return `<li>${processInlineTextFormatting(itemContent)}</li>`;
            }
            return line;
        }).filter(item => item.trim() !== '').join(''); // 过滤掉空行
        
        return `<ol>${listItems}</ol>`;
    }
    
    // 检查是否包含无序列表项（以- 或* 开头）
    if (text.match(/^\s*[-*]\s+/m)) {
        // 处理简单的无序列表
        const listItems = text.split(/\n/).map(line => {
            // 处理列表项 - 修改正则表达式以匹配行首的空格
            if (line.match(/^\s*[-*]\s+/)) {
                // 移除列表标记和任何行首空格，并处理剩余内容中的行内格式
                const itemContent = line.replace(/^\s*[-*]\s+/, '');
                return `<li>${processInlineTextFormatting(itemContent)}</li>`;
            }
            return line;
        }).filter(item => item.trim() !== '').join(''); // 过滤掉空行
        
        return `<ul>${listItems}</ul>`;
    }
    
    // 如果不是列表，使用标准的行内格式处理
    return processInlineTextFormatting(text);
}

/**
 * 只处理行内文本格式（粗体、斜体、代码），不处理列表
 * @param {string} text - 需要处理的文本
 * @returns {string} 处理后的HTML
 */
function processInlineTextFormatting(text) {
    return text
        // 处理粗体
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 处理斜体
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 处理内联代码
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
    addMessageToChat(userMessage, 'user', false, currentImages);
    elements.userInput.value = '';
    
    // 显示AI思考动画
    const thinkingElement = addThinkingAnimation();
    
    try {
        // 准备用户消息
        const userMessageObj = {
            role: 'user',
            content: userMessage
        };
        
        // 将用户消息添加到历史（不含图片，只记录文本）
        state.chatHistory.push(userMessageObj);
        
        // 调用Gemini API（带图片）
        const response = await callGeminiAPIWithImages(userMessage, currentImages);
        
        // 移除思考动画
        thinkingElement.remove();
        
        // 添加AI响应到聊天
        if (response) {
            addMessageToChat(response, 'bot');
            
            // 将AI回复添加到历史（只在UI上显示，不会发送到API）
            state.chatHistory.push({
                role: 'model',
                content: response
            });
            
            // 发送完成后清除图片
            if (state.images.length > 0) {
                clearImages();
            }
        } else {
            throw new Error('未能获取有效响应');
        }
    } catch (error) {
        // 移除思考动画
        thinkingElement.remove();
        
        // 显示错误消息
        addMessageToChat(`获取响应时出错: ${error.message}`, 'bot');
        console.error('API调用错误:', error);
    }
}

/**
 * 添加AI思考动画到聊天区域
 * @returns {HTMLElement} 创建的思考动画元素
 */
function addThinkingAnimation() {
    const thinkingElement = document.createElement('div');
    thinkingElement.classList.add('message', 'bot-message', 'thinking');
    
    const thinkingDots = document.createElement('div');
    thinkingDots.classList.add('thinking-dots');
    
    // 创建三个点
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        thinkingDots.appendChild(dot);
    }
    
    thinkingElement.appendChild(thinkingDots);
    elements.chatMessages.appendChild(thinkingElement);
    
    // 滚动到底部
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    return thinkingElement;
}

/**
 * 调用Gemini API
 * @param {string} userMessage - 用户消息内容
 * @returns {Promise<string>} AI的响应
 */
async function callGeminiAPI(userMessage) {
    try {
        // 组合系统提示和页面上下文
        let systemContent = state.systemPrompt;
        if (state.pageContext) {
            systemContent += `\n\n以下是网页的内容，请根据这些内容回答用户问题：\n\n${state.pageContext}`;
        }
        
        // 构建消息历史，最多保留最近5轮对话
        const recentHistory = state.chatHistory.slice(-20); // 保留最近5轮（10条消息，每轮2条）
        
        // 构建请求体
        const requestBody = {
            contents: [
                // 首条消息包含系统提示
                {
                    role: 'user',
                    parts: [{ text: systemContent }]
                }
            ],
            generationConfig: {
                temperature: parseFloat(state.temperature),
                maxOutputTokens: parseInt(state.maxTokens),
                topP: parseFloat(state.topP)
            }
        };

        // 添加历史对话
        recentHistory.forEach(msg => {
            requestBody.contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });

        // 添加当前用户消息
        requestBody.contents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        // API 基础 URL
        const apiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        const endpoint = `${apiBaseUrl}/models/${state.model}:generateContent?key=${state.apiKey}`;

        // 发送请求
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // 解析响应
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || '未知错误');
        }

        return data.candidates[0]?.content?.parts[0]?.text || '';
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

/**
 * 调用 Gemini API 的流式输出版本
 * @param {string} userMessage - 用户消息内容
 * @param {HTMLElement} messageElement - 用于显示流式输出的元素
 * @returns {Promise<void>}
 */
async function callGeminiAPIStream(userMessage, messageElement) {
    try {
        // 组合系统提示和页面上下文成一个单一的系统消息
        let systemContent = state.systemPrompt;
        if (state.pageContext) {
            systemContent += `\n\n以下是网页的内容，请根据这些内容回答用户问题：\n\n${state.pageContext}`;
        }
        
        // 构建符合 Gemini API 要求的请求体
        const requestBody = {
            contents: [
                // 将系统提示和用户消息合并到 user 角色的消息中
                {
                    role: 'user',
                    parts: [{ text: systemContent + '\n\n' + userMessage }]
                }
            ],
            generationConfig: {
                temperature: parseFloat(state.temperature),
                maxOutputTokens: parseInt(state.maxTokens),
                topP: parseFloat(state.topP)
            }
        };

        // API 基础 URL

        // 确定 API 端点
        const endpoint = `${apiBaseUrl}/models/${state.model}:generateContent?key=${state.apiKey}`;

        // 发送请求
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // 解析响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullResponse = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            updateStreamingMessage(messageElement, fullResponse);
        }

        if (!response.ok) {
            throw new Error(data.error?.message || '未知错误');
        }

        // 流结束后，移除闪烁光标
        const cursor = messageElement.querySelector('.streaming-cursor');
        if(cursor) cursor.remove();
        
        // 流完成后添加复制按钮
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = "复制全部";
        
        // 创建SVG元素
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        
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
            copyMessageContent(messageElement, fullResponse, copyButton);
        });
        
        messageElement.appendChild(copyButton);
        
        // 将完整响应添加到聊天历史
        state.chatHistory.push({
            role: 'model',
            content: fullResponse
        });
        
        return fullResponse;
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

/**
 * 调用Gemini API（带多图片支持）
 * @param {string} userMessage - 用户消息内容
 * @param {Array} images - 图片数组，包含dataUrl和mimeType
 * @returns {Promise<string>} AI的响应
 */
async function callGeminiAPIWithImages(userMessage, images = []) {
    try {
        console.log(`使用模型 ${state.model} 处理带图片的请求`);
        
        // 检查当前模型是否支持图像输入
        const supportedModels = [
            'gemini-2.0-pro',
            'gemini-2.0-flash',
            'gemini-2.0-flash-thinking-exp-01-21',
            'gemini-2.0-pro-exp-02-05',
            'gemini-exp-1206'
        ];

        // 构建消息历史，最多保留最近5轮对话
        const recentHistory = state.chatHistory.slice(-10); // 保留最近5轮（10条消息）
        
        // 组合系统提示和页面上下文
        let systemContent = state.systemPrompt;
        if (state.pageContext) {
            systemContent += `\n\n以下是网页的内容，请根据这些内容回答用户问题：\n\n${state.pageContext}`;
        }
        
        // 如果当前模型不在支持列表，给出警告并尝试切换到gemini-2.0-flash
        if (!supportedModels.includes(state.model) && images.length > 0) {
            console.warn(`当前模型 ${state.model} 可能不支持图像输入，尝试使用gemini-2.0-flash`);
            showToast("当前模型可能不支持图像输入，已临时切换到gemini-2.0-flash模型", "warning");
            
            const tempModel = 'gemini-2.0-flash';
            
            // 构建请求体
            const requestBody = {
                contents: [],
                generationConfig: {
                    temperature: parseFloat(state.temperature),
                    maxOutputTokens: parseInt(state.maxTokens),
                    topP: parseFloat(state.topP)
                }
            };

            // 添加系统提示作为第一条消息
            requestBody.contents.push({
                role: 'user',
                parts: [{ text: systemContent }]
            });

            // 添加历史对话
            recentHistory.forEach(msg => {
                requestBody.contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            });

            // 创建当前消息的parts
            const currentParts = [];
            
            // 添加用户文本消息
            if (userMessage) {
                currentParts.push({ text: userMessage });
            }
            
            // 添加图片
            if (images.length > 0) {
                for (const image of images) {
                    const base64data = image.dataUrl.split(',')[1];
                    currentParts.push({
                        inlineData: {
                            mimeType: image.mimeType,
                            data: base64data
                        }
                    });
                }
            }
            
            // 添加当前用户消息
            requestBody.contents.push({
                role: 'user',
                parts: currentParts
            });

            // 使用临时模型发送请求
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${tempModel}:generateContent?key=${state.apiKey}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || '未知错误');
            }

            return data.candidates[0]?.content?.parts[0]?.text || '';
        }

        // 原始处理逻辑（当前模型支持图片输入的情况）
        const requestBody = {
            contents: [],
            generationConfig: {
                temperature: parseFloat(state.temperature),
                maxOutputTokens: parseInt(state.maxTokens),
                topP: parseFloat(state.topP)
            }
        };

        // 添加系统提示作为第一条消息
        requestBody.contents.push({
            role: 'user',
            parts: [{ text: systemContent }]
        });

        // 添加历史对话
        recentHistory.forEach(msg => {
            requestBody.contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });

        // 创建当前消息的parts
        const currentParts = [];
        
        // 添加用户文本消息
        if (userMessage) {
            currentParts.push({ text: userMessage });
        }
        
        // 添加图片
        if (images.length > 0) {
            for (const image of images) {
                const base64data = image.dataUrl.split(',')[1];
                currentParts.push({
                    inlineData: {
                        mimeType: image.mimeType,
                        data: base64data
                    }
                });
            }
        }
        
        // 添加当前用户消息
        requestBody.contents.push({
            role: 'user',
            parts: currentParts
        });

        // API 基础 URL和端点
        const apiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        const endpoint = `${apiBaseUrl}/models/${state.model}:generateContent?key=${state.apiKey}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();
            if (!response.ok) {
                if (images.length > 0 && data.error?.message?.includes('not supported')) {
                    console.warn(`模型 ${state.model} 不支持图像输入，尝试使用gemini-2.0-flash`);
                    showToast("当前模型不支持图像输入，已临时切换到gemini-2.0-flash模型", "warning");
                    
                    state.model = 'gemini-2.0-flash';
                    if (elements.chatModelSelection) {
                        elements.chatModelSelection.value = state.model;
                    }
                    if (elements.modelSelection) {
                        elements.modelSelection.value = state.model;
                    }
                    return await callGeminiAPIWithImages(userMessage, images);
                }
                throw new Error(data.error?.message || '未知错误');
            }

            return data.candidates[0]?.content?.parts[0]?.text || '';
        } catch (error) {
            if (images.length > 0) {
                console.warn(`使用模型 ${state.model} 处理图片请求时出错: ${error.message}，尝试使用备用模型`);
                
                const backupModel = 'gemini-2.0-flash';
                const prevModel = state.model;
                state.model = backupModel;
                
                if (elements.chatModelSelection) {
                    elements.chatModelSelection.value = state.model;
                }
                if (elements.modelSelection) {
                    elements.modelSelection.value = state.model;
                }
                
                showToast(`模型切换至 ${backupModel} 以支持图片处理`, "warning");
                
                try {
                    const result = await callGeminiAPIWithImages(userMessage, images);
                    return result;
                } catch (secondError) {
                    state.model = prevModel;
                    if (elements.chatModelSelection) {
                        elements.chatModelSelection.value = state.model;
                    }
                    if (elements.modelSelection) {
                        elements.modelSelection.value = state.model;
                    }
                    throw secondError;
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
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
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
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
        console.log('复制成功');
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

// 初始化应用
document.addEventListener('DOMContentLoaded', init);
