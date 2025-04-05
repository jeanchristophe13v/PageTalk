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
    return true;
});
