// background.js 加载

/**
 * Pagetalk 背景脚本
 * 处理浏览器扩展的后台逻辑
 */

// 当安装或更新扩展时初始化
chrome.runtime.onInstalled.addListener(() => {
    // onInstalled 事件触发

    // 创建右键菜单
    chrome.contextMenus.create({
        id: "openPagetalk",
        title: "打开 Pagetalk 面板",
        contexts: ["page", "selection"]
    });

    // 初始化代理设置
    updateProxySettings();

    // 启动代理健康检查
    startProxyHealthCheck();
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // onClicked 事件触发 (右键菜单)
    if (info.menuItemId === "openPagetalk" && tab) {
        togglePagetalkPanel(tab.id);
    }
});

// 处理扩展图标点击
chrome.action.onClicked.addListener((tab) => {
    // onClicked 事件触发 (扩展图标)
    if (tab) {
        togglePagetalkPanel(tab.id);
    }
});

// 切换面板状态
async function togglePagetalkPanel(tabId) {
    try {
        // --- 新增代码 开始 ---
        // 1. 获取标签页信息
        const tab = await chrome.tabs.get(tabId);

        // 2. 检查 URL 协议是否受支持
        //    只允许在 http, https (以及可选的 file) 页面执行
        if (!tab || !tab.url || !(
            tab.url.startsWith('http:') ||
            tab.url.startsWith('https:') // ||
            // tab.url.startsWith('file:') // 如果需要支持本地文件，取消此行注释
        )) {
            console.debug(`Pagetalk: 不在受支持的页面 (${tab ? tab.url : 'N/A'}) 上执行操作，跳过。`);
            return; // 直接退出，不执行后续操作
        }
        // --- 新增代码 结束 ---

        // --- 原有代码（稍作调整，仅在受支持页面执行）---
        try {
            // 尝试切换面板
            const response = await chrome.tabs.sendMessage(tabId, { action: "togglePanel" });

            // 检查响应，如果库缺失则重新注入
            if (response && !response.success && response.missing) {
                console.log('[Background] Libraries missing, reinjecting scripts:', response.missing);
                await reinjectScriptsToTab(tabId);

                // 再次尝试发送消息
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tabId, { action: "togglePanel" });
                    } catch (e) {
                        console.error('[Background] 重试切换面板失败:', e);
                    }
                }, 1000);
            }
        } catch (error) {
            console.log('[Background] Content script not responding, reinjecting all scripts');

            // 如果出错可能是因为content script还未加载或已失效，重新注入所有必要脚本
            try {
                await reinjectScriptsToTab(tabId);

                // 再次尝试发送消息
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tabId, { action: "togglePanel" });
                    } catch (e) {
                        console.error('[Background] 重试切换面板失败:', e);
                    }
                }, 1000); // 给更多时间让脚本完全加载
            } catch (e) {
                console.error('[Background] 重新注入脚本失败:', e);
            }
        }
    } catch (outerError) {
        // 捕获获取 tab 信息或其他意外错误
        console.error('togglePagetalkPanel 获取 tab 信息或其他意外出错:', outerError);
    }
}

// 监听来自内容脚本或面板的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "pageContentExtracted") { // 来自 content.js 通过 iframe -> main.js -> content script -> background (这条路径似乎不直接发生)
        // 通常是 main.js 直接通过 chrome.runtime.sendMessage 联系 background
        // ... (此部分逻辑可能需要审视，但不是当前 bug 的核心) ...
        // 实际上 pageContentExtracted 是 content.js 发给 iframe(main.js)的
        // main.js 收到后更新自己的状态，通常不直接发给 background.js
        // 如果有特定场景，保留。
        chrome.storage.local.set({
            recentPageContent: message.content,
            recentExtractionTime: Date.now()
        });
        sendResponse({ success: true });
    }
    // 修改：处理从 main.js 发来的提取指定标签页内容的请求
    else if (message.action === "extractTabContent") {
        const targetTabId = message.tabId;
        if (!targetTabId) {
            console.error("Background: No tabId provided for extractTabContent");
            sendResponse({ error: "No tabId provided" });
            return true;
        }

        chrome.tabs.get(targetTabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Background: Error getting tab info:", chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about://') || tab.url.startsWith('edge://'))) {
                console.warn(`Background: Cannot access restricted URL: ${tab.url}`);
                sendResponse({ error: `Cannot access restricted URL: ${tab.url}` });
                return;
            }

            // 向目标标签页的 content.js 发送请求
            chrome.tabs.sendMessage(targetTabId, { action: "getFullPageContentRequest" }, (responseFromContentScript) => {
                if (chrome.runtime.lastError) {
                    // 捕获 sendMessage 可能发生的错误，例如目标标签页没有监听器，或标签页已关闭
                    console.error("Background: Error sending 'getFullPageContentRequest' to tab " + targetTabId, chrome.runtime.lastError.message);
                    sendResponse({ error: "Failed to communicate with the tab: " + chrome.runtime.lastError.message });
                } else if (responseFromContentScript) {
                    // 将 content.js 的响应转发回 main.js
                    sendResponse(responseFromContentScript);
                } else {
                    // responseFromContentScript可能是undefined如果content script没有正确sendResponse
                    console.error("Background: No response or empty response from content script in tab " + targetTabId);
                    sendResponse({ error: "No response from content script in the target tab." });
                }
            });
        });
        return true; // 必须返回 true 以表明 sendResponse 将会异步调用
    }
    // 已废弃：处理来自划词助手的 generateContent 请求
    // 现在划词助手使用统一API接口，不再通过background.js处理
    else if (message.action === "generateContent") {
        sendResponse({
            success: false,
            error: "This API endpoint has been deprecated. Please use the unified API interface."
        });
        return true;
    }
    // 处理来自content script的代理请求
    else if (message.action === "fetchWithProxy") {
        handleFetchWithProxyRequest(message.url, message.options, sendResponse);
        return true; // 异步响应
    }
    // 处理代理测试请求
    else if (message.action === "testProxy") {
        handleProxyTestRequest(message.proxyAddress, sendResponse);
        return true; // 异步响应
    }
    // 处理获取可用模型列表的请求
    else if (message.action === "getAvailableModels") {
        handleGetAvailableModelsRequest(sendResponse);
        return true; // 异步响应
    }
    // 处理获取模型配置的请求
    else if (message.action === "getModelConfig") {
        handleGetModelConfigRequest(message.model, sendResponse);
        return true; // 异步响应
    }
    // 处理广播模型更新的请求
    else if (message.action === "broadcastModelsUpdated") {
        handleBroadcastModelsUpdated(sendResponse);
        return true; // 异步响应
    }
    // 处理来自划词助手的API调用请求
    else if (message.action === "callUnifiedAPI") {
        handleUnifiedAPICall(message, sendResponse, sender);
        return true; // 异步响应
    }
    // 如果有其他同步消息处理，它们可以在这里返回 false 或 undefined
    // 但如果整个 onMessage 可能处理异步操作，最好总是返回 true
    return true;
});

