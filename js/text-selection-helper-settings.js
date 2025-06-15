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
            temperature: 0.7
        },
        translate: {
            model: 'gemini-2.5-flash',
            systemPrompt: translatePrompt,
            temperature: 0.2
        },
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

    // 清理可能存在的错误数据
    cleanupStorageData();

    // 加载设置（等待完成）
    await loadSettings();

    // 初始化UI
    initSettingsUI(elements, translations);

    // 设置事件监听器
    setupEventListeners(elements, translations);

    // 监听语言切换事件
    setupLanguageChangeListener();

    console.log('[TextSelectionHelperSettings] Initialized');
}

/**
 * 清理存储中的错误数据
 */
function cleanupStorageData() {
    chrome.storage.sync.get(['textSelectionHelperSettings'], (result) => {
        if (result.textSelectionHelperSettings) {
            const settings = result.textSelectionHelperSettings;
            let needsCleanup = false;

            // 检查是否有自定义选项需要清理
            if (settings.customOptions && settings.customOptions.length > 0) {
                needsCleanup = true;
            }

            // 检查选项顺序中是否有非默认选项
            if (settings.optionsOrder && settings.optionsOrder.some(id =>
                !['interpret', 'translate', 'chat'].includes(id)
            )) {
                needsCleanup = true;
            }

            if (needsCleanup) {
                console.log('[TextSelectionHelperSettings] Cleaning up storage data...');
                const cleanSettings = {
                    interpret: settings.interpret || DEFAULT_SETTINGS.interpret,
                    translate: settings.translate || DEFAULT_SETTINGS.translate,
                    optionsOrder: ['interpret', 'translate', 'chat']
                };

                chrome.storage.sync.set({ textSelectionHelperSettings: cleanSettings }, () => {
                    console.log('[TextSelectionHelperSettings] Storage cleanup completed');
                });
            }
        }
    });
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

                        // 清理可能存在的自定义选项残留
                        delete currentSettings.customOptions;
                        // 确保选项顺序只包含默认选项
                        currentSettings.optionsOrder = currentSettings.optionsOrder.filter(id =>
                            ['interpret', 'translate', 'chat'].includes(id)
                        );
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

    // 确保保存前清理自定义选项
    const settingsToSave = { ...currentSettings };
    delete settingsToSave.customOptions;
    settingsToSave.optionsOrder = settingsToSave.optionsOrder.filter(id =>
        ['interpret', 'translate', 'chat'].includes(id)
    );

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

    if (interpretModel) interpretModel.value = currentSettings.interpret.model;
    if (interpretPrompt) interpretPrompt.value = currentSettings.interpret.systemPrompt;
    if (interpretTemp) {
        interpretTemp.value = currentSettings.interpret.temperature;
        if (interpretTempValue) interpretTempValue.textContent = currentSettings.interpret.temperature;
    }

    // 翻译设置
    const translateModel = document.getElementById('translate-model');
    const translatePrompt = document.getElementById('translate-system-prompt');
    const translateTemp = document.getElementById('translate-temperature');
    const translateTempValue = translateTemp?.parentElement.querySelector('.temperature-value');

    if (translateModel) translateModel.value = currentSettings.translate.model;
    if (translatePrompt) translatePrompt.value = currentSettings.translate.systemPrompt;
    if (translateTemp) {
        translateTemp.value = currentSettings.translate.temperature;
        if (translateTempValue) translateTempValue.textContent = currentSettings.translate.temperature;
    }
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
    
    // 翻译设置变化
    const translateModel = document.getElementById('translate-model');
    const translatePrompt = document.getElementById('translate-system-prompt');
    const translateTemp = document.getElementById('translate-temperature');
    
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
