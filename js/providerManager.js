/**
 * PageTalk - 供应商配置中心
 * 
 * 这个模块是多供应商架构的核心配置文件，集中定义了所有支持的 AI 供应商及其基础信息。
 * 采用配置驱动的方式，使得添加新供应商变得极为简单。
 */

/**
 * 供应商配置对象
 * 每个供应商包含以下属性：
 * - id: 唯一标识符 (例如 'openai', 'google')
 * - name: 显示给用户的名称
 * - type: API 类型，用于选择对应的适配器
 * - apiHost: API 的基础 URL
 * - apiKeyUrl: 获取 API Key 的帮助链接
 * - modelsUrl: 模型列表的文档链接
 * - apiKeyNeeded: 是否需要用户提供 API Key
 * - icon: 供应商图标文件名（存储在 icons/ 目录下）
 * - description: 供应商描述
 * - isCustom: 是否为用户自定义提供商
 */
export const providers = {
    google: {
        id: 'google',
        name: 'Google',
        type: 'gemini',
        apiHost: 'https://generativelanguage.googleapis.com',
        apiKeyUrl: 'https://aistudio.google.com/',
        modelsUrl: 'https://ai.google.dev/models/gemini',
        apiKeyNeeded: true,
        icon: 'Gemini.svg',
        description: 'Google Gemini 系列模型，支持多模态输入和高质量文本生成'
    },
    
    openai: {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai_compatible',
        apiHost: 'https://api.openai.com',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        modelsUrl: 'https://platform.openai.com/docs/models',
        apiKeyNeeded: true,
        icon: 'OpenAI.svg',
        description: 'OpenAI GPT 系列模型，包括 GPT-4、GPT-3.5 等'
    },
    
    anthropic: {
        id: 'anthropic',
        name: 'Claude',
        type: 'anthropic',
        apiHost: 'https://api.anthropic.com',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        modelsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
        apiKeyNeeded: true,
        icon: 'Claude.svg',
        description: 'Anthropic Claude 系列模型，专注于安全和有用的 AI 助手'
    },
    
    siliconflow: {
        id: 'siliconflow',
        name: 'SiliconFlow',
        type: 'openai_compatible',
        apiHost: 'https://api.siliconflow.cn',
        apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
        modelsUrl: 'https://docs.siliconflow.cn/docs/model-names',
        apiKeyNeeded: true,
        icon: 'SiliconFlow.svg',
        description: '硅基流动提供的高性价比 AI 模型服务'
    },
    
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'openai_compatible',
        apiHost: 'https://openrouter.ai/api/v1',
        apiKeyUrl: 'https://openrouter.ai/settings/keys',
        modelsUrl: 'https://openrouter.ai/models',
        apiKeyNeeded: true,
        icon: 'OpenRouter.svg',
        description: 'OpenRouter 聚合多个 AI 模型提供商的服务'
    },
    
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        type: 'openai_compatible',
        apiHost: 'https://api.deepseek.com',
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        modelsUrl: 'https://platform.deepseek.com/api-docs/zh-cn/',
        apiKeyNeeded: true,
        icon: 'DeepSeek.svg',
        description: 'DeepSeek 深度求索的高性能 AI 模型'
    },

    modelscope: {
        id: 'modelscope',
        name: 'ModelScope',
        type: 'openai_compatible',
        apiHost: 'https://api-inference.modelscope.cn/v1',
        apiKeyUrl: 'https://modelscope.cn/my/myaccesstoken',
        modelsUrl: 'https://modelscope.cn/models',
        apiKeyNeeded: true,
        icon: 'modelscope.svg',
        description: 'ModelScope 阿里灵积提供的多模型推理服务'
    },

    chatglm: {
        id: 'chatglm',
        name: 'ChatGLM',
        type: 'openai_compatible',
        apiHost: 'https://open.bigmodel.cn/api/paas/v4',
        apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
        modelsUrl: 'https://open.bigmodel.cn/modelcenter/square',
        apiKeyNeeded: true,
        icon: 'ChatGLM.svg',
        description: '智谱AI ChatGLM 系列模型，支持中文对话和代码生成'
    },

    ollama: {
        id: 'ollama',
        name: 'Ollama',
        type: 'openai_compatible',
        apiHost: 'http://localhost:11434',
        apiKeyUrl: 'https://ollama.com/download',
        modelsUrl: 'https://ollama.com/library',
        apiKeyNeeded: true,
        icon: 'ollama.svg',
        description: 'Ollama 本地大语言模型运行平台，支持多种开源模型'
    },

    lmstudio: {
        id: 'lmstudio',
        name: 'LM Studio',
        type: 'openai_compatible',
        apiHost: 'http://localhost:1234',
        apiKeyUrl: 'https://lmstudio.ai/docs/local-server',
        modelsUrl: 'https://lmstudio.ai/docs/app/basics/download-model',
        apiKeyNeeded: true,
        icon: 'lmstudio.svg',
        description: 'LM Studio 本地大语言模型运行平台，提供图形化界面和 API 服务'
    }
};