/**
 * 处理获取可用模型列表的请求
 */
async function handleGetAvailableModelsRequest(sendResponse) {
    try {
        // 从存储中获取模型管理器的数据、自定义提供商、供应商设置和旧版本API key
        const result = await chrome.storage.sync.get(['managedModels', 'userActiveModels', 'customProviders', 'providerSettings', 'apiKey']);

        if (result.managedModels && result.userActiveModels) {
            // 获取用户激活的模型
            const managedModels = result.managedModels;
            const userActiveModels = result.userActiveModels;

            // 构建提供商映射（包括自定义提供商）
            const providerMap = {
                google: 'Google',
                openai: 'OpenAI',
                anthropic: 'Claude',
                siliconflow: 'SiliconFlow',
                openrouter: 'OpenRouter',
                deepseek: 'DeepSeek',
                chatglm: 'ChatGLM' // Fixed: Add ChatGLM to the provider map.
            };

            // 添加自定义提供商到映射
            if (result.customProviders && Array.isArray(result.customProviders)) {
                result.customProviders.forEach(provider => {
                    providerMap[provider.id] = provider.id;
                });
            }

            const activeModelOptions = userActiveModels
                .map(modelId => managedModels.find(model => model.id === modelId))
                .filter(model => model !== undefined)
                .map(model => {
                    const providerName = providerMap[model.providerId] || model.providerId || 'Unknown';
                    return {
                        value: model.id,
                        text: model.displayName,
                        providerId: model.providerId,
                        providerName: providerName
                    };
                });

            console.log('[Background] Returning active model options:', activeModelOptions);
            sendResponse({ success: true, models: activeModelOptions });
        } else {
            // 如果没有存储数据，检查是否配置了Google API key再决定是否返回默认模型
            const hasGoogleApiKey = checkGoogleApiKeyConfigured(result.providerSettings, result.apiKey);

            if (hasGoogleApiKey) {
                // 用户配置了Google API key，返回默认Gemini模型
                const defaultModelOptions = [
                    { value: 'gemini-2.5-flash', text: 'gemini-2.5-flash', providerId: 'google', providerName: 'Google' },
                    { value: 'gemini-2.5-flash-thinking', text: 'gemini-2.5-flash-thinking', providerId: 'google', providerName: 'Google' },
                    { value: 'gemini-2.5-flash-lite-preview-06-17', text: 'gemini-2.5-flash-lite-preview-06-17', providerId: 'google', providerName: 'Google' }
                ];
                console.log('[Background] No stored models but Google API key configured, returning Gemini defaults:', defaultModelOptions);
                sendResponse({ success: true, models: defaultModelOptions });
            } else {
                // 用户没有配置Google API key，返回空模型列表
                console.log('[Background] No stored models and no Google API key configured, returning empty list');
                sendResponse({ success: true, models: [] });
            }
        }
    } catch (error) {
        console.error('[Background] Error getting available models:', error);
        // 返回默认模型选项作为回退，但也要检查API key
        const result = await chrome.storage.sync.get(['providerSettings', 'apiKey']).catch(() => ({}));
        const hasGoogleApiKey = checkGoogleApiKeyConfigured(result.providerSettings, result.apiKey);

        if (hasGoogleApiKey) {
            const fallbackModelOptions = [
                { value: 'gemini-2.5-flash', text: 'gemini-2.5-flash', providerId: 'google', providerName: 'Google' },
                { value: 'gemini-2.5-flash-thinking', text: 'gemini-2.5-flash-thinking', providerId: 'google', providerName: 'Google' },
                { value: 'gemini-2.5-flash-lite-preview-06-17', text: 'gemini-2.5-flash-lite-preview-06-17', providerId: 'google', providerName: 'Google' }
            ];
            sendResponse({ success: true, models: fallbackModelOptions });
        } else {
            sendResponse({ success: true, models: [] });
        }
    }
}

/**
 * 处理获取模型配置的请求（多供应商版本）
 */
