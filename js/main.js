/**
 * Pagetalk - Main Sidepanel Script (Coordinator)
 */

// --- Imports ---
import { generateUniqueId } from './utils.js';
import { renderDynamicContent, rerenderAllMermaidCharts, showMermaidModal, hideMermaidModal } from './render.js';
import { applyTheme, updateMermaidTheme, toggleTheme, makeDraggable, loadButtonPosition, setThemeButtonVisibility } from './theme.js';
import { setupImagePaste, handleImageSelect, handleImageFile, updateImagesPreview, removeImageById, clearImages, showFullSizeImage, hideImageModal } from './image.js';
import { loadAgents, updateAgentsListUI, createNewAgent, showDeleteConfirmDialog, confirmDeleteAgent, switchAgent, updateAgentSelectionInChat, saveAgentsList, saveCurrentAgentId, handleAgentExport, handleAgentImport, loadCurrentAgentSettingsIntoState } from './agent.js';
import { loadSettings as loadAppSettings, saveModelSettings, handleLanguageChange, handleExportChat, initModelSelection } from './settings.js';
import { sendUserMessage as sendUserMessageAction, clearContext as clearContextAction, deleteMessage as deleteMessageAction, regenerateMessage as regenerateMessageAction, abortStreaming as abortStreamingAction } from './chat.js';
import { switchTab, switchSettingsSubTab, addMessageToChat, updateStreamingMessage, finalizeBotMessage, addThinkingAnimation, showConnectionStatus, updateConnectionIndicator, updateContextStatus, showToast, resizeTextarea, setupAutoresizeTextarea, updateUIElementsWithTranslations, restoreSendButtonAndInput, toggleApiKeyVisibility, showChatStatusMessage, addCopyButtonToCodeBlock, addMessageActionButtons, showCopyCodeFeedback, showCopyMessageFeedback } from './ui.js';

// --- State Management ---
const state = {
    apiKey: '',
    model: 'gemini-2.0-flash',
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
    darkMode: false,
    language: 'zh-CN',
    isStreaming: false,
    // userHasSetPreference: false, // Removed
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
    imagePreviewContainer: document.getElementById('image-preview-container'),
    imagesGrid: document.getElementById('images-grid'),
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
    exportAgentsBtn: document.getElementById('export-agents'),
    importAgentInput: document.getElementById('import-agent-input'),
    // Settings - Model
    apiKey: document.getElementById('api-key'),
    modelSelection: document.getElementById('model-selection'),
    saveModelSettings: document.getElementById('save-model-settings'),
    connectionStatus: document.getElementById('connection-status'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    apiKeyInput: document.getElementById('api-key'), // Alias
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
let isUserNearBottom = true;
const SCROLL_THRESHOLD = 30; // Increased threshold slightly

// --- Initialization ---
function init() {
    console.log("Pagetalk Initializing...");

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
        () => updateAgentsListUI(state, elements, currentTranslations, autoSaveAgentSettings, showDeleteConfirmDialogUI, switchAgentAndUpdateState), // Pass agent UI update
        () => updateAgentSelectionInChat(state, elements), // Pass chat dropdown update
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
            console.log('Mermaid initialized.');
        } catch (error) {
            console.error('Mermaid initialization failed:', error);
        }
    } else {
        console.warn('Mermaid library not found during init.');
    }

    // Set initial visibility for theme button
    const initialTab = document.querySelector('.footer-tab.active')?.dataset.tab || 'chat';
    setThemeButtonVisibility(initialTab, elements);

    console.log("Pagetalk Initialized.");
}

// --- Event Listener Setup ---
function setupEventListeners() {
    // Footer Tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            switchTab(tabId, elements, (subTab) => switchSettingsSubTab(subTab, elements));
            setThemeButtonVisibility(tabId, elements); // Update button visibility on tab switch
        });
    });

    // Settings Sub-Tabs
    elements.settingsNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchSettingsSubTab(btn.dataset.subtab, elements));
    });

    // Chat Actions
    elements.sendMessage.addEventListener('click', sendUserMessageTrigger); // Initial listener
    elements.userInput.addEventListener('keydown', handleUserInputKeydown);
    elements.clearContextBtn.addEventListener('click', () => clearContextAction(state, elements, clearImagesUI, showToastUI, currentTranslations));
    elements.chatModelSelection.addEventListener('change', handleChatModelChange);
    elements.chatAgentSelection.addEventListener('change', handleChatAgentChange);

    // Image Handling
    elements.uploadImage.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => handleImageSelect(e, (file) => handleImageFile(file, state, updateImagesPreviewUI), elements));
    elements.closeModal.addEventListener('click', () => hideImageModal(elements));
    window.addEventListener('click', (e) => { if (e.target === elements.imageModal) hideImageModal(elements); }); // Close modal on overlay click

    // Mermaid Modal
    elements.mermaidCloseModal.addEventListener('click', () => hideMermaidModal(elements));
    elements.mermaidModal.addEventListener('click', (e) => { if (e.target === elements.mermaidModal) hideMermaidModal(elements); });

    // Settings Actions
    elements.saveModelSettings.addEventListener('click', () => saveModelSettings(true, state, elements, (msg, type) => showConnectionStatus(msg, type, elements), showToastUI, () => updateConnectionIndicator(state.isConnected, elements, currentTranslations), currentTranslations));
    elements.toggleApiKey.addEventListener('click', () => toggleApiKeyVisibility(elements));
    elements.languageSelect.addEventListener('change', () => handleLanguageChange(state, elements, loadAndApplyTranslations, showToastUI, currentTranslations));
    elements.exportChatHistoryBtn.addEventListener('click', () => handleExportChat(state, elements, showToastUI, currentTranslations));

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
}

