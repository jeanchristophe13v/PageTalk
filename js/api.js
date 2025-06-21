/**
 * PageTalk - 统一 API 交互模块
 *
 * 这个模块实现了多供应商 AI API 的统一调用接口，采用适配器模式支持不同供应商的 API 格式。
 * 支持的供应商类型：
 * - Gemini (Google)
 * - OpenAI Compatible (OpenAI, SiliconFlow, OpenRouter, DeepSeek, ChatGLM)
 * - Anthropic (Claude)
 */

// 导入供应商管理器
import { getProvider, API_TYPES } from './providerManager.js';

// 导入适配器
import { geminiAdapter, fetchGeminiModels, testGeminiApiKey } from './providers/adapters/geminiAdapter.js';
import { openaiAdapter, fetchOpenAIModels, testOpenAIApiKey } from './providers/adapters/openaiAdapter.js';
import { anthropicAdapter, fetchAnthropicModels, testAnthropicApiKey } from './providers/adapters/anthropicAdapter.js';

/**
 * 获取当前翻译对象
 * @returns {Object} 当前翻译对象
 */
function getCurrentTranslations() {
    // 尝试从全局获取当前语言
    let currentLanguage = 'zh-CN';

    // 尝试从全局状态获取语言设置
    if (typeof window !== 'undefined' && window.state && window.state.language) {
        currentLanguage = window.state.language;
    }
    // 从localStorage获取语言设置
    else if (typeof localStorage !== 'undefined') {
        currentLanguage = localStorage.getItem('language') || 'zh-CN';
    }

    // 从window.translations获取翻译
    if (typeof window !== 'undefined' && window.translations) {
        const translations = window.translations[currentLanguage] || window.translations['zh-CN'] || {};
        return translations;
    }
    return {};
}

/**
 * 代理请求函数 - 选择性代理实现，仅对 Gemini API 使用代理
 * 注意：在 content script 环境中，我们通过 background.js 来处理代理请求
 */
async function makeProxyRequest(url, options = {}, proxyAddress = '') {
    // 检查是否为 Gemini API 请求
    const isGeminiAPI = url.includes('generativelanguage.googleapis.com');

    // 如果没有配置代理或不是 Gemini API 请求，直接使用fetch
    if (!proxyAddress || proxyAddress.trim() === '' || !isGeminiAPI) {
        if (!isGeminiAPI) {
            console.log('[API] Non-Gemini API request, using direct fetch:', url);
        } else {
            console.log('[API] No proxy configured for Gemini API, using direct fetch');
        }
        return fetch(url, options);
    }

    // 对于 Gemini API 请求，如果配置了代理，通过 background.js 处理
    console.log('[API] Gemini API request with proxy, delegating to background.js');

    // 在 content script 环境中，我们需要通过 background.js 来处理代理请求
    // 这里保持原有逻辑，实际的代理处理在 background.js 中完成
    try {
        // 解析代理地址以验证格式
        const proxyUrl = new URL(proxyAddress.trim());
        const proxyScheme = proxyUrl.protocol.slice(0, -1); // 移除末尾的冒号

        console.log('[API] Using proxy for Gemini API:', proxyAddress, 'scheme:', proxyScheme);

        // 直接使用 fetch，让 background.js 的代理逻辑处理
        return fetch(url, options);

    } catch (error) {
        console.error('[API] Error parsing proxy URL:', error);
        // 如果代理配置有问题，回退到直接请求
        console.log('[API] Falling back to direct fetch due to proxy error');
        return fetch(url, options);
    }
}

/**
 * 获取代理设置并发起请求
 */
async function makeApiRequest(url, options = {}) {
    try {
        // 获取代理设置
        const result = await chrome.storage.sync.get(['proxyAddress']);
        const proxyAddress = result.proxyAddress;

        return await makeProxyRequest(url, options, proxyAddress);
    } catch (error) {
        console.error('[API] Error in makeApiRequest:', error);
        throw error;
    }
}

/**
 * Internal helper to test API key and model validity.
 * @param {string} apiKey - The API key to test.
 * @param {string} model - The model to test against. Can be a "logical" model name.
 * @returns {Promise<{success: boolean, message: string}>} - Object indicating success and a message.
 */
