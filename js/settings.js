/**
 * Pagetalk - Settings Management Functions (Model, General)
 */
import { generateUniqueId } from './utils.js'; // Might need utils later

/** Helper function to get translation string */
function _(key, replacements = {}, translations) {
    let translation = translations[key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * 获取浏览器语言设置
 * @returns {string} 浏览器语言代码
 */
function getBrowserLanguage() {
    return navigator.language || 
           navigator.userLanguage || 
           navigator.browserLanguage || 
           navigator.systemLanguage || 
           'en';
}

/**
 * 根据浏览器语言确定适合的界面语言
 * @returns {string} 界面语言代码 ('zh-CN' 或 'en')
 */
function detectUserLanguage() {
    const browserLang = getBrowserLanguage();
    // 如果浏览器语言是中文（简体、繁体等任何中文变种），返回简体中文
    if (browserLang === 'zh-CN' || browserLang.startsWith('zh')) {
        return 'zh-CN';
    } 
    // 否则默认返回英文
    return 'en';
}

/**
 * Loads settings relevant to the Model and General tabs.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} updateConnectionIndicatorCallback - Callback
 * @param {function} loadAndApplyTranslationsCallback - Callback
 * @param {function} applyThemeCallback - Callback
 */
export function loadSettings(state, elements, updateConnectionIndicatorCallback, loadAndApplyTranslationsCallback, applyThemeCallback) {
    chrome.storage.sync.get(['apiKey', 'model', 'language', 'proxyAddress', 'userSelectedModels', 'darkMode'], (syncResult) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading settings:", chrome.runtime.lastError);
            // Critical error, try to set up with absolute defaults
            state.language = detectUserLanguage();
            if (typeof loadAndApplyTranslationsCallback === 'function') loadAndApplyTranslationsCallback(state.language); // This should set state.currentTranslations

            const emergencyDefaultModels = ['gemini-2.5-flash', 'gemini-2.5-flash-thinking', 'gemini-2.5-flash-lite-06-17'];
            state.model = emergencyDefaultModels[0];
            initModelSelection(state, elements, emergencyDefaultModels, state.model); // Populates chat dropdown
            updateSelectedModelsDisplay(emergencyDefaultModels, elements, state.currentTranslations || {}); // Updates settings tags display

            chrome.storage.sync.set({ userSelectedModels: emergencyDefaultModels, model: state.model, language: state.language }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving emergency default models:", chrome.runtime.lastError);
                } else {
                    // console.log("Emergency default models saved due to load error.");
                }
            });
            state.darkMode = false; // Default theme on critical error
            if (typeof applyThemeCallback === 'function') applyThemeCallback(state.darkMode);
            if (typeof updateConnectionIndicatorCallback === 'function') updateConnectionIndicatorCallback();
            return;
        }

        // API Key
        state.apiKey = syncResult.apiKey || '';
        if (elements.apiKey) elements.apiKey.value = state.apiKey;

        // Language
        if (syncResult.language) {
            state.language = syncResult.language;
        } else {
            state.language = detectUserLanguage();
            // No need to save language here if it's just detected, save on explicit change by user
        }
        if (elements.languageSelect) elements.languageSelect.value = state.language;
        if (typeof loadAndApplyTranslationsCallback === 'function') {
            loadAndApplyTranslationsCallback(state.language); // This sets state.currentTranslations
        }

        // Proxy Address
        state.proxyAddress = syncResult.proxyAddress || '';
        if (elements.proxyAddressInput) elements.proxyAddressInput.value = state.proxyAddress;

        // Theme
        state.darkMode = syncResult.darkMode || false;
        if (typeof applyThemeCallback === 'function') {
            applyThemeCallback(state.darkMode);
        }

        // User Selected Models and Current Active Model for Chat
        let userModels = syncResult.userSelectedModels; // Use 'let' to allow reassignment
        let currentChatModel = syncResult.model;
        let shouldSaveDefaultsToStorage = false;

        if (!userModels || userModels.length === 0) {
            // console.log('No userSelectedModels found in storage, populating with specified defaults.');
            userModels = ['gemini-2.5-flash', 'gemini-2.5-flash-thinking', 'gemini-2.5-flash-lite-06-17'];
            shouldSaveDefaultsToStorage = true;

            if (!currentChatModel || !userModels.includes(currentChatModel)) {
                currentChatModel = userModels[0];
            }
        }

        state.model = currentChatModel; // Set the active model for the application state

        // Initialize model selection dropdowns (e.g., chat model selector)
        initModelSelection(state, elements, userModels, state.model);

        // Update the "Selected Models" display tags area in settings page UI
        updateSelectedModelsDisplay(userModels, elements, state.currentTranslations || {});

        if (shouldSaveDefaultsToStorage) {
            chrome.storage.sync.set({ userSelectedModels: userModels, model: state.model }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving default userSelectedModels and model to storage:", chrome.runtime.lastError);
                } else {
                    // console.log("Default userSelectedModels and model saved to storage.");
                }
            });
        }

        // Connection Status (based on API key presence)
        state.isConnected = !!state.apiKey;
        if (typeof updateConnectionIndicatorCallback === 'function') {
            updateConnectionIndicatorCallback();
        }
    });
}

