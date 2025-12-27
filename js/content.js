/**
 * Pagetalk 内容脚本
 * 用于从网页中提取内容并与面板通信
 */

// 防止重复初始化
if (window.contentScriptInitialized) {
    console.log('[Content] Already initialized, skipping...');
} else {
    window.contentScriptInitialized = true;

// 全局变量，跟踪面板状态
let panelActive = window.panelActive || false;
let panelWidth = 520; // 默认宽度
let minPanelWidth = 280; // 新增最小宽度限制
let maxPanelWidthPercentage = 0.8; // 最大宽度为窗口的80%
let resizing = false;
let messageShownForThisPageView = false; // 新增：跟踪当前页面视图是否已显示过提取成功消息

// 划词助手相关变量
let textSelectionHelperLoaded = false;

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


// 初始化划词助手
function initTextSelectionHelper() {
  if (textSelectionHelperLoaded) return;

  // 直接初始化划词助手（现在通过 content script 加载）
  if (window.TextSelectionHelper) {
    window.TextSelectionHelper.init();
    textSelectionHelperLoaded = true;
    console.log('[PageTalk] Text Selection Helper initialized');
  } else {
    console.warn('[PageTalk] TextSelectionHelper not available');
  }
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

    // Defensively re-apply essential styles
    panel.style.position = 'fixed';
    panel.style.top = '0px';
    panel.style.right = '0px';
    panel.style.height = '100vh';

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
  console.log('[Content] Received message:', message.action);

  // 响应ping请求（用于检查content script是否活跃）
  if (message.action === "ping") {
    sendResponse && sendResponse({ success: true, alive: true });
    return true;
  }
  // 主动响应主题请求
  else if (message.action === "requestTheme") {
    detectAndSendTheme();
    sendResponse && sendResponse({ success: true });
    return true;
  }
  // 修改：处理来自 background.js 的内容提取请求
  else if (message.action === "getFullPageContentRequest") {
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
    // 检查必要的库是否可用
    const librariesAvailable = checkLibrariesAvailability();
    if (!librariesAvailable.allAvailable) {
      console.warn('[Content] Some libraries missing when toggling panel:', librariesAvailable.missing);
      sendResponse({
        success: false,
        error: 'Required libraries not available',
        missing: librariesAvailable.missing
      });
      return true;
    }

    // 初始化面板（如果尚未初始化）
    initPagetalkPanel();

    // 切换面板显示
    togglePanel();
    sendResponse({ success: true, panelActive });
    return true; // 这是异步的，尽管 togglePanel 本身不是
  }
  // 处理来自background.js的流式更新消息（用于划词助手）
  else if (message.action === "streamUpdate") {
    // 直接转发给划词助手的监听器
    // 这个消息会被text-selection-helper.js中的监听器接收
    // 不需要sendResponse，因为这是单向消息
    return false; // 不需要异步响应
  }
  // 处理主面板ping请求
  else if (message.action === "pingMainPanel") {
    // 检查主面板是否存在
    const iframe = document.getElementById('pagetalk-panel-iframe');
    const hasMainPanel = iframe && iframe.contentWindow && panelActive;
    console.log('[Content] Main panel ping check:', { iframe: !!iframe, contentWindow: !!iframe?.contentWindow, panelActive, hasMainPanel });
    sendResponse({ hasMainPanel: hasMainPanel });
    return true;
  }
  // 处理来自background的API调用转发请求
  else if (message.action === "callUnifiedAPIFromBackground") {
    // 转发到主面板iframe
    const iframe = document.getElementById('pagetalk-panel-iframe');
    if (iframe && iframe.contentWindow && panelActive) {
      iframe.contentWindow.postMessage({
        action: 'callUnifiedAPIFromBackground',
        model: message.model,
        messages: message.messages,
        options: message.options
      }, '*');

      // 监听主面板的响应
      const responseHandler = (event) => {
        if (event.data && event.data.action === 'unifiedAPIResponse') {
          window.removeEventListener('message', responseHandler);
          sendResponse(event.data);
        }
      };
      window.addEventListener('message', responseHandler);

      // 设置超时
      setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        sendResponse({ success: false, error: 'API call timeout' });
      }, 30000);

      return true; // 异步响应
    } else {
      sendResponse({ success: false, error: 'Main panel not available' });
      return true;
    }
  }
  // 处理代理自动清除通知
  else if (message.action === "proxyAutoCleared") {
    console.log('[Content] Proxy auto-cleared notification received:', message.failedProxy);
    // 通知主面板代理已被自动清除
    const iframe = document.getElementById('pagetalk-panel-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        action: 'proxyAutoCleared',
        failedProxy: message.failedProxy
      }, '*');
    }
    return false; // 不需要异步响应
  }
  // 实时同步机制 - 处理来自background的广播消息
  else if (message.action === 'storageChanged') {
    // 通用存储变化处理
    console.log('[Content] Storage changed:', message.changes);
    return false;
  }
  else if (message.action === 'languageChanged') {
    console.log('[Content] Language changed from', message.oldLanguage, 'to', message.newLanguage);
    handleLanguageChangeInContent(message.newLanguage);
    return false;
  }
  else if (message.action === 'textSelectionHelperSettingsChanged') {
    console.log('[Content] Text selection helper settings changed');
    handleTextSelectionHelperSettingsChange(message.newSettings);
    return false;
  }
  else if (message.action === 'extensionReloaded') {
    console.log('[Content] Extension reloaded - reinitializing');
    handleExtensionReload();
    return false;
  }
  // 处理模型更新事件
  else if (message.action === 'modelsUpdated') {
    console.log('[Content] Models updated - forwarding to main panel');
    // 转发模型更新事件到主面板
    const iframe = document.getElementById('pagetalk-panel-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        action: 'modelsUpdated'
      }, '*');
    }
    return false;
  }

  // 确保为其他可能的消息处理器也返回 true（如果它们是异步的）
  // 如果没有其他异步处理器，可以在这里返回 false 或 undefined
  // 为了保险起见，如果这个 listener 包含任何异步操作，最好总是返回 true
  return true;
});

