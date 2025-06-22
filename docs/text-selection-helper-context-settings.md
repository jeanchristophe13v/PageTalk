# 文本选择助手上下文设置功能

## 概述

为PageTalk的文本选择助手的"解读"和"翻译"功能添加了自定义上下文设置选项，与现有的"对话"功能保持一致。

## 功能特性

### 新增功能
1. **解读功能上下文设置**
   - 自定义上下文：可设置前置和后置上下文token数
   - 读取全部上下文：使用页面的完整上下文信息

2. **翻译功能上下文设置**
   - 自定义上下文：可设置前置和后置上下文token数
   - 读取全部上下文：使用页面的完整上下文信息

### 设置选项
- **上下文模式**：
  - `custom`：自定义上下文（默认）
  - `full`：读取全部上下文
- **前置上下文token数**：0-2000，默认500
- **后置上下文token数**：0-2000，默认500

## 实现细节

### 1. HTML界面更新
- 在`html/sidepanel.html`中为解读和翻译设置卡片添加了上下文设置UI
- 复用了对话功能的UI组件结构

### 2. 设置模块更新
- 更新`js/text-selection-helper-settings.js`中的默认设置结构
- 添加了UI加载和事件监听器支持
- 确保向后兼容性

### 3. 核心功能更新
- 更新`js/text-selection-helper.js`中的`sendInterpretOrTranslateRequest`函数
- 支持根据contextMode选择上下文提取方式
- 添加了设置兼容性处理

### 4. CSS样式更新
- 扩展了现有的上下文设置样式规则
- 支持解读和翻译功能的上下文模式切换

## 使用方法

1. 打开PageTalk设置面板
2. 进入"文本选择助手"设置
3. 在"解读设置"或"翻译设置"卡片中找到"上下文设置"
4. 选择上下文模式：
   - **自定义上下文**：手动设置前置和后置token数
   - **读取全部上下文**：使用页面完整上下文
5. 如选择自定义上下文，可调整前置和后置上下文token数

## 技术实现

### 数据结构
```javascript
{
  interpret: {
    model: 'gemini-2.5-flash',
    systemPrompt: '解读一下',
    temperature: 0.7,
    contextMode: 'custom', // 新增
    contextBefore: 500,    // 新增
    contextAfter: 500,     // 新增
    maxOutputLength: 65536
  },
  translate: {
    model: 'gemini-2.5-flash',
    systemPrompt: '翻译一下',
    temperature: 0.2,
    contextMode: 'custom', // 新增
    contextBefore: 500,    // 新增
    contextAfter: 500,     // 新增
    maxOutputLength: 65536
  }
}
```

### 上下文提取逻辑
```javascript
// 根据上下文设置重新提取上下文
let contextForThisRequest = '';
if (optionSettings.contextMode === 'full') {
    // 读取全部上下文
    contextForThisRequest = selectionContext;
} else {
    // 自定义上下文
    const contextBefore = optionSettings.contextBefore || 500;
    const contextAfter = optionSettings.contextAfter || 500;
    
    if (contextBefore > 0 || contextAfter > 0) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            contextForThisRequest = extractSelectionContext(selection, contextBefore, contextAfter);
        }
    }
}
```

## 向后兼容性

- 现有设置会自动添加默认的contextMode为'custom'
- 现有的contextBefore和contextAfter值会被保留
- 如果缺少上下文设置，会使用默认值（500/500）

## 测试建议

1. 测试新安装的扩展是否使用正确的默认设置
2. 测试现有用户升级后设置是否正确迁移
3. 测试上下文模式切换是否正常工作
4. 测试自定义token数设置是否生效
5. 测试"读取全部上下文"模式是否正常工作
