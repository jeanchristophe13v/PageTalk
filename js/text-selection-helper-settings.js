/**
 * Pagetalk - Text Selection Helper Settings Module
 * 划词助手设置管理模块
 */

// 常用Lucide图标列表
const POPULAR_LUCIDE_ICONS = [
    'star', 'heart', 'bookmark', 'tag', 'flag', 'bell', 'eye', 'search', 'edit', 'settings',
    'home', 'user', 'users', 'mail', 'phone', 'calendar', 'clock', 'map-pin', 'globe', 'wifi',
    'camera', 'image', 'video', 'music', 'headphones', 'mic', 'volume-2', 'play', 'pause', 'circle-stop',
    'file', 'folder', 'download', 'upload', 'share', 'link', 'copy', 'scissors', 'trash', 'archive',
    'plus', 'minus', 'x', 'check', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'refresh-cw', 'rotate-ccw',
    'zap', 'sun', 'moon', 'cloud', 'umbrella', 'thermometer', 'droplets', 'wind', 'snowflake', 'flame',
    'car', 'plane', 'train', 'bike', 'truck', 'ship', 'rocket', 'anchor', 'compass', 'map',
    'book', 'graduation-cap', 'briefcase', 'building', 'home', 'shopping-bag', 'hospital', 'school', 'banknote', 'church',
    'coffee', 'pizza', 'apple', 'cake', 'wine', 'beer', 'utensils', 'chef-hat', 'ice-cream', 'candy',
    'gamepad', 'tv', 'monitor', 'smartphone', 'tablet', 'laptop', 'keyboard', 'mouse', 'printer', 'scan'
];

/**
 * 生成唯一ID
 */
function generateUniqueId() {
    return 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * 获取默认设置（根据语言动态生成）
 */
function getDefaultSettings(language = 'zh-CN') {
    // 使用translations.js中的默认提示词
    const interpretPrompt = window.getDefaultPrompt ? window.getDefaultPrompt('interpret', language) :
        (window.translations?.[language]?.['defaultInterpretPrompt'] ||
         window.translations?.['zh-CN']?.['defaultInterpretPrompt'] || '解释一下');
    const translatePrompt = window.getDefaultPrompt ? window.getDefaultPrompt('translate', language) :
        (window.translations?.[language]?.['defaultTranslatePrompt'] ||
         window.translations?.['zh-CN']?.['defaultTranslatePrompt'] || '翻译一下');
    const chatPrompt = window.translations?.[language]?.['defaultChatPrompt'] ||
        window.translations?.['zh-CN']?.['defaultChatPrompt'] || '你是一个有用的对话助手';

    return {
        enabled: true, // 默认启用划词助手
        interpret: {
            model: 'gemini-2.5-flash',
            systemPrompt: interpretPrompt,
            temperature: 0.7,
            contextMode: 'custom', // 'custom' 或 'full'
            contextBefore: 500,
            contextAfter: 500,
            maxOutputLength: 65536
        },
        translate: {
            model: 'gemini-2.5-flash',
            systemPrompt: translatePrompt,
            temperature: 0.2,
            contextMode: 'custom', // 'custom' 或 'full'
            contextBefore: 500,
            contextAfter: 500,
            maxOutputLength: 65536
        },
        chat: {
            contextMode: 'custom', // 'custom' 或 'full'
            contextBefore: 500,
            contextAfter: 500
        },
        customOptions: [], // 自定义选项数组
        optionsOrder: ['interpret', 'translate', 'chat']
    };
}

// 默认设置（中文）
const DEFAULT_SETTINGS = getDefaultSettings('zh-CN');

// 当前设置
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * 初始化划词助手设置
 */
export async function initTextSelectionHelperSettings(elements, translations) {
    console.log('[TextSelectionHelperSettings] Initializing...');

    // 注释掉清理函数，保留自定义选项
    // cleanupStorageData();

    // 加载设置（等待完成）
    await loadSettings();

    // 初始化UI（现在是异步的）
    await initSettingsUI(elements, translations);

    // 初始化自定义选项UI
    initCustomOptionsUI(elements, translations);

    // 监听语言切换事件
    setupLanguageChangeListener();

    console.log('[TextSelectionHelperSettings] Initialized');
}



/**
 * 加载设置
 */
function loadSettings() {
    return new Promise((resolve) => {
        // 检查Chrome存储API是否可用
        if (!chrome || !chrome.storage || !chrome.storage.sync) {
            console.warn('[TextSelectionHelperSettings] Chrome storage API not available, using default settings');
            currentSettings = { ...DEFAULT_SETTINGS };
            resolve();
            return;
        }

        try {
            // 首先获取当前语言设置
            chrome.storage.sync.get(['language', 'textSelectionHelperSettings'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[TextSelectionHelperSettings] Error loading settings:', chrome.runtime.lastError);
                    currentSettings = { ...DEFAULT_SETTINGS };
                } else {
                    const currentLanguage = result.language || 'zh-CN';
                    const dynamicDefaults = getDefaultSettings(currentLanguage);

                    if (result.textSelectionHelperSettings) {
                        currentSettings = { ...dynamicDefaults, ...result.textSelectionHelperSettings };

                        // 智能更新默认提示词：只有当前提示词是默认提示词时才更新
                        if (currentSettings.interpret && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.interpret.systemPrompt, 'interpret')) {
                            currentSettings.interpret.systemPrompt = window.getDefaultPrompt('interpret', currentLanguage);
                        }
                        if (currentSettings.translate && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.translate.systemPrompt, 'translate')) {
                            currentSettings.translate.systemPrompt = window.getDefaultPrompt('translate', currentLanguage);
                        }

                        // 确保maxOutputLength字段存在（向后兼容）
                        if (currentSettings.interpret && currentSettings.interpret.maxOutputLength === undefined) {
                            currentSettings.interpret.maxOutputLength = 65536;
                        }
                        if (currentSettings.translate && currentSettings.translate.maxOutputLength === undefined) {
                            currentSettings.translate.maxOutputLength = 65536;
                        }

                        // 确保对话设置存在（向后兼容）
                        if (!currentSettings.chat) {
                            currentSettings.chat = {
                                contextMode: 'custom',
                                contextBefore: 500,
                                contextAfter: 500
                            };
                        }
                        if (currentSettings.chat && currentSettings.chat.contextMode === undefined) {
                            currentSettings.chat.contextMode = 'custom';
                        }
                        if (currentSettings.chat && currentSettings.chat.contextBefore === undefined) {
                            currentSettings.chat.contextBefore = 500;
                        }
                        if (currentSettings.chat && currentSettings.chat.contextAfter === undefined) {
                            currentSettings.chat.contextAfter = 500;
                        }

                        // 确保自定义选项数组存在
                        if (!currentSettings.customOptions) {
                            currentSettings.customOptions = [];
                        }

                        // 为现有自定义选项添加maxOutputLength和icon字段（向后兼容）
                        if (currentSettings.customOptions) {
                            currentSettings.customOptions.forEach(option => {
                                if (option.maxOutputLength === undefined) {
                                    option.maxOutputLength = 65536;
                                }
                                if (option.icon === undefined) {
                                    option.icon = 'star'; // 默认图标
                                }
                            });
                        }

                        // 确保选项顺序数组存在
                        if (!currentSettings.optionsOrder) {
                            currentSettings.optionsOrder = ['interpret', 'translate', 'chat'];
                        }
                    } else {
                        currentSettings = { ...dynamicDefaults };
                    }
                }
                console.log('[TextSelectionHelperSettings] Settings loaded:', currentSettings);
                resolve();
            });
        } catch (error) {
            console.error('[TextSelectionHelperSettings] Exception loading settings:', error);
            currentSettings = { ...DEFAULT_SETTINGS };
            resolve();
        }
    });
}

/**
 * 获取当前语言设置（用于设置模块）
 */
function getCurrentLanguageForSettings() {
    return new Promise((resolve) => {
        if (chrome && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['language'], (result) => {
                resolve(result.language || 'zh-CN');
            });
        } else {
            resolve('zh-CN');
        }
    });
}

/**
 * 设置语言切换监听器
 */
function setupLanguageChangeListener() {
    // 监听Chrome存储变化
    if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.language) {
                const newLanguage = changes.language.newValue;
                const oldLanguage = changes.language.oldValue;

                if (newLanguage !== oldLanguage) {
                    console.log('[TextSelectionHelperSettings] Language changed from', oldLanguage, 'to', newLanguage);
                    handleLanguageChange(newLanguage);
                }
            }
        });
    }
}

