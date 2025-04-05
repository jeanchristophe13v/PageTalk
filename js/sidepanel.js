/**
 * Pagetalk - 侧栏面板脚本
 * 实现标签页切换、聊天功能和设置管理
 */

// API 基础 URL (Moved to js/api.js)
// const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// 全局状态管理
const state = {
    apiKey: '',
    model: 'gemini-2.0-flash',
    // 多助手相关配置
    agents: [],
    currentAgentId: null, // 当前选择的助手ID
    // 单个助手属性 (这些会根据当前助手动态更新)
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 65536,
    topP: 0.95,
    pageContext: '',
    chatHistory: [], // 存储格式: { role: 'user'|'model', parts: Array<{text: string}|{inlineData: {mimeType: string, data: string}}>, id: string }
    isConnected: false,
    // 修改图片相关状态，支持多图片
    images: [], // 存储多个图片对象 { file, mimeType, dataUrl, id }
    // 移除 pageContentExtractedMessageShown，逻辑移至 content.js
    darkMode: false, // 新增：深色模式状态
    language: 'zh-CN', // 新增：语言状态，默认为中文
};

// 翻译相关
let currentTranslations = {}; // 存储当前语言的翻译
let currentPanzoomInstance = null; // 存储当前 Mermaid 模态框的 Panzoom 实例
let mermaidWheelListener = null; // 存储 wheel 事件监听器的引用

// Mermaid related variables removed
let isUserNearBottom = true; // 新增：跟踪用户是否滚动到底部附近
const SCROLL_THRESHOLD = 20; // 新增：滚动到底部的阈值（像素）
// 默认设置，当存储中没有对应值时使用
const defaultSettings = {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 65536, // 更新默认 maxTokens
    topP: 0.95,
};

// 默认助手
const defaultAgent = {
    id: 'default',
    name: '默认助手', // This will be translated when added to state if needed
    systemPrompt: defaultSettings.systemPrompt,
    temperature: defaultSettings.temperature,
    maxTokens: defaultSettings.maxTokens, // 确保使用更新后的默认值
    topP: defaultSettings.topP
};

// DOM元素
const elements = {
    // --- 主导航 ---
    tabs: document.querySelectorAll('.footer-tab'), // 底部主标签页
    tabContents: document.querySelectorAll('.tab-content'), // 主内容区域

    // --- 聊天界面 ---
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendMessage: document.getElementById('send-message'),
    summarizeButton: document.getElementById('summarize-page'),
    chatModelSelection: document.getElementById('chat-model-selection'),
    chatAgentSelection: document.getElementById('chat-agent-selection'),
    clearContextBtn: document.getElementById('clear-context'),
    closePanelBtnChat: document.getElementById('close-panel'), // 聊天页关闭按钮
    uploadImage: document.getElementById('upload-image'),
    fileInput: document.getElementById('file-input'),
    imagePreviewContainer: document.getElementById('image-preview-container'),
    imagesGrid: document.getElementById('images-grid'),
    imageModal: document.getElementById('image-modal'),
    modalImage: document.getElementById('modal-image'),
    closeModal: document.querySelector('.close-modal'),
    // 新增：Mermaid 模态框元素
    mermaidModal: document.getElementById('mermaid-modal'),
    mermaidModalContent: document.getElementById('mermaid-modal-content'),
    mermaidCloseModal: document.querySelector('.mermaid-close-modal'),
    chatStatusMessage: document.getElementById('chat-status-message'),

    // --- 设置界面 (主容器和导航) ---
    settingsSection: document.getElementById('settings'),
    settingsNavBtns: document.querySelectorAll('.settings-nav-btn'),
    settingsSubContents: document.querySelectorAll('.settings-sub-content'),
    closePanelBtnSettings: document.getElementById('close-panel-settings'), // 设置页关闭按钮

    // --- 设置 - 通用 ---
    languageSelect: document.getElementById('language-select'),
    themeToggleBtnSettings: document.getElementById('theme-toggle-btn'), // 设置内的切换按钮
    moonIconSettings: document.getElementById('moon-icon'), // 设置内的月亮图标
    sunIconSettings: document.getElementById('sun-icon'),   // 设置内的太阳图标
    exportFormatSelect: document.getElementById('export-format'),
    exportChatHistoryBtn: document.getElementById('export-chat-history'),

    // --- 设置 - Agent ---
    agentsList: document.getElementById('agents-list'), // 列表容器 (ID未变)
    addNewAgent: document.getElementById('add-new-agent'), // 添加按钮 (ID未变)
    deleteConfirmDialog: document.getElementById('delete-confirm-dialog'), // 删除确认 (ID未变)
    deleteAgentName: document.getElementById('delete-agent-name'), // (ID未变)
    confirmDelete: document.getElementById('confirm-delete'), // (ID未变)
    cancelDelete: document.getElementById('cancel-delete'), // (ID未变)
    // 新增：导入/导出按钮和文件输入
    importAgentsBtn: document.getElementById('import-agents'),
    exportAgentsBtn: document.getElementById('export-agents'),
    importAgentInput: document.getElementById('import-agent-input'),
    // 注意: Agent的具体设置输入框现在是动态生成的，通过父元素查找

    // --- 设置 - 模型 ---
    apiKey: document.getElementById('api-key'), // (ID未变)
    modelSelection: document.getElementById('model-selection'), // (ID未变)
    saveModelSettings: document.getElementById('save-model-settings'), // (ID未变)
    connectionStatus: document.getElementById('connection-status'), // (ID未变)
    toggleApiKey: document.getElementById('toggle-api-key'), // (ID未变)
    apiKeyInput: document.getElementById('api-key'), // 重复，但保留以防万一

    // --- 页脚状态栏 ---
    contextStatus: document.getElementById('context-status'),
    connectionIndicator: document.getElementById('connection-indicator'),

    // --- 移除旧的全局主题按钮引用 ---
    // themeToggleBtn: document.getElementById('global-theme-toggle-btn'),
    // moonIcon: document.getElementById('global-moon-icon'),
    // sunIcon: document.getElementById('global-sun-icon'),
};

// --- 翻译辅助函数 ---
/**
 * 获取翻译后的字符串
 * @param {string} key - 翻译键
 * @param {object} [replacements={}] - 可选的占位符替换对象
 * @returns {string} 翻译后的字符串，或原始键（如果找不到翻译）
 */
function _(key, replacements = {}) {
  let translation = currentTranslations[key] || key; // Fallback to key if not found

  for (const placeholder in replacements) {
    translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
  }
  return translation;
}

// --- 初始化与核心逻辑 ---

/**
 * 初始化应用
 */
function init() {
    // 移除 pageContentExtractedMessageShown 重置
    // 加载存储的设置 (包括主题和语言)
    // loadSettings 会异步加载并应用翻译
    loadSettings();
    // loadButtonPosition(); // 移除：不再需要加载按钮位置
    loadButtonPosition(); // 加载按钮位置
    if (elements.themeToggleBtnSettings) { // 确保按钮存在
        makeDraggable(elements.themeToggleBtnSettings); // 为主题按钮启用拖动
    }

    // 初始化事件监听器 (将在 setupEventListeners 中更新)
    setupEventListeners();

    // 初始化模型选择列表
    initModelSelection();

    // 加载助手列表
    loadAgentsList();

    // 检查API连接状态
    updateConnectionStatus();

    // 插件初始化时总是请求页面内容
    // requestPageContent(); // 已在 init 末尾调用

    // 初始化图片粘贴功能
    setupImagePaste();

    // 设置输入框自适应高度
    setupAutoresizeTextarea();

    // 监听来自 content script 和 sandbox iframe 的消息
    window.addEventListener('message', handleContentScriptMessages); // Corrected function name

    // 请求页面内容
    requestPageContent();

    // 添加关闭面板按钮事件 (聊天和设置页面)
    if (elements.closePanelBtnChat) {
        elements.closePanelBtnChat.addEventListener('click', closePanel);
    }
    if (elements.closePanelBtnSettings) {
        elements.closePanelBtnSettings.addEventListener('click', closePanel);
    }

    // Mermaid sandbox creation removed

    // 移除旧的 Agent/Model 关闭按钮事件

    // 移除全局主题按钮拖动和可见性逻辑
    // if (elements.themeToggleBtn) { ... }
    // setToggleButtonVisibility(initialTab);

    // Mermaid initialization moved to loadSettings callback
}

/**
 * 初始化模型选择列表
 */
