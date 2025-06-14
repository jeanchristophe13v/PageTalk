/**
 * Pagetalk - Text Selection Helper Module
 * 划词助手功能模块
 */

// 全局状态
let isSelectionHelperActive = false;
let currentMiniIcon = null;
let currentOptionsBar = null;
let currentFunctionWindow = null;
let selectedText = '';
let selectionContext = '';

// 滚动状态管理
let functionWindowScrolledUp = false; // 用于跟踪用户是否主动向上滚动
let shouldAdjustHeight = true; // 用于控制是否继续调整窗口高度（主要影响滚动行为）

// 用户手动调整状态管理
let userHasManuallyResized = false; // 用于跟踪用户是否手动调整过窗口尺寸

// 配置
const MINI_ICON_OFFSET = { x: -20, y: 5 }; // 相对于选中框右下角的偏移
const FUNCTION_WINDOW_DEFAULT_SIZE = { width: 400, height: 300 };

// SVG 图标定义
const SVG_ICONS = {
    interpret: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4"/>
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
        <path d="M12 6v6l4 2"/>
    </svg>`,
    translate: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M5 8l6 6"/>
        <path d="M4 14l6-6 2-3"/>
        <path d="M2 5h12"/>
        <path d="M7 2h1"/>
        <path d="M22 22l-5-10-5 10"/>
        <path d="M14 18h6"/>
    </svg>`,
    chat: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <path d="M8 9h8"/>
        <path d="M8 13h6"/>
    </svg>`
};

/**
 * 初始化划词助手
 */
function initTextSelectionHelper() {
    console.log('[TextSelectionHelper] Initializing...');

    // 确保markdown渲染器已初始化
    if (window.MarkdownRenderer && typeof window.MarkdownRenderer.render === 'function') {
        console.log('[TextSelectionHelper] MarkdownRenderer is available');
    } else {
        console.warn('[TextSelectionHelper] MarkdownRenderer not available, will use fallback');
    }

    // 监听文本选择事件
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);

    // 监听点击事件，用于隐藏界面
    document.addEventListener('click', handleDocumentClick);

    // 监听窗口大小变化
    window.addEventListener('resize', handleWindowResize);

    // 监听ESC键关闭功能窗口
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentFunctionWindow) {
            hideFunctionWindow();
        }
    });

    console.log('[TextSelectionHelper] Initialized');
}

/**
 * 处理文本选择事件
 */
function handleTextSelection(event) {
    // 延迟处理，确保选择状态稳定
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        console.log('[TextSelectionHelper] Text selection detected:', text.length > 0 ? `"${text.substring(0, 50)}..."` : 'empty');

        if (text && text.length > 0) {
            // 检查是否应该排除显示
            if (shouldExcludeSelection(selection)) {
                console.log('[TextSelectionHelper] Selection excluded');
                // 只隐藏mini icon和选项栏，不隐藏功能窗口
                hideMiniIcon();
                hideOptionsBar();
                return;
            }

            selectedText = text;
            selectionContext = extractSelectionContext(selection);
            console.log('[TextSelectionHelper] Showing mini icon for selection');
            showMiniIcon(selection);
        } else {
            // 文本选择为空时，只隐藏mini icon和选项栏，不隐藏功能窗口
            hideMiniIcon();
            hideOptionsBar();
        }
    }, 100);
}

/**
 * 检查是否应该排除显示划词助手
 */
function shouldExcludeSelection(selection) {
    if (!selection.rangeCount) return true;
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    
    // 排除密码输入框
    if (element.closest('input[type="password"]')) {
        return true;
    }
    
    // 排除 PageTalk 插件界面和功能窗口
    if (element.closest('#pagetalk-panel-container, .pagetalk-selection-helper, .pagetalk-function-window')) {
        return true;
    }
    
    // 排除其他不适合的元素
    if (element.closest('script, style, noscript')) {
        return true;
    }
    
    return false;
}

/**
 * 提取选择文本的上下文 - 优化版本，只获取局部上下文
 */
function extractSelectionContext(selection) {
    try {
        if (!selection.rangeCount) return '';

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        // 获取包含选中文本的段落或容器
        const contextElement = element.closest('p, div, article, section') || element;
        let contextText = contextElement.textContent || '';

        // 限制上下文长度，避免传递过大的内容
        const maxContextLength = 1000; // 限制为1000字符
        if (contextText.length > maxContextLength) {
            // 尝试找到选中文本在上下文中的位置
            const selectedText = selection.toString();
            const selectedIndex = contextText.indexOf(selectedText);

            if (selectedIndex !== -1) {
                // 以选中文本为中心，提取前后各500字符
                const start = Math.max(0, selectedIndex - 500);
                const end = Math.min(contextText.length, selectedIndex + selectedText.length + 500);
                contextText = contextText.substring(start, end);

                // 如果截断了开头或结尾，添加省略号
                if (start > 0) contextText = '...' + contextText;
                if (end < contextText.length) contextText = contextText + '...';
            } else {
                // 如果找不到选中文本，只取前1000字符
                contextText = contextText.substring(0, maxContextLength) + '...';
            }
        }

        return contextText;
    } catch (error) {
        console.warn('[TextSelectionHelper] Error extracting context:', error);
        return '';
    }
}

/**
 * 显示 mini icon
 */
function showMiniIcon(selection) {
    console.log('[TextSelectionHelper] showMiniIcon called');
    hideMiniIcon();

    if (!selection.rangeCount) {
        console.log('[TextSelectionHelper] No selection range found');
        return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    console.log('[TextSelectionHelper] Selection rect:', rect);
    
    // 创建 mini icon 元素
    const miniIcon = document.createElement('div');
    miniIcon.className = 'pagetalk-selection-helper pagetalk-mini-icon';
    miniIcon.innerHTML = `
        <img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="20" height="20">
    `;
    
    // 设置位置
    const x = rect.right + MINI_ICON_OFFSET.x;
    const y = rect.bottom + MINI_ICON_OFFSET.y;
    
    miniIcon.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        z-index: 2147483646;
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: all 0.2s ease;
    `;
    
    // 添加悬停效果
    miniIcon.addEventListener('mouseenter', () => {
        miniIcon.style.transform = 'scale(1.1)';
        miniIcon.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
    
    miniIcon.addEventListener('mouseleave', () => {
        miniIcon.style.transform = 'scale(1)';
        miniIcon.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });
    
    // 添加点击事件
    miniIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        showOptionsBar(e.target);
    });
    
    document.body.appendChild(miniIcon);
    currentMiniIcon = miniIcon;
    console.log('[TextSelectionHelper] Mini icon added to DOM at position:', x, y);

    // 添加淡入动画
    requestAnimationFrame(() => {
        miniIcon.style.opacity = '0';
        miniIcon.style.transform = 'scale(0.8)';
        requestAnimationFrame(() => {
            miniIcon.style.opacity = '1';
            miniIcon.style.transform = 'scale(1)';
        });
    });
}

