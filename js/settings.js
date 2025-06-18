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
 * 获取当前翻译对象
 * @returns {Object} 当前翻译对象
 */
function getCurrentTranslations() {
    // 尝试从全局获取当前语言
    let currentLanguage = 'zh-CN';

    // 从localStorage获取语言设置
    if (typeof localStorage !== 'undefined') {
        currentLanguage = localStorage.getItem('language') || 'zh-CN';
    }

    // 从window.translations获取翻译
    if (typeof window !== 'undefined' && window.translations) {
        return window.translations[currentLanguage] || window.translations['zh-CN'] || {};
    }

    return {};
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

        // Proxy Address
        if (syncResult.proxyAddress) {
            state.proxyAddress = syncResult.proxyAddress;
        } else {
            state.proxyAddress = '';
        }
        if (elements.proxyAddressInput) elements.proxyAddressInput.value = state.proxyAddress;

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
        // No button to restore since we removed the save button
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
            console.log(`Proxy address saved: ${proxyAddress || '(empty)'}`);
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
 * Initializes model selection dropdowns using ModelManager.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 */
export async function initModelSelection(state, elements) {
    // 确保模型管理器已初始化
    if (!window.ModelManager?.instance) {
        console.error('[Settings] ModelManager not available');
        return;
    }

    const modelManager = window.ModelManager.instance;
    await modelManager.initialize();

    // 获取用户可用的模型选项
    const modelOptions = modelManager.getModelOptionsForUI();

    const populateSelect = (selectElement) => {
        if (!selectElement) return;
        selectElement.innerHTML = '';

        modelOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.disabled) {
                optionElement.disabled = true;
            }
            selectElement.appendChild(optionElement);
        });

        // 确保当前状态的模型被选中，或默认选择第一个
        if (modelOptions.some(o => o.value === state.model)) {
            selectElement.value = state.model;
        } else if (modelOptions.length > 0) {
            selectElement.value = modelOptions[0].value;
            state.model = modelOptions[0].value; // 如果模型无效则更新状态
        }
    };

    populateSelect(elements.modelSelection); // Settings tab
    populateSelect(elements.chatModelSelection); // Chat tab

    // 更新模型卡片显示
    updateModelCardsDisplay();

    console.log('[Settings] Model selection initialized with', modelOptions.length, 'models');
}

/**
 * 更新模型卡片显示
 */
export async function updateModelCardsDisplay() {
    const container = document.getElementById('selected-models-container');
    if (!container) return;

    if (!window.ModelManager?.instance) {
        console.error('[Settings] ModelManager not available for cards display');
        return;
    }

    const modelManager = window.ModelManager.instance;
    await modelManager.initialize();

    // 获取用户激活的模型
    const activeModels = modelManager.getUserActiveModels();

    // 获取当前翻译对象
    const currentTranslations = getCurrentTranslations();

    // 清空容器
    container.innerHTML = '';

    // 创建模型卡片
    activeModels.forEach(model => {
        const card = createModelCard(model, currentTranslations);
        container.appendChild(card);
    });
}

/**
 * 创建模型卡片
 * @param {Object} model - 模型对象
 * @param {Object} currentTranslations - 当前翻译对象
 * @returns {HTMLElement} 卡片元素
 */
function createModelCard(model, currentTranslations) {
    const card = document.createElement('div');
    card.className = 'model-card';
    card.dataset.modelId = model.id;

    const removeTooltip = _('removeModelTooltip', {}, currentTranslations);

    // 根据模型的canDelete属性决定是否显示删除按钮
    const canDelete = model.canDelete !== false; // 默认可删除，除非明确设置为false
    const removeButtonHtml = canDelete ? `
        <button class="model-card-remove" title="${removeTooltip}" aria-label="${removeTooltip}">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
    ` : '';

    card.innerHTML = `
        <span class="model-card-name" title="${model.displayName}">${model.displayName}</span>
        ${removeButtonHtml}
    `;

    // 只有可删除的模型才添加删除事件
    if (canDelete) {
        const removeBtn = card.querySelector('.model-card-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await removeModelFromSelection(model.id);
            });
        }
    }

    return card;
}