/**
 * API 类型定义
 * 定义了不同的 API 适配器类型
 */
export const API_TYPES = {
    GEMINI: 'gemini',
    OPENAI_COMPATIBLE: 'openai_compatible',
    ANTHROPIC: 'anthropic'
};

/**
 * 获取指定供应商的配置
 * @param {string} providerId - 供应商ID
 * @returns {Object|null} 供应商配置对象或null
 */
export function getProvider(providerId) {
    return providers[providerId] || null;
}

/**
 * 获取所有供应商的配置
 * @returns {Object} 所有供应商配置对象
 */
export function getAllProviders() {
    return { ...providers };
}

/**
 * 获取所有供应商ID列表
 * @returns {Array<string>} 供应商ID数组
 */
export function getProviderIds() {
    return Object.keys(providers);
}

/**
 * 根据API类型获取供应商列表
 * @param {string} apiType - API类型
 * @returns {Array<Object>} 匹配的供应商配置数组
 */
export function getProvidersByType(apiType) {
    return Object.values(providers).filter(provider => provider.type === apiType);
}

/**
 * 验证供应商ID是否有效
 * @param {string} providerId - 供应商ID
 * @returns {boolean} 是否有效
 */
export function isValidProviderId(providerId) {
    return providerId in providers;
}

/**
 * 获取供应商的图标路径
 * @param {string} providerId - 供应商ID
 * @returns {string|null} 图标路径或null
 */
export function getProviderIconPath(providerId) {
    const provider = getProvider(providerId);
    return provider ? `../icons/${provider.icon}` : null;
}

/**
 * 获取用于UI显示的供应商选项列表
 * @returns {Array<Object>} 格式化的选项数组 [{value, text, icon}]
 */
export function getProviderOptionsForUI() {
    return Object.values(providers).map(provider => ({
        value: provider.id,
        text: provider.name,
        icon: provider.icon,
        description: provider.description
    }));
}

/**
 * 自定义提供商管理
 */

/**
 * 添加自定义提供商
 * @param {Object} customProvider - 自定义提供商配置
 * @param {string} customProvider.id - 提供商ID（可选，留空自动生成）
 * @param {string} customProvider.baseUrl - API基础URL
 * @param {string} customProvider.apiKey - API密钥
 * @returns {Promise<Object>} 添加结果 {success: boolean, providerId?: string, error?: string}
 */
