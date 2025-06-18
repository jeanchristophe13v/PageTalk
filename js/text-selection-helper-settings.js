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
    const interpretPrompt = window.getDefaultPrompt ? window.getDefaultPrompt('interpret', language) : (language === 'en' ? 'Interpret this' : '解读一下');
    const translatePrompt = window.getDefaultPrompt ? window.getDefaultPrompt('translate', language) : (language === 'en' ? 'Translate this' : '翻译一下');
    const fallbackModel = 'gemini-2.5-flash'; // Updated fallback

    return {
        enabled: true,
        interpret: {
            model: fallbackModel,
            systemPrompt: interpretPrompt,
            temperature: 0.7,
            contextBefore: 500,
            contextAfter: 500,
            maxOutputLength: 65536
        },
        translate: {
            model: fallbackModel,
            systemPrompt: translatePrompt,
            temperature: 0.2,
            contextBefore: 500,
            contextAfter: 500,
            maxOutputLength: 65536
        },
        customOptions: [],
        optionsOrder: ['interpret', 'translate', 'chat']
    };
}

const DEFAULT_SETTINGS = getDefaultSettings('zh-CN');
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * 获取翻译函数 (确保在文件顶部或可访问的作用域内定义)
 */
function getTranslationFunction() {
    if (window.parent && window.parent._tr) return window.parent._tr;
    if (window._tr) return window._tr;
    if (typeof translations !== 'undefined') {
        return function(key, replacements = {}) {
            const currentLanguage = window.currentLanguageCache || 'zh-CN';
            const translation = translations[currentLanguage]?.[key] || translations['zh-CN']?.[key] || key;
            let result = translation;
            for (const placeholder in replacements) {
                result = result.replace(`{${placeholder}}`, replacements[placeholder]);
            }
            return result;
        };
    }
    return function(key) {
        const fb = {'configureModelsInSettings': 'Please configure models in Settings'};
        return fb[key] || key;
    };
}


/**
 * 获取可用的模型列表
 * @param {object} currentTranslations - 当前翻译对象 (用于提示信息，虽然此函数目前不直接用)
 * @returns {Promise<string[]>} - 模型ID列表
 */
async function getAvailableModels(currentTranslations) { // currentTranslations might be used by a _tr call if needed
    return new Promise((resolve) => {
        if (!chrome || !chrome.storage || !chrome.storage.sync) {
            console.warn('[TextSelectionHelperSettings] Chrome storage API not available, using fallback model list.');
            resolve(['gemini-2.5-flash']); // Updated Fallback
            return;
        }
        try {
            chrome.storage.sync.get(['userSelectedModels'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error("Error fetching userSelectedModels:", chrome.runtime.lastError);
                    resolve(['gemini-2.5-flash']); // Updated Fallback
                    return;
                }
                const userModels = result.userSelectedModels || [];
                if (userModels.length > 0) {
                    resolve(userModels);
                } else {
                    resolve(['gemini-2.5-flash']); // Updated Fallback if empty
                }
            });
        } catch (error) {
            console.error("Exception fetching userSelectedModels:", error);
            resolve(['gemini-2.5-flash']); // Updated Fallback
        }
    });
}

/**
 * 填充模型选择下拉框
 * @param {HTMLSelectElement} selectElement - 要填充的select元素
 * @param {string[]} availableModels - 可用模型ID列表
 * @param {string} currentSelectedValue - 当前选中的模型ID
 * @param {object} currentTranslations - 当前翻译对象 (用于提示)
 */
function populateModelSelectWithOptions(selectElement, availableModels, currentSelectedValue, currentTranslations) {
    if (!selectElement) return;
    selectElement.innerHTML = ''; // 清空现有选项

    const _tr = getTranslationFunction();

    if (availableModels && availableModels.length > 0) {
        availableModels.forEach(modelId => {
            const optionElement = document.createElement('option');
            optionElement.value = modelId;
            optionElement.textContent = modelId;
            selectElement.appendChild(optionElement);
        });

        if (availableModels.includes(currentSelectedValue)) {
            selectElement.value = currentSelectedValue;
        } else {
            selectElement.value = availableModels[0];
        }
    } else {
        const fallbackModel = 'gemini-2.5-flash'; // Updated Fallback
        const optionElement = document.createElement('option');
        optionElement.value = fallbackModel;
        optionElement.textContent = fallbackModel;
        selectElement.appendChild(optionElement);

        if (currentTranslations && Object.keys(currentTranslations).length > 0) {
            const promptOption = document.createElement('option');
            promptOption.textContent = _tr('configureModelsInSettings', {}, currentTranslations);
            promptOption.disabled = true;
            selectElement.appendChild(promptOption);
        }
        selectElement.value = fallbackModel;
    }
}


/**
 * 初始化划词助手设置模块的特定模型选择器
 */
async function initTextSelectionModelSelectors(elements, settings, translations) {
    const availableModels = await getAvailableModels(translations);

    const interpretModelSelect = document.getElementById('interpret-model');
    const translateModelSelect = document.getElementById('translate-model');

    if (interpretModelSelect) {
        populateModelSelectWithOptions(interpretModelSelect, availableModels, settings.interpret.model, translations);
    }
    if (translateModelSelect) {
        populateModelSelectWithOptions(translateModelSelect, availableModels, settings.translate.model, translations);
    }
}