/**
 * 从选择中移除模型
 * @param {string} modelId - 模型ID
 */
async function removeModelFromSelection(modelId) {
    if (!window.ModelManager?.instance) {
        console.error('[Settings] ModelManager not available for model removal');
        return;
    }

    const modelManager = window.ModelManager.instance;
    await modelManager.initialize();

    // 检查模型是否可以删除
    const model = modelManager.getModelById(modelId);
    if (!model) {
        console.error('[Settings] Model not found:', modelId);
        return;
    }

    if (model.canDelete === false) {
        const currentTranslations = getCurrentTranslations();
        alert(_('cannotRemoveProtectedModel', {}, currentTranslations) || '无法删除受保护的模型');
        return;
    }

    // 检查是否是最后一个模型
    const activeModels = modelManager.getUserActiveModels();
    if (activeModels.length <= 1) {
        const currentTranslations = getCurrentTranslations();
        alert(_('minOneModelError', {}, currentTranslations));
        return;
    }

    // 从激活列表中移除（但保留在管理列表中，以便重新发现）
    await modelManager.removeModel(modelId);

    // 更新UI
    await updateModelCardsDisplay();

    // 重新填充下拉选择器
    const modelSelection = document.getElementById('model-selection');
    const chatModelSelection = document.getElementById('chat-model-selection');
    if (modelSelection || chatModelSelection) {
        const modelOptions = modelManager.getModelOptionsForUI();

        [modelSelection, chatModelSelection].forEach(selectElement => {
            if (!selectElement) return;

            const currentValue = selectElement.value;
            selectElement.innerHTML = '';

            modelOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                selectElement.appendChild(optionElement);
            });

            // 如果当前选中的模型被删除了，选择第一个可用的
            if (modelOptions.some(o => o.value === currentValue)) {
                selectElement.value = currentValue;
            } else if (modelOptions.length > 0) {
                selectElement.value = modelOptions[0].value;
            }
        });
    }

    console.log(`[Settings] Removed model: ${modelId}`);
}

/**
 * 处理获取新模型按钮点击
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} showToastCallback - Toast notification callback
 * @param {object} currentTranslations - Translations object
 */
export async function handleDiscoverModels(state, elements, showToastCallback, currentTranslations) {
    if (!state.apiKey) {
        showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        return;
    }

    if (!window.ModelManager?.instance) {
        showToastCallback(_('modelManagerUnavailable', {}, currentTranslations), 'error');
        return;
    }

    const discoverBtn = elements.discoverModelsBtn;
    if (discoverBtn) {
        discoverBtn.disabled = true;
        discoverBtn.textContent = _('fetchingModels', {}, currentTranslations);
    }

    try {
        const modelManager = window.ModelManager.instance;
        await modelManager.initialize();

        // 从API获取可用模型
        const discoveredModels = await modelManager.fetchAvailableModels(state.apiKey);

        // 获取新模型（排除已存在的）
        const newModels = modelManager.getNewDiscoveredModels(discoveredModels);

        if (newModels.length === 0) {
            showToastCallback(_('noNewModelsFound', {}, currentTranslations), 'info');
            return;
        }

        // 显示模型选择对话框
        showModelSelectionDialog(newModels, currentTranslations, async (selectedModelIds) => {
            if (selectedModelIds.length > 0) {
                const result = await modelManager.addDiscoveredModels(discoveredModels, selectedModelIds);

                // 激活新添加的模型
                for (const modelId of selectedModelIds) {
                    await modelManager.activateModel(modelId);
                }

                // 重新初始化模型选择器和卡片显示
                await initModelSelection(state, elements);
                await updateModelCardsDisplay();

                const totalCount = result.added + (result.activated || 0);
                if (totalCount > 0) {
                    let message = '';
                    if (result.added > 0 && result.activated > 0) {
                        message = _('modelsAddedAndReactivatedSuccess', {
                            added: result.added,
                            activated: result.activated
                        }, currentTranslations);
                    } else if (result.added > 0) {
                        message = _('modelsAddedSuccess', { count: result.added }, currentTranslations);
                    } else if (result.activated > 0) {
                        message = _('modelsReactivatedSuccess', { count: result.activated }, currentTranslations);
                    }
                    showToastCallback(message, 'success');
                } else {
                    showToastCallback(_('noNewModelsFound', {}, currentTranslations), 'info');
                }
            }
        });

    } catch (error) {
        console.error('[Settings] Failed to discover models:', error);
        showToastCallback(_('fetchModelsError', { error: error.message }, currentTranslations), 'error');
    } finally {
        if (discoverBtn) {
            discoverBtn.disabled = false;
            discoverBtn.textContent = _('addModelsButton', {}, currentTranslations);
        }
    }
}

