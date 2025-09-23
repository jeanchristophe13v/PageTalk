/**
 * PageTalk - 统一代理请求工具
 * 
 * 提供统一的代理请求功能，支持所有AI API供应商
 */

import { providers } from '../providerManager.js';

// 维护一个可动态扩展的域名集合
const aiApiDomainSet = new Set([
    // 兜底静态域名（防止 providers 未加载或存储读取失败时遗漏）
    'generativelanguage.googleapis.com',  // Google Gemini
    'api.openai.com',                     // OpenAI
    'api.anthropic.com',                  // Anthropic Claude
    'api.siliconflow.cn',                 // SiliconFlow
    'openrouter.ai',                      // OpenRouter
    'api.deepseek.com',                   // DeepSeek
    'api-inference.modelscope.cn',        // ModelScope
    'open.bigmodel.cn'                    // ChatGLM
]);

// 从内置 providers 补充域名
try {
    if (providers) {
        Object.values(providers).forEach(p => {
            if (p && p.apiHost) {
                try {
                    const url = new URL(p.apiHost);
                    aiApiDomainSet.add(url.hostname);
                } catch (_) {
                    // 忽略非法 URL
                }
            }
        });
    }
} catch (_) { /* 忽略 */ }

// 异步合并自定义提供商域名（不阻塞首次调用）
try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['customProviders'], (result) => {
            if (result && Array.isArray(result.customProviders)) {
                result.customProviders.forEach(p => {
                    if (p && p.apiHost) {
                        try {
                            const url = new URL(p.apiHost);
                            aiApiDomainSet.add(url.hostname);
                        } catch (_) { /* 忽略 */ }
                    }
                });
            }
        });
    }
} catch (_) { /* 忽略 */ }

/**
 * 检查URL是否为AI API请求
 * @param {string} url - 请求URL
 * @returns {boolean} 是否为AI API请求
 */
function isAIApiRequest(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        // 检查是否匹配已知/派生的 AI API 域名
        for (const domain of aiApiDomainSet) {
            if (hostname === domain || hostname.endsWith('.' + domain)) return true;
        }
        return false;
    } catch (error) {
        console.warn('[ProxyRequest] Error parsing URL for AI API check:', url, error);
        return false;
    }
}

/**
 * 统一的代理请求函数
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @returns {Promise<Response>} fetch响应
 */
export async function makeProxyRequest(url, options = {}) {
    // 检查是否为 AI API 请求
    const isAIAPI = isAIApiRequest(url);
    
    // 如果不是AI API请求，直接使用fetch
    if (!isAIAPI) {
        console.log('[ProxyRequest] Non-AI API request, using direct fetch:', url);
        return fetch(url, options);
    }

    // 对于AI API请求，尝试获取代理设置
    let proxyAddress = '';
    try {
        if (chrome && chrome.storage && chrome.storage.sync) {
            const result = await chrome.storage.sync.get(['proxyAddress']);
            proxyAddress = result.proxyAddress || '';
        }
    } catch (error) {
        console.warn('[ProxyRequest] Failed to get proxy settings:', error);
    }

    // 如果没有配置代理，直接使用fetch
    if (!proxyAddress || proxyAddress.trim() === '') {
        console.log('[ProxyRequest] No proxy configured for AI API, using direct fetch');
        return fetch(url, options);
    }

    // 对于AI API请求且配置了代理，使用代理
    console.log('[ProxyRequest] AI API request with proxy, using proxy:', url);

    // 验证代理地址格式
    try {
        const proxyUrl = new URL(proxyAddress.trim());
        const proxyScheme = proxyUrl.protocol.slice(0, -1);
        console.log('[ProxyRequest] Using proxy for AI API:', proxyAddress, 'scheme:', proxyScheme);
    } catch (error) {
        console.error('[ProxyRequest] Error parsing proxy URL:', error);
        console.log('[ProxyRequest] Falling back to direct fetch due to proxy error');
        return fetch(url, options);
    }

    // 直接使用 fetch，让 background.js 的代理逻辑处理
    // 代理的实际应用是通过 PAC 脚本在浏览器层面完成的
    return fetch(url, options);
}

/**
 * 获取代理设置并发起请求（兼容旧的API）
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @returns {Promise<Response>} fetch响应
 */
export async function makeApiRequest(url, options = {}) {
    return makeProxyRequest(url, options);
}

// 导出到全局作用域以便其他模块使用
if (typeof window !== 'undefined') {
    window.ProxyRequest = {
        makeProxyRequest,
        makeApiRequest,
        isAIApiRequest
    };
}
