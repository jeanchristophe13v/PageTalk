/**
 * Pagetalk - Main Sidepanel Script (Coordinator)
 */

// --- Imports ---
import { generateUniqueId } from './utils.js';
import { renderDynamicContent, rerenderAllMermaidCharts, showMermaidModal, hideMermaidModal } from './render.js';
import { applyTheme, updateMermaidTheme, toggleTheme, makeDraggable, loadButtonPosition, setThemeButtonVisibility } from './theme.js';
import { setupImagePaste, handleImageSelect, handleImageFile, updateImagesPreview, removeImageById, clearImages, showFullSizeImage, hideImageModal } from './image.js';
import { handleYouTubeUrl, updateVideosPreview, removeVideoById, clearVideos, showYouTubeDialog, hideYouTubeDialog } from './video.js';
// Correctly import autoSaveAgentSettings with an alias
import {
    loadAgents,
    updateAgentsListUI,
    createNewAgent,
    showDeleteConfirmDialog,
    confirmDeleteAgent,
    switchAgent,
    updateAgentSelectionInChat,
    saveAgentsList,
    saveCurrentAgentId,
    handleAgentExport,
    handleAgentImport,
    loadCurrentAgentSettingsIntoState,
    autoSaveAgentSettings as autoSaveAgentSettingsFromAgent // Alias the import
} from './agent.js';
import { loadSettings as loadAppSettings, handleLanguageChange, handleExportChat, initModelSelection, updateModelCardsDisplay, handleProxyAddressChange, handleProxyTest, setupProviderEventListeners, initQuickActionsSettings, renderQuickActionsList } from './settings.js';
import * as QuickActionsManager from './quick-actions-manager.js';
import { initTextSelectionHelperSettings, isTextSelectionHelperEnabled } from './text-selection-helper-settings.js';
import { sendUserMessage as sendUserMessageAction, clearContext as clearContextAction, deleteMessage as deleteMessageAction, regenerateMessage as regenerateMessageAction, abortStreaming as abortStreamingAction, handleRemoveSentTabContext as handleRemoveSentTabContextAction, createWelcomeMessage } from './chat.js';
import {
    switchTab,
    switchSettingsSubTab,
    addMessageToChat,
    updateStreamingMessage as uiUpdateStreamingMessage, // Renamed import
    finalizeBotMessage as uiFinalizeBotMessage,       // Renamed import
    addThinkingAnimation as uiAddThinkingAnimation,     // Renamed import for clarity
    showConnectionStatus,
    updateConnectionIndicator,
    updateContextStatus,
    showToast,
    resizeTextarea,
    setupAutoresizeTextarea,
    updateUIElementsWithTranslations,
    restoreSendButtonAndInput,
    toggleApiKeyVisibility,
    showChatStatusMessage,
    addCopyButtonToCodeBlock,
    addMessageActionButtons,
    showCopyCodeFeedback,
    showCopyMessageFeedback,
    // 新增导入 for Tab Selection and Bar
    showTabSelectionPopupUI,
    closeTabSelectionPopupUI as uiCloseTabSelectionPopupUI, // Alias to avoid naming conflict if any future local var
    updateSelectedTabsBarUI
} from './ui.js';

// --- State Management ---
const state = {
    apiKey: '',
    model: 'gemini-2.5-flash',
    agents: [],
    currentAgentId: null,
    // Settings derived from current agent
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: '', // 改为空值，让模型使用自己的默认值
    topP: 0.95,
    // Other state
    pageContext: null, // Use null initially to indicate not yet extracted
    chatHistory: [],
    isConnected: false,
    hasDeterminedConnection: false, // 新增：是否已判定连接状态，避免初始闪烁
    images: [],
    videos: [],
    darkMode: false,
    language: 'en', // Changed default language to English
    proxyAddress: '', // 代理地址
    isStreaming: false,
    userScrolledUpDuringStream: false, // 新增：跟踪用户在流式传输期间是否已向上滚动
    // userHasSetPreference: false, // Removed
    selectedContextTabs: [], // 新增：存储用户选择的用于上下文的标签页
    availableTabsForSelection: [], // 新增：存储查询到的供用户选择的标签页
    isTabSelectionPopupOpen: false, // 新增：跟踪标签页选择弹窗的状态
    locallyIgnoredTabs: {}, // 新增: 跟踪用户从特定消息上下文中移除的标签页 { messageId: [tabId1, tabId2] }
    quickActionIgnoreAssistant: false, // 新增：快捷操作忽略助手标记
};

// Default settings (used by agent module)
const defaultSettings = {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: '', // 改为空值，让模型使用自己的默认值
    topP: 0.95,
};
// Default agent (used by agent module)
const defaultAgent = {
    id: 'default',
    name: 'Default', // Base name, will be translated on load
    ...defaultSettings
};

