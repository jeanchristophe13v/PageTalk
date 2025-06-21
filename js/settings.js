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

    // 优先从全局状态获取语言设置
    if (typeof window !== 'undefined' && window.state && window.state.language) {
        currentLanguage = window.state.language;
    }
    // 从localStorage获取语言设置
    else if (typeof localStorage !== 'undefined') {
        currentLanguage = localStorage.getItem('language') || 'zh-CN';
    }

    // 从window.translations获取翻译
    if (typeof window !== 'undefined' && window.translations) {
        const translations = window.translations[currentLanguage] || window.translations['zh-CN'] || {};
        console.debug('[Settings] getCurrentTranslations:', currentLanguage, Object.keys(translations).length, 'keys');
        return translations;
    }

    console.warn('[Settings] No translations available, returning empty object');
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
    // 设置全局变量以便动态创建的按钮可以访问
    window.settingsState = state;
    window.settingsElements = elements;

    // 监听语言变化事件，更新动态创建的UI元素
    document.addEventListener('pagetalk:languageChanged', (event) => {
        console.log('[Settings] Received language change event:', event.detail);
        const newLanguage = event.detail.newLanguage;

        // 更新手动添加按钮的翻译
        const currentTranslations = getCurrentTranslations();
        updateManualAddButton(currentTranslations);

        console.log('[Settings] Updated manual add button for language:', newLanguage);
    });

    chrome.storage.sync.get(['apiKey', 'model', 'language', 'proxyAddress', 'providerSettings'], async (syncResult) => {
        // 初始化 ModelManager
        if (window.ModelManager?.instance) {
            try {
                await window.ModelManager.instance.initialize();
            } catch (error) {
                console.error('[Settings] Failed to initialize ModelManager:', error);
            }
        }

        // 处理旧版本兼容性 - API Key 和模型
        if (syncResult.apiKey) {
            // 旧版本的 API Key，迁移到 Google 供应商设置
            state.apiKey = syncResult.apiKey;
            if (window.ModelManager?.instance) {
                await window.ModelManager.instance.setProviderApiKey('google', syncResult.apiKey);
            }
        }
        if (syncResult.model) state.model = syncResult.model;

        // 加载自定义提供商
        await window.ProviderManager?.loadCustomProviders();

        // 创建所有供应商的设置UI
        await createAllProviderSettings();

        // 加载供应商设置到 UI
        await loadProviderSettingsToUI(elements);

        // 初始化供应商选择器
        await initProviderSelection(elements);

        // 初始化自定义提供商功能
        initCustomProviderModal();

        // 设置模型选择器
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

        // Connection Status (检查是否有任何供应商配置了 API Key)
        state.isConnected = await checkAnyProviderConnected();
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
        // 使用新的统一 API 测试接口
        testResult = await window.PageTalkAPI.testApiKey('google', apiKey, model);

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
        showToastCallback(_('proxyInvalidUrl', {}, currentTranslations), 'error');
        return;
    }

    // 禁用测试按钮并显示加载状态
    const testBtn = elements.testProxyBtn;
    const originalText = testBtn.textContent;
    testBtn.disabled = true;
    testBtn.textContent = _('testingConnection', {}, currentTranslations);

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
            showToastCallback(_('proxySetError', { error: chrome.runtime.lastError.message }, currentTranslations), 'error');
            return;
        }

        if (response && response.success) {
            showToastCallback(_('proxySetSuccess', {}, currentTranslations), 'success');
        } else {
            const errorMsg = response?.error || 'Connection failed';
            showToastCallback(_('proxySetError', { error: errorMsg }, currentTranslations), 'error');
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

    // 填充选择器的通用函数 - 按提供商分组
    const populateSelect = (selectElement) => {
        if (!selectElement) return;
        selectElement.innerHTML = '';

        // 按提供商分组模型
        const modelsByProvider = {};
        modelOptions.forEach(option => {
            const providerId = option.providerId || 'unknown';
            const providerName = option.providerName || 'Unknown';

            if (!modelsByProvider[providerId]) {
                modelsByProvider[providerId] = {
                    name: providerName,
                    models: []
                };
            }
            modelsByProvider[providerId].models.push(option);
        });

        // 按提供商名称排序
        const sortedProviders = Object.entries(modelsByProvider).sort(([, a], [, b]) =>
            a.name.localeCompare(b.name)
        );

        // 为每个提供商创建 optgroup
        sortedProviders.forEach(([providerId, providerData]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = providerData.name;
            optgroup.setAttribute('data-provider-id', providerId);

            // 按模型名称排序
            const sortedModels = providerData.models.sort((a, b) => a.text.localeCompare(b.text));

            sortedModels.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text; // 不再显示提供商名称，因为已经分组了
                if (option.disabled) {
                    optionElement.disabled = true;
                }
                // 添加数据属性用于样式控制
                optionElement.setAttribute('data-provider-id', option.providerId || '');
                optionElement.setAttribute('data-provider-name', option.providerName || '');
                optgroup.appendChild(optionElement);
            });

            selectElement.appendChild(optgroup);
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

    // 添加或更新手动添加按钮到header区域
    updateManualAddButton(currentTranslations);
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
 * 更新手动添加模型按钮到header区域
 * @param {Object} currentTranslations - 当前翻译对象
 */
function updateManualAddButton(currentTranslations) {
    const header = document.querySelector('.model-management-header');
    if (!header) return;

    // 移除已存在的按钮
    const existingButton = header.querySelector('.manual-add-model-btn');
    if (existingButton) {
        existingButton.remove();
    }

    // 创建新按钮
    const button = createManualAddButton(currentTranslations);
    header.appendChild(button);
}

/**
 * 创建手动添加模型按钮
 * @param {Object} currentTranslations - 当前翻译对象
 * @returns {HTMLElement} 按钮元素
 */
function createManualAddButton(currentTranslations) {
    const button = document.createElement('button');
    button.className = 'manual-add-model-btn';
    button.title = _('manualAddModel', {}, currentTranslations);
    button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <span>${_('manualAddModel', {}, currentTranslations)}</span>
    `;

    // 添加点击事件监听器
    button.addEventListener('click', () => {
        // 获取最新的翻译对象
        const latestTranslations = getCurrentTranslations();
        showManualAddModelDialog(latestTranslations);
    });

    return button;
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

            // 按提供商分组模型
            const modelsByProvider = {};
            modelOptions.forEach(option => {
                const providerId = option.providerId || 'unknown';
                const providerName = option.providerName || 'Unknown';

                if (!modelsByProvider[providerId]) {
                    modelsByProvider[providerId] = {
                        name: providerName,
                        models: []
                    };
                }
                modelsByProvider[providerId].models.push(option);
            });

            // 按提供商名称排序
            const sortedProviders = Object.entries(modelsByProvider).sort(([, a], [, b]) =>
                a.name.localeCompare(b.name)
            );

            // 为每个提供商创建 optgroup
            sortedProviders.forEach(([providerId, providerData]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = providerData.name;
                optgroup.setAttribute('data-provider-id', providerId);

                // 按模型名称排序
                const sortedModels = providerData.models.sort((a, b) => a.text.localeCompare(b.text));

                sortedModels.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.value;
                    optionElement.textContent = option.text;
                    // 添加数据属性用于样式控制
                    optionElement.setAttribute('data-provider-id', option.providerId || '');
                    optionElement.setAttribute('data-provider-name', option.providerName || '');
                    optgroup.appendChild(optionElement);
                });

                selectElement.appendChild(optgroup);
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
 * 显示模型选择对话框
 * @param {Array} models - 可选择的模型列表
 * @param {Object} currentTranslations - 当前翻译对象
 * @param {function} onConfirm - 确认回调函数
 * @param {function} onCancel - 取消回调函数（可选）
 */
function showModelSelectionDialog(models, currentTranslations, onConfirm, onCancel = null) {
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
                    <div class="search-container">
                        <input type="text" class="model-search-input" placeholder="${_('searchModelsPlaceholder', {}, currentTranslations)}" autocomplete="off">
                        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </div>
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

        .model-discovery-dialog .search-container {
            position: relative;
            margin-bottom: 16px;
        }

        .model-discovery-dialog .model-search-input {
            width: 100%;
            padding: 12px 16px 12px 40px;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            font-size: 14px;
            background: #ffffff;
            transition: all 0.2s ease;
            outline: none;
            box-sizing: border-box;
        }

        .model-discovery-dialog .model-search-input:focus {
            border-color: #007bff;
            background: #f8f9ff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .model-discovery-dialog .search-icon {
            position: absolute;
            left: 12px;
            top: 14px;
            width: 16px;
            height: 16px;
            color: #6c757d;
            pointer-events: none;
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

        body.dark-mode .model-discovery-dialog .model-search-input {
            background: var(--input-background);
            border-color: var(--border-color);
            color: var(--text-color);
        }

        body.dark-mode .model-discovery-dialog .model-search-input:focus {
            border-color: var(--primary-color);
            background: rgba(116, 143, 252, 0.1);
            box-shadow: 0 0 0 3px rgba(116, 143, 252, 0.2);
        }

        body.dark-mode .model-discovery-dialog .search-icon {
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
    const searchInput = dialog.querySelector('.model-search-input');
    const modelList = dialog.querySelector('.model-list');
    const modelItems = dialog.querySelectorAll('.model-item');
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');

    // 搜索过滤功能
    function filterModels(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        modelItems.forEach(item => {
            const modelName = item.querySelector('.model-name').textContent.toLowerCase();
            const matches = modelName.includes(term);

            if (matches) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

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
        // 调用取消回调（如果提供）
        if (onCancel && typeof onCancel === 'function') {
            onCancel();
        }
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

    // 搜索输入事件
    searchInput.addEventListener('input', (e) => {
        filterModels(e.target.value);
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

// === 多供应商支持函数 ===

/**
 * 初始化供应商选择器
 */
async function initProviderSelection(elements) {
    const providerSelect = document.getElementById('provider-select');
    if (!providerSelect) return;

    // 获取供应商选项
    const providerOptions = window.ProviderManager?.getProviderOptionsForUI() || [];

    // 清空并填充选项
    providerSelect.innerHTML = '';
    providerOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        providerSelect.appendChild(optionElement);
    });

    // 设置默认选择（Google）
    providerSelect.value = 'google';

    // 显示对应的供应商设置
    await showProviderSettings('google');

    // 监听供应商切换
    providerSelect.addEventListener('change', async (e) => {
        await showProviderSettings(e.target.value);
    });
}

/**
 * 显示指定供应商的设置区域
 */
async function showProviderSettings(providerId) {
    // 隐藏所有供应商设置
    const allProviderSettings = document.querySelectorAll('.provider-settings');
    allProviderSettings.forEach(setting => {
        setting.style.display = 'none';
    });

    // 显示选中的供应商设置
    let targetSettings = document.getElementById(`provider-settings-${providerId}`);

    // 如果设置区域不存在，创建它
    if (!targetSettings) {
        const provider = window.ProviderManager?.getProvider(providerId);
        if (provider) {
            console.log(`[Settings] Creating settings area for provider: ${providerId}`);
            await createAllProviderSettings();
            targetSettings = document.getElementById(`provider-settings-${providerId}`);
        }
    }

    if (targetSettings) {
        targetSettings.style.display = 'block';
    } else {
        console.warn(`[Settings] Settings area not found for provider: ${providerId}`);
    }
}

/**
 * 加载供应商设置到 UI
 */
async function loadProviderSettingsToUI(elements) {
    if (!window.ModelManager?.instance) return;

    // 首先确保为所有供应商创建设置区域
    await createAllProviderSettings();

    const modelManager = window.ModelManager.instance;
    const providerIds = window.ProviderManager?.getProviderIds() || [];

    for (const providerId of providerIds) {
        const apiKey = modelManager.getProviderApiKey(providerId);
        const apiKeyInput = document.getElementById(`${providerId}-api-key`);

        if (apiKeyInput && apiKey) {
            apiKeyInput.value = apiKey;
        }
    }
}

/**
 * 检查是否有任何供应商已连接
 */
async function checkAnyProviderConnected() {
    if (!window.ModelManager?.instance) return false;

    const modelManager = window.ModelManager.instance;
    const providerIds = window.ProviderManager?.getProviderIds() || [];

    for (const providerId of providerIds) {
        if (modelManager.isProviderConfigured(providerId)) {
            return true;
        }
    }
    return false;
}

/**
 * 设置供应商事件监听器
 */
export function setupProviderEventListeners(state, elements, showToastCallback, updateConnectionIndicatorCallback) {
    // 使用事件委托来处理动态创建的元素
    const container = document.querySelector('.provider-settings-container');
    if (!container) return;

    // 防止重复绑定事件监听器
    if (container.dataset.eventListenersSetup === 'true') {
        console.log('[Settings] Provider event listeners already setup, skipping...');
        return;
    }
    container.dataset.eventListenersSetup = 'true';

    // API Key 可见性切换 - 使用事件委托
    container.addEventListener('click', (e) => {
        if (e.target.closest('.toggle-api-key-button')) {
            console.log('[Settings] Toggle API key button clicked via event delegation');
            const button = e.target.closest('.toggle-api-key-button');
            const targetId = button.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const eyeIcon = button.querySelector('.eye-icon');
            const eyeSlashIcon = button.querySelector('.eye-slash-icon');

            console.log('[Settings] Target input:', targetId, input);
            console.log('[Settings] Eye icons:', eyeIcon, eyeSlashIcon);

            if (input && input.type === 'password') {
                input.type = 'text';
                eyeIcon.style.display = 'none';
                eyeSlashIcon.style.display = 'block';
                console.log('[Settings] Changed to text type');
            } else if (input) {
                input.type = 'password';
                eyeIcon.style.display = 'block';
                eyeSlashIcon.style.display = 'none';
                console.log('[Settings] Changed to password type');
            }
        }
    });

    // API Key 输入事件 - 使用事件委托
    container.addEventListener('blur', async (e) => {
        if (e.target.matches('[id$="-api-key"]')) {
            const input = e.target;
            const providerId = input.id.replace('-api-key', '');
            const apiKey = input.value.trim();

            if (window.ModelManager?.instance) {
                await window.ModelManager.instance.setProviderApiKey(providerId, apiKey);

                // 更新连接状态
                state.isConnected = await checkAnyProviderConnected();
                // 调用更新连接指示器的回调
                if (updateConnectionIndicatorCallback) {
                    updateConnectionIndicatorCallback();
                }
            }
        }
    }, true); // 使用捕获阶段

    // 测试连接按钮 - 使用事件委托
    container.addEventListener('click', async (e) => {
        if (e.target.closest('.test-api-key-btn')) {
            const button = e.target.closest('.test-api-key-btn');
            const providerId = button.getAttribute('data-provider');
            await handleTestApiKey(providerId, showToastCallback);
        }
    });

    // 发现模型按钮 - 使用事件委托
    container.addEventListener('click', async (e) => {
        if (e.target.closest('.discover-models-btn')) {
            const button = e.target.closest('.discover-models-btn');
            const providerId = button.getAttribute('data-provider');
            await handleDiscoverModelsForProvider(providerId, state, elements, showToastCallback);
        }
    });
}

/**
 * 处理 API Key 测试
 */
async function handleTestApiKey(providerId, showToastCallback) {
    const currentTranslations = getCurrentTranslations();

    if (!window.PageTalkAPI?.testApiKey) {
        showToastCallback(_('modelManagerUnavailable', {}, currentTranslations), 'error');
        return;
    }

    if (!window.ModelManager?.instance) {
        showToastCallback(_('modelManagerUnavailable', {}, currentTranslations), 'error');
        return;
    }

    const modelManager = window.ModelManager.instance;
    const apiKey = modelManager.getProviderApiKey(providerId);

    if (!apiKey) {
        showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        return;
    }

    const testButton = document.querySelector(`.test-api-key-btn[data-provider="${providerId}"]`);
    if (!testButton) {
        console.error(`[Settings] Test button not found for provider: ${providerId}`);
        return;
    }

    const originalText = testButton.textContent;

    try {
        testButton.disabled = true;
        testButton.textContent = _('testingConnection', {}, currentTranslations);

        const result = await window.PageTalkAPI.testApiKey(providerId, apiKey);

        if (result.success) {
            showToastCallback(result.message, 'success');
        } else {
            showToastCallback(result.message, 'error');
        }
    } catch (error) {
        console.error(`[Settings] Test API Key failed for ${providerId}:`, error);
        showToastCallback(_('connectionTestFailed', { error: error.message }, currentTranslations), 'error');
    } finally {
        if (testButton) {
            testButton.disabled = false;
            testButton.textContent = originalText;
        }
    }
}

/**
 * 处理指定供应商的模型发现
 */
async function handleDiscoverModelsForProvider(providerId, state, elements, showToastCallback) {
    const currentTranslations = getCurrentTranslations();

    if (!window.PageTalkAPI?.fetchModels) {
        showToastCallback(_('modelManagerUnavailable', {}, currentTranslations), 'error');
        return;
    }

    if (!window.ModelManager?.instance) {
        showToastCallback(_('modelManagerUnavailable', {}, currentTranslations), 'error');
        return;
    }

    const modelManager = window.ModelManager.instance;
    const apiKey = modelManager.getProviderApiKey(providerId);

    if (!apiKey) {
        showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        return;
    }

    const discoverButton = document.querySelector(`.discover-models-btn[data-provider="${providerId}"]`);
    if (!discoverButton) {
        console.error(`[Settings] Discover button not found for provider: ${providerId}`);
        return;
    }

    const originalText = discoverButton.textContent;

    // 恢复按钮状态的函数
    const restoreButtonState = () => {
        if (discoverButton) {
            discoverButton.disabled = false;
            discoverButton.textContent = originalText;
        }
    };

    try {
        discoverButton.disabled = true;
        discoverButton.textContent = _('discoveringModels', {}, currentTranslations);

        // 获取可用模型
        const discoveredModels = await window.PageTalkAPI.fetchModels(providerId);

        if (!discoveredModels || discoveredModels.length === 0) {
            showToastCallback(_('noNewModelsFound', {}, currentTranslations), 'info');
            return;
        }

        // 使用 ModelManager 的方法获取可添加的模型（包括被停用的模型）
        const newModels = modelManager.getNewDiscoveredModels(discoveredModels, providerId);

        if (newModels.length === 0) {
            showToastCallback(_('noNewModelsFound', {}, currentTranslations), 'info');
            return;
        }

        // 显示模型选择对话框
        showModelSelectionDialog(newModels, currentTranslations, async (selectedModelIds) => {
            try {
                if (selectedModelIds.length > 0) {
                    // 使用 ModelManager 的批量添加方法
                    const result = await modelManager.addDiscoveredModels(discoveredModels, selectedModelIds);
                    const totalProcessed = result.added + result.activated;

                    if (totalProcessed > 0) {
                        // 重新初始化模型选择器和卡片显示
                        await initModelSelection(state, elements);
                        await updateModelCardsDisplay();

                        if (result.added > 0 && result.activated > 0) {
                            showToastCallback(_('modelsAddedAndReactivatedSuccess', { added: result.added, activated: result.activated }, currentTranslations), 'success');
                        } else if (result.added > 0) {
                            showToastCallback(_('modelsAddedSuccess', { count: result.added }, currentTranslations), 'success');
                        } else if (result.activated > 0) {
                            showToastCallback(_('modelsReactivatedSuccess', { count: result.activated }, currentTranslations), 'success');
                        }
                    } else {
                        showToastCallback(_('fetchModelsError', { error: 'Unknown error' }, currentTranslations), 'error');
                    }
                }
            } finally {
                // 确保在对话框关闭后恢复按钮状态
                restoreButtonState();
            }
        }, restoreButtonState); // 传递恢复函数作为取消回调

    } catch (error) {
        console.error(`[Settings] Discover models failed for ${providerId}:`, error);
        showToastCallback(_('fetchModelsError', { error: error.message }, currentTranslations), 'error');
        restoreButtonState();
    }
}

// === 手动添加模型功能 ===

/**
 * 显示手动添加模型对话框
 * @param {Object} currentTranslations - 当前翻译对象
 */
function showManualAddModelDialog(currentTranslations) {
    // 移除已存在的对话框
    const existingDialog = document.querySelector('.manual-add-model-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }

    // 获取可用的供应商列表
    const providers = window.ProviderManager?.getAllProviders() || {};
    const providerOptions = Object.values(providers).map(provider => ({
        value: provider.id,
        text: provider.name
    }));

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'manual-add-model-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>${_('manualAddModelDialogTitle', {}, currentTranslations)}</h3>
                    <button type="button" class="close-btn" aria-label="${_('close', {}, currentTranslations)}">×</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="manual-model-name">${_('manualAddModelName', {}, currentTranslations)} *</label>
                        <input type="text" id="manual-model-name" class="form-input"
                               placeholder="${_('manualAddModelNamePlaceholder', {}, currentTranslations)}"
                               autocomplete="off" required>
                    </div>
                    <div class="form-group">
                        <label for="manual-model-id">${_('manualAddModelId', {}, currentTranslations)} *</label>
                        <input type="text" id="manual-model-id" class="form-input"
                               placeholder="${_('manualAddModelIdPlaceholder', {}, currentTranslations)}"
                               autocomplete="off" required>
                    </div>
                    <div class="form-group">
                        <label for="manual-model-provider">${_('manualAddModelProvider', {}, currentTranslations)} *</label>
                        <select id="manual-model-provider" class="form-select" required>
                            <option value="">${_('manualAddModelProviderPlaceholder', {}, currentTranslations)}</option>
                            ${providerOptions.map(option =>
                                `<option value="${option.value}">${option.text}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="dialog-footer">
                    <div class="dialog-actions">
                        <button type="button" class="cancel-btn">${_('manualAddModelCancel', {}, currentTranslations)}</button>
                        <button type="button" class="confirm-btn" disabled>${_('manualAddModelConfirm', {}, currentTranslations)}</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 添加到页面
    document.body.appendChild(dialog);

    // 获取表单元素
    const nameInput = dialog.querySelector('#manual-model-name');
    const idInput = dialog.querySelector('#manual-model-id');
    const providerSelect = dialog.querySelector('#manual-model-provider');
    const confirmBtn = dialog.querySelector('.confirm-btn');
    const cancelBtn = dialog.querySelector('.cancel-btn');
    const closeBtn = dialog.querySelector('.close-btn');

    // 表单验证函数
    const validateForm = () => {
        const name = nameInput.value.trim();
        const id = idInput.value.trim();
        const provider = providerSelect.value;

        const isValid = name && id && provider;
        confirmBtn.disabled = !isValid;
        return isValid;
    };

    // 添加输入事件监听器
    nameInput.addEventListener('input', validateForm);
    idInput.addEventListener('input', validateForm);
    providerSelect.addEventListener('change', validateForm);

    // 关闭对话框函数
    const closeDialog = () => {
        // 移除语言变化监听器
        document.removeEventListener('pagetalk:languageChanged', handleDialogLanguageChange);
        dialog.remove();
    };

    // 语言变化处理函数
    const handleDialogLanguageChange = (event) => {
        console.log('[Settings] Manual add dialog received language change event:', event.detail);
        const newLanguage = event.detail.newLanguage;
        const newTranslations = getCurrentTranslations();

        // 更新对话框中的文本
        updateManualAddDialogTranslations(dialog, newTranslations);
    };

    // 添加语言变化监听器
    document.addEventListener('pagetalk:languageChanged', handleDialogLanguageChange);

    // 添加事件监听器
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            closeDialog();
        }
    });

    // 确认添加
    confirmBtn.addEventListener('click', async () => {
        if (!validateForm()) return;

        const name = nameInput.value.trim();
        const id = idInput.value.trim();
        const providerId = providerSelect.value;

        // 获取最新的翻译对象
        const latestTranslations = getCurrentTranslations();
        await handleManualAddModel(name, id, providerId, latestTranslations, closeDialog);
    });

    // 聚焦到第一个输入框
    setTimeout(() => nameInput.focus(), 100);
}

