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
 * @param {Array<{title: string, content: string}>|null} [explicitContextTabs=null] - Explicit tab contents to use for context.
 * @returns {Promise<void>}
 */
async function callGeminiAPIInternal(userMessage, images = [], videos = [], thinkingElement, historyForApi, insertResponse = false, targetInsertionIndex = null, insertAfterElement = null, stateRef, uiCallbacks, explicitContextTabs = null) {
    let accumulatedText = '';
    let messageElement = null;
    let botMessageId = null;
    const controller = new AbortController(); // Create AbortController
    window.GeminiAPI.currentAbortController = controller; // Store controller globally

    function escapeXml(unsafe) {
        if (typeof unsafe !== 'string') {
            return ''; // Return empty string for non-string inputs or handle error
        }
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    try {
        // --- Determine actual API model name and thinking configuration ---
        let apiModelName = stateRef.model;
        let effectiveThinkingConfig = null;

        if (stateRef.model === 'gemini-2.5-flash') {
            apiModelName = 'gemini-2.5-flash-preview-05-20';
            effectiveThinkingConfig = { thinkingBudget: 0 };
        } else if (stateRef.model === 'gemini-2.5-flash-thinking') {
            apiModelName = 'gemini-2.5-flash-preview-05-20';
            effectiveThinkingConfig = null;
        }
        console.log(`Using API model ${apiModelName} (selected: ${stateRef.model}) with thinking config:`, effectiveThinkingConfig);

        const historyToSend = historyForApi ? [...historyForApi] : [...stateRef.chatHistory];

        const requestBody = {
            contents: [], // Initialize contents array
            generationConfig: {
                temperature: parseFloat(stateRef.temperature),
                maxOutputTokens: parseInt(stateRef.maxTokens),
                topP: parseFloat(stateRef.topP),
            },
            tools: []
        };

        if (effectiveThinkingConfig) {
            requestBody.generationConfig.thinkingConfig = effectiveThinkingConfig;
        }

        const actualApiModelsSupportingUrlContext = ['gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash'];
        if (actualApiModelsSupportingUrlContext.includes(apiModelName)) {
            requestBody.tools.push({ "url_context": {} });
            console.log(`URL context tool added for model: ${apiModelName}`);
        }
        if (requestBody.tools.length === 0) {
            delete requestBody.tools;
        }

        // --- Construct XML System Prompt ---
        let xmlSystemPrompt = `
<instructions>
  <role>You are a helpful and professional AI assistant. You are capable of understanding and processing text, as well as analyzing images provided in the user's messages. Your primary goal is to answer the user's questions accurately and informatively, drawing upon all provided context, including images and chat history. If an image is provided, please analyze it and use that information in your response.</role>
  <output_format>
    <language>Respond in the language used by the user in their most recent query.</language>
    <markdown>Format your entire response using Markdown.</markdown>
  </output_format>
  <context_handling>
    <general>You will be provided with several pieces of context: the main page content, additional selected web pages, and the ongoing chat history. Integrate information from all relevant sources to formulate your response.</general>
    <source_attribution>
      <guideline>When your answer incorporates information directly from the 'main_page_content' or any 'additional_page_context', you should briefly mention the source by its title. This helps the user understand the basis of your answer.</guideline>
      <format_examples>
        <example>For instance: "According to the 'Summarized Page Title A' document,..."</example>
        <example>Or: "Regarding X, the page 'Summarized Page Title B' suggests that..."</example>
      </format_examples>
      <natural_integration>Strive for natural integration of these attributions. Avoid rigid, repetitive attributions for every sentence unless crucial for clarity. A single attribution for a paragraph drawing from one source is often sufficient.</natural_integration>
    </source_attribution>
    <information_usage>
      <accuracy>Base your answers strictly on the provided information. Do not introduce external knowledge or make assumptions beyond the given context.</accuracy>
      <conciseness>Be concise yet comprehensive.</conciseness>
      <no_fabrication>If the answer cannot be found in the provided contexts, clearly state this.</no_fabrication>
      <important_content_source_clarification>
        You have been given the full text content for the 'main_page_content' and any pages listed under 'additional_page_contexts'.\n      When answering questions about these specific documents, you MUST rely exclusively on the text provided within their respective \\\`<content>\\\` tags.\n      DO NOT attempt to access or fetch any external URLs for these documents, even if their titles ('source_title') or any part of the user's query seems to mention a URL related to them.\n      Your knowledge for these provided documents is the text embedded here. Treat this embedded text as the definitive source.\n      </important_content_source_clarification>
    </information_usage>
  </context_handling>
  <multi_turn_dialogue>
    <instruction>Carefully consider the entire chat history to understand conversational flow and maintain relevance. Refer to previous turns as needed for coherent, contextually appropriate responses.</instruction>
  </multi_turn_dialogue>
  <agent_specific_instructions>
    ${stateRef.systemPrompt ? `<content>\n${escapeXml(stateRef.systemPrompt)}\n</content>` : '<content>No specific agent instructions provided.</content>'}
  </agent_specific_instructions>
</instructions>

<provided_contexts>
  <main_page_content source_title="Current Page Document">
    <content>
      ${stateRef.pageContext ? escapeXml(stateRef.pageContext) : 'No main page content was loaded or provided.'}
    </content>
  </main_page_content>
`;

        if (explicitContextTabs && explicitContextTabs.length > 0) {
            xmlSystemPrompt += `  <additional_page_contexts>
`;
            explicitContextTabs.forEach(tab => {
                if (tab.content) {
                    xmlSystemPrompt += `    <page source_title="${escapeXml(tab.title)}">\n      <content>\n${escapeXml(tab.content)}\n      </content>\n    </page>\n`;
                } else {
                    xmlSystemPrompt += `    <page source_title="${escapeXml(tab.title)}">\n      <content>Content for this tab was not loaded or is empty.</content>\n    </page>\n`;
                }
            });
            xmlSystemPrompt += `  </additional_page_contexts>
`;
        } else {
            xmlSystemPrompt += `  <additional_page_contexts_status>No additional pages were selected for context.</additional_page_contexts_status>
`;
        }
        xmlSystemPrompt += `</provided_contexts>`;
        // --- End XML System Prompt Construction ---

        // Add XML system prompt as the first user turn
        requestBody.contents.push({ role: 'user', parts: [{ text: xmlSystemPrompt.trim() }] });
        // Add a model acknowledgment turn
        requestBody.contents.push({ role: 'model', parts: [{ text: "Understood. I will adhere to these instructions and utilize the provided contexts and chat history." }] });

        // Add chat history
        historyToSend.forEach(msg => {
            if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
                requestBody.contents.push({ role: msg.role, parts: msg.parts });
            } else {
                console.warn("Skipping history message due to missing, invalid, or empty parts:", msg);
            }
        });

        // Add current user message (text, images, videos)
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
        } else if (requestBody.contents.length === 2 && !requestBody.tools) { // Check if only system prompt + ack and no tools
             console.warn("Attempting to send an effectively empty message (only system prompt and ack) with no tools.");
            if (thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
            // uiCallbacks.addMessageToChat("无法发送空消息。", 'bot'); // Potentially re-enable if needed
            if (uiCallbacks && uiCallbacks.restoreSendButtonAndInput) {
                 uiCallbacks.restoreSendButtonAndInput();
            }
            return;
        }

        const endpoint = `${API_BASE_URL}/models/${apiModelName}:streamGenerateContent?key=${stateRef.apiKey}&alt=sse`; // Use actual apiModelName

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal // Pass signal to fetch
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}, unable to parse error response.` } }));
            const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
            // Log the actual model being used and the error for debugging
            console.error(`API Error with model ${apiModelName} (selected: ${stateRef.model}): ${errorMessage}`, errorData);
            throw new Error(errorMessage);
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
 * @param {Array<{title: string, content: string}>|null} [contextTabsForApi=null] - Explicit tab contents for API.
 */
async function callGeminiAPIWithImages(userMessage, images = [], videos = [], thinkingElement, stateRef, uiCallbacks, contextTabsForApi = null) {
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, null, false, null, null, stateRef, uiCallbacks, contextTabsForApi); // insertResponse = false, historyForApi = null
}

/**
 * 用于重新生成并插入响应
 * @param {Array<{title: string, content: string}>|null} [contextTabsForApi=null] - Explicit tab contents for API.
 */
async function callApiAndInsertResponse(userMessage, images = [], videos = [], thinkingElement, historyForApi, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks, contextTabsForApi = null) {
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, historyForApi, true, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks, contextTabsForApi); // insertResponse = true
}

// Export functions to be used in sidepanel.js
window.GeminiAPI = {
    testAndVerifyApiKey: _testAndVerifyApiKey,
    callGeminiAPIWithImages: callGeminiAPIWithImages,
    callApiAndInsertResponse: callApiAndInsertResponse,
    currentAbortController: null // Initialize the controller holder
};