/**
 * 处理语言切换
 */
function handleLanguageChange(newLanguage) {
    console.log('[TextSelectionHelperSettings] Handling language change to:', newLanguage);

    // 只更新默认提示词，保留用户自定义的提示词
    const needsUpdate = updateDefaultPromptsForLanguage(newLanguage);

    // 总是尝试更新UI，不管设置页面是否打开
    const settingsContainer = document.querySelector('#settings-text-selection-helper');
    if (settingsContainer) {
        console.log('[TextSelectionHelperSettings] Updating UI for language change');

        // 获取当前语言的翻译对象
        const translations = window.translations && window.translations[newLanguage] ? window.translations[newLanguage] : {};
        console.log('[TextSelectionHelperSettings] Using translations:', translations);

        // 重新加载设置到UI
        const elements = {
            textSelectionHelperSettings: settingsContainer
        };
        loadSettingsToUI(elements);

        // 更新选项顺序UI以反映新语言
        updateOptionsOrderUI(elements, translations);

        // 更新自定义选项UI
        renderCustomOptionsList(translations);

        // 更新可能打开的自定义选项对话框
        const openDialog = document.querySelector('.custom-option-dialog-overlay');
        if (openDialog) {
            // 从对话框中获取当前编辑的选项信息
            const nameInput = openDialog.querySelector('#custom-option-name');
            const isEdit = nameInput && nameInput.value.trim() !== '';
            let currentOption = null;

            if (isEdit) {
                // 尝试从当前设置中找到匹配的选项
                const currentName = nameInput.value.trim();
                currentOption = currentSettings.customOptions?.find(opt => opt.name === currentName);
            }

            updateDialogTranslations(openDialog, currentOption, translations);
        }
    } else {
        console.log('[TextSelectionHelperSettings] Settings container not found, UI update skipped');
    }

    if (needsUpdate) {
        // 保存更新后的设置
        saveSettings();
    }
}

/**
 * 为新语言更新默认提示词
 */
function updateDefaultPromptsForLanguage(language) {
    let updated = false;

    // 检查并更新解读提示词
    if (currentSettings.interpret && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.interpret.systemPrompt, 'interpret')) {
        const newPrompt = window.getDefaultPrompt('interpret', language);
        if (currentSettings.interpret.systemPrompt !== newPrompt) {
            currentSettings.interpret.systemPrompt = newPrompt;
            updated = true;
            console.log('[TextSelectionHelperSettings] Updated interpret prompt for language:', language);
        }
    }

    // 检查并更新翻译提示词
    if (currentSettings.translate && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.translate.systemPrompt, 'translate')) {
        const newPrompt = window.getDefaultPrompt('translate', language);
        if (currentSettings.translate.systemPrompt !== newPrompt) {
            currentSettings.translate.systemPrompt = newPrompt;
            updated = true;
            console.log('[TextSelectionHelperSettings] Updated translate prompt for language:', language);
        }
    }

    return updated;
}

/**
 * 保存设置
 */
function saveSettings() {
    // 检查Chrome存储API是否可用
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
        console.warn('[TextSelectionHelperSettings] Chrome storage API not available, cannot save settings');
        return;
    }

    // 保存包含自定义选项的完整设置
    const settingsToSave = { ...currentSettings };

    try {
        chrome.storage.sync.set({ textSelectionHelperSettings: settingsToSave }, () => {
            if (chrome.runtime.lastError) {
                console.error('[TextSelectionHelperSettings] Error saving settings:', chrome.runtime.lastError);
            } else {
                console.log('[TextSelectionHelperSettings] Settings saved');
            }
        });
    } catch (error) {
        console.error('[TextSelectionHelperSettings] Exception saving settings:', error);
    }
}

/**
 * 初始化设置UI
 */
async function initSettingsUI(elements, translations) {
    // 初始化模型选择器
    await initModelSelectors(elements);

    // 初始化设置卡片
    initSettingCards(elements);

    // 加载当前设置到UI
    loadSettingsToUI(elements);

    // 设置事件监听器
    setupEventListeners(elements, translations);

    // 初始化选项顺序列表
    updateOptionsOrderUI(elements, translations);
}

/**
 * 获取模型选项列表 - 通过消息传递获取
 */
async function getModelOptions() {
    try {
        // 尝试通过消息传递获取模型列表
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'getAvailableModels' }, (response) => {
                resolve(response);
            });
        });

        if (response && response.models && response.models.length > 0) {
            // 检查是否是新格式（包含提供商信息）
            if (typeof response.models[0] === 'object' && response.models[0].value) {
                // 新格式：包含提供商信息的对象数组，保持原始格式用于分组
                console.log('[TextSelectionHelperSettings] Got models with provider info from background:', response.models);
                return response.models;
            } else {
                // 旧格式：简单的字符串数组
                const modelOptions = response.models.map(modelId => ({
                    value: modelId,
                    text: modelId,
                    providerId: 'google',
                    providerName: 'Google'
                }));
                console.log('[TextSelectionHelperSettings] Got models from background (legacy format):', modelOptions);
                return modelOptions;
            }
        } else {
            throw new Error('No models received from background');
        }
    } catch (error) {
        console.warn('[TextSelectionHelperSettings] Failed to get models from background, using fallback:', error);
        // 回退到基本选项
        return [
            { value: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
            { value: 'gemini-2.5-flash-thinking', text: 'gemini-2.5-flash-thinking' },
            { value: 'gemini-2.5-flash-lite-preview-06-17', text: 'gemini-2.5-flash-lite-preview-06-17' }
        ];
    }
}

/**
 * 生成模型选项HTML - 按提供商分组
 */
async function generateModelOptionsHTML(selectedModel = 'gemini-2.5-flash') {
    const modelOptions = await getModelOptions();

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

    let html = '';
    // 为每个提供商创建 optgroup
    sortedProviders.forEach(([providerId, providerData]) => {
        html += `<optgroup label="${providerData.name}" data-provider-id="${providerId}">`;

        // 按模型名称排序
        const sortedModels = providerData.models.sort((a, b) => a.text.localeCompare(b.text));

        sortedModels.forEach(option => {
            const selected = option.value === selectedModel ? 'selected' : '';
            const dataAttrs = `data-provider-id="${option.providerId || ''}" data-provider-name="${option.providerName || ''}"`;
            html += `<option value="${option.value}" ${selected} ${dataAttrs}>${option.text}</option>`;
        });

        html += `</optgroup>`;
    });

    return html;
}

/**
 * 初始化模型选择器
 */
async function initModelSelectors(elements) {
    const modelOptions = await getModelOptions();

    const selectors = [
        document.getElementById('interpret-model'),
        document.getElementById('translate-model')
    ];

    selectors.forEach(selector => {
        if (selector) {
            selector.innerHTML = '';

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
                    optionElement.setAttribute('data-provider-id', option.providerId || '');
                    optionElement.setAttribute('data-provider-name', option.providerName || '');
                    optgroup.appendChild(optionElement);
                });

                selector.appendChild(optgroup);
            });
        }
    });
}

/**
 * 初始化设置卡片（折叠功能）
 */
function initSettingCards(elements) {
    console.log('[TextSelectionHelperSettings] initSettingCards called');
    const cards = document.querySelectorAll('#settings-text-selection-helper .setting-card');
    console.log('[TextSelectionHelperSettings] Found', cards.length, 'cards');

    cards.forEach((card, index) => {
        const header = card.querySelector('.setting-card-header');
        const toggle = card.querySelector('.setting-card-toggle');
        const cardTitle = header?.querySelector('h3')?.textContent?.trim();

        console.log(`[TextSelectionHelperSettings] Card ${index}: "${cardTitle}"`);

        // 检查是否是"选项顺序"卡片（支持中英文）
        const isOptionsOrderCard = cardTitle === '选项顺序' || cardTitle === 'Option Order';

        if (isOptionsOrderCard) {
            console.log('[TextSelectionHelperSettings] Setting up options order card');
            // 选项顺序卡片默认展开且不可折叠
            card.classList.add('expanded');
            card.classList.add('no-collapse'); // 添加标记类
            if (toggle) {
                console.log('[TextSelectionHelperSettings] Removing toggle button');
                toggle.remove(); // 直接移除折叠按钮
            }
            if (header) {
                header.style.cursor = 'default'; // 移除点击光标
                header.style.pointerEvents = 'none'; // 禁用点击事件
            }
            console.log('[TextSelectionHelperSettings] Options order card setup complete');
        } else {
            // 其他卡片默认设置为折叠状态
            card.classList.add('collapsed');

            if (header && toggle) {
                header.addEventListener('click', () => {
                    const isExpanded = card.classList.contains('expanded');

                    // 折叠其他可折叠的卡片
                    cards.forEach(otherCard => {
                        if (otherCard !== card && !otherCard.classList.contains('no-collapse')) {
                            otherCard.classList.remove('expanded');
                            otherCard.classList.add('collapsed');
                        }
                    });

                    // 切换当前卡片状态
                    if (isExpanded) {
                        card.classList.remove('expanded');
                        card.classList.add('collapsed');
                    } else {
                        card.classList.remove('collapsed');
                        card.classList.add('expanded');
                    }
                });
            }
        }
    });
}