async function handleGetModelConfigRequest(modelId, sendResponse) {
    try {
        // 从存储中获取模型管理器的数据
        const result = await chrome.storage.sync.get(['managedModels']);

        if (result.managedModels) {
            // 查找指定的模型配置
            const managedModels = result.managedModels;
            const modelConfig = managedModels.find(model => model.id === modelId);

            if (modelConfig) {
                console.log('[Background] Returning model config for:', modelId, modelConfig);
                sendResponse({
                    success: true,
                    config: {
                        apiModelName: modelConfig.apiModelName,
                        providerId: modelConfig.providerId || 'google',
                        params: modelConfig.params
                    }
                });
            } else {
                // 模型不存在，返回默认配置
                console.warn('[Background] Model not found, using fallback config for:', modelId);
                sendResponse({
                    success: true,
                    config: {
                        apiModelName: modelId,
                        providerId: 'google',
                        params: getDefaultModelParams(modelId)
                    }
                });
            }
        } else {
            // 没有存储数据，返回默认配置
            console.warn('[Background] No stored models, using fallback config for:', modelId);
            sendResponse({
                success: true,
                config: {
                    apiModelName: modelId,
                    providerId: 'google',
                    params: getDefaultModelParams(modelId)
                }
            });
        }
    } catch (error) {
        console.error('[Background] Error getting model config:', error);
        // 返回默认配置作为回退
        sendResponse({
            success: true,
            config: {
                apiModelName: modelId,
                providerId: 'google',
                params: getDefaultModelParams(modelId)
            }
        });
    }
}

/**
 * 检查Google API key是否已配置
 * @param {Object} providerSettings - 供应商设置对象
 * @param {string} legacyApiKey - 旧版本的API key（可选）
 * @returns {boolean} 是否已配置Google API key
 */
function checkGoogleApiKeyConfigured(providerSettings, legacyApiKey = null) {
    // 首先检查新的供应商设置结构
    if (providerSettings && providerSettings.google && providerSettings.google.apiKey) {
        const googleApiKey = providerSettings.google.apiKey;
        if (googleApiKey && googleApiKey.trim()) {
            return true;
        }
    }

    // 如果新结构中没有，检查旧版本的API key
    if (legacyApiKey && legacyApiKey.trim()) {
        return true;
    }

    return false;
}

/**
 * 获取默认模型参数（多供应商版本）
 */
function getDefaultModelParams(modelId) {
    // Google Gemini 模型的默认参数
    if (modelId === 'gemini-2.5-flash') {
        return { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } };
    } else if (modelId === 'gemini-2.5-flash-thinking') {
        return null; // 使用默认思考模式
    } else if (modelId === 'gemini-2.5-pro') {
        return null;
    } else if (modelId === 'gemini-2.5-flash-lite-preview-06-17') {
        return null;
    }

    // 其他供应商的模型默认无特殊参数
    return null;
}

/**
 * 处理广播模型更新的请求
 */
