// These entries should be merged into the existing en and zh_CN objects in js/translations.js

// --- English (en) ---
// In en object:
{
  "selectionAssistantSettingsNav": "Selection Assistant", // For sidepanel.html nav
  "selectionAssistantSettingsTitle": "Selection Assistant Settings", // For settings.js title

  // Fallback defaults for options bar in content.js if storage is empty
  "defaultInterpretName": "Interpret",
  "defaultInterpretPrompt": "Based on the page content, please interpret the selected text:",
  "defaultTranslateName": "Translate",
  "defaultTranslatePrompt": "Please translate the selected text between Chinese and English:",
  "defaultChatName": "Chat",

  // Modal Titles (content.js)
  "interpretModalTitle": "Interpret Text",
  "translateModalTitle": "Translate Text",
  "chatModalTitle": "Chat",

  // Common Modal/UI Text (content.js & settings.js)
  "loadingMessage": "Loading...",
  "copyButtonLabel": "Copy",
  "copiedButtonLabel": "Copied!",
  "regenerateButtonLabel": "Regenerate",
  "sendButtonLabel": "Send",
  "errorPrefix": "Error: ",
  "aiThinkingMessage": "AI is thinking...",
  "chatSendErrorMessage": "Error sending message.",
  "clearContextButtonLabel": "Clear Context",

  // Settings Page - Selection Assistant List (settings.js)
  "editOptionTooltip": "Edit",
  "deleteOptionTooltip": "Delete",
  "confirmDeleteOption": "Are you sure you want to delete \"{name}\"?",
  "cannotDeleteDefaultOptionTooltip": "Default options cannot be deleted.",
  "addNewOptionButton": "Add New Option",
  "dragToReorder": "Drag to reorder",

  // Settings Page - Editable Card Content (settings.js)
  "optionNameLabel": "Name",
  "modelLabel": "Model", // Also used in main model settings
  "systemPromptLabel": "System Prompt",
  "temperatureLabel": "Temperature",
  "chatOptionUsesPanelSettings": "'Chat' action uses settings from the main chat panel.",

  // Settings Page - Default values for new/initialized options (settings.js)
  // defaultInterpretName, defaultInterpretPrompt, etc. already covered above
  "newActionDefaultName": "New Action",
  "newActionDefaultPrompt": "Please process the following text:",

  // Toasts (settings.js & potentially content.js)
  // "saveFailedToast": "Save failed: {error}", // Assuming generic key exists
  "settingsSavedToast": "Settings Saved", // More generic
  "editToBeImplemented": "Edit functionality to be implemented.",

  // Chat Modal specific (content.js)
  "chatInputPlaceholder": "Type a message..."
}

// --- Chinese (zh_CN) ---
// In zh_CN object:
{
  "selectionAssistantSettingsNav": "划词助手",
  "selectionAssistantSettingsTitle": "划词助手设置",

  // Fallback defaults for options bar in content.js
  "defaultInterpretName": "解读",
  "defaultInterpretPrompt": "请根据以下页面内容，解读选中的文本：",
  "defaultTranslateName": "翻译",
  "defaultTranslatePrompt": "请将以下选中的文本在中文和英文之间互译：",
  "defaultChatName": "对话",

  // Modal Titles (content.js)
  "interpretModalTitle": "解读文本",
  "translateModalTitle": "翻译文本",
  "chatModalTitle": "对话",

  // Common Modal/UI Text (content.js & settings.js)
  "loadingMessage": "加载中...",
  "copyButtonLabel": "复制",
  "copiedButtonLabel": "已复制!",
  "regenerateButtonLabel": "重新生成",
  "sendButtonLabel": "发送",
  "errorPrefix": "错误: ",
  "aiThinkingMessage": "AI 正在思考...",
  "chatSendErrorMessage": "发送消息失败。",
  "clearContextButtonLabel": "清除上下文",

  // Settings Page - Selection Assistant List (settings.js)
  "editOptionTooltip": "编辑",
  "deleteOptionTooltip": "删除",
  "confirmDeleteOption": "确定删除 “{name}” 吗？",
  "cannotDeleteDefaultOptionTooltip": "默认选项不能删除。",
  "addNewOptionButton": "添加新选项",
  "dragToReorder": "拖动排序",

  // Settings Page - Editable Card Content (settings.js)
  "optionNameLabel": "名称",
  "modelLabel": "模型",
  "systemPromptLabel": "系统提示词",
  "temperatureLabel": "温度",
  "chatOptionUsesPanelSettings": "“对话”操作使用主聊天面板的设置。",

  // Settings Page - Default values for new/initialized options (settings.js)
  // defaultInterpretName, defaultInterpretPrompt, etc. already covered
  "newActionDefaultName": "新操作",
  "newActionDefaultPrompt": "请处理以下文本：",

  // Toasts (settings.js & potentially content.js)
  // "saveFailedToast": "保存失败: {error}",
  "settingsSavedToast": "设置已保存",
  "editToBeImplemented": "编辑功能待实现。",

  // Chat Modal specific (content.js)
  "chatInputPlaceholder": "输入消息..."
}
