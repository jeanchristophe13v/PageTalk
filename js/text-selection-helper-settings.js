/**
 * Pagetalk - Text Selection Helper Settings Module
 * 划词助手设置管理模块
 */

// 默认设置
const DEFAULT_SETTINGS = {
    interpret: {
        model: 'gemini-2.5-flash',
        systemPrompt: '解读一下',
        temperature: 0.7
    },
    translate: {
        model: 'gemini-2.5-flash',
        systemPrompt: '翻译一下',
        temperature: 0.2
    },
    optionsOrder: ['interpret', 'translate', 'chat']
};

// 当前设置
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * 初始化划词助手设置
 */
export function initTextSelectionHelperSettings(elements, translations) {
    console.log('[TextSelectionHelperSettings] Initializing...');

    // 清理可能存在的错误数据
    cleanupStorageData();

    // 加载设置
    loadSettings();

    // 初始化UI
    initSettingsUI(elements, translations);

    // 设置事件监听器
    setupEventListeners(elements, translations);

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
    chrome.storage.sync.get(['textSelectionHelperSettings'], (result) => {
        if (result.textSelectionHelperSettings) {
            currentSettings = { ...DEFAULT_SETTINGS, ...result.textSelectionHelperSettings };
            // 清理可能存在的自定义选项残留
            delete currentSettings.customOptions;
            // 确保选项顺序只包含默认选项
            currentSettings.optionsOrder = currentSettings.optionsOrder.filter(id =>
                ['interpret', 'translate', 'chat'].includes(id)
            );
        }
        console.log('[TextSelectionHelperSettings] Settings loaded:', currentSettings);
    });
}

/**
 * 保存设置
 */
function saveSettings() {
    // 确保保存前清理自定义选项
    const settingsToSave = { ...currentSettings };
    delete settingsToSave.customOptions;
    settingsToSave.optionsOrder = settingsToSave.optionsOrder.filter(id =>
        ['interpret', 'translate', 'chat'].includes(id)
    );

    chrome.storage.sync.set({ textSelectionHelperSettings: settingsToSave }, () => {
        if (chrome.runtime.lastError) {
            console.error('[TextSelectionHelperSettings] Error saving settings:', chrome.runtime.lastError);
        } else {
            console.log('[TextSelectionHelperSettings] Settings saved');
        }
    });
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
    const cards = document.querySelectorAll('.setting-card');
    cards.forEach(card => {
        const header = card.querySelector('.setting-card-header');
        const toggle = card.querySelector('.setting-card-toggle');
        
        if (header && toggle) {
            header.addEventListener('click', () => {
                card.classList.toggle('collapsed');
            });
        }
    });
}

/**
 * 加载设置到UI
 */
function loadSettingsToUI(elements) {
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
    const container = document.getElementById('options-order-list');
    if (!container) return;

    container.innerHTML = '';

    currentSettings.optionsOrder.forEach((optionId, index) => {
        const item = document.createElement('div');
        item.className = 'order-option-item';
        item.draggable = true;
        item.dataset.optionId = optionId;

        let optionName = optionId;
        let optionType = '默认';

        if (optionId === 'interpret') {
            optionName = '解读';
        } else if (optionId === 'translate') {
            optionName = '翻译';
        } else if (optionId === 'chat') {
            optionName = '对话';
        }

        item.innerHTML = `
            <div class="order-option-drag-handle">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
            </div>
            <div class="order-option-name">${optionName}</div>
            <div class="order-option-type">${optionType}</div>
        `;

        container.appendChild(item);
    });

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
 * 设置拖拽功能
 */
function setupDragAndDrop(container) {
    let draggedElement = null;
    let dragOverElement = null;

    // 为每个拖拽项添加事件监听器
    container.querySelectorAll('.order-option-item').forEach(item => {
        // 设置拖拽手柄的光标样式
        const dragHandle = item.querySelector('.order-option-drag-handle');
        if (dragHandle) {
            dragHandle.style.cursor = 'grab';
        }

        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.outerHTML);

            // 改变光标样式
            if (dragHandle) {
                dragHandle.style.cursor = 'grabbing';
            }
        });

        item.addEventListener('dragend', (e) => {
            item.style.opacity = '1';
            if (dragHandle) {
                dragHandle.style.cursor = 'grab';
            }

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

                // 重新渲染列表
                updateOptionsOrderUI(document, {});
            }

            item.classList.remove('drag-over');
        });
    });
}
