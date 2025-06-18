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
import { loadSettings as loadAppSettings, saveModelSettings, handleLanguageChange, handleExportChat, initModelSelection, handleProxyAddressChange, handleProxyTest } from './settings.js';
import { initTextSelectionHelperSettings, isTextSelectionHelperEnabled } from './text-selection-helper-settings.js';
import { sendUserMessage as sendUserMessageAction, clearContext as clearContextAction, deleteMessage as deleteMessageAction, regenerateMessage as regenerateMessageAction, abortStreaming as abortStreamingAction, handleRemoveSentTabContext as handleRemoveSentTabContextAction } from './chat.js';
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
    maxTokens: 65536,
    topP: 0.95,
    // Other state
    pageContext: null, // Use null initially to indicate not yet extracted
    chatHistory: [],
    isConnected: false,
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
    ui: {}, // Add ui object to state for functions like showToast
    currentModalSelection: [], // For model fetch dialog
    currentTranslations: {} // To store loaded translations
};

// Default settings (used by agent module)
const defaultSettings = {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 65536,
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
    apiKey: document.getElementById('api-key'),
    modelSelection: document.getElementById('model-selection'),
    saveModelSettings: document.getElementById('save-model-settings'),
    connectionStatus: document.getElementById('connection-status'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    apiKeyInput: document.getElementById('api-key'), // Alias
    fetchModelsBtn: document.getElementById('fetch-models-btn'),
    selectedModelsContainer: document.getElementById('selected-models-container'),
    // Footer Status Bar
    contextStatus: document.getElementById('context-status'),
    connectionIndicator: document.getElementById('connection-indicator'),
};

// --- Translation ---
let currentTranslations = {}; // Loaded from translations.js
function _(key, replacements = {}) {
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
    // console.log("Pagetalk Initializing...");

    // Request theme early
    requestThemeFromContentScript();

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
    initModelSelection(state, elements); // Populate model dropdowns

    // 确保翻译已加载后再初始化划词助手设置
    setTimeout(async () => {
        // console.log('[main.js] Initializing text selection helper with translations:', currentTranslations);
        await initTextSelectionHelperSettings(elements, currentTranslations); // Initialize text selection helper settings
    }, 100); // 给翻译加载一些时间
    setupEventListeners(); // Setup all event listeners
    setupImagePaste(elements, (file) => handleImageFile(file, state, updateImagesPreviewUI)); // Setup paste
    setupAutoresizeTextarea(elements); // Setup textarea resize

    // Initial UI updates
    updateConnectionIndicator(state.isConnected, elements, currentTranslations); // Update footer connection status
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
            // console.log('Mermaid initialized.');
        } catch (error) {
            console.error('Mermaid initialization failed:', error);
        }
    } else {
        console.warn('Mermaid library not found during init.');
    }

    // Set initial visibility for theme button
    const initialTab = document.querySelector('.footer-tab.active')?.dataset.tab || 'chat';
    setThemeButtonVisibility(initialTab, elements);

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

    // console.log("Pagetalk Initialized.");
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
    elements.clearContextBtn.addEventListener('click', () => {
        clearContextAction(state, elements, clearImagesUI, clearVideosUI, showToastUI, currentTranslations);
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
            // console.log("Tab selection popup closed via custom event, state updated.");
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
    elements.saveModelSettings.addEventListener('click', () => saveModelSettings(true, state, elements, (msg, type) => showConnectionStatus(msg, type, elements), showToastUI, () => updateConnectionIndicator(state.isConnected, elements, currentTranslations), currentTranslations));
    elements.toggleApiKey.addEventListener('click', () => toggleApiKeyVisibility(elements));
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

    // Agent Actions
    elements.addNewAgent.addEventListener('click', () => createNewAgent(state, updateAgentsListUIAllArgs, updateAgentSelectionInChatUI, saveAgentsListState, showToastUI, currentTranslations));
    elements.importAgentsBtn.addEventListener('click', () => elements.importAgentInput.click());
    elements.importAgentInput.addEventListener('change', (e) => handleAgentImport(e, state, saveAgentsListState, updateAgentsListUIAllArgs, updateAgentSelectionInChatUI, saveCurrentAgentIdState, showToastUI, currentTranslations));
    elements.exportAgentsBtn.addEventListener('click', () => handleAgentExport(state, showToastUI, currentTranslations));
    elements.cancelDelete.addEventListener('click', () => { if (elements.deleteConfirmDialog) elements.deleteConfirmDialog.style.display = 'none'; });
    elements.confirmDelete.addEventListener('click', () => confirmDeleteAgent(state, elements, updateAgentsListUIAllArgs, updateAgentSelectionInChatUI, saveAgentsListState, showToastUI, currentTranslations));
    window.addEventListener('click', (e) => { if (e.target === elements.deleteConfirmDialog) elements.deleteConfirmDialog.style.display = 'none'; }); // Close delete confirm on overlay click

    // Panel Closing
    elements.closePanelBtnChat.addEventListener('click', closePanel);
    elements.closePanelBtnSettings.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

    // Window Messages (from content script)
    window.addEventListener('message', handleContentScriptMessages);

    // Scroll Tracking
    if (elements.chatMessages) {
        elements.chatMessages.addEventListener('scroll', handleChatScroll);
    }

    // Settings - Model Fetching
    if (elements.fetchModelsBtn) {
        elements.fetchModelsBtn.addEventListener('click', () => {
            // console.log('Fetch models button clicked in main.js');
            if (window.Settings && typeof window.Settings.handleFetchModelsClick === 'function') {
                // Ensure state.ui.showToast is available for handleFetchModelsClick
                if (!state.ui.showToast) {
                    state.ui.showToast = showToastUI; // Populate it if not already
                }
                window.Settings.handleFetchModelsClick(elements, state); // Pass elements and state
            } else {
                 showToastUI(_('notImplementedYet', {}, state.currentTranslations), 'info');
            }
        });
    }
}

// --- 修复：API 密钥输入框清空时同步删除缓存 ---
if (elements.apiKey) {
    elements.apiKey.addEventListener('input', () => {
        if (elements.apiKey.value.trim() === '') {
            chrome.storage.sync.remove('apiKey', () => {
                state.apiKey = '';
            });
        }
    });
}

// --- Event Handlers & Triggers ---

function handleUserInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
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
                // console.log('尝试打开标签页选择列表，触发字符: @');
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
        if (tabs && tabs.length > 0) {
            const currentExtensionId = chrome.runtime.id;
            state.availableTabsForSelection = tabs.filter(tab => 
                tab.id && 
                tab.url && 
                !tab.url.startsWith(`chrome-extension://${currentExtensionId}`) &&
                !tab.url.startsWith('chrome://') &&
                !tab.url.startsWith('about:') &&
                !tab.url.startsWith('edge://')
            ).map(tab => ({
                id: tab.id,
                title: tab.title || 'Untitled Tab',
                url: tab.url,
                favIconUrl: tab.favIconUrl || '../magic.png' 
            }));

            if (state.availableTabsForSelection.length > 0) {
                // 调用UI函数显示弹窗 
                showTabSelectionPopupUI(state.availableTabsForSelection, handleTabSelectedFromPopup, elements, currentTranslations);
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

    // console.log('Tab selected:', selectedTab);
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
                // console.log(`Content for tab ${selectedTab.id} loaded, length: ${response.content?.length}`);
                // 使用自定义类名调用 showToastUI
                showToastUI(_('tabContentLoadedSuccess', { title: tabData.title.substring(0, 20) }), 'success', 'toast-tab-loaded');
            } else {
                tabData.content = null; // 确保错误时内容为空
                tabData.isLoading = false;
                tabData.error = true;
                const errorMessage = response.error || 'Unknown error loading tab';
                console.error(`Failed to load content for tab ${selectedTab.id}: ${errorMessage}`);
                // 使用自定义类名调用 showToastUI
                showToastUI(_('tabContentLoadFailed', { title: tabData.title.substring(0, 20), error: errorMessage }), 'error', 'toast-tab-loaded');
            }
            updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations); // 更新UI以反映加载/错误状态
        }
    });
}

