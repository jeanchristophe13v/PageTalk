/**
 * Pagetalk - Text Selection Helper Settings Module
 * 划词助手设置管理模块
 */

/**
 * 获取默认设置（根据语言动态生成）
 */
function getDefaultSettings(language = 'zh-CN') {
    // 使用translations.js中的默认提示词
    const interpretPrompt = window.getDefaultPrompt ? window.getDefaultPrompt('interpret', language) : (language === 'en' ? 'Interpret this' : '解读一下');
    const translatePrompt = window.getDefaultPrompt ? window.getDefaultPrompt('translate', language) : (language === 'en' ? 'Translate this' : '翻译一下');

    return {
        enabled: true, // 默认启用划词助手
        interpret: {
            model: 'gemini-2.5-flash',
            systemPrompt: interpretPrompt,
            temperature: 0.7,
            contextBefore: 500,
            contextAfter: 500,
            maxOutputLength: 65536
        },
        translate: {
            model: 'gemini-2.5-flash',
            systemPrompt: translatePrompt,
            temperature: 0.2,
            contextBefore: 500,
            contextAfter: 500,
            maxOutputLength: 65536
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

    // 初始化UI
    initSettingsUI(elements, translations);

    // 设置事件监听器
    setupEventListeners(elements, translations);

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

                        // 确保自定义选项数组存在
                        if (!currentSettings.customOptions) {
                            currentSettings.customOptions = [];
                        }

                        // 为现有自定义选项添加maxOutputLength字段（向后兼容）
                        if (currentSettings.customOptions) {
                            currentSettings.customOptions.forEach(option => {
                                if (option.maxOutputLength === undefined) {
                                    option.maxOutputLength = 65536;
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
function initSettingsUI(elements, translations) {
    // 初始化模型选择器
    initModelSelectors(elements);
    
    // 初始化设置卡片
    initSettingCards(elements);
    
    // 加载当前设置到UI
    loadSettingsToUI(elements);

    // 初始化选项顺序列表
    updateOptionsOrderUI(elements, translations);
}

/**
 * 初始化模型选择器
 */
function initModelSelectors(elements) {
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

    const selectors = [
        document.getElementById('interpret-model'),
        document.getElementById('translate-model')
    ];

    selectors.forEach(selector => {
        if (selector) {
            selector.innerHTML = '';
            modelOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                selector.appendChild(optionElement);
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
 * 生成唯一ID
 */
function generateUniqueId() {
    return 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
        maxOutputLength: optionData.maxOutputLength !== undefined ? optionData.maxOutputLength : 65536
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
        maxOutputLength: optionData.maxOutputLength
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

    element.innerHTML = `
        <div class="custom-option-header">
            <div class="custom-option-name">${escapeHtml(option.name)}</div>
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

    // 更新按钮
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    if (cancelBtn) cancelBtn.textContent = translations?.cancelEdit || '取消';

    const saveBtn = dialog.querySelector('.custom-option-dialog-save');
    if (saveBtn) saveBtn.textContent = translations?.saveOption || '保存';
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
                    <label>${currentTranslations?.model || '模型'}</label>
                    <select id="custom-option-model">
                        <option value="gemini-2.5-flash" ${!option || option?.model === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
                        <option value="gemini-2.0-flash" ${option?.model === 'gemini-2.0-flash' ? 'selected' : ''}>gemini-2.0-flash</option>
                        <option value="gemini-2.5-flash-thinking" ${option?.model === 'gemini-2.5-flash-thinking' ? 'selected' : ''}>gemini-2.5-flash-thinking</option>
                        <option value="gemini-2.0-flash-thinking-exp-01-21" ${option?.model === 'gemini-2.0-flash-thinking-exp-01-21' ? 'selected' : ''}>gemini-2.0-flash-thinking</option>
                        <option value="gemini-2.0-pro-exp-02-05" ${option?.model === 'gemini-2.0-pro-exp-02-05' ? 'selected' : ''}>gemini-2.0-pro-exp-02-05</option>
                        <option value="gemini-2.5-pro-exp-03-25" ${option?.model === 'gemini-2.5-pro-exp-03-25' ? 'selected' : ''}>gemini-2.5-pro-exp-03-25</option>
                        <option value="gemini-2.5-pro-preview-03-25" ${option?.model === 'gemini-2.5-pro-preview-03-25' ? 'selected' : ''}>gemini-2.5-pro-preview-03-25</option>
                        <option value="gemini-2.5-pro-preview-05-06" ${option?.model === 'gemini-2.5-pro-preview-05-06' ? 'selected' : ''}>gemini-2.5-pro-preview-05-06</option>
                        <option value="gemini-exp-1206" ${option?.model === 'gemini-exp-1206' ? 'selected' : ''}>gemini-exp-1206</option>
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
                <button class="custom-option-dialog-cancel">${currentTranslations?.cancelEdit || '取消'}</button>
                <button class="custom-option-dialog-save">${currentTranslations?.saveOption || '保存'}</button>
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
    const saveBtn = dialog.querySelector('.custom-option-dialog-save');
    const temperatureSlider = dialog.querySelector('#custom-option-temperature');
    const temperatureValue = dialog.querySelector('.temperature-value');

    // 关闭对话框
    const closeDialog = () => {
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
        });
    }

    // 保存按钮事件
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const nameInput = dialog.querySelector('#custom-option-name');
            const modelSelect = dialog.querySelector('#custom-option-model');
            const promptTextarea = dialog.querySelector('#custom-option-prompt');
            const temperatureInput = dialog.querySelector('#custom-option-temperature');
            const contextBeforeInput = dialog.querySelector('#custom-option-context-before');
            const contextAfterInput = dialog.querySelector('#custom-option-context-after');
            const maxOutputInput = dialog.querySelector('#custom-option-max-output');

            const name = nameInput?.value.trim();
            const model = modelSelect?.value;
            const systemPrompt = promptTextarea?.value.trim();
            const temperature = parseFloat(temperatureInput?.value || 0.7);
            const contextBefore = contextBeforeInput?.value !== '' ? parseInt(contextBeforeInput.value) : 500;
            const contextAfter = contextAfterInput?.value !== '' ? parseInt(contextAfterInput.value) : 500;
            const maxOutputLength = maxOutputInput?.value !== '' ? parseInt(maxOutputInput.value) : 65536;

            // 验证输入
            if (!name) {
                alert(translations?.optionNameRequired || '请输入选项名称');
                nameInput?.focus();
                return;
            }

            if (!systemPrompt) {
                alert(translations?.systemPromptRequired || '请输入系统提示词');
                promptTextarea?.focus();
                return;
            }

            // 保存选项
            const optionData = { name, model, systemPrompt, temperature, contextBefore, contextAfter, maxOutputLength };

            if (option) {
                // 编辑现有选项
                if (updateCustomOption(option.id, optionData)) {
                    console.log('[TextSelectionHelperSettings] Custom option updated:', option.id);
                    renderCustomOptionsList(translations);
                    updateOptionsOrderUI(document, translations);
                    closeDialog();
                } else {
                    alert('更新失败');
                }
            } else {
                // 添加新选项
                const newOption = addCustomOption(optionData);
                console.log('[TextSelectionHelperSettings] Custom option added:', newOption.id);
                renderCustomOptionsList(translations);
                updateOptionsOrderUI(document, translations);
                closeDialog();
            }
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