// 页面加载完成后初始化划词助手
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTextSelectionHelper);
} else {
  initTextSelectionHelper();
}

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
        const currentLang = localStorage.getItem('language') || 'zh-CN';
        const errorMessage = trContent('pdfLibraryInitFailed') || 'PDF.js library failed to initialize.';
        throw new Error(errorMessage);
      }

      // 通过background.js获取PDF文件（支持代理）
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'fetchWithProxy',
          url: currentUrl,
          options: { method: 'GET' }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.success) {
            resolve(response);
          } else {
            const currentLang = localStorage.getItem('language') || 'zh-CN';
            const errorMessage = trContent('pdfFetchFailed') || 'Failed to fetch PDF';
            reject(new Error(response.error || errorMessage));
          }
        });
      });

      if (!response.success) {
        const currentLang = localStorage.getItem('language') || 'zh-CN';
        const errorTemplate = trContent('pdfFetchFailedWithError') || 'Failed to fetch PDF: {error}';
        const errorMessage = errorTemplate.replace('{error}', response.error);
        throw new Error(errorMessage);
      }
      // 将base64数据转换为ArrayBuffer
      const base64Data = response.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfData = bytes.buffer;
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
        const truncatedSuffix = trContent('contentTruncated') || '...(Content truncated)';
        fullText = fullText.substring(0, maxLength) + truncatedSuffix;
      }
      return fullText.trim();
    } catch (pdfError) {
      console.warn('[PageTalk] PDF fetch/parse error for direct PDF:', pdfError);
      // 如果 fetch/parse 失败，但 DOM 结构像是 PDF.js viewer，尝试从 DOM 提取
      if (isPdfJsViewerDom) {
        console.log('[PageTalk] Falling back to DOM extraction for direct PDF (e.g. arXiv).');
        return extractFromPdfJsDom(); // 尝试从DOM中提取
      }
      // 如果 DOM 提取方式不适用或失败，最终回退到基础正文
      console.warn('[PageTalk] Falling back to simple body text for direct PDF after fetch/parse error.');
      const errorTemplate = trContent('pdfProcessingError') || 'Error processing PDF: {error}';
      const errorMessage = errorTemplate.replace('{error}', pdfError.message);
      const bodyText = (document.body && (document.body.innerText || document.body.textContent)) ? (document.body.innerText || document.body.textContent) : '';
      const merged = `${errorMessage}\n\n${(bodyText || '').trim()}`;
      const maxLength = 500000;
      return merged.length > maxLength ? merged.slice(0, maxLength) + (trContent('contentTruncated') || '...(Content truncated)') : merged;
    }
  } else if (isPdfJsViewerDom) {
    // 如果不是直接的 PDF 链接，但页面 DOM 结构像是 PDF.js 渲染的
    console.log('[PageTalk] Embedded PDF.js viewer detected. Attempting DOM extraction.');
    return extractFromPdfJsDom();
  } else {
    // 对于普通 HTML 页面，仅使用 Turndown（带去噪）
    console.log('[PageTalk] Standard HTML page. Using Turndown-only extraction with denoising.');
    try {
      const content = extractComprehensivePageContent();
      if (content && content.trim().length > 0) return content;
    } catch (e) {
      console.warn('[PageTalk] Turndown extraction failed, falling back to simple body text:', e);
    }
    const text = (document.body && (document.body.innerText || document.body.textContent)) ? (document.body.innerText || document.body.textContent) : '';
    const maxLength = 300000;
    const out = (text || '').replace(/\s+/g, ' ').trim();
    return out.length > maxLength ? out.slice(0, maxLength) + (trContent('contentTruncated') || '...(Content truncated)') : out;
  }
}