// --- DOM Elements ---
const elements = {
    // Main Navigation & Content
    tabs: document.querySelectorAll('.footer-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    // Chat Interface
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendMessage: document.getElementById('send-message'),
    summarizeButton: document.getElementById('summarize-page'), // Note: This might be dynamically added now
    chatModelSelection: document.getElementById('chat-model-selection'),
    chatAgentSelection: document.getElementById('chat-agent-selection'),
    clearContextBtn: document.getElementById('clear-context'),
    closePanelBtnChat: document.getElementById('close-panel'),
    uploadImage: document.getElementById('upload-image'),
    fileInput: document.getElementById('file-input'),
    addYoutubeUrl: document.getElementById('add-youtube-url'),
    imagePreviewContainer: document.getElementById('image-preview-container'),
    imagesGrid: document.getElementById('images-grid'),
    videoPreviewContainer: document.getElementById('video-preview-container'),
    videosGrid: document.getElementById('videos-grid'),
    youtubeUrlDialog: document.getElementById('youtube-url-dialog'),
    youtubeUrlInput: document.getElementById('youtube-url-input'),
    cancelYoutube: document.getElementById('cancel-youtube'),
    confirmYoutube: document.getElementById('confirm-youtube'),
    imageModal: document.getElementById('image-modal'),
    modalImage: document.getElementById('modal-image'),
    closeModal: document.querySelector('.close-modal'),
    mermaidModal: document.getElementById('mermaid-modal'),
    mermaidModalContent: document.getElementById('mermaid-modal-content'),
    mermaidCloseModal: document.querySelector('.mermaid-close-modal'),
    chatStatusMessage: document.getElementById('chat-status-message'),
    // Settings Interface
    settingsSection: document.getElementById('settings'),
    settingsNavBtns: document.querySelectorAll('.settings-nav-btn'),
    settingsSubContents: document.querySelectorAll('.settings-sub-content'),
    closePanelBtnSettings: document.getElementById('close-panel-settings'),
    // Settings - General
    languageSelect: document.getElementById('language-select'),
    proxyAddressInput: document.getElementById('proxy-address-input'),
    testProxyBtn: document.getElementById('test-proxy-btn'),
    themeToggleBtnSettings: document.getElementById('theme-toggle-btn'), // Draggable button
    moonIconSettings: document.getElementById('moon-icon'),
    sunIconSettings: document.getElementById('sun-icon'),
    exportFormatSelect: document.getElementById('export-format'),
    exportChatHistoryBtn: document.getElementById('export-chat-history'),
    // Unified Import/Export
    exportAllSettingsBtn: document.getElementById('export-all-settings'),
    importAllSettingsBtn: document.getElementById('import-all-settings'),
    unifiedImportInput: document.getElementById('unified-import-input'),
    // Settings - Agent
    agentsList: document.getElementById('agents-list'),
    addNewAgent: document.getElementById('add-new-agent'),
    deleteConfirmDialog: document.getElementById('delete-confirm-dialog'),
    deleteAgentNameSpan: document.getElementById('delete-agent-name'), // Span inside prompt
    confirmDelete: document.getElementById('confirm-delete'),
    cancelDelete: document.getElementById('cancel-delete'),
    importAgentsBtn: document.getElementById('import-agents'),
    importAgentInput: document.getElementById('import-agent-input'),
    exportAgentsBtn: document.getElementById('export-agents'),
    // Settings - Model
    apiKey: null, // 多供应商模式下不再使用单一API Key
    modelSelection: document.getElementById('model-selection'),
    selectedModelsContainer: document.getElementById('selected-models-container'),

    connectionStatus: document.getElementById('connection-status'),
    toggleApiKey: null, // 多供应商模式下不再使用单一切换按钮
    apiKeyInput: null, // 多供应商模式下不再使用单一API Key输入框
    // Footer Status Bar
    contextStatus: document.getElementById('context-status'),
    connectionIndicator: document.getElementById('connection-indicator'),
};

// --- Translation ---
let currentTranslations = {}; // Loaded from translations.js
function _(key, replacements = {}) {
    // 优先使用统一 i18n 工具（若可用），并传入当前翻译对象
    if (window.I18n && typeof window.I18n.tr === 'function') {
        return window.I18n.tr(key, replacements, currentTranslations);
    }
    // 回退：使用 main.js 维护的当前翻译对象
    let translation = currentTranslations[key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

// --- Scroll Tracking ---
let isUserNearBottom = true; // This remains the live state
const SCROLL_THRESHOLD = 30; // Increased threshold slightly


// --- Initialization ---
async function init() {
    console.log("Pagetalk Initializing...");

    // Request theme early
    requestThemeFromContentScript();

    // Initialize ModelManager first
    if (window.ModelManager?.instance) {
        try {
            await window.ModelManager.instance.initialize();
            console.log('[main.js] ModelManager initialized successfully');
        } catch (error) {
            console.error('[main.js] Failed to initialize ModelManager:', error);
        }
    } else {
        console.error('[main.js] ModelManager not available');
    }

    // Ensure delete-confirm dialog exists before wiring events
    ensureDeleteConfirmDialogStructure();

    // Load settings (app, agents) - this also loads language and applies initial theme/translations
    loadAppSettings(
        state, elements,
        () => updateConnectionIndicator(state.isConnected, elements, currentTranslations), // Pass updateConnectionIndicator directly
        loadAndApplyTranslations, // Pass translation loader
        (isDark) => applyTheme(isDark, elements) // Pass applyTheme
    );
    loadAgents(
        state,
        () => updateAgentsListUI(state, elements, currentTranslations, autoSaveAgentSettings, showDeleteConfirmDialogUI, switchAgentAndUpdateState), // Pass agent UI update. autoSaveAgentSettings here is the main.js wrapper.
        () => updateAgentSelectionInChat(state, elements, currentTranslations), // Pass chat dropdown update with translations
        () => saveCurrentAgentId(state), // Pass save current ID
        currentTranslations // Pass translations for default agent name
    );

    // Load draggable button position
    loadButtonPosition(elements);
    if (elements.themeToggleBtnSettings) {
        setTimeout(() => {
            makeDraggable(elements.themeToggleBtnSettings, () => toggleThemeAndUpdate(state, elements, rerenderAllMermaidChartsUI)); // Pass toggleTheme callback
        }, 100);
    }

    // Setup core features
    await initModelSelection(state, elements); // Populate model dropdowns (now async)

    // 确保翻译已加载后再初始化划词助手设置和快捷操作设置
    setTimeout(async () => {
        console.log('[main.js] Initializing text selection helper with translations:', currentTranslations);
        await initTextSelectionHelperSettings(elements, currentTranslations, showToastUI); // Initialize text selection helper settings

        console.log('[main.js] Initializing quick actions manager...');
        // 先初始化快捷操作管理器
        await QuickActionsManager.initQuickActionsManager();

        // 设置全局快捷操作相关函数
        setupQuickActionsGlobals();

        console.log('[main.js] Initializing quick actions settings with translations:', currentTranslations);
        await initQuickActionsSettings(elements, currentTranslations); // Initialize quick actions settings

        // 初始化欢迎消息（如果聊天区域为空）
        if (elements.chatMessages && elements.chatMessages.children.length === 0) {
            // 确保快捷操作管理器已经初始化后再创建欢迎消息
            const welcomeMessage = await createWelcomeMessage(currentTranslations);
            elements.chatMessages.appendChild(welcomeMessage);
            console.log('[main.js] Initial welcome message created with quick actions');
        }
    }, 100); // 给翻译加载一些时间
    setupEventListeners(); // Setup all event listeners
    setupImagePaste(elements, (file) => handleImageFile(file, state, updateImagesPreviewUI)); // Setup paste
    setupAutoresizeTextarea(elements); // Setup textarea resize

    // Initial UI updates
    // 避免尚未判定连接状态时显示“未连接”造成闪烁
    if (state.hasDeterminedConnection) {
        updateConnectionIndicator(state.isConnected, elements, currentTranslations);
    }
    updateContextStatus('contextStatusNone', {}, elements, currentTranslations); // Initial context status

    // Request page content after setup
    requestPageContent();

    // Mermaid Initialization (ensure library is loaded)
    if (typeof mermaid !== 'undefined') {
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: state.darkMode ? 'dark' : 'default',
                logLevel: 'error'
            });
            console.log('Mermaid initialized.');
        } catch (error) {
            console.error('Mermaid initialization failed:', error);
        }
    } else {
        console.warn('Mermaid library not found during init.');
    }

    // Set initial visibility for theme button - ensure it's hidden on chat tab
    const initialTab = document.querySelector('.footer-tab.active')?.dataset.tab || 'chat';
    setThemeButtonVisibility(initialTab, elements);

    // Additional safety check to ensure button is hidden on chat tab
    if (initialTab === 'chat' && elements.themeToggleBtnSettings) {
        elements.themeToggleBtnSettings.style.display = 'none';
        elements.themeToggleBtnSettings.style.visibility = 'hidden';
    }

    // Global Exposures for API module callbacks
    // These wrappers ensure that the live `isUserNearBottom` from main.js is used.

    // Wrapper for ui.js's updateStreamingMessage
    window.updateStreamingMessage = (messageElement, content) => {
        // `elements` is live from main.js's scope
        // Determine if scroll should happen based on the new logic
        const shouldScroll = state.isStreaming ? !state.userScrolledUpDuringStream : isUserNearBottom;
        uiUpdateStreamingMessage(messageElement, content, shouldScroll, elements); // Pass the decision
    };

    // Wrapper for ui.js's finalizeBotMessage
    window.finalizeBotMessage = (messageElement, finalContent) => {
        // `elements`, `addCopyButtonToCodeBlockUI`,
        // `addMessageActionButtonsUI`, `restoreSendButtonAndInputUI`
        // are all live from main.js's scope
        const shouldScroll = state.isStreaming ? !state.userScrolledUpDuringStream : isUserNearBottom; // Similar logic for finalize
        uiFinalizeBotMessage(messageElement, finalContent, addCopyButtonToCodeBlockUI, addMessageActionButtonsUI, restoreSendButtonAndInputUI, shouldScroll, elements);
    };

    // 确保在所有初始化完成后，输入框获得焦点
    if (elements.userInput) {
        setTimeout(() => elements.userInput.focus(), 150); // 增加延迟以确保DOM完全准备好
    }

    // Expose the handler on the window object so ui.js can call it
    window.handleRemoveSentTabContext = (messageId, tabId) => {
        handleRemoveSentTabContextAction(messageId, tabId, state);
    };

    // Expose text selection helper functions to global scope
    window.isTextSelectionHelperEnabled = isTextSelectionHelperEnabled;

    // Expose state object to global scope for settings functions
    window.state = state;

    console.log("Pagetalk Initialized.");
}