function initModelSelection() {
    const modelOptions = [
        { value: 'gemini-2.0-flash', text: 'gemini-2.0-flash' },
        { value: 'gemini-2.0-flash-thinking-exp-01-21', text: 'gemini-2.0-flash-thinking-exp-01-21' },
        { value: 'gemini-2.0-pro-exp-02-05', text: 'gemini-2.0-pro-exp-02-05' },
        { value: 'gemini-exp-1206', text: 'gemini-exp-1206' },
        { value: 'gemini-2.5-pro-exp-03-25', text: 'gemini-2.5-pro-exp-03-25' },
        { value: 'gemini-2.5-pro-preview-03-25', text: 'gemini-2.5-pro-preview-03-25' }
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
    // 底部主标签页切换
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 设置内部导航标签页切换
    elements.settingsNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchSettingsSubTab(btn.dataset.subtab));
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
            // 在输入框中填入翻译后的"总结一下"
            elements.userInput.value = _('summarizeAction');
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
            saveModelSettings(false); // 传入 false，不在聊天页切换模型时显示提示
        });
    }

    // 聊天页面的助手选择事件
    if (elements.chatAgentSelection) {
        elements.chatAgentSelection.addEventListener('change', () => {
            const selectedAgentId = elements.chatAgentSelection.value;
            switchAgent(selectedAgentId);
        });
    }

    // 清除上下文按钮 (ID 未变)
    if (elements.clearContextBtn) {
        elements.clearContextBtn.addEventListener('click', clearContext);
    }

    // 移除旧 Agent 设置监听器

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

            // 获取图标元素
            const eyeIcon = document.getElementById('eye-icon');
            const eyeSlashIcon = document.getElementById('eye-slash-icon');

            // 根据输入框类型显示/隐藏正确的图标
            if (eyeIcon && eyeSlashIcon) {
                if (type === 'text') { // 密码可见，显示斜杠眼
                    eyeIcon.style.display = 'none';
                    eyeSlashIcon.style.display = 'inline-block';
                } else { // 密码隐藏，显示普通眼
                    eyeIcon.style.display = 'inline-block';
                    eyeSlashIcon.style.display = 'none';
                }
            }
        });
    }

    // 关闭模态框的点击外部区域
    window.addEventListener('click', (e) => {
        if (e.target === elements.imageModal) {
            hideImageModal();
        }
    });

    // 新增：关闭 Mermaid 模态框的事件监听器
    if (elements.mermaidCloseModal) {
        elements.mermaidCloseModal.addEventListener('click', hideMermaidModal);
    }
    if (elements.mermaidModal) {
        elements.mermaidModal.addEventListener('click', (e) => {
            // 如果点击的是模态框背景本身，而不是内容区域
            if (e.target === elements.mermaidModal) {
                hideMermaidModal();
            }
        });
    }

    // --- 新增：通用设置事件监听器 ---
    if (elements.languageSelect) {
        elements.languageSelect.addEventListener('change', handleLanguageChange);
    }
    // 移除旧的 themeToggleBtnSettings 点击监听器，逻辑移至 makeDraggable
    // if (elements.themeToggleBtnSettings) {
    //     elements.themeToggleBtnSettings.addEventListener('click', toggleTheme);
    // }
    if (elements.exportChatHistoryBtn) {
        elements.exportChatHistoryBtn.addEventListener('click', handleExportChat);
    }

    // --- 新增：Agent 导入/导出事件监听器 ---
    if (elements.importAgentsBtn) {
        elements.importAgentsBtn.addEventListener('click', () => {
            elements.importAgentInput.click(); // 触发隐藏的文件输入框
        });
    }
    if (elements.importAgentInput) {
        elements.importAgentInput.addEventListener('change', handleAgentImport);
    }
    if (elements.exportAgentsBtn) {
        elements.exportAgentsBtn.addEventListener('click', handleAgentExport);
    }

    // --- 新增：使用事件委托处理 Mermaid 图表点击 ---
    if (elements.chatMessages) {
        elements.chatMessages.addEventListener('click', (event) => {
            // 查找被点击元素或其父元素中最近的 Mermaid SVG
            const mermaidSvg = event.target.closest('.mermaid > svg');
            if (mermaidSvg) {
                console.log('Delegated Mermaid click detected on SVG.'); // 调试日志
                // 阻止可能的默认行为或事件冒泡（虽然对SVG影响不大）
                event.preventDefault();
                event.stopPropagation();
                // 显示模态框
                showMermaidModal(mermaidSvg.outerHTML);
            }
        });
    }
    // --- 结束：使用事件委托处理 Mermaid 图表点击 ---

    // --- 新增：监听聊天区域滚动事件 ---
    if (elements.chatMessages) {
        elements.chatMessages.addEventListener('scroll', () => {
            const el = elements.chatMessages;
            // 判断滚动条是否接近底部
            isUserNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
            // console.log('isUserNearBottom:', isUserNearBottom); // 调试日志
        });
    }
    // --- 结束：监听聊天区域滚动事件 ---
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

    // 移除主题按钮可见性逻辑
    // setToggleButtonVisibility(tabId);

    // 如果切换到 Settings Tab，默认显示 General 子标签
    if (tabId === 'settings') {
        // 检查是否已有激活的子标签，如果没有则激活 general
        const activeSubTab = document.querySelector('.settings-nav-btn.active');
        if (!activeSubTab) {
            switchSettingsSubTab('general');
        }
    }
}

/**
 * 切换设置内部的子标签页
 * @param {string} subTabId - 要显示的子标签页ID ('general', 'agent', 'model')
 */
function switchSettingsSubTab(subTabId) {
    // 更新导航按钮状态
    elements.settingsNavBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subTabId);
    });

    // 更新子内容区域
    elements.settingsSubContents.forEach(content => {
        content.classList.toggle('active', content.id === `settings-${subTabId}`);
    });
}

// 移除 setToggleButtonVisibility 函数
// function setToggleButtonVisibility(currentTabId) { ... }

/**
 * 向聊天区域添加消息 - 使用markdown-it渲染
 * @param {string|null} content - 文本内容，可以为null
 * @param {'user'|'bot'} sender - 发送者
 * @param {object} [options={}] - 选项对象
 * @param {boolean} [options.isStreaming=false] - 是否为流式消息
 * @param {Array<{dataUrl: string, mimeType: string}>} [options.images=[]] - 图片数组 (用于用户消息预览)
 * @param {HTMLElement|null} [options.insertAfterElement=null] - 可选，如果提供，则将消息插入此元素之后，否则追加到末尾
 * @param {boolean} [options.forceScroll=false] - 是否强制滚动到底部
 * @returns {HTMLElement} 创建的消息元素
 */
function addMessageToChat(content, sender, options = {}) {
    const { isStreaming = false, images = [], insertAfterElement = null, forceScroll = false } = options;
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

    // 移除此处的滚动逻辑，将由调用者控制
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
            img.alt = _('imageAlt', { index: index + 1 });
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

    // 移除此处的滚动逻辑，将由调用者控制
    // --- Render KaTeX and Mermaid ---
    renderDynamicContent(messageElement);
    // --- End Render KaTeX and Mermaid ---

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
    copyButton.title = _('copyCode');

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

    // --- Render KaTeX and Mermaid (before adding cursor) ---
    // renderDynamicContent(messageElement); // 在流式更新期间移除，防止 Mermaid 报错
    // --- End Render KaTeX and Mermaid ---

    messageElement.appendChild(streamingCursor);

    // 滚动到新消息可见 (仅当用户在底部时)
    if (isUserNearBottom) {
        // 确保滚动的是消息元素本身
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
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

    // --- Render KaTeX and Mermaid ---
    renderDynamicContent(messageElement);
    // --- End Render KaTeX and Mermaid ---

    // 再次滚动确保完全可见 (仅当用户在底部时)
    if (isUserNearBottom) {
        // 确保滚动的是消息元素本身
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
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

    const buttonsToAppend = [];

    // 1. 创建复制按钮 (对所有消息类型)
    const copyButton = document.createElement('button');
    copyButton.classList.add('copy-button'); // 使用基础类名
    copyButton.title = _('copyAll');
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
    buttonsToAppend.push(copyButton);

    // 2. 创建重新生成按钮
    const regenerateButton = document.createElement('button');
    regenerateButton.className = 'message-action-btn regenerate-btn';
    regenerateButton.title = _('regenerate');
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
    buttonsToAppend.push(regenerateButton);

    // 3. 创建删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'message-action-btn delete-btn';
    deleteButton.title = _('deleteMessage');
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
    buttonsToAppend.push(deleteButton);

    // 4. 按照期望的视觉顺序 (Copy, Regenerate, Delete) 添加按钮
    buttonsToAppend.forEach(button => messageActions.appendChild(button));

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
        showConnectionStatus(_('apiKeyMissingError'), 'error');
        switchTab('model');
        return;
    }

    // 复制当前图片数组，避免后续操作影响
    const currentImages = [...state.images];

    // 1. 添加用户消息到聊天（包含图片），但不滚动
    const userMessageElement = addMessageToChat(userMessage, 'user', { images: currentImages });
    const userMessageId = userMessageElement.dataset.messageId; // 获取刚创建的消息ID

    elements.userInput.value = '';
    resizeTextarea(); // 手动触发高度重新计算

    // 2. 显示AI思考动画，但不滚动
    const thinkingElement = addThinkingAnimation();

    // 3. 在添加完思考动画后，强制滚动到底部，确保思考动画可见
    thinkingElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

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

        // 调用新的 API 模块函数
        await window.GeminiAPI.callGeminiAPIWithImages(userMessage, currentImages, thinkingElement, state, {
            addMessageToChat: addMessageToChat,
            updateStreamingMessage: updateStreamingMessage,
            finalizeBotMessage: finalizeBotMessage,
            clearImages: clearImages,
            showToast: showToast // Pass showToast if needed by API module for errors
        });
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

    // 移除此处的滚动逻辑，将由调用者控制

    return thinkingElement;
}

// API call functions moved to js/api.js

/**
 * 提取当前页面内容
 */
async function extractPageContent() {
    try {
        // 更新状态指示器
        elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusExtracting')}`;

        // 向content script发送消息，请求提取页面内容
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "extractContent"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusFailed')}`;
                        return;
                    }

                    if (response && response.content) {
                        // 获取到页面内容
                        const content = response.content;

                        // 更新状态
                        state.pageContext = content;
                        elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusChars', { charCount: content.length })}`;

                        // 此处不再需要检查和设置 pageContentExtractedMessageShown
                        // 显示逻辑移至 handleContentScriptMessages
                    } else {
                        elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusFailed')}`;
                    }
                });
            } else {
                elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusNone')}`; // Or a specific message?
            }
        });
    } catch (error) {
        console.error('提取页面内容时出错:', error);
        elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusFailed')}`;
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
    elements.connectionIndicator.textContent = state.isConnected ? _('connectionIndicatorConnected') : _('connectionIndicatorDisconnected');
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
        // showAgentStatusMessage is removed, use showToast or similar if needed
        showToast(_('agentSettingsSaved'), 'success');
    });
}

// 移除 showAgentStatusMessage 函数，不再需要独立的 Agent 状态显示
// function showAgentStatusMessage(message, type) { ... }

