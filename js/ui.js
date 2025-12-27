/**
 * Pagetalk - UI Update and DOM Manipulation Functions
 */
import { generateUniqueId, escapeHtml } from './utils.js';
import { renderDynamicContent, preProcessMermaidHTML } from './render.js';
import { showFullSizeImage } from './image.js'; // Assuming image modal logic is in image.js
import { tr as _ } from './utils/i18n.js';

// --- Global Variables (Accessed via parameters) ---
// let state; // Reference passed in
// let elements; // Reference passed in
// let currentTranslations = {}; // Reference passed in

// 使用 utils/i18n.js 提供的 tr 作为翻译函数

/**
 * 切换标签页
 * @param {string} tabId - 要显示的标签页ID
 * @param {object} elements - DOM elements reference
 * @param {function} switchSettingsSubTab - Callback to switch settings subtab
 */
export function switchTab(tabId, elements, switchSettingsSubTab) {
    elements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
    elements.tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));

    if (tabId === 'settings') {
        const activeSubTab = document.querySelector('.settings-nav-btn.active');
        if (!activeSubTab) {
            switchSettingsSubTab('general'); // Call the function passed from main.js
        }
    }
}

/**
 * 切换设置内部的子标签页
 * @param {string} subTabId - 要显示的子标签页ID ('general', 'agent', 'model')
 * @param {object} elements - DOM elements reference
 */
export function switchSettingsSubTab(subTabId, elements) {
    elements.settingsNavBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subTabId);
    });
    elements.settingsSubContents.forEach(content => {
        content.classList.toggle('active', content.id === `settings-${subTabId}`);
    });
}

/**
 * 向聊天区域添加消息 - 使用markdown-it渲染
 * @param {string|null} content - 文本内容，可以为null
 * @param {'user'|'bot'} sender - 发送者
 * @param {object} options - 选项对象 { isStreaming, images, insertAfterElement, forceScroll, sentContextTabs }
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} addCopyButtonToCodeBlock - Callback to add copy button
 * @param {function} addMessageActionButtons - Callback to add action buttons
 * @param {boolean} isUserNearBottom - Whether user is scrolled near bottom
 * @returns {HTMLElement} 创建的消息元素
 */
export function addMessageToChat(content, sender, options = {}, state, elements, currentTranslations, addCopyButtonToCodeBlock, addMessageActionButtons, isUserNearBottom) {
    const { isStreaming = false, images = [], videos = [], insertAfterElement = null, forceScroll = false, sentContextTabs = [] } = options;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    
    const messageId = (options && options.id) ? options.id : generateUniqueId();
    messageDiv.dataset.messageId = messageId;

    // --- 新增：处理已发送的上下文标签页 (在用户消息之前显示) ---
    let sentTabsContainer = null;
    if (sender === 'user' && sentContextTabs && sentContextTabs.length > 0) {
        sentTabsContainer = document.createElement('div');
        sentTabsContainer.className = 'sent-tabs-container';
        // 关键：将 sentTabsContainer 与它下方的 messageDiv 关联起来
        sentTabsContainer.dataset.messageIdRef = messageId;

        sentContextTabs.forEach(tab => {
            const tabItem = document.createElement('div');
            tabItem.className = 'sent-tab-item';
            tabItem.dataset.tabId = tab.id; // Store tab ID for later reference

            const favicon = document.createElement('img');
            favicon.src = tab.favIconUrl || '../magic.png';
            favicon.alt = 'favicon';
            favicon.className = 'sent-tab-favicon';
            tabItem.appendChild(favicon);

            const title = document.createElement('span');
            title.className = 'sent-tab-title';
            title.textContent = tab.title;
            title.title = tab.title; // Tooltip for full title
            tabItem.appendChild(title);

            // 添加关闭按钮
            const closeBtn = document.createElement('button');
            closeBtn.className = 'remove-sent-tab-btn';
            closeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            closeBtn.title = _('removeContextTabTitle', {}, currentTranslations) || 'Remove this tab from context for this message';
            closeBtn.dataset.tabId = tab.id;
            closeBtn.dataset.messageId = messageId; // The ID of the message bubble this tab group is associated with

            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 调用 main.js 中的回调函数来处理状态更新
                if (window.handleRemoveSentTabContext) {
                    window.handleRemoveSentTabContext(closeBtn.dataset.messageId, closeBtn.dataset.tabId);
                }
                // 从 DOM 中移除当前标签项
                tabItem.remove();
                // 如果容器为空，也移除容器
                if (sentTabsContainer.children.length === 0) {
                    sentTabsContainer.remove();
                }
            });
            tabItem.appendChild(closeBtn);

            sentTabsContainer.appendChild(tabItem);
        });
    }
    // --- 结束：处理已发送的上下文标签页 ---

    // --- 新增：处理已发送的图片 (在用户消息之前显示) ---
    let sentImagesContainer = null;
    if (sender === 'user' && images.length > 0) {
        sentImagesContainer = document.createElement('div');
        sentImagesContainer.className = 'sent-images-container'; // 新样式类
        sentImagesContainer.dataset.messageIdRef = messageId;

        let imagesHTML = '<div class="message-images">'; // 复用网格布局样式
        images.forEach((image, index) => {
            const altText = escapeHtml(_('imageAlt', { index: index + 1 }, currentTranslations));
            imagesHTML += `<img class="message-image" src="${escapeHtml(image.dataUrl)}" alt="${altText}" data-index="${index}" data-url="${escapeHtml(image.dataUrl)}">`;
        });
        imagesHTML += '</div>';
        sentImagesContainer.innerHTML = imagesHTML;

        // 为新容器内的图片添加点击事件
        sentImagesContainer.querySelectorAll('.message-image').forEach(img => {
            img.addEventListener('click', () => {
                showFullSizeImage(img.dataset.url, elements);
            });
        });
    }
    // --- 结束：处理已发送的图片 ---

    // 决定插入点
    const parentNode = elements.chatMessages;
    let actualInsertBeforeElement = null;
    if (insertAfterElement && insertAfterElement.parentNode === parentNode) {
        actualInsertBeforeElement = insertAfterElement.nextSibling;
    }

    // 依次插入外部容器
    if (sentTabsContainer) {
        parentNode.insertBefore(sentTabsContainer, actualInsertBeforeElement);
    }
    if (sentImagesContainer) {
        parentNode.insertBefore(sentImagesContainer, actualInsertBeforeElement);
    }
    
    // 然后插入消息气泡
    if (actualInsertBeforeElement) {
        parentNode.insertBefore(messageDiv, actualInsertBeforeElement);
    } else {
        parentNode.appendChild(messageDiv);
    }

    if (isStreaming) {
        return messageDiv; // Return early for streaming
    }

    // --- Non-streaming or final render ---
    let messageHTML = '';
    // 图片渲染逻辑已移到前面创建 sentImagesContainer

    if (sender === 'user' && videos.length > 0) {
        messageHTML += '<div class="message-videos">';
        videos.forEach((video, index) => {
            if (video.type === 'youtube') {
                // YouTube 视频
                const videoId = extractYouTubeVideoId(video.url);
                const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                messageHTML += `
                    <div class="message-video youtube-video" data-video-id="${escapeHtml(videoId)}" data-url="${escapeHtml(video.url)}">
                        <img class="video-thumbnail" src="${escapeHtml(thumbnailUrl)}" alt="YouTube video thumbnail"
                             onerror="this.src='https://img.youtube.com/vi/${escapeHtml(videoId)}/hqdefault.jpg'">
                        <div class="video-overlay">
                            <div class="video-play-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                    <path d="M6.271 5.055a.5.5 0 0 1 .52.038L11 7.055a.5.5 0 0 1 0 .89L6.791 9.907a.5.5 0 0 1-.791-.39V5.604a.5.5 0 0 1 .271-.549z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="video-info">
                            <span class="video-name">${escapeHtml(video.name || 'YouTube Video')}</span>
                        </div>
                    </div>
                `;
            } else if (video.type === 'file') {
                // 本地视频文件
                messageHTML += `
                    <div class="message-video local-video" data-url="${escapeHtml(video.dataUrl)}">
                        <video class="video-thumbnail" src="${escapeHtml(video.dataUrl)}" muted preload="metadata"></video>
                        <div class="video-overlay">
                            <div class="video-play-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                    <path d="M6.271 5.055a.5.5 0 0 1 .52.038L11 7.055a.5.5 0 0 1 0 .89L6.791 9.907a.5.5 0 0 1-.791-.39V5.604a.5.5 0 0 1 .271-.549z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="video-info">
                            <span class="video-name">${escapeHtml(video.name || 'Video File')}</span>
                        </div>
                    </div>
                `;
            }
        });
        messageHTML += '</div>';
    }

    if (content) {
        // Use MarkdownRenderer (assuming it's globally available or passed in)
        messageHTML += window.MarkdownRenderer.render(content);
    }

    messageDiv.innerHTML = messageHTML;

    // 如果用户消息气泡中既没有文本也没有视频，则将其标记为空
    if (sender === 'user' && !content && videos.length === 0) {
        messageDiv.classList.add('empty-bubble');
    }

    // 图片的点击事件监听器已移到 sentImagesContainer 的创建逻辑中

    // Add click listeners for user videos AFTER setting innerHTML
    if (sender === 'user' && videos.length > 0) {
        messageDiv.querySelectorAll('.message-video').forEach(videoEl => {
            videoEl.addEventListener('click', () => {
                const url = videoEl.dataset.url;
                if (videoEl.classList.contains('youtube-video')) {
                    // 在新标签页中打开YouTube视频
                    window.open(url, '_blank');
                } else if (videoEl.classList.contains('local-video')) {
                    // 创建简单的视频播放模态框
                    showVideoModal(url, elements);
                }
            });
        });
    }


    const codeBlocks = messageDiv.querySelectorAll('.code-block');
    codeBlocks.forEach(addCopyButtonToCodeBlock); // Use callback

    addMessageActionButtons(messageDiv, content || ''); // Use callback

    renderDynamicContent(messageDiv, elements, messageId); // Render KaTeX/Mermaid with messageId for caching

    // Scroll only if forced or user is near bottom
    if (forceScroll || isUserNearBottom) {
        setTimeout(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    }

    return messageDiv;
}


