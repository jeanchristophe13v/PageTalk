/**
 * PageTalk - Proxy Health Utilities
 * 从 provider 配置集中派生健康检查与测试端点
 */

/**
 * 规范化基础端点，确保以斜杠结尾
 * @param {string} apiHost
 * @returns {string}
 */
function toBaseEndpoint(apiHost) {
  const base = String(apiHost || '').replace(/\/$/, '');
  return `${base}/`;
}

/**
 * 从内置 providers 派生健康检查端点（仅使用基础域，不含具体路径）
 * @param {Record<string, { apiHost: string }>} providersMap
 * @returns {string[]}
 */
export function getHealthCheckEndpoints(providersMap) {
  if (!providersMap) return [];
  const endpoints = new Set();
  Object.values(providersMap).forEach(p => {
    if (p && p.apiHost) {
      try {
        const url = new URL(p.apiHost);
        endpoints.add(toBaseEndpoint(`${url.origin}${url.pathname}`));
      } catch (_) {
        // 忽略非法 URL
      }
    }
  });
  return Array.from(endpoints);
}

/**
 * 异步从 providers + 自定义提供商派生健康检查端点
 * @param {Record<string, { apiHost: string }>} providersMap
 * @returns {Promise<string[]>}
 */
export async function getHealthCheckEndpointsAsync(providersMap) {
  const endpoints = new Set(getHealthCheckEndpoints(providersMap));

  // 合并自定义提供商
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const result = await chrome.storage.sync.get(['customProviders']);
      if (result.customProviders && Array.isArray(result.customProviders)) {
        result.customProviders.forEach(p => {
          if (p && p.apiHost) {
            try {
              const url = new URL(p.apiHost);
              endpoints.add(toBaseEndpoint(`${url.origin}${url.pathname}`));
            } catch (_) {
              // 忽略非法 URL
            }
          }
        });
      }
    }
  } catch (_) {
    // 忽略存储读取错误
  }

  return Array.from(endpoints);
} 