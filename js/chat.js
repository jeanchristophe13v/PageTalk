/**
 * Pagetalk - Chat Core Logic
 */
import { generateUniqueId } from './utils.js';
import { tr as _ } from './utils/i18n.js';

// 使用 utils/i18n.js 提供的 tr 作为翻译函数

/**
 * Sends a user message and initiates the AI response process.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} showConnectionStatusCallback - Callback for model settings status
 * @param {function} addMessageToChatCallback - Callback (this is main.js#addMessageToChatUI)
 * @param {function} addThinkingAnimationCallback - Callback (this is a lambda from main.js calling ui.js#addThinkingAnimation with live isUserNearBottom)
 * @param {function} resizeTextareaCallback - Callback
 * @param {function} clearImagesCallback - Callback
 * @param {function} clearVideosCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} abortStreamingCallback - Callback
 * @param {function} [updateSelectedTabsBarCallback] - Optional callback to update selected tabs bar UI
 */
export async function sendUserMessage(state, elements, currentTranslations, showConnectionStatusCallback, addMessageToChatCallback, addThinkingAnimationCallback, resizeTextareaCallback, clearImagesCallback, clearVideosCallback, showToastCallback, restoreSendButtonAndInputCallback, abortStreamingCallback, updateSelectedTabsBarCallback) {
    const userMessage = elements.userInput.value.trim();

    if (state.isStreaming) {
        console.warn("Cannot send message while streaming.");
        // if (showToastCallback) showToastCallback(_('streamingInProgress', {}, currentTranslations), 'warning'); // Commented out as per task
        return;
    }
    if (!userMessage && state.images.length === 0 && state.videos.length === 0 && state.selectedContextTabs.filter(t => t.content && !t.isLoading && !t.isContextSent).length === 0) return;

    // 检查是否有任何供应商配置了 API Key
    let hasValidApiKey = false;
    if (window.ModelManager?.instance) {
        try {
            await window.ModelManager.instance.initialize();
            const modelConfig = window.ModelManager.instance.getModelApiConfig(state.model);
            const providerId = modelConfig.providerId;
            hasValidApiKey = window.ModelManager.instance.isProviderConfigured(providerId);
        } catch (error) {
            console.warn('[Chat] Failed to check provider configuration:', error);
        }
    }

    if (!hasValidApiKey) {
        // Show API key missing error as a toast on the chat page (首页下方)
        if (showToastCallback) showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        return;
    }

    // --- Start Streaming State ---
    state.isStreaming = true;
    state.userScrolledUpDuringStream = false; // 重置滚动标记
    elements.sendMessage.classList.add('stop-streaming');
    elements.sendMessage.title = _('stopStreamingTitle', {}, currentTranslations);
    elements.sendMessage.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/>
        </svg>
    `;
    elements.sendMessage.removeEventListener('click', sendUserMessage); // Remove default listener
    elements.sendMessage.addEventListener('click', abortStreamingCallback); // Add abort listener
    // --- End Streaming State ---

    const currentImages = [...state.images]; // Copy images for this message
    const currentVideos = [...state.videos]; // Copy videos for this message

    // 准备在用户消息气泡中显示的标签页信息
    const tabsForBubbleDisplay = state.selectedContextTabs
        .filter(tab => tab.content && !tab.isLoading && !tab.isContextSent)
        .map(tab => ({
            id: tab.id,
            title: tab.title,
            favIconUrl: tab.favIconUrl
        }));

    // Add user message UI (force scroll ensures it's visible before thinking anim)
    // addMessageToChatCallback (main.js#addMessageToChatUI) handles isUserNearBottom internally
    const userMessageElement = addMessageToChatCallback(userMessage, 'user', { images: currentImages, videos: currentVideos, forceScroll: true, sentContextTabs: tabsForBubbleDisplay });
    const userMessageId = userMessageElement.dataset.messageId;

    elements.userInput.value = '';
    resizeTextareaCallback(); // Adjust textarea height

    // --- 立即标记已选标签页为已发送并更新UI ---
    let contextTabsForApi = [];
    if (state.selectedContextTabs && state.selectedContextTabs.length > 0) {
        const tabsToSendNow = state.selectedContextTabs.filter(
            tab => tab.content && !tab.isLoading && !tab.isContextSent
        );

        if (tabsToSendNow.length > 0) {
            // Ensure contextTabsForApi includes id, title, and content
            contextTabsForApi = tabsToSendNow.map(tab => ({ id: tab.id, title: tab.title, content: tab.content }));

            tabsToSendNow.forEach(tabSent => {
                const originalTab = state.selectedContextTabs.find(t => t.id === tabSent.id);
                if (originalTab) {
                    originalTab.isContextSent = true;
                }
            });

            state.selectedContextTabs = state.selectedContextTabs.filter(tab => !tab.isContextSent);
            
            if (updateSelectedTabsBarCallback) {
                updateSelectedTabsBarCallback(); // 立即更新UI
            }
        }
    }
    // --- 结束处理标签页逻辑 ---

    // Build message parts
    const currentParts = [];
    if (userMessage) currentParts.push({ text: userMessage });
    currentImages.forEach(image => {
        const base64data = image.dataUrl.split(',')[1];
        currentParts.push({ inlineData: { mimeType: image.mimeType, data: base64data } });
    });
    currentVideos.forEach(video => {
        if (video.type === 'youtube') {
            currentParts.push({ fileData: { fileUri: video.url } });
        }
        // 移除本地视频文件处理，只支持 YouTube 视频
    });

    // 准备用户消息对象，但暂时不添加到历史记录中
    // 将在API调用成功后通过onHistoryUpdate回调添加
    const userMessageForHistory = currentParts.length > 0 ? {
        role: 'user',
        parts: currentParts,
        id: userMessageId,
        // 新增：存储随此用户消息发送的上下文标签页
        // contextTabsForApi 包含了 { id, title, content }
        sentContextTabsInfo: contextTabsForApi.length > 0 ? contextTabsForApi : null
    } : null;

    if (!userMessageForHistory) {
        // Should not happen due to initial check, but as a safeguard:
        // Check if thinkingElement exists before trying to remove it
        // This block is before thinkingElement is defined, so this check is not needed here.
        // It's more relevant in the catch block.
        if (userMessageElement && userMessageElement.parentNode) userMessageElement.remove();
        restoreSendButtonAndInputCallback(); // Restore button if nothing was sent
        return;
    }

    if (currentImages.length > 0) {
        clearImagesCallback(); // This callback clears state.images and updates the UI
    }
    if (currentVideos.length > 0) {
        clearVideosCallback(); // This callback clears state.videos and updates the UI
    }

    // Call the addThinkingAnimationCallback passed from main.js.
    // It uses elements from main.js's scope and captures the live isUserNearBottom.
    // It expects only the element to insert after (or null).
    const thinkingElement = addThinkingAnimationCallback(null);

    try {
        // Prepare API callbacks object
        const apiUiCallbacks = {
            // addMessageToChatCallback is main.js#addMessageToChatUI, which correctly uses live isUserNearBottom
            addMessageToChat: addMessageToChatCallback,
            // These now call the wrappers on `window` (defined in main.js) which use live isUserNearBottom from main.js
            updateStreamingMessage: (el, content) => window.updateStreamingMessage(el, content),
            finalizeBotMessage: (el, content) => {
                window.finalizeBotMessage(el, content);
                // 此处不再需要处理 selectedContextTabs 的逻辑，已提前处理
            },
            showToast: showToastCallback,
            restoreSendButtonAndInput: restoreSendButtonAndInputCallback // Add this callback
        };

        // Call API，传递用户消息对象以便API模块添加到历史记录
        await window.GeminiAPI.callGeminiAPIWithImages(
            userMessage,
            currentImages, // Use the copied currentImages
            currentVideos, // Use the copied currentVideos
            thinkingElement,
            state, // Pass full state reference
            apiUiCallbacks, // Pass callbacks object
            contextTabsForApi, // <--- Pass the prepared context tabs
            userMessageForHistory // <--- Pass user message object for history
        );
        // finalizeBotMessage (called by API module on success) will restore button state

    } catch (error) {
        console.error('Error during sendUserMessage API call:', error);
        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();

        // 如果API调用失败，需要从历史记录中移除刚刚添加的用户消息
        if (userMessageForHistory) {
            const messageIndex = state.chatHistory.findIndex(msg => msg.id === userMessageForHistory.id);
            if (messageIndex !== -1) {
                state.chatHistory.splice(messageIndex, 1);
                console.log(`Removed failed user message from history`);
            }
        }

        // Add error message to chat (don't force scroll)
        // addMessageToChatCallback already handles isUserNearBottom correctly
        // addMessageToChatCallback(_('apiCallFailed', { error: error.message }, currentTranslations), 'bot', {}); // Commented out as per task
        restoreSendButtonAndInputCallback(); // Restore button on error
    }
}


/**
 * Clears the chat context and history.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} clearImagesCallback - Callback
 * @param {function} clearVideosCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 * @param {boolean} [showToast=true] - Whether to show the "Cleared" toast
 */
export async function clearContext(state, elements, clearImagesCallback, clearVideosCallback, showToastCallback, currentTranslations, showToast = true) {
    state.chatHistory = [];
    state.locallyIgnoredTabs = {}; // 清空已忽略标签页的状态
    elements.chatMessages.innerHTML = ''; // Clear UI

    // Re-add welcome message with dynamic quick actions
    const welcomeMessage = await createWelcomeMessage(currentTranslations);
    elements.chatMessages.appendChild(welcomeMessage);

    clearImagesCallback(); // Clear images using callback
    clearVideosCallback(); // Clear videos using callback
    if (showToast) {
        showToastCallback(_('contextClearedSuccess', {}, currentTranslations), 'success');
    }
}

/**
 * Deletes a specific message from chat history and UI.
 * @param {string} messageId - The ID of the message to delete.
 * @param {object} state - Global state reference
 */
export function deleteMessage(messageId, state) {
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    let domRemoved = false;
    if (messageElement) {
        // 循环删除所有与此消息关联的前置容器（图片、标签页等）
        let prevSibling = messageElement.previousElementSibling;
        while (prevSibling && prevSibling.dataset.messageIdRef === messageId) {
            const siblingToRemove = prevSibling;
            prevSibling = siblingToRemove.previousElementSibling; // 先移动指针
            siblingToRemove.remove(); // 再删除
        }
        messageElement.remove();
        domRemoved = true;
    }

    const messageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    let historyRemoved = false;
    if (messageIndex !== -1) {
        state.chatHistory.splice(messageIndex, 1);
        historyRemoved = true;
    }

    // Clean up from locallyIgnoredTabs
    if (state.locallyIgnoredTabs && state.locallyIgnoredTabs[messageId]) {
        delete state.locallyIgnoredTabs[messageId];
        console.log(`Cleaned up ignored tabs for deleted message ${messageId}`);
    }

    if (domRemoved || historyRemoved) {
        console.log(`Message ${messageId} deleted (DOM: ${domRemoved}, History: ${historyRemoved})`);
        // Optional: Save history if persistent storage is used
    } else {
        console.warn(`Delete failed: Message ${messageId} not found.`);
    }
}

/**
 * Regenerates the AI response for a specific turn.
 * @param {string} messageId - The ID of the message (user or bot) triggering regeneration.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} addMessageToChatCallback - Callback (main.js#addMessageToChatUI)
 * @param {function} addThinkingAnimationCallback - Callback (lambda from main.js for ui.js#addThinkingAnimation)
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} abortStreamingCallback - Callback
 * @param {function} showToastCallback - Callback to show toast notifications
 * @param {function} [updateSelectedTabsBarCallback] - Optional callback to update selected tabs bar UI
 */
export async function regenerateMessage(messageId, state, elements, currentTranslations, addMessageToChatCallback, addThinkingAnimationCallback, restoreSendButtonAndInputCallback, abortStreamingCallback, showToastCallback, updateSelectedTabsBarCallback) {
    if (state.isStreaming) {
        console.warn("Cannot regenerate while streaming.");
        // if (showToastCallback) showToastCallback(_('streamingInProgress', {}, currentTranslations), 'warning'); // Commented out as per task
        return;
    }

    const clickedMessageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    if (clickedMessageIndex === -1) {
        console.error("Regenerate failed: Message not found in history.");
        if (showToastCallback) showToastCallback(_('regenerateFailedNotFound', {}, currentTranslations), 'error');
        return;
    }

    const clickedMessage = state.chatHistory[clickedMessageIndex];
    let userIndex = -1;
    let aiIndex = -1;
    let userMessageElement = null;

    // Find the user message and the AI message of the turn
    if (clickedMessage.role === 'user') {
        userIndex = clickedMessageIndex;
        if (userIndex + 1 < state.chatHistory.length && state.chatHistory[userIndex + 1].role === 'model') {
            aiIndex = userIndex + 1;
        }
    } else { // clickedMessage.role === 'model'
        aiIndex = clickedMessageIndex;
        userIndex = aiIndex - 1; // Assume user message is directly before
        if (userIndex < 0 || state.chatHistory[userIndex].role !== 'user') {
            console.error("Regenerate failed: Could not find preceding user message.");
            if (showToastCallback) showToastCallback(_('regenerateFailedNoUserMessage', {}, currentTranslations), 'error');
            return; // Cannot regenerate if user message isn't directly before
        }
    }

    userMessageElement = document.querySelector(`.message[data-message-id="${state.chatHistory[userIndex].id}"]`);
    if (!userMessageElement) {
        console.error("Regenerate failed: Could not find user message DOM element.");
        if (showToastCallback) showToastCallback(_('regenerateFailedUIDiscrepancy', {}, currentTranslations), 'error');
        return;
    }

    // Extract user input parts
    const userMessageData = state.chatHistory[userIndex];
    const { text: userMessageText, images: userImages, videos: userVideos } = extractPartsFromMessage(userMessageData); // Use helper

    // 新增：提取该用户轮次最初发送的上下文标签页
    const previouslySentContextTabsFromHistory = userMessageData.sentContextTabsInfo || []; // 确保是数组 [{id, title, content}]

    // Prepare history up to (but not including) the user message of the turn
    const historyForApi = state.chatHistory.slice(0, userIndex);

    // Remove old AI response(s) following the user message
    let removedAICount = 0;
    while (state.chatHistory[userIndex + 1]?.role === 'model') {
        const oldAiMessageId = state.chatHistory[userIndex + 1].id;
        const oldAiElement = document.querySelector(`.message[data-message-id="${oldAiMessageId}"]`);
        if (oldAiElement) oldAiElement.remove();
        state.chatHistory.splice(userIndex + 1, 1);
        removedAICount++;
    }
    console.log(`Removed ${removedAICount} old AI response(s) starting after index ${userIndex}`);


    // --- 在重新生成前，立即标记即将作为上下文发送的标签页并更新UI ---
    // Start with the effective previously sent context, filtering out locally ignored ones
    const ignoredTabIdsForThisTurn = (state.locallyIgnoredTabs && state.locallyIgnoredTabs[userMessageData.id]) ? state.locallyIgnoredTabs[userMessageData.id] : [];
    
    let effectivePreviouslySentContext = previouslySentContextTabsFromHistory.filter(
        tab => !ignoredTabIdsForThisTurn.includes(tab.id)
    );
    
    let contextTabsForApiRegen = [...effectivePreviouslySentContext]; // Contains {id, title, content}

    // 处理在"重新生成"之前新选择的、尚未发送的标签页
    if (state.selectedContextTabs && state.selectedContextTabs.length > 0) {
        const newlySelectedTabsToSend = state.selectedContextTabs.filter(
            tab => tab.content && !tab.isLoading && !tab.isContextSent
        );

        if (newlySelectedTabsToSend.length > 0) {
            const newTabsForApi = newlySelectedTabsToSend.map(tab => ({ id: tab.id, title: tab.title, content: tab.content }));
            
            // 合并新选择的标签页，避免重复（基于ID去重）
            newTabsForApi.forEach(newTab => {
                if (!contextTabsForApiRegen.some(existingTab => existingTab.id === newTab.id)) {
                    contextTabsForApiRegen.push(newTab);
                }
            });

            // 标记这些新选择的标签页为已发送并更新UI
            newlySelectedTabsToSend.forEach(tabSent => {
                const originalTab = state.selectedContextTabs.find(t => t.id === tabSent.id);
                if (originalTab) {
                    originalTab.isContextSent = true;
                }
            });
            state.selectedContextTabs = state.selectedContextTabs.filter(tab => !tab.isContextSent);
            
            if (updateSelectedTabsBarCallback) {
                updateSelectedTabsBarCallback(); // 立即更新UI
            }
        }
    }
    // --- 结束处理标签页逻辑 ---

    // --- Start Streaming State ---
    state.isStreaming = true;
    state.userScrolledUpDuringStream = false; // 重置滚动标记
    elements.sendMessage.classList.add('stop-streaming');
    elements.sendMessage.title = _('stopStreamingTitle', {}, currentTranslations);
    elements.sendMessage.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/>
        </svg>
    `;
    elements.sendMessage.removeEventListener('click', sendUserMessage); // Remove default listener
    elements.sendMessage.addEventListener('click', abortStreamingCallback); // Add abort listener
    // --- End Streaming State ---

    // Add thinking animation after the user message
    // The callback `addThinkingAnimationCallback` (defined in main.js) will use the live `isUserNearBottom`.
    // It expects `afterEl` as its first argument.
    const thinkingElement = addThinkingAnimationCallback(userMessageElement);

    try {
        // Prepare API callbacks object (similar to sendUserMessage)
        const apiUiCallbacks = {
            // addMessageToChatCallback is main.js#addMessageToChatUI, which correctly uses live isUserNearBottom
            addMessageToChat: addMessageToChatCallback,
            // These now call the wrappers on `window` (defined in main.js) which use live isUserNearBottom from main.js
            updateStreamingMessage: (el, content) => window.updateStreamingMessage(el, content),
            finalizeBotMessage: (el, content) => {
                window.finalizeBotMessage(el, content);
                // 此处不再需要处理 selectedContextTabs 的逻辑，已提前处理
            },
            clearImages: () => { }, // Don't clear images on regenerate
            showToast: showToastCallback // Pass the received showToastCallback
        };

        // Call API to insert response
        await window.GeminiAPI.callApiAndInsertResponse(
            userMessageText,
            userImages,
            userVideos,
            thinkingElement,
            historyForApi,
            userIndex + 1, // Insert *after* the user message index
            userMessageElement, // Insert *after* this DOM element
            state,
            apiUiCallbacks,
            contextTabsForApiRegen // <--- Pass the prepared context tabs
        );
        // finalizeBotMessage will restore button state on success

    } catch (error) {
        console.error(`Regenerate failed:`, error);
        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
        // Add error message after the user message
        // addMessageToChatCallback already handles isUserNearBottom correctly
        addMessageToChatCallback(_('regenerateError', { error: error.message }, currentTranslations), 'bot', { insertAfterElement: userMessageElement });
        restoreSendButtonAndInputCallback(); // Restore button on error
    }
}

