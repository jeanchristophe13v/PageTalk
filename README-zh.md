# Pagetalk - 浏览器插件

[English](README.md)

## 简介

Pagetalk 是一款可以读取页面内容，调用 Gemini API 进行问答的浏览器插件。它允许您自定义多个助手，并选择不同的模型进行对话。

## 注意

### 目前仍不支持：

- Mermaid渲染
- LaTeX渲染
- 其他模型支持

## 安装

### Edge

1.  打开 Edge 浏览器，输入 `edge://extensions/` 并回车。
2.  打开“开发者模式”。
3.  点击“加载解压缩的扩展”，选择本项目的根目录。

### Chrome

1.  打开 Chrome 浏览器，输入 `chrome://extensions/` 并回车。
2.  打开“开发者模式”。
3.  点击“加载已解压的扩展程序”，选择本项目的根目录。

## 使用

1.  安装插件后，点击浏览器工具栏上的 Pagetalk 图标，打开侧边栏。
2.  在侧边栏中，您可以：
    *   选择模型。
    *   选择助手。
    *   输入您的问题。
    *   点击“发送”按钮。
3.  插件会将您的问题发送到 Gemini API，并将返回的答案显示在侧边栏中。

## 工程结构

```
Pagetalk/
├── extension.js          # 插件入口文件
├── magic.png             # 插件图标
├── manifest.json         # 插件清单文件
├── package.json          # 项目依赖和脚本
├── SidebarProvider.js    # 侧边栏提供者
├── css/                  # CSS 样式文件
│   ├── content-panel.css # 内容脚本样式
│   ├── content-script.css# 页面内容样式
│   └── sidepanel.css     # 侧边栏样式
├── html/                 # HTML 页面
│   └── sidepanel.html    # 侧边栏 HTML 结构
├── js/                   # JavaScript 脚本
│   ├── background.js     # 后台脚本
│   ├── content.js        # 内容脚本
│   ├── google-generative-ai.min.js # Gemini API 库
│   ├── popup.js          # 弹出窗口脚本
│   └── sidepanel.js      # 侧边栏脚本
├── node_modules/         # 项目依赖模块
└── webview/              # WebView 相关文件
    └── main.js           # WebView 主脚本
```

*   `extension.js`: 插件的入口文件，负责注册侧边栏和命令。
*   `magic.png`: 插件的图标。
*   `manifest.json`: 插件的清单文件，包含插件的基本信息、权限等。
*   `package.json`: 项目的依赖关系和脚本。
*   `SidebarProvider.js`: 侧边栏的提供者，负责创建和管理侧边栏。
*   `css/`: 包含 CSS 样式文件。
    *   `content-panel.css`: 内容脚本的样式。
    *   `content-script.css`: 页面内容的样式。
    *   `sidepanel.css`: 侧边栏的样式。
*   `html/`: 包含 HTML 页面。
    *   `sidepanel.html`: 侧边栏的 HTML 结构。
*   `js/`: 包含 JavaScript 脚本。
    *   `background.js`: 后台脚本，负责处理插件的后台逻辑。
    *   `content.js`: 内容脚本，负责从网页中提取内容并与面板通信。
    *   `google-generative-ai.min.js`: Gemini API 库。
    *   `popup.js`: 弹出窗口脚本。
    *   `sidepanel.js`: 侧边栏的脚本，负责处理侧边栏的交互逻辑。
*   `node_modules/`: 项目的依赖模块。
*   `webview/`: 包含 WebView 相关文件。
    *   `main.js`: WebView 主脚本。