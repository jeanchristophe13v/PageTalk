# Pagetalk - 你的网页 Gemini 助手

[![插件图标](magic.png?raw=true "Pagetalk 图标")](https://github.com/your-repo/pagetalk) <!-- 如果有仓库链接，请替换 -->

#### [English/英文](README.md)

## 简介

Pagetalk 是一款旨在通过集成 Google Gemini API 的强大功能来增强您网页浏览体验的浏览器插件。它能让您轻松总结网页内容，围绕页面进行上下文对话，并管理多个自定义的 AI 助手（Agent）。

## 主要特性

*   **网页交互:** 读取并提取当前页面的主要内容，为您的对话提供上下文。
*   **Gemini API 集成:** 直接连接 Gemini API，提供强大的自然语言理解和生成能力。
*   **上下文聊天:** 基于您当前浏览的网页内容，与 Gemini 进行有意义的对话。
*   **多助手系统:** 创建、自定义并轻松切换多个 AI 助手。每个助手都可以拥有独特的系统提示词和参数设置（温度、最大令牌数、Top P）。
*   **模型选择:** 从多种可用的 Gemini 模型中进行选择，以满足您的不同需求。
*   **图片输入:** 直接在聊天中上传或粘贴图片，与 Gemini 讨论图片内容（需要使用支持视觉功能的模型）。
*   **可自定义设置:** 配置您的 Google AI Studio API 密钥，选择偏好的默认模型，管理助手参数，以及开关“自动提取内容”功能。
*   **可调整面板:** 调整侧边栏的宽度，以获得最佳的视觉舒适度。

## 安装

**注意:** 本插件需要在开发者模式下以“加载已解压的扩展程序”方式安装。

### Edge 浏览器

1.  打开 Edge 浏览器，在地址栏输入 `edge://extensions/` 并回车。
2.  打开右上角的“开发者模式”开关。
3.  点击“加载解压缩的扩展”，然后选择您克隆或下载本项目的根目录。

### Chrome 浏览器

1.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
2.  打开右上角的“开发者模式”开关。
3.  点击“加载已解压的扩展程序”，然后选择您克隆或下载本项目的根目录。

## 使用说明

1.  安装成功后，点击浏览器工具栏上的 Pagetalk 图标（通常是一个拼图图标），打开侧边栏面板。
    提示：您也可以使用快捷键 `Alt+P` (可在 `chrome://extensions/shortcuts` 自定义) 来快速打开/关闭面板。
2.  侧边栏包含三个主要标签页：**聊天 (Chat)**、**助手 (Agents)** 和 **模型 (Model)**。

    *   **聊天 (Chat) 标签页:**
        *   从顶部的下拉菜单中选择所需的 Gemini 模型和助手 (Agent)。
        *   页面内容可以在面板打开时自动提取（可在“模型”标签页配置），或通过点击“提取页面”按钮手动提取。状态栏（“上下文: ... 字符”）会显示页面内容是否已加载。
        *   在底部的输入框中输入您的消息或问题。
        *   使用图片图标上传图片，或直接将图片粘贴到输入区域。图片预览会显示在输入框上方。
        *   点击“发送”按钮或按 Enter 键（不要同时按 Shift 键）发送您的消息和附加的图片。
        *   使用“总结一下”快捷操作按钮（如果可见）让 AI 总结页面内容。
        *   使用“提取页面”按钮旁边的垃圾桶图标清除整个聊天记录和页面上下文。
        *   鼠标悬停在单条消息上时，会出现相应的图标，可以删除或重新生成该消息。代码块和完整的 AI 回复可以通过各自的复制图标进行复制。

    *   **助手 (Agents) 标签页:**
        *   在这里管理您的自定义 AI 助手。
        *   点击“添加新助手”以创建具有默认设置的新助手。
        *   从左侧列表中选择一个现有助手以查看和编辑其设置：
            *   **助手名称:** 为您的助手起一个描述性的名称。
            *   **系统提示词:** 定义助手的角色、指令或背景信息。
            *   **温度 (Temperature)、最大Token数 (Max Tokens)、Top P:** 调整生成参数。
        *   修改后点击“保存助手设置”。
        *   使用列表中助手名称旁边的垃圾桶图标删除助手（至少需要保留一个助手）。

    *   **模型 (Model) 标签页:**
        *   **API 密钥:** 在此处输入您的 Google AI Studio API 密钥。您可以从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取。
        *   点击“测试连接”以验证您的 API 密钥和所选模型是否有效。
        *   点击“保存模型设置”以保存您的 API 密钥、模型选择和自动提取偏好。
        *   **模型选择:** 选择用于对话的默认 Gemini 模型。
        *   **打开时自动提取页面内容:** 如果希望每次打开面板时 Pagetalk 都自动尝试提取页面内容，请勾选此框。

## 项目结构

```
Pagetalk/
├── magic.png             # 插件图标
├── manifest.json         # 插件清单文件 (权限、脚本等)
├── package.json          # 项目元数据和依赖
├── package-lock.json     # 依赖的精确版本锁定
├── README.md             # 英文说明文档
├── README-zh.md          # 本文件 (中文说明文档)
├── css/                  # CSS 样式文件
│   ├── code-highlight.css # 代码块语法高亮样式
│   ├── content-panel.css # 注入的内容面板容器样式 (iframe 外部)
│   └── sidepanel.css     # 侧边栏界面样式 (iframe 内部)
├── html/                 # HTML 文件
│   └── sidepanel.html    # 侧边栏界面 HTML 结构
└── js/                   # JavaScript 脚本
    ├── background.js     # Service Worker (处理后台任务和事件)
    ├── content.js        # 内容脚本 (注入网页，管理 iframe, 提取内容)
    ├── markdown-renderer.js # 处理 Markdown 到 HTML 的转换 (用于聊天消息)
    ├── sidepanel.js      # 侧边栏界面核心逻辑 (聊天、助手、设置、API 调用)
    └── lib/              # 第三方库
        └── markdown-it.min.js # Markdown 解析和渲染库
```

*   **`manifest.json`**: 根据 Manifest V3 标准定义插件的属性、权限、后台脚本、内容脚本和界面元素。
*   **`css/`**: 包含插件不同部分的样式表。
    *   `code-highlight.css`: 为聊天中渲染的代码块提供基本的语法高亮样式。
    *   `content-panel.css`: 由 `content.js` 应用于网页上容纳侧边栏 iframe 的容器元素的样式。
    *   `sidepanel.css`: 控制侧边栏 (`sidepanel.html`) 内用户界面外观和布局的主要样式表。
*   **`html/sidepanel.html`**: 加载到侧边栏 iframe 中的 HTML 文件。它定义了聊天界面、助手设置和模型配置标签页的结构 (DOM 元素)。
*   **`js/`**: 包含驱动插件功能的核心 JavaScript 逻辑。
    *   `background.js`: 插件的 Service Worker。它在后台运行，管理安装或图标点击等事件，处理上下文菜单创建，并协调插件不同部分之间的通信。
    *   `content.js`: 该脚本直接注入到用户访问的网页中。其主要职责是创建和管理侧边栏的 iframe 容器，在需要时从网页提取主要文本内容，并与 `background.js` 和 `sidepanel.js` 进行通信。
    *   `markdown-renderer.js`: 一个实用工具脚本，使用 `markdown-it` 库将 Markdown 文本（从 Gemini API 接收）安全地转换为 HTML，以便在聊天界面中显示。它还处理代码块和链接等元素的自定义渲染。
    *   `sidepanel.js`: 这是在 `sidepanel.html` iframe 内运行的主要脚本。它控制整个侧边栏 UI，包括标签页切换、聊天消息显示、用户输入处理、图片处理、助手管理（创建、编辑、保存）、设置配置（API 密钥、模型选择）、与 `content.js` 的通信（通过 `postMessage` 进行内容提取和面板控制），以及实际调用 Gemini 服务的 API 请求。
    *   `js/lib/markdown-it.min.js`: 压缩后的 `markdown-it` 库，由 `markdown-renderer.js` 用于解析和渲染 Markdown 文本。

## 未来工作

*   支持在聊天响应中渲染 Mermaid 图表。
*   支持渲染 LaTeX 数学公式。
*   可能支持其他 AI 模型或服务提供商。