/**
 * 加载设置到UI
 */
function loadSettingsToUI(elements) {
    // 加载开关状态
    const enabledToggle = document.getElementById('text-selection-helper-enabled');
    if (enabledToggle) {
        enabledToggle.checked = currentSettings.enabled !== false; // 默认为true
    }

    // 解读设置
    const interpretModel = document.getElementById('interpret-model');
    const interpretPrompt = document.getElementById('interpret-system-prompt');
    const interpretTemp = document.getElementById('interpret-temperature');
    const interpretTempValue = interpretTemp?.parentElement.querySelector('.temperature-value');
    const interpretMaxOutput = document.getElementById('interpret-max-output');

    if (interpretModel) interpretModel.value = currentSettings.interpret.model;
    if (interpretPrompt) interpretPrompt.value = currentSettings.interpret.systemPrompt;
    if (interpretTemp) {
        interpretTemp.value = currentSettings.interpret.temperature;
        if (interpretTempValue) interpretTempValue.textContent = currentSettings.interpret.temperature;
    }
    if (interpretMaxOutput) interpretMaxOutput.value = currentSettings.interpret.maxOutputLength || 65536;

    // 解读上下文设置
    const interpretContextCustom = document.getElementById('interpret-context-custom');
    const interpretContextFull = document.getElementById('interpret-context-full');
    const interpretContextBefore = document.getElementById('interpret-context-before');
    const interpretContextAfter = document.getElementById('interpret-context-after');

    // 设置解读上下文模式
    if (currentSettings.interpret.contextMode === 'full') {
        if (interpretContextFull) interpretContextFull.checked = true;
        // 隐藏自定义输入框
        const contextInputs = document.getElementById('interpret-context-inputs');
        if (contextInputs) {
            contextInputs.style.display = 'none';
        }
    } else {
        if (interpretContextCustom) interpretContextCustom.checked = true;
        // 显示自定义输入框
        const contextInputs = document.getElementById('interpret-context-inputs');
        if (contextInputs) {
            contextInputs.style.display = 'flex';
        }
    }

    if (interpretContextBefore) interpretContextBefore.value = currentSettings.interpret.contextBefore !== undefined ? currentSettings.interpret.contextBefore : 500;
    if (interpretContextAfter) interpretContextAfter.value = currentSettings.interpret.contextAfter !== undefined ? currentSettings.interpret.contextAfter : 500;

    // 翻译设置
    const translateModel = document.getElementById('translate-model');
    const translatePrompt = document.getElementById('translate-system-prompt');
    const translateTemp = document.getElementById('translate-temperature');
    const translateTempValue = translateTemp?.parentElement.querySelector('.temperature-value');
    const translateMaxOutput = document.getElementById('translate-max-output');

    if (translateModel) translateModel.value = currentSettings.translate.model;
    if (translatePrompt) translatePrompt.value = currentSettings.translate.systemPrompt;
    if (translateTemp) {
        translateTemp.value = currentSettings.translate.temperature;
        if (translateTempValue) translateTempValue.textContent = currentSettings.translate.temperature;
    }
    if (translateMaxOutput) translateMaxOutput.value = currentSettings.translate.maxOutputLength || 65536;

    // 翻译上下文设置
    const translateContextCustom = document.getElementById('translate-context-custom');
    const translateContextFull = document.getElementById('translate-context-full');
    const translateContextBefore = document.getElementById('translate-context-before');
    const translateContextAfter = document.getElementById('translate-context-after');

    // 设置翻译上下文模式
    if (currentSettings.translate.contextMode === 'full') {
        if (translateContextFull) translateContextFull.checked = true;
        // 隐藏自定义输入框
        const contextInputs = document.getElementById('translate-context-inputs');
        if (contextInputs) {
            contextInputs.style.display = 'none';
        }
    } else {
        if (translateContextCustom) translateContextCustom.checked = true;
        // 显示自定义输入框
        const contextInputs = document.getElementById('translate-context-inputs');
        if (contextInputs) {
            contextInputs.style.display = 'flex';
        }
    }

    if (translateContextBefore) translateContextBefore.value = currentSettings.translate.contextBefore !== undefined ? currentSettings.translate.contextBefore : 500;
    if (translateContextAfter) translateContextAfter.value = currentSettings.translate.contextAfter !== undefined ? currentSettings.translate.contextAfter : 500;

    // 对话设置
    const chatContextCustom = document.getElementById('chat-context-custom');
    const chatContextFull = document.getElementById('chat-context-full');
    const chatContextBefore = document.getElementById('chat-context-before');
    const chatContextAfter = document.getElementById('chat-context-after');

    // 设置上下文模式
    if (currentSettings.chat.contextMode === 'full') {
        if (chatContextFull) chatContextFull.checked = true;
        // 隐藏自定义输入框
        const contextInputs = document.getElementById('chat-context-inputs');
        if (contextInputs) {
            contextInputs.style.display = 'none';
        }
    } else {
        if (chatContextCustom) chatContextCustom.checked = true;
        // 显示自定义输入框
        const contextInputs = document.getElementById('chat-context-inputs');
        if (contextInputs) {
            contextInputs.style.display = 'flex';
        }
    }

    if (chatContextBefore) chatContextBefore.value = currentSettings.chat.contextBefore !== undefined ? currentSettings.chat.contextBefore : 500;
    if (chatContextAfter) chatContextAfter.value = currentSettings.chat.contextAfter !== undefined ? currentSettings.chat.contextAfter : 500;
}

/**
 * 设置事件监听器
 */