/**
 * 更新流式消息 - 使用markdown-it渲染，并添加打字机效果
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} content - 当前累积的内容
 * @param {boolean} shouldScroll - Whether to scroll to bottom
 * @param {object} elements - DOM elements reference
 */
export function updateStreamingMessage(messageElement, content, shouldScroll, elements) {
    const formattedContent = window.MarkdownRenderer.render(content);

    // 保存 messageActions
    const messageActions = messageElement.querySelector('.message-actions');

    // --- Pre-process HTML to inject cached Mermaid SVGs ---
    // This prevents the "flash" of raw text before the async render kicks in
    const messageId = messageElement.dataset.messageId;
    const processedContent = preProcessMermaidHTML(formattedContent, messageId);

    // 更新 DOM
    messageElement.classList.add('streaming'); // Add streaming class to prevent hover interactions
    messageElement.innerHTML = processedContent;

    // Trigger async render (will use cache if available or render new content)
    // We pass messageId so renderDynamicContent knows where to look/store in cache
    renderDynamicContent(messageElement, elements, messageId);

    // 恢复 messageActions
    if (messageActions) {
        messageElement.appendChild(messageActions);
    }

    // 找到最后一个文本节点，为最后几个字符添加渐变效果
    const applyFadeEffect = (container) => {
        // 获取所有文本节点
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let lastTextNode = null;
        let node;
        while (node = walker.nextNode()) {
            // 跳过空白节点
            if (node.textContent.trim()) {
                lastTextNode = node;
            }
        }

        if (lastTextNode && lastTextNode.parentNode) {
            const text = lastTextNode.textContent;
            if (text.length > 0) {
                // 使用多层渐变实现更丝滑的效果
                // 最后8个字符分成3段，每段有不同的透明度起点
                const totalFadeLength = Math.min(8, text.length);
                const stableText = text.slice(0, -totalFadeLength);
                const fadeText = text.slice(-totalFadeLength);
                
                // 将渐变文字分成3段
                const segment1Len = Math.ceil(fadeText.length / 3);
                const segment2Len = Math.ceil(fadeText.length / 3);
                const segment3Len = fadeText.length - segment1Len - segment2Len;
                
                const segment1 = fadeText.slice(0, segment1Len);
                const segment2 = fadeText.slice(segment1Len, segment1Len + segment2Len);
                const segment3 = fadeText.slice(segment1Len + segment2Len);
                
                // 创建包含渐变文字的 span（3段不同透明度）
                const fadeContainer = document.createDocumentFragment();
                
                if (segment1) {
                    const span1 = document.createElement('span');
                    span1.className = 'streaming-text-fade streaming-text-fade-1';
                    span1.textContent = segment1;
                    fadeContainer.appendChild(span1);
                }
                if (segment2) {
                    const span2 = document.createElement('span');
                    span2.className = 'streaming-text-fade streaming-text-fade-2';
                    span2.textContent = segment2;
                    fadeContainer.appendChild(span2);
                }
                if (segment3) {
                    const span3 = document.createElement('span');
                    span3.className = 'streaming-text-fade streaming-text-fade-3';
                    span3.textContent = segment3;
                    fadeContainer.appendChild(span3);
                }
                
                // 替换原文本节点
                lastTextNode.textContent = stableText;
                lastTextNode.parentNode.insertBefore(fadeContainer, lastTextNode.nextSibling);
            }
        }
    };

    applyFadeEffect(messageElement);

    if (shouldScroll) {
        setTimeout(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    }
}

/**
 * 完成机器人消息的最终渲染（流结束后调用）
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} finalContent - 最终的完整内容
 * @param {function} addCopyButtonToCodeBlock - Callback
 * @param {function} addMessageActionButtons - Callback
 * @param {function} restoreSendButtonAndInput - Callback
 * @param {boolean} shouldScroll - Whether to scroll to bottom
 * @param {object} elements - DOM elements reference
 */
export function finalizeBotMessage(messageElement, finalContent, addCopyButtonToCodeBlock, addMessageActionButtons, restoreSendButtonAndInput, shouldScroll, elements) {
    // 清理渐变效果的临时 span 元素（如果还有残留）
    const fadeSpans = messageElement.querySelectorAll('.streaming-text-fade');
    fadeSpans.forEach(span => span.remove());

    messageElement.classList.remove('streaming'); // Remove streaming class

    // messageId is already available from the finalizeBotMessage scope if passed or we can just access dataset
    // Actually, finalizeBotMessage doesn't take messageId as arg, but let's see where it comes from.
    // Wait, the error said "redeclare block-scoped variable".
    // Let's just use the dataset one but not redeclare `const messageId`.
    const msgId = messageElement.dataset.messageId;
    // IMPORTANT: Render markdown FIRST, then preprocess the resulting HTML
    const renderedHtml = window.MarkdownRenderer.render(finalContent);
    const processedHtml = preProcessMermaidHTML(renderedHtml, msgId);
    messageElement.innerHTML = processedHtml;

    const codeBlocks = messageElement.querySelectorAll('.code-block');
    codeBlocks.forEach(addCopyButtonToCodeBlock);

    addMessageActionButtons(messageElement, finalContent);

    // Final render, ensure messageId is passed
    renderDynamicContent(messageElement, elements, msgId);

    // Scroll to bottom if user was following the stream
    // Use requestAnimationFrame to wait for layout to settle
    if (shouldScroll) {
        requestAnimationFrame(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'instant' // Use 'instant' to avoid delayed animation conflicts
            });
        });
    }

    restoreSendButtonAndInput(); // Restore button state
}

