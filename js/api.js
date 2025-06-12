/**
 * Pagetalk - Gemini API Interaction Module
 */

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Internal helper to test API key and model validity.
 * @param {string} apiKey - The API key to test.
 * @param {string} model - The model to test against. Can be a "logical" model name.
 * @param {string} [proxyAddress] - Optional proxy address.
 * @returns {Promise<{success: boolean, message: string}>} - Object indicating success and a message.
 */
function _testAndVerifyApiKey(apiKey, model, proxyAddress) {
    // Determine the actual model name for the API test
    let apiTestModel = model;
    if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-thinking') {
        apiTestModel = 'gemini-2.5-flash-preview-05-20';
    }

    const requestBody = {
        contents: [{ role: 'user', parts: [{ text: 'test' }] }]
    };
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiTestModel}:generateContent?key=${apiKey}`;

    if (proxyAddress && proxyAddress.trim() !== '') {
        // Use proxy via background script
        return new Promise((resolve, reject) => {
            const fetchOptions = {
                url: targetUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            };

            chrome.runtime.sendMessage(
                { action: 'proxyFetch', fetchOptions: fetchOptions, proxyAddress: proxyAddress },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending/receiving from background for API test:', chrome.runtime.lastError.message);
                        reject({ success: false, message: `Proxy communication error: ${chrome.runtime.lastError.message}` });
                        return;
                    }
                    if (response && response.success) {
                        // Assuming background's success means the fetch itself was OK.
                        // Further validation of 'response.data' might be needed if the proxy can return 200 for proxy errors.
                        // For now, this aligns with the simplified success check.
                        resolve({ success: true, message: 'Connection established via proxy! API Key potentially verified.' });
                    } else {
                        reject({ success: false, message: `Connection failed via proxy: ${response.error || 'Unknown error'}` });
                    }
                }
            );
        });
    } else {
        // Direct fetch (original logic, but ensured it returns a Promise for consistency)
        return (async () => {
            try {
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    return { success: true, message: 'Connection established! API Key verified.' };
                } else {
                    const error = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}` } }));
                    const errorMessage = error.error?.message || `HTTP error ${response.status}`;
                    if (errorMessage.includes('API key not valid')) {
                        return { success: false, message: 'Connection failed: API key not valid. Please check your key.' };
                    }
                    return { success: false, message: `Connection failed: ${errorMessage}` };
                }
            } catch (error) {
                console.error('Direct API Test Error:', error);
                let friendlyMessage = 'Connection failed: Network error or server unreachable.';
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    friendlyMessage = 'Connection failed: Could not reach the server. Check your internet connection.';
                } else if (error.message) {
                    friendlyMessage = `Connection failed: ${error.message}`;
                }
                return { success: false, message: friendlyMessage };
            }
        })();
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

        // --- 获取更自然的页面标题 ---
        // 尝试从state中获取页面标题信息，否则使用默认值
        let pageTitle = '当前页面';
        
        // 如果有页面上下文，尝试从中提取标题信息
        if (stateRef.pageContext) {
            // 简单的标题提取逻辑 - 查找是否有标题信息
            const titleMatch = stateRef.pageContext.match(/^(.{1,100})/);
            if (titleMatch) {
                const firstLine = titleMatch[1].trim();
                // 如果第一行看起来像是标题（不太长且不包含大量技术符号）
                if (firstLine.length > 5 && firstLine.length < 80 && !firstLine.includes('function') && !firstLine.includes('class')) {
                    pageTitle = firstLine;
                }
            }
        }
        
        // 如果pageTitle仍然是默认值，检查URL来推断页面类型
        if (pageTitle === '当前页面' && typeof window !== 'undefined' && window.location) {
            const url = window.location.href;
            if (url.includes('github.com')) {
                pageTitle = 'GitHub页面';
            } else if (url.includes('stackoverflow.com')) {
                pageTitle = 'Stack Overflow页面';
            } else if (url.includes('youtube.com')) {
                pageTitle = 'YouTube页面';
            } else if (url.includes('reddit.com')) {
                pageTitle = 'Reddit页面';
            } else if (url.includes('wikipedia.org')) {
                pageTitle = 'Wikipedia页面';
            }
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
    <general>You have access to the current page content, additional web pages (if selected), and ongoing chat history. Use this information naturally to provide comprehensive and relevant answers.</general>
    <natural_response_style>
      <guideline>Answer questions naturally and conversationally. When information comes from the provided page content, integrate it seamlessly without mechanical attribution phrases. You know where the information comes from - just use it naturally.</guideline>
      <avoid_mechanical_phrases>Do not use rigid phrases like "根据Current Page Document" or "According to the provided document". Instead, when appropriate, use natural language like "这个页面提到", "从内容来看", "页面上显示", or simply present the information directly without attribution if it flows naturally.</avoid_mechanical_phrases>
      <when_to_attribute>Only mention sources explicitly when:
        1. There are multiple conflicting sources
        2. The user specifically asks about source verification
        3. It's crucial for understanding which specific document/page you're referencing
        Otherwise, let the information speak for itself.</when_to_attribute>
    </natural_response_style>
    <information_usage>
      <accuracy>Prioritize answering based on the provided context documents. If a question cannot be directly answered from these documents and pertains to general knowledge, you may use your broader knowledge base. Base your answers strictly on verifiable information.</accuracy>
      <conciseness>Be concise yet comprehensive. When appropriate, synthesize information from multiple provided documents or different parts of a single document, rather than listing disparate facts. Aim to provide a cohesive understanding and avoid unnecessary verbosity or repetition.</conciseness>
      <no_fabrication>If an answer cannot be found in the provided contexts or your general knowledge, clearly state this. Do not invent information.</no_fabrication>
      <content_source_handling>
        You have been given the full text content for the current page and any additional pages selected by the user. When answering questions about these specific documents, rely exclusively on the text provided. Do not attempt to access external URLs. Your knowledge for these provided documents is the embedded text content.
      </content_source_handling>
    </information_usage>
    <ambiguity_handling>
      <guideline>If the user's query is unclear or open to multiple interpretations, first try to identify the most probable intent and answer accordingly. If no single interpretation is significantly more probable, ask for clarification. Avoid making broad assumptions based on ambiguous queries.</guideline>
    </ambiguity_handling>
  </context_handling>
  <multi_turn_dialogue>
    <instruction>Carefully consider the entire chat history to understand conversational flow and maintain relevance. Refer to previous turns as needed for coherent, contextually appropriate responses.</instruction>
  </multi_turn_dialogue>
  <agent_specific_instructions>
    ${stateRef.systemPrompt ? `<content>\n${escapeXml(stateRef.systemPrompt)}\n</content>` : '<content>No specific agent instructions provided.</content>'}
  </agent_specific_instructions>
</instructions>

<provided_contexts>
  <current_page source_title="${escapeXml(pageTitle)}">
    <content>
      ${stateRef.pageContext ? escapeXml(stateRef.pageContext) : 'No page content was loaded or provided.'}
    </content>
  </current_page>
`;

        if (explicitContextTabs && explicitContextTabs.length > 0) {
            xmlSystemPrompt += `  <additional_pages>
`;
            explicitContextTabs.forEach(tab => {
                if (tab.content) {
                    xmlSystemPrompt += `    <page source_title="${escapeXml(tab.title)}">\n      <content>\n${escapeXml(tab.content)}\n      </content>\n    </page>\n`;
                } else {
                    xmlSystemPrompt += `    <page source_title="${escapeXml(tab.title)}">\n      <content>Content for this tab was not loaded or is empty.</content>\n    </page>\n`;
                }
            });
            xmlSystemPrompt += `  </additional_pages>
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

        const proxyAddress = stateRef.proxyAddress;

        if (proxyAddress && proxyAddress.trim() !== '') {
            // Using proxy via background script - NO SSE STREAMING
            const endpointForBackground = `${API_BASE_URL}/models/${apiModelName}:streamGenerateContent?key=${stateRef.apiKey}&alt=sse`;
            const fetchOptions = {
                url: endpointForBackground,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            };

            // No AbortController signal for proxied fetch in this version
            if (window.GeminiAPI.currentAbortController) {
                // Detach from global scope as we can't abort this specific proxied call easily
                window.GeminiAPI.currentAbortController = null;
                console.log("AbortController detached for proxied call.");
            }

            chrome.runtime.sendMessage(
                { action: 'proxyFetch', fetchOptions: fetchOptions, proxyAddress: proxyAddress },
                (response) => {
                    if (thinkingElement && thinkingElement.parentNode) {
                        thinkingElement.remove();
                    }

                    if (chrome.runtime.lastError) {
                        console.error('Proxy fetch message error:', chrome.runtime.lastError.message);
                        const errorMsg = `Proxy communication error: ${chrome.runtime.lastError.message}`;
                        const errorElement = uiCallbacks.addMessageToChat(errorMsg, 'bot', { insertAfterElement: insertResponse ? insertAfterElement : null });
                        if (errorElement && errorElement.dataset.messageId) {
                             stateRef.chatHistory.push({ role: 'model', parts: [{text: errorMsg}], id: errorElement.dataset.messageId});
                        } else {
                             stateRef.chatHistory.push({ role: 'model', parts: [{text: errorMsg}]}); // Fallback
                        }
                        if (uiCallbacks.restoreSendButtonAndInput) uiCallbacks.restoreSendButtonAndInput();
                        return;
                    }

                    if (response && response.success) {
                        const fullTextResponse = response.data;

                        let msgElement = uiCallbacks.addMessageToChat(null, 'bot', { isStreaming: false, insertAfterElement: insertResponse ? insertAfterElement : null });
                        uiCallbacks.updateStreamingMessage(msgElement, fullTextResponse); // Show full response at once
                        uiCallbacks.finalizeBotMessage(msgElement, fullTextResponse);

                        const botMsgId = msgElement.dataset.messageId;
                        const newAiResponse = { role: 'model', parts: [{ text: fullTextResponse }], id: botMsgId };

                        if (insertResponse && targetInsertionIndex !== null) {
                            // If inserting, we assume a placeholder might not exist or needs replacement.
                            // Check if a placeholder with the same ID was already added
                            const existingPlaceholderIndex = stateRef.chatHistory.findIndex(msg => msg.id === botMsgId);
                            if (existingPlaceholderIndex !== -1) {
                                stateRef.chatHistory[existingPlaceholderIndex] = newAiResponse;
                            } else {
                                stateRef.chatHistory.splice(targetInsertionIndex, 0, newAiResponse);
                            }
                        } else {
                            // If appending, check if a placeholder was added
                             const existingPlaceholderIndex = stateRef.chatHistory.findIndex(msg => msg.id === botMsgId);
                            if (existingPlaceholderIndex !== -1 && stateRef.chatHistory[existingPlaceholderIndex].parts[0].text === '') { // Check if it's an empty placeholder
                                stateRef.chatHistory[existingPlaceholderIndex] = newAiResponse;
                            } else {
                                stateRef.chatHistory.push(newAiResponse);
                            }
                        }

                    } else {
                        const errorMsg = `Error via proxy: ${response.error || 'Unknown error'}`;
                        const errorElement = uiCallbacks.addMessageToChat(errorMsg, 'bot', { insertAfterElement: insertResponse ? insertAfterElement : null });
                         if (errorElement && errorElement.dataset.messageId) {
                             stateRef.chatHistory.push({ role: 'model', parts: [{text: errorMsg}], id: errorElement.dataset.messageId});
                        } else {
                             stateRef.chatHistory.push({ role: 'model', parts: [{text: errorMsg}]}); // Fallback
                        }
                    }
                    if (uiCallbacks.restoreSendButtonAndInput) uiCallbacks.restoreSendButtonAndInput();
                     // Clear images/videos if this was an initial send (not a regeneration)
                    if ((stateRef.images.length > 0 || stateRef.videos.length > 0) && !insertResponse && historyForApi === null) {
                        if (stateRef.images.length > 0) uiCallbacks.clearImages();
                        if (stateRef.videos.length > 0) uiCallbacks.clearVideos();
                    }
                }
            );
            // Important: Since sendMessage is async, and this path doesn't use the original SSE loop,
            // we must return here to prevent the original SSE logic from executing.
            return;
        }

        // Original direct fetch logic with SSE streaming (if no proxy)
        const endpoint = `${API_BASE_URL}/models/${apiModelName}:streamGenerateContent?key=${stateRef.apiKey}&alt=sse`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}, unable to parse error response.` } }));
            const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
            console.error(`API Error with model ${apiModelName} (selected: ${stateRef.model}): ${errorMessage}`, errorData);
            throw new Error(errorMessage);
        }

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
