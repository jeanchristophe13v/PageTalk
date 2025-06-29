/**
 * PageTalk - Quick Actions Manager
 * 快捷操作数据管理模块
 */

import { generateUniqueId } from './utils.js';

// 当前快捷操作设置
let currentQuickActions = {
    actions: [],
    version: '1.0'
};

// 初始化状态标记
let isInitialized = false;

/**
 * 获取当前语言设置
 */
function getCurrentLanguage() {
    // 尝试从全局状态获取语言设置
    if (typeof window !== 'undefined' && window.state && window.state.language) {
        return window.state.language;
    }
    // 从localStorage获取语言设置
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('language') || 'zh-CN';
    }
    return 'zh-CN';
}

/**
 * 获取翻译文本
 */
function getTranslation(key) {
    const currentLanguage = getCurrentLanguage();
    if (typeof window !== 'undefined' && window.translations) {
        return window.translations[currentLanguage]?.[key] ||
               window.translations['zh-CN']?.[key] ||
               key;
    }
    return key;
}

/**
 * 获取当前语言的默认快捷操作
 */
function getDefaultQuickActions() {
    return [
        {
            id: 'default-summarize',
            name: getTranslation('defaultQuickActionSummarize'),
            prompt: getTranslation('defaultQuickActionSummarizePrompt'),
            ignoreAssistant: false,
            order: 0
        },
        {
            id: 'default-mermaid',
            name: getTranslation('defaultQuickActionMermaid'),
            prompt: getTranslation('defaultQuickActionMermaidPrompt'),
            ignoreAssistant: true,
            order: 1
        }
    ];
}

/**
 * 初始化快捷操作管理器
 */
export async function initQuickActionsManager() {
    console.log('[QuickActionsManager] Initializing...');

    try {
        const loadResult = await loadQuickActions();

        // 只有在首次使用时才初始化默认操作
        if (loadResult.isFirstTime) {
            await initializeDefaultActions();
            console.log('[QuickActionsManager] First time use, initialized with default actions');
        }

        console.log('[QuickActionsManager] Initialized with', currentQuickActions.actions.length, 'actions');
        isInitialized = true;
        return true;
    } catch (error) {
        console.error('[QuickActionsManager] Initialization failed:', error);
        isInitialized = false;
        return false;
    }
}

/**
 * 加载快捷操作设置
 */
async function loadQuickActions() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['quickActions'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('[QuickActionsManager] Load error:', chrome.runtime.lastError);
                resolve({ isFirstTime: true });
                return;
            }

            if (result.quickActions) {
                console.log('[QuickActionsManager] Loading stored quick actions:', result.quickActions);
                currentQuickActions = {
                    ...currentQuickActions,
                    ...result.quickActions
                };

                // 确保actions数组存在
                if (!currentQuickActions.actions) {
                    currentQuickActions.actions = [];
                }

                // 确保每个操作都有必要的字段
                currentQuickActions.actions = currentQuickActions.actions.map(action => ({
                    id: action.id || generateUniqueId(),
                    name: action.name || '未命名操作',
                    prompt: action.prompt || '',
                    ignoreAssistant: action.ignoreAssistant || false,
                    order: action.order || 0
                }));

                // 按order排序
                currentQuickActions.actions.sort((a, b) => a.order - b.order);

                console.log('[QuickActionsManager] Loaded', currentQuickActions.actions.length, 'actions:', currentQuickActions.actions);

                // 即使有存储数据，如果actions数组为空，也不是首次使用
                // 这表示用户已经删除了所有快捷操作
                resolve({ isFirstTime: false });
            } else {
                console.log('[QuickActionsManager] No stored quick actions found, first time use');
                resolve({ isFirstTime: true });
            }
        });
    });
}

/**
 * 保存快捷操作设置
 */
