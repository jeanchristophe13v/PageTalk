/**
 * Pagetalk 内容脚本
 * 用于从网页中提取内容并与面板通信
 */

// 全局变量，跟踪面板状态
let panelActive = false;
let panelWidth = 520; // 默认宽度
let minPanelWidth = 280; // 新增最小宽度限制
let maxPanelWidthPercentage = 0.8; // 最大宽度为窗口的80%
let resizing = false;
let messageShownForThisPageView = false; // 新增：跟踪当前页面视图是否已显示过提取成功消息

// 新增：封装 PDF.js 的加载和初始化
let pdfjsLibPromise = null;

async function getInitializedPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      // 确保在 try-catch 块中处理导入，以防模块加载失败
      try {
        const { getDocument, GlobalWorkerOptions } = await import(chrome.runtime.getURL('js/lib/pdf.mjs'));
        // 确保 GlobalWorkerOptions 存在
        if (GlobalWorkerOptions) {
          GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('js/lib/pdf.worker.mjs');
          console.log('[PageTalk] PDF.js library (our version) loaded and worker configured via getInitializedPdfjsLib.');
          return { getDocument, GlobalWorkerOptions };
        } else {
          console.error('[PageTalk] PDF.js GlobalWorkerOptions is undefined after import.');
          return null; // 未能正确加载 PDF.js 的 GlobalWorkerOptions
        }
      } catch (error) {
        console.error('[PageTalk] Failed to import PDF.js library:', error);
        pdfjsLibPromise = null; // 重置 promise 以便下次重试（如果适用）
        throw error; // 重新抛出错误，让调用者处理
      }
    })();
  }
  return pdfjsLibPromise;
}


// 初始化函数 - 创建面板DOM
function initPagetalkPanel() {
  if (document.getElementById('pagetalk-panel-container')) {
    return;
  }

  const panelContainer = document.createElement('div');
  panelContainer.id = 'pagetalk-panel-container';
  panelContainer.style.zIndex = '2147483647'; // 确保 z-index 设置正确

  // 从localStorage加载保存的宽度
  const savedWidth = localStorage.getItem('pagetalkPanelWidth');
  if (savedWidth) {
    panelWidth = parseInt(savedWidth, 10);
    const windowWidth = window.innerWidth;
    // 确保加载的宽度在允许范围内
    panelWidth = Math.max(minPanelWidth, Math.min(panelWidth, windowWidth * maxPanelWidthPercentage));
  }
  panelContainer.style.width = `${panelWidth}px`;
  panelContainer.style.overflow = 'hidden';

  const resizer = document.createElement('div');
  resizer.id = 'pagetalk-panel-resizer';

  const iframe = document.createElement('iframe');
  iframe.id = 'pagetalk-panel-iframe';
  iframe.src = chrome.runtime.getURL('html/sidepanel.html');
  iframe.style.overflow = 'hidden';

  panelContainer.appendChild(resizer);
  panelContainer.appendChild(iframe);
  document.body.appendChild(panelContainer);

  setupResizeEvents(resizer, panelContainer);
}

// 设置调整大小的事件监听器
function setupResizeEvents(resizer, panel) {
  resizer.addEventListener('mousedown', function (e) {
    e.preventDefault();
    resizing = true;

    const initialX = e.clientX;
    const initialWidth = panelWidth; // 使用当前的 panelWidth
    const iframe = document.getElementById('pagetalk-panel-iframe');

    if (iframe) {
      iframe.style.pointerEvents = 'none'; // 拖动时禁用iframe的鼠标事件
    }
    document.body.classList.add('pagetalk-resizing-active'); // 添加此类以禁用页面其他元素事件

    function onMouseMove(eMove) {
      if (!resizing) return;

      const diffX = initialX - eMove.clientX;
      let newWidth = initialWidth + diffX;
      
      const windowWidth = window.innerWidth;
      // 限制新宽度的范围
      newWidth = Math.max(minPanelWidth, Math.min(newWidth, windowWidth * maxPanelWidthPercentage));

      if (panelWidth !== newWidth) {
        panelWidth = newWidth;
        panel.style.width = `${newWidth}px`;

        const currentUrl = window.location.href;
        const contentType = document.contentType;
        const isPdfPage = currentUrl.toLowerCase().endsWith('.pdf') ||
                          contentType === 'application/pdf' ||
                          document.querySelector('div#viewer.pdfViewer') !== null ||
                          document.querySelector('div#viewerContainer') !== null ||
                          document.querySelector('embed[type="application/pdf"]') !== null;

        if (isPdfPage) {
            // 尝试调整特定PDF容器
            const pdfJsViewer = document.getElementById('viewerContainer') || document.getElementById('outerContainer');
            if (pdfJsViewer && pdfJsViewer.classList.contains('pagetalk-adjusted')) {
                pdfJsViewer.style.marginRight = `${newWidth}px`;
            } else {
                const pdfEmbed = document.querySelector('embed[type="application/pdf"].pagetalk-adjusted');
                const pdfIframe = document.querySelector('iframe[src$=".pdf"].pagetalk-adjusted');
                const targetPdfElement = pdfEmbed || pdfIframe;
                if (targetPdfElement) {
                    targetPdfElement.style.width = `calc(100% - ${newWidth}px)`;
                }
            }
        } else {
            document.body.style.marginRight = `${newWidth}px`;
        }

        if (iframe && iframe.contentWindow) {
          requestAnimationFrame(() => { // 使用 rAF 优化性能
            iframe.contentWindow.postMessage({
              action: 'panelResized',
              width: panelWidth
            }, '*');
          });
        }
      }
    }

    function onMouseUp() {
      if (!resizing) return;
      resizing = false;

      if (iframe) {
        iframe.style.pointerEvents = 'auto'; // 恢复iframe的鼠标事件
      }
      document.body.classList.remove('pagetalk-resizing-active'); // 移除此类
      
      localStorage.setItem('pagetalkPanelWidth', panelWidth.toString()); // 保存宽度

      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ // 发送最终尺寸
          action: 'panelResized',
          width: panelWidth
        }, '*');
      }

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

// 显示面板
function showPanel() {
  const panel = document.getElementById('pagetalk-panel-container');
  if (panel) {
    panel.style.display = 'block';
    panel.style.width = `${panelWidth}px`;
    document.body.classList.add('pagetalk-panel-open');

    const currentUrl = window.location.href;
    const contentType = document.contentType;
    const isPdfPage = currentUrl.toLowerCase().endsWith('.pdf') ||
                      contentType === 'application/pdf' ||
                      document.querySelector('div#viewer.pdfViewer') !== null ||
                      document.querySelector('div#viewerContainer') !== null ||
                      document.querySelector('embed[type="application/pdf"]') !== null;
    
    if (isPdfPage) {
      console.log('[PageTalk] PDF page detected. Attempting to adjust PDF viewer.');
      let adjusted = false;
      const pdfJsViewer = document.getElementById('viewerContainer') || document.getElementById('outerContainer');
      if (pdfJsViewer) {
          // 保存原始样式，如果尚未保存
          if (!pdfJsViewer.dataset.originalMarginRight) pdfJsViewer.dataset.originalMarginRight = getComputedStyle(pdfJsViewer).marginRight;
          pdfJsViewer.style.marginRight = `${panelWidth}px`;
          pdfJsViewer.classList.add('pagetalk-adjusted');
          adjusted = true;
          console.log('[PageTalk] Adjusted PDF.js viewer container margin-right.');
      } else {
          const pdfEmbed = document.querySelector('embed[type="application/pdf"]');
          const pdfIframe = document.querySelector('iframe[src$=".pdf"]'); // 简单匹配包含.pdf的iframe
          const targetPdfElement = pdfEmbed || pdfIframe;

          if (targetPdfElement) {
              if (!targetPdfElement.dataset.originalWidth) targetPdfElement.dataset.originalWidth = getComputedStyle(targetPdfElement).width;
              targetPdfElement.style.width = `calc(100% - ${panelWidth}px)`;
              targetPdfElement.classList.add('pagetalk-adjusted');
              adjusted = true;
              console.log('[PageTalk] Adjusted PDF embed/iframe width.');
          }
      }
      if (!adjusted) {
          console.log('[PageTalk] No specific PDF container found/adjusted. Panel will overlay. Body margin unchanged.');
      }
      // 在PDF页面，不修改 document.body.style.marginRight
    } else {
      document.body.style.marginRight = `${panelWidth}px`;
    }
    panelActive = true;

    setTimeout(() => {
      const iframe = document.getElementById('pagetalk-panel-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ action: 'pageContentLoaded' }, '*');
        iframe.contentWindow.postMessage({ action: 'panelShownAndFocusInput' }, '*');
      }
    }, 100);
  
    setTimeout(detectAndSendTheme, 150);
  }
}

function makeElementResizable(modalElement, resizeHandleElement, minWidth = 200, minHeight = 150) {
  let startX, startY, startWidth, startHeight, isResizing = false;

  resizeHandleElement.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = modalElement.offsetWidth;
    startHeight = modalElement.offsetHeight;

    document.body.style.userSelect = 'none'; // Prevent text selection

    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
    e.preventDefault(); // Prevent default drag behavior
  });

  function onResizeMouseMove(e) {
    if (!isResizing) return;

    let newWidth = startWidth + (e.clientX - startX);
    let newHeight = startHeight + (e.clientY - startY);

    // Apply min dimensions
    if (newWidth < minWidth) newWidth = minWidth;
    if (newHeight < minHeight) newHeight = minHeight;

    // Optional: Max dimensions (e.g., respect viewport size)
    // newWidth = Math.min(newWidth, window.innerWidth - modalElement.offsetLeft - 10); // 10 for padding
    // newHeight = Math.min(newHeight, window.innerHeight - modalElement.offsetTop - 10);


    modalElement.style.width = `${newWidth}px`;
    modalElement.style.height = `${newHeight}px`;
  }

  function onResizeMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  }
}

