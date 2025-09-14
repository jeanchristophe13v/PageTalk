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
        displayName: 'gemini-2.5-flash',
        apiModelName: 'gemini-2.5-flash',
        providerId: 'google',
        params: { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } },
        isAlias: true,
        isDefault: true,
        canDelete: false // 不可删除，有特殊参数配置
    },
    {
        id: 'gemini-2.5-flash-thinking',
        displayName: 'gemini-2.5-flash-thinking',
        apiModelName: 'gemini-2.5-flash',
        providerId: 'google',
        params: null, // 不设置thinkingBudget，使用默认思考模式
        isAlias: true,
        isDefault: true,
        canDelete: false // 不可删除，有特殊参数配置
    },
    {
        id: 'gemini-2.5-pro',
        displayName: 'gemini-2.5-pro',
        apiModelName: 'gemini-2.5-pro',
        providerId: 'google',
        params: null,
        isAlias: false,
        isDefault: true,
        canDelete: true // 可以删除
    },
    {
        id: 'gemini-2.5-flash-lite',
        displayName: 'gemini-2.5-flash-lite',
        apiModelName: 'gemini-2.5-flash-lite',
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
const CURRENT_VERSION = '2.1.0'; // 2.1.0: 复合键(providerId::modelId)支持，修复跨供应商同名模型冲突

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

    // === 复合键工具 ===
    buildKey(providerId, modelId) {
        return `${providerId}::${modelId}`;
    }

    parseKey(keyOrId) {
        if (typeof keyOrId !== 'string') return { providerId: null, modelId: '', isComposite: false };
        const idx = keyOrId.indexOf('::');
        if (idx > 0) {
            return {
                providerId: keyOrId.slice(0, idx),
                modelId: keyOrId.slice(idx + 2),
                isComposite: true
            };
        }
        return { providerId: null, modelId: keyOrId, isComposite: false };
    }

    /**
     * 初始化模型管理器
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.loadFromStorage();
            await this.migrateIfNeeded();
            // 额外的健全性检查：清理因删除供应商而遗留的“孤儿”模型
            // 这一步不依赖 ProviderManager 是否已加载自定义提供商，因为会直接读取存储
            await this.cleanupOrphanedModels();
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
            // 同步读取 sync 与 local，优先使用 local（更大容量，避免 sync 配额影响）
            chrome.storage.sync.get([
                STORAGE_KEYS.MANAGED_MODELS,
                STORAGE_KEYS.USER_ACTIVE_MODELS,
                STORAGE_KEYS.PROVIDER_SETTINGS,
                STORAGE_KEYS.MODEL_MANAGER_VERSION,
                // 旧版本兼容性
                STORAGE_KEYS.OLD_API_KEY,
                STORAGE_KEYS.OLD_SELECTED_MODELS
            ], (syncResult) => {
                if (chrome.runtime.lastError) {
                    console.error('[ModelManager] Storage (sync) load error:', chrome.runtime.lastError);
                }
                chrome.storage.local.get([
                    STORAGE_KEYS.MANAGED_MODELS,
                    STORAGE_KEYS.USER_ACTIVE_MODELS
                ], (localResult) => {
                    if (chrome.runtime.lastError) {
                        console.error('[ModelManager] Storage (local) load error:', chrome.runtime.lastError);
                    }

                    const result = syncResult || {};

                    // 加载供应商设置（仅从 sync）
                    if (result[STORAGE_KEYS.PROVIDER_SETTINGS]) {
                        this.providerSettings = result[STORAGE_KEYS.PROVIDER_SETTINGS];
                    } else {
                        this.providerSettings = {};
                    }

                    // 加载主模型列表：优先 local
                    const managedFromLocal = localResult?.[STORAGE_KEYS.MANAGED_MODELS];
                    const managedFromSync = result?.[STORAGE_KEYS.MANAGED_MODELS];
                    if (Array.isArray(managedFromLocal) && managedFromLocal.length > 0) {
                        this.managedModels = managedFromLocal;
                    } else if (Array.isArray(managedFromSync)) {
                        this.managedModels = managedFromSync;
                    } else {
                        // 首次使用，根据API key配置情况初始化默认模型
                        this.managedModels = this.getInitialDefaultModels();
                    }

                    // 为旧数据添加缺失的属性
                    this.managedModels = (this.managedModels || []).map(model => {
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

                    // 加载用户已选模型列表（向后兼容：将旧的纯ID迁移为复合键）——优先 local
                    const activeFromLocal = localResult?.[STORAGE_KEYS.USER_ACTIVE_MODELS];
                    const activeFromSync = result?.[STORAGE_KEYS.USER_ACTIVE_MODELS];
                    if (Array.isArray(activeFromLocal) && activeFromLocal.length > 0) {
                        this.userActiveModels = activeFromLocal;
                    } else if (Array.isArray(activeFromSync) && activeFromSync.some(v => typeof v === 'string' && v.includes('::'))) {
                        this.userActiveModels = activeFromSync;
                    } else if (Array.isArray(activeFromSync)) {
                        this.userActiveModels = activeFromSync.map(id => {
                            const model = this.managedModels.find(m => m.id === id);
                            return model ? this.buildKey(model.providerId, model.id) : id;
                        });
                    } else {
                        // 首次使用，默认选择已添加的管理模型
                        this.userActiveModels = this.managedModels.map(model => this.buildKey(model.providerId, model.id));
                    }

                    console.log('[ModelManager] Loaded from storage:', {
                        managedModels: this.managedModels.length,
                        userActiveModels: this.userActiveModels.length,
                        providerSettings: Object.keys(this.providerSettings).length
                    });

                    resolve();
                });
            });
        });
    }

    /**
     * 保存到存储
     */
    async saveToStorage() {
        return new Promise((resolve) => {
            // 为了避免超过 chrome.storage.sync 的单项大小限制，保存前对模型做瘦身
            const compactModel = (m) => {
                const compact = {
                    id: m.id,
                    displayName: m.displayName,
                    apiModelName: m.apiModelName,
                    providerId: m.providerId,
                    params: m.params || null,
                    isAlias: !!m.isAlias,
                    isDefault: !!m.isDefault,
                    // 默认可删除，除非明确标记为 false
                    canDelete: m.canDelete === false ? false : true
                };
                if (m.source) compact.source = m.source;
                return compact;
            };

            const managedModelsToSave = Array.isArray(this.managedModels)
                ? this.managedModels.map(compactModel)
                : [];

            const userActiveModelsToSave = Array.isArray(this.userActiveModels)
                ? this.userActiveModels
                : [];

            const data = {
                [STORAGE_KEYS.MANAGED_MODELS]: managedModelsToSave,
                [STORAGE_KEYS.USER_ACTIVE_MODELS]: userActiveModelsToSave,
                [STORAGE_KEYS.PROVIDER_SETTINGS]: this.providerSettings,
                [STORAGE_KEYS.MODEL_MANAGER_VERSION]: CURRENT_VERSION
            };

            // 先写入 local 作为可靠后备，避免 sync 配额导致的数据丢失
            try {
                chrome.storage.local.set({
                    [STORAGE_KEYS.MANAGED_MODELS]: managedModelsToSave,
                    [STORAGE_KEYS.USER_ACTIVE_MODELS]: userActiveModelsToSave
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[ModelManager] Local storage save warning:', chrome.runtime.lastError);
                    } else {
                        console.log('[ModelManager] Saved to local storage successfully');
                    }
                });
            } catch (e) {
                console.warn('[ModelManager] Local storage save threw:', e);
            }

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
     * 仅保存供应商设置到存储（避免在未完全加载时覆盖模型列表）
     */
    async saveProviderSettingsOnly() {
        return new Promise((resolve) => {
            const data = {
                [STORAGE_KEYS.PROVIDER_SETTINGS]: this.providerSettings,
                [STORAGE_KEYS.MODEL_MANAGER_VERSION]: CURRENT_VERSION
            };
            chrome.storage.sync.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('[ModelManager] Storage save (provider settings) error:', chrome.runtime.lastError);
                } else {
                    console.log('[ModelManager] Provider settings saved to storage successfully');
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
     * 获取初始默认模型列表（根据API key配置情况）
     * @returns {Array} 初始默认模型列表
     */
    getInitialDefaultModels() {
        const initialModels = [];

        // 检查是否配置了Google API key
        const hasGoogleApiKey = this.checkGoogleApiKeyConfigured();

        if (hasGoogleApiKey) {
            // 如果配置了Google API key，添加Google的默认模型
            const googleModels = DEFAULT_MODELS.filter(model => model.providerId === 'google');
            initialModels.push(...googleModels);
            console.log('[ModelManager] Google API key found, adding Google default models');
        } else {
            console.log('[ModelManager] No Google API key found, skipping Google default models');
        }

        // 这里可以添加其他供应商的默认模型检查逻辑
        // 例如：如果配置了OpenAI API key，添加OpenAI的默认模型等

        return initialModels;
    }

    /**
     * 检查Google API key是否已配置
     * @returns {boolean} 是否已配置Google API key
     */
    checkGoogleApiKeyConfigured() {
        // 首先检查新的供应商设置结构
        if (this.providerSettings && this.providerSettings.google && this.providerSettings.google.apiKey) {
            const googleApiKey = this.providerSettings.google.apiKey;
            if (googleApiKey && googleApiKey.trim()) {
                return true;
            }
        }

        // 如果新结构中没有，检查旧版本的API key（同步方式）
        try {
            // 这里我们需要同步检查，但chrome.storage是异步的
            // 我们将在migrateIfNeeded中处理旧版本API key的迁移
            // 所以这里只检查已经迁移到新结构的API key
            return false;
        } catch (error) {
            console.warn('[ModelManager] Error checking legacy API key:', error);
            return false;
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

                        // 如果之前没有管理的模型，现在有了Google API key，添加Google默认模型
                        if (this.managedModels.length === 0) {
                            const googleModels = DEFAULT_MODELS.filter(model => model.providerId === 'google');
                            this.managedModels.push(...googleModels);
                            this.userActiveModels.push(...googleModels.map(model => this.buildKey(model.providerId, model.id)));
                            console.log('[ModelManager] Added Google default models after API key migration');
                        }
                    }

                    // 迁移旧的选中模型列表
                    if (result[STORAGE_KEYS.OLD_SELECTED_MODELS] && this.userActiveModels.length === 0) {
                        // 旧格式为纯ID，这里迁移为复合键
                        this.userActiveModels = result[STORAGE_KEYS.OLD_SELECTED_MODELS].map(id => {
                            const m = this.managedModels.find(mm => mm.id === id);
                            return m ? this.buildKey(m.providerId, m.id) : id;
                        });
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
        // 根据API key配置情况重置默认模型
        this.managedModels = this.getInitialDefaultModels();
        // 使用复合键，避免跨供应商同名模型冲突
        this.userActiveModels = this.managedModels.map(model => this.buildKey(model.providerId, model.id));
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
            .map(key => {
                const { providerId, modelId, isComposite } = this.parseKey(key);
                if (isComposite) {
                    return this.managedModels.find(m => m.id === modelId && m.providerId === providerId);
                }
                return this.managedModels.find(m => m.id === modelId);
            })
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
     * 根据复合键获取模型定义
     * @param {string} keyOrId - providerId::modelId 或 旧的纯 id
     * @returns {Object|null}
     */
    getModelByKey(keyOrId) {
        const { providerId, modelId, isComposite } = this.parseKey(keyOrId);
        if (isComposite) {
            return this.managedModels.find(m => m.id === modelId && m.providerId === providerId) || null;
        }
        return this.getModelById(modelId);
    }

    /**
     * 获取模型的API调用配置
     * @param {string} modelId - 模型ID
     * @returns {Object} API调用配置 { apiModelName, params, providerId }
     */
    getModelApiConfig(modelId) {
        const composite = this.getModelByKey(modelId);
        const model = composite || this.getModelById(modelId);
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
        // 确保在写入前已加载现有数据，避免覆盖
        if (!this.initialized) {
            try {
                await this.loadFromStorage();
            } catch (e) {
                console.warn('[ModelManager] Failed to pre-load storage before saving provider settings:', e);
            }
        }
        if (!this.providerSettings[providerId]) {
            this.providerSettings[providerId] = {};
        }

        // 合并设置
        this.providerSettings[providerId] = {
            ...this.providerSettings[providerId],
            ...settings
        };

        // 只保存供应商设置，避免在尚未初始化时将空的模型列表写回存储
        await this.saveProviderSettingsOnly();
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

        // 如果是Google供应商且之前没有Google模型，添加默认模型
        if (providerId === 'google' && apiKey && apiKey.trim()) {
            await this.ensureGoogleDefaultModels();
        }
    }

    /**
     * 确保Google默认模型存在（当配置了Google API key时）
     */
    async ensureGoogleDefaultModels() {
        const googleModels = DEFAULT_MODELS.filter(model => model.providerId === 'google');
        let hasChanges = false;

        for (const defaultModel of googleModels) {
            // 检查是否已存在于管理列表中（按复合键）
            if (!this.managedModels.find(model => model.id === defaultModel.id && model.providerId === defaultModel.providerId)) {
                this.managedModels.push({ ...defaultModel });
                hasChanges = true;
                console.log(`[ModelManager] Added missing Google default model: ${defaultModel.id}`);
            }

            // 检查是否已激活
            const key = this.buildKey(defaultModel.providerId, defaultModel.id);
            if (!this.userActiveModels.includes(key)) {
                this.userActiveModels.push(key);
                hasChanges = true;
                console.log(`[ModelManager] Activated Google default model: ${defaultModel.id}`);
            }
        }

        if (hasChanges) {
            await this.saveToStorage();
            console.log('[ModelManager] Google default models ensured');
        }
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

        // 检查是否已存在（按供应商+模型ID区分）
        if (this.managedModels.find(model => model.id === modelDefinition.id && model.providerId === modelDefinition.providerId)) {
            console.warn(`[ModelManager] Model already exists: ${modelDefinition.providerId}::${modelDefinition.id}`);
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
        const { providerId, modelId: plainId, isComposite } = this.parseKey(modelId);
        const model = isComposite
            ? this.managedModels.find(m => m.id === plainId && m.providerId === providerId)
            : this.managedModels.find(m => m.id === modelId);
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
        const key = this.buildKey(model.providerId, model.id);
        const activeIndex = this.userActiveModels.indexOf(key);
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
        const { providerId, modelId: plainId, isComposite } = this.parseKey(modelId);
        const modelIndex = this.managedModels.findIndex(model => isComposite ? (model.id === plainId && model.providerId === providerId) : (model.id === modelId));
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
        const key = this.buildKey(model.providerId, model.id);
        const activeIndex = this.userActiveModels.indexOf(key);
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
        const validModelIds = modelIds.filter(id => {
            const { providerId, modelId, isComposite } = this.parseKey(id);
            if (isComposite) return !!this.managedModels.find(m => m.id === modelId && m.providerId === providerId);
            return !!this.managedModels.find(m => m.id === modelId);
        });

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
        const { providerId, modelId: plainId, isComposite } = this.parseKey(modelId);
        if (isComposite) return this.userActiveModels.includes(modelId);
        // 兼容旧调用：检查任意供应商下是否有此ID激活
        return this.userActiveModels.some(key => {
            const parsed = this.parseKey(key);
            return parsed.modelId === plainId;
        });
    }

    /**
     * 添加模型到用户已选列表
     * @param {string} modelId - 模型ID
     */
    async activateModel(modelId) {
        const model = this.getModelByKey(modelId);
        if (!model) {
            console.warn(`[ModelManager] Cannot activate non-existent model: ${modelId}`);
            return false;
        }
        const key = this.buildKey(model.providerId, model.id);
        if (!this.userActiveModels.includes(key)) {
            this.userActiveModels.push(key);
            await this.saveToStorage();
            console.log(`[ModelManager] Activated model: ${key}`);
        }
        return true;
    }

    /**
     * 从用户已选列表中移除模型
     * @param {string} modelId - 模型ID
     */
    async deactivateModel(modelId) {
        const { providerId, modelId: plainId, isComposite } = this.parseKey(modelId);
        const key = isComposite ? modelId : (this.managedModels.find(m => m.id === plainId) ? this.buildKey(this.managedModels.find(m => m.id === plainId).providerId, plainId) : modelId);
        const index = this.userActiveModels.indexOf(key);
        if (index !== -1) {
            this.userActiveModels.splice(index, 1);
            await this.saveToStorage();
            console.log(`[ModelManager] Deactivated model: ${key}`);
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
            // 使用 providerManager 的 Google apiHost
            const googleApiHost = window.ProviderManager?.providers?.google?.apiHost;
            if (!googleApiHost) {
                throw new Error('Google provider apiHost not configured');
            }
            const endpoint = `${googleApiHost.replace(/\/$/, '')}/v1beta/models?key=${apiKey}`;
            // 统一代理感知请求
            const response = await (window.ProxyRequest?.makeApiRequest ? window.ProxyRequest.makeApiRequest(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }) : fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }));

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
            // 查找新发现的模型（包含 providerId）
            const discoveredModel = (discoveredModels || []).find(model => model.id === modelId);
            if (!discoveredModel) {
                console.warn(`[ModelManager] Discovered model not found: ${modelId}`);
                skipped++;
                continue;
            }

            const compositeKey = this.buildKey(discoveredModel.providerId, discoveredModel.id);
            const existingModel = this.managedModels.find(model => model.id === discoveredModel.id && model.providerId === discoveredModel.providerId);
            if (existingModel) {
                // 模型已存在，只需激活
                if (!this.userActiveModels.includes(compositeKey)) {
                    await this.activateModel(compositeKey);
                    activated++;
                    console.log(`[ModelManager] Reactivated existing model: ${compositeKey}`);
                } else {
                    skipped++;
                    console.log(`[ModelManager] Model already active: ${compositeKey}`);
                }
                continue;
            }

            // 添加新模型（加注来源）
            const success = await this.addModel({
                ...discoveredModel,
                source: discoveredModel.source || 'discovered'
            });
            if (success) {
                // 自动激活新添加的模型
                await this.activateModel(compositeKey);
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
        const activeModelKeys = new Set(this.userActiveModels);
        const managedKeys = new Set(this.managedModels.map(model => this.buildKey(model.providerId, model.id)));
        const discoveredKeys = new Set((discoveredModels || []).map(m => this.buildKey(m.providerId, m.id)));

        // 首先恢复缺失的默认模型（只包括指定供应商的模型）
        const missingDefaultModels = this.getMissingDefaultModels();
        const relevantMissingModels = providerId
            ? missingDefaultModels.filter(model => model.providerId === providerId)
            : missingDefaultModels;
        const availableModels = [...relevantMissingModels];

        // 添加已管理但未激活的模型（被用户移除但仍在管理列表中的模型）
        // 只包括指定供应商的模型
        const inactiveModels = this.managedModels.filter(model =>
            !activeModelKeys.has(this.buildKey(model.providerId, model.id)) &&
            !relevantMissingModels.some(dm => dm.id === model.id && dm.providerId === model.providerId) &&
            (!providerId || model.providerId === providerId) &&
            // 不要把“手动添加”的模型带入发现列表（兼容新版本）
            model.source !== 'manual' &&
            // 仅保留可从 API 再发现的或默认模型（兼容旧版本未打标的条目）
            (model.isDefault === true || discoveredKeys.has(this.buildKey(model.providerId, model.id)) || model.source === 'discovered')
        );
        availableModels.push(...inactiveModels);

        // 然后添加所有从API发现但不在管理列表中的新模型（按复合键判断）
        const newDiscoveredModels = (discoveredModels || []).filter(model => {
            const key = this.buildKey(model.providerId, model.id);
            if (managedKeys.has(key)) return false;
            if (relevantMissingModels.some(defaultModel => defaultModel.id === model.id && defaultModel.providerId === model.providerId)) return false;
            return true;
        });

        availableModels.push(...newDiscoveredModels);

        // 按模型ID进行字母排序
        availableModels.sort((a, b) => a.id.localeCompare(b.id));

        console.log(`[ModelManager] Found ${availableModels.length} models available for addition for provider ${providerId || 'all'}:`,
            availableModels.map(m => `${m.providerId}::${m.id} (${managedKeys.has(this.buildKey(m.providerId, m.id)) ? 'inactive' : 'new'})`));

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
     * @returns {Array} 格式化的选项数组 [{value, text, disabled, providerId, providerName}]
     */
    getModelOptionsForUI(includeInactive = false) {
        const models = includeInactive ? this.managedModels : this.getUserActiveModels();

        // 按模型ID进行字母排序
        const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id));

        return sortedModels.map(model => {
            // 获取提供商信息
            let providerName = model.providerId || 'unknown';
            if (window.ProviderManager) {
                const provider = window.ProviderManager.getProvider(model.providerId);
                if (provider) {
                    providerName = provider.name;
                }
            }

            return {
                value: this.buildKey(model.providerId, model.id),
                text: model.displayName,
                disabled: includeInactive ? !this.isModelActive(this.buildKey(model.providerId, model.id)) : false,
                isAlias: model.isAlias,
                isDefault: model.isDefault,
                canDelete: model.canDelete !== false, // 默认可删除，除非明确设置为false
                providerId: model.providerId,
                providerName: providerName
            };
        });
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
        const missingModels = this.userActiveModels.filter(key => {
            const { providerId, modelId, isComposite } = this.parseKey(key);
            if (isComposite) return !this.managedModels.find(model => model.id === modelId && model.providerId === providerId);
            return !this.managedModels.find(model => model.id === modelId);
        });
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
            if (this.userActiveModels.includes(this.buildKey(model.providerId, model.id))) {
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
            models = models.filter(model => this.userActiveModels.includes(this.buildKey(model.providerId, model.id)));
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

    /**
     * 删除指定供应商的所有模型和激活记录
     * @param {string} providerId - 供应商ID
     */
    async removeModelsByProvider(providerId) {
        const beforeCount = this.managedModels.length;
        const removedModels = this.managedModels.filter(m => m.providerId === providerId);
        const removedKeys = new Set(removedModels.map(m => this.buildKey(m.providerId, m.id)));

        if (removedKeys.size === 0) {
            return { removed: 0 };
        }

        // 过滤管理列表
        this.managedModels = this.managedModels.filter(m => m.providerId !== providerId);

        // 过滤激活列表（按复合键）
        this.userActiveModels = this.userActiveModels.filter(key => !removedKeys.has(key));

        await this.saveToStorage();
        console.log(`[ModelManager] Removed ${beforeCount - this.managedModels.length} models for provider: ${providerId}`);
        return { removed: beforeCount - this.managedModels.length };
    }

    /**
     * 删除供应商设置（API Key 等）
     * @param {string} providerId - 供应商ID
     */
    async removeProviderSettings(providerId) {
        if (this.providerSettings && this.providerSettings[providerId]) {
            delete this.providerSettings[providerId];
            await this.saveToStorage();
            console.log(`[ModelManager] Removed provider settings: ${providerId}`);
        }
    }

    /**
     * 清理“孤儿”模型：其 providerId 在当前或存储的自定义提供商中不存在
     * 目的：
     * - 修复用户删除自定义提供商后遗留的模型导致的“再次发现模型时被错误过滤”的问题
     * - 保证模型ID空间干净，避免与新加入的供应商发生冲突
     */
    async cleanupOrphanedModels() {
        try {
            // 收集已知供应商ID（内置 + 存储中的自定义提供商）
            const knownIds = new Set();
            try {
                // 内置（当前进程中已注册的）
                if (window.ProviderManager?.getProviderIds) {
                    window.ProviderManager.getProviderIds().forEach(id => knownIds.add(id));
                } else if (window.ProviderManager?.providers) {
                    Object.keys(window.ProviderManager.providers).forEach(id => knownIds.add(id));
                }
            } catch (e) {
                // 忽略
            }

            // 从存储读取自定义提供商，避免依赖 UI 加载顺序
            const storedCustomIds = await new Promise((resolve) => {
                chrome.storage.sync.get(['customProviders'], (result) => {
                    const list = Array.isArray(result.customProviders) ? result.customProviders : [];
                    resolve(list.map(p => p.id));
                });
            });
            storedCustomIds.forEach(id => knownIds.add(id));

            // 找出 providerId 不在 knownIds 中的模型
            const orphanModels = this.managedModels.filter(m => !m.providerId || !knownIds.has(m.providerId));
            const orphanKeys = new Set(orphanModels.map(m => this.buildKey(m.providerId, m.id)));

            if (orphanKeys.size === 0) {
                return { removed: 0 };
            }

            const beforeCount = this.managedModels.length;
            this.managedModels = this.managedModels.filter(m => !orphanModels.some(o => o.id === m.id && o.providerId === m.providerId));
            this.userActiveModels = this.userActiveModels.filter(key => !orphanKeys.has(key));
            await this.saveToStorage();
            const removed = beforeCount - this.managedModels.length;
            console.log(`[ModelManager] Cleanup removed ${removed} orphaned models (providers missing)`);
            return { removed };
        } catch (error) {
            console.warn('[ModelManager] Orphaned model cleanup failed:', error);
            return { removed: 0 };
        }
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
