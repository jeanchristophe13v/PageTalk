/**
 * PageTalk - API URL Utilities
 * Centralizes URL formatting for different providers
 */

/**
 * 智能格式化 API URL
 * 自动添加 /v1/ 到基础 URL，除非它们已经包含版本路径
 * - openrouter: apiHost 已包含 /api/v1
 * - chatglm: apiHost 已包含完整路径 /api/paas/v4
 * - groq: apiHost 已包含 /openai/v1
 * - cerebras: apiHost 已包含 /v1
 * - vercel: apiHost 已包含 /v1
 */
export function formatApiUrl(apiHost, providerId, endpoint) {
  // Normalize inputs
  const base = (apiHost || '').replace(/\/$/, '');
  const path = endpoint || '';

  // 这些供应商的 apiHost 已包含完整版本路径
  const providersWithFullPath = ['openrouter', 'chatglm', 'groq', 'cerebras', 'vercel'];
  if (providersWithFullPath.includes(providerId)) {
    return `${base}${path}`;
  }

  // 检查 URL 是否已经包含版本路径
  const hasVersionPath = /\/v\d+|\/api\/v\d+|\/v\d+\/|\/api\/v\d+\/|\/paas\/v\d+|\/openai\/v\d+/.test(base);
  if (hasVersionPath) {
    return `${base}${path}`;
  }

  return `${base}/v1${path}`;
} 