async function _testAndVerifyApiKey(apiKey, model) {
    try {
        // 使用ModelManager获取API模型配置
        let apiTestModel = model;
        if (window.ModelManager?.instance) {
            try {
                await window.ModelManager.instance.initialize();
                const modelConfig = window.ModelManager.instance.getModelApiConfig(model);
                apiTestModel = modelConfig.apiModelName;
            } catch (error) {
                console.warn('[API] Failed to get model config from ModelManager, using fallback logic:', error);
                // 回退到原有逻辑
                if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-thinking') {
                    apiTestModel = 'gemini-2.5-flash';
                } else if (model === 'gemini-2.5-pro') {
                    apiTestModel = 'gemini-2.5-pro';
                }
            }
        } else {
            console.warn('[API] ModelManager not available, using fallback logic');
            // 回退到原有逻辑
            if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-thinking') {
                apiTestModel = 'gemini-2.5-flash';
            } else if (model === 'gemini-2.5-pro') {
                apiTestModel = 'gemini-2.5-pro';
            }
        }

        // 获取正确的API Key - 优先使用ModelManager中的Google供应商API Key
        let actualApiKey = apiKey;
        if (window.ModelManager?.instance) {
            try {
                const googleApiKey = window.ModelManager.instance.getProviderApiKey('google');
                if (googleApiKey) {
                    actualApiKey = googleApiKey;
                    console.log('[API] Using Google provider API key for testing');
                }
            } catch (error) {
                console.warn('[API] Failed to get Google provider API key for testing, using provided key:', error);
            }
        }

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: 'test' }] }] // Simple test payload
        };
        const response = await makeApiRequest(`https://generativelanguage.googleapis.com/v1beta/models/${apiTestModel}:generateContent?key=${actualApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            // 获取当前翻译
            const currentTranslations = getCurrentTranslations();
            const message = currentTranslations['connectionTestSuccess'] || 'Connection established ! API Key verified.';
            return { success: true, message };
        } else {
            // Try to parse error, provide fallback message
            const currentTranslations = getCurrentTranslations();
            const error = await response.json().catch(() => ({ error: { message: currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error ${response.status}` } }));
            const errorMessage = error.error?.message || currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error ${response.status}`;
            // Check for specific API key related errors if possible (example)
            if (errorMessage.includes('API key not valid')) {
                return { success: false, message: currentTranslations['apiKeyNotValidError'] || 'Connection failed: API key not valid. Please check your key.' };
            }
            return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', errorMessage) || `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        console.error('API Test Error:', error);
        // Provide a more user-friendly network error message
        const currentTranslations = getCurrentTranslations();
        let friendlyMessage = currentTranslations['networkErrorGeneric'] || 'Connection failed: Network error or server unreachable.';
        if (error instanceof TypeError && error.message.includes('fetch')) {
            friendlyMessage = currentTranslations['serverUnreachableError'] || 'Connection failed: Could not reach the server. Check your internet connection.';
        } else if (error.message) {
            friendlyMessage = currentTranslations['connectionFailedGeneric']?.replace('{error}', error.message) || `Connection failed: ${error.message}`;
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
        // --- Determine actual API model name and configuration using ModelManager ---
        let apiModelName = stateRef.model;
        let modelParams = null;

        if (window.ModelManager?.instance) {
            try {
                await window.ModelManager.instance.initialize();
                const modelConfig = window.ModelManager.instance.getModelApiConfig(stateRef.model);
                apiModelName = modelConfig.apiModelName;
                modelParams = modelConfig.params;
            } catch (error) {
                console.warn('[API] Failed to get model config from ModelManager, using fallback logic:', error);
                // 回退到原有逻辑
                if (stateRef.model === 'gemini-2.5-flash') {
                    apiModelName = 'gemini-2.5-flash';
                    modelParams = { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } };
                } else if (stateRef.model === 'gemini-2.5-flash-thinking') {
                    apiModelName = 'gemini-2.5-flash';
                    modelParams = null;
                } else if (stateRef.model === 'gemini-2.5-pro') {
                    apiModelName = 'gemini-2.5-pro';
                    modelParams = null;
                }
            }
        } else {
            console.warn('[API] ModelManager not available, using fallback logic');
            // 回退到原有逻辑
            if (stateRef.model === 'gemini-2.5-flash') {
                apiModelName = 'gemini-2.5-flash';
                modelParams = { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } };
            } else if (stateRef.model === 'gemini-2.5-flash-thinking') {
                apiModelName = 'gemini-2.5-flash';
                modelParams = null;
            } else if (stateRef.model === 'gemini-2.5-pro') {
                apiModelName = 'gemini-2.5-pro';
                modelParams = null;
            }
        }

        console.log(`Using API model ${apiModelName} (selected: ${stateRef.model}) with params:`, modelParams);

        const historyToSend = historyForApi ? [...historyForApi] : [...stateRef.chatHistory];

        const requestBody = {
            contents: [], // Initialize contents array
            generationConfig: {
                temperature: parseFloat(stateRef.temperature),
                topP: parseFloat(stateRef.topP),
            },
            tools: []
        };

        // 只有当用户明确设置了maxTokens且大于0时才添加该参数
        if (stateRef.maxTokens && parseInt(stateRef.maxTokens) > 0) {
            requestBody.generationConfig.maxOutputTokens = parseInt(stateRef.maxTokens);
        }

        // 应用模型特定的参数
        if (modelParams?.generationConfig) {
            // 合并模型特定的generationConfig参数
            Object.assign(requestBody.generationConfig, modelParams.generationConfig);
        }

        const actualApiModelsSupportingUrlContext = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
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

        // 获取正确的API Key
        let apiKey = stateRef.apiKey; // 默认使用旧的全局API Key

        // 尝试从ModelManager获取Google供应商的API Key
        if (window.ModelManager?.instance) {
            try {
                const googleApiKey = window.ModelManager.instance.getProviderApiKey('google');
                if (googleApiKey) {
                    apiKey = googleApiKey;
                    console.log('[API] Using Google provider API key from ModelManager');
                } else {
                    console.log('[API] No Google provider API key found, using legacy apiKey');
                }
            } catch (error) {
                console.warn('[API] Failed to get Google provider API key, using legacy apiKey:', error);
            }
        }

        if (!apiKey) {
            throw new Error('API Key not configured. Please set up your Google API key in settings.');
        }

        // 使用 Google Gemini API 端点
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:streamGenerateContent?key=${apiKey}&alt=sse`; // Use actual apiModelName

        const response = await makeApiRequest(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal // Pass signal to fetch
        });

        if (!response.ok) {
            const currentTranslations = getCurrentTranslations();
            const errorData = await response.json().catch(() => ({ error: { message: currentTranslations['httpErrorWithMessage']?.replace('{status}', response.status) || `HTTP error ${response.status}, unable to parse error response.` } }));
            const errorMessage = errorData.error?.message || currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error! status: ${response.status}`;
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
 * 用于发送新消息 (追加) - 新版本使用统一API接口
 * @param {Array<{title: string, content: string}>|null} [contextTabsForApi=null] - Explicit tab contents for API.
 */