function setupEventListeners(elements, translations) {
    // 开关状态变化
    const enabledToggle = document.getElementById('text-selection-helper-enabled');
    if (enabledToggle) {
        enabledToggle.addEventListener('change', () => {
            currentSettings.enabled = enabledToggle.checked;
            saveSettings();
            console.log('[TextSelectionHelperSettings] Helper enabled state changed:', currentSettings.enabled);
        });
    }

    // 解读设置变化
    const interpretModel = document.getElementById('interpret-model');
    const interpretPrompt = document.getElementById('interpret-system-prompt');
    const interpretTemp = document.getElementById('interpret-temperature');
    const interpretMaxOutput = document.getElementById('interpret-max-output');

    if (interpretModel) {
        interpretModel.addEventListener('change', () => {
            currentSettings.interpret.model = interpretModel.value;
            saveSettings();
        });
    }

    if (interpretPrompt) {
        interpretPrompt.addEventListener('input', () => {
            currentSettings.interpret.systemPrompt = interpretPrompt.value;
            saveSettings();
        });
    }

    if (interpretTemp) {
        interpretTemp.addEventListener('input', () => {
            const value = parseFloat(interpretTemp.value);
            currentSettings.interpret.temperature = value;
            const valueDisplay = interpretTemp.parentElement.querySelector('.temperature-value');
            if (valueDisplay) valueDisplay.textContent = value;
            saveSettings();
        });
    }

    if (interpretMaxOutput) {
        interpretMaxOutput.addEventListener('input', () => {
            const value = parseInt(interpretMaxOutput.value) || 65536;
            currentSettings.interpret.maxOutputLength = value;
            saveSettings();
        });
    }

    // 解读上下文设置变化
    const interpretContextCustom = document.getElementById('interpret-context-custom');
    const interpretContextFull = document.getElementById('interpret-context-full');
    const interpretContextBefore = document.getElementById('interpret-context-before');
    const interpretContextAfter = document.getElementById('interpret-context-after');

    // 解读上下文模式切换
    if (interpretContextCustom) {
        interpretContextCustom.addEventListener('change', () => {
            if (interpretContextCustom.checked) {
                currentSettings.interpret.contextMode = 'custom';
                // 显示自定义输入框
                const contextInputs = document.getElementById('interpret-context-inputs');
                if (contextInputs) {
                    contextInputs.style.display = 'flex';
                }
                saveSettings();
            }
        });
    }

    if (interpretContextFull) {
        interpretContextFull.addEventListener('change', () => {
            if (interpretContextFull.checked) {
                currentSettings.interpret.contextMode = 'full';
                // 隐藏自定义输入框
                const contextInputs = document.getElementById('interpret-context-inputs');
                if (contextInputs) {
                    contextInputs.style.display = 'none';
                }
                saveSettings();
            }
        });
    }

    if (interpretContextBefore) {
        interpretContextBefore.addEventListener('input', () => {
            const value = interpretContextBefore.value !== '' ? parseInt(interpretContextBefore.value) : 0;
            currentSettings.interpret.contextBefore = value;
            saveSettings();
        });
    }

    if (interpretContextAfter) {
        interpretContextAfter.addEventListener('input', () => {
            const value = interpretContextAfter.value !== '' ? parseInt(interpretContextAfter.value) : 0;
            currentSettings.interpret.contextAfter = value;
            saveSettings();
        });
    }

    // 翻译设置变化
    const translateModel = document.getElementById('translate-model');
    const translatePrompt = document.getElementById('translate-system-prompt');
    const translateTemp = document.getElementById('translate-temperature');
    const translateMaxOutput = document.getElementById('translate-max-output');

    if (translateModel) {
        translateModel.addEventListener('change', () => {
            currentSettings.translate.model = translateModel.value;
            saveSettings();
        });
    }

    if (translatePrompt) {
        translatePrompt.addEventListener('input', () => {
            currentSettings.translate.systemPrompt = translatePrompt.value;
            saveSettings();
        });
    }

    if (translateTemp) {
        translateTemp.addEventListener('input', () => {
            const value = parseFloat(translateTemp.value);
            currentSettings.translate.temperature = value;
            const valueDisplay = translateTemp.parentElement.querySelector('.temperature-value');
            if (valueDisplay) valueDisplay.textContent = value;
            saveSettings();
        });
    }

    if (translateMaxOutput) {
        translateMaxOutput.addEventListener('input', () => {
            const value = parseInt(translateMaxOutput.value) || 65536;
            currentSettings.translate.maxOutputLength = value;
            saveSettings();
        });
    }

    // 翻译上下文设置变化
    const translateContextCustom = document.getElementById('translate-context-custom');
    const translateContextFull = document.getElementById('translate-context-full');
    const translateContextBefore = document.getElementById('translate-context-before');
    const translateContextAfter = document.getElementById('translate-context-after');

    // 翻译上下文模式切换
    if (translateContextCustom) {
        translateContextCustom.addEventListener('change', () => {
            if (translateContextCustom.checked) {
                currentSettings.translate.contextMode = 'custom';
                // 显示自定义输入框
                const contextInputs = document.getElementById('translate-context-inputs');
                if (contextInputs) {
                    contextInputs.style.display = 'flex';
                }
                saveSettings();
            }
        });
    }

    if (translateContextFull) {
        translateContextFull.addEventListener('change', () => {
            if (translateContextFull.checked) {
                currentSettings.translate.contextMode = 'full';
                // 隐藏自定义输入框
                const contextInputs = document.getElementById('translate-context-inputs');
                if (contextInputs) {
                    contextInputs.style.display = 'none';
                }
                saveSettings();
            }
        });
    }

    if (translateContextBefore) {
        translateContextBefore.addEventListener('input', () => {
            const value = translateContextBefore.value !== '' ? parseInt(translateContextBefore.value) : 0;
            currentSettings.translate.contextBefore = value;
            saveSettings();
        });
    }

    if (translateContextAfter) {
        translateContextAfter.addEventListener('input', () => {
            const value = translateContextAfter.value !== '' ? parseInt(translateContextAfter.value) : 0;
            currentSettings.translate.contextAfter = value;
            saveSettings();
        });
    }

    // 对话设置变化
    const chatContextCustom = document.getElementById('chat-context-custom');
    const chatContextFull = document.getElementById('chat-context-full');
    const chatContextBefore = document.getElementById('chat-context-before');
    const chatContextAfter = document.getElementById('chat-context-after');

    // 上下文模式切换
    if (chatContextCustom) {
        chatContextCustom.addEventListener('change', () => {
            if (chatContextCustom.checked) {
                currentSettings.chat.contextMode = 'custom';
                // 显示自定义输入框
                const contextInputs = document.getElementById('chat-context-inputs');
                if (contextInputs) {
                    contextInputs.style.display = 'flex';
                }
                saveSettings();
            }
        });
    }

    if (chatContextFull) {
        chatContextFull.addEventListener('change', () => {
            if (chatContextFull.checked) {
                currentSettings.chat.contextMode = 'full';
                // 隐藏自定义输入框
                const contextInputs = document.getElementById('chat-context-inputs');
                if (contextInputs) {
                    contextInputs.style.display = 'none';
                }
                saveSettings();
            }
        });
    }

    if (chatContextBefore) {
        chatContextBefore.addEventListener('input', () => {
            const value = chatContextBefore.value !== '' ? parseInt(chatContextBefore.value) : 0;
            currentSettings.chat.contextBefore = value;
            saveSettings();
        });
    }

    if (chatContextAfter) {
        chatContextAfter.addEventListener('input', () => {
            const value = chatContextAfter.value !== '' ? parseInt(chatContextAfter.value) : 0;
            currentSettings.chat.contextAfter = value;
            saveSettings();
        });
    }
}

/**
 * 更新选项顺序UI
 */
function updateOptionsOrderUI(elements, translations) {
    console.log('[TextSelectionHelperSettings] updateOptionsOrderUI called');
    console.log('[TextSelectionHelperSettings] Received translations:', translations);

    // 如果传入的翻译对象为空，尝试从全局获取当前语言的翻译
    if (!translations || Object.keys(translations).length === 0) {
        getCurrentLanguageForSettings().then(currentLanguage => {
            console.log('[TextSelectionHelperSettings] Fallback: getting translations for language:', currentLanguage);
            const fallbackTranslations = window.translations && window.translations[currentLanguage] ? window.translations[currentLanguage] : {};
            console.log('[TextSelectionHelperSettings] Fallback translations:', fallbackTranslations);
            updateOptionsOrderUI(elements, fallbackTranslations);
        });
        return;
    }

    const container = document.getElementById('options-order-list');
    if (!container) {
        console.error('[TextSelectionHelperSettings] Container element not found: options-order-list');
        return;
    }

    console.log('[TextSelectionHelperSettings] Current settings:', currentSettings);
    console.log('[TextSelectionHelperSettings] Options order:', currentSettings.optionsOrder);

    container.innerHTML = '';

    if (!currentSettings.optionsOrder || currentSettings.optionsOrder.length === 0) {
        console.warn('[TextSelectionHelperSettings] No options order found, using default');
        currentSettings.optionsOrder = ['interpret', 'translate', 'chat'];
    }

    currentSettings.optionsOrder.forEach((optionId, index) => {
        const item = document.createElement('div');
        item.className = 'order-option-item';
        item.draggable = true;
        item.dataset.optionId = optionId;

        let optionName = optionId;
        let optionType = translations && translations.defaultAgentName ? translations.defaultAgentName : '默认';
        let optionIcon = '';

        if (optionId === 'interpret') {
            optionName = translations && translations.interpret ? translations.interpret : '解读';
            optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>`;
        } else if (optionId === 'translate') {
            optionName = translations && translations.translate ? translations.translate : '翻译';
            optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M5 8l6 6"/>
                <path d="M4 14l6-6 2-3"/>
                <path d="M2 5h12"/>
                <path d="M7 2h1"/>
                <path d="M22 22l-5-10-5 10"/>
                <path d="M14 18h6"/>
            </svg>`;
        } else if (optionId === 'chat') {
            optionName = translations && translations.chat ? translations.chat : '对话';
            optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>`;
        } else {
            // 检查是否是自定义选项
            const customOption = currentSettings.customOptions?.find(opt => opt.id === optionId);
            if (customOption) {
                optionName = customOption.name;
                optionType = translations && translations.customOptions ? translations.customOptions : '自定义';
                optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>`;
            }
        }

        item.innerHTML = `
            <div class="order-option-name">${optionIcon}${optionName}</div>
            <div class="order-option-type">${optionType}</div>
        `;

        container.appendChild(item);
    });

    console.log('[TextSelectionHelperSettings] Added', currentSettings.optionsOrder.length, 'items to container');
    console.log('[TextSelectionHelperSettings] Container children count:', container.children.length);

    // 添加拖拽功能
    setupDragAndDrop(container);
}

