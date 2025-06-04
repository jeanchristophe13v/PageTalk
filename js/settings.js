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
    chrome.storage.sync.get(['apiKey', 'model', 'language'], (syncResult) => {
        // API Key and Model
        if (syncResult.apiKey) state.apiKey = syncResult.apiKey;
        if (syncResult.model) state.model = syncResult.model;
        if (elements.apiKey) elements.apiKey.value = state.apiKey;
        if (elements.modelSelection) elements.modelSelection.value = state.model;
        if (elements.chatModelSelection) elements.chatModelSelection.value = state.model;

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

    if (!apiKey) {
        showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error'); // Changed to showToastCallback
        return;
    }

    // UI feedback for saving/testing
    elements.saveModelSettings.disabled = true;
    elements.saveModelSettings.textContent = _('saving', {}, currentTranslations);
    showConnectionStatusCallback(_('testingConnection', {}, currentTranslations), 'info');

    let testResult;
    try {
        testResult = await window.GeminiAPI.testAndVerifyApiKey(apiKey, model);

        if (testResult.success) {
            state.apiKey = apiKey;
            state.model = model;
            state.isConnected = true;

            chrome.storage.sync.set({ apiKey: state.apiKey, model: state.model }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving model settings:", chrome.runtime.lastError);
                    showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error'); // Changed to showToastCallback
                    state.isConnected = false; // Revert status
                } else {
                    if (showToastNotification) {
                        showToastCallback(testResult.message, 'success'); // 仅在需要时弹出API验证成功提示
                        // showToastCallback(_('settingsSaved', {}, currentTranslations), 'success'); // 可选：额外的“已保存”提示
                    }
                    // Sync chat model selector
                    if (elements.chatModelSelection) {
                        elements.chatModelSelection.value = state.model;
                    }
                }
                updateConnectionIndicatorCallback(); // Update footer indicator
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


// --- Selection Assistant Settings ---

// Helper function to generate unique IDs (simplified)
function generateSimpleId() {
    return 'opt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getDefaultSelectionAssistantOptions(currentTranslations) {
    return [
        {
          id: generateSimpleId(),
          name: _('defaultInterpret', {}, currentTranslations) || '解读',
          type: 'interpret',
          model: 'gemini-1.5-flash-preview-0514',
          prompt: _('defaultInterpretPrompt', {}, currentTranslations) || '请根据以下页面内容，解读选中的文本：',
          temperature: 0.7,
          isDefault: true
        },
        {
          id: generateSimpleId(),
          name: _('defaultTranslate', {}, currentTranslations) || '翻译',
          type: 'translate',
          model: 'gemini-1.5-flash-preview-0514',
          prompt: _('defaultTranslatePrompt', {}, currentTranslations) || '请将以下选中的文本在中文和英文之间互译：',
          temperature: 0.2,
          isDefault: true
        },
        {
          id: generateSimpleId(),
          name: _('defaultChat', {}, currentTranslations) || '对话',
          type: 'chat', // 'chat' type options might not have model/prompt/temp here
          isDefault: true
        }
    ];
}

function saveSelectionAssistantConfig(config, showToastCallback, currentTranslations) {
    chrome.storage.sync.set({ selectionAssistantConfig: config }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving selection assistant config:", chrome.runtime.lastError);
            if (showToastCallback) showToastCallback(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
        } else {
            console.log("Selection assistant config saved.", config);
            // if (showToastCallback) showToastCallback(_('settingsSaved', {}, currentTranslations), 'success'); // Optional: general saved toast
        }
    });
}

function renderSelectionOptionsList(containerElement, optionsArray, currentTranslations, state, showToastCallback) {
    containerElement.innerHTML = ''; // Clear existing list

    optionsArray.forEach(option => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'selection-option-item';
        itemDiv.dataset.optionId = option.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'selection-option-name';
        nameSpan.textContent = option.name;
        // TODO: Make name editable in a future step by replacing span with input on click

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'selection-option-actions';

        // Placeholder for Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.813z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>`; // Placeholder icon
        editBtn.title = _('editOptionTooltip', {}, currentTranslations) || '编辑';
        editBtn.onclick = () => {
            // TODO: Implement edit functionality (opens a foldable card or inline editor)
            console.log('Edit option:', option.id);
            if (showToastCallback) showToastCallback('编辑功能待实现 (Edit to be implemented)', 'info');
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-option-btn';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/></svg>`;
        deleteBtn.title = _('deleteOptionTooltip', {}, currentTranslations) || '删除';
        deleteBtn.onclick = () => {
            if (confirm(_('confirmDeleteOption', { name: option.name }, currentTranslations) || `确定删除 "${option.name}" 吗？`)) {
                state.selectionAssistantConfig.options = state.selectionAssistantConfig.options.filter(op => op.id !== option.id);
                saveSelectionAssistantConfig(state.selectionAssistantConfig, showToastCallback, currentTranslations);
                renderSelectionOptionsList(containerElement, state.selectionAssistantConfig.options, currentTranslations, state, showToastCallback); // Re-render
            }
        };

        actionsDiv.appendChild(editBtn); // Add edit button
        if (!option.isDefault || option.type === 'custom_prompt') { // Allow deleting custom or non-essential defaults
             actionsDiv.appendChild(deleteBtn);
        } else {
            // Optionally, disable delete for core defaults or show a different icon/tooltip
            deleteBtn.disabled = true;
            deleteBtn.title = _('cannotDeleteDefaultOptionTooltip', {}, currentTranslations) || '默认选项不能删除';
        }


        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(actionsDiv);
        containerElement.appendChild(itemDiv);
    });

    const addBtn = document.createElement('button');
    addBtn.id = 'add-new-selection-option-btn';
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"/></svg> ` + (_('addNewOptionButton', {}, currentTranslations) || '添加新选项');
    addBtn.onclick = () => {
        const newOption = {
            id: generateSimpleId(),
            name: _('newActionDefaultName', {}, currentTranslations) || '新操作',
            type: 'custom_prompt', // Default to custom_prompt
            model: getSelectionAssistantModels()[0].value, // Default to first available model
            prompt: _('newActionDefaultPrompt', {}, currentTranslations) || '请处理以下文本：',
            temperature: 0.5,
            isDefault: false
        };
        state.selectionAssistantConfig.options.push(newOption);
        saveSelectionAssistantConfig(state.selectionAssistantConfig, showToastCallback, currentTranslations);
        renderSelectionOptionsList(containerElement, state.selectionAssistantConfig.options, currentTranslations, state, showToastCallback); // Re-render
        // TODO: Automatically open the edit interface for this new option
    };
    containerElement.appendChild(addBtn);
}


export function initSelectionAssistantSettings(settingsSectionElement, currentTranslations, state, showToastCallback) {
    if (!settingsSectionElement) return;
    settingsSectionElement.innerHTML = ''; // Clear previous content

    const title = document.createElement('h2');
    title.textContent = _('selectionAssistantSettingsTitle', {}, currentTranslations) || '划词助手设置';
    settingsSectionElement.appendChild(title);

    const listContainer = document.createElement('div');
    listContainer.id = 'selection-options-list-container';
    settingsSectionElement.appendChild(listContainer);

    // Load or initialize settings
    chrome.storage.sync.get('selectionAssistantConfig', (result) => {
        let currentConfig = result.selectionAssistantConfig;
        if (!currentConfig || !currentConfig.options || currentConfig.options.length === 0) {
            console.log('No selection assistant config found, initializing with defaults.');
            currentConfig = { options: getDefaultSelectionAssistantOptions(currentTranslations) };
            // Save these defaults back to storage and state
            state.selectionAssistantConfig = currentConfig;
            saveSelectionAssistantConfig(currentConfig, showToastCallback, currentTranslations);
        } else {
            // Ensure state is updated with loaded config
            state.selectionAssistantConfig = currentConfig;
        }

        renderSelectionOptionsList(listContainer, state.selectionAssistantConfig.options, currentTranslations, state, showToastCallback);
    });

    // Chat Info Text (remains, as it's not part of the dynamic list)
    const chatInfo = document.createElement('div');
    chatInfo.className = 'selection-assistant-info-text';
    chatInfo.textContent = _('chatSettingsInfo', {}, currentTranslations) || '“对话”功能相关的模型和助手设置，与主聊天面板的设置保持同步。';
    settingsSectionElement.appendChild(chatInfo);
}


// Old foldable card functions (to be removed as they are replaced by the list view)
// Helper functions for creating form elements, adapted from previous foldable card implementation

// (Assuming _ and generateSimpleId, getSelectionAssistantModels, saveSelectionAssistantConfig are already defined from previous steps)

function createSettingGroup(labelTextKey, labelDefaultText, inputElement, currentTranslations) {
    const group = document.createElement('div');
    group.className = 'setting-group';
    const label = document.createElement('label');
    label.textContent = _(labelTextKey, {}, currentTranslations) || labelDefaultText;
    if (inputElement.id) label.htmlFor = inputElement.id; // Ensure IDs are set on inputs for this to work
    group.appendChild(label);
    group.appendChild(inputElement);
    return group;
}

// (getSelectionAssistantModels, createModelSelect, createTextarea, createTemperatureSlider are assumed to be defined correctly from the previous application of this diff)
// Ensure they are present in the final combined code. If they were missed, they need to be re-added.
// For this diff, assuming they are now correctly part of the codebase.

function createEditableOptionCardContent(option, currentTranslations, state, showToastCallback) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'selection-option-edit-content';

    // Name Editing
    const nameInputId = `option-name-${option.id}`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = nameInputId;
    nameInput.value = option.name;
    nameInput.addEventListener('input', (e) => {
        const optToUpdate = state.selectionAssistantConfig.options.find(o => o.id === option.id);
        if (optToUpdate) {
            optToUpdate.name = e.target.value;
            const nameSpan = document.querySelector(`.selection-option-item[data-option-id="${option.id}"] .selection-option-name`);
            if (nameSpan) nameSpan.textContent = e.target.value;
            saveSelectionAssistantConfig(state.selectionAssistantConfig, showToastCallback, currentTranslations);
        }
    });
    contentDiv.appendChild(createSettingGroup('optionNameLabel', '名称', nameInput, currentTranslations));

    if (option.type === 'interpret' || option.type === 'translate' || option.type === 'custom_prompt') {
        const availableModels = getSelectionAssistantModels();

        const modelSelect = createModelSelect(`option-model-${option.id}`, option.model, availableModels, option.id, 'model', state, saveSelectionAssistantConfig, currentTranslations);
        contentDiv.appendChild(createSettingGroup('modelLabel', '模型', modelSelect, currentTranslations));

        const promptTextarea = createTextarea(`option-prompt-${option.id}`, option.prompt, option.id, 'prompt', state, saveSelectionAssistantConfig, currentTranslations);
        contentDiv.appendChild(createSettingGroup('systemPromptLabel', '系统提示词', promptTextarea, currentTranslations));

        const tempSlider = createTemperatureSlider(`option-temp-${option.id}`, option.temperature, option.id, 'temperature', state, saveSelectionAssistantConfig, currentTranslations);
        contentDiv.appendChild(createSettingGroup('temperatureLabel', '温度', tempSlider, currentTranslations));
    } else if (option.type === 'chat') {
        const chatInfo = document.createElement('div');
        chatInfo.className = 'chat-type-info';
        chatInfo.textContent = _('chatOptionUsesPanelSettings', {}, currentTranslations) || '“对话”操作使用主聊天面板的设置。';
        contentDiv.appendChild(chatInfo);
    }
    return contentDiv;
}

function renderSelectionOptionsList(containerElement, optionsArray, currentTranslations, state, showToastCallback) {
    containerElement.innerHTML = '';

    optionsArray.forEach(option => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'selection-option-item';
        itemDiv.dataset.optionId = option.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'selection-option-name';
        nameSpan.textContent = option.name;

        // Drag Handle
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;
        dragHandle.title = _('dragToReorder', {}, currentTranslations) || '拖动排序';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'selection-option-actions';

        const editBtn = document.createElement('button');
        editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.813z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>`;
        editBtn.title = _('editOptionTooltip', {}, currentTranslations) || '编辑';

        let editContentDiv = itemDiv.querySelector('.selection-option-edit-content');

        editBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent item's own click/drag listeners if any
            // Close other open edit forms
            const allEditForms = containerElement.querySelectorAll('.selection-option-edit-content.open');
            allEditForms.forEach(form => {
                if (form !== editContentDiv) { // Don't close the one we are about to open/toggle
                    form.classList.remove('open');
                }
            });

            if (!editContentDiv || !itemDiv.contains(editContentDiv)) {
                editContentDiv = createEditableOptionCardContent(option, currentTranslations, state, showToastCallback);
                itemDiv.appendChild(editContentDiv);
                requestAnimationFrame(() => {
                    editContentDiv.classList.add('open');
                });
            } else {
                editContentDiv.classList.toggle('open');
            }
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-option-btn';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/></svg>`;
        deleteBtn.title = _('deleteOptionTooltip', {}, currentTranslations) || '删除';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(_('confirmDeleteOption', { name: option.name }, currentTranslations) || `确定删除 "${option.name}" 吗？`)) {
                state.selectionAssistantConfig.options = state.selectionAssistantConfig.options.filter(op => op.id !== option.id);
                saveSelectionAssistantConfig(state.selectionAssistantConfig, showToastCallback, currentTranslations);
                renderSelectionOptionsList(containerElement, state.selectionAssistantConfig.options, currentTranslations, state, showToastCallback);
            }
        };

        actionsDiv.appendChild(editBtn);
        if (!option.isDefault || option.type === 'custom_prompt') {
             actionsDiv.appendChild(deleteBtn);
        } else {
            deleteBtn.disabled = true;
            deleteBtn.title = _('cannotDeleteDefaultOptionTooltip', {}, currentTranslations) || '默认选项不能删除';
        }

        const headerContentDiv = document.createElement('div'); // Holds name and actions, excluding handle
        headerContentDiv.className = 'selection-option-header-content';
        headerContentDiv.appendChild(nameSpan);
        headerContentDiv.appendChild(actionsDiv);

        const headerDiv = document.createElement('div'); // Main header row for flex layout
        headerDiv.className = 'selection-option-item-header-row';
        headerDiv.appendChild(dragHandle);
        headerDiv.appendChild(headerContentDiv);

        itemDiv.appendChild(headerDiv);
        // Edit content div will be appended inside itemDiv by editBtn.onclick if needed

        // Drag and Drop Event Handlers
        itemDiv.draggable = true;
        itemDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', option.id);
            e.dataTransfer.effectAllowed = 'move';
            e.currentTarget.classList.add('dragging');
        });

        itemDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = e.currentTarget.getBoundingClientRect();
            const halfwayY = rect.top + rect.height / 2;
            if (e.clientY < halfwayY) {
                e.currentTarget.classList.add('drag-over-top');
                e.currentTarget.classList.remove('drag-over-bottom');
            } else {
                e.currentTarget.classList.add('drag-over-bottom');
                e.currentTarget.classList.remove('drag-over-top');
            }
        });
        itemDiv.addEventListener('dragleave', (e) => {
            e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        itemDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = option.id;

            if (draggedId === targetId) return;

            const options = state.selectionAssistantConfig.options;
            const draggedIndex = options.findIndex(opt => opt.id === draggedId);
            let targetIndex = options.findIndex(opt => opt.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            const [draggedItem] = options.splice(draggedIndex, 1);

            // Adjust targetIndex if draggedItem was removed from before it
            if (draggedIndex < targetIndex) targetIndex--;

            const rect = e.currentTarget.getBoundingClientRect();
            const halfwayY = rect.top + rect.height / 2;
            if (e.clientY < halfwayY) { // Dropped on top half
                 options.splice(targetIndex, 0, draggedItem);
            } else { // Dropped on bottom half
                 options.splice(targetIndex + 1, 0, draggedItem);
            }

            saveSelectionAssistantConfig(state.selectionAssistantConfig, showToastCallback, currentTranslations);
            renderSelectionOptionsList(containerElement, options, currentTranslations, state, showToastCallback);
        });

        itemDiv.addEventListener('dragend', (e) => {
            e.currentTarget.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
             // Clear all drag-over classes from other items as well
            containerElement.querySelectorAll('.selection-option-item').forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        });

        containerElement.appendChild(itemDiv);
    });

    const addBtn = document.createElement('button');
    addBtn.id = 'add-new-selection-option-btn';
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"/></svg> ` + (_('addNewOptionButton', {}, currentTranslations) || '添加新选项');
    addBtn.onclick = () => {
        const newOption = {
            id: generateSimpleId(),
            name: _('newActionDefaultName', {}, currentTranslations) || '新操作',
            type: 'custom_prompt',
            model: getSelectionAssistantModels()[0].value,
            prompt: _('newActionDefaultPrompt', {}, currentTranslations) || '请处理以下文本：',
            temperature: 0.5,
            isDefault: false
        };
        state.selectionAssistantConfig.options.push(newOption);
        saveSelectionAssistantConfig(state.selectionAssistantConfig, showToastCallback, currentTranslations);
        renderSelectionOptionsList(containerElement, state.selectionAssistantConfig.options, currentTranslations, state, showToastCallback);
        // TODO: Automatically open the edit interface for this new option by finding its new itemDiv and clicking its edit button.
        const newItemDiv = containerElement.querySelector(`.selection-option-item[data-option-id="${newOption.id}"]`);
        if (newItemDiv) {
            const newEditBtn = newItemDiv.querySelector('button[title="' + (_('editOptionTooltip', {}, currentTranslations) || '编辑') + '"]');
            if (newEditBtn) newEditBtn.click(); // Open edit area for the new item
        }
    };
    containerElement.appendChild(addBtn);
}