async function handleBroadcastModelsUpdated(sendResponse) {
    try {
        // 获取所有标签页
        const tabs = await chrome.tabs.query({});

        // 向每个标签页发送模型更新消息
        const promises = tabs.map(tab => {
            return chrome.tabs.sendMessage(tab.id, {
                action: 'modelsUpdated'
            }).catch(error => {
                // 忽略发送失败的错误（可能是标签页没有content script）
                console.log(`[Background] Failed to send modelsUpdated to tab ${tab.id}:`, error.message);
            });
        });

        await Promise.all(promises);
        console.log('[Background] Broadcasted models updated to all tabs');

        // 确保在响应之前检查运行时是否仍然有效
        if (chrome.runtime.lastError) {
            console.warn('[Background] Runtime error during broadcast:', chrome.runtime.lastError.message);
        } else {
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('[Background] Error broadcasting models updated:', error);
        // 只有在运行时仍然有效时才发送响应
        if (!chrome.runtime.lastError) {
            sendResponse({ success: false, error: error.message });
        }
    }
}

/**
 * 处理来自划词助手的统一API调用请求 - 独立处理，不依赖主面板
 */
async function handleUnifiedAPICall(message, sendResponse, sender) {
    try {
        const { model, messages, options, streamId } = message;
        console.log('[Background] Handling independent unified API call for model:', model);

        // 从存储中获取模型配置和供应商设置
        const result = await chrome.storage.sync.get(['managedModels', 'providerSettings']);

        if (!result.managedModels) {
            throw new Error('Model configuration not found. Please configure models in the main panel first.');
        }

        // 查找模型配置
        const modelConfig = result.managedModels.find(m => m.id === model);
        if (!modelConfig) {
            throw new Error(`Model not found: ${model}`);
        }

        const providerId = modelConfig.providerId;
        const providerSettings = result.providerSettings?.[providerId];

        if (!providerSettings || !providerSettings.apiKey) {
            throw new Error(`API Key not configured for provider: ${providerId}`);
        }

        // 流式回调函数
        const streamCallback = (chunk, isComplete) => {
            if (sender.tab) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'streamUpdate',
                    streamId: streamId,
                    chunk: chunk,
                    isComplete: isComplete
                }).catch(() => {
                    // 忽略发送失败
                });
            }
        };

        // 直接在background中调用API（支持流式）
        const response = await callAPIDirectlyWithStream(modelConfig, providerSettings, messages, options, streamCallback);

        sendResponse({ success: true, response: response });

    } catch (error) {
        console.error('[Background] Error handling unified API call:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * 智能格式化 API URL
 * 自动添加 /v1/ 到基础 URL，除非它们已经包含版本路径
 */
function formatApiUrl(apiHost, providerId, endpoint) {
    // OpenRouter 的 apiHost 已包含 /api/v1
    if (providerId === 'openrouter') {
        return `${apiHost}${endpoint}`;
    }

    // ChatGLM 的 apiHost 已包含完整路径 /api/paas/v4
    if (providerId === 'chatglm') {
        return `${apiHost}${endpoint}`;
    }

    // 检查 URL 是否已经包含版本路径
    const hasVersionPath = /\/v\d+|\/api\/v\d+|\/v\d+\/|\/api\/v\d+\/|\/paas\/v\d+/.test(apiHost);

    if (hasVersionPath) {
        return `${apiHost}${endpoint}`;
    } else {
        return `${apiHost}/v1${endpoint}`;
    }
}

/**
 * 获取提供商配置（包括自定义提供商）
 */
async function getProviderConfig(providerId) {
    // 内置提供商配置
    const builtinProviders = {
        google: {
            type: 'gemini',
            apiHost: 'https://generativelanguage.googleapis.com'
        },
        openai: {
            type: 'openai_compatible',
            apiHost: 'https://api.openai.com'
        },
        anthropic: {
            type: 'anthropic',
            apiHost: 'https://api.anthropic.com'
        },
        siliconflow: {
            type: 'openai_compatible',
            apiHost: 'https://api.siliconflow.cn'
        },
        openrouter: {
            type: 'openai_compatible',
            apiHost: 'https://openrouter.ai/api/v1'
        },
        deepseek: {
            type: 'openai_compatible',
            apiHost: 'https://api.deepseek.com'
        },
        chatglm: {
            type: 'openai_compatible',
            apiHost: 'https://open.bigmodel.cn/api/paas/v4'
        }
    };

    // 首先检查是否是内置提供商
    if (builtinProviders[providerId]) {
        return builtinProviders[providerId];
    }

    // 如果不是内置提供商，从存储中获取自定义提供商
    try {
        const result = await chrome.storage.sync.get(['customProviders']);
        if (result.customProviders && Array.isArray(result.customProviders)) {
            const customProvider = result.customProviders.find(provider => provider.id === providerId);
            if (customProvider) {
                return {
                    type: customProvider.type || 'openai_compatible',
                    apiHost: customProvider.apiHost
                };
            }
        }
    } catch (error) {
        console.error('[Background] Error loading custom providers:', error);
    }

    return null;
}

/**
 * 在background中直接调用API（支持流式）
 */
async function callAPIDirectlyWithStream(modelConfig, providerSettings, messages, options, streamCallback) {
    const { providerId, apiModelName, params } = modelConfig;
    const { apiKey } = providerSettings;

    // 获取供应商配置（包括自定义提供商）
    const provider = await getProviderConfig(providerId);
    if (!provider) {
        throw new Error(`Unsupported provider: ${providerId}`);
    }

    const apiHost = providerSettings.apiHost || provider.apiHost;

    // 根据供应商类型调用相应的API
    switch (provider.type) {
        case 'gemini':
            return await callGeminiAPIInBackgroundStream(apiHost, apiKey, apiModelName, messages, options, params, streamCallback);
        case 'openai_compatible':
            return await callOpenAICompatibleAPIInBackgroundStream(apiHost, apiKey, apiModelName, messages, options, providerId, streamCallback);
        case 'anthropic':
            return await callAnthropicAPIInBackgroundStream(apiHost, apiKey, apiModelName, messages, options, streamCallback);
        default:
            throw new Error(`Unsupported provider type: ${provider.type}`);
    }
}

// 已删除：handleGenerateContentRequest 函数
// 划词助手现在使用统一API接口，不再通过background.js处理API调用

// 移除 getPageContentForExtraction 函数，因为它不再被使用
// function getPageContentForExtraction() { ... } // REMOVED

/**
 * 实时同步机制 - 监听存储变化并广播到所有标签页
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        console.log('[Background] Storage changed:', changes);

        // 特殊处理代理地址变化
        if (changes.proxyAddress) {
            console.log('[Background] Proxy address changed, updating proxy settings');
            updateProxySettings();
        }

        // 获取所有标签页并广播变化
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                // 检查标签页是否支持content script
                if (tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
                    // 广播通用存储变化
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'storageChanged',
                        changes: changes,
                        namespace: namespace
                    }).catch(() => {
                        // 忽略没有content script的标签页
                    });

                    // 特殊处理语言变化
                    if (changes.language) {
                        console.log('[Background] Broadcasting language change to tab:', tab.id);
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'languageChanged',
                            newLanguage: changes.language.newValue,
                            oldLanguage: changes.language.oldValue
                        }).catch(() => {
                            // 忽略错误
                        });
                    }

                    // 特殊处理划词助手设置变化
                    if (changes.textSelectionHelperSettings) {
                        console.log('[Background] Broadcasting text selection helper settings change to tab:', tab.id);
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'textSelectionHelperSettingsChanged',
                            newSettings: changes.textSelectionHelperSettings.newValue,
                            oldSettings: changes.textSelectionHelperSettings.oldValue
                        }).catch(() => {
                            // 忽略错误
                        });
                    }
                }
            });
        });
    }
});

/**
 * 处理扩展更新/重载 - 通知所有标签页重新初始化
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('[Background] Extension startup - broadcasting to all tabs');
    // 初始化代理设置
    updateProxySettings();
    // 启动代理健康检查
    startProxyHealthCheck();
    setTimeout(broadcastExtensionReload, 1000);
});

// 当扩展重新安装或更新时也广播
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update' || details.reason === 'install') {
        console.log('[Background] Extension updated/installed - broadcasting to all tabs');
        setTimeout(broadcastExtensionReload, 1000); // 延迟一秒确保所有服务准备就绪
    }
});

/**
 * 广播扩展重载事件到所有标签页，并重新注入必要的脚本
 */
function broadcastExtensionReload() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
                // 首先尝试发送消息检查content script是否还活跃
                chrome.tabs.sendMessage(tab.id, {
                    action: 'ping'
                }).then(() => {
                    // Content script响应了，发送重载通知
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'extensionReloaded'
                    });
                }).catch(() => {
                    // Content script没有响应，需要重新注入
                    console.log('[Background] Content script not responding for tab', tab.id, 'reinject scripts');
                    reinjectScriptsToTab(tab.id);
                });
            }
        });
    });
}