/**
 * 获取当前设置
 */
export function getTextSelectionHelperSettings() {
    return currentSettings;
}

/**
 * 获取划词助手是否启用
 */
export function isTextSelectionHelperEnabled() {
    return currentSettings.enabled !== false; // 默认为true
}



/**
 * 设置拖拽功能
 */
function setupDragAndDrop(container) {
    let draggedElement = null;
    let dragOverElement = null;

    // 为每个拖拽项添加事件监听器
    container.querySelectorAll('.order-option-item').forEach(item => {
        // 设置整个项目的光标样式为可拖拽
        item.style.cursor = 'grab';

        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.outerHTML);

            // 改变光标样式
            item.style.cursor = 'grabbing';
        });

        item.addEventListener('dragend', (e) => {
            item.style.opacity = '1';
            item.style.cursor = 'grab';

            // 清除所有拖拽样式
            container.querySelectorAll('.order-option-item').forEach(el => {
                el.classList.remove('drag-over');
            });

            draggedElement = null;
            dragOverElement = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // 添加拖拽悬停样式
            if (dragOverElement !== item) {
                container.querySelectorAll('.order-option-item').forEach(el => {
                    el.classList.remove('drag-over');
                });
                item.classList.add('drag-over');
                dragOverElement = item;
            }
        });

        item.addEventListener('dragleave', (e) => {
            // 只有当鼠标真正离开元素时才移除样式
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-over');
                if (dragOverElement === item) {
                    dragOverElement = null;
                }
            }
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();

            if (draggedElement && item !== draggedElement) {
                const draggedId = draggedElement.dataset.optionId;
                const targetId = item.dataset.optionId;

                const draggedIndex = currentSettings.optionsOrder.indexOf(draggedId);
                const targetIndex = currentSettings.optionsOrder.indexOf(targetId);

                // 重新排序
                currentSettings.optionsOrder.splice(draggedIndex, 1);
                currentSettings.optionsOrder.splice(targetIndex, 0, draggedId);

                saveSettings();

                // 重新渲染列表 - 获取当前语言的翻译对象
                getCurrentLanguageForSettings().then(currentLanguage => {
                    console.log('[TextSelectionHelperSettings] Getting translations for language:', currentLanguage);
                    const translations = window.translations && window.translations[currentLanguage] ? window.translations[currentLanguage] : {};
                    console.log('[TextSelectionHelperSettings] Available translations:', translations);
                    updateOptionsOrderUI(document, translations);
                }).catch(err => {
                    console.warn('[TextSelectionHelperSettings] Failed to get current language for drag reorder, using fallback');
                    updateOptionsOrderUI(document, {});
                });
            }

            item.classList.remove('drag-over');
        });
    });
}



/**
 * 添加自定义选项
 */
export function addCustomOption(optionData) {
    if (!currentSettings.customOptions) {
        currentSettings.customOptions = [];
    }

    const newOption = {
        id: generateUniqueId(),
        name: optionData.name,
        model: optionData.model || 'gemini-2.5-flash',
        systemPrompt: optionData.systemPrompt,
        temperature: optionData.temperature || 0.7,
        contextBefore: optionData.contextBefore !== undefined ? optionData.contextBefore : 500,
        contextAfter: optionData.contextAfter !== undefined ? optionData.contextAfter : 500,
        maxOutputLength: optionData.maxOutputLength !== undefined ? optionData.maxOutputLength : 65536,
        icon: optionData.icon || 'star' // 默认使用star图标
    };

    currentSettings.customOptions.push(newOption);
    currentSettings.optionsOrder.push(newOption.id);

    saveSettings();
    return newOption;
}

/**
 * 更新自定义选项
 */
export function updateCustomOption(optionId, optionData) {
    if (!currentSettings.customOptions) {
        return false;
    }

    const optionIndex = currentSettings.customOptions.findIndex(opt => opt.id === optionId);
    if (optionIndex === -1) {
        return false;
    }

    currentSettings.customOptions[optionIndex] = {
        ...currentSettings.customOptions[optionIndex],
        name: optionData.name,
        model: optionData.model,
        systemPrompt: optionData.systemPrompt,
        temperature: optionData.temperature,
        contextBefore: optionData.contextBefore,
        contextAfter: optionData.contextAfter,
        maxOutputLength: optionData.maxOutputLength,
        icon: optionData.icon || currentSettings.customOptions[optionIndex].icon || 'star'
    };

    saveSettings();
    return true;
}

/**
 * 删除自定义选项
 */
export function deleteCustomOption(optionId) {
    if (!currentSettings.customOptions) {
        return false;
    }

    const optionIndex = currentSettings.customOptions.findIndex(opt => opt.id === optionId);
    if (optionIndex === -1) {
        return false;
    }

    // 从自定义选项数组中删除
    currentSettings.customOptions.splice(optionIndex, 1);

    // 从选项顺序中删除
    const orderIndex = currentSettings.optionsOrder.indexOf(optionId);
    if (orderIndex !== -1) {
        currentSettings.optionsOrder.splice(orderIndex, 1);
    }

    saveSettings();
    return true;
}

/**
 * 获取自定义选项
 */
export function getCustomOption(optionId) {
    if (!currentSettings.customOptions) {
        return null;
    }

    return currentSettings.customOptions.find(opt => opt.id === optionId) || null;
}

/**
 * 获取所有自定义选项
 */
export function getAllCustomOptions() {
    return currentSettings.customOptions || [];
}

/**
 * 初始化自定义选项UI
 */
function initCustomOptionsUI(elements, translations) {
    console.log('[TextSelectionHelperSettings] Initializing custom options UI');

    // 渲染自定义选项列表
    renderCustomOptionsList(translations);

    // 设置添加按钮事件
    const addBtn = document.getElementById('add-custom-option-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showCustomOptionDialog(null, translations);
        });
    }
}

/**
 * 渲染自定义选项列表
 */
function renderCustomOptionsList(translations) {
    const container = document.getElementById('custom-options-list');
    if (!container) {
        console.error('[TextSelectionHelperSettings] Custom options container not found');
        return;
    }

    container.innerHTML = '';

    if (!currentSettings.customOptions || currentSettings.customOptions.length === 0) {
        container.innerHTML = `<p class="hint">${translations?.noCustomOptions || '暂无自定义选项'}</p>`;
        return;
    }

    currentSettings.customOptions.forEach(option => {
        const optionElement = createCustomOptionElement(option, translations);
        container.appendChild(optionElement);
    });
}

/**
 * 创建自定义选项元素
 */