async function saveQuickActions() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ quickActions: currentQuickActions }, () => {
            if (chrome.runtime.lastError) {
                console.error('[QuickActionsManager] Save error:', chrome.runtime.lastError);
                resolve(false);
                return;
            }
            
            console.log('[QuickActionsManager] Settings saved');
            resolve(true);
        });
    });
}

/**
 * 初始化默认快捷操作
 */
async function initializeDefaultActions() {
    console.log('[QuickActionsManager] Initializing default actions');

    currentQuickActions.actions = getDefaultQuickActions();
    await saveQuickActions();
}

/**
 * 检查是否已初始化
 */
export function isQuickActionsManagerInitialized() {
    return isInitialized;
}

/**
 * 获取所有快捷操作
 */
export function getAllQuickActions() {
    if (!isInitialized) {
        console.warn('[QuickActionsManager] getAllQuickActions called before initialization, returning empty array');
        return [];
    }

    const actions = [...currentQuickActions.actions].sort((a, b) => a.order - b.order);
    console.log('[QuickActionsManager] getAllQuickActions called, returning', actions.length, 'actions:', actions);
    return actions;
}

/**
 * 获取快捷操作by ID
 */
export function getQuickActionById(id) {
    return currentQuickActions.actions.find(action => action.id === id) || null;
}

/**
 * 添加快捷操作
 */
export async function addQuickAction(actionData) {
    const newAction = {
        id: generateUniqueId(),
        name: actionData.name || '未命名操作',
        prompt: actionData.prompt || '',
        ignoreAssistant: actionData.ignoreAssistant || false,
        order: currentQuickActions.actions.length
    };
    
    currentQuickActions.actions.push(newAction);
    const success = await saveQuickActions();
    
    if (success) {
        console.log('[QuickActionsManager] Action added:', newAction.id);
        return newAction;
    }
    
    return null;
}

/**
 * 更新快捷操作
 */
export async function updateQuickAction(id, actionData) {
    const actionIndex = currentQuickActions.actions.findIndex(action => action.id === id);
    if (actionIndex === -1) {
        console.error('[QuickActionsManager] Action not found:', id);
        return false;
    }
    
    const action = currentQuickActions.actions[actionIndex];
    
    // 更新字段
    if (actionData.name !== undefined) action.name = actionData.name;
    if (actionData.prompt !== undefined) action.prompt = actionData.prompt;
    if (actionData.ignoreAssistant !== undefined) action.ignoreAssistant = actionData.ignoreAssistant;
    
    const success = await saveQuickActions();
    
    if (success) {
        console.log('[QuickActionsManager] Action updated:', id);
    }
    
    return success;
}

/**
 * 删除快捷操作
 */
export async function deleteQuickAction(id) {
    const actionIndex = currentQuickActions.actions.findIndex(action => action.id === id);
    if (actionIndex === -1) {
        console.error('[QuickActionsManager] Action not found:', id);
        return false;
    }
    

    
    currentQuickActions.actions.splice(actionIndex, 1);
    
    // 重新排序
    currentQuickActions.actions.forEach((action, index) => {
        action.order = index;
    });
    
    const success = await saveQuickActions();
    
    if (success) {
        console.log('[QuickActionsManager] Action deleted:', id);
    }
    
    return success;
}

/**
 * 更新快捷操作顺序
 */
export async function updateQuickActionsOrder(orderedIds) {
    const newActions = [];
    
    orderedIds.forEach((id, index) => {
        const action = currentQuickActions.actions.find(a => a.id === id);
        if (action) {
            action.order = index;
            newActions.push(action);
        }
    });
    
    currentQuickActions.actions = newActions;
    const success = await saveQuickActions();
    
    if (success) {
        console.log('[QuickActionsManager] Order updated');
    }
    
    return success;
}

/**
 * 导出快捷操作配置
 */
