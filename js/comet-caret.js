/**
 * 彗星光标效果 (Comet Caret)
 * 为 textarea 添加自定义光标和彗星尾巴动画效果
 */

// 存储光标实例
const caretInstances = new WeakMap();

/**
 * 创建光标位置计算用的 mirror 元素
 * @param {HTMLTextAreaElement} textarea
 * @returns {HTMLDivElement}
 */
function createMirror(textarea) {
    const mirror = document.createElement('div');
    mirror.className = 'comet-caret-mirror';

    // 复制 textarea 的关键样式
    const styles = window.getComputedStyle(textarea);
    const stylesToCopy = [
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
        'letterSpacing', 'lineHeight', 'textTransform',
        'wordSpacing', 'textIndent', 'whiteSpace', 'wordWrap',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'boxSizing', 'direction', 'textAlign'
    ];

    stylesToCopy.forEach(prop => {
        mirror.style[prop] = styles[prop];
    });

    // 隐藏但保持尺寸计算
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.pointerEvents = 'none';

    return mirror;
}

/**
 * 计算光标在 textarea 中的像素位置
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLDivElement} mirror
 * @returns {{ x: number, y: number, height: number }}
 */
function getCaretPosition(textarea, mirror) {
    const text = textarea.value;
    const selectionStart = textarea.selectionStart;

    // 更新 mirror 尺寸与 textarea 一致，但要减去滚动条宽度
    const computedStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseFloat(computedStyle.paddingLeft);
    const paddingRight = parseFloat(computedStyle.paddingRight);
    const borderLeft = parseFloat(computedStyle.borderLeftWidth);
    const borderRight = parseFloat(computedStyle.borderRightWidth);
    
    // 关键修正：Mirror 的内容宽度即使在 box-sizing: border-box 时，
    // 也必须考虑到 textarea 垂直滚动条占据的空间。
    // textarea.clientWidth 不包含滚动条，所以使用 clientWidth 是最準确的。
    // 但我们需要 mirror 的 "width" 属性（如果它是 border-box）等于 textarea.offsetWidth ???
    // 不，最稳妥的是让 mirror 的 content width 等于 textarea 的 client width - padding。
    
    // 简单粗暴法：设置 mirror width 为 clientWidth，并修正 box-sizing 为 border-box，且保留 padding/border
    // 这样滚动条的影响就被自动排除了吗？ clientWidth = width - scrollbar (if any).
    // 如果我们把 mirror set width = textarea.clientWidth + border*2 ?
    // 更准确的方法：
    mirror.style.boxSizing = 'border-box';
    mirror.style.width = textarea.offsetWidth + 'px'; 
    // 但是等等，offsetWidth 包含滚动条。如果 mirror 没有滚动条，它的 content area 就会比 textarea 宽。
    // 这会导致换行点不同。
    // 修正：显式计算不含滚动条的宽度
    const scrollbarWidth = textarea.offsetWidth - textarea.clientWidth - borderLeft - borderRight;
    if (scrollbarWidth > 0) {
        mirror.style.width = (textarea.offsetWidth - scrollbarWidth) + 'px';
    } else {
        mirror.style.width = textarea.offsetWidth + 'px';
    }

    // 获取光标前的文本
    const textBeforeCaret = text.substring(0, selectionStart);

    // 创建临时 span 来标记光标位置
    mirror.innerHTML = '';
    const textNode = document.createTextNode(textBeforeCaret);
    const caretMarker = document.createElement('span');
    caretMarker.textContent = '|';
    caretMarker.style.display = 'inline-block'; // 使用 inline-block 防止高度塌陷
    caretMarker.style.width = '0';
    caretMarker.style.overflow = 'hidden';

    mirror.appendChild(textNode);
    mirror.appendChild(caretMarker);

    // 获取 marker 相对于 mirror 的位置
    // 注意：由于 mirror 是 absolute top:0 left:0，getBoundingClientRect 会受滚动影响吗？
    // mirror 是不可见的，没有父级 overflow 限制（除了 container），且 position fixed/absolute。
    const markerRect = caretMarker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    // 计算相对于 container 的位置
    // container 已经对齐了 textarea 的左上角（包括 padding/border）
    // mirror 也位于 container 左上角 (top:0 left:0)
    // 所以 markerRect.left - mirrorRect.left 就是光标相对于 container 左边缘的距离
    // 这个距离包含了 paddingLeft (因为 mirror 复制了 padding)
    const x = markerRect.left - mirrorRect.left;
    
    // 垂直位置：同理，是相对于 container 顶部的距离
    // 但是，因为 textarea 内容向上滚动了 textarea.scrollTop
    // 而 mirror 显示的是全文，没有滚动。
    // 所以光标在 mirror 中的物理位置是全文位置。
    // 我们需要减去 textarea.scrollTop 才能得到在当前视口中的位置。
    const y = markerRect.top - mirrorRect.top - textarea.scrollTop;

    // 获取行高
    const lineHeight = parseFloat(computedStyle.lineHeight) || 
                       parseFloat(computedStyle.fontSize) * 1.5;

    return { x, y, height: lineHeight };
}

