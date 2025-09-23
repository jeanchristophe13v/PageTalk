/**
 * PageTalk - OpenAI 兼容 API 适配器
 *
 * 处理 OpenAI 兼容 API 的请求格式转换和响应解析
 * 支持：OpenAI、SiliconFlow、OpenRouter、DeepSeek、ModelScope 等
 */

// 导入统一代理请求工具
import { makeProxyRequest } from '../../utils/proxyRequest.js';
import { getCurrentTranslations } from '../../utils/i18n.js';

// 从统一 i18n 工具获取翻译对象

/**
 * 智能格式化 API URL
 * 自动添加 /v1/ 到基础 URL，除非它们已经包含版本路径
 * @param {string} apiHost - API 主机地址
 * @param {string} providerId - 供应商ID
 * @param {string} endpoint - 端点路径
 * @returns {string} 格式化后的完整 URL
 */
// Moved to centralized util
import { formatApiUrl } from '../../utils/apiUrl.js';

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
    
    // 根据供应商与模型确定是否应省略 temperature（某些推理模型不支持）
    const omitTemperature = isTemperatureUnsupported(provider.id, apiModelName);

    // 构建请求体
    const requestBody = {
        model: apiModelName,
        messages: openaiMessages,
        stream: true
    };
    if (!omitTemperature) {
        requestBody.temperature = options.temperature || 0.7;
    }

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
        'Content-Type': 'application/json'
    };

    // 根据供应商设置认证方式
    if (provider.id === 'chatglm') {
        // ChatGLM 使用直接的 API key 认证，不需要 Bearer 前缀
        headers['Authorization'] = apiKey;
    } else {
        // 其他供应商使用标准的 Bearer 认证
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 特殊处理某些供应商的请求头
    if (provider.id === 'openrouter') {
        headers['HTTP-Referer'] = 'https://pagetalk.extension';
        headers['X-Title'] = 'PageTalk Browser Extension';
    }
    
    // 构建 API URL - 智能处理不同供应商的 URL 格式
    const endpoint = formatApiUrl(apiHost, provider.id, '/chat/completions');
    
    try {
        const response = await makeProxyRequest(endpoint, {
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
 * 判断是否需要为该供应商/模型省略 temperature 参数
 * 规则：
 * - openai: gpt-5 系列、o 系列（推理模型）不支持 temperature
 * - deepseek: deepseek-reasoner 不支持 temperature
 */
function isTemperatureUnsupported(providerId, modelName) {
    if (!providerId || !modelName) return false;
    const m = String(modelName).toLowerCase();
    if (providerId === 'openai') {
        // gpt-5 系列或 o 系列（如 o1, o3, o4, o4-mini 等）
        if (m.startsWith('gpt-5')) return true;
        if (/^o\d/.test(m) || m.startsWith('o-')) return true;
        return false;
    }
    if (providerId === 'deepseek') {
        return m.startsWith('deepseek-reasoner');
    }
    return false;
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
    let buffer = ''; // 用于缓存不完整的数据

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 将新数据添加到缓冲区
            buffer += decoder.decode(value, { stream: true });

            // 按行分割，保留最后一个可能不完整的行
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') {
                        // 流式输出结束
                        if (streamCallback) {
                            streamCallback('', true);
                        }
                        return;
                    }

                    // 跳过空的数据行
                    if (!jsonStr) {
                        continue;
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
                        // 只在调试模式下显示详细错误，避免控制台噪音
                        if (jsonStr.length > 10) { // 只记录看起来像有效JSON但解析失败的情况
                            console.debug('[OpenAIAdapter] Failed to parse SSE data:', parseError.message, 'Data:', jsonStr.substring(0, 100));
                        }
                    }
                }
            }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
            const line = buffer.trim();
            if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim();
                if (jsonStr === '[DONE]') {
                    if (streamCallback) {
                        streamCallback('', true);
                    }
                    return;
                }

                if (jsonStr) {
                    try {
                        const data = JSON.parse(jsonStr);
                        const choices = data.choices;

                        if (choices && choices.length > 0) {
                            const choice = choices[0];
                            const delta = choice.delta;

                            if (delta && delta.content) {
                                const text = delta.content;
                                if (streamCallback) {
                                    streamCallback(text, false);
                                }
                            }
                        }
                    } catch (parseError) {
                        console.debug('[OpenAIAdapter] Failed to parse final SSE data:', parseError.message);
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

    // ChatGLM 不支持标准的 /models 端点，返回预定义的模型列表
    if (provider.id === 'chatglm') {
        console.log('[OpenAIAdapter] ChatGLM does not support /models endpoint, returning predefined models');
        return [
            {
                id: 'glm-4-plus',
                displayName: 'GLM-4-Plus',
                apiModelName: 'glm-4-plus',
                providerId: 'chatglm',
                params: null,
                isAlias: false,
                isDefault: false,
                canDelete: true,
                description: '智谱AI GLM-4-Plus 模型，支持高质量对话和代码生成'
            },
            {
                id: 'glm-4-0520',
                displayName: 'GLM-4-0520',
                apiModelName: 'glm-4-0520',
                providerId: 'chatglm',
                params: null,
                isAlias: false,
                isDefault: false,
                canDelete: true,
                description: '智谱AI GLM-4-0520 模型'
            },
            {
                id: 'glm-4-long',
                displayName: 'GLM-4-Long',
                apiModelName: 'glm-4-long',
                providerId: 'chatglm',
                params: null,
                isAlias: false,
                isDefault: false,
                canDelete: true,
                description: '智谱AI GLM-4-Long 长文本模型'
            },
            {
                id: 'glm-4-flashx',
                displayName: 'GLM-4-FlashX',
                apiModelName: 'glm-4-flashx',
                providerId: 'chatglm',
                params: null,
                isAlias: false,
                isDefault: false,
                canDelete: true,
                description: '智谱AI GLM-4-FlashX 快速响应模型'
            },
            {
                id: 'glm-4-flash',
                displayName: 'GLM-4-Flash',
                apiModelName: 'glm-4-flash',
                providerId: 'chatglm',
                params: null,
                isAlias: false,
                isDefault: false,
                canDelete: true,
                description: '智谱AI GLM-4-Flash 快速模型'
            }
        ];
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        // 根据供应商设置认证方式
        if (provider.id === 'chatglm') {
            // ChatGLM 使用直接的 API key 认证，不需要 Bearer 前缀
            headers['Authorization'] = apiKey;
        } else {
            // 其他供应商使用标准的 Bearer 认证
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // 特殊处理某些供应商的请求头
        if (provider.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://pagetalk.extension';
            headers['X-Title'] = 'PageTalk Browser Extension';
        }

        // 构建模型列表端点 - 智能处理不同供应商的 URL 格式
        const modelsEndpoint = formatApiUrl(apiHost, provider.id, '/models');

        const response = await makeProxyRequest(modelsEndpoint, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const currentTranslations = getCurrentTranslations();
            const errorMessage = currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
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

    // ChatGLM 特殊测试逻辑 - 使用 chat/completions 端点进行测试
    if (provider.id === 'chatglm') {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': apiKey  // ChatGLM 使用直接的 API key 认证
            };

            const chatEndpoint = formatApiUrl(apiHost, provider.id, '/chat/completions');

            // 发送一个简单的测试请求
            const testRequestBody = {
                model: 'glm-4-flash',  // 使用最基础的模型进行测试
                messages: [
                    {
                        role: 'user',
                        content: 'test'
                    }
                ],
                max_tokens: 1,
                temperature: 0.1
            };

            const response = await makeProxyRequest(chatEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(testRequestBody)
            });

            if (response.ok) {
                const currentTranslations = getCurrentTranslations();
                const message = currentTranslations['connectionTestSuccess'] || 'Connection established! API Key verified.';
                return { success: true, message };
            } else {
                const currentTranslations = getCurrentTranslations();
                const errorText = await response.text();
                console.log('[OpenAIAdapter] ChatGLM test error response:', errorText);

                // 检查是否是认证错误
                if (response.status === 401 || errorText.includes('unauthorized') || errorText.includes('invalid') || errorText.includes('API key')) {
                    return { success: false, message: currentTranslations['apiKeyNotValidError'] || 'Connection failed: API key not valid. Please check your key.' };
                }

                const errorMessage = currentTranslations['httpErrorGeneric']?.replace('{status}', response.status) || `HTTP error ${response.status}`;
                return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', errorMessage) || `Connection failed: ${errorMessage}` };
            }
        } catch (error) {
            console.error('[OpenAIAdapter] ChatGLM API test error:', error);
            const currentTranslations = getCurrentTranslations();
            return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', error.message) || `Connection failed: ${error.message}` };
        }
    }

    try {
        // 对于其他供应商，使用标准的模型列表端点测试
        const headers = {
            'Content-Type': 'application/json'
        };

        // 根据供应商设置认证方式
        if (provider.id === 'chatglm') {
            // ChatGLM 使用直接的 API key 认证，不需要 Bearer 前缀
            headers['Authorization'] = apiKey;
        } else {
            // 其他供应商使用标准的 Bearer 认证
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        if (provider.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://pagetalk.extension';
            headers['X-Title'] = 'PageTalk Browser Extension';
        }

        // 构建模型列表端点 - 智能处理不同供应商的 URL 格式
        const modelsEndpoint = formatApiUrl(apiHost, provider.id, '/models');

        const response = await makeProxyRequest(modelsEndpoint, {
            method: 'GET',
            headers
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

            if (errorMessage.includes('Incorrect API key') || errorMessage.includes('Invalid API key')) {
                return { success: false, message: currentTranslations['apiKeyNotValidError'] || 'Connection failed: API key not valid. Please check your key.' };
            }
            return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', errorMessage) || `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        console.error('[OpenAIAdapter] API test error:', error);
        const currentTranslations = getCurrentTranslations();
        return { success: false, message: currentTranslations['connectionFailedGeneric']?.replace('{error}', error.message) || `Connection failed: ${error.message}` };
    }
}
