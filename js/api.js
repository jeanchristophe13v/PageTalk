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
 * 复杂度评估：调用 gemini-2.0-flash 返回 thinkingBudget
 * @param {string} userMessage - 用户消息内容
 * @param {object} stateRef - 状态对象
 * @returns {Promise<number>} - 推荐的 thinkingBudget
 */
async function getThinkingBudgetFromGemini20(userMessage, stateRef, uiCallbacks) {
    const prompt = `
You are an AI assistant acting as a highly precise query complexity evaluator. Your critical task is to analyze a user's query about web page content and determine the *minimum necessary* 'thinking budget' (an integer between 0 and 24576) for a subsequent, more powerful AI call (gemini-2.5-flash). The goal is maximum efficiency: assign 0 budget whenever possible for simple tasks, and only increase the budget proportionally to the *demonstrable complexity* of the query.

**Evaluation Principles:**

1.  **Default to Zero:** Start with the assumption that the budget is 0. Only increase it if the query *clearly* requires deeper processing based on the factors below. Your primary goal is to identify queries solvable with 0 budget.
2.  **Identify Core Task Intent:**
    *   **Direct Extraction / Fact Retrieval / Simple Summary:** Queries asking for readily available, explicit facts (e.g., author, date, title, specific numbers mentioned), a very high-level summary ("summarize", "main points", "TL;DR"), or simple listing ("list the key topics"). **Target Budget: 0.** These tasks require minimal interpretation or synthesis.
    *   **Specific Information Location & Basic Interpretation:** Queries asking for specific details that might require reading a section carefully but involve little analysis ("What does the text say about topic X?", "Find the definition of term Y provided in the text"). **Target Budget: Low (e.g., 1000-5000).** Requires locating and possibly slightly rephrasing information.
    *   **Explanation & Elaboration:** Queries requiring understanding and explaining concepts, relationships between ideas presented, or the meaning/purpose of specific sections ("Explain the concept of Z as described here", "What is the relationship between A and B according to the author?", "Why does the author include this example?"). **Target Budget: Medium (e.g., 5001-12000).** Requires understanding beyond literal extraction.
    *   **Analysis, Comparison & Evaluation:** Queries involving breaking down arguments, comparing/contrasting different points or perspectives within the text, identifying bias, evaluating the strength of evidence presented, or analyzing structure/tone ("Analyze the main argument", "Compare the pros and cons listed", "Evaluate the evidence for claim X", "What is the author's tone?"). **Target Budget: Medium-High (e.g., 12001-18000).** Requires critical thinking about the content.
    *   **Synthesis, Inference, Prediction & Creation:** Queries requiring combining information from multiple parts to form new conclusions, inferring information not explicitly stated, predicting future outcomes based *solely* on the text's information, generating creative summaries/critiques, or following complex multi-step instructions derived from the text ("Synthesize the findings from sections A and B", "What can be inferred about the author's background?", "Based *only* on this text, what is a likely next step?", "Write a short critique"). **Target Budget: High (e.g., 18001-24576).** Requires significant cognitive load and information integration.
3.  **Analyze Query Structure & Keywords:**
    *   **Simplicity Indicators:** "List", "Who", "What is", "When", "Where", "Find", "Summarize", "TL;DR". Strongly suggest low or 0 budget unless combined with complexity indicators.
    *   **Complexity Indicators:** "Analyze", "Compare", "Contrast", "Evaluate", "Explain why/how", "Synthesize", "Infer", "Predict", "Critique", "Discuss the implications", "In detail". Suggest higher budgets.
    *   **Specificity vs. Abstraction:** Is the query concrete ("Find the date") or abstract ("Discuss the philosophical implications")? Abstraction usually requires more budget.
    *   **Number of Implicit Steps:** Does answering the query require multiple logical steps (e.g., find X, then find Y, then compare them)? More steps generally mean more budget.
4.  **Budget Allocation Logic:**
    *   If the Core Task Intent is clearly Direct Extraction/Fact Retrieval/Simple Summary, assign **0**. Be strict about this.
    *   Otherwise, identify the primary Core Task Intent and start with the lower end of its suggested budget range.
    *   Increment the budget based *only* on the presence of clear Complexity Indicators, abstraction, or multiple implicit steps. Each significant complexity factor might warrant a moderate increase.
    *   Always aim for the *lowest possible budget* that allows the subsequent AI to reasonably address the query's complexity. Avoid generosity.

**Output Constraint:**
Your ONLY output MUST be a single integer between 0 and 24576. Do not include explanations, units, or any other text.

Now, evaluate the following user query:
${userMessage}
`;

    const endpoint = `${API_BASE_URL}/models/gemini-2.0-flash:generateContent?key=${stateRef.apiKey}`;
    const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 10,
            topP: 1
        }
    };
    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!resp.ok) throw new Error(`Gemini 2.0 Flash 预算评估失败: HTTP ${resp.status}`);
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        const num = parseInt(text, 10);
        if (isNaN(num) || num < 0 || num > 24576) return 8000; // fallback
        return num;
    } catch (e) {
        console.error('Gemini 2.0 Flash 预算评估异常:', e);
        return 8000;
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
    const controller = new AbortController(); // Create AbortController
    window.GeminiAPI.currentAbortController = controller; // Store controller globally
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
                topP: parseFloat(stateRef.topP), // Use stateRef
                thinkingConfig: {
                    thinkingBudget: 0 // 关闭 thinking 功能
                }
            }
        };

        // 若为 gemini-2.5-flash-preview-5-20，自动评估 thinkingBudget
        if (currentModel === 'gemini-2.5-flash-preview-5-20') {
            requestBody.generationConfig.thinkingConfig.thinkingBudget = await getThinkingBudgetFromGemini20(userMessage, stateRef, uiCallbacks);
        }

        // --- 构建 contents 的逻辑 ---
        let systemContent = stateRef.systemPrompt; // Use stateRef
        if (stateRef.pageContext) { // Use stateRef
            systemContent += `\n\n以下是作为你回答的网页参考内容，回答时请务必使用用户所使用的语言，并用markdown格式输出：\n\n${stateRef.pageContext}`; // Use stateRef
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
            signal: controller.signal // Pass signal to fetch
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
            // --- 修改：更新历史记录中的占位符 ---
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

        // 清除图片（仅在初始发送时）
        if (stateRef.images.length > 0 && thinkingElement && historyForApi === null) { // Use stateRef
             uiCallbacks.clearImages(); // Use callback
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
            if (messageElement) {
                const errorText = `\n\n--- 获取响应时出错: ${error.message} ---`;
                accumulatedText += errorText;
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText); // Use callback
            } else { // If error happened before streaming started
                // Create a proper error message object and add it to history and DOM
                const errorMessageText = `获取响应时出错: ${error.message}`;

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
    callApiAndInsertResponse: callApiAndInsertResponse,
    currentAbortController: null // Initialize the controller holder
};