/**
 * 创建彗星尾巴粒子
 * @param {HTMLElement} container
 * @param {number} x
 * @param {number} y
 */
function createTrailParticle(container, x, y) {
    const particle = document.createElement('div');
    particle.className = 'comet-trail';

    // 添加随机偏移增加自然感
    const offsetX = (Math.random() - 0.5) * 4;
    const offsetY = (Math.random() - 0.5) * 8;

    particle.style.left = (x + offsetX) + 'px';
    particle.style.top = (y + offsetY) + 'px';

    container.appendChild(particle);

    // 触发动画
    requestAnimationFrame(() => {
        particle.classList.add('active');
    });

    // 动画结束后移除粒子
    particle.addEventListener('animationend', () => {
        particle.remove();
    });
}

/**
 * 初始化彗星光标效果
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ destroy: Function }}
 */
export function initCometCaret(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') {
        console.warn('[CometCaret] Invalid textarea element');
        return null;
    }

    // 检查是否已初始化
    if (caretInstances.has(textarea)) {
        return caretInstances.get(textarea);
    }

    // 创建容器
    const container = document.createElement('div');
    container.className = 'comet-caret-container';

    // 创建自定义光标
    const caret = document.createElement('div');
    caret.className = 'comet-caret';
    container.appendChild(caret);

    // 创建 mirror 元素用于位置计算
    const mirror = createMirror(textarea);
    container.appendChild(mirror);

    // 将容器添加到 textarea 的父元素
    const parent = textarea.parentElement;
    if (parent) {
        // 只有当父元素没有定位属性时才添加相对定位
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }
        parent.appendChild(container); // Append to parent, sibling of textarea
    }
    
    // 同步容器大小和位置的函数
    function updateContainerSize() {
        if (!container || !textarea) return;
        
        // 我们需要 container 完全覆盖 textarea，包括 padding 和 border
        // 因为 mirror 计算出的坐标是相对于 padding box 左上角的（如果包含 padding）
        // 实际上，getComputedStyle 复制了 padding 到 mirror。
        // mirror @ (0,0) in container.
        // x = marker - mirrorLeft.
        // 所以 x 也是相对于 mirror 左上角。
        // 如果 container 对齐 textarea layout box (offsetLeft/Top)，那么坐标系匹配。
        
        container.style.top = textarea.offsetTop + 'px';
        container.style.left = textarea.offsetLeft + 'px';
        container.style.width = textarea.offsetWidth + 'px';
        container.style.height = textarea.offsetHeight + 'px'; // 确保高度也匹配
    }

    // 初始化大小
    updateContainerSize();

    // 监听 textarea 大小变化 (例如用户拖拽调整大小)
    const resizeObserver = new ResizeObserver(() => {
        updateContainerSize();
        updateCaretPosition(false);
    });
    resizeObserver.observe(textarea);

    // 启用自定义光标模式
    textarea.classList.add('comet-caret-enabled');

    // 状态变量
    let lastX = 0;
    let lastY = 0;
    let isMoving = false;
    let moveTimeout = null;
    let lastUpdateTime = 0;
    const THROTTLE_MS = 16; // ~60fps

    /**
     * 更新光标位置
     * @param {boolean} createTrail - 是否创建拖尾粒子
     * @param {boolean} forceUpdate - 是否强制更新（绕过节流）
     */
    function updateCaretPosition(createTrail = true, forceUpdate = false) {
        const now = Date.now();
        if (!forceUpdate && now - lastUpdateTime < THROTTLE_MS) return;
        lastUpdateTime = now;

        const pos = getCaretPosition(textarea, mirror);

        // 检查是否移动
        const dx = Math.abs(pos.x - lastX);
        const dy = Math.abs(pos.y - lastY);
        const moved = dx > 2 || dy > 2;

        if (moved && createTrail) {
            // 检查异常值
            if (isNaN(pos.x) || isNaN(pos.y)) {
                console.warn('[CometCaret] Invalid position:', pos);
                return;
            }

            // 插值生成粒子，增加密度实现丝滑拖尾
            const dist = Math.sqrt(dx * dx + dy * dy);
            // 每隔 4px 生成一个粒子，对于快速移动非常重要
            const steps = Math.max(1, Math.floor(dist / 4)); 

            for (let i = 0; i < steps; i++) {
                const ratio = (i + 1) / steps;
                // 使用非线性插值可以让拖尾更聚集在后端？不，线性即可，依靠 opacity 变化
                const particleX = lastX + (pos.x - lastX) * ratio;
                // 垂直位置：光标底部附近
                const particleY = lastY + (pos.y - lastY) * ratio + pos.height / 2;
                createTrailParticle(container, particleX, particleY);
            }

            // 标记为移动状态
            caret.classList.add('moving');
            isMoving = true;

            // 清除之前的定时器
            if (moveTimeout) clearTimeout(moveTimeout);

            // 移动结束后恢复闪烁，稍微延长时间以匹配新的 transition
            moveTimeout = setTimeout(() => {
                caret.classList.remove('moving');
                isMoving = false;
            }, 150);
        }

        // 更新光标位置
        caret.style.left = pos.x + 'px';
        caret.style.top = pos.y + 'px';
        caret.style.height = pos.height + 'px';

        lastX = pos.x;
        lastY = pos.y;
    }

    /**
     * 显示光标
     */
    function showCaret() {
        caret.classList.add('visible');
        updateCaretPosition(false);
    }

    /**
     * 隐藏光标
     */
    function hideCaret() {
        caret.classList.remove('visible');
    }

    // 事件处理器
    function onInput() {
        updateCaretPosition(true);
    }

    function onKeyDown(e) {
        // 箭头键、Home、End 等导航键
        const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (navKeys.includes(e.key)) {
            setTimeout(() => updateCaretPosition(true), 0);
        }
    }

    function onClick() {
        setTimeout(() => updateCaretPosition(true), 0);
    }

    function onFocus() {
        showCaret();
    }

    function onBlur() {
        hideCaret();
    }

    function onScroll() {
        updateCaretPosition(false);
    }

    function onSelect() {
        updateCaretPosition(false);
    }

    // 绑定事件
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('keydown', onKeyDown);
    textarea.addEventListener('click', onClick);
    textarea.addEventListener('focus', onFocus);
    textarea.addEventListener('blur', onBlur);
    textarea.addEventListener('scroll', onScroll);
    textarea.addEventListener('select', onSelect);

    // 如果 textarea 已经聚焦，立即显示光标
    if (document.activeElement === textarea) {
        showCaret();
    }

    // 返回控制对象
    const instance = {
        destroy() {
            // 移除事件监听
            textarea.removeEventListener('input', onInput);
            textarea.removeEventListener('keydown', onKeyDown);
            textarea.removeEventListener('click', onClick);
            textarea.removeEventListener('focus', onFocus);
            textarea.removeEventListener('blur', onBlur);
            textarea.removeEventListener('scroll', onScroll);
            textarea.removeEventListener('select', onSelect);

            // 移除 DOM 元素
            container.remove();
            textarea.classList.remove('comet-caret-enabled');

            // 清除定时器
            if (moveTimeout) clearTimeout(moveTimeout);
            
            // 停止观察
            if (resizeObserver) resizeObserver.disconnect();

            // 从实例 map 中移除
            caretInstances.delete(textarea);
        },
        update() {
            // Force update to bypass throttling (for programmatic value changes)
            updateCaretPosition(false, true);
        }
    };

    caretInstances.set(textarea, instance);
    return instance;
}

/**
 * 获取 textarea 的光标实例
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ destroy: Function, update: Function } | undefined}
 */
export function getCometCaretInstance(textarea) {
    return caretInstances.get(textarea);
}
