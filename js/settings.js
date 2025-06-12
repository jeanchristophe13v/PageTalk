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
    chrome.storage.sync.get(['apiKey', 'model', 'language', 'proxyAddress'], (syncResult) => {
        // API Key and Model
        if (syncResult.apiKey) state.apiKey = syncResult.apiKey;
        if (syncResult.model) state.model = syncResult.model;
        if (elements.apiKey) elements.apiKey.value = state.apiKey;
        if (elements.modelSelection) elements.modelSelection.value = state.model;
        if (elements.chatModelSelection) elements.chatModelSelection.value = state.model;

        // Proxy Address
        if (syncResult.proxyAddress) state.proxyAddress = syncResult.proxyAddress;
        if (elements.proxyAddress) elements.proxyAddress.value = state.proxyAddress || '';

        // Language - 检测浏览器语言
        if (syncResult.language) {
            // 如果用户已经设置了语言，使用用户设置
            state.language = syncResult.language;
        } else {
            // 如果用户没有设置语言，自动检测并设置
            state.language = detectUserLanguage();
            // 保存检测到的语言设置
            chrome.storage.sync.set({ language: state.language });
        }
        
        if (elements.languageSelect) elements.languageSelect.value = state.language;
        loadAndApplyTranslationsCallback(state.language); // Apply translations

        // Theme (Load default, content script might override)
        state.darkMode = false; // Default to light
        applyThemeCallback(state.darkMode); // Apply default

        // Connection Status (based on API key presence)
        state.isConnected = !!state.apiKey;
        updateConnectionIndicatorCallback(); // Update footer indicator
    });
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
    const model = elements.modelSelection.value;
    const proxyAddress = elements.proxyAddress ? elements.proxyAddress.value.trim() : ''; // Get proxy address

    // Update state with proxy address regardless of API key presence
    state.proxyAddress = proxyAddress;

    if (!apiKey) {
        // Still save proxy address if API key is missing, but show API key error
        chrome.storage.sync.set({ proxyAddress: state.proxyAddress }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving proxy address:", chrome.runtime.lastError);
                showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
            } else {
                // Optionally, notify that proxy was saved if desired, but primary error is API key
                console.log('Proxy address saved while API key is missing.');
            }
        });
        showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        return;
    }

    // UI feedback for saving/testing
    elements.saveModelSettings.disabled = true;
    elements.saveModelSettings.textContent = _('saving', {}, currentTranslations);
    showConnectionStatusCallback(_('testingConnection', {}, currentTranslations), 'info');

    let testResult;
    try {
        // Pass proxyAddress to testAndVerifyApiKey
        testResult = await window.GeminiAPI.testAndVerifyApiKey(apiKey, model, proxyAddress);

        if (testResult.success) {
            state.apiKey = apiKey;
            state.model = model;
            state.isConnected = true;

            // Save all three settings: API key, model, and proxy address
            chrome.storage.sync.set({
                apiKey: state.apiKey,
                model: state.model,
                proxyAddress: state.proxyAddress
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving model and proxy settings:", chrome.runtime.lastError);
                    showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
                    state.isConnected = false; // Revert connection status on save error
                } else {
                    if (showToastNotification) {
                        // Show API verification success, then general saved message
                        showToastCallback(testResult.message, 'success');
                        // showToastCallback(_('settingsSaved', {}, currentTranslations), 'success'); // Redundant if testResult.message is clear
                    }
                    if (elements.chatModelSelection) {
                        elements.chatModelSelection.value = state.model;
                    }
                }
                updateConnectionIndicatorCallback();
            });
        } else {
            // Test failed, but still save proxy if it was entered
            state.isConnected = false;
            chrome.storage.sync.set({ proxyAddress: state.proxyAddress }, () => {
                 if (chrome.runtime.lastError) {
                    console.error("Error saving proxy address after failed API test:", chrome.runtime.lastError);
                    // Potentially show a more specific error for proxy save failure here
                } else {
                    console.log('Proxy address saved even though API test failed.');
                }
            });
            showToastCallback(_('connectionTestFailed', { error: testResult.message }, currentTranslations), 'error');
            updateConnectionIndicatorCallback();
        }
    } catch (error) {
        console.error("Error during API key test:", error);
        state.isConnected = false;
        // Also save proxy in case of exception during API test
        chrome.storage.sync.set({ proxyAddress: state.proxyAddress }, () => {
            if (chrome.runtime.lastError) {
               console.error("Error saving proxy address after API test exception:", chrome.runtime.lastError);
           } else {
               console.log('Proxy address saved after API test exception.');
           }
       });
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
            console.log(`Language saved: ${selectedLanguage}`);
            loadAndApplyTranslationsCallback(selectedLanguage); // Load and apply NEW translations
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
 * Initializes model selection dropdowns.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 */
export function initModelSelection(state, elements) {
    const modelOptions = [
        { value: 'gemini-2.0-flash', text: 'gemini-2.0-flash' },
        { value: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
        { value: 'gemini-2.5-flash-thinking', text: 'gemini-2.5-flash-thinking' },
        { value: 'gemini-2.0-flash-thinking-exp-01-21', text: 'gemini-2.0-flash-thinking' },
        { value: 'gemini-2.0-pro-exp-02-05', text: 'gemini-2.0-pro-exp-02-05' },
        { value: 'gemini-2.5-pro-exp-03-25', text: 'gemini-2.5-pro-exp-03-25' },
        { value: 'gemini-2.5-pro-preview-03-25', text: 'gemini-2.5-pro-preview-03-25' },
        { value: 'gemini-2.5-pro-preview-05-06', text: 'gemini-2.5-pro-preview-05-06' },
        { value: 'gemini-exp-1206', text: 'gemini-exp-1206' },
    ];

    const populateSelect = (selectElement) => {
        if (!selectElement) return;
        selectElement.innerHTML = '';
        modelOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            selectElement.appendChild(optionElement);
        });
        // Ensure current state model is selected, or default to first
        if (modelOptions.some(o => o.value === state.model)) {
            selectElement.value = state.model;
        } else if (modelOptions.length > 0) {
            selectElement.value = modelOptions[0].value;
            state.model = modelOptions[0].value; // Update state if model was invalid
        }
    };

    populateSelect(elements.modelSelection); // Settings tab
    populateSelect(elements.chatModelSelection); // Chat tab
}