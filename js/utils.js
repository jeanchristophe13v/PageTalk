/**
 * PageTalk - Utility Functions
 */

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * HTML转义辅助函数
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') {
        console.warn('escapeHtml received non-string input:', text);
        return ''; // Return empty string or handle as appropriate
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// 可以添加其他通用辅助函数