/**
 * PageTalk - 统一模型管理模块
 *
 * 这个模块负责管理所有模型相关的逻辑，包括：
 * 1. 默认模型定义（包括逻辑别名模型）
 * 2. 用户自定义模型管理
 * 3. 动态模型发现
 * 4. 模型参数配置
 * 5. 存储管理
 * 6. 多供应商支持
 */

/**
 * 默认模型列表 - 插件预设的模型定义
 * 每个模型定义包含：
 * - id: 唯一标识符，用于内部跟踪和存储
 * - displayName: 显示给用户的名称
 * - apiModelName: 调用API时使用的实际模型名称
 * - providerId: 所属供应商ID
 * - params: 调用此模型时需要的特殊参数（如果为null则不附加参数）
 * - isAlias: 是否为逻辑别名模型（用于简化用户操作）
 * - isDefault: 是否为插件默认提供的模型
 * - canDelete: 是否可以被用户删除
 */
const DEFAULT_MODELS = [
    // Google Gemini 模型
    {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        apiModelName: 'gemini-2.5-flash',
        providerId: 'google',
        params: { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } },
        isAlias: true,
        isDefault: true,
        canDelete: false // 不可删除，有特殊参数配置
    },
    {
        id: 'gemini-2.5-flash-thinking',
        displayName: 'Gemini 2.5 Flash (Thinking)',
        apiModelName: 'gemini-2.5-flash',
        providerId: 'google',
        params: null, // 不设置thinkingBudget，使用默认思考模式
        isAlias: true,
        isDefault: true,
        canDelete: false // 不可删除，有特殊参数配置
    },
    {
        id: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        apiModelName: 'gemini-2.5-pro',
        providerId: 'google',
        params: null,
        isAlias: false,
        isDefault: true,
        canDelete: true // 可以删除
    },
    {
        id: 'gemini-2.5-flash-lite-preview-06-17',
        displayName: 'Gemini 2.5 Flash Lite',
        apiModelName: 'gemini-2.5-flash-lite-preview-06-17',
        providerId: 'google',
        params: null,
        isAlias: false,
        isDefault: true,
        canDelete: true // 可以删除
    }
];

/**
 * 存储键名常量
 */
const STORAGE_KEYS = {
    MANAGED_MODELS: 'managedModels',        // 主模型列表
    USER_ACTIVE_MODELS: 'userActiveModels', // 用户已选模型列表
    PROVIDER_SETTINGS: 'providerSettings',  // 供应商设置（API Keys等）
    MODEL_MANAGER_VERSION: 'modelManagerVersion', // 版本号，用于数据迁移
    // 旧版本兼容性键名
    OLD_API_KEY: 'apiKey',                  // 旧版本的单一API Key
    OLD_SELECTED_MODELS: 'selectedModels'   // 旧版本的选中模型列表
};

/**
 * 当前版本号 - 用于数据迁移
 */
const CURRENT_VERSION = '2.0.0'; // 升级到2.0.0以支持多供应商

/**
 * 模型管理器类
 */
class ModelManager {
    constructor() {
        this.managedModels = [];
        this.userActiveModels = [];
        this.providerSettings = {}; // 存储各供应商的设置（API Keys等）
        this.initialized = false;
    }

    /**
     * 初始化模型管理器
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.loadFromStorage();
            await this.migrateIfNeeded();
            this.initialized = true;
            console.log('[ModelManager] Initialized successfully');
        } catch (error) {
            console.error('[ModelManager] Initialization failed:', error);
            // 初始化失败时使用默认设置
            await this.resetToDefaults();
        }
    }

    /**
     * 从存储加载数据
     */
    async loadFromStorage() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([
                STORAGE_KEYS.MANAGED_MODELS,
                STORAGE_KEYS.USER_ACTIVE_MODELS,
                STORAGE_KEYS.PROVIDER_SETTINGS,
                STORAGE_KEYS.MODEL_MANAGER_VERSION,
                // 旧版本兼容性
                STORAGE_KEYS.OLD_API_KEY,
                STORAGE_KEYS.OLD_SELECTED_MODELS
            ], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[ModelManager] Storage load error:', chrome.runtime.lastError);
                    resolve();
                    return;
                }

