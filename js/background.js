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
        // 尝试切换面板，tabId:
        
        // 向content script发送消息，切换面板显示
        const response = await chrome.tabs.sendMessage(tabId, { action: "togglePanel" });
    } catch (error) {
        console.error('切换面板失败:', error);
        
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
            }, 100);
        } catch (e) {
            console.error('注入脚本失败:', e);
        }
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
