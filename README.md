<h1 align="center">
  <strong>PageTalk - Your Web Companion with Gemini ✨</strong>
</h1>

<p align="center">
  <a href="https://github.com/jeanchristophe13v/PageTalk"> <!-- Replace with your repo link if available -->
    <img src="magic.png?raw=true" alt="Pagetalk Icon" title="Pagetalk Icon" width="250">
  </a>
</p>

#### [中文/Chinese](README-zh.md)

## Introducing PageTalk 3.5 🎉

**🌟 Text Selection Helper - The Game Changer:**
PageTalk is no longer just a sidebar AI extension! Now you can select any text on any webpage and instantly:
- **Interpret** complex content with AI analysis
- **Translate** to your preferred language
- **Chat** about the selected text with full context
- **Customize** your own selection options with personalized prompts

Simply select text → choose your action → get instant AI assistance. It's that simple!

**Other Updates:**
- **Enhanced Proxy Support:** Updated HTTP and SOCKS5 proxy functionality for better connectivity
- **Bug Fixes:** Resolved various minor issues for improved stability

*Note: If you encounter any issues, please try refreshing the webpage, reloading the extension, or restarting the browser first. For persistent problems, contact kronos13v@gmail.com*

---

**Text Selection Helper Demo (Screenshots coming soon)**

---

## Introduction

Pagetalk is a browser extension that enhances your web browsing by integrating Google's Gemini API. Summarize pages, chat contextually, and manage custom AI agents effortlessly.


## Features

*   **Web Page Interaction:** Reads page content for contextual conversations.
*   **Contextual Chat:** Discuss the current web page with AI.
*   **Multi-Agent System:** Create, customize, switch, and **import/export** AI agents.
*   **Image Input:** Upload or paste images for discussion.
*   **Rich Content Rendering:** Supports Markdown, code highlighting, **LaTeX**, and **Mermaid** diagrams.
*   **PDF Parsing & Chat:** Extract and chat with PDF content directly in web pages.
*   **Url Context Extraction:** Gemini-2.0-flash and Gemini-2.5-flash-preview-05-20（ gemini-2.5-flash(-thinking) ） can automatically extract web page content as context.
*   **Personalized Settings:** Configure API key, **language (EN/ZH)**, **theme (Light/Dark)**.
*   **Chat Export:** Save conversations as Markdown or Text files.
*   **Text Selection Helper:** Advanced text selection functionality with interpret, translate, and chat options.
*   **Proxy Support:** HTTP and SOCKS5 proxy support for enhanced connectivity.

## Examples

<details>
<summary><strong>📸 Feature Demonstrations (Click to expand)</strong></summary>

### Multi-Tab Interaction & YouTube Parsing
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
  <div>
    <img src="https://github.com/user-attachments/assets/23d3b878-52f3-437a-a85a-c7d53f194fe7" alt="Type @ to select tabs" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>Type @ to select opened tabs</em></p>
  </div>
  <div>
    <img src="https://github.com/user-attachments/assets/17d27bb0-47a9-4297-a8aa-8d637679a807" alt="Selected tabs display" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>All selected tabs context</em></p>
  </div>
  <div>
    <img src="https://github.com/user-attachments/assets/dc001071-2580-414f-a5ce-f127f966e50d" alt="AI summarization" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>AI summarizes all content</em></p>
  </div>
  <div>
    <img src="https://github.com/user-attachments/assets/dc5b1978-6bd6-4305-99d0-d1f9c18f9ca5" alt="YouTube URL parsing" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>Upload YouTube URLs</em></p>
  </div>
</div>

### Core Features Showcase
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
  <div>
    <img src="https://github.com/user-attachments/assets/4aa393e4-659d-433a-9d4c-583217c95158" alt="PageTalk interface" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>Main interface & chat</em></p>
  </div>
  <div>
    <img src="https://github.com/user-attachments/assets/0dc31cbc-b714-4037-8185-cba15f7e4238" alt="Agent management" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>AI agent management</em></p>
  </div>
  <div>
    <img src="https://github.com/user-attachments/assets/58256468-0ce8-476b-9383-e9dab566dd24" alt="Rich content rendering" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>Rich content rendering</em></p>
  </div>
  <div>
    <img src="https://github.com/user-attachments/assets/9fef9086-be70-448c-b23e-e79629e42d2a" alt="Settings panel" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"/>
    <p><em>Settings & customization</em></p>
  </div>
</div>

</details>



## Installation

**Note:** Load as an unpacked extension in developer mode.

**Get API Key:** Before using the extension, please obtain your Gemini API key from [Google AI Studio](https://aistudio.google.com).

### For common use
1. Chrome: https://chromewebstore.google.com/detail/pagetalk-your-gemini-brow/pjmpcpolpfejiacaemgjnjnknlcfcami?authuser=0
  
2. Edge： https://microsoftedge.microsoft.com/addons/detail/pagetalk-your-gemini-br/mpmohgpcggkkbjdamcnmmnkblkmpldmi

3. Firefox: https://addons.mozilla.org/zh-CN/firefox/addon/pagetalk-gemini-assistant/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search

> ps: ⚠️PageTalk in Firefox is yet incomplete for some reasons, but it's still good for summary and conversation. Stay tuned~

### For development 
1. **Clone the repository or download the ZIP and unzip**
```
git clone https://github.com/jeanchristophe13v/PageTalk.git
```

2. **Load the folder** in your Browser
- **Edge:** Go to `edge://extensions/`, enable "Developer mode", click "Load unpacked", select the project folder.
- **Chrome:** Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", select the project folder.

## Usage

- **Open:** Click the Pagetalk icon or use shortcut (default `Alt+P`).
- **Settings Tab:** (Contains General, Agents, Model sub-tabs)
    *   **General:** Switch Language/Theme, Export Chat History.
    *   **Agents:** Manage agents, Import/Export configurations.
    *   **Model:** Set API Key, select default model.
 
## 💗 Thanks support from DartNode 

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")
