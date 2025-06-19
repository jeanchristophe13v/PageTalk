/**
 * PageTalk - Anthropic Claude API 适配器
 *
 * 处理 Anthropic Claude API 的请求格式转换和响应解析
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
 * Anthropic API 适配器
 * @param {Object} modelConfig - 模型配置 {apiModelName, params, providerId}
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置 {apiKey, apiHost}
 * @param {Array} messages - 标准化消息数组
 * @param {Function} streamCallback - 流式输出回调
 * @param {Object} options - 调用选项
 */
export async function anthropicAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options = {}) {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    const { apiModelName } = modelConfig;
    
    // 转换消息格式为 Anthropic 格式
    const { anthropicMessages, systemPrompt } = convertMessagesToAnthropicFormat(messages, options.systemPrompt);
    
    // 构建请求体
    const requestBody = {
        model: apiModelName,
        messages: anthropicMessages,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.95,
        stream: true
    };

    // 只有当用户明确设置了maxTokens且大于0时才添加该参数
    if (options.maxTokens && parseInt(options.maxTokens) > 0) {
        requestBody.max_tokens = parseInt(options.maxTokens);
    }
    
    // 添加系统消息（如果有）
    if (systemPrompt) {
        requestBody.system = systemPrompt;
    }
    
    // 构建请求头
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };
    
    // 构建 API URL
    const endpoint = `${apiHost}/v1/messages`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: options.signal
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
        }
        
        // 处理流式响应
        await processAnthropicStreamResponse(response, streamCallback);
        
    } catch (error) {
        // 检查是否是用户主动中断的请求
        if (error.name === 'AbortError' || error instanceof DOMException) {
            console.log('[AnthropicAdapter] Request aborted by user');
            // 重新抛出 AbortError，让上层处理
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            throw abortError;
        }

        console.error('[AnthropicAdapter] API call failed:', error);
        throw error;
    }
}

/**
 * 转换标准消息格式为 Anthropic 格式
 * @param {Array} messages - 标准消息数组
 * @param {string} systemPrompt - 系统提示词
 * @returns {Object} {anthropicMessages, systemPrompt}
 */
function convertMessagesToAnthropicFormat(messages, systemPrompt = null) {
    let extractedSystemPrompt = systemPrompt;
    const anthropicMessages = [];
    
    for (const message of messages) {
        // 如果是系统消息，提取为系统提示词
        if (message.role === 'system') {
            extractedSystemPrompt = message.content;
            continue;
        }
        
        const anthropicMessage = {
            role: message.role,
            content: []
        };
        
        // 添加文本内容
        if (message.content) {
            anthropicMessage.content.push({
                type: 'text',
                text: message.content
            });
        }
        
        // 处理图片（如果有）
        if (message.images && message.images.length > 0) {
            message.images.forEach(image => {
                anthropicMessage.content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: image.mimeType,
                        data: image.dataUrl.split(',')[1] // 移除 data:image/...;base64, 前缀
                    }
                });
            });
        }
        
        // 如果只有一个文本内容，简化格式
        if (anthropicMessage.content.length === 1 && anthropicMessage.content[0].type === 'text') {
            anthropicMessage.content = anthropicMessage.content[0].text;
        }
        
        anthropicMessages.push(anthropicMessage);
    }
    
    return { anthropicMessages, systemPrompt: extractedSystemPrompt };
}

/**
 * 处理 Anthropic 流式响应
 * @param {Response} response - Fetch 响应对象
 * @param {Function} streamCallback - 流式输出回调
 */
async function processAnthropicStreamResponse(response, streamCallback) {
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

                        // 处理不同类型的事件
                        if (data.type === 'content_block_delta') {
                            const text = data.delta?.text || '';

                            // 调用流式回调 - 修复：使用正确的参数格式 (chunk, isComplete)
                            if (streamCallback) {
                                streamCallback(text, false);
                            }
                        } else if (data.type === 'message_stop') {
                            // Anthropic 特有的结束事件
                            if (streamCallback) {
                                streamCallback('', true);
                            }
                            return;
                        }
                    } catch (parseError) {
                        console.warn('[AnthropicAdapter] Failed to parse SSE data:', parseError);
                    }
                }
            }
        }

        // 如果循环正常结束（没有遇到结束事件），也要调用完成回调
        if (streamCallback) {
            streamCallback('', true);
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * 获取 Anthropic 可用模型列表
 * 注意：Anthropic API 不提供模型列表端点，返回预定义的模型列表
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置
 * @returns {Promise<Array>} 模型列表
 */
export async function fetchAnthropicModels(provider, providerSettings) {
    // Anthropic 不提供公开的模型列表 API，返回已知的模型
    const knownModels = [
        {
            id: 'claude-3-5-sonnet-20241022',
            displayName: 'Claude 3.5 Sonnet',
            apiModelName: 'claude-3-5-sonnet-20241022',
            providerId: provider.id,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true,
            description: 'Claude 3.5 Sonnet - 最新的高性能模型'
        },
        {
            id: 'claude-3-5-haiku-20241022',
            displayName: 'Claude 3.5 Haiku',
            apiModelName: 'claude-3-5-haiku-20241022',
            providerId: provider.id,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true,
            description: 'Claude 3.5 Haiku - 快速且经济的模型'
        },
        {
            id: 'claude-3-opus-20240229',
            displayName: 'Claude 3 Opus',
            apiModelName: 'claude-3-opus-20240229',
            providerId: provider.id,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true,
            description: 'Claude 3 Opus - 最强大的模型'
        },
        {
            id: 'claude-3-sonnet-20240229',
            displayName: 'Claude 3 Sonnet',
            apiModelName: 'claude-3-sonnet-20240229',
            providerId: provider.id,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true,
            description: 'Claude 3 Sonnet - 平衡性能和成本'
        },
        {
            id: 'claude-3-haiku-20240307',
            displayName: 'Claude 3 Haiku',
            apiModelName: 'claude-3-haiku-20240307',
            providerId: provider.id,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true,
            description: 'Claude 3 Haiku - 快速响应模型'
        }
    ];
    
    return knownModels;
}

/**
 * 测试 Anthropic API Key 有效性
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置
 * @param {string} testModel - 测试用的模型名称
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testAnthropicApiKey(provider, providerSettings, testModel = 'claude-3-5-haiku-20241022') {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    
    try {
        const requestBody = {
            model: testModel,
            messages: [{
                role: 'user',
                content: 'Hello'
            }],
            max_tokens: 10
        };
        
        const response = await fetch(`${apiHost}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
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

            if (errorMessage.includes('authentication') || errorMessage.includes('api_key')) {
                return { success: false, message: currentTranslations['apiKeyNotValidError'] || 'Connection failed: API key not valid. Please check your key.' };
            }
            return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', errorMessage) || `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        console.error('[AnthropicAdapter] API test error:', error);
        const currentTranslations = getCurrentTranslations();
        return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', error.message) || `Connection failed: ${error.message}` };
    }
}
