<h1 align="center">
  <strong>PageTalk - Your Web Companion with Gemini ✨</strong>
</h1>

<p align="center">
  <a href="https://github.com/jeanchristophe13v/PageTalk"> <!-- Replace with your repo link if available -->
    <img src="magic.png?raw=true" alt="Pagetalk Icon" title="Pagetalk Icon" width="250">
  </a>
</p>

#### [中文/Chinese](README-zh.md)

### Version 2.5.0 - The Smart Leap! 🎉🎉🎉

*   **Smart Budget for Gemini 2.5 Flash:** Automatically adjusts the `thinking_budget` based on query complexity when using `gemini-2.5-flash-preview-04-17` – no manual tuning needed!
*   **Enhanced Theme Adaptation:** Further improvements to automatic light/dark theme switching.
*   *(Why 2.5.0 and not 2.4.0? Well, someone might have mistyped the version number... and 2.5.0 just looked cooler! 😉)*

## Introduction

Pagetalk is a browser extension that enhances your web browsing by integrating Google's Gemini API. Summarize pages, chat contextually, and manage custom AI agents effortlessly.


## Features

*   **Web Page Interaction:** Reads page content for contextual conversations.
*   **Gemini API Integration:** Leverages Gemini for powerful language tasks.
*   **Contextual Chat:** Discuss the current web page with AI.
*   **Multi-Agent System:** Create, customize, switch, and **import/export** AI agents.
*   **Model Selection:** Choose from various Gemini models.
*   **Image Input:** Upload or paste images for discussion.
*   **Rich Content Rendering:** Supports Markdown, code highlighting, **LaTeX**, and **Mermaid** diagrams.
*   **Personalized Settings:** Configure API key, **language (EN/ZH)**, **theme (Light/Dark)**.
*   **Chat Export:** Save conversations as Markdown or Text files.
*   **Resizable Panel:** Adjust the side panel width.

## Examples
![image](https://github.com/user-attachments/assets/4aa393e4-659d-433a-9d4c-583217c95158)

![image](https://github.com/user-attachments/assets/0dc31cbc-b714-4037-8185-cba15f7e4238)

![image](https://github.com/user-attachments/assets/58256468-0ce8-476b-9383-e9dab566dd24)




## Installation

**Note:** Load as an unpacked extension in developer mode.
**Get API Key:** Before using the extension, please obtain your Gemini API key from [Google AI Studio](https://aistudio.google.com).

1. **clone the repository or download the ZIP**
```
git clone https://github.com/jeanchristophe13v/PageTalk.git
```

2. **Load the folder** in your Browser
- **Edge:** Go to `edge://extensions/`, enable "Developer mode", click "Load unpacked", select the project folder.
- **Chrome:** Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", select the project folder.

## Usage

1.  **Open:** Click the Pagetalk icon or use shortcut (default `Alt+P`).
2.  **Chat Tab:**
    *   Select Model/Agent.
    *   Extract page content (auto or manual). Status shows context length.
    *   Type message or paste/upload images.
    *   Send message (Enter or button).
    *   Use "Summarize" quick action.
    *   Clear history/context (trash icon).
    *   Hover over messages to copy/delete/regenerate.
    *   AI responses with LaTeX (`$...$`, `$$...$$`) or Mermaid (```mermaid ... ```) syntax will render automatically. Click Mermaid diagrams to zoom/pan.
3.  **Settings Tab:** (Contains General, Agents, Model sub-tabs)
    *   **General:** Switch Language/Theme, Export Chat History.
    *   **Agents:** Manage agents, Import/Export configurations.
    *   **Model:** Set API Key, select default model, toggle auto-extract.

## Project Structure

```
Pagetalk/
├── magic.png             # Icon
├── manifest.json         # Extension manifest
├── README.md             # English Readme
├── README-zh.md          # Chinese Readme
├── css/                  # Stylesheets
│   ├── code-highlight.css
│   ├── content-panel.css
│   └── sidepanel.css
├── html/                 # HTML files
│   └── sidepanel.html
└── js/                   # JavaScript logic
    ├── background.js     # Service worker
    ├── content.js        # Content script
    ├── markdown-renderer.js # Markdown rendering logic
    ├── sidepanel.js      # Side panel UI core logic
    ├── api.js            # Gemini API interaction logic
    ├── translations.js   # UI string translations
    └── lib/              # Third-party libraries
        ├── markdown-it.min.js
        ├── katex.min.js      # LaTeX rendering
        ├── mermaid.min.js    # Mermaid diagram rendering
        ├── dayjs.min.js      # Date/time utility
        ├── panzoom.min.js    # Zoom/pan utility (for Mermaid)
        └── ...             # Other libraries (highlight.js, etc.)