/**
 * Helper to extract text, image and video info from a message object.
 * @param {object} message - A message object from state.chatHistory
 * @returns {{text: string, images: Array<{dataUrl: string, mimeType: string}>, videos: Array<{dataUrl?: string, mimeType?: string, url?: string, type: string}>}}
 */
function extractPartsFromMessage(message) {
    let text = '';
    const images = [];
    const videos = [];
    if (message && message.parts && Array.isArray(message.parts)) {
        message.parts.forEach(part => {
            if (part.text) {
                text += (text ? '\n' : '') + part.text; // Combine text parts
            } else if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
                if (part.inlineData.mimeType.startsWith('image/')) {
                    images.push({
                        dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        mimeType: part.inlineData.mimeType
                    });
                }
                // 移除本地视频文件处理
            } else if (part.fileData && part.fileData.fileUri) {
                // YouTube URL
                videos.push({
                    url: part.fileData.fileUri,
                    type: 'youtube'
                });
            }
        });
    }
    return { text, images, videos };
}

/**
 * Aborts the current streaming API request.
 * @param {object} state - Global state reference
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} showToastCallback - Callback to show toast notifications
 * @param {object} currentTranslations - Translations object
 */
export function abortStreaming(state, restoreSendButtonAndInputCallback, showToastCallback, currentTranslations) {
    let aborted = false;

    // 尝试中断新的统一API接口
    if (window.PageTalkAPI && window.PageTalkAPI.currentAbortController) {
        console.log("Aborting unified API request...");
        window.PageTalkAPI.currentAbortController.abort();
        aborted = true;
    }

    // 尝试中断旧的Gemini API接口（向后兼容）
    if (window.GeminiAPI && window.GeminiAPI.currentAbortController) {
        console.log("Aborting legacy Gemini API request...");
        window.GeminiAPI.currentAbortController.abort();
        aborted = true;
    }

    if (!aborted) {
        console.warn("No active AbortController found to abort.");
    }

    // Always attempt to restore UI state after abort attempt
    restoreSendButtonAndInputCallback();
}