export function initSelectionAssistantSettings(settingsSectionElement, currentTranslations, state, showToastCallback) {
    if (!settingsSectionElement) return;
    settingsSectionElement.innerHTML = ''; // Clear previous content

    const title = document.createElement('h2');
    title.textContent = _('selectionAssistantSettingsTitle', {}, currentTranslations) || '划词助手设置';
    settingsSectionElement.appendChild(title);

    const listContainer = document.createElement('div');
    listContainer.id = 'selection-options-list-container';
    settingsSectionElement.appendChild(listContainer);

    // Load or initialize settings
    chrome.storage.sync.get('selectionAssistantConfig', (result) => {
        let currentConfig = result.selectionAssistantConfig;
        if (!currentConfig || !currentConfig.options || currentConfig.options.length === 0) {
            console.log('No selection assistant config found, initializing with defaults.');
            currentConfig = { options: getDefaultSelectionAssistantOptions(currentTranslations) };
            state.selectionAssistantConfig = currentConfig;
            saveSelectionAssistantConfig(currentConfig, showToastCallback, currentTranslations);
        } else {
            state.selectionAssistantConfig = currentConfig;
        }

        renderSelectionOptionsList(listContainer, state.selectionAssistantConfig.options, currentTranslations, state, showToastCallback);
    });

    const chatInfo = document.createElement('div');
    chatInfo.className = 'selection-assistant-info-text';
    chatInfo.textContent = _('chatSettingsInfo', {}, currentTranslations) || '“对话”功能相关的模型和助手设置，与主聊天面板的设置保持同步。';
    settingsSectionElement.appendChild(chatInfo);
}