/**
 * 更新手动添加模型对话框的翻译
 * @param {HTMLElement} dialog - 对话框元素
 * @param {Object} translations - 翻译对象
 */
function updateManualAddDialogTranslations(dialog, translations) {
    if (!dialog || !translations) return;

    // 更新标题
    const title = dialog.querySelector('.dialog-header h3');
    if (title) {
        title.textContent = _('manualAddModelDialogTitle', {}, translations);
    }

    // 更新关闭按钮
    const closeBtn = dialog.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.setAttribute('aria-label', _('close', {}, translations));
    }

    // 更新表单标签
    const nameLabel = dialog.querySelector('label[for="manual-model-name"]');
    if (nameLabel) {
        nameLabel.textContent = _('manualAddModelName', {}, translations) + ' *';
    }

    const idLabel = dialog.querySelector('label[for="manual-model-id"]');
    if (idLabel) {
        idLabel.textContent = _('manualAddModelId', {}, translations) + ' *';
    }

    const providerLabel = dialog.querySelector('label[for="manual-model-provider"]');
    if (providerLabel) {
        providerLabel.textContent = _('manualAddModelProvider', {}, translations) + ' *';
    }

    // 更新输入框占位符
    const nameInput = dialog.querySelector('#manual-model-name');
    if (nameInput) {
        nameInput.placeholder = _('manualAddModelNamePlaceholder', {}, translations);
    }

    const idInput = dialog.querySelector('#manual-model-id');
    if (idInput) {
        idInput.placeholder = _('manualAddModelIdPlaceholder', {}, translations);
    }

    // 更新选择框占位符
    const providerSelect = dialog.querySelector('#manual-model-provider');
    if (providerSelect) {
        const placeholderOption = providerSelect.querySelector('option[value=""]');
        if (placeholderOption) {
            placeholderOption.textContent = _('manualAddModelProviderPlaceholder', {}, translations);
        }
    }

    // 更新按钮文本
    const cancelBtn = dialog.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.textContent = _('manualAddModelCancel', {}, translations);
    }

    const confirmBtn = dialog.querySelector('.confirm-btn');
    if (confirmBtn) {
        confirmBtn.textContent = _('manualAddModelConfirm', {}, translations);
    }
}