/**
 * 隐藏 mini icon
 */
function hideMiniIcon() {
    if (currentMiniIcon) {
        currentMiniIcon.remove();
        currentMiniIcon = null;
    }
}

/**
 * 显示选项栏
 */
async function showOptionsBar(triggerElement) {
    hideOptionsBar();

    try {
        // 获取设置
        const settings = await getTextSelectionHelperSettings();
        const optionsOrder = settings.optionsOrder || ['interpret', 'translate', 'chat'];

        // 构建选项列表
        const options = [];
        for (const optionId of optionsOrder) {
            if (optionId === 'interpret') {
                options.push({ id: 'interpret', name: 'interpret', icon: SVG_ICONS.interpret });
            } else if (optionId === 'translate') {
                options.push({ id: 'translate', name: 'translate', icon: SVG_ICONS.translate });
            } else if (optionId === 'chat') {
                options.push({ id: 'chat', name: 'chat', icon: SVG_ICONS.chat });
            }
        }

        // 创建选项栏
        const optionsBar = document.createElement('div');
        optionsBar.className = 'pagetalk-selection-helper pagetalk-options-bar';
    
        // 构建选项栏内容
        let optionsHTML = `
            <div class="pagetalk-options-bar-icon">
                <img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="16" height="16">
            </div>
        `;

        options.forEach(option => {
            optionsHTML += `
                <div class="pagetalk-option" data-option="${option.id}">
                    <span class="pagetalk-option-icon">${option.icon}</span>
                    <span class="pagetalk-option-text" data-i18n="${option.name}">${option.name}</span>
                </div>
            `;
        });

        optionsBar.innerHTML = optionsHTML;

        // 设置样式
        optionsBar.style.cssText = `
            position: fixed;
            z-index: 2147483647;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 8px;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(10px);
        `;

        // 设置位置（居中显示在 mini icon 正下方）
        const iconRect = triggerElement.getBoundingClientRect();

        // 先添加到 DOM 以获取选项栏的实际宽度
        document.body.appendChild(optionsBar);
        const optionsBarRect = optionsBar.getBoundingClientRect();

        // 计算居中位置
        const x = iconRect.left + (iconRect.width / 2) - (optionsBarRect.width / 2);
        const y = iconRect.bottom + 8;

        optionsBar.style.left = `${x}px`;
        optionsBar.style.top = `${y}px`;

        currentOptionsBar = optionsBar;

        // 添加选项点击事件
        optionsBar.addEventListener('click', handleOptionClick);
    
        // 添加淡入动画
        requestAnimationFrame(() => {
            optionsBar.style.opacity = '1';
            optionsBar.style.transform = 'translateY(0)';
        });

    } catch (error) {
        console.error('[TextSelectionHelper] Error showing options bar:', error);
        // 如果获取设置失败，显示默认选项
        showDefaultOptionsBar(triggerElement);
    }
}

/**
 * 显示默认选项栏（备用方案）
 */
function showDefaultOptionsBar(triggerElement) {
    hideOptionsBar();

    const defaultOptions = [
        { id: 'interpret', name: 'interpret', icon: SVG_ICONS.interpret },
        { id: 'translate', name: 'translate', icon: SVG_ICONS.translate },
        { id: 'chat', name: 'chat', icon: SVG_ICONS.chat }
    ];

    const optionsBar = document.createElement('div');
    optionsBar.className = 'pagetalk-selection-helper pagetalk-options-bar';

    let optionsHTML = `
        <div class="pagetalk-options-bar-icon">
            <img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="16" height="16">
        </div>
    `;

    defaultOptions.forEach(option => {
        optionsHTML += `
            <div class="pagetalk-option" data-option="${option.id}">
                <span class="pagetalk-option-icon">${option.icon}</span>
                <span class="pagetalk-option-text" data-i18n="${option.name}">${option.name}</span>
            </div>
        `;
    });

    optionsBar.innerHTML = optionsHTML;

    optionsBar.style.cssText = `
        position: fixed;
        z-index: 2147483647;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(10px);
    `;

    const iconRect = triggerElement.getBoundingClientRect();
    const x = iconRect.left;
    const y = iconRect.bottom + 8;

    optionsBar.style.left = `${x}px`;
    optionsBar.style.top = `${y}px`;

    document.body.appendChild(optionsBar);
    currentOptionsBar = optionsBar;

    optionsBar.addEventListener('click', handleOptionClick);

    requestAnimationFrame(() => {
        optionsBar.style.opacity = '1';
        optionsBar.style.transform = 'translateY(0)';
    });
}

/**
 * 隐藏选项栏
 */
function hideOptionsBar() {
    if (currentOptionsBar) {
        currentOptionsBar.remove();
        currentOptionsBar = null;
    }
}

/**
 * 处理选项点击
 */
function handleOptionClick(event) {
    const optionElement = event.target.closest('.pagetalk-option');
    if (!optionElement) return;
    
    const optionId = optionElement.dataset.option;
    console.log('[TextSelectionHelper] Option clicked:', optionId);
    
    // 隐藏选项栏
    hideOptionsBar();
    hideMiniIcon();
    
    // 显示对应的功能窗口
    showFunctionWindow(optionId);
}

/**
 * 显示功能窗口
 */