/**
 * 翻译助手函数（优先使用统一 I18n，再回退到 window.translations）
 */
function trContent(key, replacements = {}) {
  try {
    if (window.I18n && typeof window.I18n.tr === 'function') {
      return window.I18n.tr(key, replacements);
    }
  } catch (_) { /* ignore */ }
  const currentLang = localStorage.getItem('language') || 'zh-CN';
  let text = window.translations?.[currentLang]?.[key] || window.translations?.['zh-CN']?.[key] || ''; // legacy fallback inside trContent
  if (!text) return '';
  for (const ph in replacements) {
    text = text.replace(`{${ph}}`, replacements[ph]);
  }
  return text;
}

/**
 * 从 Readability.js 提取内容 (同步函数)
 * @returns {string}
 */
function extractWithReadability() {
  try {
    if (typeof Readability === 'undefined') {
      console.error('[PageTalk] Readability library not loaded.');
      const currentLang = localStorage.getItem('language') || 'zh-CN';
      return trContent('readabilityNotLoaded') || '错误：无法加载页面内容提取库。';
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
        const currentLang = localStorage.getItem('language') || 'zh-CN';
        return trContent('unableToExtractContent') || 'Unable to extract page content.';
      }
      const currentLang = localStorage.getItem('language') || 'zh-CN';
      const fallbackPrefix = trContent('fallbackToBodyText') || '(Fallback to body text) ';
      content = fallbackPrefix + content; // 标记为后备提取
    }
    const maxLength = 500000; // 限制最大长度
    if (content.length > maxLength) {
      const truncatedSuffix = trContent('contentTruncated') || '...(Content truncated)';
      content = content.substring(0, maxLength) + truncatedSuffix;
    }
    return content;

  } catch (error) {
    console.error('[PageTalk] Error extracting page content with Readability:', error);
    const currentLang = localStorage.getItem('language') || 'zh-CN';
    const errorTemplate = trContent('extractionError') || '提取页面内容时出错: {error}';
    return errorTemplate.replace('{error}', error.message);
  }
}

// 页面内容提取：并行正文与全量，择优合并
function extractComprehensivePageContent() {
  const parts = [];

  // 1) 标题与元信息
  try {
    const title = (document.querySelector('title')?.innerText || '').trim();
    if (title) parts.push(`# ${title}`);

    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')
      || document.querySelector('meta[property="og:description"]')?.getAttribute('content')
      || document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')
      || '';
    if (metaDesc && metaDesc.trim()) {
      parts.push(metaDesc.trim());
    }
  } catch (_) { /* ignore */ }

  // 2) Turndown 仅对清理后的 DOM
  let domMarkdown = '';
  try {
    const td = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
    // 基础剔除
    td.remove(['script', 'style', 'noscript']);

    // 导航/页眉/页脚中的链接仅保留文本（不带 URL），减少噪音
    td.addRule('navLinksAsText', {
      filter: function (node) {
        if (!node || node.nodeName !== 'A') return false;
        try { return isInNavLike(node); } catch (_) { return false; }
      },
      replacement: function (content, node) {
        const t = (node.textContent || '').trim();
        return t;
      }
    });

    // 剔除疑似站点脚本的代码块
    td.addRule('stripSiteInitScripts', {
      filter: function (node) {
        try {
          if (!node) return false;
          const tag = node.nodeName;
          if (tag === 'PRE' || tag === 'CODE') {
            const t = (node.textContent || '').trim();
            return isLikelySiteScript(t, node);
          }
          return false;
        } catch (_) { return false; }
      },
      replacement: function () { return ''; }
    });

    // 仅取主内容容器作为根，进行克隆与去噪
    const domCleaned = cloneAndPruneRootForConversion(pickMainRootNode());
    domMarkdown = td.turndown(domCleaned) || '';
  } catch (e1) {
    domMarkdown = (document.body && document.body.innerText) ? document.body.innerText : '';
  }

  // 3) 段落级去重与空白压缩
  domMarkdown = dedupeMarkdownParagraphs(domMarkdown);

  // 4) 仅解析 JSON-LD（内嵌结构化数据）
  try {
    const embeddedText = extractEmbeddedJsonText();
    if (embeddedText && embeddedText.trim()) {
      parts.push('---');
      parts.push(embeddedText.trim());
    }
  } catch (_) { /* ignore */ }

  // 5) 拼装与总长度限制（宽松软上限）
  parts.unshift(domMarkdown.trim());
  let full = parts.filter(Boolean).join('\n\n');
  const maxLength = 300000; // 30 万字符软上限
  if (full.length > maxLength) {
    const truncatedSuffix = trContent('contentTruncated') || '...(Content truncated)';
    full = full.substring(0, maxLength) + truncatedSuffix;
  }
  return full;
}

