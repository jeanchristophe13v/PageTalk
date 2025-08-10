/**
 * PageTalk - i18n Utilities
 * 统一提供获取当前翻译与格式化文本的方法
 */

/**
 * 获取当前翻译对象
 * @returns {Object} 当前翻译对象
 */
export function getCurrentTranslations() {
  let currentLanguage = 'zh-CN';
  try {
    if (typeof window !== 'undefined' && window.state && window.state.language) {
      currentLanguage = window.state.language;
    } else if (typeof localStorage !== 'undefined') {
      currentLanguage = localStorage.getItem('language') || 'zh-CN';
    }
    if (typeof window !== 'undefined' && window.translations) {
      return window.translations[currentLanguage] || window.translations['zh-CN'] || {};
    }
  } catch (_) {
    // 忽略
  }
  return {};
}

/**
 * 文本翻译函数
 * @param {string} key
 * @param {Record<string, string>} [replacements]
 * @param {Object} [translations]
 * @returns {string}
 */
export function tr(key, replacements = {}, translations) {
  const dict = translations || getCurrentTranslations();
  let text = dict[key] || key;
  for (const ph in replacements) {
    text = text.replace(`{${ph}}`, replacements[ph]);
  }
  return text;
}

// 导出到全局（可选，便于逐步迁移）
if (typeof window !== 'undefined') {
  window.I18n = { getCurrentTranslations, tr };
} 