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
            await chrome.tabs.sendMessage(tabId, { action: "togglePanel" });
        } catch (error) {
            // console.warn('初次 sendMessage 失败，尝试注入脚本:', error); // 改为 warn 或 debug

            // 如果出错可能是因为content script还未加载，尝试注入脚本
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['js/content.js']
                });

                // 再次尝试发送消息
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tabId, { action: "togglePanel" });
                    } catch (e) {
                        console.error('重试切换面板失败:', e);
                    }
                }, 100); // 注入后稍作等待
            } catch (e) {
                // 理论上，因为前面的URL检查，这里不应该再捕捉到 'Cannot access a chrome:// URL' 错误了
                // 如果还出错，可能是其他注入问题
                console.error('注入脚本失败 (非URL访问权限问题):', e);
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
    // 如果有其他同步消息处理，它们可以在这里返回 false 或 undefined
    // 但如果整个 onMessage 可能处理异步操作，最好总是返回 true
    return true;
});

/**
 * 处理来自划词助手的 generateContent 请求
 */
async function handleGenerateContentRequest(requestData, sendResponse, senderTabId) {
    try {
        // 从存储中获取 API Key
        const result = await chrome.storage.sync.get(['apiKey']);
        const apiKey = result.apiKey;

        if (!apiKey) {
            sendResponse({ success: false, error: 'API Key not configured' });
            return;
        }

        // 获取模型名称，映射逻辑模型名到实际 API 模型名
        let apiModelName = requestData.model || 'gemini-2.5-flash';
        if (apiModelName === 'gemini-2.5-flash' || apiModelName === 'gemini-2.5-flash-thinking') {
            apiModelName = 'gemini-2.5-flash-preview-05-20';
        }

        // 构建请求体
        const requestBody = {
            contents: requestData.contents,
            generationConfig: requestData.generationConfig
        };

        // 调用 Gemini API (流式输出)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:streamGenerateContent?key=${apiKey}&alt=sse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

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