// 选择主内容容器
function pickMainRootNode() {
  const candidates = [
    'main',
    '[role="main"]',
    'article',
    '#content',
    '.content',
    '#main-content',
    '.markdown-body',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return document.body || document.documentElement;
}

// 导航/页眉/页脚等容器判断
function isInNavLike(node) {
  try {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return false;
    return !!el.closest('nav, header, footer, aside, [role="navigation"], [role="contentinfo"], [aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs');
  } catch (_) {
    return false;
  }
}

// 克隆并裁剪根节点（去脚本/样式/不可见/广告弹层等噪音）
function cloneAndPruneRootForConversion(root) {
  const chosenRoot = root || pickMainRootNode();
  const clone = chosenRoot.cloneNode(true);

  // 1) 移除 script/style/noscript
  try { clone.querySelectorAll('script,style,noscript').forEach(n => n.remove()); } catch (_) {}

  // 2) 移除不可见节点（基于属性/内联样式，避免使用 getComputedStyle 于脱离文档的节点）
  try { clone.querySelectorAll('[hidden], [aria-hidden="true"], [inert], [style*="display:none" i], [style*="visibility:hidden" i]').forEach(n => n.remove()); } catch (_) {}

  // 3) 移除弹窗/遮罩/对话框/订阅/同意等常见噪音（保留评论/内容）
  try {
    const noisySelectors = [
      '[role="dialog"]', '[role="alertdialog"]', '.modal', '.popup', '.dialog', '.banner', '.interstitial',
      '[class*="cookie" i]', '[id*="cookie" i]', '[class*="gdpr" i]', '[id*="gdpr" i]', '[class*="consent" i]', '[id*="consent" i]',
      '[class*="subscribe" i]', '[id*="subscribe" i]', '[class*="newsletter" i]', '[id*="newsletter" i]',
      '[class*="login" i]', '[id*="login" i]', '[class*="signup" i]', '[id*="signup" i]',
      '[class*="overlay" i]', '[id*="overlay" i]', '[class*="backdrop" i]', '[id*="backdrop" i]', '[class*="mask" i]', '[id*="mask" i]', '[class*="tooltip" i]'
    ].join(',');
    clone.querySelectorAll(noisySelectors).forEach(el => {
      const str = `${el.className || ''} ${el.id || ''} ${(el.getAttribute('aria-label') || '')} ${(el.getAttribute('title') || '')}`.toLowerCase();
      if (/comment|giscus|utterances|remark42/.test(str)) return; // 保留评论系统
      el.remove();
    });
  } catch (_) {}

  // 4) 移除广告/推广/追踪容器（避免误删含“comment”）
  try {
    const adSelectors = [
      '[class*="ad-" i]', '[class*="-ad" i]', '[class*="ads" i]', '[id*="ad-" i]', '[id*="ads" i]', '[id*="-ad" i]',
      '[class*="sponsor" i]', '[id*="sponsor" i]', '[class*="promo" i]', '[id*="promo" i]', '[class*="advert" i]', '[id*="advert" i]',
      '[class*="affiliate" i]', '[id*="affiliate" i]', '[class*="tracking" i]', '[id*="tracking" i]'
    ].join(',');
    clone.querySelectorAll(adSelectors).forEach(el => {
      const str = `${el.className || ''} ${el.id || ''}`.toLowerCase();
      if (/comment/.test(str)) return;
      el.remove();
    });
  } catch (_) {}

  return clone;
}

/**
 * 翻译助手函数（优先使用统一 I18n，再回退到 window.translations）
 */
function trContent(key, replacements = {}) {
  try {
    if (window.I18n && typeof window.I18n.tr === 'function') {
      return window.I18n.tr(key, replacements);
    }
  } catch (_) { /* ignore */ }
  const currentLang = localStorage.getItem('language') || 'zh-CN';
  let text = window.translations?.[currentLang]?.[key] || window.translations?.['zh-CN']?.[key] || ''; // legacy fallback inside trContent
  if (!text) return '';
  for (const ph in replacements) {
    text = text.replace(`{${ph}}`, replacements[ph]);
  }
  return text;
}

/**
 * 从 Readability.js 提取内容 (同步函数)
 * @returns {string}
 */
function extractWithReadability() {
  try {
    if (typeof Readability === 'undefined') {
      console.error('[PageTalk] Readability library not loaded.');
      const currentLang = localStorage.getItem('language') || 'zh-CN';
      return trContent('readabilityNotLoaded') || '错误：无法加载页面内容提取库。';
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
        const currentLang = localStorage.getItem('language') || 'zh-CN';
        return trContent('unableToExtractContent') || 'Unable to extract page content.';
      }
      const currentLang = localStorage.getItem('language') || 'zh-CN';
      const fallbackPrefix = trContent('fallbackToBodyText') || '(Fallback to body text) ';
      content = fallbackPrefix + content; // 标记为后备提取
    }
    const maxLength = 500000; // 限制最大长度
    if (content.length > maxLength) {
      const truncatedSuffix = trContent('contentTruncated') || '...(Content truncated)';
      content = content.substring(0, maxLength) + truncatedSuffix;
    }
    return content;

  } catch (error) {
    console.error('[PageTalk] Error extracting page content with Readability:', error);
    const currentLang = localStorage.getItem('language') || 'zh-CN';
    const errorTemplate = trContent('extractionError') || '提取页面内容时出错: {error}';
    return errorTemplate.replace('{error}', error.message);
  }
}