function updateSelectedModelsDisplay(selectedModels, elements, currentTranslations) {
    if (!elements.selectedModelsContainer) return;
    elements.selectedModelsContainer.innerHTML = ''; // Clear previous models

    if (selectedModels && selectedModels.length > 0) {
        selectedModels.forEach(modelId => {
            const modelTag = document.createElement('span');
            modelTag.className = 'model-tag';
            modelTag.textContent = modelId;
            // TODO: Add a remove button for each tag in a later step
            elements.selectedModelsContainer.appendChild(modelTag);
        });
    } else {
        const noModelsHint = document.createElement('span');
        noModelsHint.className = 'no-models-selected-hint';
        // Ensure _ function is available or fallback to direct translation lookup
        const hintText = (typeof _ === 'function')
            ? _('noModelsSelectedHint', {}, currentTranslations)
            : (currentTranslations['noModelsSelectedHint'] || 'No models selected yet. Please fetch and select models first.');
        noModelsHint.textContent = hintText;
        elements.selectedModelsContainer.appendChild(noModelsHint);
    }
}

// --- Model Fetching Modal Functions ---

function createModelFetchModalHTML(currentTranslations) {
    // Uses the _ helper already defined in this file.
    return `
        <div id="model-fetch-overlay" class="dialog-overlay active">
            <div id="model-fetch-dialog" class="dialog-content settings-dialog">
                <div class="dialog-header">
                    <h3>${_('selectModelsTitle', {}, currentTranslations)}</h3>
                    <button id="close-model-fetch-dialog" class="dialog-close-btn" title="${_('close', {}, currentTranslations)}">&times;</button>
                </div>
                <div class="dialog-body">
                    <input type="text" id="model-search-input" class="model-search-input" placeholder="${_('searchModelsPlaceholder', {}, currentTranslations)}">
                    <div id="model-list-container" class="model-list-container">
                        <span class="loading-models-hint">${_('loadingModelsHint', {}, currentTranslations)}</span>
                        <!-- Model items will be populated here -->
                    </div>
                </div>
                <div class="dialog-footer">
                    <button id="cancel-model-fetch" class="dialog-button cancel-btn">${_('cancelButton', {}, currentTranslations)}</button>
                    <button id="confirm-model-selection" class="dialog-button confirm-btn">${_('confirmSelectionButton', {}, currentTranslations)}</button>
                </div>
            </div>
        </div>
    `;
}