export async function initTextSelectionHelperSettings(elements, translations) {
    await loadSettings();

    if (translations && Object.keys(translations).length > 0) {
        // Ensure global/module-level currentTranslations is updated if necessary for _tr
        // This depends on how _tr and currentLanguageCache are managed globally or passed around.
        // For now, assuming `translations` param is sufficient for functions called below.
    }

    initSettingCards(elements);
    loadSettingsToUI(elements);

    await initTextSelectionModelSelectors(elements, currentSettings, translations);

    setupEventListeners(elements, translations);
    initCustomOptionsUI(elements, translations);
    setupLanguageChangeListener();
}

function loadSettings() {
    return new Promise((resolve) => {
        if (!chrome || !chrome.storage || !chrome.storage.sync) {
            console.warn('[TextSelectionHelperSettings] Chrome storage API not available, using default settings');
            currentSettings = { ...DEFAULT_SETTINGS }; // DEFAULT_SETTINGS already uses updated fallback
            resolve();
            return;
        }
        try {
            chrome.storage.sync.get(['language', 'textSelectionHelperSettings'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[TextSelectionHelperSettings] Error loading settings:', chrome.runtime.lastError);
                    currentSettings = { ...DEFAULT_SETTINGS };
                } else {
                    const currentLanguage = result.language || 'zh-CN';
                    window.currentLanguageCache = currentLanguage;
                    const dynamicDefaults = getDefaultSettings(currentLanguage); // This will use updated fallback
                    if (result.textSelectionHelperSettings) {
                        currentSettings = { ...dynamicDefaults, ...result.textSelectionHelperSettings };
                        // Ensure existing settings also use the new fallback if their model is not in a valid list (handled by populate)
                        if (currentSettings.interpret && (!currentSettings.interpret.model || typeof currentSettings.interpret.model !== 'string')) {
                            currentSettings.interpret.model = dynamicDefaults.interpret.model;
                        }
                        if (currentSettings.translate && (!currentSettings.translate.model || typeof currentSettings.translate.model !== 'string')) {
                            currentSettings.translate.model = dynamicDefaults.translate.model;
                        }

                        if (currentSettings.interpret && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.interpret.systemPrompt, 'interpret')) {
                            currentSettings.interpret.systemPrompt = window.getDefaultPrompt('interpret', currentLanguage);
                        }
                        if (currentSettings.translate && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.translate.systemPrompt, 'translate')) {
                            currentSettings.translate.systemPrompt = window.getDefaultPrompt('translate', currentLanguage);
                        }
                        if (currentSettings.interpret && currentSettings.interpret.maxOutputLength === undefined) {
                            currentSettings.interpret.maxOutputLength = 65536;
                        }
                        if (currentSettings.translate && currentSettings.translate.maxOutputLength === undefined) {
                            currentSettings.translate.maxOutputLength = 65536;
                        }
                        if (!currentSettings.customOptions) currentSettings.customOptions = [];
                        if (currentSettings.customOptions) {
                            currentSettings.customOptions.forEach(option => {
                                if (!option.model) option.model = dynamicDefaults.interpret.model; // Default custom options too
                                if (option.maxOutputLength === undefined) option.maxOutputLength = 65536;
                                if (option.icon === undefined) option.icon = 'star';
                            });
                        }
                        if (!currentSettings.optionsOrder) currentSettings.optionsOrder = ['interpret', 'translate', 'chat'];
                    } else {
                        currentSettings = { ...dynamicDefaults };
                    }
                }
                resolve();
            });
        } catch (error) {
            console.error('[TextSelectionHelperSettings] Exception loading settings:', error);
            currentSettings = { ...DEFAULT_SETTINGS };
            resolve();
        }
    });
}

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

function setupLanguageChangeListener() {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.language) {
                const newLanguage = changes.language.newValue;
                const oldLanguage = changes.language.oldValue;
                if (newLanguage !== oldLanguage) {
                    handleLanguageChange(newLanguage);
                }
            }
        });
    }
}

async function handleLanguageChange(newLanguage) {
    window.currentLanguageCache = newLanguage;
    const needsUpdate = updateDefaultPromptsForLanguage(newLanguage);
    const settingsContainer = document.querySelector('#settings-text-selection-helper');
    if (settingsContainer) {
        const translations = window.translations && window.translations[newLanguage] ? window.translations[newLanguage] : {};
        const elements = { textSelectionHelperSettings: settingsContainer };

        loadSettingsToUI(elements);
        await initTextSelectionModelSelectors(elements, currentSettings, translations);

        updateOptionsOrderUI(elements, translations);
        renderCustomOptionsList(translations);
        const openDialog = document.querySelector('.custom-option-dialog-overlay');
        if (openDialog) {
            const nameInput = openDialog.querySelector('#custom-option-name');
            const isEdit = nameInput && nameInput.value.trim() !== '';
            let currentOption = null;
            if (isEdit) {
                const currentName = nameInput.value.trim();
                currentOption = currentSettings.customOptions?.find(opt => opt.name === currentName);
            }
            updateDialogTranslations(openDialog, currentOption, translations);
        }
    }
    if (needsUpdate) {
        saveSettings();
    }
}

