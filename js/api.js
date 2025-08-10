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
// Add shared HTTP helper for proxy-aware requests
import { makeApiRequest } from './utils/proxyRequest.js';
import { getCurrentTranslations } from './utils/i18n.js';

/**
 * XML转义函数
 * @param {string} unsafe - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
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

/**
 * 构建系统提示的通用函数
 * @param {Object} stateRef - 状态引用对象
 * @param {Array<{title: string, content: string}>|null} explicitContextTabs - 显式上下文标签页
 * @returns {string} 构建的XML系统提示
 */
function buildSystemPrompt(stateRef, explicitContextTabs = null) {
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

    // 构建XML系统提示
    let xmlSystemPrompt = `
<instructions>
  <role>You are a helpful and professional AI assistant with access to your full knowledge base and training data. You can answer questions on any topic using your comprehensive knowledge. The page content provided serves as additional context that may be relevant to the user's questions, but you should not limit your responses to only what's in the page content. Use your complete knowledge and capabilities to provide the most helpful and accurate responses possible.</role>
  <output_format>
    <language>Respond in the language used by the user in their most recent query.</language>
    <markdown>Use Markdown formatting for structure and emphasis (headers, lists, bold, italic, links, etc.) but do NOT wrap your entire response in markdown code blocks. Write your response directly using markdown syntax where appropriate.</markdown>
  </output_format>
  <context_handling>
    <general>You have access to your full knowledge base plus additional context from the current page content, additional web pages (if selected), and ongoing chat history. Use your complete knowledge to provide comprehensive answers, and reference the provided context when it's relevant and adds value to your response.</general>
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
      <primary_approach>You should answer questions using your full knowledge base and capabilities. The provided page content serves as additional context and reference material to enhance your responses when relevant.</primary_approach>
      <context_integration>When the provided page content is relevant to the user's question, naturally incorporate this information into your response. However, do not limit yourself to only what's in the page content - use your broader knowledge to provide comprehensive and helpful answers.</context_integration>
      <knowledge_priority>Your general knowledge and training data are your primary resources. Use the page content as supplementary information when it adds value to your response.</knowledge_priority>
      <no_fabrication>If you don't know something or cannot find reliable information, clearly state this. Do not invent information.</no_fabrication>
      <content_source_handling>
        When referencing specific information from the provided page content, you may mention it naturally (e.g., "这个页面提到", "从内容来看") but only when it genuinely adds value. Don't feel obligated to reference the page content if your general knowledge provides a better or more complete answer.
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
    ${(stateRef.systemPrompt && !stateRef.quickActionIgnoreAssistant) ? `<content>\n${escapeXml(stateRef.systemPrompt)}\n</content>` : '<content>No specific agent instructions provided.</content>'}
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

    return xmlSystemPrompt.trim();
}

/**
 * 通用的流式响应处理器
 * @param {Object} config - 配置对象
 * @param {HTMLElement} config.thinkingElement - 思考动画元素
 * @param {boolean} config.insertResponse - 是否插入响应
 * @param {HTMLElement|null} config.insertAfterElement - 插入位置元素
 * @param {Object} config.uiCallbacks - UI回调函数
 * @param {Function} config.onHistoryUpdate - 历史记录更新回调
 * @returns {Object} 包含流式处理函数的对象
 */
function createStreamHandler(config) {
    let accumulatedText = '';
    let messageElement = null;
    let botMessageId = null;

    const { thinkingElement, insertResponse, insertAfterElement, uiCallbacks, onHistoryUpdate } = config;

    return {
        /**
         * 处理流式文本块
         * @param {string} chunk - 文本块
         */
        handleChunk: (chunk) => {
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

                // 通知历史记录更新 - 添加占位符
                if (onHistoryUpdate) {
                    onHistoryUpdate('add_placeholder', {
                        messageId: botMessageId,
                        insertResponse,
                        targetInsertionIndex: config.targetInsertionIndex
                    });
                }
            }

            accumulatedText += chunk;
            uiCallbacks.updateStreamingMessage(messageElement, accumulatedText);
        },

        /**
         * 完成流式输出
         */
        finalize: () => {
            if (messageElement && botMessageId) {
                uiCallbacks.finalizeBotMessage(messageElement, accumulatedText);

                // 通知历史记录更新 - 完成消息
                if (onHistoryUpdate) {
                    onHistoryUpdate('finalize_message', {
                        messageId: botMessageId,
                        content: accumulatedText
                    });
                }
            } else if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.remove();
                uiCallbacks.addMessageToChat("未能生成回复。", 'bot', {
                    insertAfterElement: insertResponse ? insertAfterElement : null
                });
            }
        },

        /**
         * 处理错误情况
         * @param {Error} error - 错误对象
         */
        handleError: (error) => {
            if (error.name === 'AbortError') {
                console.log('API call aborted by user.');
                if (messageElement && botMessageId) {
                    uiCallbacks.finalizeBotMessage(messageElement, accumulatedText);
                    if (onHistoryUpdate) {
                        onHistoryUpdate('finalize_message', {
                            messageId: botMessageId,
                            content: accumulatedText
                        });
                    }
                } else if (thinkingElement && thinkingElement.parentNode) {
                    thinkingElement.remove();
                }
            } else {
                console.error('API call failed:', error);
                if (thinkingElement && thinkingElement.parentNode) {
                    thinkingElement.remove();
                }

                const errorText = error.message;
                if (messageElement) {
                    accumulatedText += `\n\n--- ${errorText} ---`;
                    uiCallbacks.finalizeBotMessage(messageElement, accumulatedText);
                    if (onHistoryUpdate) {
                        onHistoryUpdate('finalize_message', {
                            messageId: botMessageId,
                            content: accumulatedText
                        });
                    }
                } else {
                    const errorElement = uiCallbacks.addMessageToChat(errorText, 'bot', {
                        insertAfterElement: insertResponse ? insertAfterElement : null
                    });
                    if (errorElement && errorElement.dataset.messageId && onHistoryUpdate) {
                        const errorMessageId = errorElement.dataset.messageId;
                        errorElement.classList.add('error-message');
                        onHistoryUpdate('add_error_message', {
                            messageId: errorMessageId,
                            content: errorText,
                            insertResponse,
                            targetInsertionIndex: config.targetInsertionIndex
                        });
                    }
                }
            }
        },

        // 获取当前状态
        get messageElement() { return messageElement; },
        get botMessageId() { return botMessageId; },
        get accumulatedText() { return accumulatedText; }
    };
}

/**
 * 检查URL是否为AI API请求
 * @param {string} url - 请求URL
 * @returns {boolean} 是否为AI API请求
 */
/*
 * NOTE: HTTP request helpers moved to utils/proxyRequest.js.
 * Use makeApiRequest from that module instead of local duplicates.
 */

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
        const googleApiHost = window.ProviderManager?.providers?.google?.apiHost;
        if (!googleApiHost) {
            throw new Error('Google provider apiHost not configured');
        }
        const testEndpoint = `${googleApiHost.replace(/\/$/, '')}/v1beta/models/${apiTestModel}:generateContent?key=${actualApiKey}`;
        const response = await makeApiRequest(testEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            // 获取当前翻译
            const currentTranslations = getCurrentTranslations();
            const message = currentTranslations['connectionTestSuccess'] || 'Connection established! API Key verified.';
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
 * @param {Object|null} [userMessageForHistory=null] - User message object to add to history
 * @returns {Promise<void>}
 */
async function callGeminiAPIInternal(userMessage, images = [], videos = [], thinkingElement, historyForApi, insertResponse = false, targetInsertionIndex = null, insertAfterElement = null, stateRef, uiCallbacks, explicitContextTabs = null, userMessageForHistory = null) {
    const controller = new AbortController();
    window.GeminiAPI.currentAbortController = controller;

    // 创建历史记录更新回调
    const onHistoryUpdate = (action, data) => {
        switch (action) {
            case 'add_user_message':
                // 添加用户消息到历史记录
                if (data.userMessage) {
                    stateRef.chatHistory.push(data.userMessage);
                    console.log(`Added user message to history`);
                }
                break;

            case 'add_placeholder':
                const botResponsePlaceholder = {
                    role: 'model',
                    parts: [{ text: '' }],
                    id: data.messageId
                };
                if (data.insertResponse && data.targetInsertionIndex !== null) {
                    stateRef.chatHistory.splice(data.targetInsertionIndex, 0, botResponsePlaceholder);
                    console.log(`Inserted bot placeholder at index ${data.targetInsertionIndex}`);
                } else {
                    stateRef.chatHistory.push(botResponsePlaceholder);
                    console.log(`Appended bot placeholder`);
                }
                break;

            case 'finalize_message':
                const historyIndex = stateRef.chatHistory.findIndex(msg => msg.id === data.messageId);
                if (historyIndex !== -1) {
                    stateRef.chatHistory[historyIndex].parts = [{ text: data.content }];
                    console.log(`Updated bot message in history at index ${historyIndex}`);
                } else {
                    console.error(`Could not find bot message with ID ${data.messageId} in history to finalize.`);
                    // Fallback: Add if not found
                    const newAiResponseObject = { role: 'model', parts: [{ text: data.content }], id: data.messageId };
                    if (insertResponse && targetInsertionIndex !== null) {
                        stateRef.chatHistory.splice(targetInsertionIndex, 0, newAiResponseObject);
                    } else {
                        stateRef.chatHistory.push(newAiResponseObject);
                    }
                }
                break;

            case 'add_error_message':
                const errorMessageObject = {
                    role: 'model',
                    parts: [{ text: data.content }],
                    id: data.messageId
                };
                if (data.insertResponse && data.targetInsertionIndex !== null) {
                    stateRef.chatHistory.splice(data.targetInsertionIndex, 0, errorMessageObject);
                    console.log(`Inserted error message object into history at index ${data.targetInsertionIndex}`);
                } else {
                    stateRef.chatHistory.push(errorMessageObject);
                    console.log(`Appended error message object to history`);
                }
                break;
        }
    };

    // 创建流式处理器
    const streamHandler = createStreamHandler({
        thinkingElement,
        insertResponse,
        insertAfterElement,
        targetInsertionIndex,
        uiCallbacks,
        onHistoryUpdate
    });

    try {
        // 如果提供了用户消息对象且不是插入响应模式，则添加到历史记录
        if (userMessageForHistory && !insertResponse) {
            onHistoryUpdate('add_user_message', { userMessage: userMessageForHistory });
        }

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

        // 使用通用的系统提示构建函数
        const xmlSystemPrompt = buildSystemPrompt(stateRef, explicitContextTabs);

        // Add XML system prompt as the first user turn
        requestBody.contents.push({ role: 'user', parts: [{ text: xmlSystemPrompt }] });
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
        const googleApiHost = window.ProviderManager?.providers?.google?.apiHost;
        if (!googleApiHost) {
            throw new Error('Google provider apiHost not configured');
        }
        const endpoint = `${googleApiHost.replace(/\/$/, '')}/v1beta/models/${apiModelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

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
                                streamHandler.handleChunk(textChunk);
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
                        streamHandler.handleChunk(textChunk);
                    }
                } catch (e) { console.error('Failed to parse final JSON chunk:', jsonString, e); }
            }
        }

        // 流结束
        streamHandler.finalize();

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
        // 使用流式处理器处理错误
        streamHandler.handleError(error);

        // 恢复UI状态
        if (uiCallbacks && uiCallbacks.restoreSendButtonAndInput) {
            uiCallbacks.restoreSendButtonAndInput();
        }
    } finally {
        // Ensure the controller is cleared regardless of success, error, or abort
        if (window.GeminiAPI.currentAbortController === controller) {
            window.GeminiAPI.currentAbortController = null;
            console.log('Cleared currentAbortController.');
        }
    }
}