/**
 * 在聊天界面显示状态消息 (例如内容提取成功)
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('success' 或 'error')
 */
function showChatStatusMessage(message, type) {
    if (!elements.chatStatusMessage) return; // 确保元素存在

    elements.chatStatusMessage.textContent = message;
    elements.chatStatusMessage.className = 'chat-status ' + type; // 应用基础和类型类

    // 显示消息
    elements.chatStatusMessage.style.display = 'block';
    elements.chatStatusMessage.style.opacity = '1';
    elements.chatStatusMessage.style.transform = 'translateY(0)';


    // 2秒后自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            elements.chatStatusMessage.style.opacity = '0';
            elements.chatStatusMessage.style.transform = 'translateY(5px)';
            // 在动画结束后彻底隐藏
            setTimeout(() => {
                 if (elements.chatStatusMessage.textContent === message) { // 避免隐藏后续消息
                     elements.chatStatusMessage.style.display = 'none';
                 }
            }, 300); // 匹配 CSS transition duration
        }, 2000);
    }
    // 错误消息通常需要用户手动处理，所以不自动隐藏
}

// API test function moved to js/api.js

/**
 * Saves model settings after testing the API key.
 * @param {boolean} [showToastNotification=true] - Whether to show the 'Saved' toast notification.
 */
async function saveModelSettings(showToastNotification = true) {
    const apiKey = elements.apiKey.value.trim();
    const model = elements.modelSelection.value;

    if (!apiKey) {
        showConnectionStatus(_('apiKeyMissingError'), 'error'); // Re-use existing key
        return;
    }

    // Disable button and show saving state
    elements.saveModelSettings.disabled = true;
    elements.saveModelSettings.textContent = _('saving');
    // Show a neutral status while testing
    elements.connectionStatus.textContent = _('testingConnection');
    elements.connectionStatus.className = 'connection-status info'; // Use 'info' or a similar neutral class if defined, otherwise just text
    elements.connectionStatus.style.display = 'block';


    // Call the API test function from the new module
    const testResult = await window.GeminiAPI.testAndVerifyApiKey(apiKey, model);

    if (testResult.success) {
        // Update state
        state.apiKey = apiKey;
        state.model = model;
        state.isConnected = true;

        // Save to storage
        chrome.storage.sync.set({
            apiKey: state.apiKey,
            model: state.model
        }, () => {
            // Check for runtime errors after setting storage
            if (chrome.runtime.lastError) {
                console.error("Error saving settings:", chrome.runtime.lastError);
                showConnectionStatus(_('saveFailedToast', { error: chrome.runtime.lastError.message }), 'error');
                state.isConnected = false; // Revert connection status if save failed
            } else {
                // Show success message AFTER saving is confirmed using toast
                if (showToastNotification) {
                    showToast(_('settingsSaved'), 'success'); // 根据参数决定是否显示 Toast
                }
            }
            updateConnectionStatus(); // Update indicator based on the final connection status

            // Sync chat model selector if it exists
             if (elements.chatModelSelection) {
                 elements.chatModelSelection.value = state.model;
             }
        });
    } else {
        // Test failed
        state.isConnected = false;
        // Use a generic connection failed message format
        showConnectionStatus(_('connectionTestFailed', { error: testResult.message }), 'error');
        updateConnectionStatus(); // Update indicator based on failed test
    }

    // Re-enable button and restore text regardless of success/failure
    elements.saveModelSettings.disabled = false;
    elements.saveModelSettings.textContent = _('save');
}

/**
 * 从存储中加载设置
 */