async function callGeminiAPIWithImages(userMessage, images = [], videos = [], thinkingElement, stateRef, uiCallbacks, contextTabsForApi = null) {
    // 检查是否应该使用新的统一API接口
    if (window.ModelManager?.instance && window.PageTalkAPI?.callApi) {
        try {
            await window.ModelManager.instance.initialize();
            const modelConfig = window.ModelManager.instance.getModelApiConfig(stateRef.model);

            // 如果模型不是Google供应商，使用新的统一API接口
            if (modelConfig.providerId !== 'google') {
                console.log('[API] Using unified API interface for non-Google model:', stateRef.model);
                return await callUnifiedAPI(userMessage, images, videos, thinkingElement, stateRef, uiCallbacks, contextTabsForApi, false);
            }
        } catch (error) {
            console.warn('[API] Failed to check model provider, falling back to legacy API:', error);
        }
    }

    // 对于Google模型或回退情况，使用原有逻辑
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, null, false, null, null, stateRef, uiCallbacks, contextTabsForApi); // insertResponse = false, historyForApi = null
}

/**
 * 用于重新生成并插入响应 - 新版本使用统一API接口
 * @param {Array<{title: string, content: string}>|null} [contextTabsForApi=null] - Explicit tab contents for API.
 */
async function callApiAndInsertResponse(userMessage, images = [], videos = [], thinkingElement, historyForApi, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks, contextTabsForApi = null) {
    // 检查是否应该使用新的统一API接口
    if (window.ModelManager?.instance && window.PageTalkAPI?.callApi) {
        try {
            await window.ModelManager.instance.initialize();
            const modelConfig = window.ModelManager.instance.getModelApiConfig(stateRef.model);

            // 如果模型不是Google供应商，使用新的统一API接口
            if (modelConfig.providerId !== 'google') {
                console.log('[API] Using unified API interface for regeneration with non-Google model:', stateRef.model);
                return await callUnifiedAPI(userMessage, images, videos, thinkingElement, stateRef, uiCallbacks, contextTabsForApi, true, historyForApi, targetInsertionIndex, insertAfterElement);
            }
        } catch (error) {
            console.warn('[API] Failed to check model provider for regeneration, falling back to legacy API:', error);
        }
    }

    // 对于Google模型或回退情况，使用原有逻辑
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, historyForApi, true, targetInsertionIndex, insertAfterElement, stateRef, uiCallbacks, contextTabsForApi); // insertResponse = true
}