/**
 * 重新注入所有必要的脚本到指定标签页
 */
async function reinjectScriptsToTab(tabId) {
    try {
        console.log('[Background] Reinjecting scripts to tab:', tabId);

        // 首先注入CSS文件
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['css/content-panel.css', 'css/text-selection-helper.css']
            });
            console.log('[Background] Successfully injected CSS files');
        } catch (error) {
            console.warn('[Background] Failed to inject CSS files:', error);
        }

        // 按顺序注入所有必要的脚本（与manifest.json中的顺序保持一致）
        const scriptsToInject = [
            'js/lib/Readability.js',
            'js/lib/markdown-it.min.js',
            'js/translations.js',
            'js/markdown-renderer.js',
            'js/text-selection-helper.js',
            'js/content.js'
        ];

        for (const script of scriptsToInject) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: [script]
                });
                console.log('[Background] Successfully injected:', script);

                // 在关键脚本之间添加小延迟，确保依赖关系正确
                if (script.includes('translations.js') || script.includes('markdown-renderer.js')) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.warn('[Background] Failed to inject script:', script, error);
                // 继续注入其他脚本，不要因为一个脚本失败就停止
            }
        }

        // 等待一小段时间确保脚本加载完成，然后发送重载通知
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
                action: 'extensionReloaded'
            }).catch(() => {
                console.warn('[Background] Failed to send extensionReloaded message after reinject');
            });
        }, 800); // 增加等待时间

    } catch (error) {
        console.error('[Background] Error reinjecting scripts to tab:', tabId, error);
    }
}

/**
 * 获取所有供应商的API域名
 * @returns {Array<string>} 域名列表
 */
function getAllApiDomains() {
    const domains = new Set();

    // 从内置供应商配置中提取域名
    const builtinProviders = {
        google: 'https://generativelanguage.googleapis.com',
        openai: 'https://api.openai.com',
        anthropic: 'https://api.anthropic.com',
        siliconflow: 'https://api.siliconflow.cn',
        openrouter: 'https://openrouter.ai/api/v1',
        deepseek: 'https://api.deepseek.com',
        chatglm: 'https://open.bigmodel.cn/api/paas/v4' // Fixed: Add ChatGLM domain.
    };

    // 添加内置供应商域名
    Object.values(builtinProviders).forEach(apiHost => {
        try {
            const url = new URL(apiHost);
            domains.add(url.hostname);
        } catch (error) {
            console.warn('[Background] Invalid API host:', apiHost);
        }
    });

    // 从存储中获取自定义供应商域名
    try {
        // 这里我们需要同步获取，但由于chrome.storage是异步的，
        // 我们将在调用此函数的地方处理异步逻辑
        if (window.customProviderDomains) {
            window.customProviderDomains.forEach(domain => domains.add(domain));
        }
    } catch (error) {
        console.warn('[Background] Error getting custom provider domains:', error);
    }

    const domainList = Array.from(domains);
    console.log('[Background] Collected API domains for proxy:', domainList);
    return domainList;
}

/**
 * 异步获取所有供应商的API域名（包括自定义供应商）
 * @returns {Promise<Array<string>>} 域名列表
 */
async function getAllApiDomainsAsync() {
    const domains = new Set();

    // 从内置供应商配置中提取域名
    const builtinProviders = {
        google: 'https://generativelanguage.googleapis.com',
        openai: 'https://api.openai.com',
        anthropic: 'https://api.anthropic.com',
        siliconflow: 'https://api.siliconflow.cn',
        openrouter: 'https://openrouter.ai/api/v1',
        deepseek: 'https://api.deepseek.com',
        chatglm: 'https://open.bigmodel.cn/api/paas/v4' // Fixed: Add ChatGLM domain.
    };

    // 添加内置供应商域名
    Object.values(builtinProviders).forEach(apiHost => {
        try {
            const url = new URL(apiHost);
            domains.add(url.hostname);
        } catch (error) {
            console.warn('[Background] Invalid API host:', apiHost);
        }
    });

    // 从存储中获取自定义供应商域名
    try {
        const result = await chrome.storage.sync.get(['customProviders']);
        if (result.customProviders && Array.isArray(result.customProviders)) {
            result.customProviders.forEach(provider => {
                if (provider.apiHost) {
                    try {
                        const url = new URL(provider.apiHost);
                        domains.add(url.hostname);
                    } catch (error) {
                        console.warn('[Background] Invalid custom provider API host:', provider.apiHost);
                    }
                }
            });
        }
    } catch (error) {
        console.warn('[Background] Error getting custom providers from storage:', error);
    }

    const domainList = Array.from(domains);
    console.log('[Background] Collected API domains for proxy (async):', domainList);
    return domainList;
}

/**
 * 生成PAC脚本数据
 * @param {Array<string>} domains - 需要代理的域名列表
 * @param {string} proxyHost - 代理主机
 * @param {string|number} proxyPort - 代理端口
 * @returns {string} PAC脚本内容
 */
function generatePacScript(domains, proxyHost, proxyPort) {
    const domainChecks = domains.map(domain => `host === "${domain}"`).join(' || ');

    return `function FindProxyForURL(url, host) {
    if (${domainChecks}) {
        return "PROXY ${proxyHost}:${proxyPort}";
    }
    return "DIRECT";
}`;
}

/**
 * 更新代理设置 - 使用选择性代理，支持所有AI供应商的API域名
 */