// 后续步骤将定义:
// - showTabSelectionPopupUI (在ui.js)
// - closeTabSelectionPopupUI (在ui.js)
// - navigateTabSelectionPopupUI (在ui.js)
// - updateSelectedTabsBarUI (在ui.js)

function handleChatModelChange() {
    state.model = elements.chatModelSelection.value;
    elements.modelSelection.value = state.model; // Sync settings tab
    saveModelSettings(false, state, elements, (msg, type) => showConnectionStatus(msg, type, elements), showToastUI, () => updateConnectionIndicator(state.isConnected, elements, currentTranslations), currentTranslations); // Save without toast
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
            // console.log("User scrolled up during stream, auto-scroll disabled for this stream.");
        } else if (atBottom && state.userScrolledUpDuringStream) {
            // User scrolled back to bottom, re-enable auto-scroll
            state.userScrolledUpDuringStream = false;
            // console.log("User scrolled back to bottom during stream, auto-scroll re-enabled.");
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
                showChatStatusMessage(_('pageContentExtractedSuccess', {}, currentTranslations), 'success', elements);
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
            // console.log(`[main.js] Received webpage theme: ${message.theme}`);
            if (message.theme === 'dark' || message.theme === 'light') {
                const isWebpageDark = message.theme === 'dark';
                // console.log(`Applying webpage theme: ${message.theme}`);
                state.darkMode = isWebpageDark;
                applyTheme(isWebpageDark, elements);
                updateMermaidTheme(isWebpageDark, rerenderAllMermaidChartsUI);
            } else {
                // console.log(`Ignoring non-explicit webpage theme: ${message.theme}`);
            }
            break;
        case 'languageChanged':
            // console.log(`[main.js] Received language change: ${message.newLanguage}`);
            handleLanguageChangeFromContent(message.newLanguage);
            break;
        case 'extensionReloaded':
            // console.log(`[main.js] Extension reloaded - reinitializing`);
            handleExtensionReloadFromContent();
            break;
        case 'proxyAutoCleared':
            // console.log(`[main.js] Proxy auto-cleared notification:`, message.failedProxy);
            handleProxyAutoClearedFromContent(message.failedProxy);
            break;
    }
}