async function showFunctionWindow(optionId) {
    hideFunctionWindow();

    console.log('[TextSelectionHelper] Showing function window for:', optionId);

    // 重置用户手动调整状态（新窗口开始）
    userHasManuallyResized = false;

    // 创建功能窗口
    const functionWindow = document.createElement('div');
    functionWindow.className = 'pagetalk-selection-helper pagetalk-function-window';
    functionWindow.dataset.option = optionId;

    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.className = 'pagetalk-window-close';
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border: none;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        color: #666;
        z-index: 10;
    `;
    closeButton.addEventListener('click', () => {
        hideFunctionWindow();
    });

    // 设置基础样式
    functionWindow.style.cssText = `
        position: fixed;
        z-index: 2147483647;
        width: ${FUNCTION_WINDOW_DEFAULT_SIZE.width}px;
        height: ${FUNCTION_WINDOW_DEFAULT_SIZE.height}px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(15px);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: scale(0.9);
        transition: opacity 0.3s ease, transform 0.3s ease;
        resize: both;
        overflow: auto;
        min-width: 300px;
        min-height: 200px;
    `;

    // 设置初始位置（屏幕中央）
    const x = (window.innerWidth - FUNCTION_WINDOW_DEFAULT_SIZE.width) / 2;
    const y = (window.innerHeight - FUNCTION_WINDOW_DEFAULT_SIZE.height) / 2;

    functionWindow.style.left = `${x}px`;
    functionWindow.style.top = `${y}px`;

    // 根据选项类型创建内容
    await createFunctionWindowContent(functionWindow, optionId);

    // 添加关闭按钮到窗口
    functionWindow.appendChild(closeButton);

    document.body.appendChild(functionWindow);
    currentFunctionWindow = functionWindow;

    // 添加拖拽功能
    makeFunctionWindowDraggable(functionWindow);

    // 添加用户手动调整检测
    let initialSize = null;

    // 记录初始尺寸
    const recordInitialSize = () => {
        initialSize = {
            width: functionWindow.offsetWidth,
            height: functionWindow.offsetHeight
        };
    };

    // 检测尺寸变化
    const checkSizeChange = () => {
        if (initialSize) {
            const currentWidth = functionWindow.offsetWidth;
            const currentHeight = functionWindow.offsetHeight;

            // 如果尺寸发生了显著变化（超过5px），认为是用户手动调整
            if (Math.abs(currentWidth - initialSize.width) > 5 ||
                Math.abs(currentHeight - initialSize.height) > 5) {
                console.log('[TextSelectionHelper] User manual resize detected');
                userHasManuallyResized = true;
                initialSize = { width: currentWidth, height: currentHeight };
            }
        }
    };

    // 监听鼠标按下事件（开始可能的调整）
    functionWindow.addEventListener('mousedown', (e) => {
        recordInitialSize();
    });

    // 监听鼠标释放事件（结束可能的调整）
    functionWindow.addEventListener('mouseup', () => {
        setTimeout(checkSizeChange, 100); // 延迟检查以确保尺寸变化已完成
    });

    // 使用ResizeObserver监听尺寸变化（更准确的方法）
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (initialSize && userHasManuallyResized === false) {
                    const currentWidth = entry.contentRect.width;
                    const currentHeight = entry.contentRect.height;

                    // 检查是否是用户手动调整（而非程序自动调整）
                    if (Math.abs(currentWidth - initialSize.width) > 5 ||
                        Math.abs(currentHeight - initialSize.height) > 5) {
                        // 延迟检查，避免程序自动调整被误判
                        setTimeout(() => {
                            if (Math.abs(functionWindow.offsetWidth - initialSize.width) > 5 ||
                                Math.abs(functionWindow.offsetHeight - initialSize.height) > 5) {
                                console.log('[TextSelectionHelper] User manual resize detected via ResizeObserver');
                                userHasManuallyResized = true;
                            }
                        }, 200);
                    }
                }
            }
        });

        resizeObserver.observe(functionWindow);

        // 在窗口关闭时清理observer
        functionWindow.addEventListener('remove', () => {
            resizeObserver.disconnect();
        });
    }

    // 添加淡入动画
    requestAnimationFrame(() => {
        functionWindow.style.opacity = '1';
        functionWindow.style.transform = 'scale(1)';
    });
}

// 导出函数供其他模块使用
window.TextSelectionHelper = {
    init: initTextSelectionHelper,
    hide: hideAllInterfaces
};

// 确保在页面加载完成后可以初始化
console.log('[TextSelectionHelper] Module loaded');

/**
 * 隐藏所有界面
 */
function hideAllInterfaces() {
    hideMiniIcon();
    hideOptionsBar();
    hideFunctionWindow();
}

/**
 * 隐藏功能窗口
 */
function hideFunctionWindow() {
    if (currentFunctionWindow) {
        currentFunctionWindow.remove();
        currentFunctionWindow = null;
    }
}

/**
 * 处理文档点击事件
 */
function handleDocumentClick(event) {
    // 如果点击的是划词助手相关元素，不隐藏
    if (event.target.closest('.pagetalk-selection-helper')) {
        return;
    }

    // 如果点击的是功能窗口，不隐藏
    if (event.target.closest('.pagetalk-function-window')) {
        return;
    }

    // 如果点击的是功能窗口外部，隐藏功能窗口
    if (currentFunctionWindow) {
        hideFunctionWindow();
    }

    // 如果有新的文本选择，不立即隐藏其他界面
    const selection = window.getSelection();
    if (selection.toString().trim()) {
        return;
    }

    // 隐藏mini icon和选项栏，但不隐藏功能窗口
    hideMiniIcon();
    hideOptionsBar();
}

/**
 * 处理窗口大小变化
 */
function handleWindowResize() {
    // 重新定位功能窗口，确保不超出屏幕
    if (currentFunctionWindow) {
        const rect = currentFunctionWindow.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        if (rect.left > maxX) {
            currentFunctionWindow.style.left = `${Math.max(0, maxX)}px`;
        }
        if (rect.top > maxY) {
            currentFunctionWindow.style.top = `${Math.max(0, maxY)}px`;
        }
    }
}

/**
 * 创建功能窗口内容
 */
async function createFunctionWindowContent(windowElement, optionId) {
    let content = '';

    if (optionId === 'chat') {
        // 获取主面板的模型设置
        const currentModel = await getCurrentMainPanelModel();

        // 构建模型选项
        const modelOptions = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.5-flash-thinking',
            'gemini-2.0-flash-thinking-exp-01-21',
            'gemini-2.0-pro-exp-02-05',
            'gemini-2.5-pro-exp-03-25',
            'gemini-2.5-pro-preview-03-25',
            'gemini-2.5-pro-preview-05-06',
            'gemini-exp-1206'
        ];

        let modelOptionsHTML = '';
        modelOptions.forEach(model => {
            const displayName = model === 'gemini-2.0-flash-thinking-exp-01-21' ? 'gemini-2.0-flash-thinking' : model;
            const selected = model === (currentModel || 'gemini-2.5-flash') ? 'selected' : '';
            modelOptionsHTML += `<option value="${model}" ${selected}>${displayName}</option>`;
        });

        // 构建助手选项
        let agentOptionsHTML = '';
        try {
            const result = await new Promise(resolve => {
                chrome.storage.sync.get(['agents', 'currentAgentId'], resolve);
            });

            if (result.agents && Array.isArray(result.agents)) {
                result.agents.forEach(agent => {
                    const selected = agent.id === result.currentAgentId ? 'selected' : '';
                    agentOptionsHTML += `<option value="${agent.id}" ${selected}>${agent.name}</option>`;
                });
            }
        } catch (error) {
            console.warn('[TextSelectionHelper] Failed to load agents:', error);
            agentOptionsHTML = '<option value="default">默认</option>';
        }

        if (!agentOptionsHTML) {
            agentOptionsHTML = '<option value="default">默认</option>';
        }

        // 对话功能窗口
        content = `
            <div class="pagetalk-window-header">
                <div class="pagetalk-window-controls">
                    <select class="pagetalk-model-select">
                        ${modelOptionsHTML}
                    </select>
                    <select class="pagetalk-agent-select">
                        ${agentOptionsHTML}
                    </select>
                    <button class="pagetalk-clear-context" title="清除上下文">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                </div>
                <div class="pagetalk-window-drag-handle"></div>
            </div>
            <div class="pagetalk-quote-area">
                <div class="pagetalk-quote-text">"${selectedText}"</div>
            </div>
            <div class="pagetalk-chat-messages"></div>
            <div class="pagetalk-chat-input">
                <textarea placeholder="输入消息..." rows="2"></textarea>
                <button class="pagetalk-send-btn">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11v-.001ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        // 解读和翻译功能窗口
        const title = optionId === 'interpret' ? '解读' : '翻译';
        content = `
            <div class="pagetalk-window-header">
                <div class="pagetalk-window-title">${title}</div>
                <div class="pagetalk-window-drag-handle"></div>
            </div>
            <div class="pagetalk-quote-area">
                <div class="pagetalk-quote-text">"${selectedText}"</div>
            </div>
            <div class="pagetalk-response-area">
                <div class="thinking">
                    <div class="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
    }

    windowElement.innerHTML = content;

    // 添加事件监听器
    setupFunctionWindowEvents(windowElement, optionId);

    // 如果是解读或翻译，立即发送请求
    if (optionId === 'interpret' || optionId === 'translate') {
        sendInterpretOrTranslateRequest(windowElement, optionId);
    }
}

/**
 * 设置功能窗口事件监听器
 */
function setupFunctionWindowEvents(windowElement, optionId) {
    // 重置滚动状态和调整状态
    functionWindowScrolledUp = false;
    shouldAdjustHeight = true;

    if (optionId === 'chat') {
        // 对话窗口事件
        const sendBtn = windowElement.querySelector('.pagetalk-send-btn');
        const textarea = windowElement.querySelector('textarea');
        const clearBtn = windowElement.querySelector('.pagetalk-clear-context');

        if (sendBtn && textarea) {
            sendBtn.addEventListener('click', () => sendChatMessage(windowElement));
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage(windowElement);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => clearChatContext(windowElement));
        }

        // 为聊天消息区域添加滚动监听器
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        if (messagesArea) {
            setupScrollListener(messagesArea);
        }
    } else {
        // 为解读/翻译响应区域添加滚动监听器
        const responseArea = windowElement.querySelector('.pagetalk-response-area');
        if (responseArea) {
            setupScrollListener(responseArea);
        }
    }
}

/**
 * 设置滚动监听器
 */
function setupScrollListener(scrollContainer) {
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 30; // 30px 阈值

        if (isNearBottom) {
            // 用户滚动到底部，恢复自动滚动
            functionWindowScrolledUp = false;
            shouldAdjustHeight = true; // 恢复高度调整
        } else {
            // 用户向上滚动，停止自动滚动
            functionWindowScrolledUp = true;
            // 注意：不再阻止尺寸调整，只是停止自动滚动
        }
    });
}

/**
 * 发送解读或翻译请求
 */
async function sendInterpretOrTranslateRequest(windowElement, optionId) {
    try {
        // 重置滚动状态（新请求开始）
        functionWindowScrolledUp = false;
        shouldAdjustHeight = true;

        // 获取设置
        const settings = await getTextSelectionHelperSettings();
        const optionSettings = settings[optionId];

        if (!optionSettings) {
            throw new Error(`Settings not found for option: ${optionId}`);
        }

        // 构建优化的消息，减少不必要的上下文
        let message;
        if (selectionContext && selectionContext.length > 0 && selectionContext !== selectedText && selectionContext.length < 500) {
            // 只有当上下文与选中文本不同、有意义且不太长时才包含
            message = `${optionSettings.systemPrompt}\n\n选中文本：${selectedText}\n\n相关上下文：${selectionContext}`;
        } else {
            // 如果上下文无意义、与选中文本相同或太长，只使用选中文本
            message = `${optionSettings.systemPrompt}\n\n${selectedText}`;
        }

        // 准备响应区域
        const responseArea = windowElement.querySelector('.pagetalk-response-area');
        if (responseArea) {
            responseArea.innerHTML = `
                <div class="pagetalk-response-content markdown-rendered"></div>
                <div class="pagetalk-response-actions">
                    <button class="pagetalk-copy-btn" title="复制">
                        <svg class="copy-icon" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                        <svg class="check-icon" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                    </button>
                    <button class="pagetalk-regenerate-btn" title="重新生成">
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                    </button>
                </div>
            `;
        }

        const responseContent = windowElement.querySelector('.pagetalk-response-content');
        let fullResponse = '';

        // 发送到 AI API (流式输出)
        await callAIAPI(message, optionSettings.model, optionSettings.temperature, (text, isComplete) => {
            fullResponse = text;
            if (responseContent) {
                // 使用主面板相同的 markdown 渲染器
                let renderedContent = '';
                if (window.MarkdownRenderer && typeof window.MarkdownRenderer.render === 'function') {
                    // 使用主面板的MarkdownRenderer.render函数
                    renderedContent = window.MarkdownRenderer.render(text);
                } else {
                    // 备用方案：简单的HTML转义
                    renderedContent = `<p>${escapeHtml(text)}</p>`;
                }

                // 如果还在流式输出中，添加光标
                if (!isComplete) {
                    renderedContent += '<span class="pagetalk-streaming-cursor"></span>';
                }

                responseContent.innerHTML = renderedContent;

                // 添加代码块复制按钮（模仿主面板逻辑）
                const codeBlocks = responseContent.querySelectorAll('pre');
                codeBlocks.forEach(addCopyButtonToCodeBlock);

                // 条件滚动：只有当用户没有向上滚动时才自动滚动
                const responseArea = windowElement.querySelector('.pagetalk-response-area');
                if (responseArea && !functionWindowScrolledUp) {
                    responseArea.scrollTop = responseArea.scrollHeight;
                }

                // 优化的尺寸调整：在流式输出过程中始终调整尺寸
                // 只有在输出完成或者用户没有手动调整过窗口时才进行尺寸调整
                if (!userHasManuallyResized) {
                    adjustWindowSize(windowElement);
                }
            }
        });

        // 设置按钮事件
        setupResponseActions(windowElement, fullResponse, optionId);

    } catch (error) {
        console.error('[TextSelectionHelper] Error sending request:', error);
        displayError(windowElement, error.message);
    }
}

/**
 * 设置响应按钮事件
 */
function setupResponseActions(windowElement, response, optionId) {
    const copyBtn = windowElement.querySelector('.pagetalk-copy-btn');
    const regenerateBtn = windowElement.querySelector('.pagetalk-regenerate-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(response);

            // 显示绿色对勾
            const copyIcon = copyBtn.querySelector('.copy-icon');
            const checkIcon = copyBtn.querySelector('.check-icon');

            copyIcon.style.display = 'none';
            checkIcon.style.display = 'inline';
            copyBtn.style.color = '#28a745';

            // 2秒后恢复
            setTimeout(() => {
                copyIcon.style.display = 'inline';
                checkIcon.style.display = 'none';
                copyBtn.style.color = '';
            }, 2000);
        });
    }

    if (regenerateBtn) {
        // 移除之前的事件监听器
        const newRegenerateBtn = regenerateBtn.cloneNode(true);
        regenerateBtn.parentNode.replaceChild(newRegenerateBtn, regenerateBtn);

        newRegenerateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[TextSelectionHelper] Regenerating for option:', optionId);

            // 显示思考动画
            const responseArea = windowElement.querySelector('.pagetalk-response-area');
            if (responseArea) {
                responseArea.innerHTML = `
                    <div class="thinking">
                        <div class="thinking-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                `;
            }

            // 延迟执行，避免事件冲突
            setTimeout(() => {
                sendInterpretOrTranslateRequest(windowElement, optionId);
            }, 100);
        });
    }
}

