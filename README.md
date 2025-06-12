<h1 align="center">
  <strong>PageTalk - Your Web Companion with Gemini ✨</strong>
</h1>

<p align="center">
  <a href="https://github.com/jeanchristophe13v/PageTalk"> <!-- Replace with your repo link if available -->
    <img src="magic.png?raw=true" alt="Pagetalk Icon" title="Pagetalk Icon" width="250">
  </a>
</p>

#### [中文/Chinese](README-zh.md)

## Introducing PageTalk 3.0.0 🎉

**New Features:**
- **New Multi-Tab Interaction:** Type `@` in the input box to select other open tabs and include their content in the conversation context. 🌐
- **YouTube URL Parsing Support:** 📺
    - Gemini 2.0-flash can parse one video URL at a time.
    - Gemini 2.5-flash can parse multiple video URLs.
    - *Note for 2.0-flash users: If you encounter a "Only one link can be uploaded at a time" prompt, please ignore it and click the "Regenerate" button.*
- **Optimizations & Bug Fixes:**
    - UI/UX Enhancements: Refactored UI and optimized animations for a more intuitive and visually appealing experience. ✨
    - Numerous Bug Fixes: Addressed and resolved various bugs. 🐛

---

**Type @ to select opened tabs**
<br>
<img src="https://github.com/user-attachments/assets/23d3b878-52f3-437a-a85a-c7d53f194fe7" alt="image" width="600"/>
<br><br>

**All selected tabs on it**
<br>
<img src="https://github.com/user-attachments/assets/17d27bb0-47a9-4297-a8aa-8d637679a807" alt="image" width="600"/>
<br><br>

**Tell PageTalk to summarize all of it**
<br>
<img src="https://github.com/user-attachments/assets/dc001071-2580-414f-a5ce-f127f966e50d" alt="image" width="600"/>
<br><br>

**Upload YouTube urls**
<br>
<img src="https://github.com/user-attachments/assets/dc5b1978-6bd6-4305-99d0-d1f9c18f9ca5" alt="image" width="600"/>
<br><br>

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

## Examples
<img src="https://github.com/user-attachments/assets/4aa393e4-659d-433a-9d4c-583217c95158" alt="image" width="600"/>
<br><br>
<img src="https://github.com/user-attachments/assets/0dc31cbc-b714-4037-8185-cba15f7e4238" alt="image" width="600"/>
<br><br>
<img src="https://github.com/user-attachments/assets/58256468-0ce8-476b-9383-e9dab566dd24" alt="image" width="600"/>
<br><br>
<img src="https://github.com/user-attachments/assets/9fef9086-be70-448c-b23e-e79629e42d2a" alt="image" width="600"/>
<br><br>



## Installation

**Note:** Load as an unpacked extension in developer mode.

**Get API Key:** Before using the extension, please obtain your Gemini API key from [Google AI Studio](https://aistudio.google.com).

### For common use
1. chrome: https://chromewebstore.google.com/detail/pagetalk-your-gemini-brow/pjmpcpolpfejiacaemgjnjnknlcfcami?authuser=0
  
2. edge： https://microsoftedge.microsoft.com/addons/detail/pagetalk-your-gemini-br/mpmohgpcggkkbjdamcnmmnkblkmpldmi

Firefox is not available yet. 
Stay tuned~

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
    *   **Model:** Set API Key, select default model, and optionally configure a **Custom API Endpoint**.
        *   **Custom API Endpoint:** This setting allows you to route Google Gemini API requests through an intermediary service (e.g., OneAPI). This can be useful for users in regions with restricted access to Google's direct APIs or for those who wish to leverage features like API key rotation, caching, or advanced logging provided by such services.
        *   **Example:** `https://my-oneapi-instance.com/v1beta` (ensure the path matches what your intermediary service expects for Gemini).
        *   **Default:** If left empty, the extension uses `https://generativelanguage.googleapis.com/v1beta`.
 
## 💗 Thanks support from DartNode 

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")