function loadSettings() { // Now also loads and applies language
    chrome.storage.sync.get([
        'apiKey',
        'model',
        'systemPrompt', // Note: systemPrompt is now part of agent settings
        'temperature',  // Note: temperature is now part of agent settings
        'maxTokens',    // Note: maxTokens is now part of agent settings
        'topP',         // Note: topP is now part of agent settings
        'darkMode',     // 新增：加载深色模式设置
        'language', // 新增：加载语言设置
        ],
        (syncResult) => {
            // 更新模型和API Key状态
            if (syncResult.apiKey) state.apiKey = syncResult.apiKey;
            if (syncResult.model) state.model = syncResult.model;

            // 更新模型设置UI
            if (elements.apiKey) elements.apiKey.value = state.apiKey;
            if (elements.modelSelection) elements.modelSelection.value = state.model;
            if (elements.chatModelSelection) {
                elements.chatModelSelection.value = state.model;
            }

            // 加载深色模式设置
            state.darkMode = syncResult.darkMode === true; // 确保是布尔值
            applyTheme(state.darkMode);

            // --- Mermaid 初始化 (Moved Here) ---
            if (typeof mermaid !== 'undefined') {
                try {
                    mermaid.initialize({
                        startOnLoad: false, // 我们将手动渲染
                        theme: state.darkMode ? 'dark' : 'default', // 使用已加载的主题设置
                        // 可选：添加其他 Mermaid 配置
                        // securityLevel: 'strict', // 推荐，但可能需要调整 CSP
                        logLevel: 'error' // 只记录错误
                    });
                    console.log('Mermaid initialized with theme:', state.darkMode ? 'dark' : 'default'); // Keep logs English
                } catch (error) {
                    console.error('Mermaid initialization failed:', error);
                }
            } else {
                console.warn('Mermaid library not found during settings load.');
            }
            // --- 结束 Mermaid 初始化 ---

            // 加载语言设置
            if (syncResult.language && elements.languageSelect) {
                elements.languageSelect.value = syncResult.language;
                state.language = syncResult.language;
            } else {
                // 默认语言
                state.language = 'zh-CN'; // Default to Chinese
            }
            // 设置下拉框的值
            if (elements.languageSelect) {
                 elements.languageSelect.value = state.language;
            }
            // 加载并应用翻译
            loadAndApplyTranslations(state.language);

            // 检查API连接状态 (现在只依赖API Key)
            state.isConnected = !!state.apiKey; // 简化判断
            updateConnectionStatus();

            // 注意：Agent相关的设置 (systemPrompt, temperature等) 现在由 loadAgentsList 处理
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
    welcomeTitle.textContent = _('welcomeHeading');
    welcomeMessage.appendChild(welcomeTitle);

    // 添加快捷操作
    const quickActions = document.createElement('div');
    quickActions.className = 'quick-actions';

    const summarizeBtn = document.createElement('button');
    summarizeBtn.id = 'summarize-page';
    summarizeBtn.className = 'quick-action-btn';
    summarizeBtn.textContent = _('summarizeAction');
    summarizeBtn.addEventListener('click', () => {
        elements.userInput.value = _('summarizeAction');
        elements.userInput.focus();
        sendUserMessage();
    });

    quickActions.appendChild(summarizeBtn);
    welcomeMessage.appendChild(quickActions);

    elements.chatMessages.appendChild(welcomeMessage);

    // 清除上传的图片
    clearImages();

    // 移除 pageContentExtractedMessageShown 相关逻辑
    // 显示清除成功的消息
    showToast(_('contextClearedSuccess'), 'success'); // Use toast for this confirmation
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
        img.alt = _('imageAlt', { index: index + 1 });

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
        viewBtn.title = _('viewImageTitle');
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
        deleteBtn.title = _('deleteImageTitle');
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
 * 显示 Mermaid 图表放大预览模态框
 * @param {string} svgContent - 要显示的 SVG 图表内容 (outerHTML)
 */
function showMermaidModal(svgContent) {
    console.log('showMermaidModal called. SVG content length:', svgContent?.length); // 调试日志
    if (!elements.mermaidModal || !elements.mermaidModalContent) return;

    // 销毁可能存在的旧 Panzoom 实例
    if (currentPanzoomInstance) {
        currentPanzoomInstance.destroy();
        currentPanzoomInstance = null;
        console.log('Previous Panzoom instance destroyed.');
    }

    // 清空旧内容并注入新的 SVG
    elements.mermaidModalContent.innerHTML = svgContent;

    // 找到新注入的 SVG 元素
    const svgElement = elements.mermaidModalContent.querySelector('svg');

    if (svgElement) {
        // 初始化 Panzoom
        try {
            // 配置 Panzoom，允许滚轮缩放和拖动
            currentPanzoomInstance = Panzoom(svgElement, { // Corrected: Use uppercase 'P'
                maxZoom: 5, // 限制最大缩放倍数
                minZoom: 0.5, // 限制最小缩放倍数
                bounds: true, // 防止拖出边界
                boundsPadding: 0.1 // 边界留白
                // 可以在这里添加更多配置选项
            });
            console.log('Panzoom initialized on Mermaid SVG.');

            // --- 新增：为模态框内容添加滚轮缩放事件监听器 ---
            if (elements.mermaidModalContent) {
                // 定义监听器函数并存储引用
                mermaidWheelListener = (event) => {
                    if (currentPanzoomInstance) {
                        // 阻止页面滚动
                        event.preventDefault();
                        // 调用 Panzoom 的滚轮缩放方法
                        currentPanzoomInstance.zoomWithWheel(event);
                        // console.log('Panzoom zoomWithWheel called.'); // 可选的调试日志
                    }
                };
                // 添加事件监听器
                elements.mermaidModalContent.addEventListener('wheel', mermaidWheelListener, { passive: false }); // passive: false 允许 preventDefault
                console.log('Wheel listener added to mermaid modal content.');
            }
            // --- 结束：添加滚轮缩放事件监听器 ---

        } catch (error) {
            console.error('Failed to initialize Panzoom:', error);
            currentPanzoomInstance = null; // 确保实例为空
        }
    } else {
        console.warn('Could not find SVG element in Mermaid modal to initialize Panzoom.');
    }

    // 显示模态框
    elements.mermaidModal.style.display = 'block';
}

/**
 * 隐藏 Mermaid 图表预览模态框
 */
function hideMermaidModal() {
    // --- 新增：移除滚轮事件监听器 ---
    if (mermaidWheelListener && elements.mermaidModalContent) {
        elements.mermaidModalContent.removeEventListener('wheel', mermaidWheelListener);
        mermaidWheelListener = null; // 清除引用
        console.log('Wheel listener removed from mermaid modal content.');
    }
    // --- 结束：移除滚轮事件监听器 ---

    if (!elements.mermaidModal) return;

    // 销毁 Panzoom 实例
    if (currentPanzoomInstance) {
        currentPanzoomInstance.destroy();
        currentPanzoomInstance = null;
        console.log('Panzoom instance destroyed.');
    }

    elements.mermaidModal.style.display = 'none';
    // 清空内容，避免旧图表残留
    if (elements.mermaidModalContent) {
        elements.mermaidModalContent.innerHTML = '';
    }
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
            // Translate the default agent name before adding if storage is empty
            const translatedDefaultAgent = { ...defaultAgent, name: _('agentLabel') }; // Use 'agentLabel' as the key for "Default Agent" or add a new key? Let's add 'defaultAgentName' key.
            // Need to add 'defaultAgentName' to translations.js first. Let's assume it exists for now.
            const translatedDefaultAgentWithName = { ...defaultAgent, name: _('defaultAgentName') };
            state.agents = [translatedDefaultAgentWithName];
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
        // loadCurrentAgentSettings(); // 移除
        updateAgentSelectionInChat();

        // *** 新增：加载当前选中助手的设置到全局 state ***
        const currentAgent = state.agents.find(a => a.id === state.currentAgentId);
        if (currentAgent) {
            state.systemPrompt = currentAgent.systemPrompt;
            state.temperature = currentAgent.temperature;
            state.maxTokens = currentAgent.maxTokens;
            state.topP = currentAgent.topP;
            console.log(`Initial global state updated for agent: ${state.currentAgentId}`);
        } else {
            console.warn(`Initial currentAgentId (${state.currentAgentId}) not found in loaded agents. Global state might be incorrect.`);
            // Optionally reset global state to defaults or first agent's settings
            if (state.agents.length > 0) {
                 const firstAgent = state.agents[0];
                 state.systemPrompt = firstAgent.systemPrompt;
                 state.temperature = firstAgent.temperature;
                 state.maxTokens = firstAgent.maxTokens;
                 state.topP = firstAgent.topP;
                 state.currentAgentId = firstAgent.id; // Ensure currentAgentId is valid
                 saveCurrentAgentId(); // Save the corrected ID
                 updateAgentSelectionInChat(); // Update dropdown again if ID changed
            }
        }
    });
}

/**
 * 更新助手列表UI (重构版 - 可折叠，实时保存)
 */
function updateAgentsList() {
    if (!elements.agentsList) return;

    // 清空列表
    elements.agentsList.innerHTML = '';

    // 检查是否有助手
    if (!state.agents || state.agents.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `<p>${_('emptyAgentList')}</p>`;
        elements.agentsList.appendChild(emptyState);
        return;
    }

    // 添加每个助手项
    state.agents.forEach(agent => {
        const originalAgentId = agent.id; // 保存原始ID用于查找和事件处理
        const agentItem = document.createElement('div');
        agentItem.className = 'agent-item';
        agentItem.dataset.originalId = originalAgentId; // 存储原始ID

        // --- 创建头部 ---
        const header = document.createElement('div');
        header.className = 'agent-item-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'agent-item-name';
        nameSpan.textContent = agent.name; // 只读名称

        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
        `; // 初始为向右箭头

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'agent-item-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = _('delete');
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发展开/折叠
            showDeleteConfirmDialog(originalAgentId); // 使用原始ID
        });
        actionsDiv.appendChild(deleteBtn);

        header.appendChild(nameSpan);
        header.appendChild(expandIcon);
        header.appendChild(actionsDiv);

        // --- 创建主体 (可折叠内容) ---
        const body = document.createElement('div');
        body.className = 'agent-item-body';

        // Agent Name (Editable) - Moved from header to body
        const nameGroup = document.createElement('div');
        nameGroup.className = 'setting-group';
        nameGroup.innerHTML = `
            <label for="agent-name-${originalAgentId}">${_('agentNameLabel')}</label>
            <input type="text" id="agent-name-${originalAgentId}" value="${agent.name}">
        `;
        nameGroup.querySelector('input').addEventListener('input', (e) => {
             // Simple debounce for saving
             clearTimeout(agentItem._saveTimeout);
             agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettings(originalAgentId, agentItem), 500);
        });
        body.appendChild(nameGroup);

        // Agent ID (Read-only, optional display - kept for reference but not editable)
        // const idDisplayGroup = document.createElement('div');
        // idDisplayGroup.className = 'setting-group setting-group-readonly'; // Add a class for styling if needed
        // idDisplayGroup.innerHTML = `
        //     <label>Internal ID:</label>
        //     <span class="readonly-value">${agent.id}</span>
        // `;
        // body.appendChild(idDisplayGroup);

        // System Prompt
        const promptGroup = document.createElement('div');
        promptGroup.className = 'setting-group';
        promptGroup.innerHTML = `
            <label for="system-prompt-${originalAgentId}">${_('agentSystemPromptLabel')}</label>
            <textarea id="system-prompt-${originalAgentId}" placeholder="${_('agentSystemPromptLabel')}">${agent.systemPrompt}</textarea>
        `;
        promptGroup.querySelector('textarea').addEventListener('input', (e) => {
             clearTimeout(agentItem._saveTimeout);
             agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettings(originalAgentId, agentItem), 500);
        });
        body.appendChild(promptGroup);

        // Temperature
        const tempGroup = document.createElement('div');
        tempGroup.className = 'setting-group';
        tempGroup.innerHTML = `
            <label for="temperature-${originalAgentId}">${_('agentTemperatureLabel')}</label>
            <div class="slider-container">
                <input type="range" id="temperature-${originalAgentId}" min="0" max="1" step="0.1" value="${agent.temperature}" class="color-slider">
                <span id="temperature-value-${originalAgentId}">${agent.temperature}</span>
            </div>
        `;
        const tempInput = tempGroup.querySelector('input[type="range"]');
        const tempValueSpan = tempGroup.querySelector(`#temperature-value-${originalAgentId}`);
        tempInput.addEventListener('input', (e) => {
            tempValueSpan.textContent = e.target.value;
            clearTimeout(agentItem._saveTimeout);
            agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettings(originalAgentId, agentItem), 300); // 滑块可以稍微快点
        });
        body.appendChild(tempGroup);

        // Top P
        const topPGroup = document.createElement('div');
        topPGroup.className = 'setting-group';
        topPGroup.innerHTML = `
            <label for="top-p-${originalAgentId}">${_('agentTopPLabel')}</label>
            <div class="slider-container">
                <input type="range" id="top-p-${originalAgentId}" min="0" max="1" step="0.05" value="${agent.topP}" class="color-slider">
                <span id="top-p-value-${originalAgentId}">${agent.topP}</span>
            </div>
        `;
        const topPInput = topPGroup.querySelector('input[type="range"]');
        const topPValueSpan = topPGroup.querySelector(`#top-p-value-${originalAgentId}`);
        topPInput.addEventListener('input', (e) => {
            topPValueSpan.textContent = e.target.value;
            clearTimeout(agentItem._saveTimeout);
            agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettings(originalAgentId, agentItem), 300);
        });
        body.appendChild(topPGroup);

        // Max Output Length
        const maxTokensGroup = document.createElement('div');
        maxTokensGroup.className = 'setting-group';
        maxTokensGroup.innerHTML = `
            <label for="max-tokens-${originalAgentId}">${_('agentMaxOutputLabel')}</label>
            <input type="number" id="max-tokens-${originalAgentId}" value="${agent.maxTokens}" min="50" max="65536">
        `;
         maxTokensGroup.querySelector('input').addEventListener('input', (e) => {
             clearTimeout(agentItem._saveTimeout);
             agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettings(originalAgentId, agentItem), 500);
        });
        body.appendChild(maxTokensGroup);

        // --- 组装和添加事件 ---
        agentItem.appendChild(header);
        agentItem.appendChild(body);
        elements.agentsList.appendChild(agentItem);

        // 添加展开/折叠事件监听器到头部
        header.addEventListener('click', () => {
            const isExpanded = agentItem.classList.contains('expanded');

            // 折叠所有其他的项
            elements.agentsList.querySelectorAll('.agent-item.expanded').forEach(item => {
                if (item !== agentItem) {
                    item.classList.remove('expanded');
                }
            });

            // 切换当前项
            agentItem.classList.toggle('expanded', !isExpanded);

            // 更新当前选中的 Agent ID (如果展开)
            if (!isExpanded) {
                 state.currentAgentId = originalAgentId; // 更新 state 中的当前 ID
                 saveCurrentAgentId(); // 保存到存储
                 updateAgentSelectionInChat(); // 更新聊天界面的下拉框
            }
        });

        // 如果是当前选中的 Agent，默认展开 (根据 single-expand 逻辑，可能不需要)
        // if (originalAgentId === state.currentAgentId) {
        //     agentItem.classList.add('expanded');
        // }
    });
}

/**
 * (新) 自动保存助手设置
 * @param {string} originalAgentId - 触发保存时该助手的原始ID
 * @param {HTMLElement} agentItemElement - 触发保存的助手项DOM元素
 */