function requestPageContent() {
    updateContextStatus('contextStatusExtracting', {}, elements, currentTranslations);
    window.parent.postMessage({ action: 'requestPageContent' }, '*');
}

function requestThemeFromContentScript() {
    // 检查是否在iframe中
    if (window.parent !== window) {
        // 在iframe中，检查Chrome API是否可用
        if (!chrome || !chrome.tabs || !chrome.runtime) {
            // console.log("[main.js] In iframe context with invalidated extension context, requesting theme via content script message");
            // 通过content script代理请求主题
            window.parent.postMessage({ action: 'requestThemeFromIframe' }, '*');
            return;
        }
    }

    // 检查Chrome API的可用性，避免在失效状态下调用
    if (!chrome || !chrome.tabs || !chrome.runtime) {
        // console.log("[main.js] Chrome API not available, applying system theme preference");
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
                // console.log("[main.js] Chrome API context invalidated, applying system theme preference");
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
                        // console.log("Falling back to system theme preference:", prefersDark ? 'dark' : 'light');
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
        // console.log("[main.js] Chrome API failed in iframe, using content script proxy");
            window.parent.postMessage({ action: 'requestThemeFromIframe' }, '*');
        } else {
        // console.log("[main.js] Error requesting theme, applying system theme preference");
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
 * 处理来自content script的语言变化通知
 */
function handleLanguageChangeFromContent(newLanguage) {
    // console.log(`[main.js] Handling language change from content: ${newLanguage}`);

    // 更新状态
    state.language = newLanguage;

    // 重新加载并应用翻译
    loadAndApplyTranslations(newLanguage);

    // 重新初始化划词助手设置（如果设置页面打开）
    if (window.initTextSelectionHelperSettings && elements.textSelectionHelperSettings) {
        const settingsContainer = elements.textSelectionHelperSettings;
        if (settingsContainer && settingsContainer.style.display !== 'none') {
            // console.log('[main.js] Reinitializing text selection helper settings for language change');
            const translations = window.translations && window.translations[newLanguage] ? window.translations[newLanguage] : {};
            window.initTextSelectionHelperSettings(elements, translations);
        }
    }
}

/**
 * 处理来自content script的扩展重载通知
 */
function handleExtensionReloadFromContent() {
    // console.log(`[main.js] Handling extension reload from content`);

    // 扩展重载后，content script会自动重新检测主题，所以这里不需要主动请求
    // 只在必要时才请求主题（比如用户手动触发）
    // console.log('[main.js] Extension reloaded, theme will be auto-detected by content script');

    // 重新加载当前语言的翻译
    if (state.language) {
        loadAndApplyTranslations(state.language);
    }

    // 重新初始化所有设置
    if (window.initTextSelectionHelperSettings && elements.textSelectionHelperSettings) {
        // console.log('[main.js] Reinitializing text selection helper settings after extension reload');
        const translations = window.translations && window.translations[state.language] ? window.translations[state.language] : {};
        window.initTextSelectionHelperSettings(elements, translations);
    }
}

// --- Translation Loading ---
function loadAndApplyTranslations(language) {
    if (typeof translations === 'undefined') {
        console.error('Translations object not found.');
        return;
    }
    currentTranslations = translations[language] || translations['en']; // Fallback to English
    state.language = language; // Ensure state is updated
    // console.log(`Applying translations for: ${language}`);
    updateUIElementsWithTranslations(currentTranslations); // Update static UI text

    // Update dynamic parts that depend on translations
    updateAgentsListUIAllArgs(); // Re-render agent list with translated labels/placeholders
    updateAgentSelectionInChatUI(); // Ensure chat agent selection is updated with translations
    updateConnectionIndicator(state.isConnected, elements, currentTranslations); // Re-render connection status text

    // 广播语言变化事件给动态创建的UI组件（如自定义选项对话框）
    try {
        const languageChangeEvent = new CustomEvent('pagetalk:languageChanged', {
            detail: { newLanguage: language }
        });
        document.dispatchEvent(languageChangeEvent);
        // console.log(`[main.js] Language change event dispatched for: ${language}`);
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
        clearContextAction(state, elements, clearImagesUI, clearVideosUI, showToastUI, currentTranslations, false); // Re-adds welcome message, no toast
    } else {
        // Update existing welcome message if present
        const welcomeHeading = elements.chatMessages.querySelector('.welcome-message h2');
        if (welcomeHeading) welcomeHeading.textContent = _('welcomeHeading');
        const summarizeBtn = elements.chatMessages.querySelector('.quick-action-btn'); // More robust selector
        if (summarizeBtn) summarizeBtn.textContent = _('summarizeAction');
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
        // console.log(`Day.js locale set to: ${dayjs.locale()}`);
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
        // console.log("Tab selection popup closed from main.js, state updated.");
    }
}

// 新增：移除选中的上下文标签页
function removeSelectedTabFromMain(tabId) {
    state.selectedContextTabs = state.selectedContextTabs.filter(tab => tab.id !== tabId);
    // 调用 ui.js 中的函数更新UI (确保此函数接受正确的参数)
    updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations);
    // console.log(`Selected context tab ${tabId} removed. Remaining:`, state.selectedContextTabs.length);
}

// 新增：用于更新已选标签栏UI的回调函数
function updateSelectedTabsBarFromMain() {
    updateSelectedTabsBarUI(state.selectedContextTabs, elements, removeSelectedTabFromMain, currentTranslations);
}



/**
 * 处理代理自动清除通知
 */
function handleProxyAutoClearedFromContent(failedProxy) {
    // console.log('[main.js] Handling proxy auto-cleared notification for:', failedProxy);

    // 更新UI中的代理地址输入框
    if (elements.proxyAddressInput) {
        elements.proxyAddressInput.value = '';
    }

    // 更新状态
    state.proxyAddress = '';

    // 显示通知给用户
    const message = `代理服务器 ${failedProxy} 连接失败，已自动清除代理设置以恢复网络连接。`;
    if (showToastUI) {
        showToastUI(message, 'warning', 'toast-proxy-cleared');
    }

    // console.log('[main.js] Proxy settings cleared due to connection failure');
}