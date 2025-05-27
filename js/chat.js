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
 * @param {function} addMessageToChatCallback - Callback (this is main.js#addMessageToChatUI)
 * @param {function} addThinkingAnimationCallback - Callback (this is a lambda from main.js calling ui.js#addThinkingAnimation with live isUserNearBottom)
 * @param {function} resizeTextareaCallback - Callback
 * @param {function} clearImagesCallback - Callback
 * @param {function} clearVideosCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} abortStreamingCallback - Callback
 */
export async function sendUserMessage(state, elements, currentTranslations, showConnectionStatusCallback, addMessageToChatCallback, addThinkingAnimationCallback, resizeTextareaCallback, clearImagesCallback, clearVideosCallback, showToastCallback, restoreSendButtonAndInputCallback, abortStreamingCallback) {
    const userMessage = elements.userInput.value.trim();

    if (state.isStreaming) {
        console.warn("Cannot send message while streaming.");
        // if (showToastCallback) showToastCallback(_('streamingInProgress', {}, currentTranslations), 'warning'); // Commented out as per task
        return;
    }
    if (!userMessage && state.images.length === 0 && state.videos.length === 0) return;

    if (!state.apiKey) {
        // Show API key missing error as a toast on the chat page (首页下方)
        if (showToastCallback) showToastCallback(_('apiKeyMissingError', {}, currentTranslations), 'error');
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
    const currentVideos = [...state.videos]; // Copy videos for this message

    // Add user message UI (force scroll ensures it's visible before thinking anim)
    // addMessageToChatCallback (main.js#addMessageToChatUI) handles isUserNearBottom internally
    const userMessageElement = addMessageToChatCallback(userMessage, 'user', { images: currentImages, videos: currentVideos, forceScroll: true });
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
    currentVideos.forEach(video => {
        if (video.type === 'youtube') {
            currentParts.push({ fileData: { fileUri: video.url } });
        }
        // 移除本地视频文件处理，只支持 YouTube 视频
    });

    // Add user message to history *before* API call
    if (currentParts.length > 0) {
        state.chatHistory.push({ role: 'user', parts: currentParts, id: userMessageId });
    } else {
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
            finalizeBotMessage: (el, content) => window.finalizeBotMessage(el, content),
            showToast: showToastCallback,
            restoreSendButtonAndInput: restoreSendButtonAndInputCallback // Add this callback
        };

        // Call API
        await window.GeminiAPI.callGeminiAPIWithImages(
            userMessage,
            currentImages, // Use the copied currentImages
            currentVideos, // Use the copied currentVideos
            thinkingElement,
            state, // Pass full state reference
            apiUiCallbacks // Pass callbacks object
        );
        // finalizeBotMessage (called by API module on success) will restore button state

    } catch (error) {
        console.error('Error during sendUserMessage API call:', error);
        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
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
export function clearContext(state, elements, clearImagesCallback, clearVideosCallback, showToastCallback, currentTranslations, showToast = true) {
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
            // Assuming sendUserMessageTrigger is a global function or passed in main.js
            if (window.sendUserMessageTrigger) {
                window.sendUserMessageTrigger();
            } else {
                console.warn("Cannot trigger sendUserMessage from dynamic button.");
            }
        });
    }
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
 * @param {function} addMessageToChatCallback - Callback (main.js#addMessageToChatUI)
 * @param {function} addThinkingAnimationCallback - Callback (lambda from main.js for ui.js#addThinkingAnimation)
 * @param {function} restoreSendButtonAndInputCallback - Callback
 * @param {function} abortStreamingCallback - Callback
 * @param {function} showToastCallback - Callback to show toast notifications
 */
export async function regenerateMessage(messageId, state, elements, currentTranslations, addMessageToChatCallback, addThinkingAnimationCallback, restoreSendButtonAndInputCallback, abortStreamingCallback, showToastCallback) {
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
            finalizeBotMessage: (el, content) => window.finalizeBotMessage(el, content),
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
            apiUiCallbacks
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
    if (window.GeminiAPI && window.GeminiAPI.currentAbortController) {
        console.log("Aborting API request...");
        window.GeminiAPI.currentAbortController.abort();
        if (showToastCallback) showToastCallback(_('streamingAborted', {}, currentTranslations), 'info');
        // Controller cleanup happens in api.js finally block
    } else {
        console.warn("No active AbortController found to abort.");
    }
    // Always attempt to restore UI state after abort attempt
    restoreSendButtonAndInputCallback();
}