/**
 * 显示错误信息
 */
function displayError(windowElement, errorMessage) {
    const responseArea = windowElement.querySelector('.pagetalk-response-area');
    if (!responseArea) return;

    responseArea.innerHTML = `
        <div class="pagetalk-error">
            <div class="pagetalk-error-message">错误：${errorMessage}</div>
            <button class="pagetalk-retry-btn">重试</button>
        </div>
    `;

    const retryBtn = responseArea.querySelector('.pagetalk-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            const optionId = windowElement.dataset.option;
            sendInterpretOrTranslateRequest(windowElement, optionId);
        });
    }
}

/**
 * 使功能窗口可拖拽
 */
function makeFunctionWindowDraggable(windowElement) {
    const dragHandle = windowElement.querySelector('.pagetalk-window-header');
    if (!dragHandle) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    // 设置拖拽手柄样式
    dragHandle.style.cursor = 'move';
    dragHandle.style.userSelect = 'none';

    dragHandle.addEventListener('mousedown', (e) => {
        // 只有点击标题栏空白区域才能拖拽
        if (e.target.closest('button, select')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(windowElement.style.left);
        startTop = parseInt(windowElement.style.top);

        // 禁用窗口过渡效果
        windowElement.style.transition = 'none';

        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);

        e.preventDefault();
        e.stopPropagation();
    });

    function handleDrag(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newLeft = Math.max(0, Math.min(startLeft + deltaX, window.innerWidth - windowElement.offsetWidth));
        const newTop = Math.max(0, Math.min(startTop + deltaY, window.innerHeight - windowElement.offsetHeight));

        windowElement.style.left = `${newLeft}px`;
        windowElement.style.top = `${newTop}px`;
    }

    function handleDragEnd() {
        isDragging = false;

        // 恢复过渡效果
        windowElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
    }
}

