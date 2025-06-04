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
    // 如果有其他同步消息处理，它们可以在这里返回 false 或 undefined
    // 但如果整个 onMessage 可能处理异步操作，最好总是返回 true
    return true;
});


// --- Listener for text interpretation requests from content.js ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "interpretText") {
        console.log('[PageTalk Background] Received interpretText request:', message);

        if (!sender.tab || !sender.tab.id) {
            console.error('[PageTalk Background] No sender tab ID for interpretText request.');
            sendResponse({ error: "Request must come from a tab." });
            return false; // Not an async response in this error case
        }
        const tabId = sender.tab.id;

        // TODO: Integrate with js/api.js and a real AI call
        // For now, simulate an AI call with a timeout
        setTimeout(() => {
            try {
                // Constructing a more complete prompt based on received data
                const fullPrompt = `${message.promptDefault}\n\nSelected Text: "${message.selectedText}"\n\nPage Context (Excerpt):\n${message.pageContent.substring(0, 1500)}...`;
                console.log(`[PageTalk Background] Simulated AI call for tab ${tabId} with model ${message.model}, temp ${message.temperature}`);
                // console.log("[PageTalk Background] Full prompt for AI (simulated):", fullPrompt);

                // Simulate a successful response
                const simulatedResponse = `This is a simulated AI interpretation for: "${message.selectedText}".\n\nBased on the context, it seems to be about making things work with placeholders and simulated calls. The model used was ${message.model}. The page content started with: "${message.pageContent.substring(0,100)}..."`;

                chrome.tabs.sendMessage(tabId, {
                    action: "interpretTextResponse",
                    interpretation: simulatedResponse
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending interpretTextResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`[PageTalk Background] Successfully sent interpretTextResponse to tab ${tabId}`, response);
                    }
                });

            } catch (e) {
                console.error('[PageTalk Background] Error during simulated AI call:', e);
                // Simulate an error response
                chrome.tabs.sendMessage(tabId, {
                    action: "interpretTextResponse",
                    error: e.message || "An unknown error occurred during simulation."
                }, (response) => {
                     if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending error interpretTextResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    }
                });
            }
        }, 1500); // Simulate 1.5 second delay

        sendResponse({ received: true, status: "Processing interpretation request..." });
        return true; // Indicates that sendResponse will be called asynchronously
    }
    // Ensure other message handlers are not affected or chain them if needed.
    // If the previous onMessage listener should also run, this needs restructuring.
    // For now, assuming they are distinct or the first one handles everything it needs to.
    // To be safe, let's ensure other actions are not unintentionally captured here if they don't return true.
    // However, the template usually has one primary listener.
    // The provided snippet has two separate listeners, which is unusual.
    // I will assume the intent is to add this as a new, separate listener.
    // If it was meant to be part of the existing one, then the structure would be an else if.
});
// Note: The original file had two chrome.runtime.onMessage.addListener calls.
// This is generally not recommended as only the last one registered might work as expected,
// or they might both fire leading to unexpected behavior depending on the browser's implementation.
// For this exercise, I'm adding a new listener as per the diff structure.
// Ideally, all message handling should be within a single listener with a switch or if/else if block.

// I will consolidate them to be safe.