/**
 * 处理手动添加模型
 * @param {string} modelName - 模型名称
 * @param {string} modelId - 模型ID
 * @param {string} providerId - 供应商ID
 * @param {Object} currentTranslations - 当前翻译对象
 * @param {Function} closeDialog - 关闭对话框的函数
 */
async function handleManualAddModel(modelName, modelId, providerId, currentTranslations, closeDialog) {
    if (!window.ModelManager?.instance) {
        if (window.showToastUI) {
            window.showToastUI(_('manualAddModelError', {}, currentTranslations), 'error');
        }
        return;
    }

    const modelManager = window.ModelManager.instance;

    try {
        // 检查模型是否已存在
        const existingModel = modelManager.getModelById(modelId);
        if (existingModel) {
            if (window.showToastUI) {
                window.showToastUI(_('manualAddModelExists', {}, currentTranslations), 'error');
            }
            return;
        }

        // 创建模型定义
        const modelDefinition = {
            id: modelId,
            displayName: modelName,
            apiModelName: modelId,
            providerId: providerId,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true
        };

        // 添加模型
        const success = await modelManager.addModel(modelDefinition);

        if (success) {
            // 激活模型
            await modelManager.activateModel(modelId);

            // 更新UI
            await updateModelCardsDisplay();

            // 重新初始化模型选择器
            const state = window.state || {};
            const elements = {
                modelSelection: document.getElementById('model-selection'),
                chatModelSelection: document.getElementById('chat-model-selection')
            };
            await initModelSelection(state, elements);

            // 显示成功消息
            if (window.showToastUI) {
                window.showToastUI(_('manualAddModelSuccess', {}, currentTranslations), 'success');
            }

            // 关闭对话框
            closeDialog();
        } else {
            if (window.showToastUI) {
                window.showToastUI(_('manualAddModelError', {}, currentTranslations), 'error');
            }
        }

    } catch (error) {
        console.error('[Settings] Error adding manual model:', error);
        if (window.showToastUI) {
            window.showToastUI(_('manualAddModelError', {}, currentTranslations), 'error');
        }
    }
}

