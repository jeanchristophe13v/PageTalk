/**
 * Pagetalk - Gemini API Interaction Module
 */

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Internal helper to test API key and model validity.
 * @param {string} apiKey - The API key to test.
 * @param {string} model - The model to test against.
 * @returns {Promise<{success: boolean, message: string}>} - Object indicating success and a message.
 */
async function _testAndVerifyApiKey(apiKey, model) {
    try {
        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: 'test' }] }] // Simple test payload
        };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
 * @param {HTMLElement} thinkingElement - 思考动画元素
 * @param {Array|null} historyForApi - 用于 API 调用的历史记录 (null 表示使用全局历史)
 * @param {boolean} insertResponse - true: 插入响应, false: 追加响应
 * @param {number|null} [targetInsertionIndex=null] - 如果 insertResponse 为 true，则指定插入到 state.chatHistory 的索引
 * @param {HTMLElement|null} [insertAfterElement=null] - 如果 insertResponse 为 true，则指定插入到此 DOM 元素之后
 * @param {object} stateRef - Reference to the main state object from sidepanel.js
 * @param {object} uiCallbacks - Object containing UI update functions { addMessageToChat, updateStreamingMessage, finalizeBotMessage, clearImages, showToast }
 * @returns {Promise<void>}
 */
async function callGeminiAPIInternal(userMessage, images = [], thinkingElement, historyForApi, insertResponse = false, targetInsertionIndex = null, insertAfterElement = null, stateRef, uiCallbacks) {
    let accumulatedText = '';
    let messageElement = null;
    let currentModel = stateRef.model; // Use stateRef
    let botMessageId = null;

    try {
        console.log(`使用模型 ${currentModel} 处理请求 (Insert: ${insertResponse})`);

        // 使用提供的历史记录 (historyForApi) 或默认历史记录 (stateRef.chatHistory)
        const historyToSend = historyForApi ? [...historyForApi] : [...stateRef.chatHistory]; // Use stateRef

        // 构建请求体
        const requestBody = {
            contents: [],
            generationConfig: {
                temperature: parseFloat(stateRef.temperature), // Use stateRef
                maxOutputTokens: parseInt(stateRef.maxTokens), // Use stateRef
                topP: parseFloat(stateRef.topP) // Use stateRef
            }
        };

        // --- 构建 contents 的逻辑 ---
        let systemContent = stateRef.systemPrompt; // Use stateRef
        if (stateRef.pageContext) { // Use stateRef
            systemContent += `\n\n以下是网页的内容，请根据这些内容回答用户问题：\n\n${stateRef.pageContext}`; // Use stateRef
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
        if (currentParts.length > 0) {
             requestBody.contents.push({ role: 'user', parts: currentParts });
        } else if (requestBody.contents.length === 0) {
             console.warn("Attempting to send an empty message with no history.");
             if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
             uiCallbacks.addMessageToChat("无法发送空消息。", 'bot'); // Use callback
             return;
        }
        // --- 结束构建 contents 的逻辑 ---

        const endpoint = `${API_BASE_URL}/models/${currentModel}:streamGenerateContent?key=${stateRef.apiKey}&alt=sse`; // Use stateRef

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: '无法解析错误响应' } }));
            // 检查是否是图片不支持的错误
            if (images.length > 0 && errorData.error?.message?.includes('does not support image input')) {
                 // 直接抛出特定错误信息，让外层 catch 处理 UI 显示
                 throw new Error(`模型 ${currentModel} 不支持图片输入`);
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
                                    messageElement = uiCallbacks.addMessageToChat(null, 'bot', true, [], insertResponse ? insertAfterElement : null); // Use callback
                                    botMessageId = messageElement.dataset.messageId;
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
                             messageElement = uiCallbacks.addMessageToChat(null, 'bot', true, [], insertResponse ? insertAfterElement : null); // Use callback
                             botMessageId = messageElement.dataset.messageId;
                         }
                         accumulatedText += textChunk;
                         uiCallbacks.updateStreamingMessage(messageElement, accumulatedText); // Use callback
                     }
                 } catch (e) { console.error('Failed to parse final JSON chunk:', jsonString, e); }
             }
        }

        // 流结束
        if (messageElement) {
            uiCallbacks.finalizeBotMessage(messageElement, accumulatedText); // Use callback
            const newAiResponseObject = {
                role: 'model',
                parts: [{ text: accumulatedText }],
                id: botMessageId
            };
            if (insertResponse && targetInsertionIndex !== null) {
                // 插入到历史记录的指定位置
                stateRef.chatHistory.splice(targetInsertionIndex, 0, newAiResponseObject); // Use stateRef
            } else {
                // 追加到历史记录末尾
                stateRef.chatHistory.push(newAiResponseObject); // Use stateRef
            }
        } else if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
            uiCallbacks.addMessageToChat("未能生成回复。", 'bot', false, [], insertResponse ? insertAfterElement : null); // Use callback
        }

        // 清除图片（仅在初始发送时）
        if (stateRef.images.length > 0 && thinkingElement && historyForApi === null) { // Use stateRef
             uiCallbacks.clearImages(); // Use callback
        }

    } catch (error) {
        console.error('API 调用失败:', error);
        if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.remove();
        }
        if (messageElement) {
            const errorText = `\n\n--- 获取响应时出错: ${error.message} ---`;
            accumulatedText += errorText;
            uiCallbacks.finalizeBotMessage(messageElement, accumulatedText); // Use callback
        } else {
            uiCallbacks.addMessageToChat(`获取响应时出错: ${error.message}`, 'bot', false, [], insertResponse ? insertAfterElement : null); // Use callback
        }
    }
}

/**
 * 用于发送新消息 (追加)
 */
async function callGeminiAPIWithImages(userMessage, images = [], thinkingElement, stateRef, uiCallbacks) {
    await callGeminiAPIInternal(userMessage, images, thinkingElement, null, false, null, null, stateRef, uiCallbacks); // insertResponse = false, historyForApi = null
}

/**
 * 用于重新生成时插入响应
 */
async function callApiAndInsertResponse(userMessage, images = [], thinkingElement, historyForApi, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks) {
    await callGeminiAPIInternal(userMessage, images, thinkingElement, historyForApi, true, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks); // insertResponse = true
}

// Export functions to be used in sidepanel.js
window.GeminiAPI = {
    testAndVerifyApiKey: _testAndVerifyApiKey,
    callGeminiAPIWithImages: callGeminiAPIWithImages,
    callApiAndInsertResponse: callApiAndInsertResponse
};