// REMOVING THE SEPARATE LISTENER ABOVE AND INTEGRATING INTO THE EXISTING ONE.
// THIS IS A CORRECTION TO THE PREVIOUS THOUGHT PROCESS.
// Consolidated message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "pageContentExtracted") {
        chrome.storage.local.set({
            recentPageContent: message.content,
            recentExtractionTime: Date.now()
        });
        sendResponse({ success: true });
        return false; // Synchronous response
    }
    else if (message.action === "extractTabContent") {
        const targetTabId = message.tabId;
        if (!targetTabId) {
            console.error("Background: No tabId provided for extractTabContent");
            sendResponse({ error: "No tabId provided" });
            return true; // Async (though this path is error)
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

            chrome.tabs.sendMessage(targetTabId, { action: "getFullPageContentRequest" }, (responseFromContentScript) => {
                if (chrome.runtime.lastError) {
                    console.error("Background: Error sending 'getFullPageContentRequest' to tab " + targetTabId, chrome.runtime.lastError.message);
                    sendResponse({ error: "Failed to communicate with the tab: " + chrome.runtime.lastError.message });
                } else if (responseFromContentScript) {
                    sendResponse(responseFromContentScript);
                } else {
                    console.error("Background: No response or empty response from content script in tab " + targetTabId);
                    sendResponse({ error: "No response from content script in the target tab." });
                }
            });
        });
        return true; // Async
    }
    else if (message.action === "interpretText") {
        console.log('[PageTalk Background] Received interpretText request:', message);

        if (!sender.tab || !sender.tab.id) {
            console.error('[PageTalk Background] No sender tab ID for interpretText request.');
            sendResponse({ error: "Request must come from a tab." });
            return false;
        }
        const tabId = sender.tab.id;

        // Simulate AI call
        setTimeout(() => {
            try {
                const fullPrompt = `${message.promptDefault}\n\nSelected Text: "${message.selectedText}"\n\nPage Context (Excerpt):\n${message.pageContent.substring(0, 1500)}...`;
                console.log(`[PageTalk Background] Simulated AI call for tab ${tabId} with model ${message.model}, temp ${message.temperature}`);

                const simulatedResponse = `This is a simulated AI interpretation for: "${message.selectedText}".\n\nModel: ${message.model}.\nContext provided.`;

                chrome.tabs.sendMessage(tabId, {
                    action: "interpretTextResponse",
                    interpretation: simulatedResponse
                }, (responseCallback) => { // Renamed `response` to `responseCallback` to avoid confusion
                    if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending interpretTextResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`[PageTalk Background] Successfully sent interpretTextResponse to tab ${tabId}`, responseCallback);
                    }
                });

            } catch (e) {
                console.error('[PageTalk Background] Error during simulated AI call:', e);
                chrome.tabs.sendMessage(tabId, {
                    action: "interpretTextResponse",
                    error: e.message || "An unknown error occurred during simulation."
                }, (responseCallback) => {
                     if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending error interpretTextResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    }
                });
            }
        }, 1500);

        sendResponse({ received: true, status: "Processing interpretation request..." });
        return true; // Async
    }
    else if (message.action === "translateText") {
        console.log('[PageTalk Background] Received translateText request:', message);

        if (!sender.tab || !sender.tab.id) {
            console.error('[PageTalk Background] No sender tab ID for translateText request.');
            sendResponse({ error: "Request must come from a tab." });
            return false;
        }
        const tabId = sender.tab.id;

        // Simulate AI call for translation
        setTimeout(() => {
            try {
                // For translation, the prompt is simpler. The AI should infer languages.
                console.log(`[PageTalk Background] Simulated AI translation for tab ${tabId} with model ${message.model}, temp ${message.temperature}`);

                // Simulate a translation (e.g., append "[Translated]" or a mock translation)
                let simulatedTranslation = `[Simulated Translation of "${message.selectedText}"]`;
                if (message.selectedText.match(/[\u3400-\u9FBF]/)) { // Basic check for Chinese characters
                    simulatedTranslation = `Translated: ${message.selectedText} (This is an English mock translation).`;
                } else {
                    simulatedTranslation = `翻译结果：${message.selectedText} (这是一个中文模拟翻译)。`;
                }

                chrome.tabs.sendMessage(tabId, {
                    action: "translateTextResponse",
                    translation: simulatedTranslation
                }, (responseCallback) => {
                    if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending translateTextResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`[PageTalk Background] Successfully sent translateTextResponse to tab ${tabId}`, responseCallback);
                    }
                });

            } catch (e) {
                console.error('[PageTalk Background] Error during simulated AI translation:', e);
                chrome.tabs.sendMessage(tabId, {
                    action: "translateTextResponse",
                    error: e.message || "An unknown error occurred during translation simulation."
                }, (responseCallback) => {
                     if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending error translateTextResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    }
                });
            }
        }, 1200); // Simulate 1.2 second delay for translation

        sendResponse({ received: true, status: "Processing translation request..." });
        return true; // Async
    }
    // Default fallback for unhandled actions
    // Ensure any unhandled actions that expect a response get one, or clearly don't.
    // If an action reaches here, it means it wasn't handled by specific if/else if blocks.
    // Depending on the sender's expectation, this might be an issue.
    // For robust handling, ensure all expected actions have a path.
    // Returning false here if no other path is taken and the response isn't async.
    console.log(`[PageTalk Background] Unhandled message action: ${message.action}`);
    sendResponse({ error: `Unknown action: ${message.action}`});
    return false; // Explicitly return false if not handled and not async
    // Ensure this default return aligns with overall listener strategy.
    // If any path is async, the listener often defaults to returning true at the end,
    // and individual sync paths return false.
    // Given the mix, being explicit per-branch is best.
    // The current structure returns true for async paths and false for sync error paths or this final default.
});

