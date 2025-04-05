/**
 * Pagetalk 内容脚本
 * 用于从网页中提取内容并与面板通信
 */

// 全局变量，跟踪面板状态
let panelActive = false;
let panelWidth = 520; 
let resizing = false;
let startX, startWidth;
let messageShownForThisPageView = false; // 新增：跟踪当前页面视图是否已显示过提取成功消息

// 初始化函数 - 创建面板DOM
function initPagetalkPanel() {
  // 如果面板已存在，则不重复创建
  if (document.getElementById('pagetalk-panel-container')) {
    return;
  }

  // 创建面板容器
  const panelContainer = document.createElement('div');
  panelContainer.id = 'pagetalk-panel-container';
  panelContainer.style.zIndex = '9999'; // 设置 z-index
  panelContainer.style.width = `${panelWidth}px`; // 明确设置初始宽度
  // panelContainer.style.borderRadius = '16px 0 0 16px'; // 左上、右上、右下、左下
  panelContainer.style.overflow = 'hidden'; // 防止 iframe 内容溢出圆角
  
  // 创建调整器
  const resizer = document.createElement('div');
  resizer.id = 'pagetalk-panel-resizer';
  
  // 创建iframe来加载面板内容
  const iframe = document.createElement('iframe');
  iframe.id = 'pagetalk-panel-iframe';
  
  // 设置iframe源为插件中的HTML文件
  const extensionURL = chrome.runtime.getURL('html/sidepanel.html');
  iframe.src = extensionURL;
  // iframe.style.borderRadius = '16px 0 0 16px'; // 左上、右上、右下、左下
  iframe.style.overflow = 'hidden';   // 确保 iframe 内容也被裁剪
  
  // 组装DOM结构
  panelContainer.appendChild(resizer);
  panelContainer.appendChild(iframe);
  document.body.appendChild(panelContainer);
  
  // 设置调整大小的事件监听
  setupResizeEvents(resizer, panelContainer);

  // 移除：遍历页面中的所有元素，并将它们的 z-index 值设置为 auto (可能破坏页面布局)
}

// 设置调整大小的事件监听器
function setupResizeEvents(resizer, panel) {
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    
    // 标记正在调整大小
    resizing = true;
    
    // 记录初始鼠标位置
    const initialX = e.clientX;
    const initialWidth = parseInt(window.getComputedStyle(panel).width, 10);
    
    // 获取iframe元素
    const iframe = document.getElementById('pagetalk-panel-iframe');
    
    // 在拖动开始时禁用iframe内容重排
    if (iframe) {
      iframe.style.pointerEvents = 'none';
    }
    
    // 创建移动事件处理函数
    function onMouseMove(e) {
      if (resizing) {
        // 计算新的宽度 - 修正计算逻辑
        const diffX = initialX - e.clientX;
        const newWidth = initialWidth + diffX;
        
        // 限制最小宽度为200px，最大宽度为窗口的80%
        if (newWidth >= 200 && newWidth <= window.innerWidth * 0.8) {
          // 检查宽度是否真的改变了
          if (panelWidth !== newWidth) {
            // 更新面板宽度
            panelWidth = newWidth;
            panel.style.width = `${newWidth}px`;
            document.body.style.marginRight = `${newWidth}px`;

            // 新增：通知 iframe 面板宽度已改变
            const iframe = document.getElementById('pagetalk-panel-iframe');
            if (iframe && iframe.contentWindow) {
              // 使用 requestAnimationFrame 或 setTimeout 避免过于频繁地发送消息
              requestAnimationFrame(() => {
                iframe.contentWindow.postMessage({
                  action: 'panelResized',
                  width: panelWidth
                }, '*');
              });
            }
          }
        }
      }
    }
    
    // 创建鼠标释放事件处理函数
    function onMouseUp() {
      // 停止调整大小
      resizing = false;
      
      // 恢复iframe内容交互
      if (iframe) {
        iframe.style.pointerEvents = 'auto';
        
        // 使用postMessage通知iframe内容重新布局，而不是直接调用dispatchEvent
        setTimeout(() => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ 
              action: 'panelResized',
              width: panelWidth
            }, '*');
          }
        }, 100);
      }
      
      // 移除事件监听器
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
    }
    
    // 添加临时事件监听器
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // 防止文本选择
    document.body.style.userSelect = 'none';
  });
}