// --- Event Listener Setup ---
function setupEventListeners() {
    // Footer Tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            // 新增：在切换标签页前关闭标签页选择弹窗
            closeTabSelectionPopupUIFromMain();
            // 调用 ui.js 中的 switchTab (假设 switchTab 是一个可访问的函数，或者这部分逻辑在 main.js 中)
            switchTab(tabId, elements, (subTab) => switchSettingsSubTab(subTab, elements));
            setThemeButtonVisibility(tabId, elements); // Update button visibility on tab switch

            // 额外的安全检查：确保主题按钮在聊天界面被隐藏
            if (tabId === 'chat' && elements.themeToggleBtnSettings) {
                elements.themeToggleBtnSettings.style.display = 'none';
                elements.themeToggleBtnSettings.style.visibility = 'hidden';
            }

            // 新增：如果切换到聊天标签页，则聚焦输入框
            if (tabId === 'chat' && elements.userInput) {
                // 使用 setTimeout 确保在标签页内容完全显示后再聚焦
                setTimeout(() => elements.userInput.focus(), 50);
                // console.log("User input focused on tab switch to chat (from main.js event listener).");
            }
        });
    });

    // Settings Sub-Tabs
    elements.settingsNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchSettingsSubTab(btn.dataset.subtab, elements));
    });

    // Chat Actions
    elements.sendMessage.addEventListener('click', sendUserMessageTrigger); // Initial listener
    elements.userInput.addEventListener('keydown', handleUserInputKeydown);
    // 新增：监听用户输入框的 input 事件，用于检测 "@"
    elements.userInput.addEventListener('input', handleUserInputForTabSelection);
    elements.clearContextBtn.addEventListener('click', async () => {
        await clearContextAction(state, elements, clearImagesUI, clearVideosUI, showToastUI, currentTranslations);
        // Also clear the UI for selected tabs
        state.selectedContextTabs = [];
        updateSelectedTabsBarFromMain();
    });

    elements.chatModelSelection.addEventListener('change', handleChatModelChange);
    elements.chatAgentSelection.addEventListener('change', handleChatAgentChange);

    // 新增：监听由 ui.js 触发的弹窗关闭事件，以同步状态
    document.addEventListener('tabPopupManuallyClosed', () => {
        if (state.isTabSelectionPopupOpen) {
            state.isTabSelectionPopupOpen = false;
            console.log("Tab selection popup closed via custom event, state updated.");
        }
    });

    // Image Handling
    elements.uploadImage.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => handleImageSelect(e, (file) => handleImageFile(file, state, updateImagesPreviewUI), elements));
    elements.closeModal.addEventListener('click', () => hideImageModal(elements));
    window.addEventListener('click', (e) => { if (e.target === elements.imageModal) hideImageModal(elements); }); // Close modal on overlay click

    // YouTube Video Handling
    elements.addYoutubeUrl.addEventListener('click', () => showYouTubeDialog(elements));
    elements.cancelYoutube.addEventListener('click', () => hideYouTubeDialog(elements));
    elements.confirmYoutube.addEventListener('click', () => {
        const url = elements.youtubeUrlInput.value.trim();
        if (url) {
            handleYouTubeUrl(url, state, updateVideosPreviewUI, currentTranslations);
            hideYouTubeDialog(elements);
        }
    });
    elements.youtubeUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.confirmYoutube.click();
        }
    });
    window.addEventListener('click', (e) => { if (e.target === elements.youtubeUrlDialog) hideYouTubeDialog(elements); }); // Close dialog on overlay click

    // Mermaid Modal
    elements.mermaidCloseModal.addEventListener('click', () => hideMermaidModal(elements));
    elements.mermaidModal.addEventListener('click', (e) => { if (e.target === elements.mermaidModal) hideMermaidModal(elements); });

    // Settings Actions
    // Removed discover models button event listener



    // 多供应商模式下，API Key 可见性切换由 setupProviderEventListeners 处理
    // elements.toggleApiKey.addEventListener('click', () => toggleApiKeyVisibility(elements));
    elements.languageSelect.addEventListener('change', () => handleLanguageChange(state, elements, loadAndApplyTranslations, showToastUI, currentTranslations));
    elements.exportChatHistoryBtn.addEventListener('click', () => handleExportChat(state, elements, showToastUI, currentTranslations));

    // Proxy Address Change
    if (elements.proxyAddressInput) {
        elements.proxyAddressInput.addEventListener('blur', () => handleProxyAddressChange(state, elements, showToastUI, currentTranslations));
        elements.proxyAddressInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                elements.proxyAddressInput.blur(); // Trigger blur event to save
            }
        });
    }

    // Proxy Test Button
    if (elements.testProxyBtn) {
        elements.testProxyBtn.addEventListener('click', () => handleProxyTest(state, elements, showToastUI, currentTranslations));
    }

    // Unified Import/Export
    if (elements.exportAllSettingsBtn) {
        elements.exportAllSettingsBtn.addEventListener('click', () => handleUnifiedExport(showToastUI, currentTranslations));
    }
    if (elements.importAllSettingsBtn) {
        elements.importAllSettingsBtn.addEventListener('click', () => {
            elements.unifiedImportInput.click();
        });
    }
    if (elements.unifiedImportInput) {
        elements.unifiedImportInput.addEventListener('change', (e) => handleUnifiedImport(e, showToastUI, currentTranslations));
    }

    // Agent Actions
    elements.addNewAgent.addEventListener('click', () => createNewAgent(state, updateAgentsListUIAllArgs, updateAgentSelectionInChatUI, saveAgentsListState, showToastUI, currentTranslations));
    elements.importAgentsBtn.addEventListener('click', () => elements.importAgentInput.click());
    elements.importAgentInput.addEventListener('change', (e) => handleAgentImport(e, state, saveAgentsListState, updateAgentsListUIAllArgs, updateAgentSelectionInChatUI, saveCurrentAgentIdState, showToastUI, currentTranslations));
    elements.exportAgentsBtn.addEventListener('click', () => handleAgentExport(state, showToastUI, currentTranslations));
    // Re-resolve elements in case dialog was reconstructed
    elements.deleteConfirmDialog = document.getElementById('delete-confirm-dialog');
    elements.confirmDelete = document.getElementById('confirm-delete');
    elements.cancelDelete = document.getElementById('cancel-delete');
    if (elements.cancelDelete) {
        elements.cancelDelete.addEventListener('click', () => { if (elements.deleteConfirmDialog) elements.deleteConfirmDialog.style.display = 'none'; });
    }
    if (elements.confirmDelete) {
        elements.confirmDelete.addEventListener('click', () => confirmDeleteAgent(state, elements, updateAgentsListUIAllArgs, updateAgentSelectionInChatUI, saveAgentsListState, showToastUI, currentTranslations));
    }
    window.addEventListener('click', (e) => { if (e.target === elements.deleteConfirmDialog) elements.deleteConfirmDialog.style.display = 'none'; }); // Close delete confirm on overlay click

    // Panel Closing with smarter Escape handling
    elements.closePanelBtnChat.addEventListener('click', closePanel);
    elements.closePanelBtnSettings.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        // If any modal/popup is open, close that first and do not close the panel
        if (handleGlobalEscapeForModals()) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // No modals open – allow Escape to close the panel
        closePanel();
    });

    // Window Messages (from content script)
    window.addEventListener('message', handleContentScriptMessages);

    // Scroll Tracking
    if (elements.chatMessages) {
        elements.chatMessages.addEventListener('scroll', handleChatScroll);
    }

    // --- 多供应商模式下，API Key 保存逻辑由 setupProviderEventListeners 处理 ---
    // 旧的单一 API Key 自动保存逻辑已移除，现在由各个供应商的输入框独立处理

    // 设置多供应商事件监听器
    setupProviderEventListeners(state, elements, showToastUI, () => updateConnectionIndicator(state.isConnected, elements, currentTranslations));
}



// --- Event Handlers & Triggers ---

function handleUserInputKeydown(e) {
    // Check if the IME is composing text. If so, don't send the message.
    // The `isComposing` property is true during the composition session.
    // Pressing Enter to confirm an IME candidate will not trigger the send action.
    // 检查输入法是否正在输入（拼字）。如果是，则不发送消息。
    // `isComposing` 属性在输入法拼字期间为 true。
    // 按下回车键确认候选词时，不会触发发送操作。
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!state.isStreaming) {
            sendUserMessageTrigger();
        }
    }
    // 如果标签选择弹窗打开，并且按下了 Escape 键，则关闭弹窗
    if (state.isTabSelectionPopupOpen && e.key === 'Escape') {
        e.preventDefault();
        closeTabSelectionPopupUIFromMain();
    }
    // 如果标签选择弹窗打开，并且按下了 Tab 键或箭头键，则阻止默认行为并处理导航
    if (state.isTabSelectionPopupOpen && (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // e.preventDefault(); //  ui.js 中的 handlePopupKeyDown 会处理 preventDefault
        // navigateTabSelectionPopupUI(e.key); // 这个UI函数将在后面步骤定义
    }
}

// 新增：处理用户输入以触发标签页选择
function handleUserInputForTabSelection(e) {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    const atCharIndex = text.lastIndexOf('@', cursorPos - 1);

    // 定义有效的标签页名称匹配字符：字母、数字、下划线、连字符
    const validTabNameCharRegex = /^[a-zA-Z0-9_-]*$/;

    if (atCharIndex !== -1) {
        const textAfterAt = text.substring(atCharIndex + 1, cursorPos);
        const textBeforeAt = text.substring(0, atCharIndex);

        // 检查 @ 符号是否在开头或前面有空格，并且 @ 后面没有空格
        const isValidTrigger = (atCharIndex === 0 || /\s$/.test(textBeforeAt)) && !/\s/.test(textAfterAt);

        if (isValidTrigger) {
            // 如果弹窗未打开，则尝试打开
            if (!state.isTabSelectionPopupOpen) {
                console.log('尝试打开标签页选择列表，触发字符: @');
                fetchAndShowTabsForSelection();
            }
            // 如果弹窗已打开，且 @ 后的内容不再是有效匹配字符，则关闭
            // 或者 @ 后的内容为空，且弹窗已打开，也关闭 (例如用户删除了 @ 后的所有内容)
            if (state.isTabSelectionPopupOpen && !validTabNameCharRegex.test(textAfterAt)) {
                closeTabSelectionPopupUIFromMain();
            }
        } else if (state.isTabSelectionPopupOpen) {
            // 如果 @ 符号不再是有效触发条件（例如 @ 后面有空格），则关闭弹窗
            closeTabSelectionPopupUIFromMain();
        }
    } else if (state.isTabSelectionPopupOpen) {
        // 如果输入框中不再有 @ 符号，且弹窗是打开的，则关闭弹窗
        closeTabSelectionPopupUIFromMain();
    }
}

