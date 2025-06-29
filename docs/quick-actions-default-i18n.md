# PageTalk 默认快捷操作国际化实现文档

## 📋 概述

本文档记录了为 PageTalk 扩展实现默认快捷操作国际化功能的详细过程。此次修改实现了用户首次加载时的两个默认快捷操作，并支持中英文切换时的实时翻译更新。

## 🎯 需求分析

用户要求设置两个默认快捷操作：

1. **总结操作**
   - ID: `总结`
   - 提示词: `总结一下`
   - 不忽略助手设置

2. **Mermaid操作**
   - ID: `mermaid`
   - 忽略助手设置
   - 提示词: 复杂的Mermaid图表生成指令
   - 中文版包含避免语法错误的提示
   - 英文版不包含中文语法错误相关提示

## 🔧 实现方案

### 1. 翻译键添加

在 `js/translations.js` 中添加了默认快捷操作的翻译键：

#### 中文翻译
```javascript
// --- 默认快捷操作 ---
'defaultQuickActionSummarize': '总结',
'defaultQuickActionSummarizePrompt': '总结一下',
'defaultQuickActionMermaid': 'mermaid',
'defaultQuickActionMermaidPrompt': `[复杂的中文Mermaid提示词]`
```

#### 英文翻译
```javascript
// --- Default Quick Actions ---
'defaultQuickActionSummarize': 'Summarize',
'defaultQuickActionSummarizePrompt': 'Please summarize this content',
'defaultQuickActionMermaid': 'mermaid',
'defaultQuickActionMermaidPrompt': `[复杂的英文Mermaid提示词]`
```

### 2. 快捷操作管理器修改

在 `js/quick-actions-manager.js` 中实现了以下功能：

#### 新增函数
- `getCurrentLanguage()`: 获取当前语言设置
- `getTranslation(key)`: 获取翻译文本
- `getDefaultQuickActions()`: 获取当前语言的默认快捷操作
- `updateDefaultActionsTranslations()`: 更新默认快捷操作的翻译

#### 修改的函数
- `initializeDefaultActions()`: 使用动态获取的默认操作
- `resetToDefaultActions()`: 使用动态获取的默认操作

### 3. 语言切换集成

在 `js/main.js` 的 `loadAndApplyTranslations()` 函数中添加了默认快捷操作翻译更新：

```javascript
// 更新默认快捷操作的翻译
try {
    await QuickActionsManager.updateDefaultActionsTranslations();
} catch (error) {
    console.warn('[main.js] Error updating default quick actions translations:', error);
}
```

## 🚀 功能特性

### 1. 自动初始化
- 用户首次使用时自动创建两个默认快捷操作
- 根据当前语言设置显示相应的名称和提示词

### 2. 实时语言切换
- 当用户切换语言时，默认快捷操作的名称和提示词会自动更新
- 保留用户可能修改的其他设置（如忽略助手选项）

### 3. 智能更新机制
- 只更新默认快捷操作（通过ID识别）
- 不影响用户自定义的快捷操作
- 避免不必要的存储操作

### 4. 语言特定内容
- 中文版Mermaid提示词包含避免中文语法错误的特殊提示
- 英文版Mermaid提示词针对英文用户优化，不包含中文相关提示

## 📁 修改的文件

1. **js/translations.js**
   - 添加默认快捷操作的中英文翻译键

2. **js/quick-actions-manager.js**
   - 实现国际化的默认快捷操作管理
   - 添加语言切换时的翻译更新功能

3. **js/main.js**
   - 在语言切换流程中集成默认快捷操作翻译更新

## 🧪 测试

创建了 `test-quick-actions.html` 测试文件，可以验证：
- 默认快捷操作的正确初始化
- 语言切换时的翻译更新
- 重置功能的正确性

## 🔄 使用流程

1. **首次使用**：用户首次打开扩展时，系统自动创建两个默认快捷操作
2. **语言切换**：用户切换语言时，默认快捷操作的名称和提示词自动更新
3. **重置功能**：用户可以随时重置为当前语言的默认快捷操作

## 📝 注意事项

- 默认快捷操作通过固定的ID（`default-summarize` 和 `default-mermaid`）进行识别
- 语言切换只更新默认快捷操作，不影响用户自定义的操作
- 系统会自动处理翻译回退（当前语言 → 中文 → 键名）
- 所有操作都有错误处理，确保系统稳定性

## 🎉 总结

此次实现完全满足了用户的需求：
- ✅ 设置了两个指定的默认快捷操作
- ✅ 实现了完整的国际化支持
- ✅ 支持语言切换时的实时更新
- ✅ 中英文版本的差异化处理
- ✅ 保持了代码的可维护性和扩展性
