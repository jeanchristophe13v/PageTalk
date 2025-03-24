/**
 * Markdown渲染器 - 使用markdown-it库
 */

// 初始化markdown-it实例
let markdownRenderer = null;

// 初始化渲染器
function initMarkdownRenderer() {
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
            // 高亮处理
            const code = str;
            const encodedCode = btoa(encodeURIComponent(code));
            
            // 返回我们自定义的代码块HTML结构
            return `<pre class="code-block${lang ? ' language-' + lang : ' language-plaintext'}" data-code="${encodedCode}"><code>${escapeHtml(code)}</code></pre>`;
        }
    });

    // 自定义渲染器设置
    customizeRenderer();
    
    return true;
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
function renderMarkdown(content) {
    // 确保渲染器已初始化
    if (!markdownRenderer && !initMarkdownRenderer()) {
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
function renderMarkdownInline(content) {
    // 确保渲染器已初始化
    if (!markdownRenderer && !initMarkdownRenderer()) {
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