// 新增：获取并显示标签页以供选择
async function fetchAndShowTabsForSelection() {
    if (state.isStreaming) return; 

    try {
        const tabs = await chrome.tabs.query({});
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTabId = activeTabs && activeTabs.length > 0 ? activeTabs[0].id : null;
        if (tabs && tabs.length > 0) {
            const currentExtensionId = chrome.runtime.id;
            state.availableTabsForSelection = tabs.filter(tab => 
                tab.id && 
                tab.url && 
                !tab.url.startsWith(`chrome-extension://${currentExtensionId}`) &&
                !tab.url.startsWith('chrome://') &&
                !tab.url.startsWith('about:') &&
                !tab.url.startsWith('edge://') &&
                tab.id !== activeTabId // 忽略当前页面，避免冗余
            ).map(tab => ({
                id: tab.id,
                title: tab.title || 'Untitled Tab',
                url: tab.url,
                favIconUrl: tab.favIconUrl || '../magic.png' 
            }));

            if (state.availableTabsForSelection.length > 0) {
                // 调用UI函数显示弹窗（多选） 
                showTabSelectionPopupUI(state.availableTabsForSelection, handleTabsSelectedFromPopup, elements, currentTranslations);
                state.isTabSelectionPopupOpen = true;
            } else {
                state.availableTabsForSelection = [];
                state.isTabSelectionPopupOpen = false;
            }
        } else {
            state.availableTabsForSelection = [];
            state.isTabSelectionPopupOpen = false;
        }
    } catch (error) {
        console.error('Error querying tabs:', error);
        state.availableTabsForSelection = [];
        state.isTabSelectionPopupOpen = false;
        if (showToastUI) showToastUI('获取标签页列表失败', 'error');
    }
}

// 新增：处理从弹窗中选择标签页的回调
function handleTabSelectedFromPopup(selectedTab) {
    if (!selectedTab) {
        // state.isTabSelectionPopupOpen = false; // closeTabSelectionPopupUIFromMain 会处理
        closeTabSelectionPopupUIFromMain(); // <--- Ensure state is updated if no tab selected (e.g. Esc)
        return;
    }

    console.log('Tab selected:', selectedTab);
    // state.isTabSelectionPopupOpen = false; // closeTabSelectionPopupUIFromMain 会处理
    closeTabSelectionPopupUIFromMain(); // <--- MODIFIED HERE (called by ui.js click handler, but ensure state sync)
    
    const currentText = elements.userInput.value;
    const cursorPos = elements.userInput.selectionStart;
    const atCharIndex = currentText.lastIndexOf('@', cursorPos -1);
    if (atCharIndex !== -1) {
        elements.userInput.value = currentText.substring(0, atCharIndex); 
    }
    elements.userInput.focus(); 
    
    const isAlreadySelected = state.selectedContextTabs.some(tab => tab.id === selectedTab.id);
    if (isAlreadySelected) {
        if (showToastUI) showToastUI(`标签页 "${selectedTab.title.substring(0,20)}..." 已添加`, 'info');
        return;
    }

    const newSelectedTabEntry = { 
        id: selectedTab.id, 
        title: selectedTab.title, 
        url: selectedTab.url, 
        favIconUrl: selectedTab.favIconUrl,
        content: null, 
        isLoading: true,
        isContextSent: false
    };
    state.selectedContextTabs.push(newSelectedTabEntry);
    updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations); // <--- MODIFIED HERE (added removeSelectedTabFromMain)

    chrome.runtime.sendMessage({ action: 'extractTabContent', tabId: selectedTab.id }, (response) => {
        const tabData = state.selectedContextTabs.find(t => t.id === selectedTab.id);
        if (tabData) {
            if (response.content && !response.error) {
                tabData.content = response.content;
                tabData.isLoading = false;
                tabData.error = false;
                console.log(`Content for tab ${selectedTab.id} loaded, length: ${response.content?.length}`);
                // 使用自定义类名调用 showToastUI
                showToastUI(_('tabContentLoadedSuccess', { title: tabData.title.substring(0, 20) }), 'success', 'toast-tab-loaded');
            } else {
                tabData.content = null; // 确保错误时内容为空
                tabData.isLoading = false;
                tabData.error = true;
                const errorMessage = response.error || _('unknownErrorLoadingTab', {}, currentTranslations);
                console.error(`Failed to load content for tab ${selectedTab.id}: ${errorMessage}`);
                // 使用自定义类名调用 showToastUI
                showToastUI(_('tabContentLoadFailed', { title: tabData.title.substring(0, 20), error: errorMessage }), 'error', 'toast-tab-loaded');
            }
            updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations); // 更新UI以反映加载/错误状态
        }
    });
}

// 新增：处理从弹窗中多选标签页的回调
function handleTabsSelectedFromPopup(selectedTabs) {
    if (!Array.isArray(selectedTabs) || selectedTabs.length === 0) {
        closeTabSelectionPopupUIFromMain();
        return;
    }

    // 关闭弹窗并同步状态
    closeTabSelectionPopupUIFromMain();

    // 移除输入框中最后一个 '@' 及其后内容
    const currentText = elements.userInput.value;
    const cursorPos = elements.userInput.selectionStart;
    const atCharIndex = currentText.lastIndexOf('@', cursorPos - 1);
    if (atCharIndex !== -1) {
        elements.userInput.value = currentText.substring(0, atCharIndex);
    }
    elements.userInput.focus();

    // 逐个加入到选中列表
    const suppressPerTabSuccessToast = selectedTabs.length > 1; // 多选时仅显示汇总提示，抑制单条成功提示
    let addedCount = 0;
    selectedTabs.forEach((tab) => {
        const isAlreadySelected = state.selectedContextTabs.some(t => t.id === tab.id);
        if (isAlreadySelected) return;

        const newSelectedTabEntry = {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
            content: null,
            isLoading: true,
            isContextSent: false
        };
        state.selectedContextTabs.push(newSelectedTabEntry);
        addedCount++;

        chrome.runtime.sendMessage({ action: 'extractTabContent', tabId: tab.id }, (response) => {
            const tabData = state.selectedContextTabs.find(t => t.id === tab.id);
            if (tabData) {
                if (response && response.content && !response.error) {
                    tabData.content = response.content;
                    tabData.isLoading = false;
                    tabData.error = false;
                    if (!suppressPerTabSuccessToast) {
                        showToastUI(_('tabContentLoadedSuccess', { title: tabData.title.substring(0, 20) }), 'success', 'toast-tab-loaded');
                    }
                } else {
                    tabData.content = null;
                    tabData.isLoading = false;
                    tabData.error = true;
                    const errorMessage = response?.error || _('unknownErrorLoadingTab', {}, currentTranslations);
                    console.error(`Failed to load content for tab ${tab.id}: ${errorMessage}`);
                    showToastUI(_('tabContentLoadFailed', { title: tabData.title.substring(0, 20), error: errorMessage }), 'error', 'toast-tab-loaded');
                }
                updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations);
            }
        });
    });

    // 更新一次选中栏，显示 loading 状态
    if (addedCount > 0) {
        updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations);
        if (showToastUI && addedCount > 1) {
            showToastUI(_('tabsAddedSuccess', { count: addedCount }), 'info', 'toast-tabs-added');
        }
    }
}

// 后续步骤将定义:
// - showTabSelectionPopupUI (在ui.js)
// - closeTabSelectionPopupUI (在ui.js)
// - navigateTabSelectionPopupUI (在ui.js)
// - updateSelectedTabsBarUI (在ui.js)

function handleChatModelChange() {
    state.model = elements.chatModelSelection.value;
    elements.modelSelection.value = state.model; // Sync settings tab

    // 在多供应商模式下，只需要保存模型选择，不需要测试API Key
    chrome.storage.sync.set({ model: state.model }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving model selection:", chrome.runtime.lastError);
            showToastUI(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
        } else {
            console.log(`Model selection saved: ${state.model}`);
        }
    });
}

function handleChatAgentChange() {
    switchAgentAndUpdateState(elements.chatAgentSelection.value);
}

function handleChatScroll() {
    const el = elements.chatMessages;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;

    if (state.isStreaming) {
        if (!atBottom && !state.userScrolledUpDuringStream) {
            // User scrolled up for the first time during this stream
            state.userScrolledUpDuringStream = true;
            console.log("User scrolled up during stream, auto-scroll disabled for this stream.");
        } else if (atBottom && state.userScrolledUpDuringStream) {
            // User scrolled back to bottom, re-enable auto-scroll
            state.userScrolledUpDuringStream = false;
            console.log("User scrolled back to bottom during stream, auto-scroll re-enabled.");
        }
    }
    isUserNearBottom = atBottom; // Keep this for non-streaming contexts or as a general flag
}

// Wrapper function to trigger sendUserMessage with all dependencies
function sendUserMessageTrigger() {
    // 添加发送动效
    if (elements.sendMessage) {
        elements.sendMessage.classList.add('sending');
        // 移除发送动效，让动画完成
        setTimeout(() => {
            if (elements.sendMessage) {
                elements.sendMessage.classList.remove('sending');
            }
        }, 600);
    }
    
    // 准备 sentContextTabs 数据 (只包含必要信息)
    const tabsForMessageBubble = state.selectedContextTabs.map(tab => ({
        title: tab.title,
        favIconUrl: tab.favIconUrl
        // 不传递 tab.content 或 tab.id 到气泡渲染中
    }));

    sendUserMessageAction(
        state, elements, currentTranslations,
        (msg, type) => showConnectionStatus(msg, type, elements), // showConnectionStatusCallback
        (content, sender, options) => { // Modified addMessageToChatCallback wrapper
            let messageOptions = {...options};
            if (sender === 'user' && tabsForMessageBubble.length > 0) {
                // tabsForBubbleDisplay should now include id, title, favIconUrl
                messageOptions.sentContextTabs = tabsForMessageBubble;
            }
            return addMessageToChatUI(content, sender, messageOptions);
        },
        (afterEl) => uiAddThinkingAnimation(afterEl, elements, isUserNearBottom), 
        () => resizeTextarea(elements), 
        clearImagesUI, 
        clearVideosUI, 
        showToastUI, 
        restoreSendButtonAndInputUI, 
        abortStreamingUI,
        updateSelectedTabsBarFromMain
    );
}

