/**
 * Pagetalk - UI Update and DOM Manipulation Functions
 */
import { generateUniqueId, escapeHtml } from './utils.js';
import { renderDynamicContent } from './render.js';
import { showFullSizeImage } from './image.js'; // Assuming image modal logic is in image.js

// --- Global Variables (Accessed via parameters) ---
// let state; // Reference passed in
// let elements; // Reference passed in
// let currentTranslations = {}; // Reference passed in

/**
 * Helper function to get translation string
 * @param {string} key
 * @param {object} [replacements={}]
 * @param {object} translations - The current translations object
 * @returns {string}
 */
function _(key, replacements = {}, translations) {
  let translation = translations[key] || key;
  for (const placeholder in replacements) {
    translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
  }
  return translation;
}

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
            closeBtn.innerHTML = '✖'; // Use a clear X symbol
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

    // 决定插入点
    const parentNode = elements.chatMessages;
    let actualInsertBeforeElement = null;
    if (insertAfterElement && insertAfterElement.parentNode === parentNode) {
        actualInsertBeforeElement = insertAfterElement.nextSibling;
    }

    // 如果有 sentTabsContainer，先插入它
    if (sentTabsContainer) {
        if (actualInsertBeforeElement) {
            parentNode.insertBefore(sentTabsContainer, actualInsertBeforeElement);
        } else {
            parentNode.appendChild(sentTabsContainer);
        }
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
    // 原本在这里渲染 sentContextTabs 的逻辑已移到前面创建 sentTabsContainer

    if (sender === 'user' && images.length > 0) {
        messageHTML += '<div class="message-images">';
        images.forEach((image, index) => {
            // Use escapeHtml for alt text just in case
            const altText = escapeHtml(_('imageAlt', { index: index + 1 }, currentTranslations));
            // Add data-url for click handler
            messageHTML += `<img class="message-image" src="${escapeHtml(image.dataUrl)}" alt="${altText}" data-index="${index}" data-url="${escapeHtml(image.dataUrl)}">`;
        });
        messageHTML += '</div>';
    }

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

    // Add click listeners for user images AFTER setting innerHTML
    if (sender === 'user' && images.length > 0) {
        messageDiv.querySelectorAll('.message-image').forEach(img => {
            img.addEventListener('click', () => {
                showFullSizeImage(img.dataset.url, elements); // Use data-url
            });
        });
    }

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

    renderDynamicContent(messageDiv, elements); // Render KaTeX/Mermaid

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
 * 更新流式消息 - 使用markdown-it渲染
 * @param {HTMLElement} messageElement - 消息元素
 * @param {string} content - 当前累积的内容
 * @param {boolean} shouldScroll - Whether to scroll to bottom
 * @param {object} elements - DOM elements reference
 */
export function updateStreamingMessage(messageElement, content, shouldScroll, elements) {
    let formattedContent = window.MarkdownRenderer.render(content);

    const streamingCursor = document.createElement('span');
    streamingCursor.className = 'streaming-cursor';

    const messageActions = messageElement.querySelector('.message-actions');
    messageElement.innerHTML = formattedContent;
    if (messageActions) {
        messageElement.appendChild(messageActions);
    }

    // Temporarily disable dynamic rendering during streaming to avoid errors/performance issues
    // renderDynamicContent(messageElement, elements);

    messageElement.appendChild(streamingCursor);

    if (shouldScroll) { // 使用 shouldScroll 决策
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
    const streamingCursor = messageElement.querySelector('.streaming-cursor');
    if (streamingCursor) {
        streamingCursor.remove();
    }

    messageElement.innerHTML = window.MarkdownRenderer.render(finalContent);

    const codeBlocks = messageElement.querySelectorAll('.code-block');
    codeBlocks.forEach(addCopyButtonToCodeBlock);

    addMessageActionButtons(messageElement, finalContent);

    renderDynamicContent(messageElement, elements); // Final render

    if (shouldScroll) { // 使用 shouldScroll 决策
        setTimeout(() => {
            elements.chatMessages.scrollTo({
                top: elements.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
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
    setPlaceholder('#user-input', 'userInputContextPlaceholder');
    setTitle('#send-message', 'sendMessageTitle'); // Default title

    // YouTube URL Dialog
    setTitle('#add-youtube-url', 'addYoutubeLinkTitle');
    setText('#youtube-url-dialog h3', 'addYoutubeVideoTitle');
    setText('#youtube-url-dialog p', 'enterYoutubeLinkPrompt');
    setPlaceholder('#youtube-url-input', 'youtubeLinkPlaceholder');
    setText('#cancel-youtube', 'cancelButton');
    setText('#confirm-youtube', 'addButton');

    setText('.footer-tab[data-tab="chat"]', 'chatTab');
    setText('.footer-tab[data-tab="settings"]', 'settingsTab');

    setText('.settings-nav-btn[data-subtab="general"]', 'generalSettingsNav');
    setText('.settings-nav-btn[data-subtab="agent"]', 'agentSettingsNav');
    setText('.settings-nav-btn[data-subtab="model"]', 'modelSettingsNav');
    setTitle('#close-panel-settings', 'closePanelTitle');

    setText('#settings-general h2', 'generalSettingsHeading');
    setText('label[for="language-select"]', 'languageLabel');
    setText('label[for="export-format"]', 'exportChatLabel');
    setText('#export-format option[value="markdown"]', 'exportFormatMarkdown');
    setText('#export-format option[value="text"]', 'exportFormatText');
    setText('#export-chat-history', 'exportButton');

    setText('#settings-agent h2', 'agentSettingsHeading');
    setText('.agents-list-header h3', 'agentsListHeading');
    setTitle('#add-new-agent', 'addNewAgentTitle');
    setTitle('#import-agents', 'importAgentConfigTitle');
    setTitle('#export-agents', 'exportAgentConfigTitle');
    // Agent list items updated dynamically
    setText('#delete-confirm-dialog h3', 'deleteConfirmHeading');
    setText('#cancel-delete', 'cancel');
    setText('#confirm-delete', 'delete');

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

    // Note: Dynamic elements like agent list items, status messages, etc.,
    // need to be updated when they are created or their state changes,
    // using the _ function with the currentTranslations.
}

/**
 * 恢复发送按钮和输入框到正常状态
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} sendUserMessageCallback - Callback to re-attach send listener
 * @param {function} abortStreamingCallback - Callback to remove abort listener
 */
export function restoreSendButtonAndInput(state, elements, currentTranslations, sendUserMessageCallback, abortStreamingCallback) {
    // 强制彻底重置按钮状态，无论流式状态
    if (state.isStreaming) state.isStreaming = false;
    if (state.userScrolledUpDuringStream) state.userScrolledUpDuringStream = false;

    // 移除所有可能的 loading/sending/stop-streaming 样式
    elements.sendMessage.classList.remove('stop-streaming', 'sending', 'loading');
    elements.sendMessage.disabled = false;
    elements.sendMessage.title = _('sendMessageTitle', {}, currentTranslations);
    elements.sendMessage.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11v-.001ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
        </svg>
    `;

    // 彻底解绑所有点击事件再重新绑定，防止多次绑定
    const newSendButton = elements.sendMessage.cloneNode(true);
    elements.sendMessage.parentNode.replaceChild(newSendButton, elements.sendMessage);
    elements.sendMessage = newSendButton;
    elements.sendMessage.addEventListener('click', sendUserMessageCallback);

    if (window.GeminiAPI && window.GeminiAPI.currentAbortController) {
        window.GeminiAPI.currentAbortController = null;
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
export function showTabSelectionPopupUI(tabs, onSelectCallback, elements, currentTranslations) {
    closeTabSelectionPopupUI(); //确保同一时间只有一个弹窗

    const popup = document.createElement('div');
    popup.id = 'tab-selection-popup';
    popup.className = 'tab-selection-popup'; // 用于CSS样式

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

            item.appendChild(favIcon);
            item.appendChild(titleSpan);
            item.appendChild(urlSpan);

            item.addEventListener('click', () => {
                onSelectCallback(tab);
                closeTabSelectionPopupUI();
            });
            list.appendChild(item);
        });
    }

    popup.appendChild(list);
    document.body.appendChild(popup);

    // 初始选中第一个（如果存在）
    if (tabs.length > 0) {
        list.children[0].classList.add('selected');
    }

    // 添加全局点击监听器以关闭弹窗，如果点击发生在弹窗外部
    // 使用setTimeout确保它在当前事件处理完成后添加
    setTimeout(() => {
        document.addEventListener('click', handleClickOutsideTabPopup, { capture: true, once: true });
    }, 0);
     // 添加键盘事件监听，用于弹窗内的导航
    document.addEventListener('keydown', handlePopupKeyDown);
}

// 新增：关闭标签页选择弹窗
export function closeTabSelectionPopupUI() {
    const popup = document.getElementById('tab-selection-popup');
    if (popup) {
        popup.remove();
    }
    // 在main.js中更新 state.isTabSelectionPopupOpen = false;
    // 这个函数主要负责DOM操作
    document.removeEventListener('click', handleClickOutsideTabPopup, { capture: true });
    document.removeEventListener('keydown', handlePopupKeyDown);
}

// 新增：处理弹窗外部点击事件
function handleClickOutsideTabPopup(event) {
    const popup = document.getElementById('tab-selection-popup');
    const userInput = document.getElementById('user-input');

    // 如果点击目标既不在弹窗内，也不在输入框内，则关闭弹窗
    if (popup && !popup.contains(event.target) && event.target !== userInput) {
        closeTabSelectionPopupUI();
        // 通知 main.js 更新状态
        const mainJSNotifier = new CustomEvent('tabPopupManuallyClosed');
        document.dispatchEvent(mainJSNotifier);
    }
    // 注意：由于监听器是 { once: true }，它会在第一次触发后自动移除。
    // 如果需要更复杂的管理，可能需要调整 showTabSelectionPopupUI 和 closeTabSelectionPopupUI 中的监听器添加/移除逻辑。
}

// 新增：处理弹窗内的键盘导航
function handlePopupKeyDown(event) {
    const popup = document.getElementById('tab-selection-popup');
    if (!popup) return;

    const items = popup.querySelectorAll('.tab-selection-item:not(.no-results)');
    if (items.length === 0) return;

    let currentIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('selected')) {
            currentIndex = index;
        }
    });

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (currentIndex < items.length - 1) {
            if (currentIndex !== -1) items[currentIndex].classList.remove('selected');
            items[++currentIndex].classList.add('selected');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (currentIndex > 0) {
            if (currentIndex !== -1) items[currentIndex].classList.remove('selected');
            items[--currentIndex].classList.add('selected');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (currentIndex !== -1) {
            items[currentIndex].click(); // 触发选中项的点击事件
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