async function updateProxySettings() {
    try {
        // 从存储中获取代理地址
        const result = await chrome.storage.sync.get(['proxyAddress']);
        const proxyAddress = result.proxyAddress;

        if (!proxyAddress || proxyAddress.trim() === '') {
            // 清除代理设置
            console.log('[Background] Clearing proxy settings');
            await chrome.proxy.settings.clear({});
            console.log('[Background] Proxy settings cleared');
            // 停止健康检查
            stopProxyHealthCheck();

            // 等待代理清除完全生效
            await new Promise(resolve => setTimeout(resolve, 500));

            // 清理网络缓存以避免代理切换导致的缓存问题
            await clearNetworkCache();

            return;
        }

        // 解析代理地址
        let proxyUrl;
        try {
            proxyUrl = new URL(proxyAddress.trim());
        } catch (error) {
            console.error('[Background] Invalid proxy URL format:', proxyAddress, error);
            return;
        }

        // 获取所有需要代理的API域名
        const apiDomains = await getAllApiDomainsAsync();

        // 构建选择性代理配置 - 支持所有AI供应商的API域名
        const proxyPort = proxyUrl.port || getDefaultPort(proxyUrl.protocol);
        const pacScriptData = generatePacScript(apiDomains, proxyUrl.hostname, proxyPort);

        const proxyConfig = {
            mode: "pac_script",
            pacScript: {
                data: pacScriptData
            }
        };

        // 验证协议支持
        const supportedSchemes = ['http', 'https', 'socks4', 'socks5'];
        const proxyScheme = proxyUrl.protocol.slice(0, -1);
        if (!supportedSchemes.includes(proxyScheme)) {
            console.error('[Background] Unsupported proxy scheme:', proxyScheme);
            return;
        }

        // 应用代理设置
        console.log('[Background] Applying selective proxy settings for all AI API domains:', proxyAddress);
        console.log('[Background] Proxy will be applied to domains:', apiDomains);
        await chrome.proxy.settings.set({
            value: proxyConfig,
            scope: 'regular'
        });
        console.log('[Background] Selective proxy settings applied successfully');

        // 等待代理设置完全生效
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 清理网络缓存以避免代理切换导致的缓存问题
        await clearNetworkCache();

        // 启动健康检查
        startProxyHealthCheck();

    } catch (error) {
        console.error('[Background] Error updating proxy settings:', error);
    }
}

/**
 * 获取协议的默认端口
 */
function getDefaultPort(protocol) {
    switch (protocol) {
        case 'http:':
            return 80;
        case 'https:':
            return 443;
        case 'socks4:':
        case 'socks5:':
            return 1080;
        default:
            return 8080;
    }
}

/**
 * 清理网络缓存以避免代理切换导致的缓存问题
 */
async function clearNetworkCache() {
    try {
        console.log('[Background] Clearing network cache to avoid proxy switching issues');

        // 清理浏览器缓存（包括 DNS 缓存）
        if (chrome.browsingData) {
            await chrome.browsingData.remove({
                "since": Date.now() - 60000 // 清理最近1分钟的缓存
            }, {
                "cache": true,
                "cacheStorage": true,
                "webSQL": false,
                "indexedDB": false,
                "localStorage": false,
                "sessionStorage": false,
                "cookies": false,
                "downloads": false,
                "formData": false,
                "history": false,
                "passwords": false
            });
            console.log('[Background] Network cache cleared successfully');
        }
    } catch (error) {
        console.warn('[Background] Failed to clear network cache:', error);
        // 不抛出错误，因为这不是关键功能
    }
}

/**
 * 检查URL是否为AI API请求
 * @param {string} url - 请求URL
 * @returns {boolean} 是否为AI API请求
 */
function isAIApiRequest(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // 检查是否匹配已知的AI API域名
        const aiApiDomains = [
            'generativelanguage.googleapis.com',  // Google Gemini
            'api.openai.com',                     // OpenAI
            'api.anthropic.com',                  // Anthropic Claude
            'api.siliconflow.cn',                 // SiliconFlow
            'openrouter.ai',                      // OpenRouter
            'api.deepseek.com',                   // DeepSeek
            'open.bigmodel.cn'                    // ChatGLM
        ];

        return aiApiDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch (error) {
        console.warn('[Background] Error parsing URL for AI API check:', url, error);
        return false;
    }
}

/**
 * 代理请求函数 - 简化版本，依赖 PAC 脚本进行选择性代理
 */
async function makeProxyRequest(url, options = {}, proxyAddress = '') {
    // 如果没有配置代理，直接使用fetch
    if (!proxyAddress || proxyAddress.trim() === '') {
        console.log('[Background] No proxy configured, using direct fetch');
        return fetch(url, options);
    }

    // 检查是否为 AI API 请求
    const isAIAPI = isAIApiRequest(url);

    if (isAIAPI) {
        console.log('[Background] AI API request detected, using configured proxy via PAC script:', url);
    } else {
        console.log('[Background] Non-AI API request, will use direct connection via PAC script:', url);
    }

    // 直接使用 fetch，让 PAC 脚本决定是否使用代理
    return fetch(url, options);
}



/**
 * 通用的API请求函数，支持代理
 */
async function makeApiRequest(url, options = {}) {
    try {
        // 获取代理设置
        const result = await chrome.storage.sync.get(['proxyAddress']);
        const proxyAddress = result.proxyAddress;

        return await makeProxyRequest(url, options, proxyAddress);
    } catch (error) {
        console.error('[Background] Error in makeApiRequest:', error);
        throw error;
    }
}

/**
 * 处理来自content script的代理请求
 */
