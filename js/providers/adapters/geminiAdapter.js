/**
 * PageTalk - Gemini API 适配器
 *
 * 处理 Google Gemini API 的请求格式转换和响应解析
 */

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
 * Gemini API 适配器
 * @param {Object} modelConfig - 模型配置 {apiModelName, params, providerId}
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置 {apiKey, apiHost}
 * @param {Array} messages - 标准化消息数组
 * @param {Function} streamCallback - 流式输出回调
 * @param {Object} options - 调用选项
 */
export async function geminiAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options = {}) {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    const { apiModelName, params } = modelConfig;
    
    // 转换消息格式为 Gemini 格式
    const contents = convertMessagesToGeminiFormat(messages);
    
    // 构建请求体
    const requestBody = {
        contents,
        generationConfig: {
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.95,
        }
    };

    // 只有当用户明确设置了maxTokens且大于0时才添加该参数
    if (options.maxTokens && parseInt(options.maxTokens) > 0) {
        requestBody.generationConfig.maxOutputTokens = parseInt(options.maxTokens);
    }
    
    // 应用模型特定参数
    if (params?.generationConfig) {
        Object.assign(requestBody.generationConfig, params.generationConfig);
    }
    
    // 添加系统指令（如果有）
    if (options.systemPrompt) {
        requestBody.systemInstruction = {
            parts: [{ text: options.systemPrompt }]
        };
    }
    
    // 构建 API URL
    const endpoint = `${apiHost}/v1beta/models/${apiModelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: options.signal
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${errorText}`);
        }
        
        // 处理流式响应
        await processGeminiStreamResponse(response, streamCallback);
        
    } catch (error) {
        // 检查是否是用户主动中断的请求
        if (error.name === 'AbortError' || error instanceof DOMException) {
            console.log('[GeminiAdapter] Request aborted by user');
            // 重新抛出 AbortError，让上层处理
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            throw abortError;
        }

        console.error('[GeminiAdapter] API call failed:', error);
        throw error;
    }
}

/**
 * 转换标准消息格式为 Gemini 格式
 * @param {Array} messages - 标准消息数组
 * @returns {Array} Gemini 格式的 contents 数组
 */
function convertMessagesToGeminiFormat(messages) {
    return messages.map(message => {
        const role = message.role === 'assistant' ? 'model' : 'user';
        
        // 处理文本内容
        const parts = [{ text: message.content }];
        
        // 处理图片（如果有）
        if (message.images && message.images.length > 0) {
            message.images.forEach(image => {
                parts.push({
                    inlineData: {
                        mimeType: image.mimeType,
                        data: image.dataUrl.split(',')[1] // 移除 data:image/...;base64, 前缀
                    }
                });
            });
        }
        
        return { role, parts };
    });
}

/**
 * 处理 Gemini 流式响应
 * @param {Response} response - Fetch 响应对象
 * @param {Function} streamCallback - 流式输出回调
 */
async function processGeminiStreamResponse(response, streamCallback) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr.trim() === '[DONE]') {
                        // 流式输出结束
                        if (streamCallback) {
                            streamCallback('', true);
                        }
                        return;
                    }

                    try {
                        const data = JSON.parse(jsonStr);
                        const candidates = data.candidates;

                        if (candidates && candidates.length > 0) {
                            const candidate = candidates[0];
                            const content = candidate.content;

                            if (content && content.parts && content.parts.length > 0) {
                                const text = content.parts[0].text || '';

                                // 调用流式回调 - 修复：使用正确的参数格式 (chunk, isComplete)
                                if (streamCallback) {
                                    streamCallback(text, false);
                                }
                            }
                        }
                    } catch (parseError) {
                        console.warn('[GeminiAdapter] Failed to parse SSE data:', parseError);
                    }
                }
            }
        }

        // 如果循环正常结束（没有遇到 [DONE]），也要调用完成回调
        if (streamCallback) {
            streamCallback('', true);
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * 获取 Gemini 可用模型列表
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置
 * @returns {Promise<Array>} 模型列表
 */
export async function fetchGeminiModels(provider, providerSettings) {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    
    try {
        const response = await fetch(`${apiHost}/v1beta/models?key=${apiKey}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const currentTranslations = getCurrentTranslations();
            const errorMessage = currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // 过滤出生成模型
        const generativeModels = data.models?.filter(model =>
            model.supportedGenerationMethods?.includes('generateContent')
        ) || [];
        
        // 转换为标准格式
        return generativeModels.map(model => {
            const modelName = model.name.replace('models/', '');
            return {
                id: modelName,
                displayName: model.displayName || modelName,
                apiModelName: modelName,
                providerId: provider.id,
                params: null,
                isAlias: false,
                isDefault: false,
                canDelete: true,
                description: model.description || '',
                inputTokenLimit: model.inputTokenLimit || null,
                outputTokenLimit: model.outputTokenLimit || null,
                supportedGenerationMethods: model.supportedGenerationMethods || []
            };
        });
        
    } catch (error) {
        console.error('[GeminiAdapter] Failed to fetch models:', error);
        throw error;
    }
}

/**
 * 测试 Gemini API Key 有效性
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置
 * @param {string} testModel - 测试用的模型名称
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testGeminiApiKey(provider, providerSettings, testModel = 'gemini-2.5-flash') {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;

    // 确保 testModel 不为 null 或 undefined
    const actualTestModel = testModel || 'gemini-2.5-flash';

    try {
        const requestBody = {
            contents: [{
                parts: [{ text: 'Hello' }]
            }],
            generationConfig: {
                maxOutputTokens: 10
            }
        };
        
        const response = await fetch(`${apiHost}/v1beta/models/${actualTestModel}:generateContent?key=${apiKey}`, {
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
            const currentTranslations = getCurrentTranslations();
            const error = await response.json().catch(() => ({ error: { message: currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error ${response.status}` } }));
            const errorMessage = error.error?.message || currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error ${response.status}`;

            if (errorMessage.includes('API key not valid')) {
                return { success: false, message: currentTranslations['apiKeyNotValidError'] || 'Connection failed: API key not valid. Please check your key.' };
            }
            return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', errorMessage) || `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        console.error('[GeminiAdapter] API test error:', error);
        const currentTranslations = getCurrentTranslations();
        return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', error.message) || `Connection failed: ${error.message}` };
    }
}