// Wrapper function to trigger abortStreaming
function abortStreamingUI() {
    abortStreamingAction(state, restoreSendButtonAndInputUI, showToastUI, currentTranslations);
}

// Wrapper function to restore send button UI
function restoreSendButtonAndInputUI() {
    restoreSendButtonAndInput(state, elements, currentTranslations, sendUserMessageTrigger, abortStreamingUI);
}

// Wrapper function for toggleTheme used by draggable button
function toggleThemeAndUpdate() {
    toggleTheme(state, elements, rerenderAllMermaidChartsUI);
}

// Wrapper function for rerenderAllMermaidCharts
function rerenderAllMermaidChartsUI() {
    rerenderAllMermaidCharts(elements);
}

// Wrapper function for updateAgentsListUI with all args
function updateAgentsListUIAllArgs() {
    updateAgentsListUI(state, elements, currentTranslations, autoSaveAgentSettings, showDeleteConfirmDialogUI, switchAgentAndUpdateState);
}

// Wrapper function for autoSaveAgentSettings in main.js
// This function is passed as a callback when updateAgentsListUI is called.
function autoSaveAgentSettings(agentId, agentItemElement) {
    // Call the aliased imported function from agent.js
    autoSaveAgentSettingsFromAgent(agentId, agentItemElement, state, saveAgentsListState, updateAgentSelectionInChatUI, showToastUI, currentTranslations);
}

// Wrapper function for showDeleteConfirmDialog
function showDeleteConfirmDialogUI(agentId) {
    showDeleteConfirmDialog(agentId, state, elements, currentTranslations);
}

// Wrapper function for switchAgent that also saves ID and updates state
function switchAgentAndUpdateState(agentId) {
    switchAgent(agentId, state, saveCurrentAgentIdState);
    // No need to explicitly call loadCurrentAgentSettingsIntoState here,
    // switchAgent internally calls it.
}

// Wrapper function for updateAgentSelectionInChat
function updateAgentSelectionInChatUI() {
    updateAgentSelectionInChat(state, elements, currentTranslations);
}

// Wrapper function for saveAgentsList
function saveAgentsListState() {
    saveAgentsList(state);
}

// Wrapper function for saveCurrentAgentId
function saveCurrentAgentIdState() {
    saveCurrentAgentId(state);
}

// Wrapper function for addMessageToChat
function addMessageToChatUI(content, sender, options) {
    // 将 isUserNearBottom 的当前值传递给 ui.js 中的 addMessageToChat
    // options 现在可能包含 sentContextTabs
    return addMessageToChat(content, sender, options, state, elements, currentTranslations, addCopyButtonToCodeBlockUI, addMessageActionButtonsUI, isUserNearBottom);
}

// Wrapper function for addCopyButtonToCodeBlock
function addCopyButtonToCodeBlockUI(block) {
    addCopyButtonToCodeBlock(block, currentTranslations, copyCodeToClipboard);
}

// Wrapper function for addMessageActionButtons
function addMessageActionButtonsUI(messageElement, content) {
    addMessageActionButtons(messageElement, content, currentTranslations, copyMessageContent, regenerateMessageUI, deleteMessageUI);
}

// Wrapper function for copyCodeToClipboard (handles feedback)
function copyCodeToClipboard(code, buttonElement) {
    window.parent.postMessage({ action: 'copyText', text: code }, '*');
    showCopyCodeFeedback(buttonElement); // Show UI feedback
}

// Wrapper function for copyMessageContent (handles feedback)
function copyMessageContent(messageElement, originalContent, buttonElement) {
    const formattedContent = originalContent.replace(/\n/g, '\r\n');
    window.parent.postMessage({ action: 'copyText', text: formattedContent }, '*');
    showCopyMessageFeedback(buttonElement); // Show UI feedback
}


// Wrapper function for regenerateMessage
function regenerateMessageUI(messageId) {
    regenerateMessageAction(
        messageId, state, elements, currentTranslations,
        addMessageToChatUI,
        (afterEl) => uiAddThinkingAnimation(afterEl, elements, isUserNearBottom),
        restoreSendButtonAndInputUI,
        abortStreamingUI,
        showToastUI,
        updateSelectedTabsBarFromMain
    );
}

// Wrapper function for deleteMessage
function deleteMessageUI(messageId) {
    deleteMessageAction(messageId, state);
}

// Wrapper function for clearImages
function clearImagesUI() {
    clearImages(state, updateImagesPreviewUI);
}

// Wrapper function for updateImagesPreview
function updateImagesPreviewUI() {
    updateImagesPreview(state, elements, currentTranslations, removeImageByIdUI);
}

// Wrapper function for removeImageById
function removeImageByIdUI(imageId) {
    removeImageById(imageId, state, updateImagesPreviewUI);
}

// Wrapper function for clearVideos
function clearVideosUI() {
    clearVideos(state, updateVideosPreviewUI);
}

// Wrapper function for updateVideosPreview
function updateVideosPreviewUI() {
    updateVideosPreview(state, elements, currentTranslations, removeVideoByIdUI);
}

// Wrapper function for removeVideoById
function removeVideoByIdUI(videoId) {
    removeVideoById(videoId, state, updateVideosPreviewUI);
}

// Wrapper function for showToast
function showToastUI(message, type, customClass = '') {
    showToast(message, type, customClass);
}


// --- Communication with Content Script ---

function handleContentScriptMessages(event) {
    const message = event.data;
    switch (message.action) {
        case 'pageContentExtracted':
            state.pageContext = message.content;
            updateContextStatus('contextStatusChars', { charCount: message.content.length }, elements, currentTranslations);
            if (message.showSuccessMessage) {
                const msgText = _('pageContentExtractedSuccess', {}, currentTranslations);
                showChatStatusMessage(msgText, 'success', elements);
            }
            break;
        case 'pageContentLoaded':
            requestPageContent();
            break;
        case 'copySuccess':
            // Feedback is now handled within the copy functions themselves
            // console.log('Copy successful (message from content script)');
            break;
        case 'panelShownAndFocusInput': // 修改：处理新的 action
            // 首先确保聊天标签页是当前活动的标签页
            // 强制切换到聊天标签页并聚焦输入框
            switchTab('chat', elements, (subTab) => switchSettingsSubTab(subTab, elements)); // 确保聊天标签页被激活
            if (elements.userInput) {
                setTimeout(() => elements.userInput.focus(), 50);
                // console.log("User input focused on panel shown (forced via panelShownAndFocusInput).");
            }
            resizeTextarea(elements); // 保持原有 resize 逻辑
            break;
        case 'panelResized':
            resizeTextarea(elements);
            break;
        case 'webpageThemeDetected':
            console.log(`[main.js] Received webpage theme: ${message.theme}`);
            if (message.theme === 'dark' || message.theme === 'light') {
                const isWebpageDark = message.theme === 'dark';
                console.log(`Applying webpage theme: ${message.theme}`);
                state.darkMode = isWebpageDark;
                applyTheme(isWebpageDark, elements);
                updateMermaidTheme(isWebpageDark, rerenderAllMermaidChartsUI);
            } else {
                console.log(`Ignoring non-explicit webpage theme: ${message.theme}`);
            }
            break;
        case 'languageChanged':
            console.log(`[main.js] Received language change: ${message.newLanguage}`);
            handleLanguageChangeFromContent(message.newLanguage);
            break;
        case 'extensionReloaded':
            console.log(`[main.js] Extension reloaded - reinitializing`);
            handleExtensionReloadFromContent();
            break;
        case 'proxyAutoCleared':
            console.log(`[main.js] Proxy auto-cleared notification:`, message.failedProxy);
            handleProxyAutoClearedFromContent(message.failedProxy);
            break;
        case 'callUnifiedAPIFromBackground':
            console.log(`[main.js] Received API call request from background:`, message.model);
            handleUnifiedAPICallFromBackground(message);
            break;
        case 'modelsUpdated':
            console.log(`[main.js] Models updated - refreshing model selectors`);
            handleModelsUpdatedFromContent();
            break;
    }
}

