/**
 * Markdown渲染器 - 使用markdown-it库
 */

// 防止重复初始化
if (window.markdownRendererInitialized) {
    console.log('[MarkdownRenderer] Already initialized, skipping...');
} else {
    window.markdownRendererInitialized = true;

// 初始化markdown-it实例
let markdownRenderer = window.markdownRenderer || null;
let isRendererInitialized = false;

// 初始化渲染器
async function initMarkdownRenderer() {
    if (isRendererInitialized) return true;
    
    try {
        // 按需加载markdown库
        if (window.LibraryLoader) {
            await window.LibraryLoader.loadFeatureLibraries('markdown');
        }
        
        // 确保markdown-it已加载
        if (typeof window.markdownit === 'undefined') {
            console.error('markdown-it 库未加载');
            return false;
        }

    // 创建markdown-it实例，使用更适合聊天应用的配置
    markdownRenderer = window.markdownit({
        html: false,        // 禁用HTML标签，更安全
        xhtmlOut: false,    // 禁用XHTML输出
        breaks: true,       // 将\n转换为<br>，适合聊天应用
        linkify: true,      // 自动转换URL为链接
        typographer: true,  // 启用一些语言中性的替换和引号美化
        highlight: function(str, lang) {
            // --- Mermaid ---
            if (lang && lang.toLowerCase() === 'mermaid') {
                // Don't highlight mermaid code blocks, just wrap them for Mermaid library
                // We still escape the content just in case, though Mermaid might handle it.
                // Let's return the raw string as Mermaid expects it.
                return `<pre class="mermaid">${str}</pre>`;
            }
            // --- End Mermaid ---

            const code = str; // Keep original code reference
            const encodedCode = btoa(encodeURIComponent(code)); // Encode for data-code

            // Determine language class first, default to plaintext
            const langClass = lang ? `language-${lang}` : 'language-plaintext';
            let highlightedCode = escapeHtml(code); // Default to escaped code

            // Attempt highlighting only if hljs is available AND language is supported
            if (lang && typeof window.hljs !== 'undefined' && hljs.getLanguage(lang)) {
                try {
                    highlightedCode = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
                } catch (e) {
                    console.error(`Highlight.js error for language ${lang}:`, e);
                    // highlightedCode remains the escaped version
                }
            } else if (lang && typeof window.hljs !== 'undefined' && !hljs.getLanguage(lang)) {
                 // hljs is loaded, but language is not supported (like mermaid)
                 // Keep highlightedCode as escaped version, langClass is already set correctly
                 // console.warn(`Highlight.js language "${lang}" not loaded or supported. Rendering as plain text within language block.`);
            } else if (typeof window.hljs === 'undefined') {
                 // hljs not loaded at all
                 // console.warn('Highlight.js not loaded. Rendering code blocks as plain text.');
                 // highlightedCode remains escaped, langClass is set based on lang presence
            }

            // Return the structure with data-code and highlighted (or escaped) code
            // Ensure the class includes 'hljs' for potential styling hooks if needed,
            // and keep the original 'code-block' for existing styles/JS.
            return `<pre class="code-block hljs ${langClass}" data-code="${encodedCode}"><code>${highlightedCode}</code></pre>`;
        }
    });

    // 自定义渲染器设置
    customizeRenderer();
    
    isRendererInitialized = true;
    return true;
    } catch (error) {
        console.error('[MarkdownRenderer] Failed to initialize:', error);
        return false;
    }
}

// 自定义markdown-it渲染器
function customizeRenderer() {
    if (!markdownRenderer) return;
    
    // 获取默认链接渲染器
    const defaultLinkRender = markdownRenderer.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    // 自定义链接渲染，添加target="_blank"和安全属性
    markdownRenderer.renderer.rules.link_open = function(tokens, idx, options, env, self) {
        // 添加target="_blank"到所有链接
        const aIndex = tokens[idx].attrIndex('target');
        if (aIndex < 0) {
            tokens[idx].attrPush(['target', '_blank']);
            tokens[idx].attrPush(['rel', 'noopener noreferrer']);
        } else {
            tokens[idx].attrs[aIndex][1] = '_blank';
        }

        // 默认渲染
        return defaultLinkRender(tokens, idx, options, env, self);
    };
    
    // 自定义表格渲染器，添加表格容器
    const defaultTableRender = markdownRenderer.renderer.rules.table_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };
    
    markdownRenderer.renderer.rules.table_open = function(tokens, idx, options, env, self) {
        // 在表格外层添加容器div
        return '<div class="table-container">' + defaultTableRender(tokens, idx, options, env, self);
    };
    
    // 自定义表格关闭标签渲染器
    const defaultTableCloseRender = markdownRenderer.renderer.rules.table_close || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };
    
    markdownRenderer.renderer.rules.table_close = function(tokens, idx, options, env, self) {
        // 关闭表格容器div
        return defaultTableCloseRender(tokens, idx, options, env, self) + '</div>';
    };
}

// 渲染Markdown为HTML
async function renderMarkdown(content) {
    // 确保渲染器已初始化
    if (!markdownRenderer && !await initMarkdownRenderer()) {
        // 如果无法初始化渲染器，使用简单的HTML转义
        return `<p>${escapeHtml(content)}</p>`;
    }

    // 预处理内容，确保空行被正确处理
    const processedContent = preprocessContent(content);

    // 使用markdown-it渲染
    let html = markdownRenderer.render(processedContent);

    // 对渲染后的HTML进行后处理
    html = postprocessHtml(html);

    return html;
}

// 对内容进行预处理，处理特殊情况
function preprocessContent(content) {
    // 规范化换行符
    let processedContent = content.replace(/\r\n/g, '\n');
    
    // 处理连续的三个或更多换行符，避免过多空白
    processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
    
    return processedContent;
}

// 对渲染后的HTML进行后处理
function postprocessHtml(html) {
    // 为代码块添加复制按钮的位置
    html = html.replace(/<pre class="code-block/g, 
                         '<pre class="code-block code-block-with-copy');
    
    // 添加markdown-rendered类，方便CSS选择器定位
    html = '<div class="markdown-rendered">' + html + '</div>';
    
    return html;
}

// 仅渲染行内Markdown（不包含段落标签）
async function renderMarkdownInline(content) {
    // 确保渲染器已初始化
    if (!markdownRenderer && !await initMarkdownRenderer()) {
        return escapeHtml(content);
    }

    return markdownRenderer.renderInline(content);
}

// HTML转义辅助函数
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 导出函数
window.MarkdownRenderer = {
    render: renderMarkdown,
    renderInline: renderMarkdownInline,
    escapeHtml: escapeHtml
};

// 保存markdownRenderer实例到window对象，防止重复声明
window.markdownRenderer = markdownRenderer;

} // 结束防重复初始化检查
