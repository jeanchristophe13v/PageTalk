# PageTalk 划词助手快速测试指南

## 🔧 修复内容总结

### 1. API 调用问题修复
- ✅ 修改了 `text-selection-helper.js` 中的 `callAIAPI` 函数
- ✅ 在 `background.js` 中添加了 `generateContent` 消息处理
- ✅ 实现了从 content script 到 background script 的 API 调用

### 2. UI 位置调整
- ✅ Mini icon 位置向左移动（`MINI_ICON_OFFSET.x = -20`）
- ✅ 选项栏居中显示在 mini icon 正下方

### 3. 设置面板简化
- ✅ 移除了自定义选项管理功能
- ✅ 保留了解读、翻译、对话三个核心选项
- ✅ 改进了拖拽功能，添加了正确的光标样式和视觉反馈

### 4. 文件加载方式优化
- ✅ 将 `text-selection-helper.js` 和 `text-selection-helper.css` 直接添加到 `manifest.json` 的 content_scripts
- ✅ 移除了动态加载逻辑，提高了稳定性

## 🧪 快速测试步骤

### 1. 重新加载扩展
1. 打开 Chrome 扩展管理页面 (`chrome://extensions/`)
2. 找到 PageTalk 扩展
3. 点击"重新加载"按钮

### 2. 基础功能测试
1. 打开任意网页（建议使用 `test-page.html`）
2. 选中一段文本
3. 检查是否出现 mini icon（应该在选中文本的右下角偏左位置）
4. 点击 mini icon
5. 检查选项栏是否居中显示在 mini icon 下方

### 3. 功能窗口测试
1. 点击"解读"选项
2. 检查是否显示功能窗口
3. 检查窗口是否不再瞬间消失
4. 等待 AI 响应（需要配置有效的 API Key）

### 4. 设置面板测试
1. 打开 PageTalk 主面板
2. 点击"设置"标签
3. 点击"划词助手"子标签
4. 检查设置面板是否正常显示
5. 测试拖拽功能：
   - 拖拽手柄应该显示正确的光标样式
   - 拖拽时应该有视觉反馈
   - 拖拽后顺序应该正确保存

## 🐛 可能的问题和解决方案

### 问题1：Mini icon 不显示
**可能原因**：
- 扩展未正确重新加载
- Content script 加载失败

**解决方案**：
1. 完全重新加载扩展
2. 检查浏览器控制台是否有错误
3. 确认 `[TextSelectionHelper] Module loaded` 日志出现

### 问题2：点击选项后窗口仍然消失
**可能原因**：
- API Key 未配置
- Background script 消息处理失败

**解决方案**：
1. 确保在 PageTalk 设置中配置了有效的 Gemini API Key
2. 检查控制台错误信息
3. 查看 background script 日志

### 问题3：拖拽功能不工作
**可能原因**：
- CSS 样式未正确加载
- 事件监听器绑定失败

**解决方案**：
1. 检查 `text-selection-helper.css` 是否正确加载
2. 重新打开设置面板
3. 检查控制台是否有 JavaScript 错误

## 📋 调试信息

### 控制台日志
正常工作时应该看到以下日志：
```
[TextSelectionHelper] Module loaded
[PageTalk] Text Selection Helper initialized
[TextSelectionHelper] Text selection detected: "选中的文本..."
[TextSelectionHelper] Showing mini icon for selection
[TextSelectionHelper] Mini icon added to DOM at position: x, y
```

### 检查点
- [ ] Mini icon 位置正确（向左偏移）
- [ ] 选项栏居中显示
- [ ] 功能窗口不再瞬间消失
- [ ] AI 响应正常显示
- [ ] 设置面板拖拽功能正常
- [ ] 没有控制台错误

## 🎯 下一步优化

如果基础功能正常，可以考虑以下优化：
1. 调整 mini icon 和选项栏的具体位置
2. 优化拖拽体验的视觉效果
3. 添加更多的错误处理和用户反馈
4. 优化 API 调用的性能和稳定性

---

**注意**：如果遇到任何问题，请提供详细的控制台错误信息和复现步骤。