function autoSaveAgentSettings(originalAgentId, agentItemElement) {
    console.log(`Attempting to auto-save agent with original ID: ${originalAgentId}`);

    // 1. 查找助手在 state.agents 中的索引
    const agentIndex = state.agents.findIndex(a => a.id === originalAgentId);
    if (agentIndex === -1) {
        console.error(`Auto-save failed: Agent with original ID ${originalAgentId} not found in state.`);
        showToast(_('agentSaveFailedNotFound'), 'error');
        return;
    }

    // 2. 从 DOM 读取当前值 (ID is now internal, read Name instead)
    const nameInput = agentItemElement.querySelector(`#agent-name-${originalAgentId}`);
    const systemPromptInput = agentItemElement.querySelector(`#system-prompt-${originalAgentId}`);
    const temperatureInput = agentItemElement.querySelector(`#temperature-${originalAgentId}`);
    const topPInput = agentItemElement.querySelector(`#top-p-${originalAgentId}`);
    const maxTokensInput = agentItemElement.querySelector(`#max-tokens-${originalAgentId}`);

    // Use originalAgentId for lookup, don't read/change ID from input
    const newName = nameInput ? nameInput.value.trim() : state.agents[agentIndex].name;
    const newSystemPrompt = systemPromptInput ? systemPromptInput.value : state.agents[agentIndex].systemPrompt;
    // 使用 parseFloat 和 parseInt 确保数字类型正确
    const newTemperature = temperatureInput ? parseFloat(temperatureInput.value) : state.agents[agentIndex].temperature;
    const newTopP = topPInput ? parseFloat(topPInput.value) : state.agents[agentIndex].topP;
    const newMaxTokens = maxTokensInput ? parseInt(maxTokensInput.value, 10) : state.agents[agentIndex].maxTokens;

    // 3. Validate Name (cannot be empty)
    if (!newName) {
        console.error("Auto-save failed: Agent Name cannot be empty.");
        showToast(_('agentSaveFailedNameEmpty'), 'error');
        // Optional: revert input value
        if (nameInput) nameInput.value = state.agents[agentIndex].name;
        return;
    }

    // ID conflict check is removed as internal ID doesn't change

    // 4. 更新 state.agents 中的助手对象 (Keep original ID)
    const agentToUpdate = state.agents[agentIndex];
    // agentToUpdate.id = newId; // DO NOT UPDATE ID
    agentToUpdate.name = newName; // Update Name
    agentToUpdate.systemPrompt = newSystemPrompt;
    agentToUpdate.temperature = newTemperature;
    agentToUpdate.topP = newTopP;
    agentToUpdate.maxTokens = newMaxTokens;
console.log(`Agent ${originalAgentId} updated in state (Name: ${newName}):`, agentToUpdate);

// *** 新增：如果修改的是当前聊天选中的助手，则同步更新全局 state ***
// Note: Since ID is not editable anymore, we only need to check originalAgentId
if (originalAgentId === state.currentAgentId) {
     state.systemPrompt = newSystemPrompt;
     state.temperature = newTemperature;
     state.maxTokens = newMaxTokens;
     state.topP = newTopP;
     console.log(`Global state synced for currently active agent: ${originalAgentId}`);
}

    // 5. 保存整个列表到存储
    saveAgentsList(); // 这个函数会保存 state.agents 和 state.currentAgentId

    // 6. 更新聊天界面的下拉框 (if Name changed)
    // Also update the header display name in the list item itself
    const nameSpanInHeader = agentItemElement.querySelector('.agent-item-header .agent-item-name');
    if (nameSpanInHeader) {
        nameSpanInHeader.textContent = newName;
    }
    updateAgentSelectionInChat(); // Update dropdown in chat tab

    // 7. (可选) 提供保存反馈
    // 可以考虑在 agentItemElement 内部短暂显示一个“已保存”图标或消息
    // showToast('Saved', 'success'); // 修改提示文字 (根据用户要求移除)
}

/*
 * (已移除) 加载并显示当前选中助手的设置
 * 功能合并到 updateAgentsList 中
 */
// function loadCurrentAgentSettings() { ... }

/**
 * 创建新助手
 */
function createNewAgent() {
    // --- 生成唯一的助手名称 ---
    const baseName = _('newAgentBaseName'); // 使用新的翻译键获取 "助手" 或 "Agent"
    let counter = 1;
    let newAgentName = `${baseName} ${counter}`;
    // 循环查找直到找到一个不存在的名称
    while (state.agents.some(agent => agent.name === newAgentName)) {
        counter++;
        newAgentName = `${baseName} ${counter}`;
    }
    // --- 结束：生成唯一的助手名称 ---

    // 创建新助手
    const newAgent = {
        id: generateUniqueId(),
        name: newAgentName, // 使用生成的唯一名称
        systemPrompt: defaultSettings.systemPrompt,
        temperature: defaultSettings.temperature,
        maxTokens: defaultSettings.maxTokens, // 使用默认值或调整后的值
        topP: defaultSettings.topP
    };

    // 添加到列表
    state.agents.push(newAgent);

    // 选择新助手
    state.currentAgentId = newAgent.id;

    // 更新界面
    updateAgentsList();
    // loadCurrentAgentSettings(); // 移除
    updateAgentSelectionInChat();

    // 提示用户
    showToast(_('newAgentCreatedToast'), 'success');

    // 保存到存储
    saveAgentsList();
}

/*
 * (已移除) 编辑助手
 * 点击列表项头部的逻辑将在 updateAgentsList 中处理
 */
// function editAgent(agentId) { ... }

/*
 * (已移除) 保存当前助手设置
 * 将由新的 autoSaveAgentSettings 函数替代
 */
// function saveAgentSettings() { ... }

/**
 * 显示删除确认对话框
 * @param {string} agentId - 要删除的助手ID
 */
function showDeleteConfirmDialog(agentId) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;

    // 设置要删除的助手信息 (使用翻译)
    const confirmPromptElement = elements.deleteConfirmDialog.querySelector('p');
    if (confirmPromptElement) {
        confirmPromptElement.innerHTML = _('deleteConfirmPrompt', { agentName: `<span id="delete-agent-name">${agent.name}</span>` });
    }
    // elements.deleteAgentName.textContent = agent.name; // No longer needed as it's part of the prompt
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
        showToast(_('minOneAgentError'), 'error');
        elements.deleteConfirmDialog.style.display = 'none';
        return;
    }

    // 从列表中移除
    state.agents = state.agents.filter(a => a.id !== agentId);

    // 如果删除的是当前选中的助手，则切换到第一个助手
    if (state.currentAgentId === agentId) {
        state.currentAgentId = state.agents[0].id;
        // loadCurrentAgentSettings(); // 移除
    }

    // 更新界面
    updateAgentsList();
    updateAgentSelectionInChat();

    // 隐藏对话框
    elements.deleteConfirmDialog.style.display = 'none';

    // 提示用户
    showToast(_('agentDeletedToast'), 'success');

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
//     showToast(`已切换到助手: ${agent.name}`, 'success');
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
 * 处理 Agent 配置导出
 */
function handleAgentExport() {
    if (!state.agents || state.agents.length === 0) {
        showToast(_('agentExportEmptyError', 'error')); // 需要添加翻译键
        return;
    }

    try {
        // 准备要导出的数据 (可以只包含必要字段，避免导出内部状态如 id)
        const agentsToExport = state.agents.map(agent => ({
            name: agent.name,
            systemPrompt: agent.systemPrompt,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            topP: agent.topP
            // 不导出 id
        }));

        const jsonString = JSON.stringify(agentsToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pagetalk_agents_${timestamp}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(_('agentExportSuccess'), 'success'); // 需要添加翻译键
    } catch (error) {
        console.error('Error exporting agents:', error);
        showToast(_('agentExportError', { error: error.message }), 'error'); // 需要添加翻译键
    }
}

/**
 * 处理 Agent 配置文件导入
 * @param {Event} event - 文件输入框的 change 事件
 */
function handleAgentImport(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            // 1. 验证顶层结构是否为数组
            if (!Array.isArray(importedData)) {
                throw new Error(_('agentImportErrorInvalidFormatArray')); // 需要添加翻译键
            }

            let importedCount = 0;
            let updatedCount = 0;

            // 2. 遍历导入的 Agent
            importedData.forEach((importedAgent, index) => {
                // --- 详细验证每个 Agent 对象的结构和类型 ---
                let validationError = null;

                if (typeof importedAgent !== 'object' || importedAgent === null) {
                    validationError = 'Agent data is not an object.';
                } else if (typeof importedAgent.name !== 'string' || !importedAgent.name.trim()) {
                    validationError = `Field 'name': Invalid type or empty. Value: ${importedAgent.name}, Type: ${typeof importedAgent.name}, Expected: non-empty string.`;
                } else if (typeof importedAgent.systemPrompt !== 'string') {
                    validationError = `Field 'systemPrompt': Invalid type. Value: ${importedAgent.systemPrompt}, Type: ${typeof importedAgent.systemPrompt}, Expected: string.`;
                } else if (typeof importedAgent.temperature !== 'number' || isNaN(importedAgent.temperature) || importedAgent.temperature < 0 || importedAgent.temperature > 1) {
                    validationError = `Field 'temperature': Invalid type or range (0-1). Value: ${importedAgent.temperature}, Type: ${typeof importedAgent.temperature}, Expected: number between 0 and 1.`;
                } else if (typeof importedAgent.maxTokens !== 'number' || !Number.isInteger(importedAgent.maxTokens) || importedAgent.maxTokens < 50 || importedAgent.maxTokens > 65536) { // Updated max value
                    validationError = `Field 'maxTokens': Invalid type or range (50-65536). Value: ${importedAgent.maxTokens}, Type: ${typeof importedAgent.maxTokens}, Expected: integer between 50 and 65536.`; // Updated message
                } else if (typeof importedAgent.topP !== 'number' || isNaN(importedAgent.topP) || importedAgent.topP < 0 || importedAgent.topP > 1) {
                    validationError = `Field 'topP': Invalid type or range (0-1). Value: ${importedAgent.topP}, Type: ${typeof importedAgent.topP}, Expected: number between 0 and 1.`;
                }

                if (validationError) {
                    console.error(`Validation failed for agent at index ${index}: ${validationError}`, 'Agent Data:', importedAgent);
                    throw new Error(_('agentImportErrorInvalidAgentData', { index: index + 1 }));
                }
                // --- 验证结束 ---

                const existingAgentIndex = state.agents.findIndex(a => a.name === importedAgent.name.trim());

                if (existingAgentIndex !== -1) {
                    // 更新现有 Agent (保留 ID)
                    const agentToUpdate = state.agents[existingAgentIndex];
                    agentToUpdate.systemPrompt = importedAgent.systemPrompt;
                    agentToUpdate.temperature = importedAgent.temperature;
                    agentToUpdate.maxTokens = importedAgent.maxTokens;
                    agentToUpdate.topP = importedAgent.topP;
                    updatedCount++;
                    console.log(`Updated agent: ${agentToUpdate.name}`);
                } else {
                    // 添加新 Agent (生成新 ID)
                    const newAgent = {
                        id: generateUniqueId(),
                        name: importedAgent.name.trim(),
                        systemPrompt: importedAgent.systemPrompt,
                        temperature: importedAgent.temperature,
                        maxTokens: importedAgent.maxTokens,
                        topP: importedAgent.topP
                    };
                    state.agents.push(newAgent);
                    importedCount++;
                    console.log(`Added new agent: ${newAgent.name}`);
                }
            });

            // 3. 更新状态和 UI
            saveAgentsList(); // 保存更新后的列表
            updateAgentsList(); // 刷新设置界面列表
            updateAgentSelectionInChat(); // 刷新聊天界面下拉框

            // 确保 currentAgentId 仍然有效，如果无效则选择第一个
            if (!state.agents.find(a => a.id === state.currentAgentId)) {
                if (state.agents.length > 0) {
                    state.currentAgentId = state.agents[0].id;
                    saveCurrentAgentId();
                    updateAgentSelectionInChat(); // 再次更新下拉框
                } else {
                    // 如果导入后列表为空（理论上不太可能，除非导入空数组且原列表为空）
                    // 可能需要处理这种情况，例如创建一个默认助手
                }
            }

            showToast(_('agentImportSuccess', { imported: importedCount, updated: updatedCount }), 'success'); // 需要添加翻译键

        } catch (error) {
            console.error('Error importing agents:', error);
            showToast(_('agentImportError', { error: error.message }), 'error'); // 需要添加翻译键
        } finally {
            // 重置文件输入框，以便可以再次选择相同的文件
            event.target.value = null;
        }
    };

    reader.onerror = (e) => {
        console.error('Error reading agent import file:', e);
        showToast(_('agentImportErrorFileRead'), 'error'); // 需要添加翻译键
        // 重置文件输入框
        event.target.value = null;
    };

    reader.readAsText(file);
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
 * 处理来自 content script 和 sandbox iframe 的消息
 */