// === 自定义提供商功能 ===

/**
 * 初始化自定义提供商模态框
 */
function initCustomProviderModal() {
    const addProviderBtn = document.getElementById('add-provider-btn');
    const modal = document.getElementById('custom-provider-modal');
    const closeBtn = modal?.querySelector('.custom-provider-close');
    const cancelBtn = document.getElementById('custom-provider-cancel');
    const saveBtn = document.getElementById('custom-provider-save');

    if (!addProviderBtn || !modal) return;

    // 防止重复绑定事件监听器
    if (modal.dataset.eventListenersSetup === 'true') {
        console.log('[Settings] Custom provider modal event listeners already setup, skipping...');
        return;
    }
    modal.dataset.eventListenersSetup = 'true';

    // 打开模态框
    addProviderBtn.addEventListener('click', () => {
        openCustomProviderModal();
    });

    // 关闭模态框
    const closeModal = () => {
        modal.classList.remove('show');
        clearCustomProviderForm();
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // 保存自定义提供商
    saveBtn?.addEventListener('click', async () => {
        await saveCustomProvider();
    });

    // 表单验证
    const form = modal.querySelector('.custom-provider-form');
    if (form) {
        form.addEventListener('input', validateCustomProviderForm);
    }
}

/**
 * 打开自定义提供商模态框
 */
function openCustomProviderModal() {
    const modal = document.getElementById('custom-provider-modal');
    if (!modal) return;

    clearCustomProviderForm();
    modal.classList.add('show');

    // 聚焦到第一个输入框
    const firstInput = modal.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

/**
 * 清空自定义提供商表单
 */
function clearCustomProviderForm() {
    const modal = document.getElementById('custom-provider-modal');
    if (!modal) return;

    const inputs = modal.querySelectorAll('input');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('error');
        input.disabled = false; // 重置禁用状态
    });

    // 清除所有提示文本
    const hints = modal.querySelectorAll('.form-hint');
    hints.forEach(hint => hint.remove());

    // 重置保存按钮
    const saveBtn = document.getElementById('custom-provider-save');
    if (saveBtn) {
        saveBtn.textContent = getCurrentTranslations().customProviderSave || '添加';
        delete saveBtn.dataset.editMode;
        delete saveBtn.dataset.editProviderId;
    }

    validateCustomProviderForm();
}