// === 统一 API 调用接口 ===

/**
 * 统一API调用的桥梁函数，将主面板的调用格式转换为新的统一API格式
 * @param {string} userMessage - 用户消息
 * @param {Array} images - 图片数组
 * @param {Array} videos - 视频数组
 * @param {HTMLElement} thinkingElement - 思考动画元素
 * @param {Object} stateRef - 状态引用
 * @param {Object} uiCallbacks - UI回调函数
 * @param {Array} contextTabsForApi - 上下文标签页
 * @param {boolean} insertResponse - 是否插入响应
 * @param {Array|null} historyForApi - API历史记录
 * @param {number|null} targetInsertionIndex - 插入索引
 * @param {HTMLElement|null} insertAfterElement - 插入位置元素
 */
async function callUnifiedAPI(userMessage, images = [], videos = [], thinkingElement, stateRef, uiCallbacks, contextTabsForApi = null, insertResponse = false, historyForApi = null, targetInsertionIndex = null, insertAfterElement = null) {
    let accumulatedText = '';
    let messageElement = null;
    let botMessageId = null;
    const controller = new AbortController();
    window.PageTalkAPI.currentAbortController = controller;

    function escapeXml(unsafe) {
        if (typeof unsafe !== 'string') {
            return '';
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
        // 构建标准化的消息数组
        const messages = [];

        // --- 构建完整的上下文信息（与callGeminiAPIInternal保持一致） ---

        // 获取更自然的页面标题
        let pageTitle = '当前页面';

        if (stateRef.pageContext) {
            const titleMatch = stateRef.pageContext.match(/^(.{1,100})/);
            if (titleMatch) {
                const firstLine = titleMatch[1].trim();
                if (firstLine.length > 5 && firstLine.length < 80 && !firstLine.includes('function') && !firstLine.includes('class')) {
                    pageTitle = firstLine;
                }
            }
        }

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

        // 构建XML系统提示（包含完整的上下文信息）
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

        if (contextTabsForApi && contextTabsForApi.length > 0) {
            xmlSystemPrompt += `  <additional_pages>
`;
            contextTabsForApi.forEach(tab => {
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

        // 添加完整的系统提示作为第一条消息
        messages.push({
            role: 'system',
            content: xmlSystemPrompt.trim()
        });

        // 添加历史消息
        const historyToSend = historyForApi ? [...historyForApi] : [...stateRef.chatHistory];
        historyToSend.forEach(msg => {
            if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
                const content = msg.parts.map(part => part.text).join('');
                if (content.trim()) {
                    messages.push({
                        role: msg.role === 'model' ? 'assistant' : msg.role,
                        content: content
                    });
                }
            }
        });

        // 添加当前用户消息（包含图片支持）
        if (userMessage || images.length > 0) {
            const userMessageObj = {
                role: 'user',
                content: userMessage || ''
            };

            // 添加图片支持
            if (images.length > 0) {
                userMessageObj.images = images.map(image => ({
                    dataUrl: image.dataUrl,
                    mimeType: image.mimeType
                }));
            }

            messages.push(userMessageObj);
        }

        // 流式回调函数
        const streamCallback = (chunk, isComplete) => {
            if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.remove();
            }

            if (!messageElement) {
                // 创建流式消息元素
                messageElement = uiCallbacks.addMessageToChat(null, 'bot', {
                    isStreaming: true,
                    insertAfterElement: insertResponse ? insertAfterElement : null
                });
                botMessageId = messageElement.dataset.messageId;

                // 添加占位符到历史记录
                const botResponsePlaceholder = {
                    role: 'model',
                    parts: [{ text: '' }],
                    id: botMessageId
                };
                if (insertResponse && targetInsertionIndex !== null) {
                    stateRef.chatHistory.splice(targetInsertionIndex, 0, botResponsePlaceholder);
                } else {
                    stateRef.chatHistory.push(botResponsePlaceholder);
                }
            }

            accumulatedText += chunk;
            uiCallbacks.updateStreamingMessage(messageElement, accumulatedText);

            if (isComplete) {
                // 完成流式输出
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText);

                // 更新历史记录
                const historyIndex = stateRef.chatHistory.findIndex(msg => msg.id === botMessageId);
                if (historyIndex !== -1) {
                    stateRef.chatHistory[historyIndex].parts = [{ text: accumulatedText }];
                }
            }
        };

        // 调用统一API接口
        const callOptions = {
            temperature: parseFloat(stateRef.temperature),
            topP: parseFloat(stateRef.topP),
            signal: controller.signal
        };

        // 只有当用户明确设置了maxTokens且大于0时才添加该参数
        if (stateRef.maxTokens && parseInt(stateRef.maxTokens) > 0) {
            callOptions.maxTokens = parseInt(stateRef.maxTokens);
        }

        await window.PageTalkAPI.callApi(stateRef.model, messages, streamCallback, callOptions);

        // 清除图片和视频（仅在初始发送时）
        if ((stateRef.images.length > 0 || stateRef.videos.length > 0) && thinkingElement && historyForApi === null) {
            if (stateRef.images.length > 0) {
                uiCallbacks.clearImages();
            }
            if (stateRef.videos.length > 0) {
                uiCallbacks.clearVideos();
            }
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Unified API call aborted by user.');
            if (messageElement && botMessageId) {
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText);
                const historyIndex = stateRef.chatHistory.findIndex(msg => msg.id === botMessageId);
                if (historyIndex !== -1) {
                    stateRef.chatHistory[historyIndex].parts = [{ text: accumulatedText }];
                }
            } else if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.remove();
            }
        } else {
            console.error('Unified API call failed:', error);
            if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.remove();
            }
            if (uiCallbacks && uiCallbacks.restoreSendButtonAndInput) {
                uiCallbacks.restoreSendButtonAndInput();
            }

            const errorText = error.message;
            if (messageElement) {
                accumulatedText += `\n\n--- ${errorText} ---`;
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText);
            } else {
                const errorElement = uiCallbacks.addMessageToChat(errorText, 'bot', {
                    insertAfterElement: insertResponse ? insertAfterElement : null
                });
                if (errorElement && errorElement.dataset.messageId) {
                    const errorMessageId = errorElement.dataset.messageId;
                    errorElement.classList.add('error-message');
                    const errorMessageObject = {
                        role: 'model',
                        parts: [{ text: errorText }],
                        id: errorMessageId
                    };
                    if (insertResponse && targetInsertionIndex !== null) {
                        stateRef.chatHistory.splice(targetInsertionIndex, 0, errorMessageObject);
                    } else {
                        stateRef.chatHistory.push(errorMessageObject);
                    }
                }
            }
        }
    } finally {
        if (window.PageTalkAPI.currentAbortController === controller) {
            window.PageTalkAPI.currentAbortController = null;
        }
    }
}

