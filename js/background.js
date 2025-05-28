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

// 切换面板显示
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
        console.error('togglePagetalkPanel 函数出错:', outerError);
    }
}

// 监听来自内容脚本或面板的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "pageContentExtracted") {
        // 存储最近提取的页面内容
        chrome.storage.local.set({ 
            recentPageContent: message.content,
            recentExtractionTime: Date.now()
        });
        sendResponse({ success: true });
    } 
    // 新增：处理从指定标签页提取内容的请求
    else if (message.action === "extractTabContent") {
        const targetTabId = message.tabId;
        if (!targetTabId) {
            console.error("Background: No tabId provided for extractTabContent");
            sendResponse({ error: "No tabId provided" });
            return true; // Keep channel open for async response
        }

        // 检查目标标签页URL是否受限 (例如 chrome://, about:// 等)
        chrome.tabs.get(targetTabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Background: Error getting tab info:", chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
                return; // Exit, channel will close
            }

            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about://') || tab.url.startsWith('edge://'))) {
                console.warn(`Background: Cannot access restricted URL: ${tab.url}`);
                sendResponse({ error: `Cannot access restricted URL: ${tab.url}` });
                return; // Exit, channel will close
            }

            // 尝试在目标标签页执行脚本
            chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: getPageContentForExtraction, // 将要执行的函数
            }, (injectionResults) => {
                if (chrome.runtime.lastError) {
                    console.error("Background: Error injecting script into tab " + targetTabId, chrome.runtime.lastError.message);
                    sendResponse({ error: chrome.runtime.lastError.message });
                } else if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                    sendResponse({ content: injectionResults[0].result });
                } else {
                    // 检查是否有注入错误，但没有显式 result
                    if (injectionResults && injectionResults[0] && injectionResults[0].error) {
                         console.error("Background: Injection script error in tab " + targetTabId, injectionResults[0].error);
                         sendResponse({ error: "Injection script error: " + injectionResults[0].error.message });
                    } else {
                        console.error("Background: Failed to extract content from tab " + targetTabId + ". No result or error from injection.", injectionResults);
                        sendResponse({ error: "Failed to extract content from tab. The tab might be protected or not suitable for content extraction." });
                    }
                }
            });
        });
        return true; //  必须返回 true 以表明 sendResponse 将会异步调用
    }
    return true;
});

// 这个函数将在目标标签页的上下文中执行
function getPageContentForExtraction() {
    try {
        if (typeof Readability === 'undefined') {
            // Readability 通常由 content.js 注入到所有页面
            // 如果这里未定义，说明 content.js 可能没有在该页面成功注入或运行
            console.error('Readability library not found in target tab context.');
            return 'Error: Readability library not available in this tab.';
        }
        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone);
        const article = reader.parse();
        let content = '';
        if (article && article.textContent) {
            content = article.textContent.replace(/\s+/g, ' ').trim();
        } else {
            // 后备方案：尝试获取 body 的 textContent
            content = document.body.textContent || '';
            content = content.replace(/\s+/g, ' ').trim();
            if (!content) {
                return 'Unable to extract content using Readability or body.textContent.';
            }
            content = '(Fallback to body text) ' + content;
        }
        const maxLength = 500000; // 与 content.js 中的限制一致
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + '... (Content truncated)';
        }
        return content;
    } catch (e) {
        console.error('Error during Readability extraction in target tab:', e);
        return `Error extracting content: ${e.message}`;
    }
}