function showModelFetchModal(elements, state) {
    if (document.getElementById('model-fetch-overlay')) return; // Already shown

    const modalHTML = createModelFetchModalHTML(state.currentTranslations);
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    const overlay = document.getElementById('model-fetch-overlay');
    const closeBtn = document.getElementById('close-model-fetch-dialog');
    const cancelBtn = document.getElementById('cancel-model-fetch');
    const confirmBtn = document.getElementById('confirm-model-selection');

    const hideModalWithStateClear = () => hideModelFetchModal(elements, state); // Pass state

    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideModalWithStateClear();
    });
    if (closeBtn) closeBtn.addEventListener('click', hideModalWithStateClear);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModalWithStateClear);

    if (confirmBtn) confirmBtn.addEventListener('click', () => {
        // console.log('Confirm model selection clicked. Saving:', state.currentModalSelection);

        // Disable button to prevent double-click
        confirmBtn.disabled = true;
        confirmBtn.textContent = _('saving', {}, state.currentTranslations) || 'Saving...';

        chrome.storage.sync.set({ userSelectedModels: state.currentModalSelection || [] }, () => {
            // Re-enable button
            confirmBtn.disabled = false;
            confirmBtn.textContent = _('confirmSelectionButton', {}, state.currentTranslations) || 'Confirm Selection';

            if (chrome.runtime.lastError) {
                console.error('Failed to save selected models:', chrome.runtime.lastError);
                if (state.ui && typeof state.ui.showToast === 'function') {
                    state.ui.showToast(_('saveSelectedModelsError', { error: chrome.runtime.lastError.message }, state.currentTranslations), 'error');
                } else {
                    alert(_('saveSelectedModelsError', { error: chrome.runtime.lastError.message }, state.currentTranslations));
                }
            } else {
                // console.log('Selected models saved:', state.currentModalSelection);
                if (state.ui && typeof state.ui.showToast === 'function') {
                    state.ui.showToast(_('selectedModelsSavedSuccess', {}, state.currentTranslations), 'success');
                }
                // Update the display on the settings page
                updateSelectedModelsDisplay(state.currentModalSelection || [], elements, state.currentTranslations);

                // Hide the modal - important to pass state here if hideModelFetchModal clears it
                hideModelFetchModal(elements, state);
            }
        });
    });

    // For now, it shows "Loading models..."
    state.currentModalSelection = []; // Reset/initialize temporary selection state for the modal
    fetchAndDisplayModels(state.apiKey, elements, state); // Pass apiKey, elements, state

    // Add event listener for search input
    const searchInput = document.getElementById('model-search-input');
    const modelListContainer = document.getElementById('model-list-container'); // Keep reference

    if (searchInput && modelListContainer) { // Ensure modelListContainer is also valid
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const modelItems = modelListContainer.querySelectorAll('.model-list-item');
            modelItems.forEach(item => {
                const modelName = item.querySelector('.model-name').textContent.toLowerCase();
                const modelId = item.dataset.modelId.toLowerCase();
                if (modelName.includes(searchTerm) || modelId.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}


async function fetchAndDisplayModels(apiKey, elements, state) {
    const modelListContainer = document.getElementById('model-list-container');
    if (!modelListContainer) return;

    modelListContainer.innerHTML = `<span class="loading-models-hint">${_('loadingModelsHint', {}, state.currentTranslations)}</span>`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}` } }));
            const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
            throw new Error(errorMessage);
        }
        const data = await response.json();
        const models = data.models || [];

        // Get previously selected models to pre-select them
        chrome.storage.sync.get(['userSelectedModels'], (result) => {
            const previouslySelectedModels = result.userSelectedModels || [];
            state.currentModalSelection = [...previouslySelectedModels]; // Initialize modal selection state
            renderModelsInModal(models, previouslySelectedModels, elements, state);
        });

    } catch (error) {
        console.error('Failed to fetch models:', error);
        modelListContainer.innerHTML = `<span class="error-hint">${_('fetchModelsError', { error: error.message }, state.currentTranslations)}</span>`;
    }
}

function renderModelsInModal(models, previouslySelectedModels, elements, state) {
    const modelListContainer = document.getElementById('model-list-container');
    if (!modelListContainer) return;
    modelListContainer.innerHTML = ''; // Clear loading hint or previous list

    if (!models || models.length === 0) {
        modelListContainer.innerHTML = `<span class="no-models-found-hint">${_('noModelsFoundHint', {}, state.currentTranslations)}</span>`;
        return;
    }

    models.forEach(model => {
        if (model.name.includes('embedding') || (model.supportedGenerationMethods && !model.supportedGenerationMethods.includes('generateContent') && !model.supportedGenerationMethods.includes('streamGenerateContent'))) {
            return;
        }

        const modelId = model.name.startsWith('models/') ? model.name.substring('models/'.length) : model.name;
        const displayName = model.displayName || modelId;

        const item = document.createElement('div');
        item.className = 'model-list-item';
        item.dataset.modelId = modelId;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = displayName;
        nameSpan.title = modelId;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'model-selected-icon';
        iconSpan.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        iconSpan.style.display = 'none';

        item.appendChild(nameSpan);
        item.appendChild(iconSpan);
        modelListContainer.appendChild(item);

        if (state.currentModalSelection && state.currentModalSelection.includes(modelId)) {
            item.classList.add('selected');
            iconSpan.style.display = 'inline-block';
        }

        item.addEventListener('click', () => {
            item.classList.toggle('selected');
            const isSelected = item.classList.contains('selected');
            iconSpan.style.display = isSelected ? 'inline-block' : 'none';

            if (!state.currentModalSelection) {
                state.currentModalSelection = [];
            }

            if (isSelected) {
                if (!state.currentModalSelection.includes(modelId)) {
                    state.currentModalSelection.push(modelId);
                }
            } else {
                state.currentModalSelection = state.currentModalSelection.filter(id => id !== modelId);
            }
            console.log('Current modal selection:', state.currentModalSelection);
        });
    });
}

function hideModelFetchModal(elements, state) { // Added state parameter
    const overlay = document.getElementById('model-fetch-overlay');
    if (overlay) {
        overlay.remove();
    }
    // Clear temporary selection state when modal is hidden without confirming
    if (state) {
        state.currentModalSelection = [];
        // console.log('Cleared modal selection on hide/cancel.');
    }
    // Restore focus to the fetch models button if it exists
    if (elements && elements.fetchModelsBtn) {
        elements.fetchModelsBtn.focus();
    }
}

export function handleFetchModelsClick(elements, state) { // Modified to accept elements and state
    // console.log('handleFetchModelsClick called in settings.js, API Key:', state.apiKey ? 'Exists' : 'Missing');
    // Check for API Key first
    if (!state.apiKey) {
        // Attempt to use showToast from the state.ui object if available (passed from main.js)
        if (state.ui && typeof state.ui.showToast === 'function') {
             state.ui.showToast(_('apiKeyMissingError', {}, state.currentTranslations), 'error');
        } else if (typeof window.showToast === 'function') { // Fallback to global window.showToast
            window.showToast(_('apiKeyMissingError', {}, state.currentTranslations), 'error');
        } else {
            alert(_('apiKeyMissingError', {}, state.currentTranslations)); // Ultimate fallback
        }
        return;
    }
    showModelFetchModal(elements, state);
}

/**
 * Saves model settings after testing the API key.
 * @param {boolean} showToastNotification - Whether to show the 'Saved' toast notification.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} showConnectionStatusCallback - Callback for model settings status
 * @param {function} showToastCallback - Callback for general toast
 * @param {function} updateConnectionIndicatorCallback - Callback for footer indicator
 * @param {object} currentTranslations - Translations object
 */
export async function saveModelSettings(showToastNotification = true, state, elements, showConnectionStatusCallback, showToastCallback, updateConnectionIndicatorCallback, currentTranslations) {
    const apiKey = elements.apiKey.value.trim();
    // const model = elements.modelSelection.value; // elements.modelSelection is removed

    if (!apiKey) {
        showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        return;
    }

    // UI feedback for saving/testing
    elements.saveModelSettings.disabled = true;
    elements.saveModelSettings.textContent = _('saving', {}, currentTranslations);
    showConnectionStatusCallback(_('testingConnection', {}, currentTranslations), 'info');

    let testResult;
    try {
        // Call testAndVerifyApiKey without the model argument
        testResult = await window.GeminiAPI.testAndVerifyApiKey(apiKey);

        if (testResult.success) {
            state.apiKey = apiKey;
            // state.model is now managed by initModelSelection and userSelectedModels,
            // but we still save the apiKey here.
            // The active model (state.model) used for chat is updated via chatModelSelection's change event
            // or by initModelSelection if the stored one is invalid.
            // We only need to store the apiKey here as 'model' in storage refers to the last *active* model for chat.
            state.isConnected = true;

            // Only save apiKey. The 'model' (active model for chat) is saved via its own mechanisms.
            chrome.storage.sync.set({ apiKey: state.apiKey }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving model settings:", chrome.runtime.lastError);
                    showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error'); // Changed to showToastCallback
                    state.isConnected = false; // Revert status
                } else {
                    if (showToastNotification) {
                        showToastCallback(testResult.message, 'success'); // 仅在需要时弹出API验证成功提示
                        showToastCallback(_('apiKeyVerifiedProceedToGetModels', {}, currentTranslations), 'info', 'toast-long-duration');
                        // showToastCallback(_('settingsSaved', {}, currentTranslations), 'success');
                    }
                    // No direct model to sync to chatModelSelection here,
                    // as this function no longer handles the 'active' model selection directly.
                    // initModelSelection and the chatModelSelection change handler manage that.
                }
                updateConnectionIndicatorCallback();
            });
        } else {
            // Test failed
            state.isConnected = false;
            showToastCallback(_('connectionTestFailed', { error: testResult.message }, currentTranslations), 'error'); // Changed to showToastCallback
            updateConnectionIndicatorCallback();
        }
    } catch (error) {
        console.error("Error during API key test:", error);
        state.isConnected = false;
        showToastCallback(_('connectionTestFailed', { error: error.message }, currentTranslations), 'error');
        updateConnectionIndicatorCallback();
    } finally {
        // Restore button
        elements.saveModelSettings.disabled = false;
        elements.saveModelSettings.textContent = _('save', {}, currentTranslations);
    }
}

/**
 * Handles language selection change.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} loadAndApplyTranslationsCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object (before change)
 */
export function handleLanguageChange(state, elements, loadAndApplyTranslationsCallback, showToastCallback, currentTranslations) {
    const selectedLanguage = elements.languageSelect.value;
    state.language = selectedLanguage; // Update state immediately

    chrome.storage.sync.set({ language: selectedLanguage }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving language:", chrome.runtime.lastError);
            showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error'); // Use old translations for error
        } else {
            // console.log(`Language saved: ${selectedLanguage}`);
            loadAndApplyTranslationsCallback(selectedLanguage); // Load and apply NEW translations
        }
    });
}

/**
 * 验证代理地址格式
 */
function validateProxyAddress(proxyAddress) {
    if (!proxyAddress || proxyAddress.trim() === '') {
        return { valid: true, message: '' }; // 空地址是有效的（表示不使用代理）
    }

    try {
        const url = new URL(proxyAddress.trim());
        const scheme = url.protocol.slice(0, -1);

        // 检查支持的协议
        const supportedSchemes = ['http', 'https', 'socks4', 'socks5'];
        if (!supportedSchemes.includes(scheme)) {
            return {
                valid: false,
                message: `不支持的代理协议: ${scheme}。支持的协议: ${supportedSchemes.join(', ')}`
            };
        }

        // 检查主机名
        if (!url.hostname) {
            return { valid: false, message: '代理地址缺少主机名' };
        }

        // 检查端口（如果提供）
        if (url.port && (isNaN(url.port) || url.port < 1 || url.port > 65535)) {
            return { valid: false, message: '代理端口必须在1-65535范围内' };
        }

        return { valid: true, message: '' };
    } catch (error) {
        return { valid: false, message: '代理地址格式无效' };
    }
}

/**
 * Handles proxy address changes
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} showToastCallback - Callback for showing toast messages
 * @param {object} currentTranslations - Current translations object
 */
export function handleProxyAddressChange(state, elements, showToastCallback, currentTranslations) {
    const proxyAddress = elements.proxyAddressInput.value.trim();

    // 验证代理地址
    const validation = validateProxyAddress(proxyAddress);
    if (!validation.valid) {
        showToastCallback(validation.message, 'error');
        return;
    }

    // Update state
    state.proxyAddress = proxyAddress;

    // Save to storage
    chrome.storage.sync.set({ proxyAddress: proxyAddress }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving proxy url:", chrome.runtime.lastError);
            showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
        } else {
            // console.log(`Proxy address saved: ${proxyAddress || '(empty)'}`);
            if (proxyAddress) {
                showToastCallback(_('proxySetSuccess', {}, currentTranslations), 'success');
            } else {
                showToastCallback(_('proxyCleared', {}, currentTranslations), 'success');
            }
        }
    });
}

/**
 * 测试代理连接
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} showToastCallback - Callback for showing toast messages
 * @param {object} currentTranslations - Current translations object
 */
export function handleProxyTest(state, elements, showToastCallback, currentTranslations) {
    const proxyAddress = elements.proxyAddressInput.value.trim();

    // 验证代理地址
    const validation = validateProxyAddress(proxyAddress);
    if (!validation.valid) {
        showToastCallback(validation.message, 'error');
        return;
    }

    if (!proxyAddress) {
        showToastCallback('请先输入代理地址', 'error');
        return;
    }

    // 禁用测试按钮并显示加载状态
    const testBtn = elements.testProxyBtn;
    const originalText = testBtn.textContent;
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';

    // 发送测试请求到background.js
    chrome.runtime.sendMessage({
        action: 'testProxy',
        proxyAddress: proxyAddress
    }, (response) => {
        // 恢复按钮状态
        testBtn.disabled = false;
        testBtn.textContent = originalText;

        if (chrome.runtime.lastError) {
            console.error('Error testing proxy:', chrome.runtime.lastError);
            showToastCallback('代理测试失败: ' + chrome.runtime.lastError.message, 'error');
            return;
        }

        if (response && response.success) {
            showToastCallback('代理连接成功！', 'success');
        } else {
            const errorMsg = response?.error || '代理连接失败';
            showToastCallback('代理测试失败: ' + errorMsg, 'error');
        }
    });
}

/**
 * Handles exporting chat history.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 */
export function handleExportChat(state, elements, showToastCallback, currentTranslations) {
    const format = elements.exportFormatSelect.value;
    let content = '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = `pagetalk_chat_${timestamp}`;

    if (format === 'markdown') {
        filename += '.md';
        content = exportChatToMarkdown(state, currentTranslations);
    } else { // text format
        filename += '.txt';
        content = exportChatToText(state, currentTranslations);
    }

    if (!content) {
        showToastCallback(_('chatExportEmptyError', {}, currentTranslations), 'error');
        return;
    }

    try {
        const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToastCallback(_('chatExportSuccess', {}, currentTranslations), 'success');
    } catch (error) {
        console.error("Error creating download link:", error);
        showToastCallback(_('chatExportError', { error: error.message }, currentTranslations), 'error'); // Need translation
    }
}

/**
 * Exports chat history to Markdown format.
 * @param {object} state - Global state reference
 * @param {object} currentTranslations - Translations object
 * @returns {string} Markdown content
 */
function exportChatToMarkdown(state, currentTranslations) {
    if (state.chatHistory.length === 0) return '';

    const _tr = (key, rep = {}) => _(key, rep, currentTranslations);
    const locale = state.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en';
    if (typeof dayjs !== 'undefined') dayjs.locale(locale);
    const timestamp = typeof dayjs !== 'undefined' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : new Date().toLocaleString();

    let markdown = `# ${_tr('appName')} ${_tr('chatTab')} History (${timestamp})\n\n`;

    state.chatHistory.forEach(message => {
        const { text, images } = extractPartsFromMessage(message); // Use helper
        const role = message.role === 'user' ? _tr('chatTab') : _tr('appName');
        markdown += `## ${role}\n\n`;

        if (images.length > 0) {
            images.forEach((img, index) => {
                // Include image placeholder, maybe with mime type
                markdown += `[${_tr('imageAlt', { index: index + 1 })} - ${img.mimeType}]\n`;
            });
            markdown += '\n';
        }

        if (text) {
            // Basic Markdown escaping (optional, depends on desired output)
            // const escapedText = text.replace(/([\\`*_{}[\]()#+.!-])/g, '\\$1');
            markdown += `${text}\n\n`; // Use original text for Markdown
        }
    });

    return markdown;
}

/**
 * Exports chat history to plain text format.
 * @param {object} state - Global state reference
 * @param {object} currentTranslations - Translations object
 * @returns {string} Plain text content
 */
function exportChatToText(state, currentTranslations) {
    if (state.chatHistory.length === 0) return '';

    const _tr = (key, rep = {}) => _(key, rep, currentTranslations);
    const locale = state.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en';
    if (typeof dayjs !== 'undefined') dayjs.locale(locale);
    const timestamp = typeof dayjs !== 'undefined' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : new Date().toLocaleString();

    let textContent = `${_tr('appName')} ${_tr('chatTab')} History (${timestamp})\n\n`;

    state.chatHistory.forEach(message => {
        const { text, images } = extractPartsFromMessage(message); // Use helper
        const role = message.role === 'user' ? _tr('chatTab') : _tr('appName');
        textContent += `--- ${role} ---\n`;

        if (images.length > 0) {
            textContent += `[${_tr('containsNImages', { count: images.length })}]\n`;
        }

        if (text) {
            textContent += `${text}\n`;
        }
        textContent += '\n';
    });

    return textContent;
}

/**
 * Helper to extract text and image info from a message object.
 * (Could be moved to utils.js if used elsewhere)
 * @param {object} message - A message object from state.chatHistory
 * @returns {{text: string, images: Array<{dataUrl: string, mimeType: string}>}}
 */
function extractPartsFromMessage(message) {
    let text = '';
    const images = [];
    if (message && message.parts && Array.isArray(message.parts)) {
        message.parts.forEach(part => {
            if (part.text) {
                text += (text ? '\n' : '') + part.text; // Combine text parts with newline
            } else if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
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
 * Initializes model selection dropdowns, primarily the chat model selector.
 * Populates it with models from userSelectedModels storage, or defaults if none are set.
 * Ensures state.model reflects a valid and available model.
 * @param {object} state - Global state reference.
 * @param {object} elements - DOM elements reference.
 * @param {string[]} userModels - Array of user-selected model IDs from storage.
 * @param {string} currentStoredModel - The model ID currently stored as the active one.
 */
export function initModelSelection(state, elements, userModels = [], currentStoredModel = '') {
    const populateSelect = (selectElement, availableModels, currentSelectedModel) => {
        if (!selectElement) return;
        selectElement.innerHTML = ''; // Clear existing options

        if (availableModels && availableModels.length > 0) {
            availableModels.forEach(modelId => {
                const optionElement = document.createElement('option');
                optionElement.value = modelId;
                optionElement.textContent = modelId; // Displaying ID, as displayName is not stored with userSelectedModels
                selectElement.appendChild(optionElement);
            });

            if (availableModels.includes(currentSelectedModel)) {
                selectElement.value = currentSelectedModel;
            } else if (availableModels.length > 0) { // If currentSelectedModel is not in list, pick first available
                selectElement.value = availableModels[0];
                // Only update state.model (and sync) if it's the primary chat model selector
                if (selectElement === elements.chatModelSelection) {
                     state.model = availableModels[0];
                     // Also update storage for 'model' if it changed due to unavailability
                     chrome.storage.sync.set({ model: state.model });
                }
            }
        } else {
            // Fallback: if no user-selected models, add a default and prompt to configure
            const defaultModel = 'gemini-2.5-flash'; // Updated fallback
            const optionElement = document.createElement('option');
            optionElement.value = defaultModel;
            optionElement.textContent = defaultModel;
            selectElement.appendChild(optionElement);

            const promptOption = document.createElement('option');
            // Ensure state.currentTranslations is available or _ has a fallback
            promptOption.textContent = _('configureModelsInSettings', {}, state.currentTranslations || {});
            promptOption.disabled = true;
            selectElement.appendChild(promptOption);

            selectElement.value = defaultModel;
            // Only update state.model (and sync) if it's the primary chat model selector
            if (selectElement === elements.chatModelSelection) {
                state.model = defaultModel;
                chrome.storage.sync.set({ model: state.model });
            }
        }
    };

    const effectiveModel = currentStoredModel || (userModels.length > 0 ? userModels[0] : 'gemini-2.5-flash'); // Updated fallback

    // Populate chat model selector
    populateSelect(elements.chatModelSelection, userModels, effectiveModel);

    // Update state.model based on the chatModelSelection's final value
    // This is crucial because populateSelect might change the selection if the stored model is invalid.
    if (elements.chatModelSelection && elements.chatModelSelection.value) {
         state.model = elements.chatModelSelection.value;
    } else if (userModels.length > 0) { // Should not happen if populateSelect runs correctly
         state.model = userModels[0];
    } else { // Fallback if everything else fails
         state.model = 'gemini-2.5-flash'; // Updated fallback
    }
    // Note: elements.modelSelection (the main model dropdown on the settings page) was removed.
    // This function now primarily serves the chatModelSelection.
    // If other model dropdowns for features like text-selection-helper are added,
    // they would need separate logic or ensure userModels are appropriate for them.
}