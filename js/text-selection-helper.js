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
let currentSelectionRange = null; // 新增：存储当前选择的Range对象，作为滚动时的锚点
let isScrolling = false; // 新增：用于滚动事件的节流

// 滚动状态管理
let functionWindowScrolledUp = false; // 用于跟踪用户是否主动向上滚动
let shouldAdjustHeight = true; // 用于控制是否继续调整窗口高度（主要影响滚动行为）

// 用户手动调整状态管理
let userHasManuallyResized = false; // 用于跟踪用户是否手动调整过窗口尺寸
let isProgrammaticResize = false; // 用于标记程序自动调整，避免被误判为用户手动调整

// 流式输出状态管理
let streamingStates = new Map(); // 存储每个窗口的流式状态 {windowId: {isStreaming: boolean, requestId: string, streamListener: function}}
let abortControllers = new Map(); // 存储每个窗口的中断控制器 {windowId: AbortController}

// 配置
const MINI_ICON_OFFSET = { x: -20, y: 5 }; // 相对于选中框右下角的偏移
const FUNCTION_WINDOW_DEFAULT_SIZE = {
    width: () => window.innerWidth * 0.35, // 动态计算：屏幕宽度的35%
    height: 300, // 解读/翻译窗口默认高度
    chatHeight: 450 // 对话窗口默认高度（更高）
};

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

    // 新增：监听滚动事件，用于动态更新UI位置或显隐
    window.addEventListener('scroll', handleScroll, { passive: true });

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
function handleTextSelection() {
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

            // 存储选中的文本和锚点
            selectedText = text;
            currentSelectionRange = selection.getRangeAt(0).cloneRange(); // 存储Range对象
            selectionContext = extractSelectionContext(selection);
            console.log('[TextSelectionHelper] Showing mini icon for selection');
            showMiniIcon();
        } else {
            // 如果没有选择文本，清除锚点并隐藏UI
            currentSelectionRange = null;
            hideMiniIcon();
            hideOptionsBar();
        }
    }, 100);
}

/**
 * 检查是否应该排除显示划词助手 - 逻辑已放宽
 */