/**
 * 添加AI思考动画到聊天区域
 * @param {HTMLElement|null} insertAfterElement - Optional element to insert after
 * @param {object} elements - DOM elements reference
 * @param {boolean} isUserNearBottom - Whether user is scrolled near bottom
 * @returns {HTMLElement} The thinking animation element
 */
export function addThinkingAnimation(insertAfterElement = null, elements, isUserNearBottom) {
    const thinkingElement = document.createElement('div');
    thinkingElement.classList.add('message', 'bot-message', 'thinking');

    const thinkingDots = document.createElement('div');
    thinkingDots.classList.add('thinking-dots');
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        thinkingDots.appendChild(dot);
    }
    thinkingElement.appendChild(thinkingDots);

    if (insertAfterElement && insertAfterElement.parentNode === elements.chatMessages) {
        insertAfterElement.insertAdjacentElement('afterend', thinkingElement);
    } else {
        elements.chatMessages.appendChild(thinkingElement);
    }

    // 仅当用户在底部时才滚动，以避免覆盖用户的向上滚动操作
    if (isUserNearBottom) {
        setTimeout(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    }

    return thinkingElement;
}

/**
 * 显示连接状态消息 (模型设置页)
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('success' 或 'error' 或 'info')
 * @param {object} elements - DOM elements reference
 */
export function showConnectionStatus(message, type, elements) {
    if (!elements.connectionStatus) return;
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = 'connection-status ' + type;
    elements.connectionStatus.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            // Check if the message is still the same before hiding
            if (elements.connectionStatus.textContent === message) {
                 elements.connectionStatus.style.display = 'none';
            }
        }, 3000);
    }
}

/**
 * 更新页脚连接状态指示器
 * @param {boolean} isConnected - Connection status
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 */
export function updateConnectionIndicator(isConnected, elements, currentTranslations) {
    if (!elements.connectionIndicator) return;
    elements.connectionIndicator.className = isConnected ? 'connected' : 'disconnected';
    elements.connectionIndicator.textContent = isConnected ? _('connectionIndicatorConnected', {}, currentTranslations) : _('connectionIndicatorDisconnected', {}, currentTranslations);
}

/**
 * 更新页脚上下文状态
 * @param {string|null} contextStatusKey - Translation key ('contextStatusNone', 'contextStatusExtracting', 'contextStatusFailed', 'contextStatusChars')
 * @param {object} replacements - Replacements for the translation key (e.g., { charCount: 123 })
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 */
export function updateContextStatus(contextStatusKey, replacements = {}, elements, currentTranslations) {
    if (!elements.contextStatus) return;
    const prefix = _('contextStatusPrefix', {}, currentTranslations);
    const statusText = _(contextStatusKey, replacements, currentTranslations);
    elements.contextStatus.textContent = `${prefix} ${statusText}`;
}


/**
 * 显示通知提示 (Toast)
 * @param {string} message - 消息内容
 * @param {string} type - 提示类型 ('success' 或 'error')
 * @param {string} [customClass=''] - 可选的自定义CSS类名
 */