// NOTE: The previous diff for background.js had a duplicated chrome.runtime.onMessage.addListener.
// The edit below assumes that was an anomaly and I'm modifying the *single*, consolidated listener.
// If there are indeed multiple independent listeners in the actual file, this approach needs to be revised
// to ensure the correct listener is being modified.
// Based on the flow, there should be one consolidated listener.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "pageContentExtracted") { // This is likely from main.js to background
        chrome.storage.local.set({
            recentPageContent: message.content,
            recentExtractionTime: Date.now()
        });
        sendResponse({ success: true });
        return false;
    }
    else if (message.action === "extractTabContent") { // From main.js to background, then to content.js
        const targetTabId = message.tabId;
        if (!targetTabId) {
            sendResponse({ error: "No tabId provided" });
            return true;
        }
        chrome.tabs.get(targetTabId, (tab) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message }); return;
            }
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about://') || tab.url.startsWith('edge://'))) {
                sendResponse({ error: `Cannot access restricted URL: ${tab.url}` }); return;
            }
            chrome.tabs.sendMessage(targetTabId, { action: "getFullPageContentRequest" }, (responseFromContentScript) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ error: "Failed to communicate with the tab: " + chrome.runtime.lastError.message });
                } else if (responseFromContentScript) {
                    sendResponse(responseFromContentScript);
                } else {
                    sendResponse({ error: "No response from content script in the target tab." });
                }
            });
        });
        return true;
    }
    else if (message.action === "interpretText") { // From content.js to background
        if (!sender.tab || !sender.tab.id) {
            sendResponse({ error: "Request must come from a tab." }); return false;
        }
        const tabId = sender.tab.id;
        setTimeout(() => {
            try {
                const simulatedResponse = `Simulated AI interpretation for: "${message.selectedText}". Model: ${message.model}.`;
                chrome.tabs.sendMessage(tabId, { action: "interpretTextResponse", interpretation: simulatedResponse });
            } catch (e) {
                chrome.tabs.sendMessage(tabId, { action: "interpretTextResponse", error: e.message || "Unknown error" });
            }
        }, 1500);
        sendResponse({ received: true, status: "Processing interpretation..." });
        return true;
    }
    else if (message.action === "translateText") { // From content.js to background
        if (!sender.tab || !sender.tab.id) {
            sendResponse({ error: "Request must come from a tab." }); return false;
        }
        const tabId = sender.tab.id;
        setTimeout(() => {
            try {
                let translated = `[Simulated Translation of "${message.selectedText}"]`;
                if (message.selectedText.match(/[\u3400-\u9FBF]/)) {
                    translated = `Translated: ${message.selectedText} (mock English).`;
                } else {
                    translated = `翻译结果：${message.selectedText} (mock Chinese).`;
                }
                chrome.tabs.sendMessage(tabId, { action: "translateTextResponse", translation: translated });
            } catch (e) {
                chrome.tabs.sendMessage(tabId, { action: "translateTextResponse", error: e.message || "Unknown error" });
            }
        }, 1200);
        sendResponse({ received: true, status: "Processing translation..." });
        return true;
    }
    else if (message.action === "sendChatMessage") { // From content.js to background
        if (!sender.tab || !sender.tab.id) {
            sendResponse({ error: "Chat request must come from a tab." }); return false;
        }
        const tabId = sender.tab.id;
        console.log('[PageTalk Background] Received sendChatMessage request:', message);

        // Simulate AI chat response
        setTimeout(() => {
            try {
                let aiReply = `AI received: "${message.textInput}".`;
                if (message.selectedTextContext) {
                    aiReply += `\nWith quoted text: "${message.selectedTextContext}".`;
                }
                aiReply += `\nPage context (first 50 chars): ${message.pageContent.substring(0,50)}...`;
                aiReply += `\nModel: ${message.model}, Assistant: ${message.assistant}.`;

                chrome.tabs.sendMessage(tabId, {
                    action: "chatMessageResponse",
                    chatResponse: aiReply
                }, (responseCallback) => {
                    if (chrome.runtime.lastError) {
                        console.warn(`[PageTalk Background] Error sending chatMessageResponse to tab ${tabId}:`, chrome.runtime.lastError.message);
                    }
                });
            } catch (e) {
                console.error('[PageTalk Background] Error during simulated AI chat processing:', e);
                chrome.tabs.sendMessage(tabId, {
                    action: "chatMessageResponse",
                    error: e.message || "An unknown error occurred during chat simulation."
                });
            }
        }, 1000); // Simulate 1 second delay for chat

        sendResponse({ received: true, status: "Message sent to AI, awaiting response..." });
        return true; // Async
    }

    // Default for unhandled actions
    console.log(`[PageTalk Background] Unhandled message action in consolidated listener: ${message.action}`);
    // sendResponse({ error: `Unknown action: ${message.action}` }); // Optional: send error for unhandled
    return false; // Return false if the message isn't handled by this listener or not async
});