function updateDefaultPromptsForLanguage(language) {
    let updated = false;
    if (currentSettings.interpret && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.interpret.systemPrompt, 'interpret')) {
        const newPrompt = window.getDefaultPrompt('interpret', language);
        if (currentSettings.interpret.systemPrompt !== newPrompt) {
            currentSettings.interpret.systemPrompt = newPrompt;
            updated = true;
        }
    }
    if (currentSettings.translate && window.isDefaultPrompt && window.isDefaultPrompt(currentSettings.translate.systemPrompt, 'translate')) {
        const newPrompt = window.getDefaultPrompt('translate', language);
        if (currentSettings.translate.systemPrompt !== newPrompt) {
            currentSettings.translate.systemPrompt = newPrompt;
            updated = true;
        }
    }
    return updated;
}

function saveSettings() {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
        console.warn('[TextSelectionHelperSettings] Chrome storage API not available, cannot save settings');
        return;
    }
    const settingsToSave = { ...currentSettings };
    try {
        chrome.storage.sync.set({ textSelectionHelperSettings: settingsToSave }, () => {
            if (chrome.runtime.lastError) {
                console.error('[TextSelectionHelperSettings] Error saving settings:', chrome.runtime.lastError);
            }
        });
    } catch (error) {
        console.error('[TextSelectionHelperSettings] Exception saving settings:', error);
    }
}

function initSettingsUI(elements, translations) {
    initSettingCards(elements);
    loadSettingsToUI(elements);
    updateOptionsOrderUI(elements, translations);
}

function initSettingCards(elements) {
    const cards = document.querySelectorAll('#settings-text-selection-helper .setting-card');
    cards.forEach((card) => {
        const header = card.querySelector('.setting-card-header');
        const toggle = card.querySelector('.setting-card-toggle');
        const cardTitle = header?.querySelector('h3')?.textContent?.trim();
        const isOptionsOrderCard = cardTitle === '选项顺序' || cardTitle === 'Option Order';
        if (isOptionsOrderCard) {
            card.classList.add('expanded', 'no-collapse');
            if (toggle) toggle.remove();
            if (header) { header.style.cursor = 'default'; header.style.pointerEvents = 'none'; }
        } else {
            card.classList.add('collapsed');
            if (header && toggle) {
                header.addEventListener('click', () => {
                    const isExpanded = card.classList.contains('expanded');
                    cards.forEach(otherCard => {
                        if (otherCard !== card && !otherCard.classList.contains('no-collapse')) {
                            otherCard.classList.remove('expanded');
                            otherCard.classList.add('collapsed');
                        }
                    });
                    card.classList.toggle('expanded', !isExpanded);
                    card.classList.toggle('collapsed', isExpanded);
                });
            }
        }
    });
}

function loadSettingsToUI(elements) {
    const enabledToggle = document.getElementById('text-selection-helper-enabled');
    if (enabledToggle) enabledToggle.checked = currentSettings.enabled !== false;

    const interpretPrompt = document.getElementById('interpret-system-prompt');
    const interpretTemp = document.getElementById('interpret-temperature');
    const interpretTempValue = interpretTemp?.parentElement.querySelector('.temperature-value');
    const interpretMaxOutput = document.getElementById('interpret-max-output');

    if (interpretPrompt && currentSettings.interpret) interpretPrompt.value = currentSettings.interpret.systemPrompt;
    if (interpretTemp && currentSettings.interpret) {
        interpretTemp.value = currentSettings.interpret.temperature;
        if (interpretTempValue) interpretTempValue.textContent = currentSettings.interpret.temperature;
    }
    if (interpretMaxOutput && currentSettings.interpret) interpretMaxOutput.value = currentSettings.interpret.maxOutputLength || 65536;

    const translatePrompt = document.getElementById('translate-system-prompt');
    const translateTemp = document.getElementById('translate-temperature');
    const translateTempValue = translateTemp?.parentElement.querySelector('.temperature-value');
    const translateMaxOutput = document.getElementById('translate-max-output');

    if (translatePrompt && currentSettings.translate) translatePrompt.value = currentSettings.translate.systemPrompt;
    if (translateTemp && currentSettings.translate) {
        translateTemp.value = currentSettings.translate.temperature;
        if (translateTempValue) translateTempValue.textContent = currentSettings.translate.temperature;
    }
    if (translateMaxOutput && currentSettings.translate) translateMaxOutput.value = currentSettings.translate.maxOutputLength || 65536;
}

