/**
 * Pagetalk - Chat Core Logic
 */
import { generateUniqueId } from './utils.js';

/** Helper function to get translation string */
function _(key, replacements = {}, translations) {
  let translation = translations[key] || key;
  for (const placeholder in replacements) {
    translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
  }
  return translation;
}

/**
 * Sends a user message and initiates the AI response process.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} showConnectionStatusCallback - Callback for model settings status
 * @param {function} addMessageToChatCallback - Callback
 * @param {function} addThinkingAnimationCallback - Callback
 * @param {function} resizeTextareaCallback - Callback
 * @param {function} clearImagesCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} abortStreamingCallback - Callback
 * @param {boolean} isUserNearBottom - Whether user is scrolled near bottom
 */
export async function sendUserMessage(state, elements, currentTranslations, showConnectionStatusCallback, addMessageToChatCallback, addThinkingAnimationCallback, resizeTextareaCallback, clearImagesCallback, showToastCallback, restoreSendButtonAndInputCallback, abortStreamingCallback, isUserNearBottom) {
    const userMessage = elements.userInput.value.trim();

    if (state.isStreaming) {
        console.warn("Cannot send message while streaming.");
        return;
    }
    if (!userMessage && state.images.length === 0) return;

    if (!state.apiKey) {
        // Use the connection status display in the *settings* tab for API key errors
        showConnectionStatusCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
        // Optionally switch to the settings tab/model subtab here if desired
        // switchTab('settings'); // Assuming switchTab is available or passed in
        // switchSettingsSubTab('model'); // Assuming switchSettingsSubTab is available
        return;
    }

    // --- Start Streaming State ---
    state.isStreaming = true;
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

    // Add user message UI (force scroll ensures it's visible before thinking anim)
    const userMessageElement = addMessageToChatCallback(userMessage, 'user', { images: currentImages, forceScroll: true });
    const userMessageId = userMessageElement.dataset.messageId;

    elements.userInput.value = '';
    resizeTextareaCallback(); // Adjust textarea height

    // Build message parts
    const currentParts = [];
    if (userMessage) currentParts.push({ text: userMessage });
    currentImages.forEach(image => {
        const base64data = image.dataUrl.split(',')[1];
        currentParts.push({ inlineData: { mimeType: image.mimeType, data: base64data } });
    });

    // Add user message to history *before* API call
    if (currentParts.length > 0) {
        state.chatHistory.push({ role: 'user', parts: currentParts, id: userMessageId });
    } else {
        // Should not happen due to initial check, but as a safeguard:
        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
        if (userMessageElement && userMessageElement.parentNode) userMessageElement.remove();
        restoreSendButtonAndInputCallback(); // Restore button if nothing was sent
        return;
    }

    if (currentImages.length > 0) {
        clearImagesCallback(); // This callback clears state.images and updates the UI
    }

    const thinkingElement = addThinkingAnimationCallback(null, elements, isUserNearBottom); // Add to end

    try {
        // Prepare API callbacks object
        const apiUiCallbacks = {
            addMessageToChat: (content, sender, options) => addMessageToChatCallback(content, sender, options, state, elements, currentTranslations, window.addCopyButtonToCodeBlock, window.addMessageActionButtons, isUserNearBottom), // Need to bind or pass required args
            updateStreamingMessage: (el, content) => window.updateStreamingMessage(el, content, isUserNearBottom, elements), // Assuming these are globally accessible or passed differently
            finalizeBotMessage: (el, content) => window.finalizeBotMessage(el, content, window.addCopyButtonToCodeBlock, window.addMessageActionButtons, restoreSendButtonAndInputCallback, isUserNearBottom, elements),
            // clearImages: () => clearImagesCallback(state, window.updateImagesPreview), // This line can be kept or removed as images are cleared above.
            showToast: showToastCallback
        };


        // Call API
        await window.GeminiAPI.callGeminiAPIWithImages(
            userMessage,
            currentImages, // Use the copied currentImages
            thinkingElement,
            state, // Pass full state reference
            apiUiCallbacks // Pass callbacks object
        );
        // finalizeBotMessage (called by API module on success) will restore button state

    } catch (error) {
        console.error('Error during sendUserMessage API call:', error);
        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
        // Add error message to chat (don't force scroll)
        addMessageToChatCallback(_('apiCallFailed', { error: error.message }, currentTranslations), 'bot', {}, state, elements, currentTranslations, window.addCopyButtonToCodeBlock, window.addMessageActionButtons, isUserNearBottom); // Need translation key
        restoreSendButtonAndInputCallback(); // Restore button on error
    }
}


/**
 * Clears the chat context and history.
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} clearImagesCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 */
/**
 * 清除聊天上下文和历史记录
 * @param {object} state - 全局状态
 * @param {object} elements - DOM 元素引用
 * @param {function} clearImagesCallback - 清除图片回调
 * @param {function} showToastCallback - Toast 回调
 * @param {object} currentTranslations - 语言包
 * @param {boolean} [showToast=true] - 是否显示“已清除”提示
 */