function shouldExcludeSelection(selection) {
    if (!selection.rangeCount) return true;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    // 只排除密码输入框和插件自身的UI
    if (element.closest('input[type="password"], .pagetalk-selection-helper, .pagetalk-function-window')) {
        return true;
    }

    // 允许在 textarea 和 contenteditable 元素中使用
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
 * 显示 mini icon (已修改为绝对定位)
 */
function showMiniIcon() {
    console.log('[TextSelectionHelper] showMiniIcon called');
    hideMiniIcon();

    if (!currentSelectionRange) {
        console.log('[TextSelectionHelper] No selection range found');
        return;
    }

    const rect = currentSelectionRange.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        console.warn('[TextSelectionHelper] Selection has no dimensions, cannot show icon.');
        return;
    }
    console.log('[TextSelectionHelper] Selection rect:', rect);

    // 创建 mini icon 元素
    const miniIcon = document.createElement('div');
    miniIcon.className = 'pagetalk-selection-helper pagetalk-mini-icon';
    miniIcon.innerHTML = `<img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="20" height="20">`;

    // 计算绝对位置 (关键改动)
    const x = rect.right + window.scrollX + MINI_ICON_OFFSET.x;
    const y = rect.bottom + window.scrollY + MINI_ICON_OFFSET.y;

    miniIcon.style.left = `${x}px`;
    miniIcon.style.top = `${y}px`;
    
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
            position: absolute;
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

        // 先添加到 DOM 以获取选项栏的实际宽度
        document.body.appendChild(optionsBar);

        // 计算绝对位置 (关键改动)
        const iconRect = triggerElement.getBoundingClientRect();
        const optionsBarRect = optionsBar.getBoundingClientRect();

        const x = iconRect.left + window.scrollX + (iconRect.width / 2) - (optionsBarRect.width / 2);
        const y = iconRect.bottom + window.scrollY + 8; // 在图标下方8px

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
        position: absolute;
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

    document.body.appendChild(optionsBar);

    // 计算绝对位置 (关键改动)
    const iconRect = triggerElement.getBoundingClientRect();
    const optionsBarRect = optionsBar.getBoundingClientRect();

    const x = iconRect.left + window.scrollX + (iconRect.width / 2) - (optionsBarRect.width / 2);
    const y = iconRect.bottom + window.scrollY + 8;

    optionsBar.style.left = `${x}px`;
    optionsBar.style.top = `${y}px`;
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
    isProgrammaticResize = false;

    // 创建功能窗口
    const functionWindow = document.createElement('div');
    functionWindow.className = 'pagetalk-selection-helper pagetalk-function-window';
    functionWindow.dataset.option = optionId;

    // 修改：根据是否为对话窗口来设置初始宽度和高度
    const isChatWindow = optionId === 'chat';
    const defaultWidth = isChatWindow
        ? Math.min(FUNCTION_WINDOW_DEFAULT_SIZE.width(), 900) // 对话窗口使用最大宽度，但不超过900px
        : 480; // 其他窗口使用固定的较小宽度
    const defaultHeight = isChatWindow
        ? FUNCTION_WINDOW_DEFAULT_SIZE.chatHeight // 对话窗口使用更高的默认高度
        : FUNCTION_WINDOW_DEFAULT_SIZE.height; // 其他窗口使用标准高度

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
        width: ${defaultWidth}px;
        height: ${defaultHeight}px;
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
    const x = (window.innerWidth - defaultWidth) / 2;
    const y = (window.innerHeight - defaultHeight) / 2;

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
    functionWindow.addEventListener('mousedown', () => {
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
                if (initialSize && userHasManuallyResized === false && !isProgrammaticResize) {
                    const currentWidth = entry.contentRect.width;
                    const currentHeight = entry.contentRect.height;

                    // 检查是否是用户手动调整（而非程序自动调整）
                    if (Math.abs(currentWidth - initialSize.width) > 5 ||
                        Math.abs(currentHeight - initialSize.height) > 5) {
                        // 延迟检查，避免程序自动调整被误判
                        setTimeout(() => {
                            if (!isProgrammaticResize &&
                                (Math.abs(functionWindow.offsetWidth - initialSize.width) > 5 ||
                                Math.abs(functionWindow.offsetHeight - initialSize.height) > 5)) {
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
 * 新增：处理页面滚动
 */
function handleScroll() {
    if (!currentSelectionRange || isScrolling) {
        return;
    }

    isScrolling = true;
    requestAnimationFrame(() => {
        const rect = currentSelectionRange.getBoundingClientRect();
        const isInViewport = rect.bottom > 0 && rect.top < window.innerHeight;

        // 如果UI元素存在，根据锚点是否在视口内来更新其可见性
        if (currentMiniIcon) {
            if (isInViewport) {
                currentMiniIcon.style.display = 'flex';
                // 更新位置，以防页面布局变化
                const x = rect.right + window.scrollX + MINI_ICON_OFFSET.x;
                const y = rect.bottom + window.scrollY + MINI_ICON_OFFSET.y;
                currentMiniIcon.style.left = `${x}px`;
                currentMiniIcon.style.top = `${y}px`;
            } else {
                currentMiniIcon.style.display = 'none';
            }
        }

        if (currentOptionsBar) {
            if (isInViewport) {
                currentOptionsBar.style.display = 'flex';
                // 更新位置
                const iconRect = currentMiniIcon ? currentMiniIcon.getBoundingClientRect() : rect;
                const optionsBarRect = currentOptionsBar.getBoundingClientRect();
                const x = iconRect.left + window.scrollX + (iconRect.width / 2) - (optionsBarRect.width / 2);
                const y = iconRect.bottom + window.scrollY + 8;
                currentOptionsBar.style.left = `${x}px`;
                currentOptionsBar.style.top = `${y}px`;
            } else {
                currentOptionsBar.style.display = 'none';
            }
        }

        // 功能窗口的逻辑类似，但通常它打开后用户会交互，可以不强制随滚动更新位置

        isScrolling = false;
    });
}

/**
 * 隐藏所有界面，并清除状态
 */
function hideAllInterfaces() {
    hideMiniIcon();
    hideOptionsBar();
    hideFunctionWindow();
    currentSelectionRange = null; // 关键：清除锚点
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
                <div class="pagetalk-quote-text" id="quote-text-${Date.now()}">"${selectedText}"</div>
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
                <div class="pagetalk-quote-text" id="quote-text-${Date.now()}">"${selectedText}"</div>
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

    // 初始化引用区域的折叠功能
    initQuoteCollapse(windowElement);

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
        const modelSelect = windowElement.querySelector('.pagetalk-model-select');

        if (sendBtn && textarea) {
            sendBtn.addEventListener('click', () => sendChatMessage(windowElement));
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage(windowElement);
                }
            });

            // 自动聚焦输入框
            setTimeout(() => {
                textarea.focus();
            }, 100); // 延迟100ms确保窗口完全渲染后再聚焦
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => clearChatContext(windowElement));
        }

        // 为模型选择器添加事件监听器（对话功能需要响应模型变化）
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                console.log('[TextSelectionHelper] Chat model changed to:', e.target.value);
                // 模型变化时不需要特殊处理，下次发送消息时会自动使用新模型
            });
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
    const sendBtn = windowElement.querySelector('.pagetalk-send-btn');
    const message = textarea.value.trim();

    if (!message) return;

    // 获取窗口ID
    const windowId = windowElement.dataset.windowId || Date.now().toString();
    windowElement.dataset.windowId = windowId;

    // 检查是否正在流式输出
    const streamingState = streamingStates.get(windowId);
    if (streamingState && streamingState.isStreaming) {
        // 如果正在流式输出，则中断当前输出
        abortStreaming(windowId);
        return;
    }

    console.log('[TextSelectionHelper] Sending chat message:', message);

    // 清空输入框
    textarea.value = '';

    // 添加用户消息到聊天区域
    addChatMessage(windowElement, message, 'user');

    // 设置流式状态
    const requestId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    streamingStates.set(windowId, { isStreaming: true, requestId: requestId, streamListener: null });

    // 更新发送按钮为暂停状态
    updateSendButtonToStopState(sendBtn, windowId);

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
        aiMessageElement.dataset.messageId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
                <button class="pagetalk-delete-btn" title="删除">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        `;

        const messageContent = aiMessageElement.querySelector('.pagetalk-message-content');
        let fullResponse = '';

        // 获取当前窗口选择的模型
        const modelSelect = windowElement.querySelector('.pagetalk-model-select');
        const currentModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

        // 发送到 AI (流式输出)
        await callAIAPI(fullMessage, currentModel, 0.7, (text, isComplete) => {
            // 检查流式状态是否仍然有效（可能已被中断）
            const currentStreamingState = streamingStates.get(windowId);
            if (!currentStreamingState || !currentStreamingState.isStreaming) {
                console.log('[TextSelectionHelper] Streaming was aborted, ignoring update');
                return;
            }

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
                    console.log('[TextSelectionHelper] Calling adjustWindowSize for chat window during streaming');
                    adjustWindowSize(windowElement);
                } else {
                    console.log('[TextSelectionHelper] Skipping adjustWindowSize: user has manually resized');
                }
            }

            if (isComplete) {
                // 设置复制按钮事件
                setupChatMessageActions(aiMessageElement, fullResponse);

                // 清除流式状态并恢复发送按钮
                const currentState = streamingStates.get(windowId);
                if (currentState && currentState.streamListener) {
                    try {
                        chrome.runtime.onMessage.removeListener(currentState.streamListener);
                        console.log('[TextSelectionHelper] Removed completed stream listener for window:', windowId);
                    } catch (error) {
                        console.log('[TextSelectionHelper] Failed to remove completed listener:', error.message);
                    }
                }
                streamingStates.delete(windowId);
                restoreSendButtonToNormalState(windowElement);
            }

            // 条件滚动到底部
            if (!functionWindowScrolledUp) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }, requestId, windowId);

        // 条件滚动到底部
        if (!functionWindowScrolledUp) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        console.error('[TextSelectionHelper] Chat error:', error);

        // 清除思考动画（如果存在）
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        if (messagesArea) {
            const thinkingElements = messagesArea.querySelectorAll('.thinking');
            thinkingElements.forEach(element => {
                const thinkingMessage = element.closest('.pagetalk-chat-message');
                if (thinkingMessage) {
                    thinkingMessage.remove();
                }
            });
        }

        addChatMessage(windowElement, `错误：${error.message}`, 'assistant');

        // 出错时也要清除流式状态并恢复按钮
        const currentState = streamingStates.get(windowId);
        if (currentState && currentState.streamListener) {
            try {
                chrome.runtime.onMessage.removeListener(currentState.streamListener);
                console.log('[TextSelectionHelper] Removed error stream listener for window:', windowId);
            } catch (listenerError) {
                console.log('[TextSelectionHelper] Failed to remove error listener:', listenerError.message);
            }
        }
        streamingStates.delete(windowId);
        restoreSendButtonToNormalState(windowElement);
    }
}

/**
 * 清除聊天上下文
 */
function clearChatContext(windowElement) {
    // 获取窗口ID
    const windowId = windowElement.dataset.windowId;

    // 如果正在流式输出，先中断并删除消息
    if (windowId) {
        const streamingState = streamingStates.get(windowId);
        if (streamingState && streamingState.isStreaming) {
            console.log('[TextSelectionHelper] Aborting streaming and clearing messages');
            // 传递 keepMessages=false 来删除消息
            abortStreaming(windowId, false);
            return; // abortStreaming已经清除了消息，直接返回
        }
    }

    // 如果没有流式输出，正常清除消息
    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
    if (messagesArea) {
        messagesArea.innerHTML = '';
    }

    // 引用区域始终保持显示，不需要恢复操作
    // 因为我们已经改为始终显示引用区域，所以这里不需要任何恢复逻辑
}

/**
 * 添加聊天消息
 */
function addChatMessage(windowElement, message, role) {
    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
    if (!messagesArea) return;

    const messageElement = document.createElement('div');
    messageElement.className = `pagetalk-chat-message pagetalk-chat-message-${role}`;
    messageElement.dataset.messageId = `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
            <button class="pagetalk-delete-btn" title="删除">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
            </button>
        </div>
    `;

    messagesArea.appendChild(messageElement);

    // 保持引用区域始终显示，不再隐藏
    // 注释掉原有的隐藏逻辑，让用户始终能看到对话的上下文
    // const quoteArea = windowElement.querySelector('.pagetalk-quote-area');
    // if (quoteArea && role === 'user') {
    //     quoteArea.style.display = 'none';
    // }

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
    // 检查是否已经设置过事件（避免重复绑定）
    if (messageElement.dataset.actionsSetup === 'true') {
        console.log('[TextSelectionHelper] Actions already setup for message');
        return;
    }

    const copyBtn = messageElement.querySelector('.pagetalk-copy-btn');
    const deleteBtn = messageElement.querySelector('.pagetalk-delete-btn');
    const regenerateBtn = messageElement.querySelector('.pagetalk-regenerate-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
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

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteChatMessage(messageElement);
        });
    }

    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 找到包含此消息的窗口
            const windowElement = messageElement.closest('.pagetalk-function-window');
            if (windowElement) {
                // 获取窗口ID并检查是否正在流式输出
                const windowId = windowElement.dataset.windowId;
                if (windowId) {
                    const streamingState = streamingStates.get(windowId);
                    if (streamingState && streamingState.isStreaming) {
                        console.log('[TextSelectionHelper] Aborting streaming before regenerating');
                        // 重新生成时保留消息，但会在后续逻辑中删除相关消息
                        abortStreaming(windowId, true);
                        // 等待一小段时间确保中断完成
                        setTimeout(() => {
                            performRegenerate();
                        }, 200);
                        return;
                    }
                }

                performRegenerate();

                function performRegenerate() {
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
            }
        });
    }

    // 标记已设置事件，避免重复绑定
    messageElement.dataset.actionsSetup = 'true';
    console.log('[TextSelectionHelper] Actions setup completed for message');
}

/**
 * 重新生成聊天消息
 */
async function regenerateChatMessage(windowElement, userMessage) {
    try {
        // 获取窗口ID
        const windowId = windowElement.dataset.windowId || Date.now().toString();
        windowElement.dataset.windowId = windowId;

        // 构建优化的消息，减少不必要的上下文
        let fullMessage;
        if (selectionContext && selectionContext.length > 0 && selectionContext !== selectedText) {
            // 只有当上下文与选中文本不同且有意义时才包含
            fullMessage = `基于以下选中文本进行对话：\n\n选中文本：${selectedText}\n\n相关上下文：${selectionContext}\n\n用户问题：${userMessage}`;
        } else {
            // 如果上下文无意义或与选中文本相同，只使用选中文本
            fullMessage = `基于以下选中文本进行对话：\n\n选中文本：${selectedText}\n\n用户问题：${userMessage}`;
        }

        // 设置流式状态
        const requestId = 'regenerate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
        streamingStates.set(windowId, { isStreaming: true, requestId: requestId, streamListener: null });

        // 更新发送按钮为暂停状态
        const sendBtn = windowElement.querySelector('.pagetalk-send-btn');
        updateSendButtonToStopState(sendBtn, windowId);

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
        aiMessageElement.dataset.messageId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
                <button class="pagetalk-delete-btn" title="删除">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        `;

        const messageContent = aiMessageElement.querySelector('.pagetalk-message-content');
        let fullResponse = '';

        // 获取当前窗口选择的模型
        const modelSelect = windowElement.querySelector('.pagetalk-model-select');
        const currentModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

        // 发送到 AI (流式输出)
        await callAIAPI(fullMessage, currentModel, 0.7, (text, isComplete) => {
            // 检查流式状态是否仍然有效（可能已被中断）
            const currentStreamingState = streamingStates.get(windowId);
            if (!currentStreamingState || !currentStreamingState.isStreaming) {
                console.log('[TextSelectionHelper] Regenerate streaming was aborted, ignoring update');
                return;
            }

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

                // 清除流式状态并恢复发送按钮
                const currentState = streamingStates.get(windowId);
                if (currentState && currentState.streamListener) {
                    try {
                        chrome.runtime.onMessage.removeListener(currentState.streamListener);
                        console.log('[TextSelectionHelper] Removed completed regenerate stream listener for window:', windowId);
                    } catch (error) {
                        console.log('[TextSelectionHelper] Failed to remove completed regenerate listener:', error.message);
                    }
                }
                streamingStates.delete(windowId);
                restoreSendButtonToNormalState(windowElement);
            }

            // 条件滚动到底部
            if (!functionWindowScrolledUp) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }, requestId, windowId);

    } catch (error) {
        console.error('[TextSelectionHelper] Regenerate chat error:', error);

        // 清除思考动画（如果存在）
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        if (messagesArea) {
            const thinkingElements = messagesArea.querySelectorAll('.thinking');
            thinkingElements.forEach(element => {
                const thinkingMessage = element.closest('.pagetalk-chat-message');
                if (thinkingMessage) {
                    thinkingMessage.remove();
                }
            });
        }

        addChatMessage(windowElement, `错误：${error.message}`, 'assistant');

        // 出错时也要清除流式状态并恢复按钮
        const currentState = streamingStates.get(windowId);
        if (currentState && currentState.streamListener) {
            try {
                chrome.runtime.onMessage.removeListener(currentState.streamListener);
                console.log('[TextSelectionHelper] Removed regenerate error stream listener for window:', windowId);
            } catch (listenerError) {
                console.log('[TextSelectionHelper] Failed to remove regenerate error listener:', listenerError.message);
            }
        }
        streamingStates.delete(windowId);
        restoreSendButtonToNormalState(windowElement);
    }
}



