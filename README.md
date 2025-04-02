<h1 align="center">
  <strong>PageTalk - A beautiful browser extension with Gemini ✨</strong>
</h1>



<p align="center">
  <a href="https://github.com/jeanchristophe13v/PageTalk">
    <img src="magic.png?raw=true" alt="Pagetalk Icon" title="Pagetalk Icon" width="250">
  </a>
</p>


#### [中文/Chinese](README-zh.md)

## Introduction

Pagetalk is a browser extension designed to enhance your web browsing experience by integrating the power of Google's Gemini API. It allows you to effortlessly summarize web page content, engage in contextual conversations about the page, and manage multiple customized AI assistants (agents).

## Features

*   **Web Page Interaction:** Reads and extracts the main content from the current web page to provide context for your conversations.
*   **Gemini API Integration:** Connects directly to the Gemini API for powerful language understanding and generation capabilities.
*   **Contextual Chat:** Engage in meaningful conversations with Gemini based on the content of the web page you are currently viewing.
*   **Multi-Agent System:** Create, customize, and easily switch between multiple AI agents. Each agent can have its own unique system prompt and parameter settings (temperature, max tokens, topP).
*   **Model Selection:** Choose from various available Gemini models to suit your needs.
*   **Image Input:** Upload or paste images directly into the chat to discuss them with Gemini (requires a vision-compatible model).
*   **Customizable Settings:** Configure your Google AI Studio API key, select your preferred default model, manage agent parameters, and toggle automatic content extraction.
*   **Resizable Panel:** Adjust the width of the side panel for optimal viewing comfort.

## Installation

**Note:** This extension is loaded as an unpacked extension in developer mode.

### Edge

1.  Open the Edge browser and navigate to `edge://extensions/`.
2.  Enable "Developer mode" using the toggle switch.
3.  Click "Load unpacked" and select the root directory where you cloned or downloaded this project.

### Chrome

1.  Open the Chrome browser and navigate to `chrome://extensions/`.
2.  Enable "Developer mode" using the toggle switch.
3.  Click "Load unpacked" and select the root directory where you cloned or downloaded this project.

## Usage

1.  After installation, click the Pagetalk icon (puzzle piece icon) in your browser toolbar to open the side panel.
    Tip: You can also use the shortcut `Alt+P` (customizable at `chrome://extensions/shortcuts`) to quickly open/close the panel.
2.  The side panel has three main tabs: **Chat**, **Agents**, and **Model**.

    *   **Chat Tab:**
        *   Select the desired Gemini model and Agent from the dropdown menus at the top.
        *   Page content can be extracted automatically when the panel opens (configurable in the Model tab) or manually by clicking the "Extract Page" button. The status ("Context: ... chars") indicates if page content is loaded.
        *   Type your message or question in the input box at the bottom.
        *   Upload images using the Image icon or paste images directly into the input area. Image previews will appear above the input box.
        *   Click "Send" or press Enter (without Shift) to send your message and any attached images.
        *   Use the "Summarize" quick action button (if visible) to ask the AI to summarize the page content.
        *   Clear the entire chat history and page context using the trash can icon next to the "Extract Page" button.
        *   Individual messages can be deleted or regenerated using the icons that appear on hover. Code blocks and full AI responses can be copied using their respective copy icons.

    *   **Agents Tab:**
        *   Manage your custom AI assistants here.
        *   Click "Add New Agent" to create a new assistant with default settings.
        *   Select an existing agent from the list on the left to view and edit its settings:
            *   **Agent Name:** Give your agent a descriptive name.
            *   **System Prompt:** Define the agent's persona, instructions, or context.
            *   **Temperature, Max Tokens, Top P:** Adjust the generation parameters.
        *   Click "Save Agent Settings" after making modifications.
        *   Delete an agent (except the last one) using the trash can icon next to its name in the list.

    *   **Model Tab:**
        *   **API Key:** Enter your Google AI Studio API Key here. Get one from [Google AI Studio](https://aistudio.google.com/app/apikey).
        *   Click "Test Connection" to verify your API key and selected model.
        *   Click "Save Model Settings" to save your API key, model selection, and auto-extract preference.
        *   **Model Selection:** Choose the default Gemini model to be used for conversations.
        *   **Auto Extract Page Content on Open:** Check this box if you want Pagetalk to automatically try extracting page content every time you open the panel.

## Project Structure

```
Pagetalk/
├── magic.png             # Extension icon
├── manifest.json         # Extension manifest file (permissions, scripts, etc.)
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Exact dependency versions
├── README.md             # This file (English Readme)
├── README-zh.md          # Chinese Readme
├── css/                  # CSS style files
│   ├── code-highlight.css # Styles for code block syntax highlighting
│   ├── content-panel.css # Styles for the injected content panel (iframe container)
│   └── sidepanel.css     # Styles for the side panel UI (inside the iframe)
├── html/                 # HTML files
│   └── sidepanel.html    # HTML structure for the side panel UI
└── js/                   # JavaScript scripts
    ├── background.js     # Service worker handling background tasks and events
    ├── content.js        # Content script injected into web pages (manages iframe, extracts content)
    ├── markdown-renderer.js # Handles Markdown to HTML conversion for chat messages
    ├── sidepanel.js      # Core logic for the side panel UI (chat, agents, settings, API calls)
    └── lib/              # Third-party libraries
        └── markdown-it.min.js # Markdown parsing and rendering library
```

*   **`manifest.json`**: Defines the extension's properties, permissions, background script, content scripts, and UI elements according to the Manifest V3 standard.
*   **`css/`**: Contains stylesheets for different parts of the extension.
    *   `code-highlight.css`: Provides basic styling for syntax highlighting in code blocks rendered in the chat.
    *   `content-panel.css`: Styles applied by `content.js` to the container element that holds the side panel iframe on the web page.
    *   `sidepanel.css`: The main stylesheet governing the appearance and layout of the user interface within the side panel (`sidepanel.html`).
*   **`html/sidepanel.html`**: The HTML file loaded into the side panel's iframe. It defines the structure (DOM elements) for the chat interface, agent settings, and model configuration tabs.
*   **`js/`**: Contains the core JavaScript logic driving the extension's functionality.
    *   `background.js`: The extension's service worker. It runs in the background, manages events like installation or icon clicks, handles context menu creation, and facilitates communication between different parts of the extension.
    *   `content.js`: This script is injected directly into web pages the user visits. Its main responsibilities are to create and manage the iframe container for the side panel, extract the main text content from the web page when requested, and communicate with both `background.js` and `sidepanel.js`.
    *   `markdown-renderer.js`: A utility script that uses the `markdown-it` library to safely convert Markdown text (received from the Gemini API) into HTML for display within the chat interface. It also handles custom rendering for elements like code blocks and links.
    *   `sidepanel.js`: This is the primary script running within the `sidepanel.html` iframe. It controls the entire side panel UI, including tab switching, chat message display, user input handling, image processing, agent management (creation, editing, saving), settings configuration (API key, model selection), communication with `content.js` (via `postMessage` for content extraction and panel control), and making the actual API calls to the Gemini service.
    *   `js/lib/markdown-it.min.js`: The minified `markdown-it` library, used by `markdown-renderer.js` for parsing and rendering Markdown text.

## Future Work

*   Support for rendering Mermaid diagrams within chat responses.
*   Support for rendering LaTeX mathematical formulas.
*   Potential support for additional AI models or providers.