export function clearContext(state, elements, clearImagesCallback, showToastCallback, currentTranslations, showToast = true) {
    state.chatHistory = [];
    elements.chatMessages.innerHTML = ''; // Clear UI

    // Re-add welcome message
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'welcome-message';
    welcomeMessage.innerHTML = `
        <h2>${_('welcomeHeading', {}, currentTranslations)}</h2>
        <div class="quick-actions">
            <button id="summarize-page-dynamic" class="quick-action-btn">${_('summarizeAction', {}, currentTranslations)}</button>
        </div>
    `;
    // Re-attach listener for the dynamically added button
    const summarizeBtn = welcomeMessage.querySelector('#summarize-page-dynamic');
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', () => {
            elements.userInput.value = _('summarizeAction', {}, currentTranslations);
            elements.userInput.focus();
            if (window.sendUserMessageTrigger) {
                window.sendUserMessageTrigger();
            } else {
                console.warn("Cannot trigger sendUserMessage from dynamic button.");
            }
        });
    }
    elements.chatMessages.appendChild(welcomeMessage);

    clearImagesCallback(); // Clear images using callback
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
        messageElement.remove();
        domRemoved = true;
    }

    const messageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    let historyRemoved = false;
    if (messageIndex !== -1) {
        state.chatHistory.splice(messageIndex, 1);
        historyRemoved = true;
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
 * @param {function} addMessageToChatCallback - Callback
 * @param {function} addThinkingAnimationCallback - Callback
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} abortStreamingCallback - Callback
 * @param {boolean} isUserNearBottom - Whether user is scrolled near bottom
 */
export async function regenerateMessage(messageId, state, elements, currentTranslations, addMessageToChatCallback, addThinkingAnimationCallback, restoreSendButtonAndInputCallback, abortStreamingCallback, isUserNearBottom) {
    if (state.isStreaming) {
        console.warn("Cannot regenerate while streaming.");
        return;
    }

    const clickedMessageIndex = state.chatHistory.findIndex(msg => msg.id === messageId);
    if (clickedMessageIndex === -1) {
        console.error("Regenerate failed: Message not found in history.");
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
            return; // Cannot regenerate if user message isn't directly before
        }
    }

    userMessageElement = document.querySelector(`.message[data-message-id="${state.chatHistory[userIndex].id}"]`);
    if (!userMessageElement) {
        console.error("Regenerate failed: Could not find user message DOM element.");
        return;
    }

    // Extract user input parts
    const userMessageData = state.chatHistory[userIndex];
    const { text: userMessageText, images: userImages } = extractPartsFromMessage(userMessageData); // Use helper

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


    // --- Start Streaming State ---
    state.isStreaming = true;
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
    const thinkingElement = addThinkingAnimationCallback(userMessageElement, elements, isUserNearBottom);

    try {
        // Prepare API callbacks object (similar to sendUserMessage)
         const apiUiCallbacks = {
            addMessageToChat: (content, sender, options) => addMessageToChatCallback(content, sender, options, state, elements, currentTranslations, window.addCopyButtonToCodeBlock, window.addMessageActionButtons, isUserNearBottom),
            updateStreamingMessage: (el, content) => window.updateStreamingMessage(el, content, isUserNearBottom, elements),
            finalizeBotMessage: (el, content) => window.finalizeBotMessage(el, content, window.addCopyButtonToCodeBlock, window.addMessageActionButtons, restoreSendButtonAndInputCallback, isUserNearBottom, elements),
            clearImages: () => {}, // Don't clear images on regenerate
            showToast: window.showToast // Assuming showToast is globally accessible or passed
        };

        // Call API to insert response
        await window.GeminiAPI.callApiAndInsertResponse(
            userMessageText,
            userImages,
            thinkingElement,
            historyForApi, // History *before* the user message
            userIndex + 1, // Insert *after* the user message index
            userMessageElement, // Insert *after* this DOM element
            state,
            apiUiCallbacks
        );
        // finalizeBotMessage will restore button state on success

    } catch (error) {
        console.error(`Regenerate failed:`, error);
        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
        // Add error message after the user message
        addMessageToChatCallback(_('regenerateError', { error: error.message }, currentTranslations), 'bot', { insertAfterElement: userMessageElement }, state, elements, currentTranslations, window.addCopyButtonToCodeBlock, window.addMessageActionButtons, isUserNearBottom);
        restoreSendButtonAndInputCallback(); // Restore button on error
    }
}

/**
 * Helper to extract text and image info from a message object.
 * @param {object} message - A message object from state.chatHistory
 * @returns {{text: string, images: Array<{dataUrl: string, mimeType: string}>}}
 */
function extractPartsFromMessage(message) {
    let text = '';
    const images = [];
    if (message && message.parts && Array.isArray(message.parts)) {
        message.parts.forEach(part => {
            if (part.text) {
                text += (text ? '\n' : '') + part.text; // Combine text parts
            } else if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
                images.push({
                    dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    mimeType: part.inlineData.mimeType
                });
            }
        });
    }
    return { text, images };
}

/**
 * Aborts the current streaming API request.
 * @param {object} state - Global state reference
 * @param {function} restoreSendButtonAndInputCallback - Callback
 */
export function abortStreaming(state, restoreSendButtonAndInputCallback) {
    if (window.GeminiAPI && window.GeminiAPI.currentAbortController) {
        console.log("Aborting API request...");
        window.GeminiAPI.currentAbortController.abort();
        // Controller cleanup happens in api.js finally block
    } else {
        console.warn("No active AbortController found to abort.");
    }
    // Always attempt to restore UI state after abort attempt
    restoreSendButtonAndInputCallback();
}