/**
 * PageTalk - OpenAI 兼容 API 适配器
 * 
 * 处理 OpenAI 兼容 API 的请求格式转换和响应解析
 * 支持：OpenAI、SiliconFlow、OpenRouter、DeepSeek 等
 */

/**
 * OpenAI 兼容 API 适配器
 * @param {Object} modelConfig - 模型配置 {apiModelName, params, providerId}
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置 {apiKey, apiHost}
 * @param {Array} messages - 标准化消息数组
 * @param {Function} streamCallback - 流式输出回调
 * @param {Object} options - 调用选项
 */
export async function openaiAdapter(modelConfig, provider, providerSettings, messages, streamCallback, options = {}) {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    const { apiModelName } = modelConfig;
    
    // 转换消息格式为 OpenAI 格式（已经是标准格式，无需转换）
    const openaiMessages = convertMessagesToOpenAIFormat(messages);
    
    // 构建请求体
    const requestBody = {
        model: apiModelName,
        messages: openaiMessages,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.95,
        stream: true
    };

    // 只有当用户明确设置了maxTokens且大于0时才添加该参数
    if (options.maxTokens && parseInt(options.maxTokens) > 0) {
        requestBody.max_tokens = parseInt(options.maxTokens);
    }
    
    // 添加系统消息（如果有）
    if (options.systemPrompt) {
        requestBody.messages.unshift({
            role: 'system',
            content: options.systemPrompt
        });
    }
    
    // 构建请求头
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    
    // 特殊处理某些供应商的请求头
    if (provider.id === 'openrouter') {
        headers['HTTP-Referer'] = 'https://pagetalk.extension';
        headers['X-Title'] = 'PageTalk Browser Extension';
    }
    
    // 构建 API URL - OpenRouter 的 apiHost 已包含 /api/v1，其他供应商需要添加 /v1
    const endpoint = provider.id === 'openrouter'
        ? `${apiHost}/chat/completions`
        : `${apiHost}/v1/chat/completions`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: options.signal
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
        }
        
        // 处理流式响应
        await processOpenAIStreamResponse(response, streamCallback);
        
    } catch (error) {
        // 检查是否是用户主动中断的请求
        if (error.name === 'AbortError' || error instanceof DOMException) {
            console.log('[OpenAIAdapter] Request aborted by user');
            // 重新抛出 AbortError，让上层处理
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            throw abortError;
        }

        console.error('[OpenAIAdapter] API call failed:', error);
        throw error;
    }
}

/**
 * 转换标准消息格式为 OpenAI 格式
 * @param {Array} messages - 标准消息数组
 * @returns {Array} OpenAI 格式的消息数组
 */
function convertMessagesToOpenAIFormat(messages) {
    return messages.map(message => {
        const openaiMessage = {
            role: message.role,
            content: message.content
        };
        
        // 处理图片（如果有）
        if (message.images && message.images.length > 0) {
            // 对于支持视觉的模型，转换为 content 数组格式
            openaiMessage.content = [
                { type: 'text', text: message.content }
            ];
            
            message.images.forEach(image => {
                openaiMessage.content.push({
                    type: 'image_url',
                    image_url: {
                        url: image.dataUrl
                    }
                });
            });
        }
        
        return openaiMessage;
    });
}

/**
 * 处理 OpenAI 流式响应
 * @param {Response} response - Fetch 响应对象
 * @param {Function} streamCallback - 流式输出回调
 */
async function processOpenAIStreamResponse(response, streamCallback) {
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
                        const choices = data.choices;

                        if (choices && choices.length > 0) {
                            const choice = choices[0];
                            const delta = choice.delta;

                            if (delta && delta.content) {
                                const text = delta.content;

                                // 调用流式回调 - 修复：使用正确的参数格式 (chunk, isComplete)
                                if (streamCallback) {
                                    streamCallback(text, false);
                                }
                            }
                        }
                    } catch (parseError) {
                        console.warn('[OpenAIAdapter] Failed to parse SSE data:', parseError);
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
 * 获取 OpenAI 兼容 API 可用模型列表
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置
 * @returns {Promise<Array>} 模型列表
 */
export async function fetchOpenAIModels(provider, providerSettings) {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        
        // 特殊处理某些供应商的请求头
        if (provider.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://pagetalk.extension';
            headers['X-Title'] = 'PageTalk Browser Extension';
        }
        
        // 构建模型列表端点 - OpenRouter 的 apiHost 已包含 /api/v1
        const modelsEndpoint = provider.id === 'openrouter'
            ? `${apiHost}/models`
            : `${apiHost}/v1/models`;

        const response = await fetch(modelsEndpoint, {
            method: 'GET',
            headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 转换为标准格式
        return data.data?.map(model => ({
            id: model.id,
            displayName: model.id,
            apiModelName: model.id,
            providerId: provider.id,
            params: null,
            isAlias: false,
            isDefault: false,
            canDelete: true,
            description: model.description || '',
            created: model.created || null,
            owned_by: model.owned_by || null
        })) || [];
        
    } catch (error) {
        console.error('[OpenAIAdapter] Failed to fetch models:', error);
        throw error;
    }
}

/**
 * 测试 OpenAI 兼容 API Key 有效性
 * @param {Object} provider - 供应商配置
 * @param {Object} providerSettings - 供应商设置
 * @param {string} testModel - 测试用的模型名称
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testOpenAIApiKey(provider, providerSettings, testModel = null) {
    const { apiKey } = providerSettings;
    const apiHost = providerSettings.apiHost || provider.apiHost;
    
    try {
        // 首先尝试获取模型列表来验证 API Key
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        
        if (provider.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://pagetalk.extension';
            headers['X-Title'] = 'PageTalk Browser Extension';
        }
        
        // 构建模型列表端点 - OpenRouter 的 apiHost 已包含 /api/v1
        const modelsEndpoint = provider.id === 'openrouter'
            ? `${apiHost}/models`
            : `${apiHost}/v1/models`;

        const response = await fetch(modelsEndpoint, {
            method: 'GET',
            headers
        });
        
        if (response.ok) {
            return { success: true, message: 'Connection established! API Key verified.' };
        } else {
            const error = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}` } }));
            const errorMessage = error.error?.message || `HTTP error ${response.status}`;
            
            if (errorMessage.includes('Incorrect API key') || errorMessage.includes('Invalid API key')) {
                return { success: false, message: 'Connection failed: API key not valid. Please check your key.' };
            }
            return { success: false, message: `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        console.error('[OpenAIAdapter] API test error:', error);
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}