function handleContentScriptMessages(event) { // Renamed back from handleWindowMessages
    // Mermaid sandbox message handling removed
    const message = event.data;

    if (message.action === 'pageContentExtracted') {
        // 更新状态
        state.pageContext = message.content;

        if (elements.contextStatus) {
            elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusChars', { charCount: message.content.length })}`;
        }

        // 根据 content.js 发送的标志决定是否显示成功消息
        if (message.showSuccessMessage) {
            showChatStatusMessage(_('pageContentExtractedSuccess'), 'success');
        }

        // 如果设置了自动提取，继续处理
        if (state.autoExtract) {
            console.log(_('pageContentExtractedSuccess')); // Log translated message? Or keep English? Let's keep English log.
            console.log('Page content automatically extracted.');
        }
    }
    else if (message.action === 'pageContentLoaded') {
        // 面板加载完成，请求页面内容
        requestPageContent();
    }
    else if (message.action === 'copySuccess') {
        // 可以在这里显示一个短暂的成功提示，如果需要的话
        // showToast('已复制到剪贴板', 'success');
        console.log('Copy successful'); // Keep logs in English
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
        elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusExtracting')}`;
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
    const minHeight = 32; // 与 CSS 中的 min-height 保持一致
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
 * 删除指定的消息 (新逻辑：只删除目标消息)
 * @param {string} messageId - 要删除的消息ID
 */
function deleteMessage(messageId) {
    // 1. 查找要删除的消息在历史记录中的索引
    const messageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
        console.warn(`Delete failed: Message with ID ${messageId} not found in history.`);
        return; // 找不到消息，直接返回
    }

    // 2. 删除对应的 DOM 元素
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    } else {
        console.warn(`Delete failed: DOM element for message ID ${messageId} not found.`);
    }

    // 3. 从历史记录中移除该消息
    state.chatHistory.splice(messageIndex, 1);

    console.log(`Message with ID ${messageId} deleted.`); // Keep logs in English
    // 可选：如果需要持久化历史记录，可以在这里调用保存函数
    // saveChatHistory();
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
                    // Convert base64 back to dataUrl for API/display consistency
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
    // 显示思考动画，插入到用户消息之后 (不滚动)
    const thinkingElement = addThinkingAnimation(userMessageElement); // 传递参考元素

    // 在重新生成时，根据用户是否在底部决定是否滚动思考动画
    if (isUserNearBottom) {
        thinkingElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    try {
        // 调用新的 API 模块函数
        await window.GeminiAPI.callApiAndInsertResponse(
            userMessageText,
            userImages,
            thinkingElement,
            historyForApi,
            userIndex + 1, // 目标插入索引
            userMessageElement, // 插入到此元素之后
            state, // Pass state reference
            { // Pass UI callbacks
                addMessageToChat: addMessageToChat,
                updateStreamingMessage: updateStreamingMessage,
                finalizeBotMessage: finalizeBotMessage,
                clearImages: clearImages, // Pass clearImages if needed
                showToast: showToast // Pass showToast if needed
            }
        );
    } catch (error) {
        console.error(`Regenerate (turn starting at user index ${userIndex}) failed:`, error);
        if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
        }
        // 可以在用户消息后插入错误提示 (不强制滚动)
        addMessageToChat(_('regenerateError', { error: error.message }), 'bot', { insertAfterElement: userMessageElement });
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

    // 滚动到可见 (仅当用户在底部时)
    if (isUserNearBottom) {
        thinkingElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    return thinkingElement;
}


/**
 * 调用Gemini API，允许自定义历史上下文
 * @param {string} userMessage - 用户消息内容
 * @param {Array} customHistory - 可选的自定义历史上下文
 * @returns {Promise<string>} AI的响应
 */

/**
 * Renders KaTeX and Mermaid content within a given DOM element.
 * @param {HTMLElement} element - The container element to render within.
 */
function renderDynamicContent(element) {
    // --- Render KaTeX ---
    if (typeof window.renderMathInElement === 'function') {
        try {
            window.renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "\\[", right: "\\]", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\(", right: "\\)", display: false}
                ],
                throwOnError: false // Don't stop rendering on single error
            });
        } catch (error) {
            console.error('KaTeX rendering error:', error);
        }
    } else {
        // console.warn('KaTeX renderMathInElement function not found.');
    }

    // --- Render Mermaid (Manual Iteration) ---
    if (typeof mermaid !== 'undefined') {
        const mermaidPreElements = element.querySelectorAll('pre.mermaid');
        if (mermaidPreElements.length > 0) {
            console.log(`Found ${mermaidPreElements.length} Mermaid <pre> elements to render.`);
            mermaidPreElements.forEach(async (preElement, index) => {
                const definition = preElement.textContent || '';
                if (!definition.trim()) {
                    console.warn(`Skipping empty Mermaid <pre> element at index ${index}.`);
                    return; // Skip empty definitions
                }

                const renderId = `mermaid-render-${Date.now()}-${index}`;
                // Create a new container div that will replace the <pre> element
                const container = document.createElement('div');
                container.className = 'mermaid'; // Add the standard mermaid class
                container.id = `${renderId}-container`; // Give it a unique ID based on renderId
                container.dataset.mermaidDefinition = definition; // Store the definition

                // Replace the <pre> element with the new container *before* rendering
                if (preElement.parentNode) {
                    preElement.parentNode.replaceChild(container, preElement);
                } else {
                    console.error('Cannot replace Mermaid <pre> element: parentNode is null.');
                    return; // Cannot proceed without a parent
                }

                try {
                    // Render the diagram using mermaid.render
                    const { svg } = await mermaid.render(renderId, definition);
                    container.innerHTML = svg; // Insert the rendered SVG into the container
                    console.log(`Successfully rendered Mermaid chart ${index + 1} into container ${container.id}.`);

                    // Click listener is handled by delegation in setupEventListeners, no need to add here.

                } catch (error) {
                    console.error(`Error rendering Mermaid chart ${index + 1} (ID: ${renderId}):`, error, 'Definition:', definition);
                    // Display error message inside the container
                    container.innerHTML = `<div class="mermaid-error">Mermaid Render Error: ${error.message}</div>`;
                }
            });
        }
    } else {
        // console.warn('Mermaid library not found during renderDynamicContent.');
    }
    // --- End Render Mermaid ---
}



    // --- 主题切换相关函数 (更新以使用设置内的按钮) ---

/**
 * 重新渲染页面上所有已存在的 Mermaid 图表
 */
