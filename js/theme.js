/**
 * Pagetalk - Theme Management and Draggable Button
 */

/**
 * 应用当前主题 (浅色/深色) - 只更新 CSS 和图标
 * @param {boolean} isDarkMode - 是否应用深色模式
 * @param {object} elements - DOM elements reference
 */
export function applyTheme(isDarkMode, elements) {
    const body = document.body;
    if (isDarkMode) {
        body.classList.add('dark-mode');
        body.classList.add('hljs-theme-dark');
        body.classList.remove('hljs-theme-light');
        if (elements.moonIconSettings) elements.moonIconSettings.style.display = 'none';
        if (elements.sunIconSettings) elements.sunIconSettings.style.display = 'inline-block';
    } else {
        body.classList.remove('dark-mode');
        body.classList.add('hljs-theme-light');
        body.classList.remove('hljs-theme-dark');
        if (elements.moonIconSettings) elements.moonIconSettings.style.display = 'inline-block';
        if (elements.sunIconSettings) elements.sunIconSettings.style.display = 'none';
    }
}

/**
 * 更新 Mermaid 图表的主题并重新渲染
 * @param {boolean} isDarkMode - 是否应用深色模式
 * @param {function} rerenderAllMermaidChartsCallback - Callback to rerender charts
 */
export async function updateMermaidTheme(isDarkMode, rerenderAllMermaidChartsCallback) {
    if (typeof mermaid !== 'undefined') {
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: isDarkMode ? 'dark' : 'default',
                logLevel: 'error'
            });
            console.log(`Mermaid theme updated to: ${isDarkMode ? 'dark' : 'default'}`);
            await rerenderAllMermaidChartsCallback(); // Use callback
        } catch (error) {
            console.error('Failed to update Mermaid theme:', error);
        }
    }
}

/**
 * 切换主题 (临时切换，不保存)
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} rerenderAllMermaidChartsCallback - Callback
 */
export function toggleTheme(state, elements, rerenderAllMermaidChartsCallback) {
    console.log('User manually toggled theme (temporary).');
    state.darkMode = !state.darkMode;
    applyTheme(state.darkMode, elements);
    updateMermaidTheme(state.darkMode, rerenderAllMermaidChartsCallback);
}

// --- Draggable Button Logic ---

/**
 * 使元素可拖动 (修改版：限制Y轴，区分单击/拖动)
 * @param {HTMLElement} element - 要使其可拖动的元素
 * @param {function} onClickCallback - Callback function to execute on click (e.g., toggleTheme)
 */
export function makeDraggable(element, onClickCallback) {
    let offsetY, isDragging = false;
    let startY, mousedownTime;
    let hasDragged = false;
    const dragThreshold = 5; // pixels
    // const container = document.querySelector('.container') || document.body; // Not strictly needed for Y-axis constraint

    element.addEventListener('mousedown', (e) => {
        if (!element.contains(e.target)) return;

        e.preventDefault();
        isDragging = true;
        hasDragged = false;
        mousedownTime = Date.now();
        startY = e.clientY;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        element.style.cursor = 'grabbing';
        element.style.transition = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;

        if (!hasDragged && Math.abs(e.clientY - startY) > dragThreshold) {
            hasDragged = true;
        }

        let newY = e.clientY - offsetY;
        const maxY = window.innerHeight - element.offsetHeight;
        newY = Math.max(0, Math.min(newY, maxY));

        element.style.top = `${newY}px`;
        element.style.right = 'var(--spacing-lg)'; // Keep fixed right
        element.style.left = 'auto';
        element.style.bottom = 'auto';
    }

    function onMouseUp(e) {
        if (!isDragging) return;

        const wasDragging = isDragging;
        const didDragOccur = hasDragged;

        isDragging = false;
        element.style.cursor = 'grab';
        element.style.transition = 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, top 0.2s ease'; // Add transition for position snapping if needed
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (wasDragging && !didDragOccur) {
            // Click occurred
            if (onClickCallback) {
                onClickCallback();
            }
        } else if (didDragOccur) {
            // Drag occurred, save position
            saveButtonPosition(element.style.top);
        }
        hasDragged = false;
    }
}

/**
 * 保存按钮位置到 chrome.storage.sync
 * @param {string} top - 按钮的 top 样式值
 */
function saveButtonPosition(top) {
    chrome.storage.sync.set({ themeButtonPosition: { top } }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving button position:", chrome.runtime.lastError);
        } else {
            // console.log("Button position saved.");
        }
    });
}

/**
 * 从 chrome.storage.sync 加载并应用按钮位置
 * @param {object} elements - DOM elements reference
 */
export function loadButtonPosition(elements) {
    chrome.storage.sync.get('themeButtonPosition', (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading button position:", chrome.runtime.lastError);
            setDefaultButtonPosition(elements);
            return;
        }

        const savedPosition = result.themeButtonPosition;
        const button = elements.themeToggleBtnSettings;

        if (button) {
            if (savedPosition && savedPosition.top) {
                button.style.position = 'absolute';
                button.style.top = savedPosition.top;
                button.style.right = 'var(--spacing-lg)';
                button.style.left = 'auto';
                button.style.bottom = 'auto';
                // console.log(`Button position loaded: top=${savedPosition.top}`);
            } else {
                setDefaultButtonPosition(elements);
            }
            // Always hide button initially, let setThemeButtonVisibility control visibility
            button.style.display = 'none';
        } else {
            console.warn("Theme toggle button element not found during loadButtonPosition.");
        }
    });
}

/**
 * 设置按钮的默认右下角位置
 * @param {object} elements - DOM elements reference
 */
function setDefaultButtonPosition(elements) {
     const button = elements.themeToggleBtnSettings;
     if (!button) {
         console.warn("Theme toggle button element not found during setDefaultButtonPosition.");
         return;
     }
     // console.log("Setting default button position.");
     button.style.position = 'absolute';
     button.style.top = 'auto';
     button.style.left = 'auto';
     button.style.bottom = '80px'; // Default bottom
     button.style.right = 'var(--spacing-lg)'; // Default right
}

/**
 * 控制主题切换按钮的可见性
 * @param {string} currentTabId - 当前激活的主标签页 ID
 * @param {object} elements - DOM elements reference
 */
export function setThemeButtonVisibility(currentTabId, elements) {
    if (elements.themeToggleBtnSettings) {
        // 强制控制按钮显示状态，确保只在设置页面显示
        if (currentTabId === 'settings') {
            elements.themeToggleBtnSettings.style.display = 'flex';
            elements.themeToggleBtnSettings.style.visibility = 'visible';
        } else {
            elements.themeToggleBtnSettings.style.display = 'none';
            elements.themeToggleBtnSettings.style.visibility = 'hidden';
        }
        console.log(`Theme button visibility set for tab: ${currentTabId}, display: ${elements.themeToggleBtnSettings.style.display}`);
    }
}