function createCustomOptionElement(option, translations) {
    const element = document.createElement('div');
    element.className = 'custom-option-item';
    element.dataset.optionId = option.id;

    // 获取选项图标
    const optionIcon = renderLucideIconForSettings(option.icon || 'star', 16);

    element.innerHTML = `
        <div class="custom-option-header">
            <div class="custom-option-name">
                <span class="custom-option-icon">${optionIcon}</span>
                <span class="custom-option-text">${escapeHtml(option.name)}</span>
            </div>
            <div class="custom-option-actions">
                <button class="edit-custom-option-btn" data-option-id="${option.id}" title="${translations?.editOption || '编辑'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.707 13.707a1 1 0 0 1-.39.242l-3 1a1 1 0 0 1-1.266-1.265l1-3a1 1 0 0 1 .242-.391L10.086 2.5a2 2 0 0 1 2.828 0l.586.586a2 2 0 0 1 0 2.828L5.707 13.707zM3 11l7.5-7.5 1 1L4 12l-1-1zm0 2.5l1-1L5.5 14l-1 1-1.5-1.5z"/>
                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                    </svg>
                </button>
                <button class="delete-custom-option-btn" data-option-id="${option.id}" title="${translations?.deleteOption || '删除'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="custom-option-details">
            <div class="custom-option-detail">
                <div class="custom-option-detail-label">${translations?.model || '模型'}:</div>
                <div class="custom-option-detail-value">${escapeHtml(option.model)}</div>
            </div>
            <div class="custom-option-detail">
                <div class="custom-option-detail-label">${translations?.temperature || '温度'}:</div>
                <div class="custom-option-detail-value">${option.temperature}</div>
            </div>
            <div class="custom-option-detail">
                <div class="custom-option-detail-label">${translations?.contextWindow || '上下文窗口'}:</div>
                <div class="custom-option-detail-value">${option.contextBefore !== undefined ? option.contextBefore : 500}/${option.contextAfter !== undefined ? option.contextAfter : 500}</div>
            </div>
            <div class="custom-option-detail">
                <div class="custom-option-detail-label">${translations?.maxOutputLength || '最大输出长度'}:</div>
                <div class="custom-option-detail-value">${option.maxOutputLength !== undefined ? option.maxOutputLength : 65536}</div>
            </div>
            <div class="custom-option-detail" style="grid-column: 1 / -1;">
                <div class="custom-option-detail-label">${translations?.systemPrompt || '系统提示词'}:</div>
                <div class="custom-option-detail-value">${escapeHtml(option.systemPrompt.substring(0, 100))}${option.systemPrompt.length > 100 ? '...' : ''}</div>
            </div>
        </div>
    `;

    // 添加事件监听器
    const editBtn = element.querySelector('.edit-custom-option-btn');
    const deleteBtn = element.querySelector('.delete-custom-option-btn');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            showCustomOptionDialog(option, translations);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            showDeleteConfirmDialog(option, translations);
        });
    }

    return element;
}

/**
 * HTML转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 设置对话框语言变化监听器
 */
function setupDialogLanguageChangeListener(dialog, option) {
    if (!dialog) return;

    // 监听语言变化事件
    const handleLanguageChange = async (event) => {
        console.log('[TextSelectionHelperSettings] Dialog received language change event:', event.detail);

        try {
            const newLanguage = event.detail.newLanguage;
            if (window.translations && window.translations[newLanguage]) {
                const newTranslations = window.translations[newLanguage];
                updateDialogTranslations(dialog, option, newTranslations);
                console.log('[TextSelectionHelperSettings] Dialog translations updated for language:', newLanguage);
            }
        } catch (error) {
            console.warn('[TextSelectionHelperSettings] Error updating dialog translations:', error);
        }
    };

    // 添加事件监听器
    document.addEventListener('pagetalk:languageChanged', handleLanguageChange);

    // 在对话框关闭时清理事件监听器
    const cleanupListener = () => {
        document.removeEventListener('pagetalk:languageChanged', handleLanguageChange);
        console.log('[TextSelectionHelperSettings] Dialog language change listener cleaned up');
    };

    // 监听对话框关闭事件
    const closeBtn = dialog.querySelector('.custom-option-dialog-close');
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    const overlay = dialog;

    if (closeBtn) closeBtn.addEventListener('click', cleanupListener);
    if (cancelBtn) cancelBtn.addEventListener('click', cleanupListener);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanupListener();
        });
    }

    // 使用MutationObserver监听对话框从DOM中移除
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === dialog) {
                    cleanupListener();
                    observer.disconnect();
                }
            });
        });
    });

    observer.observe(document.body, { childList: true });
}

/**
 * 更新对话框的翻译文本
 */
function updateDialogTranslations(dialog, option, translations) {
    if (!dialog) return;

    const isEdit = !!option;
    const title = isEdit ? (translations?.editCustomOption || '编辑自定义选项') : (translations?.newCustomOption || '新建自定义选项');

    // 更新标题
    const titleElement = dialog.querySelector('.custom-option-dialog-header h3');
    if (titleElement) titleElement.textContent = title;

    // 更新标签
    const labels = dialog.querySelectorAll('label');
    if (labels[0]) labels[0].innerHTML = `${translations?.optionName || '选项名称'} *`;
    if (labels[1]) labels[1].textContent = translations?.model || '模型';
    if (labels[2]) labels[2].innerHTML = `${translations?.systemPrompt || '系统提示词'} *`;
    if (labels[3]) labels[3].textContent = translations?.temperature || '温度';
    if (labels[4]) labels[4].textContent = translations?.contextBefore || '前置上下文字符数';
    if (labels[5]) labels[5].textContent = translations?.contextAfter || '后置上下文字符数';
    if (labels[6]) labels[6].textContent = translations?.maxOutputLength || '最大输出长度';

    // 更新占位符
    const nameInput = dialog.querySelector('#custom-option-name');
    if (nameInput) nameInput.placeholder = translations?.optionNameRequired || '请输入选项名称';

    const promptTextarea = dialog.querySelector('#custom-option-prompt');
    if (promptTextarea) promptTextarea.placeholder = translations?.systemPromptRequired || '请输入系统提示词';

    // 更新按钮和提示
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    if (cancelBtn) cancelBtn.textContent = translations?.close || '关闭';

    const autoSaveNotice = dialog.querySelector('.auto-save-notice');
    if (autoSaveNotice) autoSaveNotice.textContent = translations?.autoSaveNotice || '更改将自动保存';
}

/**
 * 显示自定义选项对话框
 */
