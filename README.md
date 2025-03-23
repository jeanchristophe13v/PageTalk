# Pagetalk - Browser Extension
[中文/Chinese](README-zh.md) | [English](README-en.md)

## Introduction

Pagetalk is a browser extension that allows you to read page content and use the Gemini API to ask questions. It allows you to customize multiple agents and select different models for conversation.

## Installation

### Edge

1.  Open the Edge browser and enter `edge://extensions/`.
2.  Turn on "Developer mode".
3.  Click "Load unpacked extension" and select the root directory of this project.

### Chrome

1.  Open the Chrome browser and enter `chrome://extensions/`.
2.  Turn on "Developer mode".
3.  Click "Load unpacked extension" and select the root directory of this project.

## Usage

1.  After installing the extension, click the Pagetalk icon on the browser toolbar to open the sidebar.
2.  In the sidebar, you can:
    *   Select a model.
    *   Select an agent.
    *   Enter your question.
    *   Click the "Send" button.
3.  The extension will send your question to the Gemini API and display the returned answer in the sidebar.

## Project Structure

```
Pagetalk/
├── extension.js          # Plugin entry file
├── magic.png             # Plugin icon
├── manifest.json         # Plugin manifest file
├── package.json          # Project dependencies and scripts
├── SidebarProvider.js    # Sidebar provider
├── css/                  # CSS style files
│   ├── content-panel.css # Content script styles
│   ├── content-script.css# Page content styles
│   └── sidepanel.css     # Sidebar styles
├── html/                 # HTML pages
│   └── sidepanel.html    # Sidebar HTML structure
├── js/                   # JavaScript scripts
│   ├── background.js     # Background script
│   ├── content.js        # Content script
│   ├── google-generative-ai.min.js # Gemini API library
│   ├── popup.js          # Popup window script
│   └── sidepanel.js      # Sidebar script
├── node_modules/         # Project dependency modules
└── webview/              # WebView related files
    └── main.js           # WebView main script
```

*   `extension.js`: The entry file of the plugin, responsible for registering the sidebar and commands.
*   `magic.png`: The icon of the plugin.
*   `manifest.json`: The manifest file of the plugin, including the basic information and permissions of the plugin.
*   `package.json`: The dependencies and scripts of the project.
*   `SidebarProvider.js`: The provider of the sidebar, responsible for creating and managing the sidebar.
*   `css/`: Contains CSS style files.
    *   `content-panel.css`: The style of the content script.
    *   `content-script.css`: The style of the page content.
    *   `sidepanel.css`: The style of the sidebar.
*   `html/`: Contains HTML pages.
    *   `sidepanel.html`: The HTML structure of the sidebar.
*   `js/`: Contains JavaScript scripts.
    *   `background.js`: The background script, responsible for handling the background logic of the plugin.
    *   `content.js`: The content script, responsible for extracting content from the web page and communicating with the panel.
    *   `google-generative-ai.min.js`: The Gemini API library.
    *   `popup.js`: The popup window script.
    *   `sidepanel.js`: The script of the sidebar, responsible for handling the interaction logic of the sidebar.
*   `node_modules/`: The dependency modules of the project.
*   `webview/`: Contains WebView related files.
    *   `main.js`: The main script of WebView.
