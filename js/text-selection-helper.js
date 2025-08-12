/**
 * Pagetalk - Text Selection Helper Module
 * 划词助手功能模块
 */

// 防止重复初始化
if (window.textSelectionHelperInitialized) {
    console.log('[TextSelectionHelper] Already initialized, skipping...');
} else {
    window.textSelectionHelperInitialized = true;

    // Mermaid初始化状态标志
    window.textSelectionHelperMermaidInitialized = false;

// 全局状态
let isSelectionHelperActive = window.isSelectionHelperActive || false;
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

// 聊天历史记录管理
let chatHistories = new Map(); // 存储每个聊天窗口的历史记录 {windowId: Array<{role: string, content: string}>}

/**
 * 获取聊天历史记录
 */
function getChatHistory(windowId) {
    if (!chatHistories.has(windowId)) {
        chatHistories.set(windowId, []);
    }
    return chatHistories.get(windowId);
}

/**
 * 添加消息到聊天历史记录
 */
function addToChatHistory(windowId, role, content) {
    const history = getChatHistory(windowId);
    // 确保角色是 'user' 或 'assistant'
    const validRole = role === 'model' ? 'assistant' : role;
    history.push({ role: validRole, content });

    // 限制历史记录为最近10条消息（5轮对话）
    if (history.length > 10) {
        history.splice(0, history.length - 10);
    }

    console.log(`[TextSelectionHelper] Added ${validRole} message to history for window ${windowId}, total: ${history.length}`);
}

/**
 * 清除聊天历史记录
 */
function clearChatHistory(windowId) {
    chatHistories.set(windowId, []);
    console.log(`[TextSelectionHelper] Cleared chat history for window ${windowId}`);
}


// 配置
const MINI_ICON_OFFSET = { x: -20, y: 5 }; // 相对于选中框右下角的偏移
const FUNCTION_WINDOW_DEFAULT_SIZE = {
    width: () => window.innerWidth * 0.35, // 动态计算：屏幕宽度的35%
    height: 300, // 解读/翻译窗口默认高度
    chatHeight: 450 // 对话窗口默认高度（更高）
};

// SVG 图标定义（保留默认图标作为后备）
const SVG_ICONS = {
    interpret: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
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
    </svg>`,
    custom: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`
};

/**
 * 使用Lucide图标库渲染图标
 * @param {string} iconName - Lucide图标名称
 * @param {number} size - 图标大小，默认16
 * @param {string} className - 额外的CSS类名
 * @returns {string} SVG图标的HTML字符串
 */
function renderLucideIcon(iconName, size = 16, className = '') {
    try {
        // 检查Lucide是否可用
        if (typeof lucide === 'undefined') {
            console.warn('[TextSelectionHelper] Lucide library not available, using fallback');
            return SVG_ICONS.custom;
        }

        // 转换图标名称为PascalCase（Lucide的命名约定）
        const pascalCaseName = iconName.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('');

        // 检查图标是否存在
        if (!lucide[pascalCaseName]) {
            console.warn(`[TextSelectionHelper] Lucide icon "${iconName}" (${pascalCaseName}) not found, using fallback`);
            // 尝试一些常见的别名映射
            const aliasMap = {
                'stop': 'CircleStop',
                'shop': 'ShoppingBag',
                'bank': 'Banknote',
                'scanner': 'Scan'
            };

            const aliasName = aliasMap[iconName];
            if (aliasName && lucide[aliasName]) {
                console.log(`[TextSelectionHelper] Using alias "${aliasName}" for "${iconName}"`);
                const iconData = lucide[aliasName];
                if (iconData && Array.isArray(iconData)) {
                    let svgContent = '';
                    iconData.forEach(([tag, attrs]) => {
                        if (tag === 'path') {
                            svgContent += `<path d="${attrs.d}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                        } else if (tag === 'circle') {
                            svgContent += `<circle cx="${attrs.cx}" cy="${attrs.cy}" r="${attrs.r}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                        } else if (tag === 'rect') {
                            svgContent += `<rect x="${attrs.x}" y="${attrs.y}" width="${attrs.width}" height="${attrs.height}"${attrs.rx ? ` rx="${attrs.rx}"` : ''}${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                        } else if (tag === 'line') {
                            svgContent += `<line x1="${attrs.x1}" y1="${attrs.y1}" x2="${attrs.x2}" y2="${attrs.y2}"${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                        } else if (tag === 'polyline') {
                            svgContent += `<polyline points="${attrs.points}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                        }
                    });

                    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${className ? ` class="${className}"` : ''}>
                        ${svgContent}
                    </svg>`;
                }
            }

            return SVG_ICONS.custom;
        }

        // 直接使用Lucide图标数据创建SVG
        const iconData = lucide[pascalCaseName];
        if (iconData && Array.isArray(iconData)) {
            let svgContent = '';
            iconData.forEach(([tag, attrs]) => {
                if (tag === 'path') {
                    svgContent += `<path d="${attrs.d}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                } else if (tag === 'circle') {
                    svgContent += `<circle cx="${attrs.cx}" cy="${attrs.cy}" r="${attrs.r}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                } else if (tag === 'rect') {
                    svgContent += `<rect x="${attrs.x}" y="${attrs.y}" width="${attrs.width}" height="${attrs.height}"${attrs.rx ? ` rx="${attrs.rx}"` : ''}${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                } else if (tag === 'line') {
                    svgContent += `<line x1="${attrs.x1}" y1="${attrs.y1}" x2="${attrs.x2}" y2="${attrs.y2}"${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                } else if (tag === 'polyline') {
                    svgContent += `<polyline points="${attrs.points}"${attrs.fill ? ` fill="${attrs.fill}"` : ''}${attrs.stroke ? ` stroke="${attrs.stroke}"` : ''}/>`;
                }
            });

            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${className ? ` class="${className}"` : ''}>
                ${svgContent}
            </svg>`;
        }

        // 如果以上方法都失败，返回默认图标
        return SVG_ICONS.custom;
    } catch (error) {
        console.error('[TextSelectionHelper] Error rendering Lucide icon:', error);
        return SVG_ICONS.custom;
    }
}

/**
 * 获取选项图标（优先使用Lucide，后备使用默认图标）
 * @param {string} optionId - 选项ID
 * @param {string} customIcon - 自定义图标名称
 * @returns {string} SVG图标的HTML字符串
 */
function getOptionIcon(optionId, customIcon = null) {
    // 如果有自定义图标，使用Lucide渲染
    if (customIcon) {
        return renderLucideIcon(customIcon, 16);
    }

    // 否则使用默认图标
    return SVG_ICONS[optionId] || SVG_ICONS.custom;
}

/**
 * 获取翻译函数
 */
function getTranslationFunction() {
    // 优先使用统一 i18n 工具（父窗口或当前窗口）
    if (window.parent && window.parent.I18n && typeof window.parent.I18n.tr === 'function') {
        return (key, replacements = {}) => window.parent.I18n.tr(key, replacements);
    }
    if (window.I18n && typeof window.I18n.tr === 'function') {
        return (key, replacements = {}) => window.I18n.tr(key, replacements);
    }

    // 兼容旧的 _tr 注入
    if (window.parent && window.parent._tr) {
        return window.parent._tr;
    }
    if (window._tr) {
        return window._tr;
    }

    // 如果 translations 对象可用，创建简易翻译函数
    if (typeof window.translations !== 'undefined') {
        return function(key, replacements = {}) {
            const currentLanguage = window.currentLanguageCache || 'zh-CN';
            const translation = window.translations[currentLanguage]?.[key] || window.translations['zh-CN']?.[key] || key;
            let result = translation;
            for (const placeholder in replacements) {
                result = result.replace(`{${placeholder}}`, replacements[placeholder]);
            }
            return result;
        };
    }

    // 最后回退：返回 key 本身
    return function(key) { return key; };
}

/**
 * 获取当前语言设置
 */
function getCurrentLanguage() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['language'], (result) => {
            resolve(result.language || 'zh-CN');
        });
    });
}

/**
 * 初始化划词助手
 */
function initTextSelectionHelper() {
    console.log('[TextSelectionHelper] Initializing...');

    // 初始化语言缓存
    getCurrentLanguage().then(lang => {
        window.currentLanguageCache = lang;
        console.log('[TextSelectionHelper] Language cache initialized:', lang);
    }).catch(err => {
        console.warn('[TextSelectionHelper] Failed to initialize language cache:', err);
        window.currentLanguageCache = 'zh-CN';
    });

    // 初始化启用状态缓存
    initEnabledStateCache();

    // 确保markdown渲染器已初始化
    if (window.MarkdownRenderer && typeof window.MarkdownRenderer.render === 'function') {
        console.log('[TextSelectionHelper] MarkdownRenderer is available');
    } else {
        console.warn('[TextSelectionHelper] MarkdownRenderer not available, will use fallback');
    }

    // 初始化Mermaid（智能延迟检查，避免不必要的警告）
    if (!window.textSelectionHelperMermaidInitialized) {
        let mermaidInitAttempts = 0;
        const maxMermaidInitAttempts = 10; // 最多尝试10次

        const tryInitMermaid = () => {
            if (window.textSelectionHelperMermaidInitialized) {
                return; // 已经初始化过了，避免重复
            }

            if (typeof mermaid !== 'undefined') {
                try {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        logLevel: 'fatal' // 只显示致命错误，减少日志噪音
                    });
                    window.textSelectionHelperMermaidInitialized = true;
                    console.log('[TextSelectionHelper] Mermaid initialized successfully');
                } catch (error) {
                    console.error('[TextSelectionHelper] Mermaid initialization failed:', error);
                    window.textSelectionHelperMermaidInitialized = true; // 标记为已尝试，避免重复
                }
            } else {
                mermaidInitAttempts++;
                if (mermaidInitAttempts < maxMermaidInitAttempts) {
                    // 继续等待，不输出警告
                    setTimeout(tryInitMermaid, 200);
                } else {
                    // 达到最大尝试次数后静默放弃，标记为已尝试
                    window.textSelectionHelperMermaidInitialized = true;
                }
            }
        };

        // 开始尝试初始化
        setTimeout(tryInitMermaid, 100);
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

    // 监听设置变化
    setupSettingsChangeListener();

    // 监听语言变化事件
    setupLanguageChangeListener();

    console.log('[TextSelectionHelper] Initialized');
}

// 缓存的启用状态
let cachedEnabledState = true; // 默认启用

/**
 * 初始化启用状态缓存
 */
function initEnabledStateCache() {
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['textSelectionHelperSettings'], (result) => {
            if (result.textSelectionHelperSettings && typeof result.textSelectionHelperSettings.enabled !== 'undefined') {
                cachedEnabledState = result.textSelectionHelperSettings.enabled;
                console.log('[TextSelectionHelper] Enabled state cache initialized:', cachedEnabledState);
            } else {
                cachedEnabledState = true; // 默认启用
                console.log('[TextSelectionHelper] No saved enabled state, using default: true');
            }
        });
    }
}

/**
 * 检查划词助手是否启用
 */
function isHelperEnabled() {
    // 尝试从设置模块获取状态
    if (window.isTextSelectionHelperEnabled && typeof window.isTextSelectionHelperEnabled === 'function') {
        const currentState = window.isTextSelectionHelperEnabled();
        cachedEnabledState = currentState; // 更新缓存
        return currentState;
    }

    // 使用缓存的状态
    return cachedEnabledState;
}

/**
 * 监听设置变化，更新缓存状态
 */
function setupSettingsChangeListener() {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            // 监听本地存储中的划词助手设置变化
            if (namespace === 'local' && changes.textSelectionHelperSettings) {
                const newSettings = changes.textSelectionHelperSettings.newValue;
                if (newSettings && typeof newSettings.enabled !== 'undefined') {
                    const wasEnabled = cachedEnabledState;
                    cachedEnabledState = newSettings.enabled;
                    console.log('[TextSelectionHelper] Settings changed, enabled state:', cachedEnabledState);

                    // 如果从启用变为禁用，立即隐藏所有UI
                    if (wasEnabled && !cachedEnabledState) {
                        hideMiniIcon();
                        hideOptionsBar();
                        hideFunctionWindow();
                        console.log('[TextSelectionHelper] Helper disabled, hiding all UI');
                    }
                }
            }
        });
    }
}

/**
 * 监听语言变化事件
 */
function setupLanguageChangeListener() {
    // 监听来自主面板的语言变化事件
    document.addEventListener('pagetalk:languageChanged', (event) => {
        const newLanguage = event.detail?.newLanguage;
        if (newLanguage) {
            console.log('[TextSelectionHelper] Received language change event:', newLanguage);
            handleTextSelectionHelperLanguageChange(newLanguage);
        }
    });
}

/**
 * 处理语言变化
 */
function handleTextSelectionHelperLanguageChange(newLanguage) {
    console.log('[TextSelectionHelper] Handling language change to:', newLanguage);

    // 更新语言缓存
    window.currentLanguageCache = newLanguage;

    // 重新获取翻译函数
    const _tr = getTranslationFunction();

    // 如果当前有选项栏显示，重新渲染以更新语言
    if (currentOptionsBar) {
        const triggerElement = currentMiniIcon;
        if (triggerElement) {
            hideOptionsBar();
            // 延迟重新显示，确保翻译已更新
            setTimeout(() => {
                showOptionsBar(triggerElement);
            }, 100);
        }
    }

    console.log('[TextSelectionHelper] Language change handled');
}

// 导出语言变化处理函数供其他模块使用
window.handleTextSelectionHelperLanguageChange = handleTextSelectionHelperLanguageChange;

/**
 * 处理文本选择事件
 */
function handleTextSelection() {
    // 检查划词助手是否启用
    if (!isHelperEnabled()) {
        console.log('[TextSelectionHelper] Helper is disabled, skipping text selection');
        hideMiniIcon();
        hideOptionsBar();
        return;
    }

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
            // 使用默认上下文窗口提取上下文，具体的上下文窗口会在发送请求时根据选项设置调整
            selectionContext = extractSelectionContext(selection, 500, 500);
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
 * 提取选择文本的上下文 - 支持自定义上下文窗口
 */
function extractSelectionContext(selection, contextBefore = 500, contextAfter = 500) {
    try {
        if (!selection.rangeCount) return '';

        // 如果上下文窗口都为0，直接返回空字符串
        if (contextBefore === 0 && contextAfter === 0) {
            return '';
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        // 获取包含选中文本的段落或容器
        const contextElement = element.closest('p, div, article, section') || element;
        let contextText = contextElement.textContent || '';

        // 如果上下文窗口参数有效，使用自定义窗口大小
        if (contextBefore > 0 || contextAfter > 0) {
            const selectedText = selection.toString();
            const selectedIndex = contextText.indexOf(selectedText);

            if (selectedIndex !== -1) {
                // 使用自定义的前后上下文窗口大小
                const start = Math.max(0, selectedIndex - contextBefore);
                const end = Math.min(contextText.length, selectedIndex + selectedText.length + contextAfter);
                contextText = contextText.substring(start, end);

                // 如果截断了开头或结尾，添加省略号
                if (start > 0) contextText = '...' + contextText;
                if (end < contextElement.textContent.length) contextText = contextText + '...';
            } else {
                // 如果找不到选中文本，使用前置上下文窗口大小
                const maxLength = Math.max(contextBefore, contextAfter, 500);
                contextText = contextText.substring(0, maxLength);
                if (contextText.length < contextElement.textContent.length) {
                    contextText = contextText + '...';
                }
            }
        }

        return contextText;
    } catch (error) {
        console.warn('[TextSelectionHelper] Error extracting context:', error);
        return '';
    }
}

/**
 * 诊断页面的定位环境
 */
function diagnosePage() {
    const info = {
        url: window.location.href,
        scrollMethod: 'unknown',
        scrollX: 0,
        scrollY: 0,
        bodyTransform: 'none',
        htmlTransform: 'none',
        bodyPosition: 'static',
        htmlPosition: 'static',
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        visualViewport: null
    };

    // 检测滚动方法
    if (window.pageXOffset !== undefined) {
        info.scrollMethod = 'pageOffset';
        info.scrollX = window.pageXOffset;
        info.scrollY = window.pageYOffset;
    } else if (window.scrollX !== undefined) {
        info.scrollMethod = 'scrollXY';
        info.scrollX = window.scrollX;
        info.scrollY = window.scrollY;
    } else {
        info.scrollMethod = 'documentElement';
        info.scrollX = document.documentElement.scrollLeft || document.body.scrollLeft || 0;
        info.scrollY = document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    // 检测CSS变换
    try {
        info.bodyTransform = window.getComputedStyle(document.body).transform;
        info.htmlTransform = window.getComputedStyle(document.documentElement).transform;
        info.bodyPosition = window.getComputedStyle(document.body).position;
        info.htmlPosition = window.getComputedStyle(document.documentElement).position;
    } catch (e) {
        console.warn('[TextSelectionHelper] Error getting computed styles:', e);
    }

    // 检测Visual Viewport API
    if (window.visualViewport) {
        info.visualViewport = {
            scale: window.visualViewport.scale,
            offsetLeft: window.visualViewport.offsetLeft,
            offsetTop: window.visualViewport.offsetTop
        };
    }

    console.log('[TextSelectionHelper] Page diagnosis:', info);
    return info;
}

/**
 * 获取页面的真实滚动偏移量（处理复杂滚动容器）
 */
function getPageScrollOffset() {
    try {
        // 方法1: 标准方法
        let scrollX = window.pageXOffset || window.scrollX || 0;
        let scrollY = window.pageYOffset || window.scrollY || 0;

        // 方法2: 检查document.documentElement
        if (scrollX === 0 && scrollY === 0) {
            scrollX = document.documentElement.scrollLeft || document.body.scrollLeft || 0;
            scrollY = document.documentElement.scrollTop || document.body.scrollTop || 0;
        }

        // 确保返回数字类型
        return {
            x: Number(scrollX) || 0,
            y: Number(scrollY) || 0
        };
    } catch (error) {
        console.warn('[TextSelectionHelper] Error getting scroll offset:', error);
        return { x: 0, y: 0 };
    }
}

/**
 * 检测博客网站特殊情况
 */
function detectBlogSiteIssues() {
    const issues = [];

    // 检测常见的博客平台
    const hostname = window.location.hostname.toLowerCase();
    const blogPlatforms = ['wordpress', 'blogger', 'medium', 'ghost', 'hexo', 'jekyll', 'csdn', 'cnblogs', 'jianshu'];
    const isBlogSite = blogPlatforms.some(platform => hostname.includes(platform));

    if (isBlogSite) {
        issues.push('blog-platform');
    }

    // 检测可能影响定位的CSS属性
    try {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);

        // 检测margin/padding偏移
        if (parseFloat(bodyStyle.marginTop) !== 0 || parseFloat(bodyStyle.marginLeft) !== 0) {
            issues.push('body-margin');
        }

        if (parseFloat(htmlStyle.marginTop) !== 0 || parseFloat(htmlStyle.marginLeft) !== 0) {
            issues.push('html-margin');
        }

        // 检测overflow设置
        if (bodyStyle.overflow !== 'visible' || htmlStyle.overflow !== 'visible') {
            issues.push('overflow-hidden');
        }

        // 检测是否有容器使用了transform-origin
        const containers = document.querySelectorAll('div, main, article, section');
        for (let i = 0; i < Math.min(containers.length, 10); i++) {
            const containerStyle = window.getComputedStyle(containers[i]);
            if (containerStyle.transform !== 'none' || containerStyle.transformOrigin !== '50% 50% 0px') {
                issues.push('container-transform');
                break;
            }
        }

    } catch (error) {
        console.warn('[TextSelectionHelper] Error detecting blog issues:', error);
    }

    return issues;
}

/**
 * 智能检测最佳定位策略（简化版，优先稳定性）
 */
function detectBestPositioningStrategy(rect) {
    const scroll = getPageScrollOffset();
    const blogIssues = detectBlogSiteIssues();

    // 默认策略：标准absolute定位
    let strategy = {
        name: 'absolute',
        x: rect.right + scroll.x + MINI_ICON_OFFSET.x,
        y: rect.bottom + scroll.y + MINI_ICON_OFFSET.y,
        useFixed: false
    };

    try {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);

        // 检测是否需要特殊处理
        const hasTransforms = bodyStyle.transform !== 'none' || htmlStyle.transform !== 'none';
        const hasComplexPositioning = bodyStyle.position !== 'static' || htmlStyle.position !== 'static';
        const hasViewportScaling = window.visualViewport && window.visualViewport.scale !== 1;
        const isBlogSiteWithIssues = blogIssues.includes('blog-platform') && blogIssues.length > 1;

        // 优先级1: Visual Viewport缩放
        if (hasViewportScaling) {
            const vv = window.visualViewport;
            strategy = {
                name: 'visualViewport',
                x: (rect.right + MINI_ICON_OFFSET.x - vv.offsetLeft) / vv.scale,
                y: (rect.bottom + MINI_ICON_OFFSET.y - vv.offsetTop) / vv.scale,
                useFixed: true
            };
            console.log('[TextSelectionHelper] Using visualViewport positioning');
        }
        // 优先级2: CSS变换或复杂定位
        else if (hasTransforms || hasComplexPositioning) {
            strategy = {
                name: 'fixed',
                x: rect.right + MINI_ICON_OFFSET.x,
                y: rect.bottom + MINI_ICON_OFFSET.y,
                useFixed: true
            };
            console.log('[TextSelectionHelper] Using fixed positioning due to transforms/positioning');
        }
        // 优先级3: 博客网站优化
        else if (isBlogSiteWithIssues) {
            let adjustedX = rect.right + scroll.x + MINI_ICON_OFFSET.x;
            let adjustedY = rect.bottom + scroll.y + MINI_ICON_OFFSET.y;

            // 补偿body和html的margin
            adjustedX -= parseFloat(bodyStyle.marginLeft) || 0;
            adjustedY -= parseFloat(bodyStyle.marginTop) || 0;
            adjustedX -= parseFloat(htmlStyle.marginLeft) || 0;
            adjustedY -= parseFloat(htmlStyle.marginTop) || 0;

            strategy = {
                name: 'blog-optimized',
                x: adjustedX,
                y: adjustedY,
                useFixed: false
            };
            console.log('[TextSelectionHelper] Using blog-optimized positioning');
        }
        // 默认: 标准absolute定位（已设置）
        else {
            console.log('[TextSelectionHelper] Using standard absolute positioning');
        }

    } catch (error) {
        console.warn('[TextSelectionHelper] Error detecting positioning strategy:', error);
        // 出错时使用最安全的fixed定位
        strategy = {
            name: 'fixed-fallback',
            x: rect.right + MINI_ICON_OFFSET.x,
            y: rect.bottom + MINI_ICON_OFFSET.y,
            useFixed: true
        };
    }

    return strategy;
}

/**
 * 获取元素相对于页面的绝对位置（兼容各种定位上下文）
 */
function getAbsolutePosition(rect) {
    return detectBestPositioningStrategy(rect);
}

/**
 * 计算选项栏的绝对位置（简化版，与mini icon保持一致）
 */
function getOptionsBarPosition(iconRect, optionsBarRect) {
    const scroll = getPageScrollOffset();

    // 计算选项栏应该出现的位置（图标下方居中）
    const targetX = iconRect.left + (iconRect.width / 2) - (optionsBarRect.width / 2);
    const targetY = iconRect.bottom + 8;

    // 使用与mini icon相同的策略检测逻辑
    const blogIssues = detectBlogSiteIssues();

    try {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);

        const hasTransforms = bodyStyle.transform !== 'none' || htmlStyle.transform !== 'none';
        const hasComplexPositioning = bodyStyle.position !== 'static' || htmlStyle.position !== 'static';
        const hasViewportScaling = window.visualViewport && window.visualViewport.scale !== 1;
        const isBlogSiteWithIssues = blogIssues.includes('blog-platform') && blogIssues.length > 1;

        // 与mini icon使用相同的优先级逻辑
        if (hasViewportScaling) {
            const vv = window.visualViewport;
            return {
                name: 'visualViewport',
                x: (targetX - vv.offsetLeft) / vv.scale,
                y: (targetY - vv.offsetTop) / vv.scale,
                useFixed: true
            };
        } else if (hasTransforms || hasComplexPositioning) {
            return {
                name: 'fixed',
                x: targetX,
                y: targetY,
                useFixed: true
            };
        } else if (isBlogSiteWithIssues) {
            let adjustedX = targetX + scroll.x;
            let adjustedY = targetY + scroll.y;

            // 补偿body和html的margin
            adjustedX -= parseFloat(bodyStyle.marginLeft) || 0;
            adjustedY -= parseFloat(bodyStyle.marginTop) || 0;
            adjustedX -= parseFloat(htmlStyle.marginLeft) || 0;
            adjustedY -= parseFloat(htmlStyle.marginTop) || 0;

            return {
                name: 'blog-optimized',
                x: adjustedX,
                y: adjustedY,
                useFixed: false
            };
        }

    } catch (error) {
        console.warn('[TextSelectionHelper] Error detecting options bar positioning strategy:', error);
        // 出错时使用fixed定位
        return {
            name: 'fixed-fallback',
            x: targetX,
            y: targetY,
            useFixed: true
        };
    }

    // 默认使用absolute定位
    return {
        name: 'absolute',
        x: targetX + scroll.x,
        y: targetY + scroll.y,
        useFixed: false
    };
}

/**
 * 显示 mini icon (改进的定位算法)
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

    // 诊断页面环境（仅在第一次显示时）
    if (!window.pagetalkDiagnosed) {
        diagnosePage();
        window.pagetalkDiagnosed = true;
    }

    // 创建 mini icon 元素
    const miniIcon = document.createElement('div');
    miniIcon.className = 'pagetalk-selection-helper pagetalk-mini-icon';
    miniIcon.innerHTML = `<img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="20" height="20">`;

    // 使用改进的定位算法
    const position = getAbsolutePosition(rect);

    // 防御性编程：确保position对象包含必要的属性
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        console.error('[TextSelectionHelper] Invalid position object:', position);
        return;
    }

    if (position.useFixed) {
        // 如果检测到复杂变换，使用fixed定位
        miniIcon.style.position = 'fixed';
        miniIcon.style.left = `${position.x}px`;
        miniIcon.style.top = `${position.y}px`;
        console.log('[TextSelectionHelper] Using fixed positioning due to CSS transforms');
    } else {
        // 正常情况使用absolute定位
        miniIcon.style.left = `${position.x}px`;
        miniIcon.style.top = `${position.y}px`;
    }

    console.log('[TextSelectionHelper] Mini icon positioned at:', position);
    
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
    console.log('[TextSelectionHelper] Mini icon added to DOM at position:', position.x, position.y);

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
        const _tr = getTranslationFunction();

        // 构建选项列表
        const options = [];
        for (const optionId of optionsOrder) {
            if (optionId === 'interpret') {
                options.push({ id: 'interpret', name: _tr('interpret'), icon: getOptionIcon('interpret') });
            } else if (optionId === 'translate') {
                options.push({ id: 'translate', name: _tr('translate'), icon: getOptionIcon('translate') });
            } else if (optionId === 'chat') {
                options.push({ id: 'chat', name: _tr('chat'), icon: getOptionIcon('chat') });
            } else {
                // 检查是否是自定义选项
                const customOption = settings.customOptions?.find(opt => opt.id === optionId);
                if (customOption) {
                    options.push({
                        id: customOption.id,
                        name: customOption.name,
                        icon: getOptionIcon(customOption.id, customOption.icon)
                    });
                }
            }
        }

        // 创建选项栏
        const optionsBar = document.createElement('div');
        optionsBar.className = 'pagetalk-selection-helper pagetalk-options-bar';
    
        // 构建选项栏内容 - icon在左侧，选项在右侧
        let optionsHTML = `
            <div class="pagetalk-options-bar-icon">
                <img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="16" height="16">
            </div>
            <div class="pagetalk-options-grid">
        `;

        // 将选项按每行6个进行分组
        const optionsPerRow = 6;
        for (let i = 0; i < options.length; i += optionsPerRow) {
            optionsHTML += '<div class="pagetalk-options-row">';
            const rowOptions = options.slice(i, i + optionsPerRow);
            rowOptions.forEach(option => {
                optionsHTML += `
                    <div class="pagetalk-option" data-option="${option.id}">
                        <span class="pagetalk-option-icon">${option.icon}</span>
                        <span class="pagetalk-option-text">${option.name}</span>
                    </div>
                `;
            });
            optionsHTML += '</div>';
        }

        optionsHTML += '</div>';

        optionsBar.innerHTML = optionsHTML;

        // 设置样式 - 使用CSS类，只设置位置相关的样式
        optionsBar.style.cssText = `
            position: absolute;
            z-index: 2147483647;
            opacity: 0;
            transform: translateY(10px);
        `;

        // 先添加到 DOM 以获取选项栏的实际宽度
        document.body.appendChild(optionsBar);

        // 使用专用的选项栏定位算法
        const iconRect = triggerElement.getBoundingClientRect();
        const optionsBarRect = optionsBar.getBoundingClientRect();

        const position = getOptionsBarPosition(iconRect, optionsBarRect);

        // 防御性编程：确保position对象包含必要的属性
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            console.error('[TextSelectionHelper] Invalid options bar position object:', position);
            return;
        }

        if (position.useFixed) {
            optionsBar.style.position = 'fixed';
            optionsBar.style.left = `${position.x}px`;
            optionsBar.style.top = `${position.y}px`;
        } else {
            optionsBar.style.left = `${position.x}px`;
            optionsBar.style.top = `${position.y}px`;
        }

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

    const _tr = getTranslationFunction();
    const defaultOptions = [
        { id: 'interpret', name: _tr('interpret'), icon: getOptionIcon('interpret') },
        { id: 'translate', name: _tr('translate'), icon: getOptionIcon('translate') },
        { id: 'chat', name: _tr('chat'), icon: getOptionIcon('chat') }
    ];

    const optionsBar = document.createElement('div');
    optionsBar.className = 'pagetalk-selection-helper pagetalk-options-bar';

    let optionsHTML = `
        <div class="pagetalk-options-bar-icon">
            <img src="${chrome.runtime.getURL('magic.png')}" alt="PageTalk" width="16" height="16">
        </div>
        <div class="pagetalk-options-grid">
    `;

    // 将选项按每行6个进行分组
    const optionsPerRow = 6;
    for (let i = 0; i < defaultOptions.length; i += optionsPerRow) {
        optionsHTML += '<div class="pagetalk-options-row">';
        const rowOptions = defaultOptions.slice(i, i + optionsPerRow);
        rowOptions.forEach(option => {
            optionsHTML += `
                <div class="pagetalk-option" data-option="${option.id}">
                    <span class="pagetalk-option-icon">${option.icon}</span>
                    <span class="pagetalk-option-text" data-i18n="${option.name}">${option.name}</span>
                </div>
            `;
        });
        optionsHTML += '</div>';
    }

    optionsHTML += '</div>';

    optionsBar.innerHTML = optionsHTML;

    optionsBar.style.cssText = `
        position: absolute;
        z-index: 2147483647;
        opacity: 0;
        transform: translateY(10px);
    `;

    document.body.appendChild(optionsBar);

    // 使用专用的选项栏定位算法
    const iconRect = triggerElement.getBoundingClientRect();
    const optionsBarRect = optionsBar.getBoundingClientRect();

    const position = getOptionsBarPosition(iconRect, optionsBarRect);

    // 防御性编程：确保position对象包含必要的属性
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        console.error('[TextSelectionHelper] Invalid default options bar position object:', position);
        return;
    }

    if (position.useFixed) {
        optionsBar.style.position = 'fixed';
        optionsBar.style.left = `${position.x}px`;
        optionsBar.style.top = `${position.y}px`;
    } else {
        optionsBar.style.left = `${position.x}px`;
        optionsBar.style.top = `${position.y}px`;
    }
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
    closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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

// 保存全局状态变量到window对象，防止重复声明
window.isSelectionHelperActive = isSelectionHelperActive;

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
                // 更新位置，使用改进的定位算法
                const position = getAbsolutePosition(rect);
                if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                    if (position.useFixed) {
                        currentMiniIcon.style.position = 'fixed';
                        currentMiniIcon.style.left = `${position.x}px`;
                        currentMiniIcon.style.top = `${position.y}px`;
                    } else {
                        currentMiniIcon.style.position = 'absolute';
                        currentMiniIcon.style.left = `${position.x}px`;
                        currentMiniIcon.style.top = `${position.y}px`;
                    }
                } else {
                    console.warn('[TextSelectionHelper] Invalid position in scroll handler:', position);
                }
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

                const position = getOptionsBarPosition(iconRect, optionsBarRect);

                if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                    if (position.useFixed) {
                        currentOptionsBar.style.position = 'fixed';
                        currentOptionsBar.style.left = `${position.x}px`;
                        currentOptionsBar.style.top = `${position.y}px`;
                    } else {
                        currentOptionsBar.style.position = 'absolute';
                        currentOptionsBar.style.left = `${position.x}px`;
                        currentOptionsBar.style.top = `${position.y}px`;
                    }
                } else {
                    console.warn('[TextSelectionHelper] Invalid options bar position in scroll handler:', position);
                }
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

    // 检查是否是自定义选项
    const settings = await getTextSelectionHelperSettings();
    const customOption = settings.customOptions?.find(opt => opt.id === optionId);

    if (optionId === 'chat') {
        // 获取主面板的模型设置
        const currentModel = await getCurrentMainPanelModel();

        // 构建模型选项 - 通过消息传递获取
        let modelOptions = [];
        try {
            // 尝试通过消息传递获取模型列表
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getAvailableModels' }, (response) => {
                    resolve(response);
                });
            });

            if (response && response.models && response.models.length > 0) {
                // 检查是否是新格式（包含提供商信息）
                if (typeof response.models[0] === 'object' && response.models[0].value) {
                    // 新格式：包含提供商信息的对象数组
                    modelOptions = response.models;
                    console.log('[TextSelectionHelper] Got models with provider info from background:', modelOptions);
                } else {
                    // 旧格式：简单的字符串数组，转换为对象格式
                    modelOptions = response.models.map(modelId => ({
                        value: modelId,
                        text: modelId,
                        providerId: 'google',
                        providerName: 'Google'
                    }));
                    console.log('[TextSelectionHelper] Got models from background (legacy format):', modelOptions);
                }
            } else {
                throw new Error('No models received from background');
            }
        } catch (error) {
            console.warn('[TextSelectionHelper] Failed to get models from background, using fallback:', error);
            // 回退到基本模型列表
            modelOptions = ['gemini-2.5-flash', 'gemini-2.5-flash-thinking', 'gemini-2.5-flash-lite-preview-06-17'];
        }

        let modelOptionsHTML = '';

        // 按提供商分组模型
        const modelsByProvider = {};
        modelOptions.forEach(model => {
            // 处理新格式和旧格式
            const modelValue = typeof model === 'object' ? model.value : model;
            const modelText = typeof model === 'object' ? model.text : model;
            const providerId = typeof model === 'object' ? (model.providerId || 'unknown') : 'google';
            const providerName = typeof model === 'object' ? (model.providerName || 'Unknown') : 'Google';

            if (!modelsByProvider[providerId]) {
                modelsByProvider[providerId] = {
                    name: providerName,
                    models: []
                };
            }
            modelsByProvider[providerId].models.push({
                value: modelValue,
                text: modelText,
                providerId: providerId,
                providerName: providerName
            });
        });

        // 按提供商名称排序
        const sortedProviders = Object.entries(modelsByProvider).sort(([, a], [, b]) =>
            a.name.localeCompare(b.name)
        );

        // 为每个提供商创建 optgroup
        sortedProviders.forEach(([providerId, providerData]) => {
            modelOptionsHTML += `<optgroup label="${providerData.name}" data-provider-id="${providerId}">`;

            // 按模型名称排序
            const sortedModels = providerData.models.sort((a, b) => a.text.localeCompare(b.text));

            sortedModels.forEach(model => {
                const selected = model.value === (currentModel || 'gemini-2.5-flash') ? 'selected' : '';
                const dataAttrs = `data-provider-id="${model.providerId}" data-provider-name="${model.providerName}"`;
                modelOptionsHTML += `<option value="${model.value}" ${selected} ${dataAttrs}>${model.text}</option>`;
            });

            modelOptionsHTML += `</optgroup>`;
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
                    // 对助手名称进行翻译处理
                    const _tr = getTranslationFunction();
                    const translatedName = _tr(agent.name);
                    agentOptionsHTML += `<option value="${agent.id}" ${selected}>${translatedName}</option>`;
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
        // 解读、翻译和自定义选项功能窗口
        const _tr = getTranslationFunction();
        let title;

        if (customOption) {
            title = customOption.name;
        } else if (optionId === 'interpret') {
            title = _tr('interpret');
        } else if (optionId === 'translate') {
            title = _tr('translate');
        } else {
            title = optionId; // 回退方案
        }

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

    // 如果是解读、翻译或自定义选项，立即发送请求
    if (optionId === 'interpret' || optionId === 'translate' || customOption) {
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
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                sendChatMessage(windowElement);
            });
            textarea.addEventListener('keydown', (e) => {
                // 修复：在输入法组合期间，不处理Enter键
                if (e.key === 'Enter' && !e.isComposing && !e.shiftKey) {
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
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearChatContext(windowElement);
            });
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
        let optionSettings;

        // 检查是否是自定义选项
        const customOption = settings.customOptions?.find(opt => opt.id === optionId);
        if (customOption) {
            optionSettings = customOption;
        } else {
            optionSettings = settings[optionId];
        }

        if (!optionSettings) {
            throw new Error(`Settings not found for option: ${optionId}`);
        }

        // 根据上下文设置重新提取上下文
        let contextForThisRequest = '';
        if (optionSettings.contextMode === 'full') {
            // 读取全部上下文
            contextForThisRequest = selectionContext;
        } else {
            // 自定义上下文
            const contextBefore = optionSettings.contextBefore !== undefined ? optionSettings.contextBefore : 500;
            const contextAfter = optionSettings.contextAfter !== undefined ? optionSettings.contextAfter : 500;

            if (contextBefore > 0 || contextAfter > 0) {
                // 重新提取上下文，使用当前选项的上下文窗口设置
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    contextForThisRequest = extractSelectionContext(selection, contextBefore, contextAfter);
                }
            }
        }

        // --- 核心修改：构建结构化消息数组 ---
        const messages = [];

        // 1. 系统提示词 - 简化，避免混淆
        let systemPrompt = '你是一个专业的文本分析助手。请根据用户的指令处理选中的文本内容。';

        messages.push({ role: 'system', content: systemPrompt });

        // 2. 用户消息 - 将指令和内容清晰分离
        let userMessage = `${optionSettings.systemPrompt || '请解释一下：'}选中的文本：\n\n"${selectedText}"`;

        if (contextForThisRequest && contextForThisRequest !== selectedText) {
            userMessage += `\n\n相关上下文：\n"${contextForThisRequest}"`;
        }

        messages.push({ role: 'user', content: userMessage });

        // --- 修改结束 ---

        // 准备响应区域
        const responseArea = windowElement.querySelector('.pagetalk-response-area');
        if (responseArea) {
            responseArea.innerHTML = `
                <div class="pagetalk-response-content markdown-rendered"></div>
                <div class="pagetalk-response-actions">
                    <button class="pagetalk-copy-btn" data-i18n-title="copyAll" title="复制">
                        <svg class="copy-icon" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                        <svg class="check-icon" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                    </button>
                    <button class="pagetalk-regenerate-btn" data-i18n-title="regenerate" title="重新生成">
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
        await callAIAPI(messages, optionSettings.model, optionSettings.temperature, (text, isComplete) => {
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

                // 渲染动态内容 (KaTeX 和 Mermaid)
                renderDynamicContent(responseContent, !isComplete);

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
        }, null, null, optionSettings.maxOutputLength);

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
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
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

    const _tr = getTranslationFunction();
    responseArea.innerHTML = `
        <div class="pagetalk-error">
            <div class="pagetalk-error-message">${_tr('error')}: ${errorMessage}</div>
            <button class="pagetalk-retry-btn">${_tr('retry')}</button>
        </div>
    `;

    const retryBtn = responseArea.querySelector('.pagetalk-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
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

    // 添加用户消息到历史记录
    addToChatHistory(windowId, 'user', message);

    // 设置流式状态
    const requestId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    streamingStates.set(windowId, { isStreaming: true, requestId: requestId, streamListener: null });

    // 更新发送按钮为暂停状态
    updateSendButtonToStopState(sendBtn, windowId);

    try {
        // 获取对话设置
        const settings = await getTextSelectionHelperSettings();
        const chatSettings = settings.chat;

        // 根据对话设置重新提取上下文
        let contextForChat = '';
        if (chatSettings.contextMode === 'full') {
            // 读取全部上下文
            contextForChat = selectionContext;
        } else {
            // 自定义上下文：基于已保存的选择范围重新提取
            const contextBefore = chatSettings.contextBefore !== undefined ? chatSettings.contextBefore : 500;
            const contextAfter = chatSettings.contextAfter !== undefined ? chatSettings.contextAfter : 500;

            if (contextBefore > 0 || contextAfter > 0) {
                // 使用保存的选择范围重新提取上下文，而不是当前可能已丢失的选择
                if (currentSelectionRange) {
                    // 创建一个临时的selection对象来重新提取上下文
                    const tempSelection = window.getSelection();
                    tempSelection.removeAllRanges();
                    tempSelection.addRange(currentSelectionRange.cloneRange());
                    contextForChat = extractSelectionContext(tempSelection, contextBefore, contextAfter);
                    tempSelection.removeAllRanges(); // 清理临时选择
                } else {
                    // 如果没有保存的选择范围，使用默认上下文
                    contextForChat = selectionContext;
                }
            }
        }

        // --- 核心修改：构建结构化消息数组 ---
        const messages = [];

        // 1. 获取助手和系统提示词
        const currentAgent = await getCurrentWindowAgent(windowElement);
        let systemPrompt = (currentAgent && currentAgent.systemPrompt)
            ? currentAgent.systemPrompt
            : '你是一个有用的划词助手。';

        // 2. 将选中文本和页面上下文作为系统指令的一部分
        systemPrompt += `\n\n# 对话背景\n用户在网页上划选了以下文本进行对话，请始终围绕此核心文本展开。`;
        systemPrompt += `\n- **核心文本**: "${selectedText}"`;
        if (contextForChat && contextForChat !== selectedText) {
            systemPrompt += `\n- **相关上下文**: "${contextForChat}"`;
        }
        messages.push({ role: 'system', content: systemPrompt });

        // 3. 添加聊天历史
        const history = getChatHistory(windowId);
        history.forEach(histMsg => {
            // 只添加用户和助手的消息到历史记录中
            if (histMsg.role === 'user' || histMsg.role === 'assistant') {
                 messages.push(histMsg);
            }
        });

        // 注意：当前用户消息已经通过 addToChatHistory 添加到 history 数组的末尾，
        // 所以上面的循环已经包含了当前用户消息。我们不需要再单独添加。

        // --- 修改结束 ---

        // 重置滚动状态（新请求开始）
        functionWindowScrolledUp = false;
        shouldAdjustHeight = true;

        // 添加独立的思考动画（不在聊天气泡内）
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        const thinkingElement = document.createElement('div');
        thinkingElement.className = 'pagetalk-thinking-message';
        thinkingElement.innerHTML = `
            <div class="pagetalk-thinking-bubble">
                <div class="thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
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
            <div class="pagetalk-message-content markdown-rendered">
                <div class="pagetalk-message-actions">
                    <button class="pagetalk-copy-btn" data-i18n-title="copyAll" title="复制">
                        <svg class="copy-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                        <svg class="check-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                    </button>
                    <button class="pagetalk-regenerate-btn" data-i18n-title="regenerate" title="重新生成">
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                    </button>
                    <button class="pagetalk-delete-btn" data-i18n-title="deleteMessage" title="删除">
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        const messageContent = aiMessageElement.querySelector('.pagetalk-message-content');
        let fullResponse = '';

        // 获取当前窗口选择的模型
        const modelSelect = windowElement.querySelector('.pagetalk-model-select');
        const currentModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

        const temperature = currentAgent ? currentAgent.temperature : 0.7;
        const maxOutputLength = currentAgent ? currentAgent.maxTokens : null;

        console.log('[TextSelectionHelper] Chat using agent:', currentAgent ? currentAgent.name : 'default', 'temperature:', temperature);

        // 调用API，现在传递的是消息数组
        await callAIAPI(messages, currentModel, temperature, (text, isComplete) => {
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

                // 保存按钮容器
                const actionsContainer = messageContent.querySelector('.pagetalk-message-actions');

                // 更新内容，但保留按钮容器
                messageContent.innerHTML = renderedContent;

                // 渲染动态内容 (KaTeX 和 Mermaid)
                renderDynamicContent(messageContent, !isComplete);

                // 重新添加按钮容器
                if (actionsContainer) {
                    messageContent.appendChild(actionsContainer);
                }

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
                // 添加AI响应到历史记录
                addToChatHistory(windowId, 'assistant', fullResponse);

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
        }, requestId, windowId, maxOutputLength);

        // 条件滚动到底部
        if (!functionWindowScrolledUp) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        console.error('[TextSelectionHelper] Chat error:', error);

        // 清除思考动画（如果存在）
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        if (messagesArea) {
            const thinkingElements = messagesArea.querySelectorAll('.pagetalk-thinking-message');
            thinkingElements.forEach(element => {
                element.remove();
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

    // 清除聊天历史记录
    if (windowId) {
        clearChatHistory(windowId);
    }

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
        <div class="pagetalk-message-content">
            ${message}
            <div class="pagetalk-message-actions">
            <button class="pagetalk-copy-btn" data-i18n-title="copyAll" title="复制">
                <svg class="copy-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
                <svg class="check-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
            </button>
            <button class="pagetalk-regenerate-btn" data-i18n-title="regenerate" title="重新生成">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                </svg>
            </button>
            <button class="pagetalk-delete-btn" data-i18n-title="deleteMessage" title="删除">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
            </button>
            </div>
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
                        const deletedCount = allMessages.length - currentIndex;

                        // 移除当前消息及其后的所有消息
                        for (let i = currentIndex; i < allMessages.length; i++) {
                            allMessages[i].remove();
                        }

                        // 从历史记录中删除对应的消息
                        if (windowId) {
                            const history = getChatHistory(windowId);
                            // 删除最后 deletedCount 条消息（因为UI中删除了这么多条）
                            if (history.length >= deletedCount) {
                                history.splice(-deletedCount, deletedCount);
                                console.log(`[TextSelectionHelper] Removed ${deletedCount} messages from history for regenerate`);
                            }
                        }

                        // 重新发送用户消息
                        addChatMessage(windowElement, userText, 'user');

                        // 将用户消息重新添加到历史记录
                        addToChatHistory(windowId, 'user', userText);

                        // 延迟执行，避免事件冲突
                        setTimeout(() => {
                            regenerateChatMessage(windowElement, userText);
                        }, 100);

                    } else if (isAssistantMessage) {
                        // 助手消息：重新生成回复
                        messageElement.remove();

                        // 从历史记录中删除最后一条助手消息
                        if (windowId) {
                            const history = getChatHistory(windowId);
                            if (history.length > 0 && history[history.length - 1].role === 'assistant') {
                                history.pop();
                                console.log('[TextSelectionHelper] Removed last assistant message from history for regenerate');
                            }
                        }

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

        // 获取对话设置
        const settings = await getTextSelectionHelperSettings();
        const chatSettings = settings.chat;

        // 根据对话设置重新提取上下文
        let contextForChat = '';
        if (chatSettings.contextMode === 'full') {
            // 读取全部上下文
            contextForChat = selectionContext;
        } else {
            // 自定义上下文：基于已保存的选择范围重新提取
            const contextBefore = chatSettings.contextBefore !== undefined ? chatSettings.contextBefore : 500;
            const contextAfter = chatSettings.contextAfter !== undefined ? chatSettings.contextAfter : 500;

            if (contextBefore > 0 || contextAfter > 0) {
                // 使用保存的选择范围重新提取上下文，而不是当前可能已丢失的选择
                if (currentSelectionRange) {
                    // 创建一个临时的selection对象来重新提取上下文
                    const tempSelection = window.getSelection();
                    tempSelection.removeAllRanges();
                    tempSelection.addRange(currentSelectionRange.cloneRange());
                    contextForChat = extractSelectionContext(tempSelection, contextBefore, contextAfter);
                    tempSelection.removeAllRanges(); // 清理临时选择
                    console.log('[TextSelectionHelper] Regenerate context extracted with custom settings:', {
                        contextBefore,
                        contextAfter,
                        contextLength: contextForChat.length,
                        contextPreview: contextForChat.substring(0, 100) + '...'
                    });
                } else {
                    // 如果没有保存的选择范围，使用默认上下文
                    contextForChat = selectionContext;
                }
            }
        }

        // --- 核心修改：构建结构化消息数组 ---
        const messages = [];

        // 1. 获取助手和系统提示词
        const currentAgent = await getCurrentWindowAgent(windowElement);
        let systemPrompt = (currentAgent && currentAgent.systemPrompt)
            ? currentAgent.systemPrompt
            : '你是一个有用的划词助手。';

        // 2. 将选中文本和页面上下文作为系统指令的一部分
        systemPrompt += `\n\n# 对话背景\n用户在网页上划选了以下文本进行对话，请始终围绕此核心文本展开。`;
        systemPrompt += `\n- **核心文本**: "${selectedText}"`;
        if (contextForChat && contextForChat !== selectedText) {
            systemPrompt += `\n- **相关上下文**: "${contextForChat}"`;
        }
        messages.push({ role: 'system', content: systemPrompt });

        // 3. 添加聊天历史
        const history = getChatHistory(windowId);
        history.forEach(histMsg => {
            // 只添加用户和助手的消息到历史记录中
            if (histMsg.role === 'user' || histMsg.role === 'assistant') {
                 messages.push(histMsg);
            }
        });

        // --- 修改结束 ---

        // 设置流式状态
        const requestId = 'regenerate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
        streamingStates.set(windowId, { isStreaming: true, requestId: requestId, streamListener: null });

        // 更新发送按钮为暂停状态
        const sendBtn = windowElement.querySelector('.pagetalk-send-btn');
        updateSendButtonToStopState(sendBtn, windowId);

        // 添加独立的思考动画（不在聊天气泡内）
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        const thinkingElement = document.createElement('div');
        thinkingElement.className = 'pagetalk-thinking-message';
        thinkingElement.innerHTML = `
            <div class="pagetalk-thinking-bubble">
                <div class="thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
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
            <div class="pagetalk-message-content markdown-rendered">
                <div class="pagetalk-message-actions">
                    <button class="pagetalk-copy-btn" data-i18n-title="copyAll" title="复制">
                        <svg class="copy-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                        <svg class="check-icon" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="display: none;">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                    </button>
                    <button class="pagetalk-regenerate-btn" data-i18n-title="regenerate" title="重新生成">
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                    </button>
                    <button class="pagetalk-delete-btn" data-i18n-title="deleteMessage" title="删除">
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        const messageContent = aiMessageElement.querySelector('.pagetalk-message-content');
        let fullResponse = '';

        // 获取当前窗口选择的模型
        const modelSelect = windowElement.querySelector('.pagetalk-model-select');
        const currentModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

        const temperature = currentAgent ? currentAgent.temperature : 0.7;
        const maxOutputLength = currentAgent ? currentAgent.maxTokens : null;

        console.log('[TextSelectionHelper] Regenerate using agent:', currentAgent ? currentAgent.name : 'default', 'temperature:', temperature);

        // 发送到 AI (流式输出)
        await callAIAPI(messages, currentModel, temperature, (text, isComplete) => {
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

                // 保存按钮容器
                const actionsContainer = messageContent.querySelector('.pagetalk-message-actions');

                // 更新内容，但保留按钮容器
                messageContent.innerHTML = renderedContent;

                // 渲染动态内容 (KaTeX 和 Mermaid)
                renderDynamicContent(messageContent, !isComplete);

                // 重新添加按钮容器
                if (actionsContainer) {
                    messageContent.appendChild(actionsContainer);
                }

                // 添加代码块复制按钮（模仿主面板逻辑）
                const codeBlocks = messageContent.querySelectorAll('pre');
                codeBlocks.forEach(addCopyButtonToCodeBlock);

                // 条件调整窗口尺寸：在流式输出过程中始终调整
                if (!userHasManuallyResized) {
                    adjustWindowSize(windowElement);
                }
            }

            if (isComplete) {
                // 添加AI响应到历史记录（重新生成时直接添加新的助手消息，因为旧的已在performRegenerate中删除）
                addToChatHistory(windowId, 'assistant', fullResponse);

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
        }, requestId, windowId, maxOutputLength);

    } catch (error) {
        console.error('[TextSelectionHelper] Regenerate chat error:', error);

        // 清除思考动画（如果存在）
        const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
        if (messagesArea) {
            const thinkingElements = messagesArea.querySelectorAll('.pagetalk-thinking-message');
            thinkingElements.forEach(element => {
                element.remove();
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

    // 获取窗口ID
    const windowId = windowElement.dataset.windowId;

    // 判断是用户消息还是助手消息
    const isUserMessage = messageElement.classList.contains('pagetalk-chat-message-user');
    const isAssistantMessage = messageElement.classList.contains('pagetalk-chat-message-assistant');

    if (isUserMessage) {
        // 删除用户消息：需要删除该消息及其后的所有消息（包括对应的助手回复）
        const allMessages = Array.from(messagesArea.querySelectorAll('.pagetalk-chat-message'));
        const currentIndex = allMessages.indexOf(messageElement);
        const deletedCount = allMessages.length - currentIndex;

        // 删除当前消息及其后的所有消息
        for (let i = currentIndex; i < allMessages.length; i++) {
            allMessages[i].remove();
        }

        // 从历史记录中删除对应的消息
        if (windowId) {
            const history = getChatHistory(windowId);
            // 删除最后 deletedCount 条消息（因为UI中删除了这么多条）
            if (history.length >= deletedCount) {
                history.splice(-deletedCount, deletedCount);
                console.log(`[TextSelectionHelper] Removed ${deletedCount} messages from history`);
            }
        }

        // 引用区域始终保持显示，不需要恢复操作

    } else if (isAssistantMessage) {
        // 删除助手消息：只删除这一条消息
        messageElement.remove();

        // 从历史记录中删除最后一条助手消息
        if (windowId) {
            const history = getChatHistory(windowId);
            if (history.length > 0 && history[history.length - 1].role === 'assistant') {
                history.pop();
                console.log('[TextSelectionHelper] Removed last assistant message from history');
            }
        }

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
 * 调用 AI API - 通过background.js独立处理，支持流式输出
 * @param {Array} messages - 结构化的消息数组
 * @param {string} model - 模型名称
 * @param {number} temperature - 温度参数
 * @param {function} onStream - 流式回调函数
 * @param {number|null} maxOutputLength - 最大输出长度
 */
async function callAIAPI(messages, model, temperature, onStream, maxOutputLength = null) {
    try {
        console.log('[TextSelectionHelper] Calling API via background for model:', model);

        const streamId = 'stream_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);

        const callOptions = {
            temperature: temperature,
            topP: 0.95,
        };
        if (maxOutputLength && parseInt(maxOutputLength) > 0) {
            callOptions.maxTokens = parseInt(maxOutputLength);
        }

        let accumulatedText = '';
        const streamListener = (message) => {
            if (message.action === 'streamUpdate' && message.streamId === streamId) {
                if (message.chunk) {
                    accumulatedText += message.chunk;
                    if (onStream) onStream(accumulatedText, false);
                }
                if (message.isComplete) {
                    if (onStream) onStream(accumulatedText, true);
                    chrome.runtime.onMessage.removeListener(streamListener);
                }
            }
        };
        chrome.runtime.onMessage.addListener(streamListener);

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'callUnifiedAPI',
                model: model,
                messages: messages, // 直接传递消息数组
                options: callOptions,
                streamId: streamId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response.response);
                } else {
                    reject(new Error(response ? response.error : 'Unknown error'));
                }
            });
        });

        return response;
    } catch (error) {
        console.error('[TextSelectionHelper] API call error:', error);
        throw error;
    }
}



/**
 * 获取划词助手设置
 */
async function getTextSelectionHelperSettings() {
    return new Promise(async (resolve) => {
        try {
            // 获取当前语言设置
            const currentLanguage = await getCurrentLanguage();

            chrome.storage.local.get(['textSelectionHelperSettings'], (result) => {
                // 使用translations.js中的默认提示词
                const interpretPrompt = window.getDefaultPrompt ? window.getDefaultPrompt('interpret', currentLanguage) :
                    (trTSH('defaultInterpretPrompt') || '请解释一下：');
                const translatePrompt = window.getDefaultPrompt ? window.getDefaultPrompt('translate', currentLanguage) :
                    (trTSH('defaultTranslatePrompt') || '翻译一下');

                const defaultSettings = {
                    interpret: {
                        model: 'gemini-2.5-flash',
                        systemPrompt: interpretPrompt,
                        temperature: 0.7,
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    translate: {
                        model: 'gemini-2.5-flash',
                        systemPrompt: translatePrompt,
                        temperature: 0.2,
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    chat: {
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    optionsOrder: ['interpret', 'translate', 'chat']
                };

                const settings = result.textSelectionHelperSettings || defaultSettings;

                // 确保chat配置存在
                if (!settings.chat) {
                    settings.chat = {
                        contextMode: 'custom',
                        contextBefore: 500,
                        contextAfter: 500
                    };
                }

                // 确保解读和翻译配置包含contextMode
                if (settings.interpret && !settings.interpret.contextMode) {
                    settings.interpret.contextMode = 'custom';
                    if (settings.interpret.contextBefore === undefined) settings.interpret.contextBefore = 500;
                    if (settings.interpret.contextAfter === undefined) settings.interpret.contextAfter = 500;
                }

                if (settings.translate && !settings.translate.contextMode) {
                    settings.translate.contextMode = 'custom';
                    if (settings.translate.contextBefore === undefined) settings.translate.contextBefore = 500;
                    if (settings.translate.contextAfter === undefined) settings.translate.contextAfter = 500;
                }

                // 智能更新默认提示词：只有当前提示词是默认提示词时才更新
                if (settings.interpret && window.isDefaultPrompt && window.isDefaultPrompt(settings.interpret.systemPrompt, 'interpret')) {
                    settings.interpret.systemPrompt = window.getDefaultPrompt('interpret', currentLanguage);
                }
                if (settings.translate && window.isDefaultPrompt && window.isDefaultPrompt(settings.translate.systemPrompt, 'translate')) {
                    settings.translate.systemPrompt = window.getDefaultPrompt('translate', currentLanguage);
                }

                resolve(settings);
            });
        } catch (error) {
            console.error('[TextSelectionHelper] Error getting settings:', error);
            // 回退到默认设置，使用当前语言
            try {
                const currentLanguage = await getCurrentLanguage();
                const interpretPrompt = window.getDefaultPrompt ? window.getDefaultPrompt('interpret', currentLanguage) :
                    (trTSH('defaultInterpretPrompt') || '请解释一下：');
                const translatePrompt = window.getDefaultPrompt ? window.getDefaultPrompt('translate', currentLanguage) :
                    (trTSH('defaultTranslatePrompt') || '翻译一下');

                const defaultSettings = {
                    interpret: {
                        model: 'gemini-2.5-flash',
                        systemPrompt: interpretPrompt,
                        temperature: 0.7,
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    translate: {
                        model: 'gemini-2.5-flash',
                        systemPrompt: translatePrompt,
                        temperature: 0.2,
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    chat: {
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    optionsOrder: ['interpret', 'translate', 'chat']
                };
                resolve(defaultSettings);
            } catch (langError) {
                // 最终回退
                const defaultSettings = {
                    interpret: {
                        model: 'gemini-2.5-flash',
                        systemPrompt: '请解释一下：',
                        temperature: 0.7,
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    translate: {
                        model: 'gemini-2.5-flash',
                        systemPrompt: '翻译一下：',
                        temperature: 0.2,
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    chat: {
                        contextMode: 'custom', // 'full' 或 'custom'
                        contextBefore: 500,
                        contextAfter: 500
                    },
                    optionsOrder: ['interpret', 'translate', 'chat']
                };
                resolve(defaultSettings);
            }
        }
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
 * 获取当前对话窗口选择的助手设置
 */
function getCurrentWindowAgent(windowElement) {
    return new Promise((resolve) => {
        const agentSelect = windowElement.querySelector('.pagetalk-agent-select');
        const selectedAgentId = agentSelect ? agentSelect.value : null;

        if (!selectedAgentId || selectedAgentId === 'default') {
            // 如果没有选择助手或选择了默认，返回null（使用默认系统提示词）
            resolve(null);
            return;
        }

        chrome.storage.sync.get(['agents'], (result) => {
            if (result.agents && Array.isArray(result.agents)) {
                const selectedAgent = result.agents.find(agent => agent.id === selectedAgentId);
                resolve(selectedAgent || null);
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
    newSendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendChatMessage(windowElement);
    });
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
            // 如果不保留消息，清除所有聊天消息和历史记录
            const messagesArea = windowElement.querySelector('.pagetalk-chat-messages');
            if (messagesArea) {
                messagesArea.innerHTML = '';
            }
            // 同时清除历史记录
            clearChatHistory(windowId);
        } else {
            // 如果保留消息，移除正在输出的消息中的流式光标和思考动画
            const streamingCursors = windowElement.querySelectorAll('.pagetalk-streaming-cursor');
            streamingCursors.forEach(cursor => cursor.remove());

            // 移除思考动画（如果存在）
            const thinkingElements = windowElement.querySelectorAll('.pagetalk-thinking-message');
            thinkingElements.forEach(element => {
                element.remove();
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

    copyButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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



/**
 * 处理划词助手设置变化
 */
window.handleTextSelectionHelperSettingsUpdate = function(newSettings) {
    console.log('[TextSelectionHelper] Handling settings update:', newSettings);

    // 如果选项栏正在显示，重新渲染以反映新的选项顺序
    if (currentOptionsBar) {
        console.log('[TextSelectionHelper] Updating options bar for settings change');
        hideOptionsBar();
        showOptionsBar();
    }
};

/**
 * 重新初始化划词助手
 */
window.reinitializeTextSelectionHelper = function() {
    console.log('[TextSelectionHelper] Reinitializing after extension reload');

    // 清除现有状态
    hideAllInterfaces();

    // 重新初始化
    initTextSelectionHelper();
};

/**
 * 更新功能窗口的语言
 */
function updateFunctionWindowLanguage(windowElement, newLanguage) {
    const _tr = getTranslationFunction();

    // 更新窗口标题
    const titleElement = windowElement.querySelector('.pagetalk-window-title');
    if (titleElement) {
        const optionType = windowElement.dataset.option;
        if (optionType) {
            titleElement.textContent = _tr(optionType);
        }
    }

    // 更新按钮文本
    const copyButtons = windowElement.querySelectorAll('.pagetalk-copy-btn');
    copyButtons.forEach(btn => {
        btn.textContent = _tr('copy');
        btn.title = _tr('copy');
    });

    const regenerateButtons = windowElement.querySelectorAll('.pagetalk-regenerate-btn');
    regenerateButtons.forEach(btn => {
        btn.textContent = _tr('regenerateResponse');
        btn.title = _tr('regenerateResponse');
    });

    // 更新输入框占位符（对话功能）
    const inputElement = windowElement.querySelector('.pagetalk-chat-input');
    if (inputElement) {
        inputElement.placeholder = _tr('userInputPlaceholder');
    }

    // 更新发送按钮标题
    const sendButton = windowElement.querySelector('.pagetalk-send-btn');
    if (sendButton) {
        sendButton.title = _tr('sendMessageTitle');
    }

    // 更新模型选择器标签
    const modelLabel = windowElement.querySelector('.pagetalk-model-label');
    if (modelLabel) {
        modelLabel.textContent = _tr('modelLabel');
    }

    // 更新助手选择器标签
    const agentLabel = windowElement.querySelector('.pagetalk-agent-label');
    if (agentLabel) {
        agentLabel.textContent = _tr('agentLabel');
    }
}

/**
 * 渲染动态内容 (KaTeX 和 Mermaid)
 * @param {HTMLElement} element - 要渲染的容器元素
 * @param {boolean} isStreaming - 是否正在流式输出中
 */
function renderDynamicContent(element, isStreaming = false) {
    // --- 渲染 KaTeX ---
    if (typeof window.renderMathInElement === 'function') {
        try {
            window.renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "\\[", right: "\\]", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\(", right: "\\)", display: false}
                ],
                throwOnError: false // 不因单个错误停止渲染
            });
        } catch (error) {
            console.error('[TextSelectionHelper] KaTeX rendering error:', error);
        }
    }

    // --- 渲染 Mermaid ---
    // 检查Mermaid库是否可用，静默跳过避免日志噪音
    if (typeof mermaid === 'undefined') {
        return;
    }

    // 如果Mermaid还未初始化，尝试初始化一次
    if (!window.textSelectionHelperMermaidInitialized) {
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                logLevel: 'fatal'
            });
            window.textSelectionHelperMermaidInitialized = true;
        } catch (error) {
            // 静默处理初始化失败
            window.textSelectionHelperMermaidInitialized = true;
            return;
        }
    }

    const mermaidPreElements = element.querySelectorAll('pre.mermaid');
    if (mermaidPreElements.length > 0) {
        mermaidPreElements.forEach(async (preElement, index) => {
            const definition = preElement.textContent || '';
            if (!definition.trim()) {
                return; // 静默跳过空定义
            }

            // 如果正在流式输出，检查Mermaid定义是否完整
            if (isStreaming && !isMermaidDefinitionComplete(definition)) {
                return; // 跳过不完整的定义，避免解析错误
            }

            const renderId = `mermaid-selection-${Date.now()}-${index}`;
            const container = document.createElement('div');
            container.className = 'mermaid';
            container.id = `${renderId}-container`;
            container.dataset.mermaidDefinition = definition;

            if (preElement.parentNode) {
                preElement.parentNode.replaceChild(container, preElement);
            } else {
                return; // 静默跳过
            }

            try {
                const { svg } = await mermaid.render(renderId, definition);
                container.innerHTML = svg;

                // 添加点击事件监听器以显示放大预览
                container.addEventListener('click', (event) => {
                    const svgElement = container.querySelector('svg');
                    if (svgElement) {
                        event.stopPropagation();
                        showMermaidModal(svgElement.outerHTML);
                    }
                });

            } catch (error) {
                // 只在非流式输出时显示错误，避免流式输出时的噪音
                if (!isStreaming) {
                    console.warn(`[TextSelectionHelper] Mermaid render failed for chart ${index + 1}:`, error.message);
                }
                container.innerHTML = `<div class="mermaid-error">Mermaid图表渲染失败</div>`;
            }
        });
    }
}

/**
 * 检查Mermaid定义是否完整
 * @param {string} definition - Mermaid定义
 * @returns {boolean} 是否完整
 */
function isMermaidDefinitionComplete(definition) {
    const trimmed = definition.trim();

    // 基本完整性检查
    if (!trimmed) return false;

    // 检查是否以不完整的箭头结尾（常见的流式输出不完整情况）
    const incompletePatterns = [
        /--+$/, // 以多个连字符结尾
        /->$/, // 以箭头开始结尾
        /-->$/, // 以完整箭头结尾但可能还有内容
        /\|\s*$/, // 以管道符结尾
        /\[\s*$/, // 以开括号结尾
        /\{\s*$/, // 以开花括号结尾
        /\(\s*$/, // 以开圆括号结尾
    ];

    return !incompletePatterns.some(pattern => pattern.test(trimmed));
}

// Mermaid模态框相关变量
let currentPanzoomInstance = null;
let mermaidWheelListener = null;

/**
 * 显示 Mermaid 图表放大预览模态框
 * @param {string} svgContent - 要显示的 SVG 图表内容
 */
function showMermaidModal(svgContent) {
    console.log('[TextSelectionHelper] showMermaidModal called. SVG content length:', svgContent?.length);

    // 销毁之前的Panzoom实例
    if (currentPanzoomInstance) {
        currentPanzoomInstance.destroy();
        currentPanzoomInstance = null;
        console.log('[TextSelectionHelper] Previous Panzoom instance destroyed.');
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'pagetalk-mermaid-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2147483648;
        padding: 30px;
        box-sizing: border-box;
        overflow: auto;
    `;

    const content = document.createElement('div');
    content.className = 'pagetalk-mermaid-modal-content';
    content.style.cssText = `
        margin: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        max-width: 95%;
        max-height: 90vh;
    `;
    content.innerHTML = svgContent;

    // 添加关闭按钮
    const closeButton = document.createElement('span');
    closeButton.className = 'pagetalk-mermaid-close-modal';
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        position: absolute;
        top: 15px;
        right: 35px;
        color: #f1f1f1;
        font-size: 40px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        z-index: 2147483649;
        line-height: 1;
        user-select: none;
    `;

    modal.appendChild(content);
    modal.appendChild(closeButton);
    document.body.appendChild(modal);

    // 初始化Panzoom
    const svgElement = content.querySelector('svg');
    if (svgElement && typeof Panzoom !== 'undefined') {
        try {
            // 设置SVG样式
            svgElement.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                height: auto;
                width: auto;
                background-color: white;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                cursor: grab;
            `;

            currentPanzoomInstance = Panzoom(svgElement, {
                maxZoom: 5,
                minZoom: 0.5,
                bounds: true,
                boundsPadding: 0.1
            });
            console.log('[TextSelectionHelper] Panzoom initialized on Mermaid SVG.');

            // 添加滚轮缩放支持
            mermaidWheelListener = (event) => {
                if (currentPanzoomInstance) {
                    event.preventDefault();
                    currentPanzoomInstance.zoomWithWheel(event);
                }
            };
            content.addEventListener('wheel', mermaidWheelListener, { passive: false });
            console.log('[TextSelectionHelper] Wheel listener added to mermaid modal content.');

        } catch (error) {
            console.error('[TextSelectionHelper] Failed to initialize Panzoom:', error);
            currentPanzoomInstance = null;
        }
    } else if (!svgElement) {
        console.warn('[TextSelectionHelper] Could not find SVG element in Mermaid modal to initialize Panzoom.');
    } else if (typeof Panzoom === 'undefined') {
        console.warn('[TextSelectionHelper] Panzoom library not loaded, cannot initialize zoom/pan for Mermaid.');
    }

    // 关闭模态框的函数
    const closeModal = () => {
        // 移除滚轮监听器
        if (mermaidWheelListener && content) {
            content.removeEventListener('wheel', mermaidWheelListener);
            mermaidWheelListener = null;
            console.log('[TextSelectionHelper] Wheel listener removed from mermaid modal content.');
        }

        // 销毁Panzoom实例
        if (currentPanzoomInstance) {
            currentPanzoomInstance.destroy();
            currentPanzoomInstance = null;
            console.log('[TextSelectionHelper] Panzoom instance destroyed.');
        }

        // 移除模态框
        if (modal.parentNode) {
            document.body.removeChild(modal);
        }
        document.removeEventListener('keydown', handleEscape);
    };

    // 点击关闭按钮关闭
    closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation(); // 阻止事件冒泡，防止关闭对话窗口
        closeModal();
    });

    // 点击模态框背景关闭
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // 点击内容区域阻止冒泡
    content.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // ESC键关闭
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', handleEscape);

    // 关闭按钮悬停效果
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.color = '#4674ff';
    });
    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.color = '#f1f1f1';
    });
}

// 全局消息监听器 - 处理模型更新等事件
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'modelsUpdated') {
        // 模型列表更新时刷新所有窗口的模型选择器
        console.log('[TextSelectionHelper] Models updated, refreshing model selectors...');
        refreshAllModelSelectors();
    }
});