export function showToast(message, type, customClass = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} ${customClass}`; // Combine base, type, and custom classes
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow to enable transition
    toast.offsetHeight; 

    toast.classList.add('show');

    // Keep a reference to the timeout
    let currentToastTimeout = setTimeout(() => {
        toast.classList.remove('show'); // Restore automatic hiding
        setTimeout(() => { // Restore automatic hiding
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // Wait for fade out transition
    }, 1500); // Default display time: 2 seconds

}

/**
 * 根据内容调整文本框高度
 * @param {object} elements - DOM elements reference
 */
export function resizeTextarea(elements) {
    const textarea = elements.userInput;
    if (!textarea) return;

    // Temporarily reset height to get accurate scrollHeight
    textarea.style.height = 'auto';

    const computedStyle = getComputedStyle(textarea);
    const paddingY = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
    const borderY = parseFloat(computedStyle.borderTopWidth) + parseFloat(computedStyle.borderBottomWidth);

    // Use scrollHeight, ensure it includes padding and border if box-sizing is border-box (default)
    const scrollHeight = textarea.scrollHeight;

    // Read min/max height from CSS variables or use defaults
    const minHeight = parseFloat(computedStyle.minHeight) || 32; // Default 32px
    const maxHeight = parseFloat(computedStyle.maxHeight) || 160; // Default 160px

    // Calculate the content height (scrollHeight already includes padding/border with border-box)
    let newHeight = scrollHeight;

    // Clamp the height between min and max
    newHeight = Math.max(minHeight, newHeight);
    newHeight = Math.min(newHeight, maxHeight);

    textarea.style.height = newHeight + 'px';

    // Show scrollbar if content exceeds max height
    textarea.style.overflowY = (scrollHeight > maxHeight) ? 'scroll' : 'hidden';
}


/**
 * 设置输入框自适应高度的事件监听
 * @param {object} elements - DOM elements reference
 */
export function setupAutoresizeTextarea(elements) {
    const textarea = elements.userInput;
    if (!textarea) return;

    textarea.addEventListener('input', () => resizeTextarea(elements));
    textarea.addEventListener('paste', () => setTimeout(() => resizeTextarea(elements), 0)); // Handle paste

    // Initial resize
    setTimeout(() => resizeTextarea(elements), 0);
}

/**
 * 更新界面上所有需要翻译的静态元素
 * @param {object} currentTranslations - Translations object
 */
export function updateUIElementsWithTranslations(currentTranslations) {
    if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
        console.warn('No translations loaded, UI update skipped.');
        return;
    }

    const _tr = (key, rep = {}) => _(key, rep, currentTranslations);

    document.documentElement.lang = _tr('htmlLang');
    document.title = _tr('pageTitle');

    // --- Helpers ---
    const setText = (selector, key, rep = {}) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = _tr(key, rep);
        // else console.warn(`Element not found for setText: ${selector}`);
    };
    const setAttr = (selector, attr, key, rep = {}) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute(attr, _tr(key, rep));
       // else console.warn(`Element not found for setAttr: ${selector}`);
    };
    const setPlaceholder = (selector, key, rep = {}) => setAttr(selector, 'placeholder', key, rep);
    const setTitle = (selector, key, rep = {}) => setAttr(selector, 'title', key, rep);

    // --- Apply Translations ---
    setText('label[for="chat-model-selection"]', 'modelLabel');
    setAttr('#chat-model-selection', 'aria-label', 'modelSelectLabel');
    setText('label[for="chat-agent-selection"]', 'agentLabel');
    setAttr('#chat-agent-selection', 'aria-label', 'agentSelectLabel');
    setTitle('#clear-context', 'clearContextTitle');
    setTitle('#close-panel', 'closePanelTitle');
    // Welcome message updated dynamically
    setAttr('#modal-image', 'alt', 'imagePreviewAltTranslated');
    setTitle('#upload-image', 'uploadImageTitle');
    setPlaceholder('#user-input', 'userInputPlaceholder');
    const sendMessageBtn = document.querySelector('#send-message');
    if (sendMessageBtn) {
        const key = sendMessageBtn.classList.contains('stop-streaming') ? 'stopStreamingTitle' : 'sendMessageTitle';
        sendMessageBtn.setAttribute('title', _tr(key));
        sendMessageBtn.setAttribute('aria-label', _tr(key));
    }
    // New: ensure settings close button has translated title
    setTitle('#close-panel-settings', 'closePanelTitle');
    // New: ensure add-provider has title (supports multiple in-card buttons)
    const addProviderBtns = document.querySelectorAll('.add-provider-btn');
    addProviderBtns.forEach(btn => btn.setAttribute('title', _tr('addProvider')));

    // YouTube URL Dialog
    setTitle('#add-youtube-url', 'addYoutubeLinkTitle');
    setText('#youtube-url-dialog h3', 'addYoutubeVideoTitle');
    setText('#youtube-url-dialog p', 'enterYoutubeLinkPrompt');
    setPlaceholder('#youtube-url-input', 'youtubeLinkPlaceholder');
    setText('#cancel-youtube', 'cancelButton');
    setText('#confirm-youtube', 'addButton');

    // Unified Data Management
    setText('.unified-data-title[data-i18n="unifiedImportExportLabel"]', 'unifiedImportExportLabel');
    setText('.unified-data-description[data-i18n="unifiedImportExportHint"]', 'unifiedImportExportHint');
    setText('#export-all-settings span[data-i18n="exportAllButton"]', 'exportAllButton');
    setText('#import-all-settings span[data-i18n="importAllButton"]', 'importAllButton');

    setText('#settings-agent h2', 'agentSettingsHeading');
    setText('#agents-list .agents-list-header h3[data-i18n="agentsListHeading"]', 'agentsListHeading');

    // Footer tabs
    setText('.footer-tab[data-tab="chat"][data-i18n="chatTab"]', 'chatTab');
    setText('.footer-tab[data-tab="settings"][data-i18n="settingsTab"]', 'settingsTab');

    // Status bar
    const contextPrefixEl = document.querySelector('#context-status[data-i18n="contextStatusPrefix"]');
    if (contextPrefixEl) contextPrefixEl.textContent = _tr('contextStatusPrefix');
    setText('#connection-indicator.disconnected[data-i18n="connectionIndicatorDisconnected"]', 'connectionIndicatorDisconnected');

    // Language options text
    const zhOpt = document.querySelector('#language-select option[value="zh-CN"][data-i18n="langZh"]');
    const enOpt = document.querySelector('#language-select option[value="en"][data-i18n="langEn"]');
    if (zhOpt) zhOpt.textContent = _tr('langZh');
    if (enOpt) enOpt.textContent = _tr('langEn');

    // Changelog modal texts
    setText('#changelog-title[data-i18n="changelogTitle"]', 'changelogTitle');
    setText('#never-show-label[data-i18n="changelogNeverShow"]', 'changelogNeverShow');
    setText('#changelog-ok-btn[data-i18n="changelogOK"]', 'changelogOK');

    // Generic: apply data-i18n-title and data-i18n-placeholder
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (!key) return;
        if (el.id === 'send-message' && el.classList.contains('stop-streaming')) {
            el.setAttribute('title', _tr('stopStreamingTitle'));
            return;
        }
        el.setAttribute('title', _tr(key));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', _tr(key));
    });

    setText('#settings-general h2', 'generalSettingsHeading');

    // Language setting card
    setText('.setting-card-title[data-i18n="languageLabel"]', 'languageLabel');
    setText('.setting-card-description[data-i18n="languageDescription"]', 'languageDescription');

    // Chat export setting card
    setText('.setting-card-title[data-i18n="exportChatLabel"]', 'exportChatLabel');
    setText('.setting-card-description[data-i18n="exportChatDescription"]', 'exportChatDescription');
    setText('#export-format option[value="markdown"]', 'exportFormatMarkdown');
    setText('#export-format option[value="text"]', 'exportFormatText');
    setText('#export-chat-history span[data-i18n="exportButton"]', 'exportButton');

    // Proxy setting card
    setText('.setting-card-title[data-i18n="proxyAddressLabel"]', 'proxyAddressLabel');
    setText('.setting-card-description[data-i18n="proxyAddressHint"]', 'proxyAddressHint');

    setText('#settings-model h2', 'modelSettingsHeading');
    setText('label[for="api-key"]', 'apiKeyLabel');
    setPlaceholder('#api-key', 'apiKeyPlaceholder');
    setTitle('#toggle-api-key', 'toggleApiKeyVisibilityTitleTranslated');
    setText('label[for="model-selection"]', 'modelSelectLabelSettings');


    setTitle('#theme-toggle-btn', 'themeToggleTitle'); // Title for the draggable button

    // Handle all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        if (key) {
            element.textContent = _tr(key);
        }
    });

    // Handle all elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.dataset.i18nPlaceholder;
        if (key) {
            element.placeholder = _tr(key);
        }
    });

    // Handle all elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.dataset.i18nTitle;
        if (!key) return;
        if (element.id === 'send-message' && element.classList.contains('stop-streaming')) {
            element.title = _tr('stopStreamingTitle');
            return;
        }
        element.title = _tr(key);
    });

    // Update model container empty state text
    const modelContainer = document.getElementById('selected-models-container');
    if (modelContainer) {
        modelContainer.setAttribute('data-empty-text', _tr('noModelsSelected'));
    }

    // Note: Dynamic elements like agent list items, status messages, etc.,
    // need to be updated when they are created or their state changes,
    // using the _ function with the currentTranslations.
}

/**
 * 恢复发送按钮和输入框到正常状态
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 */
export function restoreSendButtonAndInput(state, elements, currentTranslations) {
    if (!elements.sendMessage) return;

    // 强制彻底重置按钮状态，无论流式状态
    if (state.isStreaming) state.isStreaming = false;
    if (state.userScrolledUpDuringStream) state.userScrolledUpDuringStream = false;

    // 移除所有可能的 loading/sending/stop-streaming 样式
    elements.sendMessage.classList.remove('stop-streaming', 'sending', 'loading');
    elements.sendMessage.disabled = false;
    const sendTitle = _('sendMessageTitle', {}, currentTranslations);
    elements.sendMessage.title = sendTitle;
    elements.sendMessage.setAttribute('aria-label', sendTitle);

    // 清理所有可能的 AbortController
    if (window.GeminiAPI && window.GeminiAPI.currentAbortController) {
        window.GeminiAPI.currentAbortController = null;
    }
    if (window.PageTalkAPI && window.PageTalkAPI.currentAbortController) {
        window.PageTalkAPI.currentAbortController = null;
    }
}

/**
 * 切换 API Key 可见性
 * @param {object} elements - DOM elements reference
 */
export function toggleApiKeyVisibility(elements) {
     if (!elements.toggleApiKey || !elements.apiKeyInput) return;

     const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
     elements.apiKeyInput.type = type;

     const eyeIcon = document.getElementById('eye-icon');
     const eyeSlashIcon = document.getElementById('eye-slash-icon');

     if (eyeIcon && eyeSlashIcon) {
         eyeIcon.style.display = (type === 'text') ? 'none' : 'inline-block';
         eyeSlashIcon.style.display = (type === 'text') ? 'inline-block' : 'none';
     }
}

/**
 * 在聊天界面显示状态消息 (例如内容提取成功)
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('success' 或 'error')
 * @param {object} elements - DOM elements reference
 */
export function showChatStatusMessage(message, type, elements) {
    if (!elements.chatStatusMessage) return;

    elements.chatStatusMessage.textContent = message;
    elements.chatStatusMessage.className = 'chat-status ' + type;

    elements.chatStatusMessage.style.display = 'block';
    elements.chatStatusMessage.style.opacity = '1';
    elements.chatStatusMessage.style.transform = 'translateY(0)';

    if (type === 'success') {
        setTimeout(() => {
            elements.chatStatusMessage.style.opacity = '0';
            elements.chatStatusMessage.style.transform = 'translateY(5px)';
            setTimeout(() => {
                 if (elements.chatStatusMessage.textContent === message) {
                     elements.chatStatusMessage.style.display = 'none';
                 }
            }, 300);
        }, 2000);
    }
}

/**
 * 为代码块添加复制按钮
 * @param {HTMLElement} block - 代码块元素 (<pre>)
 * @param {object} currentTranslations - Translations object
 * @param {function} copyCodeToClipboardCallback - Callback to handle actual copying
 */
export function addCopyButtonToCodeBlock(block, currentTranslations, copyCodeToClipboardCallback) {
    // Avoid adding multiple buttons
    if (block.querySelector('.code-copy-button')) {
        return;
    }

    const copyButton = document.createElement('button');
    copyButton.classList.add('code-copy-button');
    copyButton.title = _('copyCode', {}, currentTranslations);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");

    const rectElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectElement.setAttribute("x", "9"); rectElement.setAttribute("y", "9");
    rectElement.setAttribute("width", "13"); rectElement.setAttribute("height", "13");
    rectElement.setAttribute("rx", "2"); rectElement.setAttribute("ry", "2");

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    svg.appendChild(rectElement);
    svg.appendChild(pathElement);
    copyButton.appendChild(svg);

    copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const encodedCode = block.getAttribute('data-code');
        let codeToCopy = '';
        if (encodedCode) {
            try {
                codeToCopy = decodeURIComponent(atob(encodedCode));
            } catch (err) {
                console.error("Error decoding base64 code:", err);
                codeToCopy = block.querySelector('code')?.innerText || ''; // Fallback
            }
        } else {
            console.warn('Code block missing data-code attribute.');
            codeToCopy = block.querySelector('code')?.innerText || ''; // Fallback
        }
        copyCodeToClipboardCallback(codeToCopy, copyButton); // Use callback
    });

    block.appendChild(copyButton);
}

/**
 * 添加消息操作按钮（复制、删除、重新生成）
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} content - 消息的原始文本内容
 * @param {object} currentTranslations - Translations object
 * @param {function} copyMessageContentCallback - Callback
 * @param {function} regenerateMessageCallback - Callback
 * @param {function} deleteMessageCallback - Callback
 */
export function addMessageActionButtons(messageElement, content, currentTranslations, copyMessageContentCallback, regenerateMessageCallback, deleteMessageCallback) {
    const messageId = messageElement.dataset.messageId;
    if (!messageId) return; // Need ID for actions

    if (messageElement.querySelector('.message-actions')) {
        return; // Avoid duplicate buttons
    }

    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';

    const buttonsToAppend = [];

    // Copy Button
    const copyButton = document.createElement('button');
    copyButton.classList.add('copy-button'); // Use base class
    copyButton.title = _('copyAll', {}, currentTranslations);
    copyButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    `;
    copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        copyMessageContentCallback(messageElement, content, copyButton); // Use callback
    });
    buttonsToAppend.push(copyButton);

    // Regenerate Button
    const regenerateButton = document.createElement('button');
    regenerateButton.className = 'message-action-btn regenerate-btn';
    regenerateButton.title = _('regenerate', {}, currentTranslations);
    regenerateButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
        </svg>
    `;
    regenerateButton.addEventListener('click', (e) => {
        e.stopPropagation();
        regenerateMessageCallback(messageId); // Use callback
    });
    buttonsToAppend.push(regenerateButton);

    // Delete Button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'message-action-btn delete-btn';
    deleteButton.title = _('deleteMessage', {}, currentTranslations);
    deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
    `;
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMessageCallback(messageId); // Use callback
    });
    buttonsToAppend.push(deleteButton);

    buttonsToAppend.forEach(button => messageActions.appendChild(button));
    messageElement.appendChild(messageActions);
}