/**
 * 统一的 API 调用入口函数
 * @param {string} modelId - 模型ID
 * @param {Array} messages - 标准化的消息数组 [{role: 'user'|'assistant', content: string}]
 * @param {Function} streamCallback - 流式输出回调函数
 * @param {Object} options - 调用选项
 * @returns {Promise<void>}
 */
async function callApi(modelId, messages, streamCallback, options = {}) {
    // 获取模型配置
    const modelManager = window.ModelManager?.instance;
    if (!modelManager) {
        throw new Error('ModelManager not available');
    }

    await modelManager.initialize();
    const modelConfig = modelManager.getModelApiConfig(modelId);
    const providerId = modelConfig.providerId;

    // 获取供应商配置
    const provider = getProvider(providerId);
    if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
    }

    // 获取供应商设置（API Key等）
    const providerSettings = modelManager.getProviderSettings(providerId);
    const apiKey = providerSettings.apiKey;
    if (!apiKey) {
        throw new Error(`API Key not configured for provider: ${providerId}`);
    }

    // 根据供应商类型选择适配器
    switch (provider.type) {
        case API_TYPES.GEMINI:
            return await _geminiAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options);
        case API_TYPES.OPENAI_COMPATIBLE:
            return await _openAIAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options);
        case API_TYPES.ANTHROPIC:
            return await _anthropicAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options);
        default:
            throw new Error(`Unsupported provider type: ${provider.type}`);
    }
}

