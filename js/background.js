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
    // 处理来自划词助手的 generateContent 请求
    else if (message.action === "generateContent") {
        handleGenerateContentRequest(message.data, sendResponse, sender.tab?.id);
        return true; // 异步响应
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
    // 如果有其他同步消息处理，它们可以在这里返回 false 或 undefined
    // 但如果整个 onMessage 可能处理异步操作，最好总是返回 true
    return true;
});

/**
 * 处理来自划词助手的 generateContent 请求
 */
async function handleGenerateContentRequest(requestData, sendResponse, senderTabId) {
    try {
        // 从存储中获取 API Key 和代理设置
        const result = await chrome.storage.sync.get(['apiKey', 'proxyAddress']);
        const apiKey = result.apiKey;
        const proxyAddress = result.proxyAddress;

        if (!apiKey) {
            sendResponse({ success: false, error: 'API Key not configured. Please set it in Pagetalk options.' });
            return;
        }

        // 获取模型名称，映射逻辑模型名到实际 API 模型名
        let apiModelName = requestData.model || 'gemini-2.5-flash';
        if (apiModelName === 'gemini-2.5-flash' || apiModelName === 'gemini-2.5-flash-thinking') {
            apiModelName = 'gemini-2.5-flash';
        } else if (apiModelName === 'gemini-2.5-pro') {
            apiModelName = 'gemini-2.5-pro';
        }

        // 构建请求体
        const requestBody = {
            contents: requestData.contents,
            generationConfig: requestData.generationConfig
        };

        // 构建API URL
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

        // 调用 Gemini API (流式输出) - 使用代理请求函数
        const response = await makeProxyRequest(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }, proxyAddress);

        if (response.ok) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonData = JSON.parse(line.slice(6));
                                const text = jsonData.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    accumulatedText += text;
                                    // 直接发送到指定标签页，避免查询延迟
                                    if (senderTabId) {
                                        chrome.tabs.sendMessage(senderTabId, {
                                            action: 'streamUpdate',
                                            requestId: requestData.requestId,
                                            text: accumulatedText,
                                            isComplete: false
                                        }).catch(() => {
                                            // 忽略发送失败的错误
                                        });
                                    }
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                }

                // 发送完成信号
                if (senderTabId) {
                    chrome.tabs.sendMessage(senderTabId, {
                        action: 'streamUpdate',
                        requestId: requestData.requestId,
                        text: accumulatedText,
                        isComplete: true
                    }).catch(() => {
                        // 忽略发送失败的错误
                    });
                }

                sendResponse({ success: true, data: accumulatedText });
            } catch (streamError) {
                sendResponse({ success: false, error: streamError.message });
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}` } }));
            const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
            sendResponse({ success: false, error: errorMessage });
        }
    } catch (error) {
        console.error('[Background] Generate content error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

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
 * 更新代理设置 - 使用选择性代理，只对 Gemini API 域名使用代理
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

        // 构建选择性代理配置 - 只对 Gemini API 使用代理
        const proxyPort = proxyUrl.port || getDefaultPort(proxyUrl.protocol);
        const pacScriptData = 'function FindProxyForURL(url, host) {\n' +
            '    if (host === "generativelanguage.googleapis.com") {\n' +
            '        return "PROXY ' + proxyUrl.hostname + ':' + proxyPort + '";\n' +
            '    }\n' +
            '    return "DIRECT";\n' +
            '}';

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
        console.log('[Background] Applying selective proxy settings for Gemini API only:', proxyAddress);
        await chrome.proxy.settings.set({
            value: proxyConfig,
            scope: 'regular'
        });
        console.log('[Background] Selective proxy settings applied successfully');

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
 * 代理请求函数 - 简化版本，依赖 PAC 脚本进行选择性代理
 */
async function makeProxyRequest(url, options = {}, proxyAddress = '') {
    // 如果没有配置代理，直接使用fetch
    if (!proxyAddress || proxyAddress.trim() === '') {
        console.log('[Background] No proxy configured, using direct fetch');
        return fetch(url, options);
    }

    // 检查是否为 Gemini API 请求
    const isGeminiAPI = url.includes('generativelanguage.googleapis.com');

    if (isGeminiAPI) {
        console.log('[Background] Gemini API request, using configured proxy via PAC script');
    } else {
        console.log('[Background] Non-Gemini API request, will use direct connection via PAC script');
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

            // 构建测试代理配置 - 只对 Gemini API 使用代理
            const testPacScriptData = 'function FindProxyForURL(url, host) {\n' +
                '    if (host === "generativelanguage.googleapis.com") {\n' +
                '        return "PROXY ' + proxyUrl.hostname + ':' + proxyPort + '";\n' +
                '    }\n' +
                '    return "DIRECT";\n' +
                '}';

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

            console.log('[Background] Applied test proxy config');

            // 等待代理设置生效
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 使用 Gemini API 端点进行测试（不需要 API key 的端点）
            const testUrl = 'https://generativelanguage.googleapis.com/';
            const response = await fetch(testUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(10000),
                cache: 'no-cache'
            });

            // 检查响应状态
            if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
                // 代理工作正常
                console.log('[Background] Proxy test successful, status:', response.status);
                sendResponse({
                    success: true,
                    message: `Proxy connection successful (HTTP ${response.status})`
                });
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
 * 检查代理健康状态 - 使用当前代理设置测试 Gemini API
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

        // 使用 Gemini API 的健康检查端点
        const testUrl = 'https://generativelanguage.googleapis.com/';

        try {
            // 直接使用当前的代理设置进行健康检查
            const response = await fetch(testUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
                cache: 'no-cache'
            });

            if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
                // 代理工作正常
                if (consecutiveFailures > 0) {
                    console.log('[Background] Proxy recovered, resetting failure count');
                    consecutiveFailures = 0;
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (fetchError) {
            consecutiveFailures++;
            console.warn(`[Background] Proxy health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, fetchError.message);

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