/**
 * 刷新所有窗口的模型选择器
 */
async function refreshAllModelSelectors() {
    try {
        // 获取最新的模型列表
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'getAvailableModels' }, (response) => {
                resolve(response);
            });
        });

        if (response && response.models && response.models.length > 0) {
            const modelOptions = response.models;
            console.log('[TextSelectionHelper] Refreshing with new models:', modelOptions);

            // 更新所有现有窗口的模型选择器
            const allWindows = document.querySelectorAll('.pagetalk-function-window');
            allWindows.forEach(windowElement => {
                const modelSelect = windowElement.querySelector('.pagetalk-model-select');
                if (modelSelect) {
                    const currentValue = modelSelect.value;

                    // 清空并重新填充选项
                    modelSelect.innerHTML = '';

                    // 按提供商分组模型
                    const modelsByProvider = {};
                    modelOptions.forEach(model => {
                        // 处理新格式和旧格式
                        const modelValue = typeof model === 'object' ? model.value : model;
                        const modelText = typeof model === 'object' ? model.text : model;
                        const providerId = typeof model === 'object' ? (model.providerId || 'unknown') : 'google';
                        const providerName = typeof model === 'object' ? (model.providerName || 'Unknown') : 'Google';

                        if (!modelsByProvider[providerId]) {
                            modelsByProvider[providerId] = {
                                name: providerName,
                                models: []
                            };
                        }
                        modelsByProvider[providerId].models.push({
                            value: modelValue,
                            text: modelText,
                            providerId: providerId,
                            providerName: providerName
                        });
                    });

                    // 按提供商名称排序
                    const sortedProviders = Object.entries(modelsByProvider).sort(([, a], [, b]) =>
                        a.name.localeCompare(b.name)
                    );

                    // 为每个提供商创建 optgroup
                    sortedProviders.forEach(([providerId, providerData]) => {
                        const optgroup = document.createElement('optgroup');
                        optgroup.label = providerData.name;
                        optgroup.setAttribute('data-provider-id', providerId);

                        // 按模型名称排序
                        const sortedModels = providerData.models.sort((a, b) => a.text.localeCompare(b.text));

                        sortedModels.forEach(model => {
                            const option = document.createElement('option');
                            option.value = model.value;
                            option.textContent = model.text;
                            option.setAttribute('data-provider-id', model.providerId);
                            option.setAttribute('data-provider-name', model.providerName);

                            if (model.value === currentValue) {
                                option.selected = true;
                            }
                            optgroup.appendChild(option);
                        });

                        modelSelect.appendChild(optgroup);
                    });

                    // 如果当前选择的模型不在新列表中，选择第一个可用模型
                    const modelValues = modelOptions.map(model => typeof model === 'object' ? model.value : model);
                    if (!modelValues.includes(currentValue) && modelOptions.length > 0) {
                        const firstModelValue = typeof modelOptions[0] === 'object' ? modelOptions[0].value : modelOptions[0];
                        modelSelect.value = firstModelValue;
                        console.log(`[TextSelectionHelper] Model ${currentValue} no longer available, switched to ${firstModelValue}`);
                    }
                }
            });
        }
    } catch (error) {
        console.warn('[TextSelectionHelper] Failed to refresh model selectors:', error);
    }
}

// 初始化划词助手
initTextSelectionHelper();

} // 结束防重复初始化检查

// 统一翻译辅助（TSH内部使用）：优先 I18n，再回退 translations
function trTSH(key, replacements = {}) {
    try {
        if (window.I18n && typeof window.I18n.tr === 'function') {
            return window.I18n.tr(key, replacements);
        }
    } catch (_) { /* ignore */ }
    const language = window.currentLanguageCache || 'zh-CN';
    let text = window.translations?.[language]?.[key] || window.translations?.['zh-CN']?.[key] || '';
    if (!text) return '';
    for (const ph in replacements) {
        text = text.replace(`{${ph}}`, replacements[ph]);
    }
    return text;
}
