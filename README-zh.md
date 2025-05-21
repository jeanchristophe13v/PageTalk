<h1 align="center">
  <strong>PageTalk - 你的网页 Gemini 助手 ✨</strong>
</h1>

<p align="center">
  <a href="https://github.com/jeanchristophe13v/PageTalk"> <!-- 如果有仓库链接，请替换 -->
    <img src="magic.png?raw=true" alt="Pagetalk 图标" title="Pagetalk 图标" width="250">
  </a>
</p>

#### [English/英文](README.md)

## 简介

Pagetalk 是一款浏览器插件，通过集成 Google Gemini API 来增强您的网页浏览体验。轻松总结页面、进行上下文对话，并管理自定义 AI 助手。


## 主要特性

*   **网页交互:** 读取页面内容，提供对话上下文。
*   **Gemini API 集成:** 利用 Gemini 实现强大的语言功能。
*   **上下文聊天:** 与 AI 讨论当前网页内容。
*   **多助手系统:** 创建、自定义、切换并**导入/导出** AI 助手。
*   **模型选择:** 可选择多种 Gemini 模型。
*   **图片输入:** 上传或粘贴图片进行讨论。
*   **富文本渲染:** 支持 Markdown、代码高亮、**LaTeX** 公式和 **Mermaid** 图表。
*   **个性化设置:** 配置 API 密钥、**语言 (中/英)**、**主题 (浅色/深色)**。
*   **聊天导出:** 将对话保存为 Markdown 或纯文本文件。
*   **可调整面板:** 调整侧边栏宽度。

## 用例
![image](https://github.com/user-attachments/assets/4aa393e4-659d-433a-9d4c-583217c95158)

![image](https://github.com/user-attachments/assets/0dc31cbc-b714-4037-8185-cba15f7e4238)

![image](https://github.com/user-attachments/assets/58256468-0ce8-476b-9383-e9dab566dd24)


## 安装

**注意:** 需要在开发者模式下以“加载已解压的扩展程序”方式安装。
**获取 API 密钥:** 在使用插件前，请先从 [Google AI Studio](https://aistudio.google.com) 获取您的 Gemini API 密钥。

1. **克隆仓库或直接下载 ZIP**
```
git clone https://github.com/jeanchristophe13v/PageTalk.git
```

2. **加载插件文件夹**
- **Edge:** 地址栏输入 `edge://extensions/` -> 启用“开发者模式” -> 点击“加载解压缩的扩展” -> 选择项目文件夹。
- **Chrome:** 地址栏输入 `chrome://extensions/` -> 启用“开发者模式” -> 点击“加载已解压的扩展程序” -> 选择项目文件夹。

## 使用说明

1.  **打开:** 点击 Pagetalk 图标或使用快捷键 (默认 `Alt+P`)。
2.  **聊天标签页:**
    *   选择模型/助手。
    *   提取页面内容（自动或手动），状态栏显示上下文长度。
    *   输入消息或粘贴/上传图片。
    *   发送消息（回车或按钮）。
    *   使用“总结一下”快捷操作。
    *   清除历史记录/上下文（垃圾桶图标）。
    *   鼠标悬停消息可复制/删除/重新生成。
    *   AI 回复中的 LaTeX (`$...$`, `$$...$$`) 或 Mermaid (```mermaid ... ```) 语法将自动渲染。点击 Mermaid 图表可缩放/平移查看。
3.  **设置标签页:** (包含通用、助手、模型子标签页)
    *   **通用:** 切换语言/主题，导出聊天记录。
    *   **助手:** 管理助手，导入/导出配置。
    *   **模型:** 设置 API 密钥，选择默认模型，开关自动提取。

## 项目结构

```
Pagetalk/

├── magic.png             # Extension icon
├── manifest.json         # Extension manifest
├── README.md             # English Readme
├── README-zh.md          # Chinese Readme
├── css/                  # Stylesheets
│   ├── content-panel.css
│   ├── github-dark-dimmed.min.css # GitHub dark theme code highlight style
│   ├── github.min.css    # GitHub light theme code highlight style
│   ├── katex.min.css     # LaTeX rendering style
│   └── sidepanel.css
├── html/                 # HTML files
│   └── sidepanel.html    # Side panel HTML
└── js/                   # JavaScript logic
    ├── agent.js          # Agent management logic
    ├── api.js            # API interaction logic
    ├── background.js     # Service Worker
    ├── chat.js           # Chat logic
    ├── content.js        # Content script
    ├── image.js          # Image processing logic
    ├── main.js           # Main entry file
    ├── markdown-renderer.js # Markdown rendering logic
    ├── render.js         # Rendering related logic
    ├── settings.js       # Settings logic
    ├── theme.js          # Theme logic
    ├── translations.js   # UI string translations
    ├── ui.js             # UI interaction logic
    ├── utils.js          # Utility functions
    └── lib/              # Third-party libraries
        ├── auto-render.min.js # LaTeX auto-rendering
        ├── dayjs.min.js      # Date/time utility
        ├── en.min.js         # dayjs English locale
        ├── highlight.min.js  # Code highlight core
        ├── java.min.js       # highlight.js Java language
        ├── javascript.min.js # highlight.js JavaScript language
        ├── json.min.js       # highlight.js JSON language
        ├── katex.min.js      # LaTeX rendering
        ├── markdown-it.min.js # Markdown parsing
        ├── mathtex-script-type.min.js # KaTeX script type support
        ├── mermaid.min.js    # Mermaid diagram rendering
        ├── mhchem.min.js     # KaTeX chemical formula support
        ├── panzoom.min.js    # Zoom/pan utility (for Mermaid)
        ├── python.min.js     # highlight.js Python language
        ├── r.min.js          # highlight.js R language
        ├── Readability.js    # Web page content extraction
        ├── render-a11y-string.min.js # KaTeX accessibility string rendering
        ├── sql.min.js        # highlight.js SQL language
        └── zh-cn.min.js      # dayjs Chinese locale