// 页面内容提取：并行正文与全量，择优合并
function extractComprehensivePageContent() {
  const parts = [];

  // 1) 标题与元信息
  try {
    const title = (document.querySelector('title')?.innerText || '').trim();
    if (title) parts.push(`# ${title}`);

    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')
      || document.querySelector('meta[property="og:description"]')?.getAttribute('content')
      || document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')
      || '';
    if (metaDesc && metaDesc.trim()) {
      parts.push(metaDesc.trim());
    }
  } catch (_) { /* ignore */ }

  // 2) Turndown 仅对清理后的 DOM
  let domMarkdown = '';
  try {
    const td = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
    // 基础剔除
    td.remove(['script', 'style', 'noscript']);

    // 导航/页眉/页脚中的链接仅保留文本（不带 URL），减少噪音
    td.addRule('navLinksAsText', {
      filter: function (node) {
        if (!node || node.nodeName !== 'A') return false;
        try { return isInNavLike(node); } catch (_) { return false; }
      },
      replacement: function (content, node) {
        const t = (node.textContent || '').trim();
        return t;
      }
    });

    // 剔除疑似站点脚本的代码块
    td.addRule('stripSiteInitScripts', {
      filter: function (node) {
        try {
          if (!node) return false;
          const tag = node.nodeName;
          if (tag === 'PRE' || tag === 'CODE') {
            const t = (node.textContent || '').trim();
            return isLikelySiteScript(t, node);
          }
          return false;
        } catch (_) { return false; }
      },
      replacement: function () { return ''; }
    });

    // 仅取主内容容器作为根，进行克隆与去噪
    const domCleaned = cloneAndPruneRootForConversion(pickMainRootNode());
    domMarkdown = td.turndown(domCleaned) || '';
  } catch (e1) {
    domMarkdown = (document.body && document.body.innerText) ? document.body.innerText : '';
  }

  // 3) 段落级去重与空白压缩
  domMarkdown = dedupeMarkdownParagraphs(domMarkdown);

  // 4) 仅解析 JSON-LD（内嵌结构化数据）
  try {
    const embeddedText = extractEmbeddedJsonText();
    if (embeddedText && embeddedText.trim()) {
      parts.push('---');
      parts.push(embeddedText.trim());
    }
  } catch (_) { /* ignore */ }

  // 5) 拼装与总长度限制（宽松软上限）
  parts.unshift(domMarkdown.trim());
  let full = parts.filter(Boolean).join('\n\n');
  const maxLength = 300000; // 30 万字符软上限
  if (full.length > maxLength) {
    const truncatedSuffix = trContent('contentTruncated') || '...(Content truncated)';
    full = full.substring(0, maxLength) + truncatedSuffix;
  }
  return full;
}