/**
 * 复制代码块内容到剪贴板 (UI Feedback part)
 * @param {HTMLElement} buttonElement - 复制按钮元素
 */
export function showCopyCodeFeedback(buttonElement) {
    const originalHTML = buttonElement.innerHTML;
    // Use a simpler checkmark SVG for feedback
    buttonElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#34a853" viewBox="0 0 16 16">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    `;
    buttonElement.disabled = true; // Briefly disable

    setTimeout(() => {
        buttonElement.innerHTML = originalHTML;
        buttonElement.disabled = false;
    }, 1500); // Shorter feedback duration
}

/**
 * 复制消息内容到剪贴板 (UI Feedback part)
 * @param {HTMLElement} buttonElement - 复制按钮元素
 */
export function showCopyMessageFeedback(buttonElement) {
    const originalSVG = buttonElement.querySelector('svg');
    if (!originalSVG) return; // Safety check

    const newSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    newSVG.setAttribute("viewBox", "0 0 24 24");
    newSVG.setAttribute("width", "14");
    newSVG.setAttribute("height", "14");
    newSVG.setAttribute("fill", "none");
    newSVG.setAttribute("stroke", "#34a853"); // Green checkmark
    newSVG.setAttribute("stroke-width", "2");

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", "M20 6L9 17l-5-5");
    newSVG.appendChild(pathElement);

    const originalSVGCopy = originalSVG.cloneNode(true);
    buttonElement.replaceChild(newSVG, originalSVG);
    buttonElement.disabled = true; // Briefly disable

    setTimeout(() => {
        // Check if the button still exists and has the checkmark before restoring
        if (buttonElement.contains(newSVG)) {
             buttonElement.replaceChild(originalSVGCopy, newSVG);
        }
        buttonElement.disabled = false;
    }, 1500);
}