/**
 * 删除聊天消息
 */
function deleteChatMessage(messageElement) {
    if (!messageElement) return;

    const windowElement = messageElement.closest('.pagetalk-function-window');
    if (!windowElement) return;

    const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
    if (!messagesArea) return;

    // 判断是用户消息还是助手消息
    const isUserMessage = messageElement.classList.contains('pagetalk-chat-message-user');
    const isAssistantMessage = messageElement.classList.contains('pagetalk-chat-message-assistant');

    if (isUserMessage) {
        // 删除用户消息：需要删除该消息及其后的所有消息（包括对应的助手回复）
        const allMessages = Array.from(messagesArea.querySelectorAll('.pagetalk-chat-message'));
        const currentIndex = allMessages.indexOf(messageElement);

        // 删除当前消息及其后的所有消息
        for (let i = currentIndex; i < allMessages.length; i++) {
            allMessages[i].remove();
        }

        // 引用区域始终保持显示，不需要恢复操作

    } else if (isAssistantMessage) {
        // 删除助手消息：只删除这一条消息
        messageElement.remove();

        // 引用区域始终保持显示，不需要恢复操作
    }

    console.log('[TextSelectionHelper] Message deleted');
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
async function callAIAPI(message, model, temperature, onStream = null, requestId = null, windowId = null) {
    try {
        // 使用传入的requestId或生成新的
        if (!requestId) {
            requestId = 'text-selection-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
        }

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

        // 如果有windowId，将监听器保存到状态中（用于后续清理）
        if (windowId) {
            const currentState = streamingStates.get(windowId);
            if (currentState) {
                // 如果已有旧的监听器，先移除
                if (currentState.streamListener) {
                    try {
                        chrome.runtime.onMessage.removeListener(currentState.streamListener);
                        console.log('[TextSelectionHelper] Removed old stream listener for window:', windowId);
                    } catch (error) {
                        console.log('[TextSelectionHelper] Failed to remove old listener:', error.message);
                    }
                }
                // 更新状态中的监听器
                currentState.streamListener = streamListener;
                streamingStates.set(windowId, currentState);
            }
        }

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
            // 如果没有windowId或请求完成，移除监听器
            if (!windowId) {
                chrome.runtime.onMessage.removeListener(streamListener);
            }
            // 如果有windowId，监听器会在abortStreaming或完成时被移除
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
 * 更新发送按钮为暂停状态
 */
function updateSendButtonToStopState(sendBtn, windowId) {
    if (!sendBtn) return;

    sendBtn.classList.add('pagetalk-stop-streaming');
    sendBtn.title = '停止生成';
    sendBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/>
        </svg>
    `;

    // 移除原有的点击事件监听器
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

    // 添加中断事件监听器
    newSendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 点击暂停按钮时，保留消息（keepMessages=true）
        abortStreaming(windowId, true);
    });
}

/**
 * 恢复发送按钮为正常状态
 */
function restoreSendButtonToNormalState(windowElement) {
    const sendBtn = windowElement.querySelector('.pagetalk-send-btn');
    if (!sendBtn) return;

    sendBtn.classList.remove('pagetalk-stop-streaming');
    sendBtn.title = '发送';
    sendBtn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11v-.001ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
        </svg>
    `;

    // 移除原有的点击事件监听器
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

    // 重新添加发送消息事件监听器
    newSendBtn.addEventListener('click', () => sendChatMessage(windowElement));
}

/**
 * 中断流式输出
 * @param {string} windowId - 窗口ID
 * @param {boolean} keepMessages - 是否保留消息（true=仅停止输出，false=删除消息）
 */
function abortStreaming(windowId, keepMessages = true) {
    console.log('[TextSelectionHelper] Aborting streaming for window:', windowId, 'keepMessages:', keepMessages);

    // 获取流式状态
    const streamingState = streamingStates.get(windowId);
    if (!streamingState || !streamingState.isStreaming) {
        console.log('[TextSelectionHelper] No active streaming to abort');
        return;
    }

    // 发送中断消息到background.js
    if (streamingState.requestId) {
        try {
            chrome.runtime.sendMessage({
                action: 'abortRequest',
                requestId: streamingState.requestId
            }).catch(error => {
                // 忽略通信错误，可能是插件重启或background script未准备好
                console.log('[TextSelectionHelper] Abort message failed (expected during restart):', error.message);
            });
        } catch (error) {
            // 忽略同步错误
            console.log('[TextSelectionHelper] Chrome runtime not available:', error.message);
        }
    }

    // 移除流式监听器（重要：防止竞态条件）
    if (streamingState.streamListener) {
        try {
            chrome.runtime.onMessage.removeListener(streamingState.streamListener);
            console.log('[TextSelectionHelper] Removed stream listener for window:', windowId);
        } catch (error) {
            console.log('[TextSelectionHelper] Failed to remove listener:', error.message);
        }
    }

    // 清除流式状态
    streamingStates.delete(windowId);

    // 获取窗口元素
    const windowElement = document.querySelector(`.pagetalk-function-window[data-window-id="${windowId}"]`);
    if (windowElement) {
        // 恢复发送按钮状态
        restoreSendButtonToNormalState(windowElement);

        if (!keepMessages) {
            // 如果不保留消息，清除所有聊天消息
            const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
            if (messagesArea) {
                messagesArea.innerHTML = '';
            }
        } else {
            // 如果保留消息，移除正在输出的消息中的流式光标和思考动画
            const streamingCursors = windowElement.querySelectorAll('.pagetalk-streaming-cursor');
            streamingCursors.forEach(cursor => cursor.remove());

            // 移除思考动画（如果存在）
            const thinkingElements = windowElement.querySelectorAll('.thinking');
            thinkingElements.forEach(thinking => {
                const thinkingMessage = thinking.closest('.pagetalk-chat-message');
                if (thinkingMessage) {
                    thinkingMessage.remove();
                }
            });

            // 确保未完成的AI消息有按钮事件（重要：让用户能点击重新生成）
            const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
            if (messagesArea) {
                const assistantMessages = messagesArea.querySelectorAll('.pagetalk-chat-message-assistant');
                assistantMessages.forEach(messageElement => {
                    // 检查是否已经设置过事件
                    if (messageElement.dataset.actionsSetup !== 'true') {
                        const regenerateBtn = messageElement.querySelector('.pagetalk-regenerate-btn');
                        const copyBtn = messageElement.querySelector('.pagetalk-copy-btn');
                        const deleteBtn = messageElement.querySelector('.pagetalk-delete-btn');

                        // 如果按钮存在但没有事件，重新设置
                        if (regenerateBtn || copyBtn || deleteBtn) {
                            const messageContent = messageElement.querySelector('.pagetalk-message-content');
                            const messageText = messageContent ? messageContent.textContent : '';
                            console.log('[TextSelectionHelper] Setting up actions for incomplete message');
                            setupChatMessageActions(messageElement, messageText);
                        }
                    }
                });
            }
        }
    }

    console.log('[TextSelectionHelper] Streaming aborted');
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
        if (userHasManuallyResized) {
            console.log('[TextSelectionHelper] Skipping auto-resize: user has manually resized');
            return;
        }

        // 检查是否是对话窗口
        const isChatWindow = windowElement.querySelector('.pagetalk-chat-messages') !== null;
        console.log(`[TextSelectionHelper] adjustWindowSize called for ${isChatWindow ? 'chat' : 'translate/interpret'} window`);

        // 保存滚动位置
        const scrollContainer = windowElement.querySelector('.pagetalk-chat-messages, .pagetalk-response-area');
        const originalScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

        // --- 高度计算 ---
        let contentHeight;

        if (isChatWindow) {
            // 对话窗口特殊处理：计算所有组件的高度总和
            const header = windowElement.querySelector('.pagetalk-window-header');
            const quoteArea = windowElement.querySelector('.pagetalk-quote-area');
            const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
            const inputArea = windowElement.querySelector('.pagetalk-chat-input');

            let totalHeight = 0;

            // 计算固定高度的组件
            if (header) totalHeight += header.offsetHeight;
            if (quoteArea && quoteArea.style.display !== 'none') totalHeight += quoteArea.offsetHeight;
            if (inputArea) totalHeight += inputArea.offsetHeight;

            // 计算消息区域的内容高度
            if (messagesArea) {
                // 临时移除高度限制来测量内容
                const originalHeight = messagesArea.style.height;
                const originalMaxHeight = messagesArea.style.maxHeight;
                const originalOverflow = messagesArea.style.overflowY;

                messagesArea.style.height = 'auto';
                messagesArea.style.maxHeight = 'none';
                messagesArea.style.overflowY = 'visible';

                // 获取消息区域的实际内容高度
                const messagesContentHeight = messagesArea.scrollHeight;
                totalHeight += messagesContentHeight;

                // 恢复原始样式
                messagesArea.style.height = originalHeight;
                messagesArea.style.maxHeight = originalMaxHeight;
                messagesArea.style.overflowY = originalOverflow;

                console.log('[TextSelectionHelper] Chat window height calculation:', {
                    headerHeight: header ? header.offsetHeight : 0,
                    quoteHeight: quoteArea && quoteArea.style.display !== 'none' ? quoteArea.offsetHeight : 0,
                    inputHeight: inputArea ? inputArea.offsetHeight : 0,
                    messagesContentHeight,
                    totalHeight
                });
            }

            contentHeight = totalHeight;
        } else {
            // 解读/翻译窗口的原有逻辑
            const originalHeight = windowElement.style.height;
            windowElement.style.height = 'auto';
            contentHeight = windowElement.scrollHeight;
            windowElement.style.height = originalHeight;
            console.log('[TextSelectionHelper] Translate/Interpret window - contentHeight:', contentHeight);
        }

        const maxHeight = window.innerHeight * 0.85;
        const minHeight = 250;
        const finalHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));

        console.log('[TextSelectionHelper] Height calculation:', {
            contentHeight,
            maxHeight,
            minHeight,
            finalHeight,
            currentHeight: windowElement.style.height
        });

        // --- 宽度处理 ---
        // 对话窗口宽度保持不变（已在创建时设为最大宽度）
        // 解读/翻译窗口根据内容调整宽度
        if (!isChatWindow) {
            const originalWidth = windowElement.style.width;
            windowElement.style.width = 'auto';
            const contentWidth = windowElement.scrollWidth;
            windowElement.style.width = originalWidth;

            const maxWidth = window.innerWidth * 0.35;
            const minWidth = 400;
            const finalWidth = Math.max(minWidth, Math.min(contentWidth, maxWidth));
            windowElement.style.width = `${finalWidth}px`;
        }

        // 标记为程序自动调整
        isProgrammaticResize = true;

        // 应用新的高度
        windowElement.style.height = `${finalHeight}px`;

        // 确保窗口位置在屏幕内
        const rect = windowElement.getBoundingClientRect();
        let newLeft = parseInt(windowElement.style.left);
        let newTop = parseInt(windowElement.style.top);

        if (rect.right > window.innerWidth) {
            newLeft = Math.max(10, window.innerWidth - rect.width - 10);
        }
        if (rect.bottom > window.innerHeight) {
            newTop = Math.max(10, window.innerHeight - finalHeight - 10);
        }

        windowElement.style.left = `${newLeft}px`;
        windowElement.style.top = `${newTop}px`;

        // 恢复滚动位置
        requestAnimationFrame(() => {
            if (scrollContainer && originalScrollTop > 0) {
                scrollContainer.scrollTop = originalScrollTop;
            }
            // 重置程序调整标志
            setTimeout(() => {
                isProgrammaticResize = false;
            }, 300);
        });

        console.log(`[TextSelectionHelper] Auto-adjusted window ${isChatWindow ? '(chat)' : '(translate/interpret)'} height: ${finalHeight}px`);

    } catch (error) {
        console.warn('[TextSelectionHelper] Error adjusting window size:', error);
        // 确保在出错时也重置标志
        isProgrammaticResize = false;
    }
}

