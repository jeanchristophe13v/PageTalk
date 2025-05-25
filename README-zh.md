<h1 align="center">
  <strong>PageTalk - 你的网页 Gemini 助手 ✨</strong>
</h1>

<p align="center">
  <a href="https://github.com/jeanchristophe13v/PageTalk"> <!-- 如果有仓库链接，请替换 -->
    <img src="magic.png?raw=true" alt="Pagetalk 图标" title="Pagetalk 图标" width="250">
  </a>
</p>

#### [English/英文](README.md)

## PageTalk 2.7.5  🎉

**新特性：**  
- **新增 PDF 解析功能（在线，非本地）**：现在可以在网页中的 PDF 和 PageTalk 对话。
- 聊天界面的小幅优化。
- 修复了 agent 的删除 bug。

![b5d6f628b841d2c7103ec4cccba8c38c](https://github.com/user-attachments/assets/b408c5ab-cc73-4a44-80a3-6dcd9d0be53b)


## 简介

Pagetalk 是一款浏览器插件，通过集成 Google Gemini API 来增强您的网页浏览体验。轻松总结页面、进行上下文对话，并管理自定义 AI 助手。


## 主要特性

*   **网页交互:** 读取页面内容，提供对话上下文。
*   **上下文聊天:** 与 AI 讨论当前网页内容。
*   **多助手系统:** 创建、自定义、切换并**导入/导出** AI 助手。
*   **图片输入:** 上传或粘贴图片进行讨论。
*   **富文本渲染:** 支持 Markdown、代码高亮、**LaTeX** 公式和 **Mermaid** 图表。
*   **PDF 解析与对话:** 支持网页内 PDF 文件内容提取与对话。
*   **URL 上下文提取:** Gemini-2.0-flash 和 Gemini-2.5-flash-preview-05-20 ( gemini-2.5-flash(-thinking) )支持自动提取网页内容作为上下文。
*   **个性化设置:** 配置 API 密钥、**语言 (中/英)**、**主题 (浅色/深色)**。
*   **聊天导出:** 将对话保存为 Markdown 或纯文本文件。

## 用例
![image](https://github.com/user-attachments/assets/4aa393e4-659d-433a-9d4c-583217c95158)

![image](https://github.com/user-attachments/assets/0dc31cbc-b714-4037-8185-cba15f7e4238)

![image](https://github.com/user-attachments/assets/58256468-0ce8-476b-9383-e9dab566dd24)

![9291f32857cc26e4f039f5ec72ab07bc](https://github.com/user-attachments/assets/c23d2919-aa7c-427a-80a8-1b08a5f46a5c)

## 安装

**注意:** 需要在开发者模式下以“加载已解压的扩展程序”方式安装。

**获取 API 密钥:** 在使用插件前，请先从 [Google AI Studio](https://aistudio.google.com) 获取您的 Gemini API 密钥。

1. **克隆仓库或直接下载 ZIP 并解压**
```
git clone https://github.com/jeanchristophe13v/PageTalk.git
```

2. **加载插件文件夹**
- **Edge:** 地址栏输入 `edge://extensions/` -> 启用“开发者模式” -> 点击“加载解压缩的扩展” -> 选择项目文件夹。
- **Chrome:** 地址栏输入 `chrome://extensions/` -> 启用“开发者模式” -> 点击“加载已解压的扩展程序” -> 选择项目文件夹。

## 使用说明

- **打开:** 点击 Pagetalk 图标或使用快捷键 (默认 `Alt+P`)。
- **设置标签页:** (包含通用、助手、模型子标签页)
    *   **通用:** 切换语言/主题，导出聊天记录。
    *   **助手:** 管理助手，导入/导出配置。
    *   **模型:** 设置 API 密钥，选择默认模型。
