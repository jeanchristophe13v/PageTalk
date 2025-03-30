# Pagetalk 插件 Gemini API 流式输出功能实施计划

## 1. 背景与目标

**背景**: 当前 Pagetalk 浏览器插件使用 Gemini API 进行网页内容总结和对话，但 AI 回复是非流式的，用户需要等待完整响应。
**目标**: 为插件添加 Gemini API 的流式输出功能，允许用户实时看到 AI 生成的文本，提升交互体验。此功能需同时支持纯文本输入和图文混合输入。

## 2. 代码分析概要

通过分析 `manifest.json`, `js/background.js`, `js/sidepanel.js`, 和 `html/sidepanel.html`，得出以下关键点：

*   **核心逻辑**: `js/sidepanel.js` 包含与 Gemini API 交互、处理用户输入、管理状态和更新聊天界面的主要逻辑。
*   **API 调用**: `callGeminiAPI` (文本) 和 `callGeminiAPIWithImages` (图文) 函数负责调用 Gemini API，目前使用非流式的 `generateContent` 端点。
*   **UI 更新**: `addMessageToChat` 函数负责在 `#chat-messages` 区域显示消息，并已包含 `isStreaming` 参数和 `updateStreamingMessage` 函数，为流式更新提供了基础。
*   **图片支持**: 现有代码已支持图片上传和包含在 API 请求中。

## 3. 实施计划详解

### 3.1 修改 API 调用函数 (`js/sidepanel.js`)

*   **切换端点**: 在 `callGeminiAPI` 和 `callGeminiAPIWithImages` 函数中，将 API 请求的目标从 `generateContent` 更改为 `:streamGenerateContent`。
*   **处理数据流**:
    *   使用 `for await...of` 循环异步迭代处理 API 返回的数据流中的每个 `chunk`。
    *   在循环开始前初始化 `accumulatedText = ''` 和 `messageElement = null`。
    *   移除或调整现有的等待完整响应的逻辑。
*   **引入思考动画**: 在发起 API 请求后，调用 `addThinkingAnimation()` 显示加载状态，并在收到第一个数据块后移除该动画。

### 3.2 处理流式响应并更新 UI (`js/sidepanel.js`)

*   **循环内部逻辑**:
    *   **创建消息占位符 (仅首次)**: 在 `for await...of` 循环的第一次迭代时（当 `messageElement` 为 `null`），调用 `messageElement = addMessageToChat(null, 'bot', true);` 创建一个空的机器人消息 `div` 并获取其引用。同时移除思考动画。
    *   **提取文本**: 从当前 `chunk` 中提取文本内容（例如 `chunk.text()`）。
    *   **累积文本**: 将新文本块追加到 `accumulatedText`。
    *   **实时更新 UI**: 调用 `updateStreamingMessage(messageElement, accumulatedText);`，传入消息元素引用和当前累积的文本，实时刷新界面显示。
*   **检查并调整 `addMessageToChat`**:
    *   当 `isStreaming` 为 `true` 时，仅创建基础消息 `div`（包含 `message` 和 `bot-message` 类，以及 `data-message-id`），不填充内容，并返回该 `div` 元素的引用。
    *   确保每次调用都将聊天窗口滚动到底部。
*   **检查并调整 `updateStreamingMessage`**:
    *   接收 `messageElement` 和 `accumulatedContent`。
    *   使用 `window.MarkdownRenderer.render(accumulatedContent)` 渲染 Markdown 并更新 `messageElement.innerHTML`。
    *   每次更新后将聊天窗口滚动到底部。
*   **流结束后处理**:
    *   **最终渲染**: 在 `for await...of` 循环结束后，调用一个新函数（例如 `finalizeBotMessage(messageElement, accumulatedText)`）来完成最终渲染：
        *   确保最终的 Markdown 正确渲染。
        *   为代码块添加复制按钮 (`addCopyButtonToCodeBlock`)。
        *   添加其他消息操作按钮（复制、删除、重新生成）。
    *   **处理空响应**: 如果流结束但 `messageElement` 仍为 `null`（即 API 未返回任何内容），移除思考动画并显示一条提示信息。

### 3.3 更新聊天历史 (`js/sidepanel.js`)

*   在整个流式响应接收并处理完毕后（即 `for await...of` 循环之后），将完整的机器人回复 (`accumulatedText`) 添加到 `state.chatHistory` 数组中。
*   调用 `saveChatHistory()`（如果需要持久化历史记录）。

### 3.4 错误处理

*   在 API 调用 (`try...catch` 块包围 `for await...of`) 和流处理的各个阶段添加健壮的错误处理。
*   捕获到错误时，移除思考动画（如果存在）。
*   使用 `addMessageToChat` 向用户显示清晰的错误信息。

## 4. 流程图 (Mermaid)

```mermaid
graph TD
    A[用户发送消息/图片] --> B{判断是否有图片?}
    B -- 有 --> C[准备图片数据]
    B -- 无 --> D[准备文本数据]
    C --> E[调用 streamGenerateContent (带图片)]
    D --> E[调用 streamGenerateContent (仅文本)]

    subgraph API 交互与流处理
        E --> F[API 返回数据流]
        F --> G{开始迭代处理数据块 (chunk)}
        G -- 第一个 chunk --> H[创建空消息容器 (addMessageToChat, isStreaming=true) & 移除思考动画]
        H --> I[提取 chunk.text()]
        G -- 后续 chunk --> I
        I --> J[累积文本]
        J --> K[更新 UI (updateStreamingMessage)]
        K --> G
    end

    G -- 流结束 --> L[处理最终消息 (finalizeBotMessage)]
    L --> M[将完整回复存入 chatHistory]
    M --> N[完成]

    E -- API/流错误 --> O[显示错误信息 & 移除思考动画]
```

## 5. 下一步

确认此计划后，切换到代码实现模式开始进行具体的代码修改。