// 显示面板
function showPanel() {
  const panel = document.getElementById('pagetalk-panel-container');
  if (panel) {
    panel.style.display = 'block';
    panel.style.width = `${panelWidth}px`; // 确保面板宽度与设置一致
    document.body.classList.toggle('pagetalk-panel-open', true);
    document.body.style.marginRight = `${panelWidth}px`;
    panelActive = true;
    
    // 通知面板内容提取页面内容 (保留原有逻辑)
    setTimeout(() => {
      const iframe = document.getElementById('pagetalk-panel-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ action: 'pageContentLoaded' }, '*');
      }
    }, 500);

    // 新增：通知 iframe 面板已显示，以便触发 resizeTextarea
    setTimeout(() => {
      const iframe = document.getElementById('pagetalk-panel-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ action: 'panelShown' }, '*');
      }
    }, 10); // 稍微延迟确保 iframe 内脚本已准备好
  }
}

// 隐藏面板
function hidePanel() {
  const panel = document.getElementById('pagetalk-panel-container');
  if (panel) {
    panel.style.display = 'none';
    document.body.classList.toggle('pagetalk-panel-open', false);
    document.body.style.marginRight = '0';
    panelActive = false;
  }
}

// 切换面板显示状态
function togglePanel() {
  if (panelActive) {
    hidePanel();
  } else {
    showPanel();
  }
}

// 监听来自background或面板的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理提取内容的请求
  if (message.action === "extractContent") {
    try {
      // 提取页面内容
      const content = extractPageContent();
      
      // 发送回请求方
      sendResponse({ content: content });
    } catch (error) {
      console.error('提取内容时出错:', error);
      sendResponse({ error: error.message });
    }
  }
  
  // 处理打开/关闭面板的请求
  else if (message.action === "togglePanel") {
    // 初始化面板（如果尚未初始化）
    initPagetalkPanel();
    
    // 切换面板显示
    togglePanel();
    sendResponse({ success: true, panelActive });
  }
  
  // 允许异步响应
  return true;
});

// 提取页面的主要内容 (使用 Readability.js)
function extractPageContent() {
  try {
    // 确保 Readability 库已加载
    if (typeof Readability === 'undefined') {
      console.error('Readability library not loaded.');
      return '错误：无法加载页面内容提取库。';
    }

    // 克隆文档以避免修改原始页面
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    const article = reader.parse();

    let content = '';
    if (article && article.textContent) {
      // 获取提取到的文本内容
      content = article.textContent;
      // 清理空白字符
      content = content.replace(/\s+/g, ' ').trim();
    } else {
      console.warn('Readability could not parse the page content.');
      // Fallback: 尝试获取 body 的 textContent (可能包含很多噪音)
      content = document.body.textContent || '';
      content = content.replace(/\s+/g, ' ').trim();
      if (!content) {
          return '无法提取页面内容。';
      }
      content = '(Fallback) ' + content; // 标记为后备提取
    }

    // 截断过长的内容
    const maxLength = 500000; // 保持与之前一致的最大长度
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...（内容已截断）';
    }

    return content;

  } catch (error) {
    console.error('Error extracting page content with Readability:', error);
    return `提取页面内容时出错: ${error.message}`;
  }
}

// 监听iframe内部的消息
window.addEventListener('message', (event) => {
  // 确保消息来源是我们的iframe
  if (event.data.action === 'closePanel') {
    hidePanel();
  }
  else if (event.data.action === 'requestPageContent') {
    const content = extractPageContent();
    let showSuccess = false;

    // 检查是否是当前页面视图的第一次提取
    if (!messageShownForThisPageView) {
        showSuccess = true;
        messageShownForThisPageView = true; // 标记为已显示
    }

    // 将内容和显示标志发送回iframe
    const iframe = document.getElementById('pagetalk-panel-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        action: 'pageContentExtracted',
        content: content,
        showSuccessMessage: showSuccess // 添加标志
      }, '*');
    }
  }
  // 添加处理复制文本的功能
  else if (event.data.action === 'copyText') {
    // 使用Clipboard API复制文本
    const text = event.data.text;
    
    // 创建一个临时的textarea元素
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';  // 避免滚动到底部
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    
    // 选择文本并复制
    textarea.select();
    textarea.setSelectionRange(0, 99999);  // 对于移动设备
    
    try {
      // 尝试使用document.execCommand进行复制 (对所有浏览器兼容)
      const success = document.execCommand('copy');
      if (success) {
        // 获取iframe元素并通知复制成功
        const iframe = document.getElementById('pagetalk-panel-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            action: 'copySuccess'
          }, '*');
        }
      } else {
        console.error('复制失败');
      }
    } catch (err) {
      console.error('复制时出错:', err);
    }
    
    // 移除临时元素
    document.body.removeChild(textarea);
  }
});

// 初始运行
