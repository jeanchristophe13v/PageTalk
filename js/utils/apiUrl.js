/**
 * PageTalk - API URL Utilities
 * Centralizes URL formatting for different providers
 */

/**
 * 智能格式化 API URL
 * 自动添加 /v1/ 到基础 URL，除非它们已经包含版本路径
 * - openrouter: apiHost 已包含 /api/v1
 * - chatglm: apiHost 已包含完整路径 /api/paas/v4
 */
export function formatApiUrl(apiHost, providerId, endpoint) {
  // Normalize inputs
  const base = (apiHost || '').replace(/\/$/, '');
  const path = endpoint || '';

  // OpenRouter 的 apiHost 已包含 /api/v1
  if (providerId === 'openrouter') {
    return `${base}${path}`;
  }

  // ChatGLM 的 apiHost 已包含完整路径 /api/paas/v4
  if (providerId === 'chatglm') {
    return `${base}${path}`;
  }

  // 检查 URL 是否已经包含版本路径
  const hasVersionPath = /\/v\d+|\/api\/v\d+|\/v\d+\/|\/api\/v\d+\/|\/paas\/v\d+/.test(base);
  if (hasVersionPath) {
    return `${base}${path}`;
  }

  return `${base}/v1${path}`;
} 