/**
 * 显示模型选择对话框
 * @param {Array} models - 可选择的模型列表
 * @param {Object} currentTranslations - 当前翻译对象
 * @param {function} onConfirm - 确认回调函数
 */
function showModelSelectionDialog(models, currentTranslations, onConfirm) {
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'model-discovery-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>${_('addModelsDialogTitle', {}, currentTranslations)}</h3>
                    <button type="button" class="close-btn" aria-label="${_('addModelsDialogClose', {}, currentTranslations)}">×</button>
                </div>
                <div class="dialog-body">
                    <p class="model-count">${_('modelsFoundMessage', { count: models.length }, currentTranslations)}</p>
                    <div class="model-list">
                        ${models.map(model => `
                            <div class="model-item" data-model-id="${model.id}">
                                <span class="model-name">${model.id}</span>
                                <div class="model-checkbox">
                                    <input type="checkbox" id="model-${model.id}" value="${model.id}">
                                    <label for="model-${model.id}" class="checkbox-label">
                                        <svg class="checkmark" viewBox="0 0 24 24">
                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                        </svg>
                                    </label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="dialog-footer">
                    <div class="selection-info">
                        <span class="selected-count">${_('selectedCountMessage', { count: 0 }, currentTranslations)}</span>
                    </div>
                    <div class="dialog-actions">
                        <button type="button" class="cancel-btn">${_('addModelsCancel', {}, currentTranslations)}</button>
                        <button type="button" class="confirm-btn" disabled>${_('addModelsConfirm', {}, currentTranslations)}</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .model-discovery-dialog .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        }

        .model-discovery-dialog .dialog-content {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
            width: 90vw;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .model-discovery-dialog .dialog-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px 24px 16px 24px;
            border-bottom: 1px solid #e9ecef;
        }

        .model-discovery-dialog .dialog-header h3 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
        }

        .model-discovery-dialog .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            color: #6c757d;
            cursor: pointer;
            padding: 4px;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .model-discovery-dialog .close-btn:hover {
            background: #f8f9fa;
            color: #495057;
        }

        .model-discovery-dialog .dialog-body {
            flex: 1;
            padding: 16px 24px;
            overflow-y: auto;
        }

        .model-discovery-dialog .model-count {
            margin: 0 0 20px 0;
            color: #6c757d;
            font-size: 14px;
        }

        .model-discovery-dialog .model-list {
            display: grid;
            gap: 8px;
            max-height: 400px;
            overflow-y: auto;
            padding-right: 8px;
        }

        .model-discovery-dialog .model-list::-webkit-scrollbar {
            width: 6px;
        }

        .model-discovery-dialog .model-list::-webkit-scrollbar-track {
            background: #f1f3f4;
            border-radius: 3px;
        }

        .model-discovery-dialog .model-list::-webkit-scrollbar-thumb {
            background: #c1c8cd;
            border-radius: 3px;
        }

        .model-discovery-dialog .model-list::-webkit-scrollbar-thumb:hover {
            background: #a8b2ba;
        }

        .model-discovery-dialog .model-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #ffffff;
        }

        .model-discovery-dialog .model-item:hover {
            border-color: #007bff;
            background: #f8f9ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 123, 255, 0.1);
        }

        .model-discovery-dialog .model-item.selected {
            border-color: #007bff;
            background: #e7f3ff;
        }

        .model-discovery-dialog .model-name {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            font-size: 14px;
            font-weight: 500;
            color: #2c3e50;
            flex: 1;
        }

        .model-discovery-dialog .model-checkbox {
            position: relative;
        }

        .model-discovery-dialog .model-checkbox input[type="checkbox"] {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }

        .model-discovery-dialog .checkbox-label {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border: 2px solid #dee2e6;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: white;
        }

        .model-discovery-dialog .checkbox-label:hover {
            border-color: #007bff;
            background: #f8f9ff;
        }

        .model-discovery-dialog .checkmark {
            width: 14px;
            height: 14px;
            fill: white;
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.2s ease;
        }

        .model-discovery-dialog input[type="checkbox"]:checked + .checkbox-label {
            background: #007bff;
            border-color: #007bff;
        }

        .model-discovery-dialog input[type="checkbox"]:checked + .checkbox-label .checkmark {
            opacity: 1;
            transform: scale(1);
        }

        .model-discovery-dialog .dialog-footer {
            padding: 16px 24px 24px 24px;
            border-top: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .model-discovery-dialog .selection-info {
            color: #6c757d;
            font-size: 14px;
        }

        .model-discovery-dialog .selected-count {
            font-weight: 500;
        }

        .model-discovery-dialog .dialog-actions {
            display: flex;
            gap: 12px;
        }

        .model-discovery-dialog .dialog-actions button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            min-width: 80px;
        }

        .model-discovery-dialog .cancel-btn {
            background: #f8f9fa;
            color: #6c757d;
            border: 1px solid #dee2e6;
        }

        .model-discovery-dialog .cancel-btn:hover {
            background: #e9ecef;
            color: #495057;
        }

        .model-discovery-dialog .confirm-btn {
            background: #007bff;
            color: white;
        }

        .model-discovery-dialog .confirm-btn:hover:not(:disabled) {
            background: #0056b3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        }

        .model-discovery-dialog .confirm-btn:disabled {
            background: #dee2e6;
            color: #6c757d;
            cursor: not-allowed;
        }

        /* 深色模式适配 */
        body.dark-mode .model-discovery-dialog .dialog-content {
            background: var(--card-background);
            color: var(--text-color);
        }

        body.dark-mode .model-discovery-dialog .dialog-header {
            border-bottom-color: var(--border-color);
        }

        body.dark-mode .model-discovery-dialog .dialog-header h3 {
            color: var(--text-color);
        }

        body.dark-mode .model-discovery-dialog .close-btn {
            color: var(--text-secondary);
        }

        body.dark-mode .model-discovery-dialog .close-btn:hover {
            background: var(--button-hover-bg);
            color: var(--text-color);
        }

        body.dark-mode .model-discovery-dialog .model-count {
            color: var(--text-secondary);
        }

        body.dark-mode .model-discovery-dialog .model-list::-webkit-scrollbar-track {
            background: var(--background-color);
        }

        body.dark-mode .model-discovery-dialog .model-list::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
        }

        body.dark-mode .model-discovery-dialog .model-list::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        body.dark-mode .model-discovery-dialog .model-item {
            background: var(--background-color);
            border-color: var(--border-color);
        }

        body.dark-mode .model-discovery-dialog .model-item:hover {
            border-color: var(--primary-color);
            background: rgba(116, 143, 252, 0.1);
        }

        body.dark-mode .model-discovery-dialog .model-item.selected {
            border-color: var(--primary-color);
            background: rgba(116, 143, 252, 0.2);
        }

        body.dark-mode .model-discovery-dialog .model-name {
            color: var(--text-color);
        }

        body.dark-mode .model-discovery-dialog .checkbox-label {
            background: var(--input-background);
            border-color: var(--border-color);
        }

        body.dark-mode .model-discovery-dialog .checkbox-label:hover {
            border-color: var(--primary-color);
            background: rgba(116, 143, 252, 0.1);
        }

        body.dark-mode .model-discovery-dialog input[type="checkbox"]:checked + .checkbox-label {
            background: var(--primary-color);
            border-color: var(--primary-color);
        }

        body.dark-mode .model-discovery-dialog .dialog-footer {
            border-top-color: var(--border-color);
        }

        body.dark-mode .model-discovery-dialog .selection-info {
            color: var(--text-secondary);
        }

        body.dark-mode .model-discovery-dialog .cancel-btn {
            background: var(--button-hover-bg);
            color: var(--text-secondary);
            border-color: var(--border-color);
        }

        body.dark-mode .model-discovery-dialog .cancel-btn:hover {
            background: var(--border-color);
            color: var(--text-color);
        }

        body.dark-mode .model-discovery-dialog .confirm-btn {
            background: var(--primary-color);
            color: white;
        }

        body.dark-mode .model-discovery-dialog .confirm-btn:hover:not(:disabled) {
            background: var(--secondary-color);
        }

        body.dark-mode .model-discovery-dialog .confirm-btn:disabled {
            background: var(--border-color);
            color: var(--text-secondary);
        }

        @media (max-width: 768px) {
            .model-discovery-dialog .dialog-content {
                width: 95vw;
                max-height: 90vh;
            }

            .model-discovery-dialog .dialog-header,
            .model-discovery-dialog .dialog-body,
            .model-discovery-dialog .dialog-footer {
                padding-left: 16px;
                padding-right: 16px;
            }

            .model-discovery-dialog .model-item {
                padding: 12px 16px;
            }
        }
    `;
    document.head.appendChild(style);

    // 事件处理
    const cancelBtn = dialog.querySelector('.cancel-btn');
    const confirmBtn = dialog.querySelector('.confirm-btn');
    const closeBtn = dialog.querySelector('.close-btn');
    const selectedCountSpan = dialog.querySelector('.selected-count');
    const modelItems = dialog.querySelectorAll('.model-item');
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');

    // 更新选中计数
    function updateSelectedCount() {
        const checkedCount = dialog.querySelectorAll('input[type="checkbox"]:checked').length;
        selectedCountSpan.textContent = _('selectedCountMessage', { count: checkedCount }, currentTranslations);
        confirmBtn.disabled = checkedCount === 0;
    }

    // 关闭对话框
    function closeDialog() {
        document.body.removeChild(dialog);
        document.head.removeChild(style);
    }

    // 模型项点击事件
    modelItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // 如果点击的是checkbox或label，不处理（让默认行为处理）
            if (e.target.type === 'checkbox' || e.target.classList.contains('checkbox-label') || e.target.closest('.checkbox-label')) {
                return;
            }

            // 点击模型项其他区域时，切换checkbox状态
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;

            // 更新视觉状态
            if (checkbox.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }

            updateSelectedCount();
        });
    });

    // Checkbox变化事件
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const item = e.target.closest('.model-item');
            if (e.target.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
            updateSelectedCount();
        });
    });

    // 按钮事件
    cancelBtn.addEventListener('click', closeDialog);
    closeBtn.addEventListener('click', closeDialog);

    confirmBtn.addEventListener('click', () => {
        const checkedBoxes = dialog.querySelectorAll('input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);

        closeDialog();
        onConfirm(selectedIds);
    });

    // 点击遮罩关闭
    dialog.querySelector('.dialog-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeDialog();
        }
    });

    // ESC键关闭
    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', handleKeyDown);
        }
    }
    document.addEventListener('keydown', handleKeyDown);

    // 初始化选中计数
    updateSelectedCount();

    document.body.appendChild(dialog);
}