/**
 * 统一的模型发现函数
 * @param {string} providerId - 供应商ID
 * @returns {Promise<Array>} 模型列表
 */
async function fetchModels(providerId) {
    const provider = getProvider(providerId);
    if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
    }

    const modelManager = window.ModelManager?.instance;
    if (!modelManager) {
        throw new Error('ModelManager not available');
    }

    const providerSettings = modelManager.getProviderSettings(providerId);
    const apiKey = providerSettings.apiKey;
    if (!apiKey) {
        throw new Error(`API Key not configured for provider: ${providerId}`);
    }

    // 根据供应商类型选择模型发现方法
    switch (provider.type) {
        case API_TYPES.GEMINI:
            return await fetchGeminiModels(provider, providerSettings);
        case API_TYPES.OPENAI_COMPATIBLE:
            return await fetchOpenAIModels(provider, providerSettings);
        case API_TYPES.ANTHROPIC:
            return await fetchAnthropicModels(provider, providerSettings);
        default:
            throw new Error(`Unsupported provider type: ${provider.type}`);
    }
}

// === 适配器函数 ===

/**
 * Gemini API 适配器
 */
async function _geminiAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options) {
    return await geminiAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options);
}

/**
 * OpenAI 兼容 API 适配器
 */
async function _openAIAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options) {
    return await openaiAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options);
}

/**
 * Anthropic API 适配器
 */
async function _anthropicAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options) {
    return await anthropicAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options);
}

/**
 * 统一的 API Key 测试函数
 * @param {string} providerId - 供应商ID
 * @param {string} apiKey - API Key
 * @param {string} testModel - 测试模型（可选）
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testApiKey(providerId, apiKey, testModel = null) {
    const provider = getProvider(providerId);
    if (!provider) {
        return { success: false, message: `Provider not found: ${providerId}` };
    }

    const providerSettings = { apiKey };

    try {
        switch (provider.type) {
            case API_TYPES.GEMINI:
                return await testGeminiApiKey(provider, providerSettings, testModel);
            case API_TYPES.OPENAI_COMPATIBLE:
                return await testOpenAIApiKey(provider, providerSettings, testModel);
            case API_TYPES.ANTHROPIC:
                return await testAnthropicApiKey(provider, providerSettings, testModel);
            default:
                return { success: false, message: `Unsupported provider type: ${provider.type}` };
        }
    } catch (error) {
        console.error('[API] Test API Key error:', error);
        return { success: false, message: `Test failed: ${error.message}` };
    }
}

// Export functions to be used in sidepanel.js
window.GeminiAPI = {
    testAndVerifyApiKey: _testAndVerifyApiKey,
    callGeminiAPIWithImages: callGeminiAPIWithImages,
    callApiAndInsertResponse: callApiAndInsertResponse,
    currentAbortController: null // Initialize the controller holder
};

// 导出新的统一 API 接口
window.PageTalkAPI = {
    callApi,
    fetchModels,
    testApiKey,
    currentAbortController: null
};