/**
 * 发送聊天消息
 */
async function sendChatMessage(windowElement) {
    const textarea = windowElement.querySelector('textarea');
    const message = textarea.value.trim();

    if (!message) return;

    console.log('[TextSelectionHelper] Sending chat message:', message);

    // 清空输入框
    textarea.value = '';

    // 添加用户消息到聊天区域
    addChatMessage(windowElement, message, 'user');

    try {
        // 构建优化的消息，减少不必要的上下文
        let fullMessage;
        if (selectionContext && selectionContext.length > 0 && selectionContext !== selectedText) {
            // 只有当上下文与选中文本不同且有意义时才包含
            fullMessage = `基于以下选中文本进行对话：\n\n选中文本：${selectedText}\n\n相关上下文：${selectionContext}\n\n用户问题：${message}`;
        } else {
            // 如果上下文无意义或与选中文本相同，只使用选中文本
            fullMessage = `基于以下选中文本进行对话：\n\n选中文本：${selectedText}\n\n用户问题：${message}`;
        }

        // 重置滚动状态（新请求开始）
        functionWindowScrolledUp = false;
        shouldAdjustHeight = true;

        // 添加思考动画
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        const thinkingElement = document.createElement('div');
        thinkingElement.className = 'pagetalk-chat-message pagetalk-chat-message-assistant';
        thinkingElement.innerHTML = `
            <div class="pagetalk-message-content">
                <div class="thinking">
                    <div class="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        messagesArea.appendChild(thinkingElement);

        // 条件滚动到底部
        if (!functionWindowScrolledUp) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        // 创建AI消息元素用于流式更新
        const aiMessageElement = document.createElement('div');
        aiMessageElement.className = 'pagetalk-chat-message pagetalk-chat-message-assistant';
        aiMessageElement.innerHTML = `
            <div class="pagetalk-message-content markdown-rendered"></div>
            <div class="pagetalk-message-actions">
                <button class="pagetalk-copy-btn" title="复制">
                    <svg class="copy-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                    <svg class="check-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                </button>
                <button class="pagetalk-regenerate-btn" title="重新生成">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                    </svg>
                </button>
            </div>
        `;

        const messageContent = aiMessageElement.querySelector('.pagetalk-message-content');
        let fullResponse = '';

        // 获取当前主面板的模型设置
        const currentModel = await getCurrentMainPanelModel();

        // 发送到 AI (流式输出)
        await callAIAPI(fullMessage, currentModel, 0.7, (text, isComplete) => {
            // 首次收到响应时，移除思考动画并添加AI消息
            if (!aiMessageElement.parentNode) {
                thinkingElement.remove();
                messagesArea.appendChild(aiMessageElement);
            }

            fullResponse = text;
            if (messageContent) {
                // 使用主面板相同的 markdown 渲染器
                let renderedContent = '';
                if (window.MarkdownRenderer && typeof window.MarkdownRenderer.render === 'function') {
                    // 使用主面板的MarkdownRenderer.render函数
                    renderedContent = window.MarkdownRenderer.render(text);
                } else {
                    // 备用方案：简单的HTML转义
                    renderedContent = `<p>${escapeHtml(text)}</p>`;
                }

                // 如果还在流式输出中，添加光标
                if (!isComplete) {
                    renderedContent += '<span class="pagetalk-streaming-cursor"></span>';
                }

                messageContent.innerHTML = renderedContent;

                // 添加代码块复制按钮（模仿主面板逻辑）
                const codeBlocks = messageContent.querySelectorAll('pre');
                codeBlocks.forEach(addCopyButtonToCodeBlock);

                // 条件调整窗口尺寸：在流式输出过程中始终调整
                if (!userHasManuallyResized) {
                    adjustWindowSize(windowElement);
                }
            }

            if (isComplete) {
                // 设置复制按钮事件
                setupChatMessageActions(aiMessageElement, fullResponse);
            }

            // 条件滚动到底部
            if (!functionWindowScrolledUp) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        });

        // 条件滚动到底部
        if (!functionWindowScrolledUp) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        console.error('[TextSelectionHelper] Chat error:', error);
        addChatMessage(windowElement, `错误：${error.message}`, 'assistant');
    }
}

/**
 * 清除聊天上下文
 */
function clearChatContext(windowElement) {
    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
    if (messagesArea) {
        messagesArea.innerHTML = '';
    }

    // 恢复引用区域
    const quoteArea = windowElement.querySelector('.pagetalk-quote-area');
    if (quoteArea) {
        quoteArea.style.display = 'block';
        quoteArea.innerHTML = `<div class="pagetalk-quote-text">"${selectedText}"</div>`;
    }
}

/**
 * 添加聊天消息
 */
function addChatMessage(windowElement, message, role) {
    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
    if (!messagesArea) return;

    const messageElement = document.createElement('div');
    messageElement.className = `pagetalk-chat-message pagetalk-chat-message-${role}`;
    messageElement.innerHTML = `
        <div class="pagetalk-message-content">${message}</div>
        <div class="pagetalk-message-actions">
            <button class="pagetalk-copy-btn" title="复制">
                <svg class="copy-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
                <svg class="check-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
            </button>
            <button class="pagetalk-regenerate-btn" title="重新生成">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                </svg>
            </button>
        </div>
    `;

    messagesArea.appendChild(messageElement);

    // 隐藏引用区域（首次发送消息后）
    const quoteArea = windowElement.querySelector('.pagetalk-quote-area');
    if (quoteArea && role === 'user') {
        quoteArea.style.display = 'none';
    }

    // 设置按钮事件
    setupChatMessageActions(messageElement, message);

    // 条件滚动到底部
    if (!functionWindowScrolledUp) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}

/**
 * 设置聊天消息按钮事件
 */
function setupChatMessageActions(messageElement, message) {
    const copyBtn = messageElement.querySelector('.pagetalk-copy-btn');
    const regenerateBtn = messageElement.querySelector('.pagetalk-regenerate-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(message);

            // 显示绿色对勾
            const copyIcon = copyBtn.querySelector('.copy-icon');
            const checkIcon = copyBtn.querySelector('.check-icon');

            copyIcon.style.display = 'none';
            checkIcon.style.display = 'inline';
            copyBtn.style.color = '#28a745';

            // 2秒后恢复
            setTimeout(() => {
                copyIcon.style.display = 'inline';
                checkIcon.style.display = 'none';
                copyBtn.style.color = '';
            }, 2000);
        });
    }

    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 找到包含此消息的窗口
            const windowElement = messageElement.closest('.pagetalk-function-window');
            if (windowElement) {
                // 判断是用户消息还是助手消息
                const isUserMessage = messageElement.classList.contains('pagetalk-chat-message-user');
                const isAssistantMessage = messageElement.classList.contains('pagetalk-chat-message-assistant');

                if (isUserMessage) {
                    // 用户消息：重新发送这条消息
                    const userText = messageElement.querySelector('.pagetalk-message-content').textContent;

                    // 移除当前消息及其后的所有消息
                    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
                    const allMessages = Array.from(messagesArea.querySelectorAll('.pagetalk-chat-message'));
                    const currentIndex = allMessages.indexOf(messageElement);

                    // 移除当前消息及其后的所有消息
                    for (let i = currentIndex; i < allMessages.length; i++) {
                        allMessages[i].remove();
                    }

                    // 重新发送用户消息
                    addChatMessage(windowElement, userText, 'user');

                    // 延迟执行，避免事件冲突
                    setTimeout(() => {
                        regenerateChatMessage(windowElement, userText);
                    }, 100);

                } else if (isAssistantMessage) {
                    // 助手消息：重新生成回复
                    messageElement.remove();

                    // 获取最后一个用户消息
                    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
                    const userMessages = messagesArea.querySelectorAll('.pagetalk-chat-message-user');
                    if (userMessages.length > 0) {
                        const lastUserMessage = userMessages[userMessages.length - 1];
                        const userText = lastUserMessage.querySelector('.pagetalk-message-content').textContent;

                        // 延迟执行，避免事件冲突
                        setTimeout(() => {
                            regenerateChatMessage(windowElement, userText);
                        }, 100);
                    }
                }
            }
        });
    }
}

/**
 * 重新生成聊天消息
 */
async function regenerateChatMessage(windowElement, userMessage) {
    try {
        // 构建优化的消息，减少不必要的上下文
        let fullMessage;
        if (selectionContext && selectionContext.length > 0 && selectionContext !== selectedText) {
            // 只有当上下文与选中文本不同且有意义时才包含
            fullMessage = `基于以下选中文本进行对话：\n\n选中文本：${selectedText}\n\n相关上下文：${selectionContext}\n\n用户问题：${userMessage}`;
        } else {
            // 如果上下文无意义或与选中文本相同，只使用选中文本
            fullMessage = `基于以下选中文本进行对话：\n\n选中文本：${selectedText}\n\n用户问题：${userMessage}`;
        }

        // 添加思考动画
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        const thinkingElement = document.createElement('div');
        thinkingElement.className = 'pagetalk-chat-message pagetalk-chat-message-assistant';
        thinkingElement.innerHTML = `
            <div class="pagetalk-message-content">
                <div class="thinking">
                    <div class="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        messagesArea.appendChild(thinkingElement);

        // 重置滚动状态（新请求开始）
        functionWindowScrolledUp = false;
        shouldAdjustHeight = true;

        // 条件滚动到底部
        if (!functionWindowScrolledUp) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        // 创建AI消息元素用于流式更新
        const aiMessageElement = document.createElement('div');
        aiMessageElement.className = 'pagetalk-chat-message pagetalk-chat-message-assistant';
        aiMessageElement.innerHTML = `
            <div class="pagetalk-message-content markdown-rendered"></div>
            <div class="pagetalk-message-actions">
                <button class="pagetalk-copy-btn" title="复制">
                    <svg class="copy-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                    <svg class="check-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                </button>
                <button class="pagetalk-regenerate-btn" title="重新生成">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                    </svg>
                </button>
            </div>
        `;

        const messageContent = aiMessageElement.querySelector('.pagetalk-message-content');
        let fullResponse = '';

        // 获取当前主面板的模型设置
        const currentModel = await getCurrentMainPanelModel();

        // 发送到 AI (流式输出)
        await callAIAPI(fullMessage, currentModel, 0.7, (text, isComplete) => {
            // 首次收到响应时，移除思考动画并添加AI消息
            if (!aiMessageElement.parentNode) {
                thinkingElement.remove();
                messagesArea.appendChild(aiMessageElement);
            }

            fullResponse = text;
            if (messageContent) {
                // 使用主面板相同的 markdown 渲染器
                let renderedContent = '';
                if (window.MarkdownRenderer && typeof window.MarkdownRenderer.render === 'function') {
                    // 使用主面板的MarkdownRenderer.render函数
                    renderedContent = window.MarkdownRenderer.render(text);
                } else {
                    // 备用方案：简单的HTML转义
                    renderedContent = `<p>${escapeHtml(text)}</p>`;
                }

                // 如果还在流式输出中，添加光标
                if (!isComplete) {
                    renderedContent += '<span class="pagetalk-streaming-cursor"></span>';
                }

                messageContent.innerHTML = renderedContent;

                // 添加代码块复制按钮（模仿主面板逻辑）
                const codeBlocks = messageContent.querySelectorAll('pre');
                codeBlocks.forEach(addCopyButtonToCodeBlock);

                // 条件调整窗口尺寸：在流式输出过程中始终调整
                if (!userHasManuallyResized) {
                    adjustWindowSize(windowElement);
                }
            }

            if (isComplete) {
                // 设置复制按钮事件
                setupChatMessageActions(aiMessageElement, fullResponse);
            }

            // 条件滚动到底部
            if (!functionWindowScrolledUp) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        });

    } catch (error) {
        console.error('[TextSelectionHelper] Regenerate chat error:', error);
        addChatMessage(windowElement, `错误：${error.message}`, 'assistant');
    }
}