// 选择主内容容器
function pickMainRootNode() {
  const candidates = [
    'main',
    '[role="main"]',
    'article',
    '#content',
    '.content',
    '#main-content',
    '.markdown-body',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return document.body || document.documentElement;
}

// 导航/页眉/页脚等容器判断
function isInNavLike(node) {
  try {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return false;
    return !!el.closest('nav, header, footer, aside, [role="navigation"], [role="contentinfo"], [aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs');
  } catch (_) {
    return false;
  }
}

// 克隆并裁剪根节点（去脚本/样式/不可见/广告弹层等噪音）
function cloneAndPruneRootForConversion(root) {
  const chosenRoot = root || pickMainRootNode();
  const clone = chosenRoot.cloneNode(true);

  // 1) 移除 script/style/noscript
  try { clone.querySelectorAll('script,style,noscript').forEach(n => n.remove()); } catch (_) {}

  // 2) 移除不可见节点（基于属性/内联样式，避免使用 getComputedStyle 于脱离文档的节点）
  try { clone.querySelectorAll('[hidden], [aria-hidden="true"], [inert], [style*="display:none" i], [style*="visibility:hidden" i]').forEach(n => n.remove()); } catch (_) {}

  // 3) 移除弹窗/遮罩/对话框/订阅/同意等常见噪音（保留评论/内容）
  try {
    const noisySelectors = [
      '[role="dialog"]', '[role="alertdialog"]', '.modal', '.popup', '.dialog', '.banner', '.interstitial',
      '[class*="cookie" i]', '[id*="cookie" i]', '[class*="gdpr" i]', '[id*="gdpr" i]', '[class*="consent" i]', '[id*="consent" i]',
      '[class*="subscribe" i]', '[id*="subscribe" i]', '[class*="newsletter" i]', '[id*="newsletter" i]',
      '[class*="login" i]', '[id*="login" i]', '[class*="signup" i]', '[id*="signup" i]',
      '[class*="overlay" i]', '[id*="overlay" i]', '[class*="backdrop" i]', '[id*="backdrop" i]', '[class*="mask" i]', '[id*="mask" i]', '[class*="tooltip" i]'
    ].join(',');
    clone.querySelectorAll(noisySelectors).forEach(el => {
      const str = `${el.className || ''} ${el.id || ''} ${(el.getAttribute('aria-label') || '')} ${(el.getAttribute('title') || '')}`.toLowerCase();
      if (/comment|giscus|utterances|remark42/.test(str)) return; // 保留评论系统
      el.remove();
    });
  } catch (_) {}

  // 4) 移除广告/推广/追踪容器（避免误删含“comment”）
  try {
    const adSelectors = [
      '[class*="ad-" i]', '[class*="-ad" i]', '[class*="ads" i]', '[id*="ad-" i]', '[id*="ads" i]', '[id*="-ad" i]',
      '[class*="sponsor" i]', '[id*="sponsor" i]', '[class*="promo" i]', '[id*="promo" i]', '[class*="advert" i]', '[id*="advert" i]',
      '[class*="affiliate" i]', '[id*="affiliate" i]', '[class*="tracking" i]', '[id*="tracking" i]'
    ].join(',');
    clone.querySelectorAll(adSelectors).forEach(el => {
      const str = `${el.className || ''} ${el.id || ''}`.toLowerCase();
      if (/comment/.test(str)) return;
      el.remove();
    });
  } catch (_) {}

  return clone;
}

/**
 * 提取内嵌 JSON 的可读文本（受限）
 */
function extractEmbeddedJsonText() {
  const lines = [];
  const MAX_SCRIPT_SIZE = 200 * 1024; // 200KB

  function safeParse(jsonText) {
    try { return JSON.parse(jsonText); } catch (_) { return null; }
  }

  // 仅 JSON-LD（headline/name/description/articleBody）
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    if (s.textContent && s.textContent.length <= MAX_SCRIPT_SIZE) {
      const data = safeParse(s.textContent);
      if (data) {
        const fields = [];
        const pick = (o, k) => (o && typeof o[k] === 'string' && o[k].trim()) ? o[k].trim() : '';
        const pushIf = v => { if (v) fields.push(v); };
        const arr = Array.isArray(data) ? data : [data];
        arr.forEach(o => {
          pushIf(pick(o, 'headline'));
          pushIf(pick(o, 'name'));
          pushIf(pick(o, 'description'));
          pushIf(pick(o, 'articleBody'));
        });
        if (fields.length) {
          lines.push('Embedded JSON-LD:');
          lines.push(fields.join('\n\n'));
        }
      }
    }
  });

  // 不再抓取通用 application/json，避免引入庞大配置或敏感字段

  // 汇总
  return lines.filter(Boolean).join('\n\n');
}