// Old foldable card functions (to be removed as they are replaced by the list view)
/*
function createFoldableCard(id, titleKey, titleDefault, contentElements, currentTranslations, initiallyOpen = false) {
    const card = document.createElement('div');
    card.className = 'foldable-card';
    card.id = id;

    const header = document.createElement('div');
    header.className = 'foldable-card-header';

    const title = document.createElementspan();
    title.className = 'foldable-card-title';
    title.textContent = _(titleKey, {}, currentTranslations) || titleDefault;
    // If using data-i18n, set it: title.dataset.i18n = titleKey;

    const toggle = document.createElement('span');
    toggle.className = 'foldable-card-toggle';
    toggle.innerHTML = initiallyOpen ? '&#9660;' : '&#9654;'; // Down arrow if open, right arrow if closed

    header.appendChild(title);
    header.appendChild(toggle);
    card.appendChild(header);

    const content = document.createElement('div');
    content.className = 'foldable-card-content';
    contentElements.forEach(el => content.appendChild(el));
    card.appendChild(content);

    if (initiallyOpen) {
        header.classList.add('open');
        content.classList.add('open');
    }

    header.addEventListener('click', () => {
        header.classList.toggle('open');
        content.classList.toggle('open');
        toggle.innerHTML = content.classList.contains('open') ? '&#9660;' : '&#9654;';
    });

    return card;
}

function createSettingGroup(labelTextKey, labelDefaultText, inputElement, currentTranslations) {
    const group = document.createElement('div');
    group.className = 'setting-group';

    const label = document.createElement('label');
    label.textContent = _(labelTextKey, {}, currentTranslations) || labelDefaultText;
    // if (inputElement.id) label.htmlFor = inputElement.id; // Good practice if inputs have IDs

    group.appendChild(label);
    group.appendChild(inputElement);
    return group;
}

function createModelSelect(id, currentModel, modelsList) {
    const select = document.createElement('select');
    select.id = id;
    modelsList.forEach(modelInfo => {
        const option = document.createElement('option');
        option.value = modelInfo.value;
        option.textContent = modelInfo.text;
        if (modelInfo.value === currentModel) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    return select;
}

function createTextarea(id, value) {
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.value = value;
    return textarea;
}

function createTemperatureSlider(id, value, currentTranslations) {
    const container = document.createElement('div');
    container.className = 'temperature-control'; // For styling flex layout

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01'; // Finer control for display
    slider.value = value;

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'temperature-value';
    valueDisplay.textContent = parseFloat(value).toFixed(2);

    slider.addEventListener('input', () => {
        valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
    });

    container.appendChild(slider);
    container.appendChild(valueDisplay);
    return container;
}

function getSelectionAssistantModels() {
    // TODO: Fetch this from a shared source or js/api.js if dynamic
    // For now, using a fixed list similar to initModelSelection
    return [
        { value: 'gemini-1.5-flash-preview-0514', text: 'gemini-1.5-flash-preview-0514' }, // Updated default
        { value: 'gemini-2.0-flash', text: 'gemini-2.0-flash (Legacy)' }, // Example: mark older ones
        // Add other relevant models for selection tasks
    ];
}


export function initSelectionAssistantSettings(settingsSectionElement, currentTranslations, state) {
    if (!settingsSectionElement) return;
    settingsSectionElement.innerHTML = ''; // Clear previous content

    const title = document.createElement('h2');
    title.textContent = _('selectionAssistantSettingsTitle', {}, currentTranslations) || '划词助手设置';
    // title.dataset.i18n = 'selectionAssistantSettingsTitle'; // If using a global applyTranslations
    settingsSectionElement.appendChild(title);

    // Default settings structure (will be merged with loaded settings later)
    const defaults = {
        interpret: { model: 'gemini-1.5-flash-preview-0514', prompt: '解读以下文本：', temperature: 0.7 },
        translate: { model: 'gemini-1.5-flash-preview-0514', prompt: '将以下文本在中文和英文之间互译：', temperature: 0.2 }
    };
    // Actual settings will be loaded from storage, this is for UI structure
    const currentSettings = state.selectionAssistantSettings || defaults;


    const availableModels = getSelectionAssistantModels();

    // Interpret Card
    const interpretModelSelect = createModelSelect('interpret-model', currentSettings.interpret.model, availableModels);
    const interpretPromptTextarea = createTextarea('interpret-prompt', currentSettings.interpret.prompt);
    const interpretTempSlider = createTemperatureSlider('interpret-temp', currentSettings.interpret.temperature, currentTranslations);

    const interpretContent = [
        createSettingGroup('modelLabel', '模型', interpretModelSelect, currentTranslations),
        createSettingGroup('systemPromptLabel', '系统提示词', interpretPromptTextarea, currentTranslations),
        createSettingGroup('temperatureLabel', '温度', interpretTempSlider, currentTranslations)
    ];
    const interpretCard = createFoldableCard(
        'interpret-settings-card',
        'interpretSettingsCardTitle', '解读设置',
        interpretContent,
        currentTranslations,
        true // Initially open
    );
    settingsSectionElement.appendChild(interpretCard);

    // Translate Card
    const translateModelSelect = createModelSelect('translate-model', currentSettings.translate.model, availableModels);
    const translatePromptTextarea = createTextarea('translate-prompt', currentSettings.translate.prompt);
    const translateTempSlider = createTemperatureSlider('translate-temp', currentSettings.translate.temperature, currentTranslations);

    const translateContent = [
        createSettingGroup('modelLabel', '模型', translateModelSelect, currentTranslations),
        createSettingGroup('systemPromptLabel', '系统提示词', translatePromptTextarea, currentTranslations),
        createSettingGroup('temperatureLabel', '温度', translateTempSlider, currentTranslations)
    ];
    const translateCard = createFoldableCard(
        'translate-settings-card',
        'translateSettingsCardTitle', '翻译设置',
        translateContent,
        currentTranslations,
        true // Initially open
    );
    settingsSectionElement.appendChild(translateCard);

    // Chat Info Text
    const chatInfo = document.createElement('div');
    chatInfo.className = 'selection-assistant-info-text';
    chatInfo.textContent = _('chatSettingsInfo', {}, currentTranslations) || '“对话”功能相关的模型和助手设置，与主聊天面板的设置保持同步。';
    // chatInfo.dataset.i18n = 'chatSettingsInfo';
    settingsSectionElement.appendChild(chatInfo);

    // TODO: Add event listeners to inputs to save settings (Part 2)
    // TODO: Load settings from chrome.storage.sync (Part 2)

    // --- Add event listeners for saving ---
    const inputsToWatch = [
        // Interpret
        interpretModelSelect, interpretPromptTextarea,
        interpretTempSlider.querySelector('input[type="range"]'),
        // Translate
        translateModelSelect, translatePromptTextarea,
        translateTempSlider.querySelector('input[type="range"]')
    ];

    inputsToWatch.forEach(input => {
        const eventType = input.type === 'range' || input.type === 'select-one' ? 'change' : 'input';
        input.addEventListener(eventType, () => {
            const newSettings = {
                interpret: {
                    model: interpretModelSelect.value,
                    prompt: interpretPromptTextarea.value,
                    temperature: parseFloat(interpretTempSlider.querySelector('input[type="range"]').value)
                },
                translate: {
                    model: translateModelSelect.value,
                    prompt: translatePromptTextarea.value,
                    temperature: parseFloat(translateTempSlider.querySelector('input[type="range"]').value)
                }
            };
            // Update the global state if it's being used directly
            if (state && typeof state === 'object') {
                state.selectionAssistantSettings = newSettings;
            }
            // Save to chrome.storage.sync
            chrome.storage.sync.set({ selectionAssistantSettings: newSettings }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving selection assistant settings:", chrome.runtime.lastError);
                    // Optionally show an error toast to the user
                    if (typeof window.showToast === 'function') { // Assuming showToast is globally available or passed
                        window.showToast(_('saveFailedToast', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
                    }
                } else {
                    console.log("Selection assistant settings saved.", newSettings);
                    // Optionally show a success toast
                     if (typeof window.showToast === 'function') {
                         // Avoid spamming "saved" for every input, maybe only on explicit save button or after a delay
                         // For now, let's log it. A general "settings updated" could be shown less frequently.
                     }
                }
            });
        });
    });
}