// --- Event Handlers & Triggers ---

function handleUserInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!state.isStreaming) {
            sendUserMessageTrigger();
        }
    }
}

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
    isUserNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
}

// Wrapper function to trigger sendUserMessage with all dependencies
function sendUserMessageTrigger() {
    sendUserMessageAction(
        state, elements, currentTranslations,
        (msg, type) => showConnectionStatus(msg, type, elements), // showConnectionStatusCallback
        addMessageToChatUI, // addMessageToChatCallback
        (afterEl) => addThinkingAnimation(afterEl, elements, isUserNearBottom), // addThinkingAnimationCallback
        () => resizeTextarea(elements), // resizeTextareaCallback
        clearImagesUI, // clearImagesCallback
        showToastUI, // showToastCallback
        restoreSendButtonAndInputUI, // restoreSendButtonAndInputCallback
        abortStreamingUI, // abortStreamingCallback
        isUserNearBottom
    );
}

// Wrapper function to trigger abortStreaming
function abortStreamingUI() {
    abortStreamingAction(state, restoreSendButtonAndInputUI);
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

// Wrapper function for autoSaveAgentSettings
function autoSaveAgentSettings(agentId, agentItemElement) {
    autoSaveAgentSettings(agentId, agentItemElement, state, saveAgentsListState, updateAgentSelectionInChatUI, showToastUI, currentTranslations);
}

// Wrapper function for showDeleteConfirmDialog
function showDeleteConfirmDialogUI(agentId) {
    showDeleteConfirmDialog(agentId, state, elements, currentTranslations);
}

// Wrapper function for switchAgent that also saves ID and updates state
function switchAgentAndUpdateState(agentId) {
    switchAgent(agentId, state, saveCurrentAgentIdState);
    // No need to call loadCurrentAgentSettingsIntoState here, switchAgent handles it.
}

// Wrapper function for updateAgentSelectionInChat
function updateAgentSelectionInChatUI() {
    updateAgentSelectionInChat(state, elements);
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
        (afterEl) => addThinkingAnimation(afterEl, elements, isUserNearBottom),
        restoreSendButtonAndInputUI,
        abortStreamingUI,
        isUserNearBottom
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

// Wrapper function for showToast
function showToastUI(message, type) {
    showToast(message, type);
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
        case 'panelShown':
            resizeTextarea(elements);
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
    }
}

function requestPageContent() {
    updateContextStatus('contextStatusExtracting', {}, elements, currentTranslations);
    window.parent.postMessage({ action: 'requestPageContent' }, '*');
}

function requestThemeFromContentScript() {
     try {
        chrome.tabs && chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "requestTheme"}, (response) => {
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
        console.error("Error requesting theme:", e);
        // Apply default theme based on system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.darkMode = prefersDark;
        applyTheme(state.darkMode, elements);
        updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsUI);
    }
}

function closePanel() {
    window.parent.postMessage({ action: 'closePanel' }, '*');
}

// --- Translation Loading ---
function loadAndApplyTranslations(language) {
    if (typeof translations === 'undefined') {
        console.error('Translations object not found.');
        return;
    }
    currentTranslations = translations[language] || translations['zh-CN']; // Fallback
    state.language = language; // Ensure state is updated
    console.log(`Applying translations for: ${language}`);
    updateUIElementsWithTranslations(currentTranslations); // Update static UI text

    // Update dynamic parts that depend on translations
    updateAgentsListUIAllArgs(); // Re-render agent list with translated labels/placeholders
    updateConnectionIndicator(state.isConnected, elements, currentTranslations); // Re-render connection status text
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
        clearContextAction(state, elements, clearImagesUI, showToastUI, currentTranslations, false); // Re-adds welcome message, no toast
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
window.updateStreamingMessage = updateStreamingMessage;
window.finalizeBotMessage = finalizeBotMessage;
window.showToast = showToastUI; // Expose toast globally if needed

// --- Start Application ---
document.addEventListener('DOMContentLoaded', init);