export function exportQuickActions() {
    const exportData = {
        version: currentQuickActions.version,
        exportTime: new Date().toISOString(),
        actions: currentQuickActions.actions.map(action => ({
            name: action.name,
            prompt: action.prompt,
            ignoreAssistant: action.ignoreAssistant
        }))
    };
    
    return exportData;
}

/**
 * 导入快捷操作配置
 */
export async function importQuickActions(importData, mode = 'merge') {
    try {
        if (!importData.actions || !Array.isArray(importData.actions)) {
            throw new Error('Invalid import data format');
        }

        let importedCount = 0;

        if (mode === 'replace') {
            // 替换模式：覆盖重复操作，添加新操作
            const currentActionMap = new Map(currentQuickActions.actions.map(action => [action.name, action]));
            let addedCount = 0;
            let updatedCount = 0;

            importData.actions.forEach((actionData) => {
                const existingAction = currentActionMap.get(actionData.name);
                if (existingAction) {
                    // 更新现有操作
                    existingAction.prompt = actionData.prompt || '';
                    existingAction.ignoreAssistant = actionData.ignoreAssistant || false;
                    updatedCount++;
                } else {
                    // 添加新操作
                    const newAction = {
                        id: generateUniqueId(),
                        name: actionData.name || '导入的操作',
                        prompt: actionData.prompt || '',
                        ignoreAssistant: actionData.ignoreAssistant || false,
                        order: currentQuickActions.actions.length
                    };
                    currentQuickActions.actions.push(newAction);
                    addedCount++;
                }
            });

            importedCount = addedCount + updatedCount;
        } else {
            // 合并模式：跳过重复名称的操作
            const currentActionNames = new Set(currentQuickActions.actions.map(action => action.name));
            const newActions = [];

            importData.actions.forEach((actionData) => {
                if (!currentActionNames.has(actionData.name)) {
                    const newAction = {
                        id: generateUniqueId(),
                        name: actionData.name || '导入的操作',
                        prompt: actionData.prompt || '',
                        ignoreAssistant: actionData.ignoreAssistant || false,
                        order: currentQuickActions.actions.length + newActions.length
                    };
                    newActions.push(newAction);
                }
            });

            currentQuickActions.actions.push(...newActions);
            importedCount = newActions.length;
        }

        // 重新排序
        currentQuickActions.actions.forEach((action, index) => {
            action.order = index;
        });

        const success = await saveQuickActions();

        if (success) {
            console.log('[QuickActionsManager] Import successful, imported', importedCount, 'actions');
            return importedCount;
        }

        return 0;
    } catch (error) {
        console.error('[QuickActionsManager] Import failed:', error);
        throw error;
    }
}

/**
 * 重置为默认快捷操作
 */
export async function resetToDefaultActions() {
    currentQuickActions.actions = getDefaultQuickActions();
    const success = await saveQuickActions();

    if (success) {
        console.log('[QuickActionsManager] Reset to default actions');
    }

    return success;
}

/**
 * 更新默认快捷操作的翻译
 * 当语言切换时调用此函数来更新默认快捷操作的名称和提示词
 */
export async function updateDefaultActionsTranslations() {
    if (!isInitialized) {
        console.warn('[QuickActionsManager] updateDefaultActionsTranslations called before initialization');
        return false;
    }

    const defaultActions = getDefaultQuickActions();
    let hasUpdates = false;

    // 更新现有的默认快捷操作
    currentQuickActions.actions.forEach(action => {
        const defaultAction = defaultActions.find(def => def.id === action.id);
        if (defaultAction) {
            // 只更新名称和提示词，保留用户可能修改的其他设置
            if (action.name !== defaultAction.name || action.prompt !== defaultAction.prompt) {
                action.name = defaultAction.name;
                action.prompt = defaultAction.prompt;
                hasUpdates = true;
            }
        }
    });

    if (hasUpdates) {
        const success = await saveQuickActions();
        if (success) {
            console.log('[QuickActionsManager] Default actions translations updated');
        }
        return success;
    }

    return true;
}