/**
 * 初始化引用区域的折叠功能
 */
function initQuoteCollapse(windowElement) {
    // 延迟执行，确保DOM完全渲染
    setTimeout(() => {
        const quoteArea = windowElement.querySelector('.pagetalk-quote-area');
        const quoteText = windowElement.querySelector('.pagetalk-quote-text');

        console.log('[TextSelectionHelper] initQuoteCollapse - elements found:', {
            quoteArea: !!quoteArea,
            quoteText: !!quoteText
        });

        if (!quoteArea || !quoteText) {
            console.warn('[TextSelectionHelper] Quote elements not found');
            return;
        }

        // 获取文本内容
        const textContent = quoteText.textContent || '';

        console.log('[TextSelectionHelper] Quote collapse calculation:', {
            textLength: textContent.length,
            textContent: textContent.substring(0, 100) + '...'
        });

        // 简单的行数估算：基于字符数和容器宽度
        // 对于中文，一般每行约30-40个字符，我们使用保守估计
        const estimatedLines = Math.ceil(textContent.length / 35);
        const needsCollapse = estimatedLines > 2 || textContent.length > 70; // 超过2行或70字符

        console.log('[TextSelectionHelper] Line estimation:', {
            estimatedLines,
            needsCollapse
        });

        if (needsCollapse) {
            // 文本超过2行，添加折叠功能
            quoteText.classList.add('collapsed');

            // 创建展开/折叠按钮
            const toggleBtn = document.createElement('div');
            toggleBtn.className = 'pagetalk-quote-toggle';
            toggleBtn.textContent = '展开';

            console.log('[TextSelectionHelper] Adding collapse toggle button');

            // 添加点击事件
            toggleBtn.addEventListener('click', () => {
                if (quoteText.classList.contains('collapsed')) {
                    // 展开
                    quoteText.classList.remove('collapsed');
                    quoteText.classList.add('expanded');
                    toggleBtn.textContent = '折叠';
                    console.log('[TextSelectionHelper] Quote expanded');
                } else {
                    // 折叠
                    quoteText.classList.remove('expanded');
                    quoteText.classList.add('collapsed');
                    toggleBtn.textContent = '展开';
                    console.log('[TextSelectionHelper] Quote collapsed');
                }

                // 触发窗口尺寸重新计算
                if (!userHasManuallyResized) {
                    setTimeout(() => {
                        adjustWindowSize(windowElement);
                    }, 300); // 等待CSS动画完成
                }
            });

            quoteArea.appendChild(toggleBtn);
        } else {
            console.log('[TextSelectionHelper] Text is short enough, no collapse needed');
        }
    }, 100); // 延迟100ms确保DOM渲染完成
}

/**
 * 自动调整窗口高度以适应内容（保留原函数作为备用）
 * @deprecated 使用 adjustWindowSize 替代
 */
function adjustWindowHeight(windowElement) {
    // 调用新的智能尺寸调整函数
    adjustWindowSize(windowElement);
}