/**
 * HTML转义函数
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 调用 AI API - 通过 background.js 统一处理
 */
async function callAIAPI(message, model, temperature, onStream = null) {
    try {
        // 生成唯一的请求ID
        const requestId = 'text-selection-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);

        // 构建请求数据
        const requestData = {
            requestId: requestId,
            contents: [{
                parts: [{ text: message }]
            }],
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: 65536, // 设置为65536
                topP: 0.95
            },
            model: model
        };

        // 为gemini-2.5-flash添加thinking配置
        if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-thinking') {
            requestData.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        // 设置流式更新监听器
        const streamListener = (message) => {
            if (message.action === 'streamUpdate' && message.requestId === requestId) {
                if (onStream) {
                    onStream(message.text, message.isComplete);
                }
            }
        };

        // 添加消息监听器
        chrome.runtime.onMessage.addListener(streamListener);

        try {
            // 发送请求到 background.js
            const response = await chrome.runtime.sendMessage({
                action: 'generateContent',
                data: requestData
            });

            if (!response.success) {
                throw new Error(response.error || 'API调用失败');
            }

            return response.data;
        } finally {
            // 确保移除监听器
            chrome.runtime.onMessage.removeListener(streamListener);
        }
    } catch (error) {
        console.error('[TextSelectionHelper] API call error:', error);
        throw error;
    }
}