                // 加载供应商设置
                if (result[STORAGE_KEYS.PROVIDER_SETTINGS]) {
                    this.providerSettings = result[STORAGE_KEYS.PROVIDER_SETTINGS];
                } else {
                    this.providerSettings = {};
                }

                // 加载主模型列表
                if (result[STORAGE_KEYS.MANAGED_MODELS]) {
                    this.managedModels = result[STORAGE_KEYS.MANAGED_MODELS];
                    // 为旧数据添加缺失的属性
                    this.managedModels = this.managedModels.map(model => {
                        // 添加 providerId（如果缺失）
                        if (!model.providerId) {
                            // 旧模型默认为 Google
                            model.providerId = 'google';
                        }

                        // 添加 canDelete 属性（如果缺失）
                        if (model.canDelete === undefined) {
                            const defaultModel = DEFAULT_MODELS.find(dm => dm.id === model.id);
                            if (defaultModel) {
                                model.canDelete = defaultModel.canDelete;
                            } else {
                                model.canDelete = true;
                            }
                        }
                        return model;
                    });
                } else {
                    // 首次使用，初始化为默认模型
                    this.managedModels = [...DEFAULT_MODELS];
                }

                // 加载用户已选模型列表
                if (result[STORAGE_KEYS.USER_ACTIVE_MODELS]) {
                    this.userActiveModels = result[STORAGE_KEYS.USER_ACTIVE_MODELS];
                } else {
                    // 首次使用，默认选择所有默认模型
                    this.userActiveModels = DEFAULT_MODELS.map(model => model.id);
                }

                console.log('[ModelManager] Loaded from storage:', {
                    managedModels: this.managedModels.length,
                    userActiveModels: this.userActiveModels.length,
                    providerSettings: Object.keys(this.providerSettings).length
                });