function requestPageContent() {
    updateContextStatus('contextStatusExtracting', {}, elements, currentTranslations);
    window.parent.postMessage({ action: 'requestPageContent' }, '*');

    // 添加超时机制，如果10秒内没有收到响应，显示失败状态
    setTimeout(() => {
        if (state.pageContext === null) { // 仍然是初始状态，说明没有收到响应
            console.warn('[main.js] Page content extraction timeout');
            state.pageContext = 'error';
            updateContextStatus('contextStatusFailed', {}, elements, currentTranslations);
        }
    }, 10000); // 10秒超时
}

function requestThemeFromContentScript() {
    // 检查是否在iframe中
    if (window.parent !== window) {
        // 在iframe中，检查Chrome API是否可用
        if (!chrome || !chrome.tabs || !chrome.runtime) {
            console.log("[main.js] In iframe context with invalidated extension context, requesting theme via content script message");
            // 通过content script代理请求主题
            window.parent.postMessage({ action: 'requestThemeFromIframe' }, '*');
            return;
        }
    }

    // 检查Chrome API的可用性，避免在失效状态下调用
    if (!chrome || !chrome.tabs || !chrome.runtime) {
        console.log("[main.js] Chrome API not available, applying system theme preference");
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.darkMode = prefersDark;
        applyTheme(state.darkMode, elements);
        updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsUI);
        return;
    }

    try {
        // 如果Chrome API可用，直接使用
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (chrome.runtime.lastError) {
                console.log("[main.js] Chrome API context invalidated, applying system theme preference");
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                state.darkMode = prefersDark;
                applyTheme(state.darkMode, elements);
                updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsUI);
                return;
            }

            if (tabs && tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "requestTheme" }, (response) => {
                    if (chrome.runtime.lastError) {
                        // console.warn("Could not request theme from content script:", chrome.runtime.lastError.message);
                        // Apply default theme based on system preference if request fails
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        console.log("Falling back to system theme preference:", prefersDark ? 'dark' : 'light');
                        state.darkMode = prefersDark;
                        applyTheme(state.darkMode, elements);
                        updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsUI);
                    } else {
                        // Theme will be applied via 'webpageThemeDetected' message handler
                        // console.log("Theme request sent to content script.");
                    }
                });
            } else {
                console.warn("Could not get active tab ID to request theme.");
                // Apply default theme based on system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                state.darkMode = prefersDark;
                applyTheme(state.darkMode, elements);
                updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsUI);
            }
        });
    } catch (e) {
        // 如果在iframe中且Chrome API失效，使用代理方式
        if (window.parent !== window) {
            console.log("[main.js] Chrome API failed in iframe, using content script proxy");
            window.parent.postMessage({ action: 'requestThemeFromIframe' }, '*');
        } else {
            console.log("[main.js] Error requesting theme, applying system theme preference");
            // Apply default theme based on system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            state.darkMode = prefersDark;
            applyTheme(state.darkMode, elements);
            updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsUI);
        }
    }
}

function closePanel() {
    window.parent.postMessage({ action: 'closePanel' }, '*');
}

/**
 * 处理来自background的API调用转发请求
 */
async function handleUnifiedAPICallFromBackground(message) {
    try {
        const { model, messages, options } = message;
        console.log('[main.js] Handling unified API call from background for model:', model);

        // 检查统一API接口是否可用
        if (!window.ModelManager?.instance || !window.PageTalkAPI?.callApi) {
            throw new Error(_('unifiedApiNotAvailable', {}, currentTranslations));
        }

        // 确保ModelManager已初始化
        await window.ModelManager.instance.initialize();

        let accumulatedText = '';

        // 流式回调函数
        const streamCallback = (chunk, complete) => {
            accumulatedText += chunk;
            // 对于划词助手，我们不需要实时流式更新，只需要最终结果
        };

        // 调用统一API接口
        await window.PageTalkAPI.callApi(model, messages, streamCallback, options);

        // 发送成功响应
        window.parent.postMessage({
            action: 'unifiedAPIResponse',
            success: true,
            response: accumulatedText
        }, '*');

    } catch (error) {
        console.error('[main.js] Error handling unified API call from background:', error);

        // 发送错误响应
        window.parent.postMessage({
            action: 'unifiedAPIResponse',
            success: false,
            error: error.message
        }, '*');
    }
}

/**
 * 处理来自content script的模型更新通知
 */
async function handleModelsUpdatedFromContent() {
    console.log(`[main.js] Handling models updated from content`);

    try {
        // 重新初始化模型选择器
        await initModelSelection(state, elements);
        console.log(`[main.js] Model selectors refreshed successfully`);
    } catch (error) {
        console.error(`[main.js] Error refreshing model selectors:`, error);
    }
}

/**
 * 处理来自content script的语言变化通知
 */
async function handleLanguageChangeFromContent(newLanguage) {
    console.log(`[main.js] Handling language change from content: ${newLanguage}`);

    // 更新状态
    state.language = newLanguage;

    // 重新加载并应用翻译
    await loadAndApplyTranslations(newLanguage);

    // 重新初始化划词助手设置（如果设置页面打开）
    if (window.initTextSelectionHelperSettings && elements.textSelectionHelperSettings) {
        const settingsContainer = elements.textSelectionHelperSettings;
        if (settingsContainer && settingsContainer.style.display !== 'none') {
            console.log('[main.js] Reinitializing text selection helper settings for language change');
            const translations = window.translations && window.translations[newLanguage] ? window.translations[newLanguage] : {};
            window.initTextSelectionHelperSettings(elements, translations, showToastUI);
        }
    }
}

/**
 * 处理来自content script的扩展重载通知
 */
async function handleExtensionReloadFromContent() {
    console.log(`[main.js] Handling extension reload from content`);

    // 扩展重载后，content script会自动重新检测主题，所以这里不需要主动请求
    // 只在必要时才请求主题（比如用户手动触发）
    console.log('[main.js] Extension reloaded, theme will be auto-detected by content script');

    // 重新加载当前语言的翻译
    if (state.language) {
        await loadAndApplyTranslations(state.language);
    }

    // 重新初始化所有设置
    if (window.initTextSelectionHelperSettings && elements.textSelectionHelperSettings) {
        console.log('[main.js] Reinitializing text selection helper settings after extension reload');
        const translations = window.translations && window.translations[state.language] ? window.translations[state.language] : {};
        window.initTextSelectionHelperSettings(elements, translations, showToastUI);
    }
}

/**
 * 处理代理自动清除通知
 */
function handleProxyAutoClearedFromContent(failedProxy) {
    console.log('[main.js] Handling proxy auto-cleared notification for:', failedProxy);

    // 更新UI中的代理地址输入框
    if (elements.proxyAddressInput) {
        elements.proxyAddressInput.value = '';
    }

    // 更新状态
    state.proxyAddress = '';

    // 显示通知给用户
    const message = _('proxyConnectionFailed', { proxy: failedProxy }, currentTranslations);
    if (showToastUI) {
        showToastUI(message, 'warning', 'toast-proxy-cleared');
    }

    console.log('[main.js] Proxy settings cleared due to connection failure');
}