async function handleFetchWithProxyRequest(url, options = {}, sendResponse) {
    try {
        // 获取代理设置
        const result = await chrome.storage.sync.get(['proxyAddress']);
        const proxyAddress = result.proxyAddress;

        console.log('[Background] Handling fetch with proxy request for:', url);

        // 使用代理请求
        const response = await makeProxyRequest(url, options, proxyAddress);

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        // 将响应转换为base64（用于传输二进制数据）
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = String.fromCharCode.apply(null, uint8Array);
        const base64Data = btoa(binaryString);

        sendResponse({
            success: true,
            data: base64Data,
            status: response.status,
            statusText: response.statusText
        });

    } catch (error) {
        console.error('[Background] Error in handleFetchWithProxyRequest:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * 处理代理测试请求
 */
async function handleProxyTestRequest(proxyAddress, sendResponse) {
    try {
        console.log('[Background] Testing proxy:', proxyAddress);

        // 临时设置代理进行测试
        let originalProxyConfig = null;

        try {
            // 获取当前代理设置
            const currentSettings = await chrome.proxy.settings.get({});
            originalProxyConfig = currentSettings.value;

            // 解析代理地址
            const proxyUrl = new URL(proxyAddress.trim());
            const proxyPort = proxyUrl.port || getDefaultPort(proxyUrl.protocol);

            // 获取所有需要代理的API域名
            const apiDomains = await getAllApiDomainsAsync();

            // 构建测试代理配置 - 支持所有AI供应商的API域名
            const testPacScriptData = generatePacScript(apiDomains, proxyUrl.hostname, proxyPort);

            const testProxyConfig = {
                mode: "pac_script",
                pacScript: {
                    data: testPacScriptData
                }
            };

            // 应用测试代理设置
            await chrome.proxy.settings.set({
                value: testProxyConfig,
                scope: 'regular'
            });

            console.log('[Background] Applied test proxy config for domains:', apiDomains);

            // 等待代理设置生效
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 测试多个AI API端点以验证代理连接
            const testEndpoints = [
                'https://generativelanguage.googleapis.com/',  // Google Gemini
                'https://api.openai.com/',                     // OpenAI
                'https://api.anthropic.com/'                   // Anthropic
            ];

            let successCount = 0;
            let lastError = null;

            for (const testUrl of testEndpoints) {
                try {
                    console.log('[Background] Testing proxy with endpoint:', testUrl);
                    const response = await fetch(testUrl, {
                        method: 'GET',
                        signal: AbortSignal.timeout(8000),
                        cache: 'no-cache'
                    });

                    // 检查响应状态（401/403/404都表示代理连接成功，只是没有认证）
                    if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
                        successCount++;
                        console.log(`[Background] Proxy test successful for ${testUrl}, status:`, response.status);
                        break; // 只要有一个成功就足够了
                    } else {
                        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } catch (error) {
                    lastError = error;
                    console.warn(`[Background] Proxy test failed for ${testUrl}:`, error.message);
                }
            }

            if (successCount > 0) {
                sendResponse({
                    success: true,
                    message: `Proxy connection successful (tested ${successCount} endpoint${successCount > 1 ? 's' : ''})`
                });
            } else {
                throw lastError || new Error('All proxy tests failed');
            }

        } finally {
            // 恢复原始代理设置
            try {
                if (originalProxyConfig && originalProxyConfig.mode !== 'direct') {
                    await chrome.proxy.settings.set({
                        value: originalProxyConfig,
                        scope: 'regular'
                    });
                } else {
                    await chrome.proxy.settings.clear({});
                }
                console.log('[Background] Restored original proxy settings after test');
            } catch (restoreError) {
                console.error('[Background] Error restoring proxy settings:', restoreError);
            }
        }

    } catch (error) {
        console.error('[Background] Proxy test failed:', error);
        sendResponse({
            success: false,
            error: error.message || 'Proxy test failed'
        });
    }
}

// 代理健康检查相关变量
let proxyHealthCheckInterval = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 2; // 连续失败2次后清除代理
const HEALTH_CHECK_INTERVAL = 5000; // 5秒检查一次
const HEALTH_CHECK_TIMEOUT = 5000; // 5秒超时

/**
 * 启动代理健康检查
 */
function startProxyHealthCheck() {
    // 清除现有的检查
    if (proxyHealthCheckInterval) {
        clearInterval(proxyHealthCheckInterval);
    }

    console.log('[Background] Starting proxy health check');

    // 立即执行一次检查
    checkProxyHealth();

    // 设置定期检查
    proxyHealthCheckInterval = setInterval(checkProxyHealth, HEALTH_CHECK_INTERVAL);
}

/**
 * 停止代理健康检查
 */
function stopProxyHealthCheck() {
    if (proxyHealthCheckInterval) {
        clearInterval(proxyHealthCheckInterval);
        proxyHealthCheckInterval = null;
        consecutiveFailures = 0;
        console.log('[Background] Stopped proxy health check');
    }
}

/**
 * 检查代理健康状态 - 使用当前代理设置测试AI API端点
 */
async function checkProxyHealth() {
    try {
        // 获取当前代理设置
        const result = await chrome.storage.sync.get(['proxyAddress']);
        const proxyAddress = result.proxyAddress;

        // 如果没有设置代理，停止健康检查
        if (!proxyAddress || proxyAddress.trim() === '') {
            stopProxyHealthCheck();
            return;
        }

        console.log('[Background] Checking proxy health for:', proxyAddress);

        // 使用多个AI API端点进行健康检查，提高可靠性
        const healthCheckEndpoints = [
            'https://generativelanguage.googleapis.com/',  // Google Gemini
            'https://api.openai.com/',                     // OpenAI
            'https://api.anthropic.com/'                   // Anthropic
        ];

        let healthCheckPassed = false;

        for (const testUrl of healthCheckEndpoints) {
            try {
                // 直接使用当前的代理设置进行健康检查
                const response = await fetch(testUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
                    cache: 'no-cache'
                });

                if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
                    // 代理工作正常
                    healthCheckPassed = true;
                    console.log(`[Background] Proxy health check passed for ${testUrl}, status:`, response.status);
                    break; // 只要有一个端点成功就认为代理正常
                }
            } catch (fetchError) {
                // 继续尝试下一个端点
                console.warn(`[Background] Health check failed for ${testUrl}:`, fetchError.message);
            }
        }

        if (healthCheckPassed) {
            // 代理工作正常
            if (consecutiveFailures > 0) {
                console.log('[Background] Proxy recovered, resetting failure count');
                consecutiveFailures = 0;
            }
        } else {
            // 所有端点都失败
            consecutiveFailures++;
            console.warn(`[Background] Proxy health check failed for all endpoints (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);

            // 如果连续失败次数达到阈值，自动清除代理
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.error('[Background] Proxy appears to be dead after 2 consecutive failures, automatically clearing proxy settings');
                await clearProxyDueToFailure(proxyAddress);
            }
        }

    } catch (error) {
        console.error('[Background] Error during proxy health check:', error);
    }
}

/**
 * 由于代理失败而清除代理设置
 */
async function clearProxyDueToFailure(failedProxyAddress) {
    try {
        // 清除Chrome代理设置
        await chrome.proxy.settings.clear({});
        console.log('[Background] Cleared Chrome proxy settings due to failure');

        // 清除存储中的代理设置
        await chrome.storage.sync.remove('proxyAddress');
        console.log('[Background] Cleared stored proxy address due to failure');

        // 停止健康检查
        stopProxyHealthCheck();

        // 通知所有标签页代理已被自动清除
        notifyProxyAutoCleared(failedProxyAddress);

    } catch (error) {
        console.error('[Background] Error clearing proxy due to failure:', error);
    }
}

/**
 * 通知用户代理已被自动清除
 */
function notifyProxyAutoCleared(failedProxyAddress) {
    // 向所有标签页发送通知
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'proxyAutoCleared',
                    failedProxy: failedProxyAddress
                }).catch(() => {
                    // 忽略发送失败的标签页
                });
            }
        });
    });
}

/**
 * 在background中直接调用OpenAI兼容API（支持流式）
 */
async function callOpenAICompatibleAPIInBackgroundStream(apiHost, apiKey, modelName, messages, options, providerId, streamCallback) {
    const requestBody = {
        model: modelName,
        messages: messages,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.95,
        stream: true // 启用流式输出
    };

    if (options.maxTokens && parseInt(options.maxTokens) > 0) {
        requestBody.max_tokens = parseInt(options.maxTokens);
    }

    const headers = {
        'Content-Type': 'application/json'
    };

    // 根据供应商设置认证方式
    if (providerId === 'chatglm') {
        // ChatGLM 使用直接的 API key 认证，不需要 Bearer 前缀
        headers['Authorization'] = apiKey;
    } else {
        // 其他供应商使用标准的 Bearer 认证
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // OpenRouter特殊请求头
    if (providerId === 'openrouter') {
        headers['HTTP-Referer'] = 'https://pagetalk.extension';
        headers['X-Title'] = 'PageTalk Browser Extension';
    }

    // 智能构建端点URL
    const endpoint = formatApiUrl(apiHost, providerId, '/chat/completions');
    console.log('[Background] Calling OpenAI-compatible API with streaming:', endpoint);

    const response = await makeApiRequest(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    // 处理流式响应
    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        streamCallback('', true);
                        return fullResponse;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            streamCallback(content, false);
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    streamCallback('', true);
    return fullResponse;
}

/**
 * 在background中直接调用Gemini API（支持流式）
 */
async function callGeminiAPIInBackgroundStream(apiHost, apiKey, modelName, messages, options, params, streamCallback) {
    // 转换消息格式
    const geminiMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const requestBody = {
        contents: geminiMessages,
        generationConfig: {
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.95,
            ...(params?.generationConfig || {})
        }
    };

    if (options.maxTokens && parseInt(options.maxTokens) > 0) {
        requestBody.generationConfig.maxOutputTokens = parseInt(options.maxTokens);
    }

    const endpoint = `${apiHost}/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
    console.log('[Background] Calling Gemini API with streaming:', endpoint);

    const response = await makeApiRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    // 处理流式响应
    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (content) {
                            fullResponse += content;
                            streamCallback(content, false);
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    streamCallback('', true);
    return fullResponse;
}

/**
 * 在background中直接调用Anthropic API（支持流式）
 */
async function callAnthropicAPIInBackgroundStream(apiHost, apiKey, modelName, messages, options, streamCallback) {
    // 分离系统消息和用户消息
    const systemMessage = messages.find(msg => msg.role === 'system');
    const userMessages = messages.filter(msg => msg.role !== 'system');

    const requestBody = {
        model: modelName,
        messages: userMessages,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.95,
        stream: true
    };

    if (systemMessage) {
        requestBody.system = systemMessage.content;
    }

    if (options.maxTokens && parseInt(options.maxTokens) > 0) {
        requestBody.max_tokens = parseInt(options.maxTokens);
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };

    const endpoint = `${apiHost}/v1/messages`;
    console.log('[Background] Calling Anthropic API with streaming:', endpoint);

    const response = await makeApiRequest(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    // 处理流式响应
    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        streamCallback('', true);
                        return fullResponse;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === 'content_block_delta') {
                            const content = parsed.delta?.text || '';
                            if (content) {
                                fullResponse += content;
                                streamCallback(content, false);
                            }
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    streamCallback('', true);
    return fullResponse;
}