function setupEventListeners(elements, translations) {
    const enabledToggle = document.getElementById('text-selection-helper-enabled');
    if (enabledToggle) {
        enabledToggle.addEventListener('change', () => {
            currentSettings.enabled = enabledToggle.checked;
            saveSettings();
        });
    }

    const interpretModelEl = document.getElementById('interpret-model');
    const interpretPromptEl = document.getElementById('interpret-system-prompt');
    const interpretTempEl = document.getElementById('interpret-temperature');
    const interpretMaxOutputEl = document.getElementById('interpret-max-output');

    if (interpretModelEl) interpretModelEl.addEventListener('change', () => { currentSettings.interpret.model = interpretModelEl.value; saveSettings(); });
    if (interpretPromptEl) interpretPromptEl.addEventListener('input', () => { currentSettings.interpret.systemPrompt = interpretPromptEl.value; saveSettings(); });
    if (interpretTempEl) interpretTempEl.addEventListener('input', () => {
        const value = parseFloat(interpretTempEl.value);
        currentSettings.interpret.temperature = value;
        const valueDisplay = interpretTempEl.parentElement.querySelector('.temperature-value');
        if (valueDisplay) valueDisplay.textContent = value;
        saveSettings();
    });
    if (interpretMaxOutputEl) interpretMaxOutputEl.addEventListener('input', () => { currentSettings.interpret.maxOutputLength = parseInt(interpretMaxOutputEl.value) || 65536; saveSettings(); });
    
    const translateModelEl = document.getElementById('translate-model');
    const translatePromptEl = document.getElementById('translate-system-prompt');
    const translateTempEl = document.getElementById('translate-temperature');
    const translateMaxOutputEl = document.getElementById('translate-max-output');

    if (translateModelEl) translateModelEl.addEventListener('change', () => { currentSettings.translate.model = translateModelEl.value; saveSettings(); });
    if (translatePromptEl) translatePromptEl.addEventListener('input', () => { currentSettings.translate.systemPrompt = translatePromptEl.value; saveSettings(); });
    if (translateTempEl) translateTempEl.addEventListener('input', () => {
        const value = parseFloat(translateTempEl.value);
        currentSettings.translate.temperature = value;
        const valueDisplay = translateTempEl.parentElement.querySelector('.temperature-value');
        if (valueDisplay) valueDisplay.textContent = value;
        saveSettings();
    });
    if (translateMaxOutputEl) translateMaxOutputEl.addEventListener('input', () => { currentSettings.translate.maxOutputLength = parseInt(translateMaxOutputEl.value) || 65536; saveSettings(); });
}

function updateOptionsOrderUI(elements, translations) {
    if (!translations || Object.keys(translations).length === 0) {
        getCurrentLanguageForSettings().then(currentLanguage => {
            const fallbackTranslations = window.translations && window.translations[currentLanguage] ? window.translations[currentLanguage] : {};
            updateOptionsOrderUI(elements, fallbackTranslations);
        });
        return;
    }
    const container = document.getElementById('options-order-list');
    if (!container) {
        console.error('[TextSelectionHelperSettings] Container element not found: options-order-list');
        return;
    }
    container.innerHTML = '';
    if (!currentSettings.optionsOrder || currentSettings.optionsOrder.length === 0) {
        currentSettings.optionsOrder = ['interpret', 'translate', 'chat'];
    }
    currentSettings.optionsOrder.forEach((optionId) => {
        const item = document.createElement('div');
        item.className = 'order-option-item';
        item.draggable = true;
        item.dataset.optionId = optionId;
        let optionName = optionId;
        let optionType = translations?.defaultAgentName || 'Default';
        let optionIcon = '';
        if (optionId === 'interpret') {
            optionName = translations?.interpret || 'Interpret';
            optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        } else if (optionId === 'translate') {
            optionName = translations?.translate || 'Translate';
            optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>`;
        } else if (optionId === 'chat') {
            optionName = translations?.chat || 'Chat';
            optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        } else {
            const customOption = currentSettings.customOptions?.find(opt => opt.id === optionId);
            if (customOption) {
                optionName = customOption.name;
                optionType = translations?.customOptions || 'Custom';
                optionIcon = `<svg class="order-option-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
            }
        }
        item.innerHTML = `<div class="order-option-name">${optionIcon}${optionName}</div><div class="order-option-type">${optionType}</div>`;
        container.appendChild(item);
    });
    setupDragAndDrop(container);
}

export function getTextSelectionHelperSettings() { return currentSettings; }
export function isTextSelectionHelperEnabled() { return currentSettings.enabled !== false; }