// --- Translation Loading ---
async function loadAndApplyTranslations(language) {
    if (typeof window.translations === 'undefined') {
        console.error(_('translationsNotFound', {}, currentTranslations));
        return;
    }
    currentTranslations = window.translations[language] || window.translations['en']; // Fallback to English
    state.language = language; // Ensure state is updated
    console.log(`Applying translations for: ${language}`);
    updateUIElementsWithTranslations(currentTranslations); // Update static UI text

    // Update dynamic parts that depend on translations
    updateAgentsListUIAllArgs(); // Re-render agent list with translated labels/placeholders
    updateAgentSelectionInChatUI(); // Ensure chat agent selection is updated with translations
    // 仅当已判定连接状态后才渲染连接状态文案
    if (state.hasDeterminedConnection) {
        updateConnectionIndicator(state.isConnected, elements, currentTranslations);
    }

    // 更新默认快捷操作的翻译
    try {
        await QuickActionsManager.updateDefaultActionsTranslations();
    } catch (error) {
        console.warn('[main.js] Error updating default quick actions translations:', error);
    }

    // 重新渲染快捷操作列表以更新翻译
    try {
        await renderQuickActionsList(currentTranslations);
    } catch (error) {
        console.warn('[main.js] Error updating quick actions list translations:', error);
    }

    // 广播语言变化事件给动态创建的UI组件（如自定义选项对话框）
    try {
        const languageChangeEvent = new CustomEvent('pagetalk:languageChanged', {
            detail: { newLanguage: language }
        });
        document.dispatchEvent(languageChangeEvent);
        console.log(`[main.js] Language change event dispatched for: ${language}`);
    } catch (error) {
        console.warn('[main.js] Error dispatching language change event:', error);
    }
    // Update context status based on current state.pageContext
    let contextKey = 'contextStatusNone';
    let contextReplacements = {};
    if (state.pageContext === null) contextKey = 'contextStatusExtracting';
    else if (state.pageContext === 'error') contextKey = 'contextStatusFailed';
    else if (state.pageContext) {
        contextKey = 'contextStatusChars';
        contextReplacements = { charCount: state.pageContext.length };
    }
    updateContextStatus(contextKey, contextReplacements, elements, currentTranslations);

    // Re-render welcome message if chat is empty
    if (elements.chatMessages && elements.chatMessages.children.length === 1 && elements.chatMessages.firstElementChild.classList.contains('welcome-message')) {
        // 只有在快捷操作管理器已经初始化的情况下才刷新欢迎消息
        if (window.QuickActionsManager && window.QuickActionsManager.isQuickActionsManagerInitialized && window.QuickActionsManager.isQuickActionsManagerInitialized()) {
            await refreshWelcomeMessageQuickActions();
        } else {
            console.log('[main.js] Skipping welcome message refresh - QuickActionsManager not yet initialized');
        }
    } else {
        // Update existing welcome message if present
        const welcomeHeading = elements.chatMessages.querySelector('.welcome-message h2');
        if (welcomeHeading) welcomeHeading.textContent = _('welcomeHeading');
        // 注意：不再更新快捷操作按钮的文本，因为它们现在是动态的
        // 如果需要更新快捷操作，应该使用 refreshWelcomeMessageQuickActions()
        // Also update existing message action button titles
        document.querySelectorAll('.message-action-btn, .copy-button').forEach(btn => {
            if (btn.classList.contains('copy-button')) btn.title = _('copyAll');
            else if (btn.classList.contains('regenerate-btn')) btn.title = _('regenerate');
            else if (btn.classList.contains('delete-btn')) btn.title = _('deleteMessage');
        });
        document.querySelectorAll('.code-copy-button').forEach(btn => btn.title = _('copyCode'));
    }


    // Sync Day.js locale
    if (typeof dayjs !== 'undefined') {
        dayjs.locale(language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en');
        console.log(`Day.js locale set to: ${dayjs.locale()}`);
    } else {
        console.warn('Day.js not loaded, cannot set locale.');
    }
}

// --- Global Access (if needed for dynamic buttons, etc.) ---
// Expose functions needed by dynamically created elements if necessary
window.sendUserMessageTrigger = sendUserMessageTrigger;
window.addCopyButtonToCodeBlock = addCopyButtonToCodeBlockUI; // Expose wrappers if needed elsewhere
window.addMessageActionButtons = addMessageActionButtonsUI;
// window.updateStreamingMessage and window.finalizeBotMessage are set in init()
window.showToast = showToastUI; // Expose toast globally if needed
window.showToastUI = showToastUI; // Also expose as showToastUI for consistency

// 假设这是在"首次操作"完成，并且聊天消息等已添加到DOM之后
function onFirstOperationComplete() {
    // ... 其他逻辑 ...

    // 尝试强制重绘/回流聊天头部来修正选择框位置
    const chatHeader = elements.chatMessages.previousElementSibling; // 假设 .chat-header 就在 .chat-messages 前面
    if (chatHeader && chatHeader.classList.contains('chat-header')) {
        // 一种轻微强制回流的方法
        chatHeader.style.display = 'none';
        void chatHeader.offsetHeight; // 读取 offsetHeight 会强制浏览器回流
        chatHeader.style.display = 'flex'; // 恢复原状
    }
    // 或者，如果确认 resizeTextarea 能解决且无明显副作用，也可以调用它
    // if (elements.userInput) {
    //     resizeTextarea(elements);
    // }
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', init);

// 新增包装函数，用于从 main.js 中关闭弹窗并更新状态
function closeTabSelectionPopupUIFromMain() {
    if (state.isTabSelectionPopupOpen) { // 只有在弹窗确实打开时才操作
        uiCloseTabSelectionPopupUI(); // 调用从 ui.js 导入的函数来移除DOM
        state.isTabSelectionPopupOpen = false;
        console.log("Tab selection popup closed from main.js, state updated.");
    }
}

// New: Handle Escape priority for modals/popups before closing the panel
function handleGlobalEscapeForModals() {
    try {
        // 0) Agent delete confirm dialog (sidepanel built-in)
        const deleteConfirmOverlay = document.getElementById('delete-confirm-dialog');
        if (deleteConfirmOverlay && getComputedStyle(deleteConfirmOverlay).display !== 'none') {
            deleteConfirmOverlay.style.display = 'none';
            return true;
        }
        // 1) Tab selection popup inside chat
        const tabPopup = document.getElementById('tab-selection-popup');
        if (tabPopup) {
            closeTabSelectionPopupUIFromMain();
            return true;
        }

        // 2) Custom provider modal
        const customProviderModal = document.getElementById('custom-provider-modal');
        if (customProviderModal && customProviderModal.classList.contains('show')) {
            customProviderModal.classList.remove('show');
            return true;
        }

        // 3) Model discovery dialog
        const modelDialog = document.querySelector('.model-discovery-dialog');
        if (modelDialog) {
            const closeBtn = modelDialog.querySelector('.close-btn');
            if (closeBtn) closeBtn.click(); else modelDialog.remove();
            return true;
        }

        // 4) Custom option edit dialog (Selection Helper Settings)
        const customOptionDialog = document.querySelector('.custom-option-dialog-overlay');
        if (customOptionDialog) {
            const closeBtn = customOptionDialog.querySelector('.custom-option-dialog-close');
            if (closeBtn) closeBtn.click(); else customOptionDialog.remove();
            return true;
        }

        // 5) Delete/Import conflict overlays in Selection Helper Settings
        const deleteDialog = document.getElementById('delete-custom-option-dialog');
        if (deleteDialog) {
            const cancelBtn = deleteDialog.querySelector('.dialog-cancel');
            if (cancelBtn) cancelBtn.click(); else deleteDialog.remove();
            return true;
        }
        const importConflictDialog = document.getElementById('import-conflict-dialog');
        if (importConflictDialog) {
            const cancelBtn = importConflictDialog.querySelector('.dialog-cancel');
            if (cancelBtn) cancelBtn.click(); else importConflictDialog.remove();
            return true;
        }

        // 6) Generic overlays created in settings (e.g., import/export confirms)
        const overlays = Array.from(document.querySelectorAll('body > .dialog-overlay'));
        if (overlays.length > 0) {
            const topOverlay = overlays[overlays.length - 1];
            // Try common cancel/close selectors across the project
            const cancelBtn = topOverlay.querySelector('.dialog-cancel, .cancel-btn, .close-btn');
            if (topOverlay.id === 'delete-confirm-dialog') {
                topOverlay.style.display = 'none';
            } else if (cancelBtn) {
                cancelBtn.click();
            } else {
                // Fallback: hide instead of removing to avoid breaking cached references
                topOverlay.style.display = 'none';
            }
            return true;
        }

        // 7) Image preview modal
        if (elements.imageModal && getComputedStyle(elements.imageModal).display !== 'none') {
            hideImageModal(elements);
            return true;
        }

        // 8) Mermaid preview modal
        if (elements.mermaidModal && getComputedStyle(elements.mermaidModal).display !== 'none') {
            hideMermaidModal(elements);
            return true;
        }

        return false;
    } catch (err) {
        console.warn('[main.js] handleGlobalEscapeForModals error:', err);
        return false;
    }
}

// Ensure the delete-confirm dialog exists and has the expected structure
function ensureDeleteConfirmDialogStructure() {
    const existing = document.getElementById('delete-confirm-dialog');
    if (existing) return;
    // Build a minimal dialog compatible with our event wiring
    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-dialog';
    overlay.className = 'dialog-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class="dialog-content">
            <h3>${(window.I18n?.tr && window.I18n.tr('deleteConfirmHeading', {}, {})) || '确认删除'}</h3>
            <p>${(window.I18n?.tr && window.I18n.tr('deleteConfirmPrompt', { agentName: '<strong></strong>' }, {})) || '您确定要删除助手吗？此操作无法撤销。'}</p>
            <div class="dialog-actions">
                <button id="cancel-delete" class="cancel-btn">${(window.I18n?.tr && window.I18n.tr('cancel', {}, {})) || '取消'}</button>
                <button id="confirm-delete" class="delete-btn" style="background-color: var(--error-color); color: white;">${(window.I18n?.tr && window.I18n.tr('delete', {}, {})) || '删除'}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// 新增：移除选中的上下文标签页
function removeSelectedTabFromMain(tabId) {
    state.selectedContextTabs = state.selectedContextTabs.filter(tab => tab.id !== tabId);
    // 调用 ui.js 中的函数更新UI (确保此函数接受正确的参数)
    updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations);
    console.log(`Selected context tab ${tabId} removed. Remaining:`, state.selectedContextTabs.length);
}

// 新增：用于更新已选标签栏UI的回调函数
function updateSelectedTabsBarFromMain() {
    updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations);
}

// === 快捷操作相关函数 ===

/**
 * 设置快捷操作相关的全局函数
 */
function setupQuickActionsGlobals() {
    // 设置全局快捷操作管理器引用
    window.QuickActionsManager = QuickActionsManager;

    // 设置快捷操作触发函数
    window.triggerQuickAction = triggerQuickAction;

    console.log('[main.js] Quick actions globals set up');
}

/**
 * 触发快捷操作
 * @param {string} actionId - 快捷操作ID
 * @param {string} prompt - 快捷操作的提示词
 * @param {boolean} ignoreAssistant - 是否忽略助手设置
 */
async function triggerQuickAction(actionId, prompt, ignoreAssistant) {
    console.log(`[main.js] Triggering quick action: ${actionId}, ignoreAssistant: ${ignoreAssistant}`);

    if (!prompt || !prompt.trim()) {
        console.warn('[main.js] Quick action prompt is empty');
        return;
    }

    // 检查是否正在流式传输
    if (state.isStreaming) {
        console.warn('[main.js] Cannot trigger quick action while streaming');
        if (showToastUI) {
            showToastUI(_('streamingInProgress', {}, currentTranslations), 'warning');
        }
        return;
    }

    // 检查API连接
    let hasValidApiKey = false;
    if (window.ModelManager?.instance) {
        try {
            await window.ModelManager.instance.initialize();
            const modelConfig = window.ModelManager.instance.getModelApiConfig(state.model);
            const providerId = modelConfig.providerId;
            hasValidApiKey = window.ModelManager.instance.isProviderConfigured(providerId);
        } catch (error) {
            console.warn('[main.js] Failed to check provider configuration:', error);
        }
    }

    if (!hasValidApiKey) {
        if (showToastUI) {
            showToastUI(_('apiKeyMissingError', {}, currentTranslations), 'error');
        }
        return;
    }

    // 设置输入框内容
    elements.userInput.value = prompt.trim();
    elements.userInput.focus();

    // 如果需要忽略助手，设置全局标记
    if (ignoreAssistant) {
        state.quickActionIgnoreAssistant = true;
        console.log('[main.js] Set quick action ignore assistant flag');
    }

    try {
        // 触发发送消息
        sendUserMessageTrigger();

        console.log(`[main.js] Quick action "${actionId}" executed successfully`);
    } catch (error) {
        console.error('[main.js] Error executing quick action:', error);
        if (showToastUI) {
            showToastUI(_('quickActionError', { error: error.message }, currentTranslations) || '快捷操作执行失败', 'error');
        }
    } finally {
        // 清除标记
        if (ignoreAssistant) {
            // 延迟清除标记，确保API调用已经完成
            setTimeout(() => {
                state.quickActionIgnoreAssistant = false;
                console.log('[main.js] Cleared quick action ignore assistant flag');
            }, 2000);
        }
    }
}

/**
 * 刷新欢迎消息中的快捷操作
 */
async function refreshWelcomeMessageQuickActions() {
    const welcomeMessage = elements.chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        // 确保快捷操作管理器可用
        if (!window.QuickActionsManager) {
            console.warn('[main.js] QuickActionsManager not available, skipping welcome message refresh');
            return;
        }

        const newWelcomeMessage = await createWelcomeMessage(currentTranslations);
        welcomeMessage.replaceWith(newWelcomeMessage);
        console.log('[main.js] Welcome message quick actions refreshed');
    }
}

