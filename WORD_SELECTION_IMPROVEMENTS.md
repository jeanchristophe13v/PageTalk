# PageTalk 划词助手尺寸自适应优化

## 问题描述

原有的划词助手存在以下问题：
1. **窗口宽度不能自适应内容**：只能调整高度，宽度固定
2. **CSS max-width 与用户手动调整冲突**：导致窗口在某些情况下"消失"
3. **缺少用户手动调整状态跟踪**：程序无法区分自动调整和用户操作
4. **尺寸控制权混乱**：CSS、JavaScript 和用户操作三方冲突

## 解决方案

### 1. 状态管理优化

**新增状态变量：**
```javascript
let userHasManuallyResized = false; // 跟踪用户是否手动调整过窗口尺寸
```

**状态重置机制：**
- 每次创建新功能窗口时重置为 `false`
- 检测到用户手动调整后设置为 `true`

### 2. 用户手动调整检测

**多重检测机制：**
1. **鼠标事件监听**：监听 `mousedown` 和 `mouseup` 事件
2. **ResizeObserver API**：实时监听元素尺寸变化
3. **尺寸变化阈值**：超过5px的变化才认为是手动调整

**检测逻辑：**
```javascript
// 记录初始尺寸
const recordInitialSize = () => {
    initialSize = {
        width: functionWindow.offsetWidth,
        height: functionWindow.offsetHeight
    };
};

// 检测尺寸变化
const checkSizeChange = () => {
    if (Math.abs(currentWidth - initialSize.width) > 5 || 
        Math.abs(currentHeight - initialSize.height) > 5) {
        userHasManuallyResized = true;
    }
};
```

### 3. 智能尺寸调整函数

**新函数：`adjustWindowSize()`**
- 替代原有的 `adjustWindowHeight()` 函数
- 同时处理宽度和高度的自适应
- 尊重用户手动调整的状态

**核心逻辑：**
```javascript
function adjustWindowSize(windowElement) {
    // 如果用户已手动调整，跳过自动调整
    if (userHasManuallyResized) {
        return;
    }
    
    // 计算最大尺寸（基于屏幕尺寸）
    const maxWidth = window.innerWidth * 0.35;  // 屏幕宽度的35%
    const maxHeight = window.innerHeight * 0.8;  // 屏幕高度的80%
    
    // 测量内容实际尺寸
    const contentWidth = windowElement.scrollWidth;
    const contentHeight = windowElement.scrollHeight;
    
    // 计算最终尺寸
    const finalWidth = Math.min(contentWidth, maxWidth);
    const finalHeight = Math.min(contentHeight, maxHeight);
    
    // 应用新尺寸
    windowElement.style.width = `${finalWidth}px`;
    windowElement.style.height = `${finalHeight}px`;
}
```

### 4. CSS 优化

**移除硬编码限制：**
```css
.pagetalk-function-window {
    /* 移除 max-width: 600px; */
    min-width: 400px;  /* 保留最小宽度 */
    min-height: 250px; /* 保留最小高度 */
    transition: width 0.3s ease, height 0.3s ease; /* 添加平滑动画 */
}
```

## 功能特性

### ✅ 自动宽度调整
- 根据内容自动调整窗口宽度
- 最大宽度不超过屏幕宽度的35%（优化阅读体验）
- 最小宽度保持400px

### ✅ 智能高度调整
- 根据内容自动调整窗口高度
- 最大高度不超过屏幕高度的80%
- 最小高度保持250px

### ✅ 用户操作优先
- 检测用户手动调整行为
- 手动调整后停止自动调整
- 避免与用户操作冲突

### ✅ 边界保护
- 确保窗口不会超出屏幕边界
- 自动调整窗口位置
- 保持窗口完全可见

### ✅ 流式输出适配
- 在AI流式回复过程中实时调整尺寸
- 条件性调整（仅在用户未手动调整时）
- 保持滚动状态

## 测试方法

1. **基础功能测试**：
   - 选择不同长度的文本
   - 观察窗口尺寸自动调整

2. **手动调整测试**：
   - 手动拖拽调整窗口大小
   - 验证后续自动调整是否停止

3. **边界测试**：
   - 选择超长文本
   - 验证窗口不会超出屏幕

4. **流式输出测试**：
   - 使用解读/翻译功能
   - 观察AI回复过程中的尺寸变化

## 兼容性

- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Firefox 87+
- ✅ Safari 14+

## 性能优化

- 使用 `ResizeObserver` API 进行高效的尺寸监听
- 延迟检查机制避免误判
- 条件性调整减少不必要的DOM操作
- 保留滚动位置避免用户体验中断

## 向后兼容

- 保留原有的 `adjustWindowHeight()` 函数作为备用
- 标记为 `@deprecated` 并重定向到新函数
- 所有调用点已更新为使用新函数

## 总结

通过这次优化，PageTalk 划词助手的窗口尺寸管理变得更加智能和用户友好：

1. **解决了窗口"消失"的bug**
2. **实现了宽度自适应功能**
3. **建立了清晰的控制权机制**
4. **提升了用户体验**

这个解决方案专门针对划词助手直接注入页面DOM的特殊环境设计，与主面板的iframe环境形成了良好的互补。