// 从 PDF.js 渲染的 DOM 结构中提取文本
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
    const currentLang = localStorage.getItem('language') || 'zh-CN';
    const defaultTitle = trContent('embeddedPdfTitle') || 'Embedded PDF';
    const title = document.title || defaultTitle;
    // 规范化提取过程中可能产生的多余空格和换行
    pdfText = pdfText.replace(/\s\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    return `Title: ${title}\n\n${pdfText}`;
  }

  const fallbackMessage = trContent('pdfExtractionFailed') || 'Failed to extract text from PDF.js viewer DOM.';
  console.warn(`[PageTalk] ${fallbackMessage}`);
  const bodyText = (document.body && (document.body.innerText || document.body.textContent)) ? (document.body.innerText || document.body.textContent) : '';
  return `${fallbackMessage}\n\n${(bodyText || '').trim()}`;
}

// 段落去重与空白压缩
function dedupeMarkdownParagraphs(md) {
  if (!md) return '';
  const seen = new Set();
  const out = [];
  const blocks = String(md).split(/\n{2,}/);
  for (const b of blocks) {
    const norm = b.replace(/\s+/g, ' ').trim();
    if (!norm) { continue; }
    const key = norm.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(b.trim());
    }
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n');
}


// --- 主题检测与发送 ---
function parseCssColor(color) {
  if (!color) return null;
  const normalized = color.trim().toLowerCase();
  if (normalized === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map(part => part.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts.length >= 4 ? Number(parts[3]) : 1;
    if ([r, g, b, a].some(val => Number.isNaN(val))) return null;
    return { r, g, b, a };
  }
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const value = hex.length === 3
      ? hex.split('').map(ch => ch + ch).join('')
      : hex;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }
  return null;
}

function getRelativeLuminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function getOpaqueBackgroundColor(element) {
  if (!element) return null;
  const style = getComputedStyle(element);
  const color = parseCssColor(style.backgroundColor);
  if (!color || color.a < 0.1) return null;
  return color;
}

function detectThemeFromColorScheme() {
  const rootScheme = getComputedStyle(document.documentElement).colorScheme || '';
  const bodyScheme = document.body ? (getComputedStyle(document.body).colorScheme || '') : '';
  const combined = `${rootScheme} ${bodyScheme}`.trim().toLowerCase();
  if (!combined || combined.includes('normal')) return null;
  const hasLight = combined.includes('light');
  const hasDark = combined.includes('dark');
  if (hasLight && !hasDark) return 'light';
  if (hasDark && !hasLight) return 'dark';
  return null;
}

function getBackgroundColorAtPoint(x, y) {
  let element = document.elementFromPoint(x, y);
  while (element) {
    const color = getOpaqueBackgroundColor(element);
    if (color) return color;
    element = element.parentElement;
  }
  return getOpaqueBackgroundColor(document.body) || getOpaqueBackgroundColor(document.documentElement);
}

function detectThemeFromSampledBackground() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!width || !height) return null;

  const gridSize = 4;
  const samples = [];
  for (let row = 1; row <= gridSize; row += 1) {
    for (let col = 1; col <= gridSize; col += 1) {
      const x = Math.round((col * width) / (gridSize + 1));
      const y = Math.round((row * height) / (gridSize + 1));
      const color = getBackgroundColorAtPoint(x, y);
      if (!color) continue;
      samples.push(getRelativeLuminance(color));
    }
  }

  if (samples.length < 6) return null;

  const darkSamples = samples.filter(lum => lum < 0.45).length;
  const lightSamples = samples.filter(lum => lum > 0.55).length;
  const average = samples.reduce((sum, lum) => sum + lum, 0) / samples.length;

  if (darkSamples / samples.length >= 0.6) return 'dark';
  if (lightSamples / samples.length >= 0.6) return 'light';
  if (average <= 0.45) return 'dark';
  if (average >= 0.55) return 'light';
  return null;
}

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

  // 4. 如果仍未明确指定，检查 color-scheme 提示
  if (detectedTheme === 'system') {
    const schemeTheme = detectThemeFromColorScheme();
    if (schemeTheme) {
      detectedTheme = schemeTheme;
      console.log(`[PageTalk content.js] Detected theme via color-scheme: ${detectedTheme}`);
    }
  }

  // 5. 如果仍未明确指定，采样页面背景亮度做启发式判断
  if (detectedTheme === 'system') {
    const sampledTheme = detectThemeFromSampledBackground();
    if (sampledTheme) {
      detectedTheme = sampledTheme;
      console.log(`[PageTalk content.js] Detected theme via sampled background: ${detectedTheme}`);
    }
  }

  // 6. 如果仍未明确指定，最后回退到 prefers-color-scheme
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
  // 处理主面板iframe请求主题检测（扩展重载后Chrome API失效时的代理）
  else if (event.data.action === 'requestThemeFromIframe') {
    console.log('[Content] Iframe requested theme detection');
    detectAndSendTheme();
  }
});