// 导出刷新函数供设置界面使用
window.refreshWelcomeMessageQuickActions = refreshWelcomeMessageQuickActions;

// --- 统一导入导出功能 ---

/**
 * 处理统一导出功能
 * @param {function} showToastUI - Toast显示函数
 * @param {object} currentTranslations - 当前翻译对象
 */
async function handleUnifiedExport(showToastUI, currentTranslations) {
    try {
        console.log('[main.js] Starting unified export...');

        // 收集所有需要导出的数据
        const exportData = await collectAllSettingsData();

        // 生成文件名
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `pagetalk_all_settings_${timestamp}.json`;

        // 创建并下载文件
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const message = currentTranslations?.unifiedExportSuccess || '所有设置已导出';
        showToastUI(message, 'success');
        console.log('[main.js] Unified export completed successfully');

    } catch (error) {
        console.error('[main.js] Unified export failed:', error);
        const message = currentTranslations?.unifiedExportError || '导出设置时出错: {error}';
        showToastUI(message.replace('{error}', error.message), 'error');
    }
}

/**
 * 处理统一导入功能
 * @param {Event} event - 文件选择事件
 * @param {function} showToastUI - Toast显示函数
 * @param {object} currentTranslations - 当前翻译对象
 */
async function handleUnifiedImport(event, showToastUI, currentTranslations) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            console.log('[main.js] Starting unified import...');

            // 解析JSON数据
            const importData = JSON.parse(e.target.result);

            // 验证数据格式
            if (!validateImportData(importData)) {
                throw new Error('Invalid file format');
            }

            // 用户确认
            const confirmMessage = currentTranslations?.unifiedImportConfirm ||
                '这将覆盖您所有的当前设置，操作无法撤销。是否继续？';

            if (!window.confirm(confirmMessage)) {
                return;
            }

            // 执行导入
            await importAllSettingsData(importData);

            // 显示成功消息
            const successMessage = currentTranslations?.unifiedImportSuccess ||
                '设置导入成功！界面将自动刷新以应用新设置。';
            showToastUI(successMessage, 'success');

            // 延迟刷新界面
            setTimeout(() => {
                window.location.reload();
            }, 2000);

            console.log('[main.js] Unified import completed successfully');

        } catch (error) {
            console.error('[main.js] Unified import failed:', error);
            const message = currentTranslations?.unifiedImportError || '导入失败：{error}';
            showToastUI(message.replace('{error}', error.message), 'error');
        }
    };

    reader.readAsText(file);

    // 清空文件输入，允许重复选择同一文件
    event.target.value = '';
}

/**
 * 收集所有设置数据
 * @returns {Promise<Object>} 包含所有设置的对象
 */
async function collectAllSettingsData() {
    return new Promise((resolve) => {
        // 从sync存储获取数据
        chrome.storage.sync.get(null, (syncResult) => {
            if (chrome.runtime.lastError) {
                console.error('[main.js] Error reading from sync storage:', chrome.runtime.lastError);
                syncResult = {};
            }

            // 从local存储获取数据
            chrome.storage.local.get(null, (localResult) => {
                if (chrome.runtime.lastError) {
                    console.error('[main.js] Error reading from local storage:', chrome.runtime.lastError);
                    localResult = {};
                }

                // 构建导出数据结构
                const exportData = {
                    app: 'PageTalk',
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    settings: {
                        sync: {
                            // 助手配置
                            agents: syncResult.agents || [],
                            currentAgentId: syncResult.currentAgentId || null,
                            // 供应商设置（API Keys等）
                            providerSettings: syncResult.providerSettings || {},
                            // 模型管理器相关
                            managedModels: syncResult.managedModels || [],
                            userActiveModels: syncResult.userActiveModels || [],
                            modelManagerVersion: syncResult.modelManagerVersion || null,
                            // 通用设置
                            language: syncResult.language || 'zh-CN',
                            proxyAddress: syncResult.proxyAddress || '',
                            model: syncResult.model || null,
                            // 自定义供应商
                            customProviders: syncResult.customProviders || []
                        },
                        local: {
                            // 划词助手设置
                            textSelectionHelperSettings: localResult.textSelectionHelperSettings || {},
                            textSelectionHelperSettingsVersion: localResult.textSelectionHelperSettingsVersion || null,
                            // 快捷操作
                            quickActions: localResult.quickActions || { actions: [] }
                        }
                    }
                };

                console.log('[main.js] Collected settings data:', exportData);
                resolve(exportData);
            });
        });
    });
}

/**
 * 验证导入数据格式
 * @param {Object} importData - 导入的数据
 * @returns {boolean} 是否有效
 */
function validateImportData(importData) {
    // 检查基本结构
    if (!importData || typeof importData !== 'object') {
        return false;
    }

    // 检查必要字段
    if (!importData.settings || typeof importData.settings !== 'object') {
        return false;
    }

    // 检查sync和local字段
    if (!importData.settings.sync || typeof importData.settings.sync !== 'object') {
        return false;
    }

    if (!importData.settings.local || typeof importData.settings.local !== 'object') {
        return false;
    }

    console.log('[main.js] Import data validation passed');
    return true;
}

/**
 * 导入所有设置数据
 * @param {Object} importData - 导入的数据
 * @returns {Promise<void>}
 */
async function importAllSettingsData(importData) {
    return new Promise((resolve, reject) => {
        // 导入sync数据
        chrome.storage.sync.set(importData.settings.sync, () => {
            if (chrome.runtime.lastError) {
                console.error('[main.js] Error saving to sync storage:', chrome.runtime.lastError);
                reject(new Error('Failed to save sync settings'));
                return;
            }

            // 导入local数据
            chrome.storage.local.set(importData.settings.local, () => {
                if (chrome.runtime.lastError) {
                    console.error('[main.js] Error saving to local storage:', chrome.runtime.lastError);
                    reject(new Error('Failed to save local settings'));
                    return;
                }

                console.log('[main.js] All settings imported successfully');
                resolve();
            });
        });
    });
}