async function rerenderAllMermaidCharts() {
    if (typeof mermaid === 'undefined') {
        console.warn('Mermaid library not available for re-rendering.');
        return;
    }

    // Find all containers that have a stored definition
    const containersToRerender = document.querySelectorAll('.mermaid[data-mermaid-definition]');
    console.log(`Found ${containersToRerender.length} Mermaid charts with definitions to re-render.`);

    if (containersToRerender.length === 0) {
        return; // Nothing to re-render
    }

    // Use Promise.all to handle asynchronous rendering if needed, although mermaid.render is often synchronous
    const renderPromises = Array.from(containersToRerender).map(async (container, index) => {
        const definition = container.dataset.mermaidDefinition;
        if (!definition) {
            console.warn('Container found without definition, skipping re-render.', container);
            return; // Skip if definition is missing for some reason
        }

        // Generate a unique ID for rendering, if the container doesn't have one
        const renderId = `mermaid-rerender-${Date.now()}-${index}`;
        container.innerHTML = ''; // Clear the old SVG content

        try {
            // mermaid.render is synchronous in standard usage
            const { svg } = await mermaid.render(renderId, definition);
            container.innerHTML = svg; // Insert the newly rendered SVG
            console.log(`Successfully re-rendered Mermaid chart ${index + 1}.`);

            // Re-attach click listener if needed (though delegation should handle this)
            // const newSvgElement = container.querySelector('svg');
            // if (newSvgElement) {
            //     newSvgElement.addEventListener('click', handleMermaidClick);
            // }

        } catch (error) {
            console.error(`Error re-rendering Mermaid chart ${index + 1}:`, error, 'Definition:', definition);
            // Display error message inside the container
            container.innerHTML = `<div class="mermaid-error">Re-render Error: ${error.message}</div>`;
        }
    });

    try {
        await Promise.all(renderPromises);
        console.log('Finished re-rendering all Mermaid charts.');
    } catch (error) {
        console.error('An error occurred during the batch re-rendering process:', error);
    }
}
/**
 * 应用当前主题 (浅色/深色)
 * @param {boolean} isDarkMode - 是否应用深色模式
 */
function applyTheme(isDarkMode) {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.body.classList.add('hljs-theme-dark'); // Add dark theme for highlight.js
        document.body.classList.remove('hljs-theme-light'); // Remove light theme for highlight.js
        // 更新设置内按钮图标
        if (elements.moonIconSettings) elements.moonIconSettings.style.display = 'none';
        if (elements.sunIconSettings) elements.sunIconSettings.style.display = 'inline-block';
    } else {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('hljs-theme-light'); // Add light theme for highlight.js
        document.body.classList.remove('hljs-theme-dark'); // Remove dark theme for highlight.js
        // 更新设置内按钮图标
        if (elements.moonIconSettings) elements.moonIconSettings.style.display = 'inline-block';
        if (elements.sunIconSettings) elements.sunIconSettings.style.display = 'none';
    }
}

/**
 * 切换主题
 */
function toggleTheme() {
    state.darkMode = !state.darkMode;
    applyTheme(state.darkMode);
    saveThemeSetting();

    // --- 更新 Mermaid 主题 ---
    if (typeof mermaid !== 'undefined') {
        try {
            // Re-initialize with the new theme
            mermaid.initialize({
                startOnLoad: false,
                theme: state.darkMode ? 'dark' : 'default',
                logLevel: 'error'
            });
            console.log(`Mermaid theme updated to: ${state.darkMode ? 'dark' : 'default'}`);
            // Attempt to re-render existing charts with the new theme
            // Note: Mermaid's standard API doesn't directly support easy re-theming of existing SVGs.
            // Re-initializing might affect future renders, but existing ones might need full re-render.
            rerenderAllMermaidCharts();
        } catch (error) {
            console.error('Failed to update Mermaid theme:', error);
        }
    }
    // --- 结束 Mermaid 主题更新 ---
}

/**
 * 保存主题设置到存储
 */
function saveThemeSetting() {
    chrome.storage.sync.set({ darkMode: state.darkMode });
}

// --- 结束：主题切换相关函数 ---

// --- 新增：通用设置处理函数 ---

/**
 * 处理语言选择变化
 */
function handleLanguageChange() {
    const selectedLanguage = elements.languageSelect.value;
    state.language = selectedLanguage; // Update state immediately
    // 保存语言设置
    chrome.storage.sync.set({ language: selectedLanguage }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving language:", chrome.runtime.lastError);
            // Optionally show an error toast
            showToast(_('saveFailedToast', { error: chrome.runtime.lastError.message }), 'error');
        } else {
            console.log(`Language saved: ${selectedLanguage}`);
            // 加载并应用新的翻译
            loadAndApplyTranslations(selectedLanguage);
        }
    });
}

/**
 * 加载并应用指定语言的翻译
 * @param {string} language - 语言代码 ('zh-CN' or 'en')
 */
function loadAndApplyTranslations(language) {
    // 确保 translations 对象已加载 (从 translations.js)
    if (typeof translations === 'undefined') {
        console.error('Translations object not found. Make sure translations.js is loaded correctly.');
        return;
    }
    currentTranslations = translations[language] || translations['zh-CN']; // Fallback to Chinese
    state.language = language; // Update state
    console.log(`Applying translations for: ${language}`);
    updateUIElements();
    // Sync Day.js locale
    if (typeof dayjs !== 'undefined') {
        dayjs.locale(language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en');
        console.log(`Day.js locale set to: ${dayjs.locale()}`);
    } else {
        console.warn('Day.js not loaded, cannot set locale.');
    }
}

/**
 * 更新界面上所有需要翻译的静态元素
 */
function updateUIElements() {
    if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
        console.warn('No translations loaded, UI update skipped.');
        return;
    }

    // 更新 HTML lang 属性
    document.documentElement.lang = _('htmlLang');

    // 更新页面标题 (可能影响不大，但保持一致)
    document.title = _('pageTitle');

    // --- 聊天界面 ---
    setElementText('label[for="chat-model-selection"]', 'modelLabel');
    setElementAttribute('#chat-model-selection', 'aria-label', 'modelSelectLabel');
    setElementText('label[for="chat-agent-selection"]', 'agentLabel');
    setElementAttribute('#chat-agent-selection', 'aria-label', 'agentSelectLabel');
    setElementAttribute('#clear-context', 'title', 'clearContextTitle');
    setElementAttribute('#close-panel', 'title', 'closePanelTitle');
    // Welcome message heading and button are updated in clearContext()
    setElementAttribute('#modal-image', 'alt', 'imagePreviewAltTranslated');
    setElementAttribute('#upload-image', 'title', 'uploadImageTitle');
    setElementAttribute('#user-input', 'placeholder', 'userInputPlaceholder');
    setElementAttribute('#send-message', 'title', 'sendMessageTitle');

    // --- 设置界面 ---
    setElementText('.settings-nav-btn[data-subtab="general"]', 'generalSettingsNav');
    setElementText('.settings-nav-btn[data-subtab="agent"]', 'agentSettingsNav');
    setElementText('.settings-nav-btn[data-subtab="model"]', 'modelSettingsNav');
    setElementAttribute('#close-panel-settings', 'title', 'closePanelTitle'); // Re-use close title

    // 设置 - 通用
    setElementText('#settings-general h2', 'generalSettingsHeading');
    setElementText('label[for="language-select"]', 'languageLabel');
    // Language select options are static HTML, no need to translate here
    setElementText('label[for="export-format"]', 'exportChatLabel');
    setElementText('#export-format option[value="markdown"]', 'exportFormatMarkdown');
    setElementText('#export-format option[value="text"]', 'exportFormatText');
    setElementText('#export-chat-history', 'exportButton');

    // 设置 - Agent
    setElementText('#settings-agent h2', 'agentSettingsHeading');
    setElementText('.agents-list-header h3', 'agentsListHeading');
    setElementAttribute('#add-new-agent', 'title', 'addNewAgentTitle');
    setElementAttribute('#import-agents', 'title', 'importAgentConfigTitle'); // Add title update for import button
    setElementAttribute('#export-agents', 'title', 'exportAgentConfigTitle'); // Add title update for export button
    // Agent list items (labels like Name, System Prompt etc.) are updated in updateAgentsList()
    setElementText('#delete-confirm-dialog h3', 'deleteConfirmHeading');
    // Delete confirm prompt is updated dynamically in showDeleteConfirmDialog()
    setElementText('#cancel-delete', 'cancel');
    setElementText('#confirm-delete', 'delete');


    // 设置 - 模型
    setElementText('#settings-model h2', 'modelSettingsHeading');
    setElementText('label[for="api-key"]', 'apiKeyLabel');
    setElementAttribute('#api-key', 'placeholder', 'apiKeyPlaceholder');
    setElementAttribute('#toggle-api-key', 'title', 'toggleApiKeyVisibilityTitleTranslated');
    // API Key hint link text is static HTML
    setElementText('label[for="model-selection"]', 'modelSelectLabelSettings');
    // Model options are static HTML for now
    setElementText('#save-model-settings', 'save');

    // --- 页脚 ---
    // Context status is updated dynamically
    // Connection indicator is updated dynamically
    setElementText('.footer-tab[data-tab="chat"]', 'chatTab');
    setElementText('.footer-tab[data-tab="settings"]', 'settingsTab');

    // --- 其他动态更新的地方 ---
    // updateAgentsList needs to use _() for labels and empty state
    // showDeleteConfirmDialog needs to use _() for the prompt
    // exportChatToMarkdown/Text need to use _() for titles/roles
    // clearContext needs to use _() for welcome message/button
    // addMessageActionButtons needs to use _() for titles
    // addCopyButtonToCodeBlock needs to use _() for title
    // updateImagesPreview needs to use _() for alt text and titles

    // Re-render dynamic parts that depend on translations
    updateAgentsList(); // Re-render agent list with translated labels
    updateConnectionStatus(); // Re-render connection status text
    // Update context status based on current state.pageContext
    if (elements.contextStatus) {
        if (state.pageContext === null || state.pageContext === undefined) {
             elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusExtracting')}`;
        } else if (state.pageContext === '') {
             elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusNone')}`;
        } else if (state.pageContext === 'error') { // Assuming 'error' is stored on failure
             elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusFailed')}`;
        } else {
             elements.contextStatus.textContent = `${_('contextStatusPrefix')} ${_('contextStatusChars', { charCount: state.pageContext.length })}`;
        }
    }
    // Re-render welcome message if chat is empty
    if (elements.chatMessages && !elements.chatMessages.hasChildNodes()) {
        clearContext(); // This will re-add the welcome message using translated text
    } else {
        // If chat has messages, ensure existing welcome message (if any) is translated
        const welcomeHeading = elements.chatMessages.querySelector('.welcome-message h2');
        if (welcomeHeading) welcomeHeading.textContent = _('welcomeHeading');
        const summarizeBtn = elements.chatMessages.querySelector('#summarize-page');
        if (summarizeBtn) summarizeBtn.textContent = _('summarizeAction');
    }
}