export async function addCustomProvider(customProvider) {
    try {
        // 验证输入
        if (!customProvider.baseUrl || !customProvider.apiKey) {
            return { success: false, error: 'Base URL and API Key are required' };
        }

        // 验证URL格式
        try {
            new URL(customProvider.baseUrl);
        } catch (e) {
            return { success: false, error: 'Invalid URL format' };
        }

        // 生成提供商ID
        let providerId = customProvider.id;
        if (!providerId) {
            providerId = generateCustomProviderId();
        } else {
            // 检查ID是否已存在
            if (providers[providerId]) {
                return { success: false, error: 'Provider ID already exists' };
            }
        }

        // 创建提供商配置
        const providerConfig = {
            id: providerId,
            name: customProvider.id || providerId,
            type: 'openai_compatible',
            apiHost: customProvider.baseUrl.replace(/\/$/, ''), // 移除末尾斜杠
            apiKeyUrl: '',
            modelsUrl: '',
            apiKeyNeeded: true,
            icon: 'OpenAI.svg', // 使用OpenAI图标
            description: `Custom OpenAI Compatible Provider: ${providerId}`,
            isCustom: true
        };

        // 添加到providers对象
        providers[providerId] = providerConfig;

        // 保存自定义提供商到存储
        await saveCustomProviders();

        // 如果有ModelManager实例，设置API Key
        if (window.ModelManager?.instance) {
            await window.ModelManager.instance.setProviderSettings(providerId, {
                apiKey: customProvider.apiKey
            });
        }

        console.log(`[ProviderManager] Added custom provider: ${providerId}`);
        return { success: true, providerId };

    } catch (error) {
        console.error('[ProviderManager] Error adding custom provider:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 生成自定义提供商ID
 * @returns {string} 生成的ID
 */
function generateCustomProviderId() {
    const baseId = 'openai-compatible';
    let counter = 1;
    let providerId = baseId;

    while (providers[providerId]) {
        counter++;
        providerId = `${baseId}-${counter}`;
    }

    return providerId;
}

/**
 * 删除自定义提供商
 * @param {string} providerId - 提供商ID
 * @returns {Promise<boolean>} 是否删除成功
 */
export async function removeCustomProvider(providerId) {
    try {
        const provider = providers[providerId];
        if (!provider || !provider.isCustom) {
            console.warn(`[ProviderManager] Cannot remove non-custom provider: ${providerId}`);
            return false;
        }

        // 先移除与该供应商相关的模型与设置，避免遗留模型冲突
        try {
            if (window.ModelManager?.instance) {
                await window.ModelManager.instance.removeModelsByProvider(providerId);
                await window.ModelManager.instance.removeProviderSettings(providerId);
            }
        } catch (cleanupError) {
            console.warn('[ProviderManager] Failed to cleanup models/settings for provider removal:', cleanupError);
        }

        // 从providers对象中删除
        delete providers[providerId];

        // 保存到存储
        await saveCustomProviders();

        console.log(`[ProviderManager] Removed custom provider: ${providerId}`);
        return true;

    } catch (error) {
        console.error('[ProviderManager] Error removing custom provider:', error);
        return false;
    }
}

/**
 * 获取所有自定义提供商
 * @returns {Array<Object>} 自定义提供商列表
 */
export function getCustomProviders() {
    return Object.values(providers).filter(provider => provider.isCustom);
}

/**
 * 保存自定义提供商到Chrome存储
 */
export async function saveCustomProviders() {
    const customProviders = getCustomProviders();
    return new Promise((resolve) => {
        chrome.storage.sync.set({ customProviders }, () => {
            resolve();
        });
    });
}

/**
 * 从Chrome存储加载自定义提供商
 */
export async function loadCustomProviders() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['customProviders'], (result) => {
            if (result.customProviders && Array.isArray(result.customProviders)) {
                // 将自定义提供商添加到providers对象
                result.customProviders.forEach(provider => {
                    providers[provider.id] = provider;
                });
                console.log(`[ProviderManager] Loaded ${result.customProviders.length} custom providers`);
            }
            resolve();
        });
    });
}

// 导出到全局作用域以便其他模块使用
if (typeof window !== 'undefined') {
    window.ProviderManager = {
        providers,
        API_TYPES,
        getProvider,
        getAllProviders,
        getProviderIds,
        getProvidersByType,
        isValidProviderId,
        getProviderIconPath,
        getProviderOptionsForUI,
        addCustomProvider,
        removeCustomProvider,
        getCustomProviders,
        loadCustomProviders,
        saveCustomProviders
    };
}
