/**
 * Pagetalk - Gemini API Interaction Module
 */

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Internal helper to test API key and model validity.
 * @param {string} apiKey - The API key to test.
 * @param {string} model - The model to test against. Can be a "logical" model name.
 * @returns {Promise<{success: boolean, message: string}>} - Object indicating success and a message.
 */
async function _testAndVerifyApiKey(apiKey, model) {
    try {
        let apiTestModel = model;
        // Map logical model names to actual API model names for testing if necessary
        if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-thinking') {
            apiTestModel = 'gemini-2.5-flash-preview-05-20';
        }

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: 'test' }] }] // Simple test payload
        };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiTestModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            return { success: true, message: 'Connection established ! API Key verified.' };
        } else {
            // Try to parse error, provide fallback message
            const error = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}` } }));
            const errorMessage = error.error?.message || `HTTP error ${response.status}`;
            // Check for specific API key related errors if possible (example)
            if (errorMessage.includes('API key not valid')) {
                return { success: false, message: 'Connection failed: API key not valid. Please check your key.' };
            }
            return { success: false, message: `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        console.error('API Test Error:', error);
        // Provide a more user-friendly network error message
        let friendlyMessage = 'Connection failed: Network error or server unreachable.';
        if (error instanceof TypeError && error.message.includes('fetch')) {
            friendlyMessage = 'Connection failed: Could not reach the server. Check your internet connection.';
        } else if (error.message) {
            friendlyMessage = `Connection failed: ${error.message}`;
        }
        return { success: false, message: friendlyMessage };
    }
}


/**
 * 核心 API 调用逻辑，支持插入或追加响应
 * @param {string} userMessage - 用户消息内容
 * @param {Array<{dataUrl: string, mimeType: string}>} images - 图片数组
 * @param {Array<{dataUrl?: string, mimeType?: string, url?: string, type: string}>} videos - 视频数组
 * @param {HTMLElement} thinkingElement - 思考动画元素
 * @param {Array|null} historyForApi - 用于 API 调用的历史记录 (null 表示使用全局历史)
 * @param {boolean} insertResponse - true: 插入响应, false: 追加响应
 * @param {number|null} [targetInsertionIndex=null] - 如果 insertResponse 为 true，则指定插入到 state.chatHistory 的索引
 * @param {HTMLElement|null} [insertAfterElement=null] - 如果 insertResponse 为 true，则指定插入到此 DOM 元素之后
 * @param {object} stateRef - Reference to the main state object from sidepanel.js
 * @param {object} uiCallbacks - Object containing UI update functions { addMessageToChat, updateStreamingMessage, finalizeBotMessage, clearImages, clearVideos, showToast }
 * @returns {Promise<void>}
 */