/** Helper function to set text content of an element */
function setElementText(selector, translationKey, replacements = {}) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = _(translationKey, replacements);
    } else {
        // console.warn(`Element not found for selector: ${selector} (translation key: ${translationKey})`);
    }
}

/** Helper function to set an attribute of an element */
function setElementAttribute(selector, attribute, translationKey, replacements = {}) {
    const element = document.querySelector(selector);
    if (element) {
        element.setAttribute(attribute, _(translationKey, replacements));
    } else {
       // console.warn(`Element not found for selector: ${selector} (translation key: ${translationKey})`);
    }
}

/**
 * 处理导出聊天记录
 */
function handleExportChat() {
    const format = elements.exportFormatSelect.value;
    let content = '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = `pagetalk_chat_${timestamp}`;

    if (format === 'markdown') {
        filename += '.md';
        content = exportChatToMarkdown();
    } else { // text format
        filename += '.txt';
        content = exportChatToText();
    }

    if (!content) {
        showToast(_('chatExportEmptyError'), 'error');
        return;
    }

    // 创建下载链接
    const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(_('chatExportSuccess'), 'success');
}

/**
 * 将聊天记录导出为 Markdown 格式
 * @returns {string} Markdown 格式的聊天记录
 */
function exportChatToMarkdown() {
    if (state.chatHistory.length === 0) return '';

    // Set Day.js locale based on current language
    if (typeof dayjs !== 'undefined') {
        dayjs.locale(state.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en');
    } else {
        console.warn('Day.js not loaded for Markdown export timestamp.');
    }
    const timestamp = typeof dayjs !== 'undefined' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : new Date().toLocaleString();
    let markdown = `${timestamp}\n\n`; // Add timestamp at the beginning
    markdown += `# ${_('appName')} ${_('chatTab')} History\n\n`; // Add title without date

    state.chatHistory.forEach(message => {
        const { text, images } = extractPartsFromMessage(message);
        const role = message.role === 'user' ? _('chatTab') : _('appName'); // Or keep User/Bot? Let's use Chat/Pagetalk
        markdown += `## ${role}\n\n`;

        if (images.length > 0) {
            images.forEach((img, index) => {
                // 修改为使用占位符，避免嵌入 Base64 数据
                markdown += `[${_('imageAlt', { index: index + 1 })} - ${img.mimeType}]\n`;
            });
            markdown += '\n';
        }

        if (text) {
            markdown += `${text}\n\n`;
        }
    });

    return markdown;
}

/**
 * 将聊天记录导出为纯文本格式
 * @returns {string} 纯文本格式的聊天记录
 */
function exportChatToText() {
    if (state.chatHistory.length === 0) return '';

    // Set Day.js locale based on current language
    if (typeof dayjs !== 'undefined') {
        dayjs.locale(state.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en');
    } else {
        console.warn('Day.js not loaded for Text export timestamp.');
    }
    const timestamp = typeof dayjs !== 'undefined' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : new Date().toLocaleString();
    let textContent = `${timestamp}\n\n`; // Add timestamp at the beginning
    textContent += `${_('appName')} ${_('chatTab')} History\n\n`; // Add title without date

    state.chatHistory.forEach(message => {
        const { text, images } = extractPartsFromMessage(message);
        const role = message.role === 'user' ? _('chatTab') : _('appName');
        textContent += `--- ${role} ---\n`;

        if (images.length > 0) {
            textContent += `[${_('containsNImages', { count: images.length })}]\n`; // Need to add 'containsNImages' to translations.js
        }

        if (text) {
            textContent += `${text}\n`;
        }
        textContent += '\n';
    });

    return textContent;
}

// --- 结束：通用设置处理函数 ---

// --- 移除按钮拖动相关函数 ---
// function makeDraggable(element) { ... }
// function saveButtonPosition(top) { ... }
// function loadButtonPosition() { ... }
// function setDefaultButtonPosition() { ... }
// --- 新增：按钮拖动相关函数 ---

/**
 * 使元素可拖动
 * @param {HTMLElement} element - 要使其可拖动的元素
 */
/**
 * 使元素可拖动 (修改版：限制Y轴，区分单击/拖动)
 * @param {HTMLElement} element - 要使其可拖动的元素
 */
function makeDraggable(element) {
    let offsetY, isDragging = false;
    let startY, mousedownTime; // 只需记录 Y 和时间
    let hasDragged = false; // 标记是否发生拖动
    const dragThreshold = 5; // 拖动阈值（像素）
    const container = document.querySelector('.container') || document.body; // 获取容器

    element.addEventListener('mousedown', (e) => {
        // 仅当点击的是按钮本身而不是内部的 SVG 时开始拖动
        if (e.target !== element && e.target.tagName !== 'svg' && e.target.tagName !== 'path') return;

        e.preventDefault(); // 阻止默认拖动行为
        isDragging = true;
        hasDragged = false; // 重置拖动标记
        mousedownTime = Date.now(); // 记录按下时间
        startY = e.clientY; // 记录按下位置 Y

        // 计算鼠标相对于元素顶部的偏移
        offsetY = e.clientY - element.getBoundingClientRect().top;
        element.style.cursor = 'grabbing'; // 改变鼠标样式
        element.style.transition = 'none'; // 拖动时移除过渡效果

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;

        // 检查是否超过拖动阈值 (只检查 Y 轴)
        if (!hasDragged && Math.abs(e.clientY - startY) > dragThreshold) {
            hasDragged = true;
        }

        // 计算按钮的新理论 top 位置 (相对于视口)
        let newY = e.clientY - offsetY;

        // 边界检查 (相对于视口)
        const maxY = window.innerHeight - element.offsetHeight;
        newY = Math.max(0, Math.min(newY, maxY));

        // 只更新 top，保持 right 固定
        element.style.top = `${newY}px`;
        element.style.right = 'var(--spacing-lg)'; // 固定右边距
        element.style.left = 'auto'; // 确保 left 不干扰
        element.style.bottom = 'auto'; // 确保 bottom 不干扰
    }

    function onMouseUp(e) {
        if (!isDragging) return;

        const wasDragging = isDragging; // 记录初始拖动状态
        const didDragOccur = hasDragged; // 记录拖动是否发生

        isDragging = false; // 结束拖动状态

        // 恢复样式和移除监听器
        element.style.cursor = 'grab';
        element.style.transition = 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // 区分单击和拖动
        if (wasDragging && !didDragOccur) {
            // 如果开始拖动但未超过阈值，视为单击
            // console.log("Click detected, toggling theme."); // Keep logs English
            toggleTheme();
        } else if (didDragOccur) {
            // 如果确实发生了拖动，保存位置
            // console.log("Drag detected, saving position."); // Keep logs English
            saveButtonPosition(element.style.top);
        }

        hasDragged = false; // 重置标志
    }
}

/**
 * 保存按钮位置到 chrome.storage.sync
 * @param {string} top - 按钮的 top 样式值
 */
function saveButtonPosition(top) {
    // 只存储 top，right 是固定的
    chrome.storage.sync.set({ themeButtonPosition: { top } }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving button position:", chrome.runtime.lastError);
        } else {
            // console.log("Button position saved to chrome.storage.sync"); // Keep logs English
        }
    });
}

/**
 * 从 chrome.storage.sync 加载并应用按钮位置
 */
/**
 * 从 chrome.storage.sync 加载并应用按钮位置 (修改版：应用 top 和固定 right)
 */
function loadButtonPosition() {
    chrome.storage.sync.get('themeButtonPosition', (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading button position:", chrome.runtime.lastError);
            setDefaultButtonPosition(); // 加载出错时使用默认值
            return;
        }

        const savedPosition = result.themeButtonPosition;
        const button = elements.themeToggleBtnSettings; // 使用正确的按钮引用

        if (button) {
            if (savedPosition && savedPosition.top) {
                // 应用保存的位置
                button.style.position = 'absolute';
                button.style.top = savedPosition.top;
                button.style.right = 'var(--spacing-lg)'; // 固定 right
                button.style.left = 'auto';
                button.style.bottom = 'auto';
                // console.log(`Button position loaded: top=${savedPosition.top}, right=fixed`); // Keep logs English
            } else {
                // 没有保存的位置或 top 值无效，使用默认值
                setDefaultButtonPosition();
            }
        } else {
            console.warn("Theme toggle button element not found during loadButtonPosition.");
        }
    });
}

/**
 * 设置按钮的默认右下角位置
 */
/**
 * 设置按钮的默认右下角位置 (修改版：设置 bottom 和固定 right)
 */
function setDefaultButtonPosition() {
     const button = elements.themeToggleBtnSettings; // 使用正确的按钮引用
     if (!button) {
         console.warn("Theme toggle button element not found during setDefaultButtonPosition.");
         return;
     }
     // console.log("Setting default button position."); // Keep logs English
     button.style.position = 'absolute'; // 确保是 absolute
     button.style.top = 'auto'; // Ensure top is cleared
     button.style.left = 'auto';
     button.style.bottom = '80px'; // Updated default bottom value
     button.style.right = 'var(--spacing-lg)'; // 固定 right 值
}


// --- 结束：按钮拖动相关函数 ---
// createMermaidSandbox function removed

// 初始化应用
document.addEventListener('DOMContentLoaded', init);
// Removed duplicate DOMContentLoaded listener