/**
 * 用于发送新消息 (追加) - 新版本使用统一API接口
 * @param {Array<{title: string, content: string}>|null} [contextTabsForApi=null] - Explicit tab contents for API.
 * @param {Object|null} [userMessageForHistory=null] - User message object to add to history
 */
async function callGeminiAPIWithImages(userMessage, images = [], videos = [], thinkingElement, stateRef, uiCallbacks, contextTabsForApi = null, userMessageForHistory = null) {
    // 检查是否应该使用新的统一API接口
    if (window.ModelManager?.instance && window.PageTalkAPI?.callApi) {
        try {
            await window.ModelManager.instance.initialize();
            const modelConfig = window.ModelManager.instance.getModelApiConfig(stateRef.model);

            // 如果模型不是Google供应商，使用新的统一API接口
            if (modelConfig.providerId !== 'google') {
                console.log('[API] Using unified API interface for non-Google model:', stateRef.model);
                return await callUnifiedAPI(userMessage, images, videos, thinkingElement, stateRef, uiCallbacks, contextTabsForApi, false, null, null, null, userMessageForHistory);
            }
        } catch (error) {
            console.warn('[API] Failed to check model provider, falling back to legacy API:', error);
        }
    }

    // 对于Google模型或回退情况，使用原有逻辑
    await callGeminiAPIInternal(userMessage, images, videos, thinkingElement, null, false, null, null, stateRef, uiCallbacks, contextTabsForApi, userMessageForHistory); // insertResponse = false, historyForApi = null
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
 * @param {Object|null} userMessageForHistory - 用户消息对象
 */
async function callUnifiedAPI(userMessage, images = [], videos = [], thinkingElement, stateRef, uiCallbacks, contextTabsForApi = null, insertResponse = false, historyForApi = null, targetInsertionIndex = null, insertAfterElement = null, userMessageForHistory = null) {
    const controller = new AbortController();
    window.PageTalkAPI.currentAbortController = controller;

    // 创建历史记录更新回调（与callGeminiAPIInternal相同的逻辑）
    const onHistoryUpdate = (action, data) => {
        switch (action) {
            case 'add_user_message':
                // 添加用户消息到历史记录
                if (data.userMessage) {
                    stateRef.chatHistory.push(data.userMessage);
                    console.log(`Added user message to history`);
                }
                break;

            case 'add_placeholder':
                const botResponsePlaceholder = {
                    role: 'model',
                    parts: [{ text: '' }],
                    id: data.messageId
                };
                if (data.insertResponse && data.targetInsertionIndex !== null) {
                    stateRef.chatHistory.splice(data.targetInsertionIndex, 0, botResponsePlaceholder);
                } else {
                    stateRef.chatHistory.push(botResponsePlaceholder);
                }
                break;

            case 'finalize_message':
                const historyIndex = stateRef.chatHistory.findIndex(msg => msg.id === data.messageId);
                if (historyIndex !== -1) {
                    stateRef.chatHistory[historyIndex].parts = [{ text: data.content }];
                }
                break;

            case 'add_error_message':
                const errorMessageObject = {
                    role: 'model',
                    parts: [{ text: data.content }],
                    id: data.messageId
                };
                if (data.insertResponse && data.targetInsertionIndex !== null) {
                    stateRef.chatHistory.splice(data.targetInsertionIndex, 0, errorMessageObject);
                } else {
                    stateRef.chatHistory.push(errorMessageObject);
                }
                break;
        }
    };

    // 创建流式处理器
    const streamHandler = createStreamHandler({
        thinkingElement,
        insertResponse,
        insertAfterElement,
        targetInsertionIndex,
        uiCallbacks,
        onHistoryUpdate
    });

    try {
        // 如果提供了用户消息对象且不是插入响应模式，则添加到历史记录
        if (userMessageForHistory && !insertResponse) {
            onHistoryUpdate('add_user_message', { userMessage: userMessageForHistory });
        }

        // 构建标准化的消息数组
        const messages = [];

        // 使用通用的系统提示构建函数
        const xmlSystemPrompt = buildSystemPrompt(stateRef, contextTabsForApi);

        // 添加完整的系统提示作为第一条消息
        messages.push({
            role: 'system',
            content: xmlSystemPrompt
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

        // 流式回调函数 - 使用流式处理器
        const streamCallback = (chunk, isComplete) => {
            streamHandler.handleChunk(chunk);

            if (isComplete) {
                streamHandler.finalize();
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
        // 使用流式处理器处理错误
        streamHandler.handleError(error);

        // 恢复UI状态
        if (uiCallbacks && uiCallbacks.restoreSendButtonAndInput) {
            uiCallbacks.restoreSendButtonAndInput();
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