/**
 * 从YouTube URL中提取视频ID
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
function extractYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
}

/**
 * 显示视频播放模态框
 * @param {string} videoUrl - 视频URL
 * @param {object} elements - DOM elements reference
 */
function showVideoModal(videoUrl, elements) {
    // 创建简单的视频模态框
    let videoModal = document.getElementById('video-modal');
    if (!videoModal) {
        videoModal = document.createElement('div');
        videoModal.id = 'video-modal';
        videoModal.className = 'image-modal'; // 复用图片模态框的样式
        videoModal.innerHTML = `
            <span class="close-modal">&times;</span>
            <video id="modal-video" class="modal-content" controls autoplay style="max-width: 90%; max-height: 90%;">
                <source src="" type="video/mp4">
                您的浏览器不支持视频播放。
            </video>
        `;
        document.body.appendChild(videoModal);
        
        // 添加关闭事件
        const closeBtn = videoModal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => hideVideoModal());
        videoModal.addEventListener('click', (e) => {
            if (e.target === videoModal) hideVideoModal();
        });
    }
    
    const modalVideo = videoModal.querySelector('#modal-video source');
    const video = videoModal.querySelector('#modal-video');
    modalVideo.src = videoUrl;
    video.load(); // 重新加载视频
    videoModal.style.display = 'block';
}

/**
 * 隐藏视频播放模态框
 */