/**
 * 验证自定义提供商表单
 */
function validateCustomProviderForm() {
    const modal = document.getElementById('custom-provider-modal');
    const saveBtn = document.getElementById('custom-provider-save');
    if (!modal || !saveBtn) return;

    const baseUrlInput = document.getElementById('custom-provider-baseurl');
    const apiKeyInput = document.getElementById('custom-provider-apikey');

    const baseUrl = baseUrlInput?.value.trim();
    const apiKey = apiKeyInput?.value.trim();

    // 验证必填字段
    let isValid = true;

    if (!baseUrl) {
        isValid = false;
    } else {
        // 验证URL格式
        try {
            new URL(baseUrl);
            baseUrlInput.classList.remove('error');
        } catch (e) {
            isValid = false;
            baseUrlInput.classList.add('error');
        }
    }

    if (!apiKey) {
        isValid = false;
    }

    saveBtn.disabled = !isValid;
}

/**
 * 保存自定义提供商
 */
async function saveCustomProvider() {
    const modal = document.getElementById('custom-provider-modal');
    const saveBtn = document.getElementById('custom-provider-save');
    if (!modal || !saveBtn) return;

    const providerIdInput = document.getElementById('custom-provider-id');
    const baseUrlInput = document.getElementById('custom-provider-baseurl');
    const apiKeyInput = document.getElementById('custom-provider-apikey');

    const providerId = providerIdInput?.value.trim();
    const baseUrl = baseUrlInput?.value.trim();
    const apiKey = apiKeyInput?.value.trim();

    const isEditMode = saveBtn.dataset.editMode === 'true';
    const editProviderId = saveBtn.dataset.editProviderId;

    if (!baseUrl || !apiKey) {
        // 需要从全局获取showToast函数
        if (window.showToastUI) {
            window.showToastUI(getCurrentTranslations().customProviderError, 'error');
        }
        return;
    }

    // 禁用保存按钮
    saveBtn.disabled = true;
    saveBtn.textContent = getCurrentTranslations().loading || '保存中...';

    try {
        let result;

        if (isEditMode && editProviderId) {
            // 编辑模式：检查是否修改了Provider ID
            if (providerId && providerId !== editProviderId) {
                // Provider ID发生了变化，需要删除旧的并创建新的
                result = await updateCustomProviderWithNewId(editProviderId, {
                    id: providerId,
                    baseUrl: baseUrl,
                    apiKey: apiKey
                });
            } else {
                // Provider ID没有变化，只更新其他属性
                result = await updateCustomProvider(editProviderId, {
                    baseUrl: baseUrl,
                    apiKey: apiKey
                });
            }
        } else {
            // 添加模式：创建新提供商
            result = await window.ProviderManager.addCustomProvider({
                id: providerId,
                baseUrl: baseUrl,
                apiKey: apiKey
            });
        }

        if (result.success) {
            // 成功操作
            const successMessage = isEditMode ?
                getCurrentTranslations().customProviderUpdateSuccess :
                getCurrentTranslations().customProviderSuccess;

            if (window.showToastUI) {
                window.showToastUI(successMessage, 'success');
            }

            // 关闭模态框
            modal.classList.remove('show');
            clearCustomProviderForm();

            // 刷新供应商选择器
            await refreshProviderSelection();

            // 选择相关提供商并填入API Key
            const targetProviderId = result.providerId || (isEditMode ? editProviderId : result.providerId);
            const providerSelect = document.getElementById('provider-select');
            if (providerSelect && targetProviderId) {
                providerSelect.value = targetProviderId;
                await showProviderSettings(targetProviderId);

                // 自动填入API Key
                setTimeout(() => {
                    const apiKeyInput = document.getElementById(`${targetProviderId}-api-key`);
                    if (apiKeyInput) {
                        apiKeyInput.value = apiKey;
                    }
                }, 100);
            }

        } else {
            // 显示错误信息
            let errorMessage = getCurrentTranslations().customProviderError;
            if (result.error === 'Provider ID already exists') {
                errorMessage = getCurrentTranslations().customProviderExists;
            } else if (result.error === 'Invalid URL format') {
                errorMessage = getCurrentTranslations().customProviderInvalidUrl;
            }
            if (window.showToastUI) {
                window.showToastUI(errorMessage, 'error');
            }
        }

    } catch (error) {
        console.error('[Settings] Error saving custom provider:', error);
        if (window.showToastUI) {
            window.showToastUI(getCurrentTranslations().customProviderError, 'error');
        }
    } finally {
        // 恢复保存按钮状态
        if (saveBtn) {
            saveBtn.disabled = false;
            const defaultText = isEditMode ?
                (getCurrentTranslations().customProviderEdit || '保存') :
                (getCurrentTranslations().customProviderSave || '添加');
            saveBtn.textContent = defaultText;
        }
    }
}