                resolve();
            });
        });
    }

    /**
     * 保存到存储
     */
    async saveToStorage() {
        return new Promise((resolve) => {
            const data = {
                [STORAGE_KEYS.MANAGED_MODELS]: this.managedModels,
                [STORAGE_KEYS.USER_ACTIVE_MODELS]: this.userActiveModels,
                [STORAGE_KEYS.PROVIDER_SETTINGS]: this.providerSettings,
                [STORAGE_KEYS.MODEL_MANAGER_VERSION]: CURRENT_VERSION
            };

            chrome.storage.sync.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('[ModelManager] Storage save error:', chrome.runtime.lastError);
                } else {
                    console.log('[ModelManager] Saved to storage successfully');
                    // 广播模型更新事件
                    this.broadcastModelsUpdated();
                }
                resolve();
            });
        });
    }

    /**
     * 广播模型更新事件到所有标签页
     */
    broadcastModelsUpdated() {
        try {
            // 通过background.js广播到所有标签页
            chrome.runtime.sendMessage({
                action: 'broadcastModelsUpdated'
            }, (response) => {
                // 检查运行时是否仍然有效
                if (chrome.runtime.lastError) {
                    // 如果是消息通道关闭错误，不记录为错误，这是正常的
                    if (chrome.runtime.lastError.message.includes('message channel closed') ||
                        chrome.runtime.lastError.message.includes('receiving end does not exist')) {
                        console.log('[ModelManager] Message channel closed during broadcast (normal during extension reload)');
                    } else {
                        console.warn('[ModelManager] Broadcast message error:', chrome.runtime.lastError.message);
                    }
                } else if (response) {
                    console.log('[ModelManager] Models updated broadcast sent successfully');
                }
            });
        } catch (error) {
            console.warn('[ModelManager] Chrome runtime not available:', error);
        }
    }

    /**
     * 数据迁移（如果需要）
     */
    async migrateIfNeeded() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([
                STORAGE_KEYS.MODEL_MANAGER_VERSION,
                STORAGE_KEYS.OLD_API_KEY,
                STORAGE_KEYS.OLD_SELECTED_MODELS
            ], async (result) => {
                const currentVersion = result[STORAGE_KEYS.MODEL_MANAGER_VERSION];

                // 如果没有版本号或版本号低于2.0.0，执行迁移
                if (!currentVersion || this.compareVersions(currentVersion, '2.0.0') < 0) {
                    console.log('[ModelManager] Starting migration from version', currentVersion || 'unknown', 'to', CURRENT_VERSION);

                    // 迁移旧的API Key到新的供应商设置结构
                    if (result[STORAGE_KEYS.OLD_API_KEY]) {
                        if (!this.providerSettings.google) {
                            this.providerSettings.google = {};
                        }
                        this.providerSettings.google.apiKey = result[STORAGE_KEYS.OLD_API_KEY];
                        console.log('[ModelManager] Migrated API key to Google provider settings');
                    }

                    // 迁移旧的选中模型列表
                    if (result[STORAGE_KEYS.OLD_SELECTED_MODELS] && this.userActiveModels.length === 0) {
                        this.userActiveModels = result[STORAGE_KEYS.OLD_SELECTED_MODELS];
                        console.log('[ModelManager] Migrated selected models list');
                    }

                    // 确保所有管理的模型都有providerId
                    this.managedModels = this.managedModels.map(model => {
                        if (!model.providerId) {
                            model.providerId = 'google'; // 旧模型默认为Google
                        }
                        return model;
                    });

                    // 保存迁移后的数据
                    await this.saveToStorage();

                    // 清理旧的存储键
                    chrome.storage.sync.remove([
                        STORAGE_KEYS.OLD_API_KEY,
                        STORAGE_KEYS.OLD_SELECTED_MODELS
                    ], () => {
                        console.log('[ModelManager] Migration completed and old keys cleaned up');
                        resolve();
                    });
                } else {
                    console.log('[ModelManager] No migration needed, current version:', currentVersion);
                    resolve();
                }
            });
        });
    }

    /**
     * 比较版本号
     * @param {string} version1
     * @param {string} version2
     * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
     */
    compareVersions(version1, version2) {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);

        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;

            if (v1part < v2part) return -1;
            if (v1part > v2part) return 1;
        }
        return 0;
    }

    /**
     * 重置为默认设置
     */
    async resetToDefaults() {
        this.managedModels = [...DEFAULT_MODELS];
        this.userActiveModels = DEFAULT_MODELS.map(model => model.id);
        await this.saveToStorage();
        this.initialized = true;
        console.log('[ModelManager] Reset to defaults');
    }

    /**
     * 获取用户当前可用的模型列表（用于UI显示）
     * @returns {Array} 模型定义对象数组
     */
    getUserActiveModels() {
        if (!this.initialized) {
            console.warn('[ModelManager] Not initialized, returning empty array');
            return [];
        }

        const activeModels = this.userActiveModels
            .map(modelId => this.managedModels.find(model => model.id === modelId))
            .filter(model => model !== undefined);

        // 按模型ID进行字母排序
        return activeModels.sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * 获取所有管理的模型列表
     * @returns {Array} 所有模型定义对象数组
     */
    getAllManagedModels() {
        // 按模型ID进行字母排序
        return [...this.managedModels].sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * 根据模型ID获取模型定义
     * @param {string} modelId - 模型ID
     * @returns {Object|null} 模型定义对象或null
     */
    getModelById(modelId) {
        return this.managedModels.find(model => model.id === modelId) || null;
    }

    /**
     * 获取模型的API调用配置
     * @param {string} modelId - 模型ID
     * @returns {Object} API调用配置 { apiModelName, params, providerId }
     */
    getModelApiConfig(modelId) {
        const model = this.getModelById(modelId);
        if (!model) {
            console.warn(`[ModelManager] Model not found: ${modelId}, using fallback`);
            return {
                apiModelName: modelId, // 回退到使用原始ID
                params: null,
                providerId: 'google' // 默认供应商
            };
        }

        return {
            apiModelName: model.apiModelName,
            params: model.params,
            providerId: model.providerId
        };
    }

    // === 供应商设置管理方法 ===

    /**
     * 获取指定供应商的设置
     * @param {string} providerId - 供应商ID
     * @returns {Object} 供应商设置对象
     */
    getProviderSettings(providerId) {
        return this.providerSettings[providerId] || {};
    }

    /**
     * 设置指定供应商的配置
     * @param {string} providerId - 供应商ID
     * @param {Object} settings - 设置对象
     */
    async setProviderSettings(providerId, settings) {
        if (!this.providerSettings[providerId]) {
            this.providerSettings[providerId] = {};
        }

        // 合并设置
        this.providerSettings[providerId] = {
            ...this.providerSettings[providerId],
            ...settings
        };

        await this.saveToStorage();
        console.log(`[ModelManager] Updated settings for provider: ${providerId}`);
    }

    /**
     * 获取指定供应商的API Key
     * @param {string} providerId - 供应商ID
     * @returns {string|null} API Key或null
     */
    getProviderApiKey(providerId) {
        const settings = this.getProviderSettings(providerId);
        return settings.apiKey || null;
    }

    /**
     * 设置指定供应商的API Key
     * @param {string} providerId - 供应商ID
     * @param {string} apiKey - API Key
     */
    async setProviderApiKey(providerId, apiKey) {
        await this.setProviderSettings(providerId, { apiKey });
    }

    /**
     * 获取指定供应商的API Host（如果有自定义的话）
     * @param {string} providerId - 供应商ID
     * @returns {string|null} 自定义API Host或null
     */
    getProviderApiHost(providerId) {
        const settings = this.getProviderSettings(providerId);
        return settings.apiHost || null;
    }

    /**
     * 设置指定供应商的API Host
     * @param {string} providerId - 供应商ID
     * @param {string} apiHost - API Host
     */
    async setProviderApiHost(providerId, apiHost) {
        await this.setProviderSettings(providerId, { apiHost });
    }

    /**
     * 添加新模型到管理列表
     * @param {Object} modelDefinition - 模型定义对象
     * @returns {boolean} 是否添加成功
     */
    async addModel(modelDefinition) {
        if (!modelDefinition.id || !modelDefinition.displayName || !modelDefinition.apiModelName || !modelDefinition.providerId) {
            console.error('[ModelManager] Invalid model definition (missing required fields):', modelDefinition);
            return false;
        }

        // 检查是否已存在
        if (this.managedModels.find(model => model.id === modelDefinition.id)) {
            console.warn(`[ModelManager] Model already exists: ${modelDefinition.id}`);
            return false;
        }

        // 添加到管理列表
        this.managedModels.push({
            ...modelDefinition,
            isDefault: false, // 用户添加的模型标记为非默认
            canDelete: true // 用户添加的模型默认可删除
        });

        await this.saveToStorage();
        console.log(`[ModelManager] Added new model: ${modelDefinition.id} (provider: ${modelDefinition.providerId})`);
        return true;
    }

    /**
     * 从管理列表中移除模型（仅从激活列表中移除，不从管理列表中删除）
     * @param {string} modelId - 模型ID
     * @returns {boolean} 是否移除成功
     */
    async removeModel(modelId) {
        const model = this.managedModels.find(model => model.id === modelId);
        if (!model) {
            console.warn(`[ModelManager] Model not found for removal: ${modelId}`);
            return false;
        }

        // 检查是否可以删除（基于canDelete属性）
        if (model.canDelete === false) {
            console.warn(`[ModelManager] Cannot remove protected model: ${modelId}`);
            return false;
        }

        // 只从用户已选列表中移除，不从管理列表中删除
        // 这样模型仍然可以在下次发现时重新出现
        const activeIndex = this.userActiveModels.indexOf(modelId);
        if (activeIndex !== -1) {
            this.userActiveModels.splice(activeIndex, 1);
        }

        await this.saveToStorage();
        console.log(`[ModelManager] Deactivated model: ${modelId}`);
        return true;
    }

    /**
     * 完全删除模型（从管理列表中删除，仅用于用户添加的模型）
     * @param {string} modelId - 模型ID
     * @returns {boolean} 是否删除成功
     */
    async deleteModel(modelId) {
        const modelIndex = this.managedModels.findIndex(model => model.id === modelId);
        if (modelIndex === -1) {
            console.warn(`[ModelManager] Model not found for deletion: ${modelId}`);
            return false;
        }

        const model = this.managedModels[modelIndex];

        // 只有用户添加的模型才能被完全删除
        if (model.isDefault) {
            console.warn(`[ModelManager] Cannot delete default model: ${modelId}`);
            return false;
        }

        // 从管理列表中移除
        this.managedModels.splice(modelIndex, 1);

        // 从用户已选列表中移除
        const activeIndex = this.userActiveModels.indexOf(modelId);
        if (activeIndex !== -1) {
            this.userActiveModels.splice(activeIndex, 1);
        }

        await this.saveToStorage();
        console.log(`[ModelManager] Completely deleted model: ${modelId}`);
        return true;
    }

    /**
     * 更新用户已选模型列表
     * @param {Array<string>} modelIds - 模型ID数组
     */
    async updateUserActiveModels(modelIds) {
        // 验证所有模型ID都存在于管理列表中
        const validModelIds = modelIds.filter(id =>
            this.managedModels.find(model => model.id === id)
        );

        if (validModelIds.length !== modelIds.length) {
            console.warn('[ModelManager] Some model IDs are invalid:',
                modelIds.filter(id => !validModelIds.includes(id))
            );
        }

        this.userActiveModels = validModelIds;
        await this.saveToStorage();
        console.log('[ModelManager] Updated user active models:', validModelIds);
    }

    /**
     * 检查模型是否在用户已选列表中
     * @param {string} modelId - 模型ID
     * @returns {boolean}
     */
    isModelActive(modelId) {
        return this.userActiveModels.includes(modelId);
    }

    /**
     * 添加模型到用户已选列表
     * @param {string} modelId - 模型ID
     */
    async activateModel(modelId) {
        if (!this.getModelById(modelId)) {
            console.warn(`[ModelManager] Cannot activate non-existent model: ${modelId}`);
            return false;
        }

        if (!this.userActiveModels.includes(modelId)) {
            this.userActiveModels.push(modelId);
            await this.saveToStorage();
            console.log(`[ModelManager] Activated model: ${modelId}`);
        }
        return true;
    }

    /**
     * 从用户已选列表中移除模型
     * @param {string} modelId - 模型ID
     */
    async deactivateModel(modelId) {
        const index = this.userActiveModels.indexOf(modelId);
        if (index !== -1) {
            this.userActiveModels.splice(index, 1);
            await this.saveToStorage();
            console.log(`[ModelManager] Deactivated model: ${modelId}`);
        }
        return true;
    }

    /**
     * 从Google API动态获取可用模型列表
     * @param {string} apiKey - API密钥
     * @returns {Promise<Array>} 模型列表
     */
    async fetchAvailableModels(apiKey) {
        if (!apiKey) {
            throw new Error('API Key is required');
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // 过滤出生成模型（支持generateContent的模型）
            const generativeModels = data.models?.filter(model =>
                model.supportedGenerationMethods?.includes('generateContent')
            ) || [];

            // 转换为我们的模型定义格式
            const discoveredModels = generativeModels.map(model => {
                const modelName = model.name.replace('models/', '');
                return {
                    id: modelName,
                    displayName: model.displayName || modelName,
                    apiModelName: modelName,
                    params: null,
                    isAlias: false,
                    isDefault: false,
                    canDelete: true, // API发现的模型默认可删除
                    description: model.description || '',
                    inputTokenLimit: model.inputTokenLimit || null,
                    outputTokenLimit: model.outputTokenLimit || null,
                    supportedGenerationMethods: model.supportedGenerationMethods || []
                };
            });

            console.log(`[ModelManager] Discovered ${discoveredModels.length} models from API`);
            return discoveredModels;

        } catch (error) {
            console.error('[ModelManager] Failed to fetch models from API:', error);
            throw error;
        }
    }

    /**
     * 批量添加发现的模型到管理列表
     * @param {Array} discoveredModels - 发现的模型列表
     * @param {Array<string>} selectedModelIds - 用户选择要添加的模型ID
     * @returns {Promise<{added: number, activated: number, skipped: number}>}
     */
    async addDiscoveredModels(discoveredModels, selectedModelIds) {
        let added = 0;
        let activated = 0;
        let skipped = 0;

        for (const modelId of selectedModelIds) {
            // 首先检查是否是已存在但未激活的模型
            const existingModel = this.managedModels.find(model => model.id === modelId);
            if (existingModel) {
                // 模型已存在，只需激活
                if (!this.userActiveModels.includes(modelId)) {
                    await this.activateModel(modelId);
                    activated++;
                    console.log(`[ModelManager] Reactivated existing model: ${modelId}`);
                } else {
                    skipped++;
                    console.log(`[ModelManager] Model already active: ${modelId}`);
                }
                continue;
            }

            // 查找新发现的模型
            const discoveredModel = discoveredModels.find(model => model.id === modelId);
            if (!discoveredModel) {
                console.warn(`[ModelManager] Discovered model not found: ${modelId}`);
                skipped++;
                continue;
            }

            // 添加新模型
            const success = await this.addModel(discoveredModel);
            if (success) {
                // 自动激活新添加的模型
                await this.activateModel(modelId);
                added++;
            } else {
                skipped++;
            }
        }

        console.log(`[ModelManager] Added ${added} new models, activated ${activated} existing models, skipped ${skipped} models`);
        return { added, activated, skipped };
    }

    /**
     * 获取可以添加的发现模型（包括被停用的模型）
     * @param {Array} discoveredModels - 从API发现的模型列表
     * @param {string} providerId - 供应商ID，用于过滤相关模型
     * @returns {Array} 可添加的模型列表
     */
    getNewDiscoveredModels(discoveredModels, providerId = null) {
        const activeModelIds = new Set(this.userActiveModels);
        const managedModelIds = new Set(this.managedModels.map(model => model.id));

        // 首先恢复缺失的默认模型（只包括指定供应商的模型）
        const missingDefaultModels = this.getMissingDefaultModels();
        const relevantMissingModels = providerId
            ? missingDefaultModels.filter(model => model.providerId === providerId)
            : missingDefaultModels;
        const availableModels = [...relevantMissingModels];

        // 添加已管理但未激活的模型（被用户移除但仍在管理列表中的模型）
        // 只包括指定供应商的模型
        const inactiveModels = this.managedModels.filter(model =>
            !activeModelIds.has(model.id) &&
            !relevantMissingModels.some(dm => dm.id === model.id) &&
            (!providerId || model.providerId === providerId)
        );
        availableModels.push(...inactiveModels);

        // 然后添加所有从API发现但不在管理列表中的新模型
        const newDiscoveredModels = discoveredModels.filter(model => {
            // 过滤掉已经在管理列表中的模型
            if (managedModelIds.has(model.id)) {
                return false;
            }

            // 过滤掉已经在缺失默认模型列表中的模型
            if (relevantMissingModels.some(defaultModel => defaultModel.id === model.id)) {
                return false;
            }

            return true;
        });

        availableModels.push(...newDiscoveredModels);

        // 按模型ID进行字母排序
        availableModels.sort((a, b) => a.id.localeCompare(b.id));

        console.log(`[ModelManager] Found ${availableModels.length} models available for addition for provider ${providerId || 'all'}:`,
            availableModels.map(m => `${m.id} (${managedModelIds.has(m.id) ? 'inactive' : 'new'})`));

        return availableModels;
    }

    /**
     * 获取缺失的默认模型
     * @returns {Array} 缺失的默认模型列表
     */
    getMissingDefaultModels() {
        const existingModelIds = new Set(this.managedModels.map(model => model.id));
        return DEFAULT_MODELS.filter(defaultModel => !existingModelIds.has(defaultModel.id));
    }

    /**
     * 生成用于UI显示的模型选项
     * @param {boolean} includeInactive - 是否包含未激活的模型
     * @returns {Array} 格式化的选项数组 [{value, text, disabled}]
     */
    getModelOptionsForUI(includeInactive = false) {
        const models = includeInactive ? this.managedModels : this.getUserActiveModels();

        // 按模型ID进行字母排序
        const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id));

        return sortedModels.map(model => ({
            value: model.id,
            text: model.displayName,
            disabled: includeInactive ? !this.isModelActive(model.id) : false,
            isAlias: model.isAlias,
            isDefault: model.isDefault,
            canDelete: model.canDelete !== false // 默认可删除，除非明确设置为false
        }));
    }

    /**
     * 验证模型配置的完整性
     * @returns {Object} 验证结果
     */
    validateConfiguration() {
        const issues = [];

        // 检查是否有激活的模型
        if (this.userActiveModels.length === 0) {
            issues.push('No active models configured');
        }

        // 检查激活的模型是否都存在于管理列表中
        const missingModels = this.userActiveModels.filter(id =>
            !this.managedModels.find(model => model.id === id)
        );
        if (missingModels.length > 0) {
            issues.push(`Active models not found in managed list: ${missingModels.join(', ')}`);
        }

        // 检查管理列表中的模型定义是否完整
        const incompleteModels = this.managedModels.filter(model =>
            !model.id || !model.displayName || !model.apiModelName
        );
        if (incompleteModels.length > 0) {
            issues.push(`Incomplete model definitions found: ${incompleteModels.length} models`);
        }

        return {
            isValid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        const defaultModels = this.managedModels.filter(model => model.isDefault);
        const userModels = this.managedModels.filter(model => !model.isDefault);
        const aliasModels = this.managedModels.filter(model => model.isAlias);

        // 按供应商统计
        const providerStats = {};
        this.managedModels.forEach(model => {
            const providerId = model.providerId || 'unknown';
            if (!providerStats[providerId]) {
                providerStats[providerId] = { total: 0, active: 0 };
            }
            providerStats[providerId].total++;
            if (this.userActiveModels.includes(model.id)) {
                providerStats[providerId].active++;
            }
        });

        return {
            totalManaged: this.managedModels.length,
            totalActive: this.userActiveModels.length,
            defaultModels: defaultModels.length,
            userAddedModels: userModels.length,
            aliasModels: aliasModels.length,
            providerStats: providerStats
        };
    }

    // === 多供应商支持方法 ===

    /**
     * 根据供应商ID获取模型列表
     * @param {string} providerId - 供应商ID
     * @param {boolean} activeOnly - 是否只返回激活的模型
     * @returns {Array} 模型列表
     */
    getModelsByProvider(providerId, activeOnly = false) {
        let models = this.managedModels.filter(model => model.providerId === providerId);

        if (activeOnly) {
            models = models.filter(model => this.userActiveModels.includes(model.id));
        }

        return models.sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * 获取所有已配置的供应商ID列表
     * @returns {Array<string>} 供应商ID数组
     */
    getConfiguredProviders() {
        const providerIds = new Set();
        this.managedModels.forEach(model => {
            if (model.providerId) {
                providerIds.add(model.providerId);
            }
        });
        return Array.from(providerIds).sort();
    }

    /**
     * 检查指定供应商是否有可用的模型
     * @param {string} providerId - 供应商ID
     * @returns {boolean} 是否有可用模型
     */
    hasActiveModelsForProvider(providerId) {
        return this.getModelsByProvider(providerId, true).length > 0;
    }

    /**
     * 检查指定供应商是否已配置API Key
     * @param {string} providerId - 供应商ID
     * @returns {boolean} 是否已配置
     */
    isProviderConfigured(providerId) {
        const apiKey = this.getProviderApiKey(providerId);
        return !!(apiKey && apiKey.trim());
    }

    /**
     * 获取需要配置的供应商列表（有模型但没有API Key的供应商）
     * @returns {Array<string>} 需要配置的供应商ID数组
     */
    getProvidersNeedingConfiguration() {
        const configuredProviders = this.getConfiguredProviders();
        return configuredProviders.filter(providerId => !this.isProviderConfigured(providerId));
    }
}

// 创建全局实例
const modelManager = new ModelManager();

// 导出到全局作用域
window.ModelManager = {
    instance: modelManager,
    DEFAULT_MODELS,
    STORAGE_KEYS
};