async function callGeminiAPIInternal(userMessage, images = [], videos = [], thinkingElement, historyForApi, insertResponse = false, targetInsertionIndex = null, insertAfterElement = null, stateRef, uiCallbacks) {
    let accumulatedText = '';
    let messageElement = null;
    let botMessageId = null;
    const controller = new AbortController(); // Create AbortController
    window.GeminiAPI.currentAbortController = controller; // Store controller globally
    try {
        // --- Determine actual API model name and thinking configuration ---
        let apiModelName = stateRef.model; // Default to the selected model name from dropdown
        let effectiveThinkingConfig = null; // 默认为null，不发送thinkingConfig参数

        if (stateRef.model === 'gemini-2.5-flash') {
            apiModelName = 'gemini-2.5-flash-preview-05-20'; // Underlying API model
            effectiveThinkingConfig = { thinkingBudget: 0 }; // 只有gemini-2.5-flash设为0
        } else if (stateRef.model === 'gemini-2.5-flash-thinking') {
            apiModelName = 'gemini-2.5-flash-preview-05-20'; // Underlying API model
            effectiveThinkingConfig = null; // 不发送thinkingConfig参数
        }
        // 对其他所有模型，保持effectiveThinkingConfig = null的默认值

        console.log(`Using API model ${apiModelName} (selected: ${stateRef.model}) with thinking config:`, effectiveThinkingConfig);

        // 使用提供的历史记录 (historyForApi) 或全局历史记录 (stateRef.chatHistory)
        const historyToSend = historyForApi ? [...historyForApi] : [...stateRef.chatHistory]; // Use stateRef

        // 构建请求体
        const requestBody = {
            contents: [],
            generationConfig: {
                temperature: parseFloat(stateRef.temperature), // Use stateRef
                maxOutputTokens: parseInt(stateRef.maxTokens), // Use stateRef
                topP: parseFloat(stateRef.topP), // Use stateRef
            },
            tools: [] // Initialize tools array
        };

        // Add thinkingConfig to generationConfig only if it's not null
        if (effectiveThinkingConfig) {
            requestBody.generationConfig.thinkingConfig = effectiveThinkingConfig;
        }

        // --- Add URL context tool for supported models ---
        // These are the *actual* API model names that support URL context.
        const actualApiModelsSupportingUrlContext = [
            'gemini-2.5-flash-preview-05-20',
            'gemini-2.0-flash'
            // Add other *actual* API model names like 'gemini-2.5-pro-preview-05-06'
            // or 'gemini-2.0-flash-live-001' if they are added to the selection
            // and directly used as `apiModelName`.
        ];

        if (actualApiModelsSupportingUrlContext.includes(apiModelName)) {
            requestBody.tools.push({ "url_context": {} });
            console.log(`URL context tool added for model: ${apiModelName}`);
        }

        // If tools array is empty after all checks (e.g., no tools added), remove it from requestBody
        if (requestBody.tools.length === 0) {
            delete requestBody.tools;
        }

        // --- 构建 contents 的逻辑 ---
        let systemContent = stateRef.systemPrompt; // Use stateRef
        if (stateRef.pageContext) { // Use stateRef
            systemContent += `\n\n以下是作为你回答的网页参考内容，回答时请务必使用用户所使用的语言，并用markdown格式输出\n\n${stateRef.pageContext}`; // Use stateRef
        }

        // 新增：整合来自选定标签页的上下文
        if (stateRef.selectedContextTabs && stateRef.selectedContextTabs.length > 0) {
            // 移除 ESystemPrompt
            // let ESystemPrompt = '\n\n你拥有多个网页读取能力，可以同时阅读多个网页，以下是你读取到的网页内容。其中 [tabTitle: "网页1", tabContent: "网页1"]，[tabTitle: "网页2", tabContent: "网页内容2"] 以此类推，当用户提问时，请根据这些页面的内容进行回答。回答的正文部分，如果必要，请明确指出信息来源于哪个页面，给出缩略标题。\n\n'
            // systemContent += ESystemPrompt;
            
            systemContent += "\n\n当涉及多个外部文档时，回答的正文部分，如果必要，请明确指出信息来源于哪个页面（给出该页面的缩略标题）。例如：'根据页面 A 的内容（不要把完整的页面内容展示出来，让用户知道页面来源即可）...'。请避免在每句话末尾都重复来源，除非对于理解至关重要。";

            stateRef.selectedContextTabs.forEach(tab => {
                if (tab.content && !tab.isLoading) {
                    const escapedTitle = tab.title.replaceAll('"', '\\"');
                    // systemContent += `[tabTitle: "${escapedTitle}", tabContent: "${tab.content}"]\n`;
                    // 更改整合格式，使其更自然
                    systemContent += `\n\n--- 页面：${escapedTitle} ---\n${tab.content}\n--- 结束页面：${escapedTitle} ---\n`;
                }
            });
        }

        if (systemContent) {
            requestBody.contents.push({ role: 'user', parts: [{ text: systemContent }] });
            requestBody.contents.push({ role: 'model', parts: [{ text: "OK." }] });
        }
        // 使用准备好的 historyToSend 进行迭代
        historyToSend.forEach(msg => {
            if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
                requestBody.contents.push({ role: msg.role, parts: msg.parts });
            } else {
                console.warn("Skipping history message due to missing, invalid, or empty parts:", msg);
            }
        });
        const currentParts = [];
        if (userMessage) currentParts.push({ text: userMessage });
        if (images.length > 0) {
            for (const image of images) {
                const base64data = image.dataUrl.split(',')[1];
                currentParts.push({ inlineData: { mimeType: image.mimeType, data: base64data } });
            }
        }
        if (videos.length > 0) {
            for (const video of videos) {
                if (video.type === 'youtube') {
                    // YouTube URL
                    currentParts.push({
                        fileData: {
                            fileUri: video.url
                        }
                    });
                }

            }
        }
        if (currentParts.length > 0) {
            requestBody.contents.push({ role: 'user', parts: currentParts });
        } else if (requestBody.contents.length === 0 && !requestBody.tools) { // Also check if tools are present, as a request with only tools might be valid for some APIs
            console.warn("Attempting to send an empty message with no history and no tools.");
            if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
            uiCallbacks.addMessageToChat("无法发送空消息。", 'bot'); // Use callback
            return;
        }
        // --- 结束构建 contents 的逻辑 ---

        const endpoint = `${API_BASE_URL}/models/${apiModelName}:streamGenerateContent?key=${stateRef.apiKey}&alt=sse`; // Use actual apiModelName

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal // Pass signal to fetch
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: '无法解析错误响应' } }));
            // 检查是否是多媒体不支持的错误
            if (images.length > 0 && errorData.error?.message?.includes('does not support image input')) {
                // 直接抛出特定错误信息，由外部 catch 处理 UI 显示
                throw new Error(`Model ${apiModelName} does not support image input`);
            }
            if (videos.length > 0 && errorData.error?.message?.includes('does not support video input')) {
                // 直接抛出特定错误信息，由外部 catch 处理 UI 显示
                throw new Error(`Model ${apiModelName} does not support video input`);
            }
            // 其他错误，抛出通用错误
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        // 处理 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonString = line.substring(6).trim();
                    if (jsonString) {
                        try {
                            const chunkData = JSON.parse(jsonString);
                            const textChunk = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (textChunk !== undefined && textChunk !== null) {
                                if (thinkingElement && thinkingElement.parentNode) {
                                    thinkingElement.remove();
                                }
                                if (!messageElement) {
                                    // 创建流式消息元素，插入或追加
                                    messageElement = uiCallbacks.addMessageToChat(null, 'bot', { isStreaming: true, insertAfterElement: insertResponse ? insertAfterElement : null }); // Use callback with options object
                                    botMessageId = messageElement.dataset.messageId;
                                    // --- 新增：立即添加占位符到历史记录 ---
                                    const botResponsePlaceholder = {
                                        role: 'model',
                                        parts: [{ text: '' }], // Start with empty text
                                        id: botMessageId
                                    };
                                    if (insertResponse && targetInsertionIndex !== null) {
                                        stateRef.chatHistory.splice(targetInsertionIndex, 0, botResponsePlaceholder);
                                        console.log(`Inserted bot placeholder at index ${targetInsertionIndex}`);
                                    } else {
                                        stateRef.chatHistory.push(botResponsePlaceholder);
                                        console.log(`Appended bot placeholder`);
                                    }
                                    // --- 结束：新增 ---
                                }
                                accumulatedText += textChunk;
                                uiCallbacks.updateStreamingMessage(messageElement, accumulatedText); // Use callback
                            }
                        } catch (e) { console.error('Failed to parse JSON chunk:', jsonString, e); }
                    }
                }
            }
        }
        // 处理可能剩余的 buffer
        if (buffer.startsWith('data: ')) {
            const jsonString = buffer.substring(6).trim();
            if (jsonString) {
                try {
                    const chunkData = JSON.parse(jsonString);
                    const textChunk = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textChunk !== undefined && textChunk !== null) {
                        if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
                        if (!messageElement) {
                            // 创建流式消息元素，插入或追加 (与上面逻辑相同)
                            messageElement = uiCallbacks.addMessageToChat(null, 'bot', { isStreaming: true, insertAfterElement: insertResponse ? insertAfterElement : null }); // Use callback with options object
                            botMessageId = messageElement.dataset.messageId;
                            // --- 新增：立即添加占位符到历史记录 (与上面逻辑相同) ---
                            const botResponsePlaceholder = {
                                role: 'model',
                                parts: [{ text: '' }], // Start with empty text
                                id: botMessageId
                            };
                            if (insertResponse && targetInsertionIndex !== null) {
                                stateRef.chatHistory.splice(targetInsertionIndex, 0, botResponsePlaceholder);
                                console.log(`Inserted bot placeholder at index ${targetInsertionIndex}`);
                            } else {
                                stateRef.chatHistory.push(botResponsePlaceholder);
                                console.log(`Appended bot placeholder`);
                            }
                            // --- 结束：新增 ---
                        }
                        accumulatedText += textChunk;
                        uiCallbacks.updateStreamingMessage(messageElement, accumulatedText); // Use callback
                    }
                } catch (e) { console.error('Failed to parse final JSON chunk:', jsonString, e); }
            }
        }

        // 流结束
        if (messageElement && botMessageId) { // Ensure we have the ID
            uiCallbacks.finalizeBotMessage(messageElement, accumulatedText); // Use callback
            // --- 修改历史记录中的占位符 ---
            const historyIndex = stateRef.chatHistory.findIndex(msg => msg.id === botMessageId);
            if (historyIndex !== -1) {
                stateRef.chatHistory[historyIndex].parts = [{ text: accumulatedText }];
                console.log(`Updated bot message in history at index ${historyIndex}`);
            } else {
                console.error(`Could not find bot message with ID ${botMessageId} in history to finalize.`);
                // Fallback: Add if not found (should not happen ideally)
                const newAiResponseObject = { role: 'model', parts: [{ text: accumulatedText }], id: botMessageId };
                if (insertResponse && targetInsertionIndex !== null) {
                    stateRef.chatHistory.splice(targetInsertionIndex, 0, newAiResponseObject);
                } else {
                    stateRef.chatHistory.push(newAiResponseObject);
                }
            }
            // --- 结束：修改 ---
        } else if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
            uiCallbacks.addMessageToChat("未能生成回复。", 'bot', false, [], insertResponse ? insertAfterElement : null); // Use callback
        }

        // 清除图片和视频（仅在初始发送时）
        if ((stateRef.images.length > 0 || stateRef.videos.length > 0) && thinkingElement && historyForApi === null) { // Use stateRef
            if (stateRef.images.length > 0) {
                uiCallbacks.clearImages(); // Use callback
            }
            if (stateRef.videos.length > 0) {
                uiCallbacks.clearVideos(); // Use callback
            }
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('API call aborted by user.'); // Log abortion
            // If aborted, ensure the partial message is finalized and history is updated
            if (messageElement && botMessageId) {
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText); // Finalize potentially partial message
                // --- 新增：更新历史记录中的占位符 (即使中止) ---
                const historyIndex = stateRef.chatHistory.findIndex(msg => msg.id === botMessageId);
                if (historyIndex !== -1) {
                    stateRef.chatHistory[historyIndex].parts = [{ text: accumulatedText }];
                    console.log(`Updated aborted bot message in history at index ${historyIndex}`);
                } else {
                    console.error(`Could not find bot message with ID ${botMessageId} in history to finalize after abort.`);
                }
                // --- 结束：新增 ---
            } else if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.remove(); // Remove thinking animation if no message started
            }
            // No error message needed for user-initiated abort
        } else {
            console.error('API 调用失败:', error);
            if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.remove();
            }
            // Restore UI state on API error
            if (uiCallbacks && uiCallbacks.restoreSendButtonAndInput) {
                uiCallbacks.restoreSendButtonAndInput();
            }
            if (messageElement) {
                // Remove the prefix "获取响应时出错: "
                const errorText = `\n\n--- ${error.message} ---`;
                accumulatedText += errorText;
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText); // Use callback
            } else { // If error happened before streaming started
                // Create a proper error message object and add it to history and DOM
                // Remove the prefix "获取响应时出错: "
                const errorMessageText = `${error.message}`;

                // Add to DOM using addMessageToChat and capture the element
                const errorElement = uiCallbacks.addMessageToChat(errorMessageText, 'bot', { insertAfterElement: insertResponse ? insertAfterElement : null });

                if (errorElement && errorElement.dataset.messageId) {
                    const errorMessageId = errorElement.dataset.messageId; // Get ID from the created element
                    errorElement.classList.add('error-message'); // Optionally add a class for styling

                    const errorMessageObject = {
                        role: 'model', // Treat API errors as 'model' role for history consistency
                        parts: [{ text: errorMessageText }],
                        id: errorMessageId
                    };

                    // Add to history at the correct position
                    if (insertResponse && targetInsertionIndex !== null) {
                        stateRef.chatHistory.splice(targetInsertionIndex, 0, errorMessageObject);
                        console.log(`Inserted error message object into history at index ${targetInsertionIndex}`);
                    } else {
                        stateRef.chatHistory.push(errorMessageObject);
                        console.log(`Appended error message object to history`);
                    }
                } else {
                    // Fallback if element creation or ID retrieval failed
                    console.error("Failed to create or get ID for error message element. History might be inconsistent.");
                    // Still show a basic error message
                    uiCallbacks.addMessageToChat(errorMessageText, 'bot', { insertAfterElement: insertResponse ? insertAfterElement : null });
                }
            }
        }
    } finally {
        // Ensure the controller is cleared regardless of success, error, or abort
        if (window.GeminiAPI.currentAbortController === controller) { // Check if it's still the same controller
            window.GeminiAPI.currentAbortController = null;
            console.log('Cleared currentAbortController.');
        }
    }
}

/**
 * 用于发送新消息 (追加)
 */
async function callGeminiAPIWithImages(userMessage, images = [], videos = [], thinkingElement, stateRef, uiCallbacks) {
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, null, false, null, null, stateRef, uiCallbacks); // insertResponse = false, historyForApi = null
}

/**
 * 用于重新生成并插入响应
 */
async function callApiAndInsertResponse(userMessage, images = [], videos = [], thinkingElement, historyForApi, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks) {
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, historyForApi, true, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks); // insertResponse = true
}

// Export functions to be used in sidepanel.js
window.GeminiAPI = {
    testAndVerifyApiKey: _testAndVerifyApiKey,
    callGeminiAPIWithImages: callGeminiAPIWithImages,
    callApiAndInsertResponse: callApiAndInsertResponse,
    currentAbortController: null // Initialize the controller holder
};