/**
 * 获取划词助手设置
 */
function getTextSelectionHelperSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['textSelectionHelperSettings'], (result) => {
            const defaultSettings = {
                interpret: {
                    model: 'gemini-2.5-flash',
                    systemPrompt: '解读一下',
                    temperature: 0.7
                },
                translate: {
                    model: 'gemini-2.5-flash',
                    systemPrompt: '翻译一下',
                    temperature: 0.2
                },
                optionsOrder: ['interpret', 'translate', 'chat']
            };

            const settings = result.textSelectionHelperSettings || defaultSettings;
            resolve(settings);
        });
    });
}

/**
 * 获取主面板当前的模型设置
 */
function getCurrentMainPanelModel() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['model'], (result) => {
            resolve(result.model || 'gemini-2.5-flash');
        });
    });
}

/**
 * 获取主面板当前的助手设置
 */
function getCurrentMainPanelAgent() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['agents', 'currentAgentId'], (result) => {
            if (result.agents && result.currentAgentId) {
                const currentAgent = result.agents.find(agent => agent.id === result.currentAgentId);
                resolve(currentAgent || null);
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * 为代码块添加复制按钮（模仿主面板逻辑）
 */
function addCopyButtonToCodeBlock(codeBlock) {
    // 检查是否已经有复制按钮
    if (codeBlock.querySelector('.copy-button')) {
        return;
    }

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = `
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
        </svg>
    `;

    copyButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border: none;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s ease;
        z-index: 1;
    `;

    copyButton.addEventListener('click', () => {
        const codeElement = codeBlock.querySelector('code');
        const code = codeElement ? codeElement.textContent : codeBlock.textContent;

        navigator.clipboard.writeText(code).then(() => {
            // 显示成功反馈
            copyButton.innerHTML = `
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
            `;
            copyButton.style.color = '#28a745';

            setTimeout(() => {
                copyButton.innerHTML = `
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                `;
                copyButton.style.color = '';
            }, 2000);
        });
    });

    // 设置代码块为相对定位
    codeBlock.style.position = 'relative';
    codeBlock.appendChild(copyButton);

    // 悬停显示/隐藏复制按钮
    codeBlock.addEventListener('mouseenter', () => {
        copyButton.style.opacity = '1';
    });

    codeBlock.addEventListener('mouseleave', () => {
        copyButton.style.opacity = '0.7';
    });
}



/**
 * 智能调整窗口尺寸以适应内容（宽度和高度）
 * 如果用户已手动调整过尺寸，则跳过自动调整
 */
function adjustWindowSize(windowElement) {
    try {
        // 如果用户已经手动调整过尺寸，则不进行自动调整
        if (userHasManuallyResized) {
            console.log('[TextSelectionHelper] Skipping auto-resize: user has manually resized');
            return;
        }

        // 保存滚动位置
        const scrollContainers = [];
        const responseArea = windowElement.querySelector('.pagetalk-response-area');
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');

        if (responseArea) {
            scrollContainers.push({
                element: responseArea,
                scrollTop: responseArea.scrollTop
            });
        }
        if (messagesArea) {
            scrollContainers.push({
                element: messagesArea,
                scrollTop: messagesArea.scrollTop
            });
        }

        // 保存原始样式
        const originalWidth = windowElement.style.width;
        const originalHeight = windowElement.style.height;
        const originalMaxWidth = windowElement.style.maxWidth;
        const originalMaxHeight = windowElement.style.maxHeight;

        // 临时设置为auto以测量内容尺寸
        windowElement.style.width = 'auto';
        windowElement.style.height = 'auto';
        windowElement.style.maxWidth = 'none';
        windowElement.style.maxHeight = 'none';

        // 测量内容的实际尺寸
        const contentWidth = windowElement.scrollWidth;
        const contentHeight = windowElement.scrollHeight;

        // 计算最大尺寸（基于屏幕尺寸的百分比）
        const maxWidth = window.innerWidth * 0.35;  // 屏幕宽度的35%
        const maxHeight = window.innerHeight * 0.85; // 屏幕高度的80%

        // 计算最终尺寸
        const finalWidth = Math.min(contentWidth, maxWidth);
        const finalHeight = Math.min(contentHeight, maxHeight);

        // 确保不小于最小尺寸
        const minWidth = 400;
        const minHeight = 250;
        const adjustedWidth = Math.max(minWidth, finalWidth);
        const adjustedHeight = Math.max(minHeight, finalHeight);

        // 恢复原始样式
        windowElement.style.width = originalWidth;
        windowElement.style.height = originalHeight;
        windowElement.style.maxWidth = originalMaxWidth;
        windowElement.style.maxHeight = originalMaxHeight;

        // 应用新的尺寸
        windowElement.style.width = `${adjustedWidth}px`;
        windowElement.style.height = `${adjustedHeight}px`;

        // 确保窗口不会超出视窗边界
        const rect = windowElement.getBoundingClientRect();
        let newLeft = parseInt(windowElement.style.left);
        let newTop = parseInt(windowElement.style.top);

        // 调整位置以确保窗口完全可见
        if (rect.right > window.innerWidth) {
            newLeft = Math.max(10, window.innerWidth - adjustedWidth - 10);
        }
        if (rect.bottom > window.innerHeight) {
            newTop = Math.max(10, window.innerHeight - adjustedHeight - 10);
        }

        windowElement.style.left = `${newLeft}px`;
        windowElement.style.top = `${newTop}px`;

        // 恢复滚动位置（延迟执行以确保布局完成）
        requestAnimationFrame(() => {
            scrollContainers.forEach(container => {
                if (container.element && container.scrollTop > 0) {
                    container.element.scrollTop = container.scrollTop;
                }
            });
        });

        console.log(`[TextSelectionHelper] Auto-adjusted window size: ${adjustedWidth}x${adjustedHeight}`);

    } catch (error) {
        console.warn('[TextSelectionHelper] Error adjusting window size:', error);
    }
}

/**
 * 自动调整窗口高度以适应内容（保留原函数作为备用）
 * @deprecated 使用 adjustWindowSize 替代
 */
function adjustWindowHeight(windowElement) {
    // 调用新的智能尺寸调整函数
    adjustWindowSize(windowElement);
}