/**
 * Handles removing a sent tab from a message's context.
 * This updates the state to ignore the tab for future regenerations.
 * @param {string} messageId - The ID of the user message.
 * @param {string} tabId - The ID of the tab to remove from context.
 * @param {object} state - Global state reference.
 */
export function handleRemoveSentTabContext(messageId, tabId, state) {
    if (!state.locallyIgnoredTabs[messageId]) {
        state.locallyIgnoredTabs[messageId] = [];
    }
    if (!state.locallyIgnoredTabs[messageId].includes(tabId)) {
        state.locallyIgnoredTabs[messageId].push(tabId);
        console.log(`Tab ${tabId} marked as ignored for message ${messageId}. Ignored:`, state.locallyIgnoredTabs);
    } else {
        console.log(`Tab ${tabId} was already marked as ignored for message ${messageId}.`);
    }
}

/**
 * 创建欢迎消息，包含动态快捷操作
 * @param {object} currentTranslations - 当前翻译对象
 * @returns {Promise<HTMLElement>} 欢迎消息元素
 */
export async function createWelcomeMessage(currentTranslations) {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'welcome-message';

    // 获取快捷操作
    let quickActions = [];
    if (window.QuickActionsManager) {
        try {
            // 检查快捷操作管理器是否已初始化
            if (window.QuickActionsManager.isQuickActionsManagerInitialized &&
                window.QuickActionsManager.isQuickActionsManagerInitialized()) {
                quickActions = window.QuickActionsManager.getAllQuickActions();
                console.log('[createWelcomeMessage] Found', quickActions.length, 'quick actions:', quickActions);
            } else {
                console.warn('[createWelcomeMessage] QuickActionsManager not yet initialized, using empty actions');
                quickActions = [];
            }
        } catch (error) {
            console.warn('[createWelcomeMessage] Error getting quick actions:', error);
            quickActions = [];
        }
    } else {
        console.warn('[createWelcomeMessage] QuickActionsManager not available in global scope');
    }

    // 生成快捷操作按钮HTML
    const quickActionsHtml = quickActions.map(action => {
        return `
            <button class="quick-action-btn" data-action-id="${action.id}" data-prompt="${escapeHtml(action.prompt)}" data-ignore-assistant="${action.ignoreAssistant}">
                ${escapeHtml(action.name)}
            </button>
        `;
    }).join('');

    welcomeMessage.innerHTML = `
        <h2>${_('welcomeHeading', {}, currentTranslations)}</h2>
        ${quickActionsHtml ? `<div class="quick-actions">${quickActionsHtml}</div>` : ''}
    `;

    // 为所有快捷操作按钮添加事件监听器
    const actionButtons = welcomeMessage.querySelectorAll('.quick-action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const actionId = button.dataset.actionId;
            const prompt = button.dataset.prompt;
            const ignoreAssistant = button.dataset.ignoreAssistant === 'true';

            // 点击快捷操作后先移除欢迎消息，释放空间
            try {
                const parentWelcome = button.closest('.welcome-message');
                if (parentWelcome && parentWelcome.parentNode) {
                    parentWelcome.parentNode.removeChild(parentWelcome);
                }
            } catch (e) {
                console.warn('[createWelcomeMessage] Failed to remove welcome message on quick action click:', e);
            }

            // 触发快捷操作
            if (window.triggerQuickAction) {
                window.triggerQuickAction(actionId, prompt, ignoreAssistant);
            } else {
                console.warn('Quick action trigger function not available');
            }
        });
    });

    return welcomeMessage;
}

// 辅助函数：HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}