// 初始运行
// 在页面加载完成后立即发送主题更新消息
window.addEventListener('load', () => {
  // initPagetalkPanel(); // 考虑是否在load时立即初始化，或者按需初始化
  detectAndSendTheme(); // 页面加载完成后立即发送主题
});


/**
 * 处理语言变化
 */
function handleLanguageChangeInContent(newLanguage) {
  // 更新划词助手的语言缓存
  if (window.currentLanguageCache !== undefined) {
    window.currentLanguageCache = newLanguage;
    console.log('[Content] Updated language cache to:', newLanguage);
  }

  // 通知主面板语言变化
  const iframe = document.getElementById('pagetalk-panel-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      action: 'languageChanged',
      newLanguage: newLanguage
    }, '*');
  }

  // 通知划词助手语言变化
  if (window.handleTextSelectionHelperLanguageChange) {
    window.handleTextSelectionHelperLanguageChange(newLanguage);
  }
}

/**
 * 处理划词助手设置变化
 */
function handleTextSelectionHelperSettingsChange(newSettings) {
  // 通知划词助手设置变化
  if (window.handleTextSelectionHelperSettingsUpdate) {
    window.handleTextSelectionHelperSettingsUpdate(newSettings);
  }
}

/**
 * 处理扩展重载
 */
function handleExtensionReload() {
  // 重新初始化所有组件
  console.log('[Content] Reinitializing after extension reload');

  // 检查并重新初始化必要的库
  checkAndReinitializeLibraries();

  // 重新检测主题
  detectAndSendTheme();

  // 重新初始化划词助手（如果存在）
  if (window.reinitializeTextSelectionHelper) {
    window.reinitializeTextSelectionHelper();
  } else {
    // 如果划词助手函数不存在，尝试重新初始化
    console.log('[Content] TextSelectionHelper not found, attempting to reinitialize');
    if (typeof initTextSelectionHelper === 'function') {
      initTextSelectionHelper();
    }
  }

  // 通知主面板扩展已重载
  const iframe = document.getElementById('pagetalk-panel-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      action: 'extensionReloaded'
    }, '*');
  }
}

/**
 * 检查库的可用性
 */
function checkLibrariesAvailability() {
  const missing = [];

  // 检查Readability库
  if (typeof Readability === 'undefined') {
    missing.push('Readability');
  }

  // 检查markdown-it库
  if (typeof markdownit === 'undefined' && typeof window.markdownit === 'undefined') {
    missing.push('markdown-it');
  }

  // 检查translations对象
  if (typeof window.translations === 'undefined') {
    missing.push('translations');
  }

  // 检查MarkdownRenderer
  if (typeof window.MarkdownRenderer === 'undefined') {
    missing.push('MarkdownRenderer');
  }

  // 检查划词助手
  if (typeof initTextSelectionHelper === 'undefined') {
    missing.push('TextSelectionHelper');
  }

  return {
    allAvailable: missing.length === 0,
    missing: missing
  };
}

/**
 * 检查并重新初始化必要的库
 */
function checkAndReinitializeLibraries() {
  console.log('[Content] Checking library availability...');

  const availability = checkLibrariesAvailability();

  if (availability.allAvailable) {
    console.log('[Content] All libraries are available');
  } else {
    console.warn('[Content] Missing libraries after extension reload:', availability.missing);
  }

  // 检查划词助手
  if (typeof initTextSelectionHelper === 'undefined') {
    console.warn('[Content] TextSelectionHelper not available after extension reload');
  } else {
    console.log('[Content] TextSelectionHelper is available');
  }
}

// 保存全局状态变量到window对象，防止重复声明
window.panelActive = panelActive;

} // 结束防重复初始化检查