/**
 * 更新自定义提供商并更改ID
 */
async function updateCustomProviderWithNewId(oldProviderId, newProviderData) {
    try {
        // 检查新ID是否已存在
        const existingProvider = window.ProviderManager?.getProvider(newProviderData.id);
        if (existingProvider) {
            return { success: false, error: 'Provider ID already exists' };
        }

        // 删除旧的提供商
        const deleteSuccess = await window.ProviderManager.removeCustomProvider(oldProviderId);
        if (!deleteSuccess) {
            return { success: false, error: 'Failed to remove old provider' };
        }

        // 创建新的提供商
        const addResult = await window.ProviderManager.addCustomProvider(newProviderData);
        if (addResult.success) {
            console.log(`[Settings] Updated custom provider ID from ${oldProviderId} to ${newProviderData.id}`);
            return { success: true, providerId: newProviderData.id };
        } else {
            // 如果创建失败，尝试恢复旧的提供商（这里简化处理）
            console.error('[Settings] Failed to create new provider after deleting old one');
            return addResult;
        }

    } catch (error) {
        console.error('[Settings] Error updating custom provider with new ID:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 更新自定义提供商
 */
async function updateCustomProvider(providerId, updates) {
    try {
        const provider = window.ProviderManager?.getProvider(providerId);
        if (!provider || !provider.isCustom) {
            return { success: false, error: 'Provider not found or not custom' };
        }

        // 验证URL格式
        if (updates.baseUrl) {
            try {
                new URL(updates.baseUrl);
            } catch (e) {
                return { success: false, error: 'Invalid URL format' };
            }
        }

        // 更新提供商配置
        if (updates.baseUrl) {
            provider.apiHost = updates.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        }

        // 更新API Key
        if (updates.apiKey && window.ModelManager?.instance) {
            await window.ModelManager.instance.setProviderSettings(providerId, {
                apiKey: updates.apiKey
            });
        }

        // 保存自定义提供商到存储
        await window.ProviderManager?.saveCustomProviders?.();

        console.log(`[Settings] Updated custom provider: ${providerId}`);
        return { success: true, providerId };

    } catch (error) {
        console.error('[Settings] Error updating custom provider:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 刷新供应商选择器
 */
async function refreshProviderSelection() {
    const providerSelect = document.getElementById('provider-select');
    if (!providerSelect) return;

    const currentValue = providerSelect.value;

    // 获取更新后的供应商选项
    const providerOptions = window.ProviderManager?.getProviderOptionsForUI() || [];

    // 清空并重新填充选项
    providerSelect.innerHTML = '';
    providerOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        providerSelect.appendChild(optionElement);
    });

    // 尝试恢复之前的选择
    if (currentValue && providerOptions.find(opt => opt.value === currentValue)) {
        providerSelect.value = currentValue;
    }

    // 确保为新的自定义提供商创建设置区域
    await createAllProviderSettings();
}

/**
 * 为所有供应商创建设置区域（包括内置和自定义）
 */
async function createAllProviderSettings() {
    const container = document.querySelector('.provider-settings-container');
    if (!container) return;

    // 获取所有供应商（内置 + 自定义）
    const allProviders = window.ProviderManager?.getAllProviders() || {};

    Object.values(allProviders).forEach(provider => {
        // 检查是否已存在设置区域
        const existingSettings = document.getElementById(`provider-settings-${provider.id}`);
        if (existingSettings) return;

        // 创建设置区域
        const settingsDiv = createProviderSettingsElement(provider);
        container.appendChild(settingsDiv);
    });
}

/**
 * 为自定义提供商创建设置区域（保持向后兼容）
 */
async function createCustomProviderSettings() {
    // 直接调用创建所有供应商设置的函数
    await createAllProviderSettings();
}

/**
 * 获取供应商API Key链接文本
 */
function getProviderApiKeyLinkText(provider) {
    const linkTexts = {
        'google': 'Google AI Studio',
        'openai': 'OpenAI Platform',
        'anthropic': 'Anthropic Console',
        'siliconflow': 'SiliconFlow 控制台',
        'openrouter': 'OpenRouter 设置',
        'deepseek': 'DeepSeek 平台',
        'chatglm': '智谱AI 平台'
    };

    return linkTexts[provider.id] || provider.name;
}

/**
 * 创建提供商设置元素
 */
function createProviderSettingsElement(provider) {
    const settingsDiv = document.createElement('div');
    settingsDiv.id = `provider-settings-${provider.id}`;
    settingsDiv.className = 'provider-settings';
    settingsDiv.style.display = 'none';

    const currentTranslations = getCurrentTranslations();

    settingsDiv.innerHTML = `
        <div class="provider-header">
            <img src="../icons/${provider.icon}" alt="${provider.name}" class="provider-icon">
            <h3>${provider.name}</h3>
            ${provider.isCustom ? `
                <button class="edit-custom-provider-btn" data-provider="${provider.id}" title="${currentTranslations.customProviderEdit || '编辑提供商'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.707 13.707a1 1 0 0 1-.39.242l-3 1a1 1 0 0 1-1.266-1.265l1-3a1 1 0 0 1 .242-.391L10.086 2.5a2 2 0 0 1 2.828 0l.586.586a2 2 0 0 1 0 2.828L5.707 13.707zM3 11l7.5-7.5 1 1L4 12l-1-1zm0 2.5l1-1L5.5 14l-1 1-1.5-1.5z"/>
                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                    </svg>
                </button>
                <button class="remove-custom-provider-btn" data-provider="${provider.id}" title="${currentTranslations.customProviderDelete || '删除提供商'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            ` : ''}
        </div>
        <div class="setting-group">
            <label for="${provider.id}-api-key">API Key:</label>
            <div class="api-key-input-container">
                <input type="password" id="${provider.id}-api-key" data-i18n-placeholder="providerApiKeyPlaceholder" placeholder="${currentTranslations.providerApiKeyPlaceholder}">
                <button class="toggle-api-key-button" type="button" data-target="${provider.id}-api-key">
                    <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.1 13.1 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.1 13.1 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.1 13.1 0 0 1 1.172 8z"/>
                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                    </svg>
                    <svg class="eye-slash-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                        <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                        <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                        <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                    </svg>
                </button>
            </div>
            ${provider.apiKeyUrl ? `<p class="hint"><span data-i18n="getApiKeyHint">获取 API Key</span>: <a href="${provider.apiKeyUrl}" target="_blank" rel="noopener">${getProviderApiKeyLinkText(provider)}</a></p>` : ''}
            ${provider.isCustom && provider.apiHost ? `<p class="hint">Base URL: ${provider.apiHost}</p>` : ''}
        </div>
        <div class="provider-actions">
            <button class="test-api-key-btn" data-provider="${provider.id}" data-i18n="testConnection">${currentTranslations.testConnection}</button>
            <button class="discover-models-btn" data-provider="${provider.id}" data-i18n="discoverModels">${currentTranslations.discoverModels}</button>
        </div>
    `;

    // 注意：不在这里添加API Key切换按钮的事件监听器，因为已经通过事件委托在 setupProviderEventListeners 中处理了
    // 这样可以避免重复绑定事件监听器导致的问题

    // 添加自定义提供商按钮事件监听器
    if (provider.isCustom) {
        const editBtn = settingsDiv.querySelector('.edit-custom-provider-btn');
        const removeBtn = settingsDiv.querySelector('.remove-custom-provider-btn');

        if (editBtn) {
            editBtn.addEventListener('click', () => editCustomProvider(provider.id));
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => showDeleteCustomProviderModal(provider.id));
        }
    }

    return settingsDiv;
}

/**
 * 编辑自定义提供商
 */
function editCustomProvider(providerId) {
    const provider = window.ProviderManager?.getProvider(providerId);
    if (!provider || !provider.isCustom) {
        console.error('[Settings] Cannot edit non-custom provider:', providerId);
        return;
    }

    // 获取当前API Key
    const apiKey = window.ModelManager?.instance?.getProviderApiKey(providerId) || '';

    // 打开模态框并填入当前值
    openCustomProviderModal();

    // 填入当前值
    const modal = document.getElementById('custom-provider-modal');
    if (modal) {
        const providerIdInput = document.getElementById('custom-provider-id');
        const baseUrlInput = document.getElementById('custom-provider-baseurl');
        const apiKeyInput = document.getElementById('custom-provider-apikey');
        const saveBtn = document.getElementById('custom-provider-save');

        if (providerIdInput) providerIdInput.value = provider.id;
        if (baseUrlInput) baseUrlInput.value = provider.apiHost;
        if (apiKeyInput) apiKeyInput.value = apiKey;

        // 更改保存按钮文本和功能
        if (saveBtn) {
            saveBtn.textContent = getCurrentTranslations().customProviderEdit || '保存';
            saveBtn.dataset.editMode = 'true';
            saveBtn.dataset.editProviderId = providerId;
        }

        // 在编辑模式下允许修改Provider ID
        if (providerIdInput) {
            providerIdInput.disabled = false;
        }
    }
}

/**
 * 显示删除自定义提供商的模态框
 */
function showDeleteCustomProviderModal(providerId) {
    const provider = window.ProviderManager?.getProvider(providerId);
    if (!provider) return;

    const currentTranslations = getCurrentTranslations();
    const confirmMessage = currentTranslations.customProviderDeleteConfirm?.replace('{name}', provider.name) ||
                          `确定要删除提供商 "${provider.name}" 吗？`;

    if (confirm(confirmMessage)) {
        removeCustomProvider(providerId);
    }
}

/**
 * 删除自定义提供商
 */
async function removeCustomProvider(providerId) {

    try {
        const success = await window.ProviderManager.removeCustomProvider(providerId);

        if (success) {
            // 移除设置区域
            const settingsElement = document.getElementById(`provider-settings-${providerId}`);
            if (settingsElement) {
                settingsElement.remove();
            }

            // 刷新供应商选择器
            await refreshProviderSelection();

            // 如果当前选择的是被删除的提供商，切换到默认提供商
            const providerSelect = document.getElementById('provider-select');
            if (providerSelect && providerSelect.value === providerId) {
                providerSelect.value = 'google';
                await showProviderSettings('google');
            }

            if (window.showToastUI) {
                const currentTranslations = getCurrentTranslations();
                window.showToastUI(currentTranslations.customProviderDeleteSuccess || '自定义提供商已删除', 'success');
            }
        } else {
            if (window.showToastUI) {
                const currentTranslations = getCurrentTranslations();
                window.showToastUI(currentTranslations.customProviderDeleteError || '删除提供商失败', 'error');
            }
        }
    } catch (error) {
        console.error('[Settings] Error removing custom provider:', error);
        if (window.showToastUI) {
            const currentTranslations = getCurrentTranslations();
            window.showToastUI(currentTranslations.customProviderDeleteError || '删除提供商失败', 'error');
        }
    }
}