// --- Generic UI Helper Functions ---
function makeElementDraggable(modalElement, handleElement) {
  let offsetX, offsetY, isDragging = false;

  handleElement.style.cursor = 'move';

  handleElement.addEventListener('mousedown', (e) => {
    // Prevent dragging if clicking on interactive elements within the header (e.g., buttons, dropdowns)
    if (e.target.closest('button, select, input, .dropdown-placeholder, .button-placeholder, .pagetalk-chat-modal-close')) {
        return;
    }

    isDragging = true;
    // Calculate offset from mouse pointer to modal's top-left corner
    const modalRect = modalElement.getBoundingClientRect();
    offsetX = e.clientX - modalRect.left;
    offsetY = e.clientY - modalRect.top;

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault(); // Prevent default drag behavior for the handle itself if it's an image etc.
  });

  function onMouseMove(e) {
    if (!isDragging) return;

    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;

    // Optional: Boundary checks (keep modal within viewport)
    // const viewportWidth = window.innerWidth;
    // const viewportHeight = window.innerHeight;
    // const modalWidth = modalElement.offsetWidth;
    // const modalHeight = modalElement.offsetHeight;

    // if (newX < 0) newX = 0;
    // if (newY < 0) newY = 0;
    // if (newX + modalWidth > viewportWidth) newX = viewportWidth - modalWidth;
    // if (newY + modalHeight > viewportHeight) newY = viewportHeight - modalHeight;

    modalElement.style.left = `${newX}px`;
    modalElement.style.top = `${newY}px`;
    // If using transform: translate for centering, dragging needs to adjust that.
    // For now, assuming top/left positioning is primary for dragged elements.
    // If it was centered with transform, we need to remove that and use top/left.
    modalElement.style.transform = 'translate(0, 0)'; // Remove any centering transform
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = ''; // Restore text selection
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}
// 隐藏面板
function hidePanel() {
  const panel = document.getElementById('pagetalk-panel-container');
  if (panel) {
    panel.style.display = 'none';
    document.body.classList.remove('pagetalk-panel-open');
    panelActive = false;

    // 恢复PDF容器的样式
    const pdfJsViewer = document.querySelector('.pagetalk-adjusted#viewerContainer, .pagetalk-adjusted#outerContainer');
    if (pdfJsViewer) {
        if (pdfJsViewer.dataset.originalMarginRight) pdfJsViewer.style.marginRight = pdfJsViewer.dataset.originalMarginRight;
        pdfJsViewer.classList.remove('pagetalk-adjusted');
        console.log('[PageTalk] Restored PDF.js viewer container margin-right.');
    } else {
        const targetPdfElement = document.querySelector('embed[type="application/pdf"].pagetalk-adjusted, iframe[src$=".pdf"].pagetalk-adjusted');
        if (targetPdfElement) {
            if (targetPdfElement.dataset.originalWidth) targetPdfElement.style.width = targetPdfElement.dataset.originalWidth;
            targetPdfElement.classList.remove('pagetalk-adjusted');
            console.log('[PageTalk] Restored PDF embed/iframe width.');
        }
    }
    // 恢复普通页面的body margin
    document.body.style.marginRight = '0';
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
  // 主动响应主题请求
  if (message.action === "requestTheme") {
    detectAndSendTheme();
    sendResponse && sendResponse({ success: true });
    return true;
  }
  // 修改：处理来自 background.js 的内容提取请求
  if (message.action === "getFullPageContentRequest") {
    (async () => { // 使用 IIFE 来处理异步操作
      try {
        const content = await extractPageContent(); // extractPageContent 现在是异步的
        sendResponse({ content: content });
      } catch (error) {
        console.error('[PageTalk] Error during content extraction (getFullPageContentRequest listener):', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // 必须返回 true 来表明 sendResponse 将会异步调用
  }

  // 处理打开/关闭面板的请求
  else if (message.action === "togglePanel") {
    // 初始化面板（如果尚未初始化）
    initPagetalkPanel();

    // 切换面板显示
    togglePanel();
    sendResponse({ success: true, panelActive });
    return true; // 这是异步的，尽管 togglePanel 本身不是
  }

  // 确保为其他可能的消息处理器也返回 true（如果它们是异步的）
  // 如果没有其他异步处理器，可以在这里返回 false 或 undefined
  // 为了保险起见，如果这个 listener 包含任何异步操作，最好总是返回 true
  return true;
});

// 提取页面的主要内容 - 现在是异步函数
async function extractPageContent() {
  const currentUrl = window.location.href;
  const contentType = document.contentType;
  // 检测是否为 PDF.js 渲染的页面 (例如 arXiv)
  const isPdfJsViewerDom = document.querySelector('div#viewer.pdfViewer') !== null || document.querySelector('div#viewerContainer') !== null;
  // 检测是否为直接的 PDF 链接或浏览器识别为 PDF 内容类型
  const isDirectPdf = currentUrl.toLowerCase().endsWith('.pdf') || contentType === 'application/pdf';

  console.log(`[PageTalk] Extraction check: isDirectPdf=${isDirectPdf}, isPdfJsViewerDom=${isPdfJsViewerDom}, contentType=${contentType}, url=${currentUrl}`);

  if (isDirectPdf) {
    console.log('[PageTalk] Direct PDF detected. Attempting fetch and PDF.js parse.');
    try {
      // 修改：使用 getInitializedPdfjsLib 获取 pdf.js
      const pdfjs = await getInitializedPdfjsLib();
      if (!pdfjs || !pdfjs.getDocument) { // 检查 pdfjs 是否成功初始化
        throw new Error('PDF.js library failed to initialize.');
      }

      // 使用 fetch 获取 PDF 文件的 ArrayBuffer
      const response = await fetch(currentUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF (${response.status}): ${response.statusText}`);
      }
      const pdfData = await response.arrayBuffer();
      // 修改：使用 pdfjs.getDocument
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

      // 提取 PDF 元数据和文本内容
      let fullText = `PDF Title: ${pdf.info?.Title || document.title || 'Unknown Title'}\n`;
      fullText += `Number of Pages: ${pdf.numPages}\n\n`;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // 简单地将所有文本项连接起来，并用空格分隔
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      console.log('[PageTalk] PDF text extracted via fetch, length:', fullText.length);
      const maxLength = 500000; // 限制最大长度，与 Readability 提取一致
      if (fullText.length > maxLength) {
        fullText = fullText.substring(0, maxLength) + '... (Content truncated)';
      }
      return fullText.trim();
    } catch (pdfError) {
      console.warn('[PageTalk] PDF fetch/parse error for direct PDF:', pdfError);
      // 如果 fetch/parse 失败，但 DOM 结构像是 PDF.js viewer，尝试从 DOM 提取
      if (isPdfJsViewerDom) {
        console.log('[PageTalk] Falling back to DOM extraction for direct PDF (e.g. arXiv).');
        return extractFromPdfJsDom(); // 尝试从DOM中提取
      }
      // 如果 DOM 提取方式不适用或失败，最终回退到 Readability
      console.warn('[PageTalk] Falling back to Readability for direct PDF after fetch/parse error.');
      return `Error processing PDF: ${pdfError.message}. \n\n ${extractWithReadability()}`;
    }
  } else if (isPdfJsViewerDom) {
    // 如果不是直接的 PDF 链接，但页面 DOM 结构像是 PDF.js 渲染的
    console.log('[PageTalk] Embedded PDF.js viewer detected. Attempting DOM extraction.');
    return extractFromPdfJsDom();
  } else {
    // 对于普通 HTML 页面，使用 Readability
    console.log('[PageTalk] Standard HTML page. Using Readability.');
    return extractWithReadability();
  }
}

/**
 * 从 Readability.js 提取内容 (同步函数)
 * @returns {string}
 */
function extractWithReadability() {
  try {
    if (typeof Readability === 'undefined') {
      console.error('[PageTalk] Readability library not loaded.');
      return '错误：无法加载页面内容提取库。';
    }
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    const article = reader.parse();
    let content = '';
    if (article && article.textContent) {
      content = article.textContent;
      content = content.replace(/\s+/g, ' ').trim(); // 规范化空白字符
    } else {
      console.warn('[PageTalk] Readability could not parse the page content. Falling back to body text.');
      content = document.body.textContent || '';
      content = content.replace(/\s+/g, ' ').trim();
      if (!content) {
        return '无法提取页面内容。';
      }
      content = '(Fallback to body text) ' + content; // 标记为后备提取
    }
    const maxLength = 500000; // 限制最大长度
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...（内容已截断）';
    }
    return content;

  } catch (error) {
    console.error('[PageTalk] Error extracting page content with Readability:', error);
    return `提取页面内容时出错: ${error.message}`;
  }
}

/**
 * 从 PDF.js 渲染的 DOM 结构中提取文本 (同步函数)
 * @returns {string}
 */
function extractFromPdfJsDom() {
  let pdfText = '';
  // 尝试常见的 PDF.js viewer 容器选择器
  const viewer = document.getElementById('viewer') ||
    document.getElementById('viewerContainer') ||
    document.querySelector('.pdfViewer'); // 尝试常见的类名

  if (viewer && typeof viewer.innerText === 'string' && viewer.innerText.trim()) {
    // 使用 innerText 通常能较好地获取屏幕阅读器可见的文本内容
    pdfText = viewer.innerText.trim();
    console.log('[PageTalk] Extracted text from PDF.js viewer DOM using innerText, length:', pdfText.length);
  } else {
    // 如果 viewer.innerText 失败，尝试更具体地从 textLayer 提取
    const textLayers = document.querySelectorAll('.textLayer');
    if (textLayers.length > 0) {
      let combinedText = [];
      textLayers.forEach(layer => {
        // 获取该层内所有可能包含文本片段的 span 元素
        const spans = layer.querySelectorAll('span');
        let layerText = '';
        spans.forEach(span => {
          // 检查确保如果 span 有实际文本内容且不是纯粹的间隔符
          if (span.textContent && span.textContent.trim() !== '') {
            layerText += span.textContent;
          }
        });
        combinedText.push(layerText);
      });
      pdfText = combinedText.join('\n').trim(); // 用换行符连接不同层的文本
      if (pdfText) {
        console.log('[PageTalk] Extracted text by combining .textLayer span contents, length:', pdfText.length);
      }
    }
  }

  if (pdfText) {
    const title = document.title || 'Embedded PDF';
    // 规范化提取过程中可能产生的多余空格和换行
    pdfText = pdfText.replace(/\s\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    return `Title: ${title}\n\n${pdfText}`;
  }

  console.warn('[PageTalk] Failed to extract text from PDF.js viewer DOM, falling back to Readability.');
  return extractWithReadability(); // 如果 DOM 提取没有结果，则回退
}


// --- 主题检测与发送 ---
/**
 * 检测网页当前的显式或系统颜色模式偏好，并发送给侧边栏 iframe
 */
function detectAndSendTheme() {
  const iframe = document.getElementById('pagetalk-panel-iframe');
  if (!iframe || !iframe.contentWindow) {
    // console.log('[PageTalk] Sidepanel iframe not ready for theme update.');
    return; // 如果 iframe 不存在或未加载完成，则不发送
  }

  let detectedTheme = 'system'; // 默认为 'system'，表示未检测到明确主题或依赖系统

  // 1. 检查 HTML data-color-mode 属性 (GitHub 使用) - 最高优先级
  const dataColorMode = document.documentElement.getAttribute('data-color-mode');
  if (dataColorMode) {
    const mode = dataColorMode.toLowerCase();
    if (mode.includes('dark')) {
      detectedTheme = 'dark';
    } else if (mode.includes('light')) {
      detectedTheme = 'light';
    }
    console.log(`[PageTalk content.js] Detected theme via data-color-mode: ${detectedTheme}`);
  }

  // 2. 如果 data-color-mode 未明确指定，检查 HTML data-theme 属性
  if (detectedTheme === 'system') {
    const dataTheme = document.documentElement.getAttribute('data-theme');
    if (dataTheme) {
      const theme = dataTheme.toLowerCase();
      if (theme.includes('dark')) {
        detectedTheme = 'dark';
      } else if (theme.includes('light')) {
        detectedTheme = 'light';
      }
      console.log(`[PageTalk content.js] Detected theme via data-theme: ${detectedTheme}`);
    }
  }

  // 3. 如果以上属性都未明确指定，检查 body class (更灵活的匹配)
  if (detectedTheme === 'system') {
    const bodyClasses = document.body.classList;
    // 检查常见的深色模式类名
    if (bodyClasses.contains('dark-mode') || bodyClasses.contains('theme-dark') || bodyClasses.contains('dark')) {
      detectedTheme = 'dark';
      // 检查常见的浅色模式类名
    } else if (bodyClasses.contains('light-mode') || bodyClasses.contains('theme-light') || bodyClasses.contains('light')) {
      detectedTheme = 'light';
    }
    if (detectedTheme !== 'system') {
      console.log(`[PageTalk content.js] Detected theme via body class: ${detectedTheme}`);
    }
  }

  // 4. 如果 HTML 标记和类名都未明确指定，最后回退到 prefers-color-scheme
  if (detectedTheme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    // 只有在系统偏好明确时才覆盖 'system'
    if (prefersDark.media !== 'not all') { // 检查媒体查询是否有效
      detectedTheme = prefersDark.matches ? 'dark' : 'light';
      console.log(`[PageTalk content.js] Detected theme via prefers-color-scheme: ${detectedTheme}`);
    } else {
      console.log('[PageTalk content.js] prefers-color-scheme media query is not valid, keeping theme as system/default.');
      // 在这种情况下，detectedTheme 为 'system' 或 'light' (取决于你的默认偏好)
      detectedTheme = 'light'; // 明确设置为浅色作为最终回退
    }
  }

  console.log(`[PageTalk content.js] Detected theme: ${detectedTheme}. Sending to sidepanel.`); // 调试日志

  iframe.contentWindow.postMessage({
    action: 'webpageThemeDetected', // 更改 action 名称
    theme: detectedTheme // 发送检测到的主题 ('dark', 'light', 'system')
  }, '*');
}

// 监听系统/浏览器主题变化 (仅当未检测到 HTML 显式主题时，系统变化才有意义)
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function handleSystemThemeChange(event) {
  console.log(`[PageTalk content.js] System theme changed event detected. prefersDark: ${event.matches}`);
  // 重新运行检测逻辑，它会优先检查 HTML 属性/类，只有在没有显式设置时才会使用系统偏好
  detectAndSendTheme();
}

// 使用 addEventListener 替代旧的 addListener
if (mediaQuery.addEventListener) {
  mediaQuery.addEventListener('change', handleSystemThemeChange);
} else if (mediaQuery.addListener) { // 兼容旧版浏览器
  mediaQuery.addListener(handleSystemThemeChange);
}
// --- 结束：主题检测与发送 ---


// 监听iframe内部的消息
window.addEventListener('message', (event) => {
  // 确保消息来源是我们的iframe
  const iframeElement = document.getElementById('pagetalk-panel-iframe');
  if (!iframeElement || event.source !== iframeElement.contentWindow) {
    // console.log("Ignoring message not from pagetalk-panel-iframe", event.origin, event.source);
    return; // 仅处理来自特定iframe的消息
  }

  const iframe = iframeElement; // Use the already retrieved iframe element

  if (event.data.action === 'closePanel') {
    hidePanel();
  }
  else if (event.data.action === 'requestPageContent') {
    (async () => { // 使用 IIFE 处理异步
      let showSuccess = false;
      // 检查是否是当前页面视图的第一次提取
      if (!messageShownForThisPageView) {
        showSuccess = true;
        messageShownForThisPageView = true; // 标记为已显示
      }
      const content = await extractPageContent(); // 调用异步函数
      // 将内容和显示标志发送回iframe
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          action: 'pageContentExtracted',
          content: content,
          showSuccessMessage: showSuccess // 添加标志
        }, '*');
      }
    })();
  }
  // 添加复制文本的功能
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
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            action: 'copySuccess'
          }, '*');
        }
      } else {
        console.error('[PageTalk] Copy failed via execCommand');
      }
    } catch (err) {
      console.error('[PageTalk] Error copying text:', err);
    }

    // 移除临时元素
    document.body.removeChild(textarea);
  }
});

// 初始运行
// 在页面加载完成后立即发送主题更新消息
window.addEventListener('load', () => {
  // initPagetalkPanel(); // 考虑是否在load时立即初始化，或者按需初始化
  detectAndSendTheme(); // 页面加载完成后立即发送主题
});

// --- Text Selection UI: Icon, Options Bar, Interpret, Translate, Chat Modals ---
let selectionMagicIcon = null;
const PAGETALK_SELECTION_ICON_ID = 'pagetalk-selection-magic-icon';
let optionsBarElement = null;
const PAGETALK_OPTIONS_BAR_ID = 'pagetalk-options-bar';

let interpretModalElement = null;
const PAGETALK_INTERPRET_MODAL_ID = 'pagetalk-interpret-modal';
let lastInterpretationRequest = null;

let translateModalElement = null;
const PAGETALK_TRANSLATE_MODAL_ID = 'pagetalk-translate-modal';
let lastTranslationRequest = null;

let chatModalElement = null;
const PAGETALK_CHAT_MODAL_ID = 'pagetalk-chat-modal';
let currentChatSelectedText = ''; // Store selected text for chat context
let pageContentForChat = ''; // Store page content for chat context
let chatMessagesContainer = null;
let chatQuotedTextElement = null;
let chatInputField = null;
let chatSendButton = null; // Reference to the send button

let currentDetectedTheme = 'light'; // To help style UI elements


// Function to remove all selection-related UI elements
function removeSelectionRelatedUI() {
  const removeElement = (elementRef, setNullCallback, escapeKeyHandler) => {
    if (elementRef) {
      elementRef.classList.remove('visible');
      setTimeout(() => {
        if (elementRef) elementRef.remove();
        if (setNullCallback) setNullCallback();
      }, 200);
      if (escapeKeyHandler) document.removeEventListener('keydown', escapeKeyHandler);
    }
  };

  removeElement(selectionMagicIcon, () => selectionMagicIcon = null, null);
  removeElement(optionsBarElement, () => optionsBarElement = null, null);
  removeElement(interpretModalElement, () => interpretModalElement = null, handleEscapeKeyForInterpretModal);
  removeElement(translateModalElement, () => translateModalElement = null, handleEscapeKeyForTranslateModal);
  removeElement(chatModalElement, () => {
    chatModalElement = null;
    // Also nullify related chat element references
    chatMessagesContainer = null;
    chatQuotedTextElement = null;
    chatInputField = null;
    chatSendButton = null;
  }, handleEscapeKeyForChatModal);
}

function createSelectionIcon(selection) {
  removeSelectionRelatedUI(); // Remove any existing UI first

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Check if the selection has a valid size
  if (rect.width === 0 && rect.height === 0) {
    console.log('[PageTalk] Selection has no dimensions, not showing icon.');
    return;
  }

  selectionMagicIcon = document.createElement('img');
  selectionMagicIcon.id = PAGETALK_SELECTION_ICON_ID;
  try {
    selectionMagicIcon.src = chrome.runtime.getURL('magic.png');
  } catch (e) {
    console.warn('[PageTalk] Could not get URL for magic.png. Extension context might be invalidated.', e);
    selectionMagicIcon = null;
    return;
  }

  selectionMagicIcon.style.position = 'absolute';
  selectionMagicIcon.style.zIndex = '2147483646';
  selectionMagicIcon.style.cursor = 'pointer';
  selectionMagicIcon.style.width = '24px';
  selectionMagicIcon.style.height = '24px';
  selectionMagicIcon.style.userSelect = 'none';
  selectionMagicIcon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  selectionMagicIcon.style.borderRadius = '50%';
  selectionMagicIcon.style.backgroundColor = 'rgba(255,255,255,0.8)'; // Make it visible on dark backgrounds
  selectionMagicIcon.style.padding = '3px'; // Padding to make the background visible around the icon
  selectionMagicIcon.style.boxSizing = 'content-box'; // Ensure padding adds to size

  // Position near the bottom-right of the selection
  const iconEffectiveWidth = 24 + 2 * 3; // width + padding * 2
  const iconEffectiveHeight = 24 + 2 * 3; // height + padding * 2
  let topPosition = rect.bottom + window.scrollY + 5;
  let leftPosition = rect.right + window.scrollX - iconEffectiveWidth / 2; // Centered more or less on the right edge

  // Adjust if icon goes off-screen
  if (leftPosition + iconEffectiveWidth > window.innerWidth + window.scrollX) {
    leftPosition = window.innerWidth + window.scrollX - iconEffectiveWidth - 5;
  }
  if (topPosition + iconEffectiveHeight > window.innerHeight + window.scrollY) {
    // If it overflows bottom, try to place it above the selection
    topPosition = rect.top + window.scrollY - iconEffectiveHeight - 5;
  }
  if (leftPosition < window.scrollX) leftPosition = window.scrollX + 5;
  if (topPosition < window.scrollY) topPosition = window.scrollY + 5;


  selectionMagicIcon.style.top = `${topPosition}px`;
  selectionMagicIcon.style.left = `${leftPosition}px`;

  selectionMagicIcon.addEventListener('click', (event) => {
    event.stopPropagation(); // VERY IMPORTANT: Prevent click from reaching document mousedown listener
    toggleOptionsBar(selectionMagicIcon, selection);
  });

  document.body.appendChild(selectionMagicIcon);
}

function getI18nMessage(key, defaultValue) {
  if (chrome.i18n && chrome.i18n.getMessage) {
    const message = chrome.i18n.getMessage(key);
    return message || defaultValue;
  }
  return defaultValue;
}

function createOptionsBarHTML(selectionText) {
  const bar = document.createElement('div');
  bar.id = PAGETALK_OPTIONS_BAR_ID;
  if (currentDetectedTheme === 'dark') bar.classList.add('pagetalk-dark-mode');

  const iconImg = document.createElement('img');
  try {
    iconImg.src = chrome.runtime.getURL('magic.png');
  } catch(e) { console.warn("[PageTalk] Error getting magic.png URL for options bar", e); }
  iconImg.className = 'pagetalk-bar-icon';
  bar.appendChild(iconImg);

  // Fetch dynamic options from storage
  chrome.storage.sync.get('selectionAssistantConfig', (result) => {
    const config = result.selectionAssistantConfig;
    let options = [];

    if (config && config.options && config.options.length > 0) {
      options = config.options;
    } else {
      // Fallback to hardcoded defaults if nothing in storage (should ideally be pre-populated by settings.js)
      console.warn("[PageTalk] No selection assistant options found in storage, using hardcoded defaults for options bar.");
      options = [
        { id: 'default_interpret', name: getI18nMessage('defaultInterpret', '解读'), type: 'interpret', model: 'gemini-1.5-flash-preview-0514', prompt: getI18nMessage('defaultInterpretPrompt', '请根据以下页面内容，解读选中的文本：'), temperature: 0.7 },
        { id: 'default_translate', name: getI18nMessage('defaultTranslate', '翻译'), type: 'translate', model: 'gemini-1.5-flash-preview-0514', prompt: getI18nMessage('defaultTranslatePrompt', '请将以下选中的文本在中文和英文之间互译：'), temperature: 0.2 },
        { id: 'default_chat', name: getI18nMessage('defaultChat', '对话'), type: 'chat' }
      ];
    }

    options.forEach(optionConfig => {
      const button = document.createElement('div');
      button.className = 'pagetalk-option-button';
      button.textContent = optionConfig.name; // Use the name from config
      // Store necessary data on the button, e.g., using dataset or attach directly
      button.dataset.optionId = optionConfig.id;
      // Attach the full config to the button element for easy access in the handler
      // This is safe as it's in-memory for the content script's JS context.
      button._pagetalkOptionConfig = optionConfig;


      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const clickedOption = event.currentTarget._pagetalkOptionConfig;
        console.log(`[PageTalk] Dynamic Action: ${clickedOption.name} (Type: ${clickedOption.type}), Text: ${selectionText.substring(0, 50)}...`);

        // Ensure selectionText is available, might need to pass it or get it from current selection state
        const currentSelection = window.getSelection().toString().trim();
        const textToProcess = currentSelection || selectionText;


        if (clickedOption.type === 'interpret' || clickedOption.type === 'custom_prompt') {
          // For custom_prompt, we use the interpret modal but with its own prompt/model/temp
          handleInterpretAction(textToProcess, clickedOption);
        } else if (clickedOption.type === 'translate') {
          handleTranslateAction(textToProcess, clickedOption);
        } else if (clickedOption.type === 'chat') {
          handleChatAction(textToProcess); // Chat uses its own context/settings flow
        } else {
          alert(`Unknown action type: ${clickedOption.type}`);
          removeSelectionRelatedUI();
        }
        // The modal handlers (handleInterpretAction, etc.) will call removeSelectionRelatedUI
        // or the options bar will be removed if a click outside occurs.
      });
      bar.appendChild(button);
    });
  });

  return bar;
}

function toggleOptionsBar(iconElement, selection) {
  if (optionsBarElement && optionsBarElement.classList.contains('visible')) {
    optionsBarElement.classList.remove('visible');
    if (selectionMagicIcon) selectionMagicIcon.classList.remove('active');
  } else {
    // Important: createOptionsBarHTML is now async due to chrome.storage.sync.get
    // We need to handle its creation and appending differently or make toggleOptionsBar async.
    // For simplicity here, let's assume createOptionsBarHTML populates the bar,
    // and we handle the append and display after it's ready.
    // This might mean a slight delay in showing the bar the first time.

    // Remove existing bar before creating a new one to ensure fresh options
    if (optionsBarElement) optionsBarElement.remove();
    optionsBarElement = createOptionsBarHTML(selection.toString()); // This now populates bar async
    document.body.appendChild(optionsBarElement); // Append empty bar shell first

    // The actual buttons are added async. Positioning might need adjustment after buttons load.
    // A simple way is to re-calculate position after a short delay or use a MutationObserver.
    // For now, position immediately, buttons will fill in.
    }

    // Ensure dark mode class is current
    if (currentDetectedTheme === 'dark') {
      optionsBarElement.classList.add('pagetalk-dark-mode');
    } else {
      optionsBarElement.classList.remove('pagetalk-dark-mode');
    }

    // Positioning: Attempt to position above the icon
    const iconRect = iconElement.getBoundingClientRect();
    const barWidth = optionsBarElement.offsetWidth || 200; // Estimate if not rendered yet
    const barHeight = optionsBarElement.offsetHeight || 40; // Estimate

    let top = iconRect.top + window.scrollY - barHeight - 10; // 10px spacing
    let left = iconRect.left + window.scrollX + (iconRect.width / 2) - (barWidth / 2);

    // Adjust if off screen
    if (top < window.scrollY + 5) { // Too close to top or off-screen
        top = iconRect.bottom + window.scrollY + 10; // Move below icon
        optionsBarElement.classList.remove('positioned-above');
    } else {
        optionsBarElement.classList.add('positioned-above');
    }
    if (left < window.scrollX + 5) left = window.scrollX + 5;
    if (left + barWidth > window.innerWidth + window.scrollX - 5) {
        left = window.innerWidth + window.scrollX - barWidth - 5;
    }

    optionsBarElement.style.top = `${top}px`;
    optionsBarElement.style.left = `${left}px`;

    requestAnimationFrame(() => { // Use rAF to ensure bar is in DOM and styles applied before animation
        optionsBarElement.classList.add('visible');
        if (selectionMagicIcon) selectionMagicIcon.classList.add('active');
    });
  }
}

document.addEventListener('mouseup', (event) => {
  if (resizing || event.target.closest(`#${PAGETALK_OPTIONS_BAR_ID}`) || (selectionMagicIcon && event.target === selectionMagicIcon)) {
    return;
  }

  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    createSelectionIcon(selection);
  } else {
  // If selection is empty, and not clicking inside options bar or any active modal, remove everything
  if (!event.target.closest(`#${PAGETALK_OPTIONS_BAR_ID}`) &&
      !event.target.closest(`#${PAGETALK_INTERPRET_MODAL_ID}`) &&
      !event.target.closest(`#${PAGETALK_TRANSLATE_MODAL_ID}`) &&
      !event.target.closest(`#${PAGETALK_CHAT_MODAL_ID}`)) {
        removeSelectionRelatedUI();
    }
  }
});

document.addEventListener('mousedown', (event) => {
  // If the click is outside the icon, options bar, and any active modal, remove related UI.
  const clickedOnIcon = selectionMagicIcon && event.target === selectionMagicIcon;
  const clickedOnOptionsBar = event.target.closest(`#${PAGETALK_OPTIONS_BAR_ID}`);
  const clickedOnInterpretModal = event.target.closest(`#${PAGETALK_INTERPRET_MODAL_ID}`);
  const clickedOnTranslateModal = event.target.closest(`#${PAGETALK_TRANSLATE_MODAL_ID}`);
  const clickedOnChatModal = event.target.closest(`#${PAGETALK_CHAT_MODAL_ID}`);

  if (!clickedOnIcon && !clickedOnOptionsBar && !clickedOnInterpretModal && !clickedOnTranslateModal && !clickedOnChatModal) {
    removeSelectionRelatedUI();
  }
}, true);

document.addEventListener('scroll', () => {
  if (selectionMagicIcon || optionsBarElement || interpretModalElement || translateModalElement || chatModalElement) {
    removeSelectionRelatedUI();
  }
}, true);


// --- Interpret Modal Logic ---

function createInterpretModalHTML() {
  const modal = document.createElement('div');
  modal.id = PAGETALK_INTERPRET_MODAL_ID;
  if (currentDetectedTheme === 'dark') {
    modal.classList.add('pagetalk-dark-mode');
  }

  // Header
  const header = document.createElement('div');
  header.id = 'pagetalk-interpret-modal-header';
  const title = document.createElement('span');
  title.id = 'pagetalk-interpret-modal-title';
  title.textContent = getI18nMessage('interpretModalTitle', '解读文本'); // "Interpret Text"
  const closeButton = document.createElement('span');
  closeButton.id = 'pagetalk-interpret-modal-close';
  closeButton.innerHTML = '&times;'; // '×' character
  closeButton.onclick = () => hideInterpretModal();
  header.appendChild(title);
  header.appendChild(closeButton);
  modal.appendChild(header);

  // Content
  const content = document.createElement('div');
  content.id = 'pagetalk-interpret-modal-content'; // This ID is used by CSS
  content.innerHTML = `<div class="loading-indicator">${getI18nMessage('loading', 'Loading...')}</div>`;
  modal.appendChild(content);

  // Footer
  const footer = document.createElement('div');
  footer.id = 'pagetalk-interpret-modal-footer'; // This ID is used by CSS
  const copyButton = document.createElement('button');
  copyButton.className = 'copy-button';
  copyButton.textContent = getI18nMessage('copy', 'Copy');
  copyButton.onclick = () => {
    const responseText = modal.querySelector('#pagetalk-interpret-modal-content').innerText;
    navigator.clipboard.writeText(responseText.replace(/\n\nLoading\.\.\.$/, ''))
      .then(() => {
        copyButton.textContent = getI18nMessage('copied', 'Copied!');
        setTimeout(() => copyButton.textContent = getI18nMessage('copy', 'Copy'), 2000);
      })
      .catch(err => console.error('[PageTalk] Failed to copy text:', err));
  };
  const regenerateButton = document.createElement('button');
  regenerateButton.className = 'regenerate-button';
  regenerateButton.textContent = getI18nMessage('regenerate', 'Regenerate');
  regenerateButton.onclick = () => {
    if (lastInterpretationRequest) {
      showInterpretModal(lastInterpretationRequest.selectedText, true);
       chrome.runtime.sendMessage({
        ...lastInterpretationRequest, // This should contain all needed params like model, temp, promptKey etc.
        action: "interpretText",
      });
    }
  };
  footer.appendChild(regenerateButton);
  footer.appendChild(copyButton);
  modal.appendChild(footer);

  return modal;
}

function showInterpretModal(selectedText, isRegeneration = false) {
  // Ensure other modals are hidden
  if (translateModalElement) hideTranslateModal();

  if (!interpretModalElement || !document.body.contains(interpretModalElement)) {
    interpretModalElement = createInterpretModalHTML();
    document.body.appendChild(interpretModalElement);
  }

  if (currentDetectedTheme === 'dark') {
    interpretModalElement.classList.add('pagetalk-dark-mode');
  } else {
    interpretModalElement.classList.remove('pagetalk-dark-mode');
  }

  const contentDiv = interpretModalElement.querySelector('#pagetalk-interpret-modal-content');
  contentDiv.innerHTML = `<div class="loading-indicator">${getI18nMessage('loading', 'Loading...')}</div>`;
  interpretModalElement.querySelector('.copy-button').textContent = getI18nMessage('copy', 'Copy');

  requestAnimationFrame(() => {
    interpretModalElement.classList.add('visible');
  });

  document.addEventListener('keydown', handleEscapeKeyForInterpretModal);

  if (!isRegeneration) {
    let pageContent = '';
    try {
      const article = new Readability(document.cloneNode(true)).parse();
      pageContent = article ? article.textContent : document.body.innerText;
    } catch (e) {
      console.warn('[PageTalk] Readability failed for interpret, falling back to body text.', e);
      pageContent = document.body.innerText;
    }

    try {
      const article = new Readability(document.cloneNode(true)).parse();
      pageContent = article ? article.textContent : document.body.innerText;
    } catch (e) {
      console.warn('[PageTalk] Readability failed for interpret, falling back to body text.', e);
      pageContent = document.body.innerText;
    }

    // Fetch settings from the passed optionConfig if provided (for dynamic actions)
    // or use defaults from storage for hardcoded 'interpretText' if optionConfig is null.
    const getSettingsAndSend = (optionConf) => {
        chrome.storage.sync.get('selectionAssistantSettings', (res) => {
            const settingsFromStorage = res.selectionAssistantSettings;
            let finalModel, finalPrompt, finalTemperature;

            if (optionConf && optionConf.type !== 'chat') { // Use config from the clicked button
                finalModel = optionConf.model;
                finalPrompt = optionConf.prompt;
                finalTemperature = optionConf.temperature;
            } else { // Fallback for direct calls or if issue with optionConf
                const interpretSettings = settingsFromStorage?.interpret || {
                    model: "gemini-1.5-flash-preview-0514",
                    prompt: getI18nMessage('defaultInterpretPrompt', "请根据以下页面内容，解读选中的文本："),
                    temperature: 0.7
                };
                finalModel = interpretSettings.model;
                finalPrompt = interpretSettings.prompt;
                finalTemperature = interpretSettings.temperature;
            }

            lastInterpretationRequest = {
                selectedText: selectedText,
                pageContent: pageContent.substring(0, 200000),
                prompt: finalPrompt,
                model: finalModel,
                temperature: finalTemperature,
                optionId: optionConf ? optionConf.id : 'default_interpret' // Track which option triggered this
            };
            chrome.runtime.sendMessage({ action: "interpretText", ...lastInterpretationRequest });
        });
    };

    getSettingsAndSend(optionConfig);
  }
}

function hideInterpretModal() {
  if (interpretModalElement) {
    interpretModalElement.classList.remove('visible');
    document.removeEventListener('keydown', handleEscapeKeyForInterpretModal);
    // UI cleanup will remove the element from DOM if needed
  }
}

function handleEscapeKeyForInterpretModal(event) {
  if (event.key === 'Escape') hideInterpretModal();
}

function handleInterpretAction(selectedText, optionConfig = null) {
  // optionConfig is the specific configuration from the clicked button
  showInterpretModal(selectedText, false, optionConfig);
}

// --- Translate Modal Logic ---

function createTranslateModalHTML() { // Remains largely the same, modal content is generic
  const modal = document.createElement('div');
  modal.id = PAGETALK_TRANSLATE_MODAL_ID;
  if (currentDetectedTheme === 'dark') {
    modal.classList.add('pagetalk-dark-mode');
  }

  // Header
  const header = document.createElement('div');
  header.id = 'pagetalk-translate-modal-header'; // Use specific ID if CSS targets it, else generic class
  const title = document.createElement('span');
  title.id = 'pagetalk-translate-modal-title';
  title.textContent = getI18nMessage('translateModalTitle', '翻译文本'); // "Translate Text"
  const closeButton = document.createElement('span');
  closeButton.id = 'pagetalk-translate-modal-close';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => hideTranslateModal();
  header.appendChild(title);
  header.appendChild(closeButton);
  modal.appendChild(header);

  // Content
  const content = document.createElement('div');
  content.id = 'pagetalk-translate-modal-content';
  content.innerHTML = `<div class="loading-indicator">${getI18nMessage('loading', 'Loading...')}</div>`;
  modal.appendChild(content);

  // Footer
  const footer = document.createElement('div');
  footer.id = 'pagetalk-translate-modal-footer';
  const copyButton = document.createElement('button');
  copyButton.className = 'copy-button';
  copyButton.textContent = getI18nMessage('copy', 'Copy');
  copyButton.onclick = () => {
    const responseText = modal.querySelector('#pagetalk-translate-modal-content').innerText;
    navigator.clipboard.writeText(responseText.replace(/\n\nLoading\.\.\.$/, ''))
      .then(() => {
        copyButton.textContent = getI18nMessage('copied', 'Copied!');
        setTimeout(() => copyButton.textContent = getI18nMessage('copy', 'Copy'), 2000);
      })
      .catch(err => console.error('[PageTalk] Failed to copy translated text:', err));
  };
  const regenerateButton = document.createElement('button');
  regenerateButton.className = 'regenerate-button';
  regenerateButton.textContent = getI18nMessage('regenerate', 'Regenerate');
  regenerateButton.onclick = () => {
    if (lastTranslationRequest) {
      showTranslateModal(lastTranslationRequest.selectedText, true);
      chrome.runtime.sendMessage({
        ...lastTranslationRequest, // Contains model, temp, promptKey etc.
        action: "translateText",
      });
    }
  };
  footer.appendChild(regenerateButton);
  footer.appendChild(copyButton);
  modal.appendChild(footer);

  return modal;
}

function showTranslateModal(selectedText, isRegeneration = false, optionConfig = null) {
  if (interpretModalElement) hideInterpretModal();
  if (chatModalElement) hideChatModal(); // Hide chat modal too

  if (!translateModalElement || !document.body.contains(translateModalElement)) {
    translateModalElement = createTranslateModalHTML();
    document.body.appendChild(translateModalElement);
  }

  if (currentDetectedTheme === 'dark') {
    translateModalElement.classList.add('pagetalk-dark-mode');
  } else {
    translateModalElement.classList.remove('pagetalk-dark-mode');
  }

  const contentDiv = translateModalElement.querySelector('#pagetalk-translate-modal-content');
  contentDiv.innerHTML = `<div class="loading-indicator">${getI18nMessage('loading', 'Loading...')}</div>`;
  translateModalElement.querySelector('.copy-button').textContent = getI18nMessage('copy', 'Copy');

  requestAnimationFrame(() => {
    translateModalElement.classList.add('visible');
  });

  document.addEventListener('keydown', handleEscapeKeyForTranslateModal);

  if (!isRegeneration) {
    let pageContent = ''; // Context might be less critical for simple translation but good to have
    try {
      const article = new Readability(document.cloneNode(true)).parse();
      pageContent = article ? article.textContent : document.body.innerText;
    } catch (e) {
      console.warn('[PageTalk] Readability failed for translate, falling back to body text.', e);
      pageContent = document.body.innerText;
    }

    try {
      const article = new Readability(document.cloneNode(true)).parse();
      pageContent = article ? article.textContent : document.body.innerText;
    } catch (e) {
      console.warn('[PageTalk] Readability failed for translate, falling back to body text.', e);
      pageContent = document.body.innerText;
    }

    const getSettingsAndSend = (optionConf) => {
        chrome.storage.sync.get('selectionAssistantSettings', (res) => {
            const settingsFromStorage = res.selectionAssistantSettings;
            let finalModel, finalPrompt, finalTemperature;

            if (optionConf && optionConf.type !== 'chat') {
                finalModel = optionConf.model;
                finalPrompt = optionConf.prompt;
                finalTemperature = optionConf.temperature;
            } else {
                const translateSettings = settingsFromStorage?.translate || { // Fallback to 'translate' key if direct call
                    model: "gemini-1.5-flash-preview-0514",
                    prompt: getI18nMessage('defaultTranslatePrompt', "请将以下选中的文本在中文和英文之间互译："),
                    temperature: 0.2
                };
                finalModel = translateSettings.model;
                finalPrompt = translateSettings.prompt;
                finalTemperature = translateSettings.temperature;
            }

            lastTranslationRequest = {
                selectedText: selectedText,
                pageContent: pageContent.substring(0, 100000),
                prompt: finalPrompt,
                model: finalModel,
                temperature: finalTemperature,
                optionId: optionConf ? optionConf.id : 'default_translate'
            };
            chrome.runtime.sendMessage({ action: "translateText", ...lastTranslationRequest });
        });
    };
    getSettingsAndSend(optionConfig);
  }
}

function hideTranslateModal() {
  if (translateModalElement) {
    translateModalElement.classList.remove('visible');
    document.removeEventListener('keydown', handleEscapeKeyForTranslateModal);
  }
}

function handleEscapeKeyForTranslateModal(event) {
  if (event.key === 'Escape') hideTranslateModal();
}

function handleTranslateAction(selectedText, optionConfig = null) {
  showTranslateModal(selectedText, false, optionConfig);
}

// --- Chat Modal Logic ---

function createChatModalHTML() { // Remains largely the same
  const modal = document.createElement('div');
  modal.id = PAGETALK_CHAT_MODAL_ID;
  if (currentDetectedTheme === 'dark') modal.classList.add('pagetalk-dark-mode');

  // Header
  const header = document.createElement('div');
  header.id = 'pagetalk-chat-modal-header';

  const title = document.createElement('span'); // Simple title for now
  title.id = 'pagetalk-chat-modal-title';
  title.textContent = getI18nMessage('chatModalTitle', '对话'); // "Chat"

  // Placeholder Dropdowns & Clear button
  const modelDropdown = document.createElement('span');
  modelDropdown.className = 'dropdown-placeholder';
  modelDropdown.textContent = 'Model: Gemini'; // Placeholder
  const assistantDropdown = document.createElement('span');
  assistantDropdown.className = 'dropdown-placeholder';
  assistantDropdown.textContent = 'Assistant: General'; // Placeholder
  const clearContextButton = document.createElement('span');
  clearContextButton.className = 'button-placeholder';
  clearContextButton.textContent = getI18nMessage('clearContext', 'Clear');
  // clearContextButton.onclick = () => handleClearChatContext(); // Add later

  const closeButton = document.createElement('span');
  closeButton.id = 'pagetalk-chat-modal-close';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => hideChatModal();

  header.appendChild(modelDropdown); // Add dropdowns if layout allows
  header.appendChild(assistantDropdown);
  header.appendChild(clearContextButton);
  header.appendChild(document.createTextNode("\u00A0")); // Spacer
  header.appendChild(title); // Title can be here or take full width if dropdowns are elsewhere
  header.appendChild(document.createTextNode("\u00A0")); // Spacer
  header.appendChild(closeButton);
  modal.appendChild(header);

  // Quoted Text Area
  chatQuotedTextElement = document.createElement('div');
  chatQuotedTextElement.id = 'pagetalk-chat-quoted-text';
  modal.appendChild(chatQuotedTextElement);

  // Chat Messages Area
  chatMessagesContainer = document.createElement('div');
  chatMessagesContainer.id = 'pagetalk-chat-messages';
  modal.appendChild(chatMessagesContainer);

  // Input Area
  const inputArea = document.createElement('div');
  inputArea.id = 'pagetalk-chat-input-area';
  chatInputField = document.createElement('textarea');
  chatInputField.id = 'pagetalk-chat-input';
  chatInputField.placeholder = getI18nMessage('chatInputPlaceholder', '输入消息...'); // "Type a message..."
  chatInputField.rows = 1; // Start with 1 row, auto-adjust height later if needed
  // chatInputField.oninput = () => autoAdjustTextareaHeight(chatInputField); // Add later for auto-height

  chatSendButton = document.createElement('button');
  chatSendButton.id = 'pagetalk-chat-send-button';
  chatSendButton.textContent = getI18nMessage('send', 'Send');
  // chatSendButton.onclick = () => handleSendChatMessage(); // Add later

  inputArea.appendChild(chatInputField);
  inputArea.appendChild(chatSendButton);
  modal.appendChild(inputArea);

  return modal;
}

function showChatModal(selectedText) { // Chat modal doesn't take optionConfig as it uses main panel settings
  if (interpretModalElement) hideInterpretModal();
  if (translateModalElement) hideTranslateModal();

  if (!chatModalElement || !document.body.contains(chatModalElement)) {
    chatModalElement = createChatModalHTML();
    document.body.appendChild(chatModalElement);
  }

  currentChatSelectedText = selectedText; // Store for use in messages

  if (currentDetectedTheme === 'dark') {
    chatModalElement.classList.add('pagetalk-dark-mode');
  } else {
    chatModalElement.classList.remove('pagetalk-dark-mode');
  }

  if (chatQuotedTextElement) {
    if (selectedText && selectedText.trim().length > 0) {
      chatQuotedTextElement.textContent = selectedText;
      chatQuotedTextElement.classList.add('visible');
    } else {
      chatQuotedTextElement.classList.remove('visible');
      chatQuotedTextElement.textContent = '';
    }
  }

  // Clear previous messages if any
  if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';

  requestAnimationFrame(() => {
    chatModalElement.classList.add('visible');
    if (chatInputField) chatInputField.focus();
  });

  document.addEventListener('keydown', handleEscapeKeyForChatModal);

  // Extract page content for context
  try {
    const article = new Readability(document.cloneNode(true)).parse();
    pageContentForChat = article ? article.textContent : document.body.innerText;
    pageContentForChat = pageContentForChat.substring(0, 50000); // Limit context
  } catch(e) {
    console.warn("[PageTalk] Readability failed for chat context:", e);
    pageContentForChat = document.body.innerText.substring(0, 50000);
  }
  console.log("[PageTalk] Page context for chat (first 100 chars):", pageContentForChat.substring(0,100));
}

function hideChatModal() {
  if (chatModalElement) {
    chatModalElement.classList.remove('visible');
    document.removeEventListener('keydown', handleEscapeKeyForChatModal);
    // Consider clearing currentChatSelectedText or messages if modal is hidden
    // currentChatSelectedText = '';
    // if(chatMessagesContainer) chatMessagesContainer.innerHTML = '';
    // if(chatQuotedTextElement) chatQuotedTextElement.classList.remove('visible');
  }
}

function handleEscapeKeyForChatModal(event) {
  if (event.key === 'Escape') hideChatModal();
}

function handleChatAction(selectedText, optionConfig = null) { // optionConfig might be passed but chat ignores its model/prompt/temp
  // If chat modal is already visible and a new selection is made for chat, update the quoted text.
  // This also re-grabs page context if modal is re-focused with new selection.
  if (chatModalElement && chatModalElement.classList.contains('visible') && currentChatSelectedText !== selectedText) {
    currentChatSelectedText = selectedText;
    if (chatQuotedTextElement) {
      if (selectedText && selectedText.trim().length > 0) {
        chatQuotedTextElement.textContent = selectedText;
        chatQuotedTextElement.classList.add('visible');
      } else {
        chatQuotedTextElement.classList.remove('visible');
        chatQuotedTextElement.textContent = '';
      }
    }
    // Re-fetch page content as context might have changed or it's a new interaction point
    try {
      const article = new Readability(document.cloneNode(true)).parse();
      pageContentForChat = article ? article.textContent : document.body.innerText;
      pageContentForChat = pageContentForChat.substring(0, 50000);
    } catch(e) {
      console.warn("[PageTalk] Readability failed for chat context update:", e);
      pageContentForChat = document.body.innerText.substring(0, 50000);
    }
    console.log("[PageTalk] Updated page context for chat (first 100 chars):", pageContentForChat.substring(0,100));

    if (chatInputField) chatInputField.focus();
  } else if (!chatModalElement || !chatModalElement.classList.contains('visible')) {
    // Only show if not already visible. If visible and same text, do nothing.
    showChatModal(selectedText);
  }
}

// --- Chat Modal Logic - Part 2 (Messaging) ---

function addMessageToChat(text, sender, options = {}) {
  if (!chatMessagesContainer) return;

  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble', sender);

  if (options.isLoading) {
    bubble.classList.add('loading');
    bubble.textContent = text || getI18nMessage('aiThinking', 'AI is thinking...');
  } else {
    // For non-loading messages, sanitize text before setting as innerText or create text nodes.
    // Using innerText is generally safer against XSS if the text isn't meant to be HTML.
    // If HTML (e.g. from Markdown conversion) is needed, a sanitizer function would be required.
    bubble.innerText = text; // For now, assume plain text from AI and user
  }

  if (sender === 'user' && options.isQuoted && currentChatSelectedText) {
    const quotedDiv = document.createElement('div');
    quotedDiv.className = 'quoted-in-bubble';
    quotedDiv.innerText = currentChatSelectedText.substring(0, 100) + (currentChatSelectedText.length > 100 ? '...' : ''); // Show snippet
    bubble.prepend(quotedDiv); // Add quote before the user's message text
  }

  // Placeholder for action buttons (copy, regenerate, delete)
  // These would be added to the bubble here.

  chatMessagesContainer.appendChild(bubble);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Scroll to bottom

  return bubble; // Return the bubble element if it needs to be manipulated (e.g., remove loading)
}

function handleSendChatMessage() {
  if (!chatInputField || !chatSendButton) return;
  const inputText = chatInputField.value.trim();
  if (inputText === '') return;

  const isQuotedMessage = chatQuotedTextElement && chatQuotedTextElement.classList.contains('visible');
  addMessageToChat(inputText, 'user', { isQuoted: isQuotedMessage });

  if (isQuotedMessage && chatQuotedTextElement) {
    chatQuotedTextElement.classList.remove('visible');
    // currentChatSelectedText remains for this exchange, but visual quote is removed
  }

  chatInputField.value = '';
  chatInputField.style.height = 'auto'; // Reset height after sending
  chatInputField.focus();

  // Show loading indicator for AI response
  const loadingBubble = addMessageToChat('', 'ai', { isLoading: true });

  // Send message to background
  chrome.runtime.sendMessage({
    action: "sendChatMessage",
    textInput: inputText,
    selectedTextContext: isQuotedMessage ? currentChatSelectedText : null,
    pageContent: pageContentForChat,
    // Chat model/assistant settings are typically synced with the main panel,
    // so not fetched from selectionAssistantSettings here.
    // Using placeholders or values from main panel state if available.
    model: "gemini-1.5-flash-preview-0514", // Placeholder, ideally from main panel state
    assistant: "general", // Placeholder
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[PageTalk] Error sending chat message to background:', chrome.runtime.lastError.message);
      if (loadingBubble) loadingBubble.remove(); // Remove loading if send failed
      addMessageToChat(getI18nMessage('chatSendError', 'Error sending message.'), 'ai', {isError: true});
    } else {
      console.log('[PageTalk] Chat message sent to background, awaiting AI response.', response);
    }
  });
}

function handleClearChatContext() {
  if (chatMessagesContainer) {
    chatMessagesContainer.innerHTML = ''; // Clear all messages
  }
  if (chatQuotedTextElement && currentChatSelectedText) {
    // Restore the original selected text quote if it existed
    chatQuotedTextElement.textContent = currentChatSelectedText;
    chatQuotedTextElement.classList.add('visible');
  } else if (chatQuotedTextElement) {
    chatQuotedTextElement.classList.remove('visible');
    chatQuotedTextElement.textContent = '';
  }
  // Optionally, send message to background to clear server-side context
  // chrome.runtime.sendMessage({ action: "clearChatContextOnServer" });
  if (chatInputField) chatInputField.focus();
  console.log('[PageTalk] Chat context cleared.');
}


// Attach listeners in createChatModalHTML or ensure elements exist
// Modifying createChatModalHTML to attach these
const originalCreateChatModalHTML = createChatModalHTML;
createChatModalHTML = function() {
  const modal = originalCreateChatModalHTML.call(this); // Call the original function

  // Ensure chatInputField and chatSendButton are globally available after modal creation
  // The original createChatModalHTML already assigns to global vars:
  // chatQuotedTextElement, chatMessagesContainer, chatInputField, chatSendButton

  if (chatSendButton) {
    chatSendButton.onclick = handleSendChatMessage;
  }

  const clearContextButtonInModal = modal.querySelector('.button-placeholder'); // Assuming it's the one
  if (clearContextButtonInModal && clearContextButtonInModal.textContent === getI18nMessage('clearContext', 'Clear')) {
     clearContextButtonInModal.onclick = handleClearChatContext;
  }

  // Auto-adjust textarea height
  if (chatInputField) {
    chatInputField.addEventListener('input', () => {
      chatInputField.style.height = 'auto';
      chatInputField.style.height = (chatInputField.scrollHeight) + 'px';
    });
    // Send on Enter, new line with Shift+Enter
    chatInputField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendChatMessage();
      }
    });
  }
  return modal;
};


// Update currentDetectedTheme when theme changes
const originalDetectAndSendThemeForAllUI = detectAndSendTheme;
detectAndSendTheme = function() {
  originalDetectAndSendThemeForAllUI();
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  let newTheme = 'light';

  if (htmlEl.getAttribute('data-color-mode')?.toLowerCase().includes('dark') ||
      htmlEl.getAttribute('data-theme')?.toLowerCase().includes('dark') ||
      bodyEl.classList.contains('dark-mode') ||
      bodyEl.classList.contains('theme-dark') ||
      bodyEl.classList.contains('dark')) {
    newTheme = 'dark';
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches &&
             !htmlEl.getAttribute('data-color-mode') &&
             !htmlEl.getAttribute('data-theme') &&
             !(bodyEl.classList.contains('light-mode') ||
               bodyEl.classList.contains('theme-light') ||
               bodyEl.classList.contains('light'))) {
    newTheme = 'dark';
  }
  currentDetectedTheme = newTheme;

  [optionsBarElement, interpretModalElement, translateModalElement].forEach(el => {
    if (el && el.classList.contains('visible')) {
      if (currentDetectedTheme === 'dark') {
        el.classList.add('pagetalk-dark-mode');
      } else {
        el.classList.remove('pagetalk-dark-mode');
      }
    }
  });
};

// Modify modal creation functions to use makeElementDraggable and makeElementResizable
const originalCreateInterpretModalHTML = createInterpretModalHTML;
createInterpretModalHTML = function() {
  const modal = originalCreateInterpretModalHTML.call(this);
  const header = modal.querySelector('#pagetalk-interpret-modal-header');
  if (header) makeElementDraggable(modal, header);

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'modal-resize-handle';
  modal.appendChild(resizeHandle);
  makeElementResizable(modal, resizeHandle);

  return modal;
}

const originalCreateTranslateModalHTML = createTranslateModalHTML;
createTranslateModalHTML = function() {
  const modal = originalCreateTranslateModalHTML.call(this);
  const header = modal.querySelector('#pagetalk-translate-modal-header');
  if (header) makeElementDraggable(modal, header);

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'modal-resize-handle';
  modal.appendChild(resizeHandle);
  makeElementResizable(modal, resizeHandle);

  return modal;
}

const originalCreateChatModalHTMLForDragAndResize = createChatModalHTML;
createChatModalHTML = function() {
  const modal = originalCreateChatModalHTMLForDragAndResize.call(this);
  const header = modal.querySelector('#pagetalk-chat-modal-header');
  if (header) makeElementDraggable(modal, header);

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'modal-resize-handle';
  modal.appendChild(resizeHandle);
  // For chat modal, min width/height might be different
  makeElementResizable(modal, resizeHandle, 300, 250);

  return modal;
}


// Consolidated Listener for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let responseSent = false; // Flag to ensure sendResponse is called only once per message
  if (message.action === "interpretTextResponse") {
    if (interpretModalElement && interpretModalElement.classList.contains('visible')) {
      const contentDiv = interpretModalElement.querySelector('#pagetalk-interpret-modal-content');
      if (message.error) {
        contentDiv.innerHTML = `<div class="error-message">${getI18nMessage('errorPrefix', 'Error')}: ${message.error}</div>`;
      } else {
        contentDiv.innerText = message.interpretation;
      }
    }
    sendResponse({ received: true });
    responseSent = true;
  }
  else if (message.action === "translateTextResponse") {
    if (translateModalElement && translateModalElement.classList.contains('visible')) {
      const contentDiv = translateModalElement.querySelector('#pagetalk-translate-modal-content');
      if (message.error) {
        contentDiv.innerHTML = `<div class="error-message">${getI18nMessage('errorPrefix', 'Error')}: ${message.error}</div>`;
      } else {
        contentDiv.innerText = message.translation;
      }
    }
    sendResponse({ received: true });
    responseSent = true;
  }

  // IMPORTANT: If this listener is intended to replace the one that handles 'togglePanel' etc.
  // those message handlers need to be merged here.
  // For now, assuming this is an additional listener or the other one is removed/refactored.
  // Based on previous step, it seems this is the *only* content script runtime.onMessage listener.
  // So, any other actions like 'getFullPageContentRequest' for panel should be here too.
  // The original listener for 'requestTheme' and 'getFullPageContentRequest' (from panel) and 'togglePanel' needs to be merged.
  // This is becoming complex. For this subtask, I am focusing only on adding the new responses.
  // A full merge would be:
  // if (message.action === "togglePanel") { ...; sendResponse(...); responseSent = true; }
  // else if (message.action === "requestTheme") { ...; sendResponse(...); responseSent = true; }
  // ... etc.

  if (responseSent) {
    return true; // Indicate async response if we actually handled it and sent one
  }
  // If no action matched that sends a response, and it's not an async action from this listener,
  // it might need to return false or nothing, depending on whether other listeners are expected to fire.
  // Given the consolidation, this listener should handle all relevant messages.
  // Returning true by default if any path could be async.
  // However, specific return true/false per branch is better if possible.
  // For now, if a response was sent, return true. Otherwise, let it be.
  // This might cause "message port closed before a response was received" if not handled carefully for ALL actions.
  // For this specific subtask, we only care about 'interpretTextResponse' and 'translateTextResponse'.
  return responseSent; // Will be true if one of the above blocks executed sendResponse.
});