function setupDragAndDrop(container) {
    let draggedElement = null;
    let dragOverElement = null;
    container.querySelectorAll('.order-option-item').forEach(item => {
        item.style.cursor = 'grab';
        item.addEventListener('dragstart', (e) => { /* ... (rest of the logic as before) ... */ });
        item.addEventListener('dragend', (e) => { /* ... (rest of the logic as before) ... */ });
        item.addEventListener('dragover', (e) => { /* ... (rest of the logic as before) ... */ });
        item.addEventListener('dragleave', (e) => { /* ... (rest of the logic as before) ... */ });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedElement && item !== draggedElement) {
                const draggedId = draggedElement.dataset.optionId;
                const targetId = item.dataset.optionId;
                const draggedIndex = currentSettings.optionsOrder.indexOf(draggedId);
                const targetIndex = currentSettings.optionsOrder.indexOf(targetId);
                currentSettings.optionsOrder.splice(draggedIndex, 1);
                currentSettings.optionsOrder.splice(targetIndex, 0, draggedId);
                saveSettings();
                getCurrentLanguageForSettings().then(currentLanguage => {
                    const translations = window.translations && window.translations[currentLanguage] ? window.translations[currentLanguage] : {};
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

export function addCustomOption(optionData) {
    if (!currentSettings.customOptions) currentSettings.customOptions = [];
    const newOption = {
        id: generateUniqueId(), name: optionData.name, model: optionData.model || 'gemini-2.5-flash', // Updated Fallback
        systemPrompt: optionData.systemPrompt, temperature: optionData.temperature || 0.7,
        contextBefore: optionData.contextBefore !== undefined ? optionData.contextBefore : 500,
        contextAfter: optionData.contextAfter !== undefined ? optionData.contextAfter : 500,
        maxOutputLength: optionData.maxOutputLength !== undefined ? optionData.maxOutputLength : 65536,
        icon: optionData.icon || 'star'
    };
    currentSettings.customOptions.push(newOption);
    currentSettings.optionsOrder.push(newOption.id);
    saveSettings(); return newOption;
}

export function updateCustomOption(optionId, optionData) {
    if (!currentSettings.customOptions) return false;
    const optionIndex = currentSettings.customOptions.findIndex(opt => opt.id === optionId);
    if (optionIndex === -1) return false;
    currentSettings.customOptions[optionIndex] = {
        ...currentSettings.customOptions[optionIndex], name: optionData.name, model: optionData.model,
        systemPrompt: optionData.systemPrompt, temperature: optionData.temperature,
        contextBefore: optionData.contextBefore, contextAfter: optionData.contextAfter,
        maxOutputLength: optionData.maxOutputLength,
        icon: optionData.icon || currentSettings.customOptions[optionIndex].icon || 'star'
    };
    saveSettings(); return true;
}

export function deleteCustomOption(optionId) {
    if (!currentSettings.customOptions) return false;
    const optionIndex = currentSettings.customOptions.findIndex(opt => opt.id === optionId);
    if (optionIndex === -1) return false;
    currentSettings.customOptions.splice(optionIndex, 1);
    const orderIndex = currentSettings.optionsOrder.indexOf(optionId);
    if (orderIndex !== -1) currentSettings.optionsOrder.splice(orderIndex, 1);
    saveSettings(); return true;
}

export function getCustomOption(optionId) {
    if (!currentSettings.customOptions) return null;
    return currentSettings.customOptions.find(opt => opt.id === optionId) || null;
}
export function getAllCustomOptions() { return currentSettings.customOptions || []; }

function initCustomOptionsUI(elements, translations) {
    renderCustomOptionsList(translations);
    const addBtn = document.getElementById('add-custom-option-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => { showCustomOptionDialog(null, translations); });
    }
}

function renderCustomOptionsList(translations) {
    const container = document.getElementById('custom-options-list');
    if (!container) { return; }
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

function createCustomOptionElement(option, translations) {
    const element = document.createElement('div');
    element.className = 'custom-option-item';
    element.dataset.optionId = option.id;
    const optionIcon = renderLucideIconForSettings(option.icon || 'star', 16);
    element.innerHTML = `
        <div class="custom-option-header">
            <div class="custom-option-name"><span class="custom-option-icon">${optionIcon}</span><span class="custom-option-text">${escapeHtml(option.name)}</span></div>
            <div class="custom-option-actions">
                <button class="edit-custom-option-btn" data-option-id="${option.id}" title="${translations?.editOption || '编辑'}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.707 13.707a1 1 0 0 1-.39.242l-3 1a1 1 0 0 1-1.266-1.265l1-3a1 1 0 0 1 .242-.391L10.086 2.5a2 2 0 0 1 2.828 0l.586.586a2 2 0 0 1 0 2.828L5.707 13.707zM3 11l7.5-7.5 1 1L4 12l-1-1zm0 2.5l1-1L5.5 14l-1 1-1.5-1.5z"/><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/></svg></button>
                <button class="delete-custom-option-btn" data-option-id="${option.id}" title="${translations?.deleteOption || '删除'}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg></button>
            </div>
        </div>
        <div class="custom-option-details">
            <div class="custom-option-detail"><div class="custom-option-detail-label">${translations?.model || '模型'}:</div><div class="custom-option-detail-value">${escapeHtml(option.model)}</div></div>
            <div class="custom-option-detail"><div class="custom-option-detail-label">${translations?.temperature || '温度'}:</div><div class="custom-option-detail-value">${option.temperature}</div></div>
            <div class="custom-option-detail"><div class="custom-option-detail-label">${translations?.contextWindow || '上下文窗口'}:</div><div class="custom-option-detail-value">${option.contextBefore !== undefined ? option.contextBefore : 500}/${option.contextAfter !== undefined ? option.contextAfter : 500}</div></div>
            <div class="custom-option-detail"><div class="custom-option-detail-label">${translations?.maxOutputLength || '最大输出长度'}:</div><div class="custom-option-detail-value">${option.maxOutputLength !== undefined ? option.maxOutputLength : 65536}</div></div>
            <div class="custom-option-detail" style="grid-column: 1 / -1;"><div class="custom-option-detail-label">${translations?.systemPrompt || '系统提示词'}:</div><div class="custom-option-detail-value">${escapeHtml(option.systemPrompt.substring(0, 100))}${option.systemPrompt.length > 100 ? '...' : ''}</div></div>
        </div>
    `;
    const editBtn = element.querySelector('.edit-custom-option-btn');
    const deleteBtn = element.querySelector('.delete-custom-option-btn');
    if (editBtn) editBtn.addEventListener('click', () => { showCustomOptionDialog(option, translations); });
    if (deleteBtn) deleteBtn.addEventListener('click', () => { showDeleteConfirmDialog(option, translations); });
    return element;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupDialogLanguageChangeListener(dialog, option) {
    if (!dialog) return;
    const handleLanguageChange = async (event) => {
        try {
            const newLanguage = event.detail.newLanguage;
            if (window.translations && window.translations[newLanguage]) {
                const newTranslations = window.translations[newLanguage];
                updateDialogTranslations(dialog, option, newTranslations);
            }
        } catch (error) {
            console.warn('[TextSelectionHelperSettings] Error updating dialog translations:', error);
        }
    };
    document.addEventListener('pagetalk:languageChanged', handleLanguageChange);
    const cleanupListener = () => {
        document.removeEventListener('pagetalk:languageChanged', handleLanguageChange);
    };
    const closeBtn = dialog.querySelector('.custom-option-dialog-close');
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    const overlay = dialog;
    if (closeBtn) closeBtn.addEventListener('click', cleanupListener);
    if (cancelBtn) cancelBtn.addEventListener('click', cleanupListener);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanupListener(); });
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

function updateDialogTranslations(dialog, option, translations) {
    if (!dialog) return;
    const isEdit = !!option;
    const title = isEdit ? (translations?.editCustomOption || '编辑自定义选项') : (translations?.newCustomOption || '新建自定义选项');
    const titleElement = dialog.querySelector('.custom-option-dialog-header h3');
    if (titleElement) titleElement.textContent = title;
    const labels = dialog.querySelectorAll('label');
    if (labels[0]) labels[0].innerHTML = `${translations?.optionName || '选项名称'} *`;
    if (labels[1]) labels[1].textContent = translations?.optionIcon || '选项图标';
    if (labels[2]) labels[2].textContent = translations?.model || '模型';
    if (labels[3]) labels[3].innerHTML = `${translations?.systemPrompt || '系统提示词'} *`;
    if (labels[4]) labels[4].textContent = translations?.temperature || '温度';
    if (labels[5]) labels[5].textContent = translations?.contextBefore || '前置上下文字符数';
    if (labels[6]) labels[6].textContent = translations?.contextAfter || '后置上下文字符数';
    if (labels[7]) labels[7].textContent = translations?.maxOutputLength || '最大输出长度';

    const nameInput = dialog.querySelector('#custom-option-name');
    if (nameInput) nameInput.placeholder = translations?.optionNameRequired || '请输入选项名称';
    const promptTextarea = dialog.querySelector('#custom-option-prompt');
    if (promptTextarea) promptTextarea.placeholder = translations?.systemPromptRequired || '请输入系统提示词';
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    if (cancelBtn) cancelBtn.textContent = translations?.close || '关闭';
    const autoSaveNotice = dialog.querySelector('.auto-save-notice');
    if (autoSaveNotice) autoSaveNotice.textContent = translations?.autoSaveNotice || '更改将自动保存';
    const iconSelectBtn = dialog.querySelector('#custom-option-icon-btn');
    if(iconSelectBtn) iconSelectBtn.textContent = translations?.selectIcon || '选择图标';
}

async function showCustomOptionDialog(option, translations) {
    const isEdit = !!option;
    let currentTranslations = translations;
    try {
        const currentLanguage = await getCurrentLanguageForSettings();
        if (window.translations && window.translations[currentLanguage]) {
            currentTranslations = window.translations[currentLanguage];
        }
    } catch (error) {
        console.warn('[TextSelectionHelperSettings] Failed to get latest language for dialog, using provided translations:', error);
    }
    const title = isEdit ? (currentTranslations?.editCustomOption || '编辑自定义选项') : (currentTranslations?.newCustomOption || '新建自定义选项');
    const dialog = document.createElement('div');
    dialog.className = 'custom-option-dialog-overlay';
    dialog.innerHTML = `
        <div class="custom-option-dialog">
            <div class="custom-option-dialog-header"><h3>${title}</h3><button class="custom-option-dialog-close">×</button></div>
            <div class="custom-option-dialog-content">
                <div class="setting-group"><label>${currentTranslations?.optionName || '选项名称'} *</label><input type="text" id="custom-option-name" value="${option ? escapeHtml(option.name) : ''}" placeholder="${currentTranslations?.optionNameRequired || '请输入选项名称'}"></div>
                <div class="setting-group"><label>${currentTranslations?.optionIcon || '选项图标'}</label><div class="icon-selector"><div class="icon-preview" id="custom-option-icon-preview">${renderLucideIconForSettings(option?.icon || 'star', 20)}</div><button type="button" class="icon-select-btn" id="custom-option-icon-btn">${currentTranslations?.selectIcon || '选择图标'}</button><input type="hidden" id="custom-option-icon" value="${option?.icon || 'star'}"></div></div>
                <div class="setting-group"><label>${currentTranslations?.model || '模型'}</label><select id="custom-option-model"></select></div>
                <div class="setting-group"><label>${currentTranslations?.systemPrompt || '系统提示词'} *</label><textarea id="custom-option-prompt" rows="4" placeholder="${currentTranslations?.systemPromptRequired || '请输入系统提示词'}">${option ? escapeHtml(option.systemPrompt) : ''}</textarea></div>
                <div class="setting-group"><label>${currentTranslations?.temperature || '温度'}</label><div class="temperature-control"><input type="range" id="custom-option-temperature" min="0" max="2" step="0.1" value="${option?.temperature || 0.7}"><span class="temperature-value">${option?.temperature || 0.7}</span></div></div>
                <div class="setting-group"><label>${currentTranslations?.contextBefore || '前置上下文字符数'}</label><input type="number" id="custom-option-context-before" min="0" max="2000" value="${option?.contextBefore !== undefined ? option.contextBefore : 500}" placeholder="500"></div>
                <div class="setting-group"><label>${currentTranslations?.contextAfter || '后置上下文字符数'}</label><input type="number" id="custom-option-context-after" min="0" max="2000" value="${option?.contextAfter !== undefined ? option.contextAfter : 500}" placeholder="500"></div>
                <div class="setting-group"><label>${currentTranslations?.maxOutputLength || '最大输出长度'}</label><input type="number" id="custom-option-max-output" min="1" max="200000" value="${option?.maxOutputLength !== undefined ? option.maxOutputLength : 65536}" placeholder="65536"></div>
            </div>
            <div class="custom-option-dialog-footer"><div class="auto-save-notice">${currentTranslations?.autoSaveNotice || '更改将自动保存'}</div><button class="custom-option-dialog-cancel">${currentTranslations?.close || '关闭'}</button></div>
        </div>
    `;
    document.body.appendChild(dialog);

    const modelSelectElement = dialog.querySelector('#custom-option-model');
    const availableModels = await getAvailableModels(currentTranslations);
    const currentOptionModel = option?.model || (availableModels.length > 0 ? availableModels[0] : 'gemini-2.5-flash'); // Ensuring this is also updated
    populateModelSelectWithOptions(modelSelectElement, availableModels, currentOptionModel, currentTranslations);

    setupCustomOptionDialogEvents(dialog, option, currentTranslations);
    setupDialogLanguageChangeListener(dialog, option);
    setTimeout(() => {
        const nameInput = dialog.querySelector('#custom-option-name');
        if (nameInput) nameInput.focus();
    }, 100);
}

function setupCustomOptionDialogEvents(dialog, option, translations) {
    const closeBtn = dialog.querySelector('.custom-option-dialog-close');
    const cancelBtn = dialog.querySelector('.custom-option-dialog-cancel');
    const temperatureSlider = dialog.querySelector('#custom-option-temperature');
    const temperatureValue = dialog.querySelector('.temperature-value');
    const nameInput = dialog.querySelector('#custom-option-name');
    const iconInput = dialog.querySelector('#custom-option-icon');
    const modelSelect = dialog.querySelector('#custom-option-model');
    const promptTextarea = dialog.querySelector('#custom-option-prompt');
    const temperatureInput = dialog.querySelector('#custom-option-temperature');
    const contextBeforeInput = dialog.querySelector('#custom-option-context-before');
    const contextAfterInput = dialog.querySelector('#custom-option-context-after');
    const maxOutputInput = dialog.querySelector('#custom-option-max-output');
    const optionRef = { current: option };

    const autoSave = () => {
        const name = nameInput?.value.trim();
        const icon = iconInput?.value || 'star';
        const model = modelSelect?.value;
        const systemPrompt = promptTextarea?.value.trim();
        const temperature = parseFloat(temperatureInput?.value || 0.7);
        const contextBefore = contextBeforeInput?.value !== '' ? parseInt(contextBeforeInput.value) : 500;
        const contextAfter = contextAfterInput?.value !== '' ? parseInt(contextAfterInput.value) : 500;
        const maxOutputLength = maxOutputInput?.value !== '' ? parseInt(maxOutputInput.value) : 65536;
        if (!name || !systemPrompt) return false;
        const optionData = { name, icon, model, systemPrompt, temperature, contextBefore, contextAfter, maxOutputLength };
        try {
            if (optionRef.current) {
                if (updateCustomOption(optionRef.current.id, optionData)) {
                    renderCustomOptionsList(translations);
                    updateOptionsOrderUI(document, translations);
                    return true;
                }
            } else {
                const newOption = addCustomOption(optionData);
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

    let saveTimeout;
    const debouncedAutoSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(autoSave, 500);
    };

    const closeDialog = () => { clearTimeout(saveTimeout); dialog.remove(); };
    if (closeBtn) closeBtn.addEventListener('click', closeDialog);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });
    if (temperatureSlider && temperatureValue) {
        temperatureSlider.addEventListener('input', () => {
            temperatureValue.textContent = temperatureSlider.value;
            debouncedAutoSave();
        });
    }
    [nameInput, modelSelect, promptTextarea, contextBeforeInput, contextAfterInput, maxOutputInput, temperatureInput].forEach(input => {
        if (input) {
            const eventType = (input.tagName === 'SELECT' || input.type === 'range') ? 'change' : 'input';
            input.addEventListener(eventType, debouncedAutoSave);
            input.addEventListener('blur', debouncedAutoSave);
        }
    });

    const iconBtn = dialog.querySelector('#custom-option-icon-btn');
    const iconPreview = dialog.querySelector('#custom-option-icon-preview');
    if (iconBtn && iconInput && iconPreview) {
        iconBtn.addEventListener('click', async () => {
            const currentIcon = iconInput.value || 'star';
            await showIconPicker((selectedIcon) => {
                iconInput.value = selectedIcon;
                loadLucideLibrary().then(() => { iconPreview.innerHTML = renderLucideIconForSettings(selectedIcon, 20); });
                debouncedAutoSave();
            }, currentIcon, translations);
        });
    }
}

function showDeleteConfirmDialog(option, translations) {
    const confirmMessage = translations?.confirmDeleteOption || '确定要删除这个自定义选项吗？';
    if (confirm(confirmMessage)) {
        if (deleteCustomOption(option.id)) {
            renderCustomOptionsList(translations);
            updateOptionsOrderUI(document, translations);
        } else {
            alert('删除失败');
        }
    }
}

function loadLucideLibrary() {
    return new Promise((resolve) => {
        if (typeof lucide !== 'undefined') { resolve(true); return; }
        const existingScript = document.querySelector('script[src*="lucide"]');
        if (existingScript) { waitForLucide().then(resolve); return; }
        const script = document.createElement('script');
        script.src = '../js/lib/lucide.js';
        script.onload = () => { resolve(true); };
        script.onerror = () => { console.error('[TextSelectionHelperSettings] Failed to load Lucide library'); resolve(false); };
        document.head.appendChild(script);
    });
}

function waitForLucide() {
    return new Promise((resolve) => {
        if (typeof lucide !== 'undefined') { resolve(true); return; }
        let attempts = 0;
        const maxAttempts = 50;
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

function renderLucideIconForSettings(iconName, size = 16) {
    try {
        if (typeof lucide === 'undefined') {
            console.warn('[TextSelectionHelperSettings] Lucide library not available');
            return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
        const pascalCaseName = iconName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
        if (!lucide[pascalCaseName]) {
            console.warn(`[TextSelectionHelperSettings] Lucide icon "${iconName}" (${pascalCaseName}) not found`);
            const aliasMap = { 'stop': 'CircleStop', 'shop': 'ShoppingBag', 'bank': 'Banknote', 'scanner': 'Scan' };
            const aliasName = aliasMap[iconName];
            if (aliasName && lucide[aliasName]) {
                const iconData = lucide[aliasName];
                if (iconData && Array.isArray(iconData)) return renderIconFromData(iconData, size);
            }
            return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
        const iconData = lucide[pascalCaseName];
        if (iconData && Array.isArray(iconData)) return renderIconFromData(iconData, size);
        return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    } catch (error) {
        console.error('[TextSelectionHelperSettings] Error rendering Lucide icon:', error);
        return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
}

function renderIconFromData(iconData, size = 16) {
    let svgContent = '';
    iconData.forEach(([tag, attrs]) => {
        if (tag === 'path') svgContent += `<path d="${attrs.d}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        else if (tag === 'circle') svgContent += `<circle cx="${attrs.cx}" cy="${attrs.cy}" r="${attrs.r}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        else if (tag === 'rect') svgContent += `<rect x="${attrs.x}" y="${attrs.y}" width="${attrs.width}" height="${attrs.height}"${attrs.rx ? ` rx="${attrs.rx}"` : ''}${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        else if (tag === 'line') svgContent += `<line x1="${attrs.x1}" y1="${attrs.y1}" x2="${attrs.x2}" y2="${attrs.y2}"${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
        else if (tag === 'polyline') svgContent += `<polyline points="${attrs.points}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
    });
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${svgContent}</svg>`;
}

async function showIconPicker(onIconSelect, currentIcon = 'star', translations = {}) {
    const lucideLoaded = await loadLucideLibrary();
    if (!lucideLoaded) {
        alert(translations.lucideLoadError || 'Lucide图标库加载失败，请刷新页面重试');
        return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'icon-picker-overlay';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;`;
    const picker = document.createElement('div');
    picker.className = 'icon-picker';
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
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `margin-bottom: 16px;`;
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = translations.searchIcons || '搜索图标...';
    searchInput.style.cssText = `width: 100%; padding: 12px 16px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; font-size: 14px; box-sizing: border-box; background: var(--input-background, #fff); color: var(--text-color, #333); transition: all 0.2s ease;`;
    searchInput.addEventListener('focus', () => { searchInput.style.borderColor = 'var(--primary-color, #007bff)'; searchInput.style.boxShadow = '0 0 0 2px rgba(116, 143, 252, 0.2)'; });
    searchInput.addEventListener('blur', () => { searchInput.style.borderColor = 'var(--border-color, #ddd)'; searchInput.style.boxShadow = 'none'; });
    searchContainer.appendChild(searchInput);
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `flex: 1; overflow-y: auto; border: 1px solid var(--border-color, #eee); border-radius: 8px; padding: 16px; background: var(--background-color, #f9f9f9);`;
    const iconGrid = document.createElement('div');
    iconGrid.className = 'icon-grid';
    gridContainer.appendChild(iconGrid);
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
            iconItem.addEventListener('click', () => { onIconSelect(iconName); overlay.remove(); });
            iconGrid.appendChild(iconItem);
        });
    }
    renderIcons(POPULAR_LUCIDE_ICONS);
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredIcons = POPULAR_LUCIDE_ICONS.filter(icon => icon.toLowerCase().includes(searchTerm));
        renderIcons(filteredIcons);
    });
    picker.appendChild(header);
    picker.appendChild(searchContainer);
    picker.appendChild(gridContainer);
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const handleEscape = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', handleEscape); } };
    document.addEventListener('keydown', handleEscape);
    setTimeout(() => searchInput.focus(), 100);
}

async function initIconPreview(dialog, iconName = 'star') {
    const iconPreview = dialog.querySelector('#custom-option-icon-preview');
    if (iconPreview) {
        const lucideLoaded = await loadLucideLibrary();
        if (lucideLoaded) iconPreview.innerHTML = renderLucideIconForSettings(iconName, 20);
    }
}

// Ensure this file does not re-declare functions from utils.js if they are meant to be imported
// e.g. generateUniqueId, escapeHtml (if it's a general util)

// Ensure _tr is available if not importing translations directly
// This is a fallback, ideally translations are passed or available globally
const _tr = getTranslationFunction();

[end of js/text-selection-helper-settings.js]