async function showCustomOptionDialog(option, translations) {
    const isEdit = !!option;

    // 获取最新的语言设置和翻译数据
    let currentTranslations = translations;
    try {
        const currentLanguage = await getCurrentLanguageForSettings();
        if (window.translations && window.translations[currentLanguage]) {
            currentTranslations = window.translations[currentLanguage];
            console.log('[TextSelectionHelperSettings] Using latest translations for language:', currentLanguage);
        }
    } catch (error) {
        console.warn('[TextSelectionHelperSettings] Failed to get latest language, using provided translations:', error);
    }

    const title = isEdit ? (currentTranslations?.editCustomOption || '编辑自定义选项') : (currentTranslations?.newCustomOption || '新建自定义选项');

    // 先获取模型选项HTML
    const modelOptionsHTML = await generateModelOptionsHTML(option?.model);

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'custom-option-dialog-overlay';
    dialog.innerHTML = `
        <div class="custom-option-dialog">
            <div class="custom-option-dialog-header">
                <h3>${title}</h3>
                <button class="custom-option-dialog-close">×</button>
            </div>
            <div class="custom-option-dialog-content">
                <div class="setting-group">
                    <label>${currentTranslations?.optionName || '选项名称'} *</label>
                    <input type="text" id="custom-option-name" value="${option ? escapeHtml(option.name) : ''}" placeholder="${currentTranslations?.optionNameRequired || '请输入选项名称'}">
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.optionIcon || '选项图标'}</label>
                    <div class="icon-selector">
                        <div class="icon-preview" id="custom-option-icon-preview">
                            ${renderLucideIconForSettings(option?.icon || 'star', 20)}
                        </div>
                        <button type="button" class="icon-select-btn" id="custom-option-icon-btn">
                            ${currentTranslations?.selectIcon || '选择图标'}
                        </button>
                        <input type="hidden" id="custom-option-icon" value="${option?.icon || 'star'}">
                    </div>
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.model || '模型'}</label>
                    <select id="custom-option-model">
                        ${modelOptionsHTML}
                    </select>
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.systemPrompt || '系统提示词'} *</label>
                    <textarea id="custom-option-prompt" rows="4" placeholder="${currentTranslations?.systemPromptRequired || '请输入系统提示词'}">${option ? escapeHtml(option.systemPrompt) : ''}</textarea>
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.temperature || '温度'}</label>
                    <div class="temperature-control">
                        <input type="range" id="custom-option-temperature" min="0" max="2" step="0.1" value="${option?.temperature || 0.7}">
                        <span class="temperature-value">${option?.temperature || 0.7}</span>
                    </div>
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.contextBefore || '前置上下文字符数'}</label>
                    <input type="number" id="custom-option-context-before" min="0" max="2000" value="${option?.contextBefore !== undefined ? option.contextBefore : 500}" placeholder="500">
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.contextAfter || '后置上下文字符数'}</label>
                    <input type="number" id="custom-option-context-after" min="0" max="2000" value="${option?.contextAfter !== undefined ? option.contextAfter : 500}" placeholder="500">
                </div>
                <div class="setting-group">
                    <label>${currentTranslations?.maxOutputLength || '最大输出长度'}</label>
                    <input type="number" id="custom-option-max-output" min="1" max="200000" value="${option?.maxOutputLength !== undefined ? option.maxOutputLength : 65536}" placeholder="65536">
                </div>
            </div>
            <div class="custom-option-dialog-footer">
                <div class="auto-save-notice">${currentTranslations?.autoSaveNotice || '更改将自动保存'}</div>
                <button class="custom-option-dialog-cancel">${currentTranslations?.close || '关闭'}</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // 设置事件监听器
    setupCustomOptionDialogEvents(dialog, option, currentTranslations);

    // 添加语言变化监听器
    setupDialogLanguageChangeListener(dialog, option);

    // 聚焦名称输入框
    setTimeout(() => {
        const nameInput = dialog.querySelector('#custom-option-name');
        if (nameInput) nameInput.focus();
    }, 100);
}

/**
 * 设置自定义选项对话框事件
 */
function setupCustomOptionDialogEvents(dialog, option, translations) {
    const closeBtn = dialog.querySelector('.custom-option-dialog-close');
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    const temperatureSlider = dialog.querySelector('#custom-option-temperature');
    const temperatureValue = dialog.querySelector('.temperature-value');

    // 获取所有输入元素
    const nameInput = dialog.querySelector('#custom-option-name');
    const iconInput = dialog.querySelector('#custom-option-icon');
    const modelSelect = dialog.querySelector('#custom-option-model');
    const promptTextarea = dialog.querySelector('#custom-option-prompt');
    const temperatureInput = dialog.querySelector('#custom-option-temperature');
    const contextBeforeInput = dialog.querySelector('#custom-option-context-before');
    const contextAfterInput = dialog.querySelector('#custom-option-context-after');
    const maxOutputInput = dialog.querySelector('#custom-option-max-output');

    // 使用对象来保存option引用，这样可以在函数内部修改
    const optionRef = { current: option };

    // 实时保存函数
    const autoSave = () => {
        const name = nameInput?.value.trim();
        const icon = iconInput?.value || 'star';
        const model = modelSelect?.value;
        const systemPrompt = promptTextarea?.value.trim();
        const temperature = parseFloat(temperatureInput?.value || 0.7);
        const contextBefore = contextBeforeInput?.value !== '' ? parseInt(contextBeforeInput.value) : 0;
        const contextAfter = contextAfterInput?.value !== '' ? parseInt(contextAfterInput.value) : 0;
        const maxOutputLength = maxOutputInput?.value !== '' ? parseInt(maxOutputInput.value) : 65536;

        // 基本验证（静默失败，不显示错误）
        if (!name || !systemPrompt) {
            return false;
        }

        // 保存选项
        const optionData = { name, icon, model, systemPrompt, temperature, contextBefore, contextAfter, maxOutputLength };

        try {
            if (optionRef.current) {
                // 编辑现有选项
                if (updateCustomOption(optionRef.current.id, optionData)) {
                    console.log('[TextSelectionHelperSettings] Custom option auto-saved:', optionRef.current.id);
                    renderCustomOptionsList(translations);
                    updateOptionsOrderUI(document, translations);
                    return true;
                }
            } else {
                // 添加新选项（只有在有名称和提示词时才创建）
                const newOption = addCustomOption(optionData);
                console.log('[TextSelectionHelperSettings] Custom option auto-created:', newOption.id);
                // 更新option引用，后续保存将变为编辑模式
                optionRef.current = newOption;
                renderCustomOptionsList(translations);
                updateOptionsOrderUI(document, translations);
                return true;
            }
        } catch (error) {
            console.warn('[TextSelectionHelperSettings] Auto-save failed:', error);
        }
        return false;
    };

    // 防抖函数
    let saveTimeout;
    const debouncedAutoSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(autoSave, 500); // 500ms延迟保存
    };

    // 关闭对话框
    const closeDialog = () => {
        clearTimeout(saveTimeout); // 清理定时器
        dialog.remove();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeDialog);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDialog);

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeDialog();
    });

    // 温度滑块事件
    if (temperatureSlider && temperatureValue) {
        temperatureSlider.addEventListener('input', () => {
            temperatureValue.textContent = temperatureSlider.value;
            debouncedAutoSave(); // 实时保存
        });
    }

    // 为所有输入元素添加实时保存事件
    if (nameInput) {
        nameInput.addEventListener('blur', debouncedAutoSave);
        nameInput.addEventListener('input', debouncedAutoSave);
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', debouncedAutoSave);
    }

    if (promptTextarea) {
        promptTextarea.addEventListener('blur', debouncedAutoSave);
        promptTextarea.addEventListener('input', debouncedAutoSave);
    }

    if (contextBeforeInput) {
        contextBeforeInput.addEventListener('blur', debouncedAutoSave);
        contextBeforeInput.addEventListener('change', debouncedAutoSave);
    }

    if (contextAfterInput) {
        contextAfterInput.addEventListener('blur', debouncedAutoSave);
        contextAfterInput.addEventListener('change', debouncedAutoSave);
    }

    if (maxOutputInput) {
        maxOutputInput.addEventListener('blur', debouncedAutoSave);
        maxOutputInput.addEventListener('change', debouncedAutoSave);
    }

    // 图标选择按钮事件
    const iconBtn = dialog.querySelector('#custom-option-icon-btn');
    const iconPreview = dialog.querySelector('#custom-option-icon-preview');

    if (iconBtn && iconInput && iconPreview) {
        iconBtn.addEventListener('click', async () => {
            const currentIcon = iconInput.value || 'star';
            await showIconPicker((selectedIcon) => {
                iconInput.value = selectedIcon;
                // 加载Lucide库后再更新预览
                loadLucideLibrary().then(() => {
                    iconPreview.innerHTML = renderLucideIconForSettings(selectedIcon, 20);
                });
                // 图标选择后立即保存
                debouncedAutoSave();
            }, currentIcon, translations);
        });
    }


}

/**
 * 显示删除确认对话框
 */
function showDeleteConfirmDialog(option, translations) {
    const confirmMessage = translations?.confirmDeleteOption || '确定要删除这个自定义选项吗？';

    if (confirm(confirmMessage)) {
        if (deleteCustomOption(option.id)) {
            console.log('[TextSelectionHelperSettings] Custom option deleted:', option.id);
            renderCustomOptionsList(translations);
            updateOptionsOrderUI(document, translations);
        } else {
            alert('删除失败');
        }
    }
}

/**
 * 动态加载Lucide库
 * @returns {Promise<boolean>} 是否成功加载
 */
function loadLucideLibrary() {
    return new Promise((resolve) => {
        // 如果已经加载，直接返回
        if (typeof lucide !== 'undefined') {
            resolve(true);
            return;
        }

        // 检查是否已经有script标签
        const existingScript = document.querySelector('script[src*="lucide"]');
        if (existingScript) {
            // 等待现有脚本加载
            waitForLucide().then(resolve);
            return;
        }

        // 动态创建script标签
        const script = document.createElement('script');
        script.src = '../js/lib/lucide.js';
        script.onload = () => {
            console.log('[TextSelectionHelperSettings] Lucide library loaded successfully');
            resolve(true);
        };
        script.onerror = () => {
            console.error('[TextSelectionHelperSettings] Failed to load Lucide library');
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * 等待Lucide库加载
 * @returns {Promise<boolean>} 是否成功加载
 */
function waitForLucide() {
    return new Promise((resolve) => {
        if (typeof lucide !== 'undefined') {
            resolve(true);
            return;
        }

        let attempts = 0;
        const maxAttempts = 50; // 最多等待5秒
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof lucide !== 'undefined') {
                clearInterval(checkInterval);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('[TextSelectionHelperSettings] Lucide library failed to load after 5 seconds');
                resolve(false);
            }
        }, 100);
    });
}

/**
 * 渲染Lucide图标
 * @param {string} iconName - 图标名称
 * @param {number} size - 图标大小
 * @returns {string} SVG HTML字符串
 */
function renderLucideIconForSettings(iconName, size = 16) {
    try {
        // 检查Lucide是否可用
        if (typeof lucide === 'undefined') {
            console.warn('[TextSelectionHelperSettings] Lucide library not available');
            return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>`;
        }

        // 转换图标名称为PascalCase（Lucide的命名约定）
        const pascalCaseName = iconName.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('');

        // 检查图标是否存在
        if (!lucide[pascalCaseName]) {
            console.warn(`[TextSelectionHelperSettings] Lucide icon "${iconName}" (${pascalCaseName}) not found`);
            // 尝试一些常见的别名映射
            const aliasMap = {
                'stop': 'CircleStop',
                'shop': 'ShoppingBag',
                'bank': 'Banknote',
                'scanner': 'Scan'
            };

            const aliasName = aliasMap[iconName];
            if (aliasName && lucide[aliasName]) {
                console.log(`[TextSelectionHelperSettings] Using alias "${aliasName}" for "${iconName}"`);
                const iconData = lucide[aliasName];
                if (iconData && Array.isArray(iconData)) {
                    return renderIconFromData(iconData, size);
                }
            }

            return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>`;
        }

        // 直接使用Lucide图标数据创建SVG
        const iconData = lucide[pascalCaseName];
        if (iconData && Array.isArray(iconData)) {
            return renderIconFromData(iconData, size);
        }

        // 如果以上方法都失败，返回默认图标
        return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`;
    } catch (error) {
        console.error('[TextSelectionHelperSettings] Error rendering Lucide icon:', error);
        return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`;
    }
}

/**
 * 从Lucide图标数据渲染SVG
 * @param {Array} iconData - Lucide图标数据数组
 * @param {number} size - 图标大小
 * @returns {string} SVG HTML字符串
 */
function renderIconFromData(iconData, size = 16) {
    let svgContent = '';
    iconData.forEach(([tag, attrs]) => {
        if (tag === 'path') {
            svgContent += `<path d="${attrs.d}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        } else if (tag === 'circle') {
            svgContent += `<circle cx="${attrs.cx}" cy="${attrs.cy}" r="${attrs.r}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        } else if (tag === 'rect') {
            svgContent += `<rect x="${attrs.x}" y="${attrs.y}" width="${attrs.width}" height="${attrs.height}"${attrs.rx ? ` rx="${attrs.rx}"` : ''}${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        } else if (tag === 'line') {
            svgContent += `<line x1="${attrs.x1}" y1="${attrs.y1}" x2="${attrs.x2}" y2="${attrs.y2}"${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        } else if (tag === 'polyline') {
            svgContent += `<polyline points="${attrs.points}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        }
    });

    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        ${svgContent}
    </svg>`;
}

/**
 * 显示图标选择器
 * @param {Function} onIconSelect - 图标选择回调函数
 * @param {string} currentIcon - 当前选择的图标
 * @param {Object} translations - 翻译对象
 */
async function showIconPicker(onIconSelect, currentIcon = 'star', translations = {}) {
    // 尝试加载Lucide库
    const lucideLoaded = await loadLucideLibrary();
    if (!lucideLoaded) {
        alert(translations.lucideLoadError || 'Lucide图标库加载失败，请刷新页面重试');
        return;
    }
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'icon-picker-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // 创建图标选择器容器
    const picker = document.createElement('div');
    picker.className = 'icon-picker';
    // 移除硬编码的样式，让CSS变量生效

    // 创建标题和关闭按钮
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h3');
    title.textContent = translations.selectIcon || '选择图标';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // 创建搜索框
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `margin-bottom: 16px;`;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = translations.searchIcons || '搜索图标...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 12px 16px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
        background: var(--input-background, #fff);
        color: var(--text-color, #333);
        transition: all 0.2s ease;
    `;

    // 添加搜索框焦点样式
    searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = 'var(--primary-color, #007bff)';
        searchInput.style.boxShadow = '0 0 0 2px rgba(116, 143, 252, 0.2)';
    });

    searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = 'var(--border-color, #ddd)';
        searchInput.style.boxShadow = 'none';
    });

    searchContainer.appendChild(searchInput);

    // 创建图标网格容器
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        border: 1px solid var(--border-color, #eee);
        border-radius: 8px;
        padding: 16px;
        background: var(--background-color, #f9f9f9);
    `;

    const iconGrid = document.createElement('div');
    iconGrid.className = 'icon-grid';

    gridContainer.appendChild(iconGrid);

    // 渲染图标
    function renderIcons(icons) {
        iconGrid.innerHTML = '';
        icons.forEach(iconName => {
            const iconItem = document.createElement('div');
            iconItem.className = `icon-item ${iconName === currentIcon ? 'selected' : ''}`;

            const iconSvg = document.createElement('div');
            iconSvg.innerHTML = renderLucideIconForSettings(iconName, 24);

            const iconLabel = document.createElement('span');
            iconLabel.textContent = iconName;

            iconItem.appendChild(iconSvg);
            iconItem.appendChild(iconLabel);

            // 点击选择
            iconItem.addEventListener('click', () => {
                onIconSelect(iconName);
                overlay.remove();
            });

            iconGrid.appendChild(iconItem);
        });
    }

    // 初始渲染所有图标
    renderIcons(POPULAR_LUCIDE_ICONS);

    // 搜索功能
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredIcons = POPULAR_LUCIDE_ICONS.filter(icon =>
            icon.toLowerCase().includes(searchTerm)
        );
        renderIcons(filteredIcons);
    });

    // 组装界面
    picker.appendChild(header);
    picker.appendChild(searchContainer);
    picker.appendChild(gridContainer);
    overlay.appendChild(picker);

    // 添加到页面
    document.body.appendChild(overlay);

    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    // ESC键关闭
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // 聚焦搜索框
    setTimeout(() => searchInput.focus(), 100);
}

/**
 * 初始化图标预览（在对话框显示后调用）
 * @param {HTMLElement} dialog - 对话框元素
 * @param {string} iconName - 图标名称
 */
async function initIconPreview(dialog, iconName = 'star') {
    const iconPreview = dialog.querySelector('#custom-option-icon-preview');
    if (iconPreview) {
        // 尝试加载Lucide库
        const lucideLoaded = await loadLucideLibrary();
        if (lucideLoaded) {
            iconPreview.innerHTML = renderLucideIconForSettings(iconName, 20);
        }
    }
}

// 监听模型更新事件
if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'modelsUpdated') {
            console.log('[TextSelectionHelperSettings] Models updated, refreshing model selectors...');
            refreshModelSelectors();
        }
    });
}

/**
 * 刷新模型选择器
 */
async function refreshModelSelectors() {
    try {
        const modelOptions = await getModelOptions();

        // 更新解读和翻译的模型选择器
        const selectors = [
            document.getElementById('interpret-model'),
            document.getElementById('translate-model')
        ];

        selectors.forEach(selector => {
            if (selector) {
                const currentValue = selector.value;

                // 清空并重新填充选项
                selector.innerHTML = '';

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
                        optionElement.setAttribute('data-provider-id', option.providerId || '');
                        optionElement.setAttribute('data-provider-name', option.providerName || '');
                        if (option.value === currentValue) {
                            optionElement.selected = true;
                        }
                        optgroup.appendChild(optionElement);
                    });

                    selector.appendChild(optgroup);
                });

                // 如果当前选择的模型不在新列表中，选择第一个可用模型
                if (!modelOptions.find(opt => opt.value === currentValue) && modelOptions.length > 0) {
                    selector.value = modelOptions[0].value;
                    console.log(`[TextSelectionHelperSettings] Model ${currentValue} no longer available, switched to ${modelOptions[0].value}`);

                    // 触发change事件以保存新的选择
                    selector.dispatchEvent(new Event('change'));
                }
            }
        });

        // 更新自定义选项对话框中的模型选择器（如果打开）
        const customDialog = document.querySelector('.custom-option-dialog-overlay');
        if (customDialog) {
            const customModelSelect = customDialog.querySelector('#custom-option-model');
            if (customModelSelect) {
                const currentValue = customModelSelect.value;

                customModelSelect.innerHTML = '';

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
                        optionElement.setAttribute('data-provider-id', option.providerId || '');
                        optionElement.setAttribute('data-provider-name', option.providerName || '');
                        if (option.value === currentValue) {
                            optionElement.selected = true;
                        }
                        optgroup.appendChild(optionElement);
                    });

                    customModelSelect.appendChild(optgroup);
                });

                if (!modelOptions.find(opt => opt.value === currentValue) && modelOptions.length > 0) {
                    customModelSelect.value = modelOptions[0].value;
                }
            }
        }

        console.log('[TextSelectionHelperSettings] Model selectors refreshed');
    } catch (error) {
        console.warn('[TextSelectionHelperSettings] Failed to refresh model selectors:', error);
    }
}