function hideVideoModal() {
    const videoModal = document.getElementById('video-modal');
    if (videoModal) {
        const video = videoModal.querySelector('#modal-video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
        videoModal.style.display = 'none';
    }
}

// 新增：显示标签页选择弹窗
export function showTabSelectionPopupUI(tabs, onConfirmCallback, elements, currentTranslations) {
    // 多选版本：点击项切换选中状态，使用底部按钮取消/确认
    closeTabSelectionPopupUI(); //确保同一时间只有一个弹窗

    const popup = document.createElement('div');
    popup.id = 'tab-selection-popup';
    popup.className = 'tab-selection-popup'; // 用于CSS样式
    popup.dataset.mode = 'multi';

    const inputRect = elements.userInput.getBoundingClientRect();
    popup.style.bottom = `${window.innerHeight - inputRect.top + 8}px`; // 向上微调 8px
    popup.style.left = `${inputRect.left}px`;
    popup.style.width = `${inputRect.width}px`;

    const list = document.createElement('ul');
    list.className = 'tab-selection-list';

    if (tabs.length === 0) {
        const noResultsItem = document.createElement('li');
        noResultsItem.className = 'tab-selection-item no-results';
        noResultsItem.textContent = currentTranslations['noTabsFound'] || 'No open tabs found'; // 需要添加翻译
        list.appendChild(noResultsItem);
    } else {
        tabs.forEach((tab, index) => {
            const item = document.createElement('li');
            item.className = 'tab-selection-item';
            item.dataset.tabId = tab.id;
            item.dataset.index = index;

            const favIcon = document.createElement('img');
            favIcon.className = 'tab-item-favicon';
            favIcon.src = tab.favIconUrl || '../magic.png'; // 后备图标
            favIcon.alt = 'Favicon';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'tab-item-title';
            titleSpan.textContent = tab.title || '-'; // Fallback if title is undefined

            const urlSpan = document.createElement('span');
            urlSpan.className = 'tab-item-url';
            urlSpan.textContent = tab.url;

            // 右侧勾选指示器
            const check = document.createElement('span');
            check.className = 'check-indicator';
            check.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;

            item.appendChild(favIcon);
            item.appendChild(titleSpan);
            item.appendChild(urlSpan);
            item.appendChild(check);

            // 点击切换选中状态
            item.addEventListener('click', (e) => {
                // 忽略从按钮点击冒泡
                const target = e.target;
                if (target.closest && target.closest('.tab-selection-actions')) return;
                item.classList.toggle('checked');
                // 不再添加聚焦高亮，保持视觉简洁（仅右侧对勾指示）
            });
            list.appendChild(item);
        });
    }

    // 操作按钮区域（取消/确认）
    const actions = document.createElement('div');
    actions.className = 'tab-selection-actions';

    // 左侧容器：全选/取消全选（单一按钮，点击在全选与全不选间切换）
    const leftActions = document.createElement('div');
    leftActions.className = 'left-actions';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'tab-action neutral select-all';
    const selectIcon = () => `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <polyline points="9 12 11 14 15 10"/>
        </svg>`;
    const clearIcon = () => `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="8" y1="8" x2="16" y2="16"/>
            <line x1="16" y1="8" x2="8" y2="16"/>
        </svg>`;
    const updateSelectAllBtnVisual = () => {
        const itemsEls = Array.from(list.querySelectorAll('.tab-selection-item:not(.no-results)'));
        const allChecked = itemsEls.length > 0 && itemsEls.every(li => li.classList.contains('checked'));
        if (allChecked) {
            selectAllBtn.title = currentTranslations['clearAll'] || 'Clear all';
            selectAllBtn.innerHTML = clearIcon();
        } else {
            selectAllBtn.title = currentTranslations['selectAll'] || 'Select all';
            selectAllBtn.innerHTML = selectIcon();
        }
    };
    updateSelectAllBtnVisual();
    selectAllBtn.addEventListener('click', () => {
        const itemsEls = Array.from(list.querySelectorAll('.tab-selection-item:not(.no-results)'));
        const allChecked = itemsEls.length > 0 && itemsEls.every(li => li.classList.contains('checked'));
        if (allChecked) itemsEls.forEach(li => li.classList.remove('checked'));
        else itemsEls.forEach(li => li.classList.add('checked'));
        // 统一移除聚焦类，避免残留高亮
        itemsEls.forEach(li => li.classList.remove('focused'));
        updateSelectAllBtnVisual();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tab-action cancel';
    cancelBtn.title = currentTranslations['cancel'] || 'Cancel';
    cancelBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    `;
    cancelBtn.addEventListener('click', () => {
        closeTabSelectionPopupUI();
        const evt = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(evt);
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'tab-action confirm';
    confirmBtn.title = currentTranslations['confirm'] || 'Confirm';
    confirmBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    `;
    confirmBtn.addEventListener('click', () => {
        const selectedItems = Array.from(list.querySelectorAll('.tab-selection-item.checked'));
        if (selectedItems.length === 0) {
            closeTabSelectionPopupUI();
            const evt = new CustomEvent('tabPopupManuallyClosed');
            document.dispatchEvent(evt);
            return;
        }
        const selectedTabs = selectedItems.map(li => tabs[Number(li.dataset.index)]).filter(Boolean);
        try { onConfirmCallback(selectedTabs); } catch (err) { console.warn('onConfirmCallback error:', err); }
        closeTabSelectionPopupUI();
        const evt = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(evt);
    });

    // 右侧容器：取消与确认
    const rightActions = document.createElement('div');
    rightActions.className = 'right-actions';

    leftActions.appendChild(selectAllBtn);
    rightActions.appendChild(cancelBtn);
    rightActions.appendChild(confirmBtn);

    actions.appendChild(leftActions);
    actions.appendChild(rightActions);

    popup.appendChild(list);
    popup.appendChild(actions);
    document.body.appendChild(popup);

    // 不设置默认聚焦，避免用户未操作就出现高亮

    // 添加全局监听用于关闭弹窗：外部点击、窗口失焦、可见性变化
    setTimeout(() => {
        // 使用 pointerdown 且不设置 once，避免首次点击在弹窗内导致监听被移除
        document.addEventListener('pointerdown', handleClickOutsideTabPopup, { capture: true });
        // 兼容性：保留 click 监听（非必须）
        document.addEventListener('click', handleClickOutsideTabPopup, { capture: true });
        window.addEventListener('blur', handlePopupWindowBlur);
        document.addEventListener('visibilitychange', handlePopupVisibilityChange);
    }, 0);
    // 键盘事件监听，用于弹窗内的导航
    document.addEventListener('keydown', handlePopupKeyDown);

    // 当列表项被点击勾选/取消勾选时，更新左侧切换按钮的图标状态
    list.addEventListener('click', (e) => {
        if ((e.target && e.target.closest && e.target.closest('.tab-selection-item')) || e.currentTarget === list) {
            updateSelectAllBtnVisual();
        }
    });
}

// 新增：关闭标签页选择弹窗
export function closeTabSelectionPopupUI() {
    const popup = document.getElementById('tab-selection-popup');
    if (popup) {
        popup.remove();
    }
    // 在main.js中更新 state.isTabSelectionPopupOpen = false;
    // 这个函数主要负责DOM操作
    document.removeEventListener('pointerdown', handleClickOutsideTabPopup, { capture: true });
    document.removeEventListener('click', handleClickOutsideTabPopup, { capture: true });
    document.removeEventListener('keydown', handlePopupKeyDown);
    window.removeEventListener('blur', handlePopupWindowBlur);
    document.removeEventListener('visibilitychange', handlePopupVisibilityChange);
}

// 新增：处理弹窗外部点击事件
function handleClickOutsideTabPopup(event) {
    const popup = document.getElementById('tab-selection-popup');
    if (popup && !popup.contains(event.target)) {
        closeTabSelectionPopupUI();
        // 通知 main.js 更新状态
        const mainJSNotifier = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(mainJSNotifier);
    }
}

// 窗口失焦时关闭弹窗（用户点击面板以外，如网页处）
function handlePopupWindowBlur() {
    closeTabSelectionPopupUI();
    const mainJSNotifier = new CustomEvent('tabPopupManuallyClosed');
    document.dispatchEvent(mainJSNotifier);
}

// 标签页可见性变化（侧边面板可能被隐藏/切换）时关闭弹窗
function handlePopupVisibilityChange() {
    if (document.hidden) {
        closeTabSelectionPopupUI();
        const mainJSNotifier = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(mainJSNotifier);
    }
}

// 新增：处理弹窗内的键盘导航
function handlePopupKeyDown(event) {
    const popup = document.getElementById('tab-selection-popup');
    if (!popup) return;

    const items = popup.querySelectorAll('.tab-selection-item:not(.no-results)');
    if (items.length === 0) return;

    let currentIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('focused')) {
            currentIndex = index;
        }
    });

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (currentIndex < items.length - 1) {
            if (currentIndex !== -1) items[currentIndex].classList.remove('focused');
            items[++currentIndex].classList.add('focused');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (currentIndex > 0) {
            if (currentIndex !== -1) items[currentIndex].classList.remove('focused');
            items[--currentIndex].classList.add('focused');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
    } else if (event.key === 'Enter') {
        // Enter 作为快捷键：等同于点击“确认”按钮
        event.preventDefault();
        const confirmBtnEl = document.querySelector('#tab-selection-popup .tab-action.confirm');
        if (confirmBtnEl) confirmBtnEl.click();
    } else if (event.key === ' ') {
        // Space 用于切换当前聚焦项的勾选状态（保留键盘可达性）
        event.preventDefault();
        if (currentIndex !== -1) {
            items[currentIndex].classList.toggle('checked');
            // 同步左侧“全选/取消全选”按钮的视觉状态
            const selectAllBtn = document.querySelector('#tab-selection-popup .left-actions .select-all');
            if (selectAllBtn) {
                const itemsEls = Array.from(document.querySelectorAll('#tab-selection-popup .tab-selection-item:not(.no-results)'));
                const allChecked = itemsEls.length > 0 && itemsEls.every(li => li.classList.contains('checked'));
                const selectIcon = () => `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                        <polyline points=\"9 12 11 14 15 10\"/>
                    </svg>`;
                const clearIcon = () => `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>
                        <line x1=\"8\" y1=\"8\" x2=\"16\" y2=\"16\"/>
                        <line x1=\"16\" y1=\"8\" x2=\"8\" y2=\"16\"/>
                    </svg>`;
                if (allChecked) {
                    selectAllBtn.title = (window.I18n?.tr && window.I18n.tr('clearAll', {}, {})) || 'Clear all';
                    selectAllBtn.innerHTML = clearIcon();
                } else {
                    selectAllBtn.title = (window.I18n?.tr && window.I18n.tr('selectAll', {}, {})) || 'Select all';
                    selectAllBtn.innerHTML = selectIcon();
                }
            }
        }
    } else if (event.key === 'Escape') {
        event.preventDefault();
        closeTabSelectionPopupUI();
        // 通知 main.js 更新状态
        const mainJSNotifier = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(mainJSNotifier);
    } else if (event.key === 'Tab') {
        event.preventDefault(); // 阻止 Tab 的默认行为，使其在弹窗内循环或关闭弹窗
        closeTabSelectionPopupUI();
        const mainJSNotifier = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(mainJSNotifier);
        document.getElementById('user-input')?.focus(); // 将焦点移回输入框
    }
}

// 新增：创建和管理已选标签栏的UI
export function updateSelectedTabsBarUI(selectedTabs, elements, onRemoveTabCallback, currentTranslations) {
    let bar = document.getElementById('selected-tabs-bar');
    const chatInputContainer = elements.userInput.parentElement; // 一般是 .chat-input

    if (selectedTabs.length === 0) {
        if (bar) bar.remove();
        if (elements.chatMessages) {
            elements.chatMessages.style.paddingBottom = 'var(--spacing-md)'; // 恢复默认
        }
        if (chatInputContainer) {
            chatInputContainer.style.borderTopLeftRadius = 'var(--radius-lg)'; // 恢复圆角
            chatInputContainer.style.borderTopRightRadius = 'var(--radius-lg)';
        }
        return;
    }

    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'selected-tabs-bar';
        bar.className = 'selected-tabs-bar'; // 用于CSS
        // 将其插入到 chat-messages 和 chat-input 之间
        if (chatInputContainer && chatInputContainer.parentNode) {
            chatInputContainer.parentNode.insertBefore(bar, chatInputContainer);
             // 调整 chat-input 的顶部圆角
            chatInputContainer.style.borderTopLeftRadius = '0';
            chatInputContainer.style.borderTopRightRadius = '0';
        }
    }
    bar.innerHTML = ''; // 清空旧内容

    selectedTabs.forEach(tab => {
        const tabChip = document.createElement('div');
        tabChip.className = 'selected-tab-chip';
        tabChip.title = `${tab.title || '-'} `; // 添加 title 属性显示完整信息
        if (tab.isLoading) tabChip.classList.add('loading');
        if (tab.content === null && !tab.isLoading) tabChip.classList.add('error'); // 内容为null且不是loading状态，则标记为error

        const favIcon = document.createElement('img');
        favIcon.src = tab.favIconUrl || '../magic.png';
        favIcon.alt = '';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = tab.title || '-'; // Fallback if title is undefined

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.title = currentTranslations['removeTabTitle'] || 'Remove tab'; // 需要翻译
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            onRemoveTabCallback(tab.id);
        };

        tabChip.appendChild(favIcon);
        tabChip.appendChild(titleSpan);

        if (tab.isLoading) {
            const spinner = document.createElement('div');
            spinner.className = 'tab-chip-spinner';
            tabChip.appendChild(spinner);
        }
        tabChip.appendChild(removeBtn);
        bar.appendChild(tabChip);
    });

    // 调整聊天消息区域的底部内边距，为标签栏腾出空间
    if (elements.chatMessages) {
        const barHeight = bar.offsetHeight;
        elements.chatMessages.style.paddingBottom = `calc(${barHeight}px + var(--spacing-sm))`; 
    }
}
