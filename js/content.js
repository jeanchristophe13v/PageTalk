/**
 * Pagetalk 内容脚本
 * 用于从网页中提取内容并与面板通信
 */

// 全局变量，跟踪面板状态
let panelActive = false;
let panelWidth = 500; 
let resizing = false;
let startX, startWidth;

// 初始化函数 - 创建面板DOM
function initPagetalkPanel() {
  // 如果面板已存在，则不重复创建
  if (document.getElementById('pagetalk-panel-container')) {
    return;
  }

  // 创建面板容器
  const panelContainer = document.createElement('div');
  panelContainer.id = 'pagetalk-panel-container';
  panelContainer.style.width = `${panelWidth}px`; // 明确设置初始宽度
  
  // 创建调整器
  const resizer = document.createElement('div');
  resizer.id = 'pagetalk-panel-resizer';
  
  // 创建iframe来加载面板内容
  const iframe = document.createElement('iframe');
  iframe.id = 'pagetalk-panel-iframe';
  
  // 设置iframe源为插件中的HTML文件
  const extensionURL = chrome.runtime.getURL('html/sidepanel.html');
  iframe.src = extensionURL;
  
  // 组装DOM结构
  panelContainer.appendChild(resizer);
  panelContainer.appendChild(iframe);
  document.body.appendChild(panelContainer);
  
  // 设置调整大小的事件监听
  setupResizeEvents(resizer, panelContainer);
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
          // 更新面板宽度
          panelWidth = newWidth;
          panel.style.width = `${newWidth}px`;
          document.body.style.marginRight = `${newWidth}px`;
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
    
    // 通知面板内容提取页面内容
    setTimeout(() => {
      const iframe = document.getElementById('pagetalk-panel-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ action: 'pageContentLoaded' }, '*');
      }
    }, 500);
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

// 提取页面的主要内容
function extractPageContent() {
  // 创建一个包含页面内容的副本
  const contentNode = document.body.cloneNode(true);
  
  // 尝试删除不必要的元素
  try {
    const elementsToRemove = contentNode.querySelectorAll(
      'script, style, noscript, iframe, img, svg, canvas, video, audio, [aria-hidden="true"], ' +
      '.hidden, [hidden], nav, footer, header, aside, [role="banner"], [role="navigation"], ' + 
      '[role="complementary"]'
    );
    
    elementsToRemove.forEach(el => {
      try {
        el.parentNode.removeChild(el);
      } catch (e) {}
    });
  } catch (e) {
    console.warn('清理DOM时出错', e);
  }
  
  // 获取文本内容并清理
  let content = contentNode.textContent || '';
  content = content.replace(/\s+/g, ' ').trim();
  
  // 截断过长的内容 
  const maxLength = 500000;
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '...（内容已截断）';
  }
  
  return content;
}

// 监听iframe内部的消息
window.addEventListener('message', (event) => {
  // 确保消息来源是我们的iframe
  if (event.data.action === 'closePanel') {
    hidePanel();
  }
  else if (event.data.action === 'requestPageContent') {
    const content = extractPageContent();
    
    // 将内容发送回iframe
    const iframe = document.getElementById('pagetalk-panel-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ 
        action: 'pageContentExtracted', 
        content 
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