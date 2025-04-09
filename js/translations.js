const translations = {
  'zh-CN': {
    // --- General UI ---
    'appName': 'Pagetalk',
    'loading': '加载中...',
    'save': '保存',
    'cancel': '取消',
    'delete': '删除',
    'confirm': '确认',
    'close': '关闭',
    'error': '错误',
    'success': '成功',
    'copied': '已复制',
    'copyCode': '复制代码',
    'copyAll': '复制全部',
    'regenerate': '重新生成',
    'deleteMessage': '删除消息',
    'edit': '编辑', // Added for potential future use

    // --- HTML Elements (sidepanel.html) ---
    'htmlLang': 'zh-CN',
    'pageTitle': 'Pagetalk',
    'modelLabel': 'Model：',
    'modelSelectLabel': '选择模型',
    'agentLabel': 'Agent：',
    'agentSelectLabel': '选择助手',
    'clearContextTitle': '清除上下文和聊天记录',
    'closePanelTitle': '关闭面板',
    'welcomeHeading': '欢迎使用 Pagetalk :)',
    'summarizeAction': '总结一下',
    'imagePreviewAlt': 'Full size image preview', // Keep English for alt? Or translate? Let's translate.
    'imagePreviewAltTranslated': '全尺寸图片预览',
    'chatStatusPlaceholder': '', // Placeholder for status messages
    'uploadImageTitle': '上传图片',
    'userInputPlaceholder': '...',
    'sendMessageTitle': '发送消息',
    'settingsTab': 'Settings', // Footer tab
    'chatTab': 'Chat', // Footer tab
    'generalSettingsNav': 'General',
    'agentSettingsNav': 'Agent',
    'modelSettingsNav': 'Model',
    'generalSettingsHeading': 'General Settings',
    'languageLabel': 'Language:',
    'exportChatLabel': 'Export Chat History:',
    'exportFormatMarkdown': 'Markdown',
    'exportFormatText': 'Text',
    'exportButton': 'Export',
    'agentSettingsHeading': 'Agent Settings',
    'agentsListHeading': 'Agents',
    'addNewAgentTitle': '添加新助手',
    'deleteConfirmHeading': '确认删除',
    'deleteConfirmPrompt': '您确定要删除助手 "{agentName}" 吗？此操作无法撤销。', // Placeholder for agent name
    'modelSettingsHeading': 'Model Settings',
    'apiKeyLabel': 'Gemini API Key:',
    'apiKeyPlaceholder': '输入您的API Key',
    'toggleApiKeyVisibilityTitle': 'Toggle API Key visibility', // Keep English for title? Let's translate.
    'toggleApiKeyVisibilityTitleTranslated': '切换API密钥可见性',
    'apiKeyHint': 'Get Your API Key', // Link text is separate
    'modelSelectLabelSettings': 'Model:', // Model selection in settings
    'connectionStatusPlaceholder': '', // Placeholder for connection status
    'themeToggleTitle': '切换深色/浅色模式',
    'contextStatusPrefix': '上下文：',
    'contextStatusNone': '无',
    'contextStatusExtracting': '正在提取...',
    'contextStatusFailed': '提取失败',
    'contextStatusChars': '{charCount} 字符', // Placeholder for character count
    'connectionIndicatorConnected': 'Connected',
    'connectionIndicatorDisconnected': 'Disconnected',
    'emptyAgentList': '暂无助手，点击添加按钮创建',
    'agentNameLabel': 'Name:',
    'agentIdLabel': 'ID:', // Maybe not show ID? Let's keep it for now.
    'agentSystemPromptLabel': 'System Prompt:',
    'agentTemperatureLabel': 'Temperature:',
    'agentTopPLabel': 'Top P:',
    'agentMaxOutputLabel': 'Max Output Length:',
    'defaultAgentName': '默认', // Added for default agent
    'imageAlt': '图片 {index}', // Placeholder for image index
    'viewImageTitle': '查看原图',
    'deleteImageTitle': '删除图片',
    'newAgentBaseName': '助手', // 新增：用于新助手命名的基础词
    'stopStreamingTitle': '终止输出', // 新增：终止按钮标题

    // --- JS Dynamic Messages ---
    'apiKeyMissingError': '请先在"模型"选项卡中设置API密钥',
    'saveSuccessToast': '已保存',
    'saveFailedToast': '保存失败：{error}', // Placeholder for error message
    'settingsSaved': 'Saved', // Used in showConnectionStatus for success
    'connectionTestSuccess': '连接成功', // Used in showConnectionStatus for success
    'connectionTestFailed': '连接失败: {error}', // Placeholder for error message
    'contextClearedSuccess': '聊天记录和上下文已清除',
    'pageContentExtractedSuccess': '成功提取页面内容',
    'newAgentCreatedToast': '新助手已创建',
    'agentDeletedToast': '助手已删除',
    'agentSaveFailedNameConflict': '保存失败：助手 ID "{agentId}" 已存在',
    'agentSaveFailedNotFound': '保存失败：找不到助手',
    'minOneAgentError': '至少保留一个助手',
    // Agent Import/Export
    importAgentConfigTitle: '导入助手配置 (.json)',
    exportAgentConfigTitle: '导出助手配置 (.json)',
    agentExportEmptyError: '没有助手可导出。',
    agentExportSuccess: '助手配置已导出。',
    agentExportError: '导出助手配置时出错: {error}',
    agentImportErrorInvalidFormatArray: '导入失败：文件格式无效，需要 JSON 数组。',
    agentImportErrorInvalidAgentData: '导入失败：第 {index} 个助手数据无效或不完整。',
    agentImportSuccess: '导入完成：新增 {imported} 个，更新 {updated} 个助手。',
    agentImportError: '导入助手配置时出错: {error}',
    agentImportErrorFileRead: '读取导入文件时出错。',
    'chatExportEmptyError': '没有聊天记录可导出',
    'chatExportSuccess': '聊天记录已导出',
    'regenerateError': '重新生成响应时出错: {error}',
    'thinking': '思考中...', // For thinking animation (optional)
    'messageDeleted': '消息已删除', // Confirmation or log
    'deleteFailedNotFound': '删除失败：找不到消息',
    'deleteFailedElementNotFound': '删除失败：找不到消息元素',
    'regenerateFailedNotFound': '重新生成失败：找不到消息',
    'regenerateFailedUserNotFound': '重新生成失败：找不到对应的用户消息',
    'buttonPositionSaved': '按钮位置已保存', // Log message
    'buttonPositionLoaded': '按钮位置已加载: top={top}, right=fixed', // Log message
    'buttonPositionLoadError': '加载按钮位置时出错', // Log message
    'buttonPositionSaveError': '保存按钮位置时出错', // Log message
    'setDefaultButtonPositionLog': '设置默认按钮位置', // Log message
    'agentSettingsSaved': 'Saved', // Agent settings status message
    'testingConnection': 'Testing connection...', // Model settings status
    'saving': 'Saving...', // Model settings button text
    'containsNImages': '[包含 {count} 张图片]', // For text export
  },
  'en': {
    // --- General UI ---
    'appName': 'Pagetalk',
    'loading': 'Loading...',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'confirm': 'Confirm',
    'close': 'Close',
    'error': 'Error',
    'success': 'Success',
    'copied': 'Copied',
    'copyCode': 'Copy Code',
    'copyAll': 'Copy All',
    'regenerate': 'Regenerate',
    'deleteMessage': 'Delete Message',
    'edit': 'Edit',

    // --- HTML Elements (sidepanel.html) ---
    'htmlLang': 'en',
    'pageTitle': 'Pagetalk',
    'modelLabel': 'Model:',
    'modelSelectLabel': 'Select Model',
    'agentLabel': 'Agent:',
    'agentSelectLabel': 'Select Agent',
    'clearContextTitle': 'Clear context and chat history',
    'closePanelTitle': 'Close Panel',
    'welcomeHeading': 'Welcome to Pagetalk :)',
    'summarizeAction': 'Summarize',
    'imagePreviewAlt': 'Full size image preview',
    'imagePreviewAltTranslated': 'Full size image preview', // Keep English for alt
    'chatStatusPlaceholder': '',
    'uploadImageTitle': 'Upload Image',
    'userInputPlaceholder': '...',
    'sendMessageTitle': 'Send Message',
    'settingsTab': 'Settings',
    'chatTab': 'Chat',
    'generalSettingsNav': 'General',
    'agentSettingsNav': 'Agent',
    'modelSettingsNav': 'Model',
    'generalSettingsHeading': 'General Settings',
    'languageLabel': 'Language:',
    'exportChatLabel': 'Export Chat History:',
    'exportFormatMarkdown': 'Markdown',
    'exportFormatText': 'Text',
    'exportButton': 'Export',
    'agentSettingsHeading': 'Agent Settings',
    'agentsListHeading': 'Agents',
    'addNewAgentTitle': 'Add New Agent',
    'deleteConfirmHeading': 'Confirm Deletion',
    'deleteConfirmPrompt': 'Are you sure you want to delete the agent "{agentName}"? This action cannot be undone.',
    'modelSettingsHeading': 'Model Settings',
    'apiKeyLabel': 'Gemini API Key:',
    'apiKeyPlaceholder': 'Enter your API Key',
    'toggleApiKeyVisibilityTitle': 'Toggle API Key visibility',
    'toggleApiKeyVisibilityTitleTranslated': 'Toggle API Key visibility', // Keep English for title
    'apiKeyHint': 'Get Your API Key',
    'modelSelectLabelSettings': 'Model:',
    'connectionStatusPlaceholder': '',
    'themeToggleTitle': 'Toggle dark/light mode',
    'contextStatusPrefix': 'Context:',
    'contextStatusNone': 'None',
    'contextStatusExtracting': 'Extracting...',
    'contextStatusFailed': 'Extraction failed',
    'contextStatusChars': '{charCount} chars',
    'connectionIndicatorConnected': 'Connected',
    'connectionIndicatorDisconnected': 'Disconnected',
    'emptyAgentList': 'No agents yet, click the add button to create one',
    'agentNameLabel': 'Name:',
    'agentIdLabel': 'ID:',
    'agentSystemPromptLabel': 'System Prompt:',
    'agentTemperatureLabel': 'Temperature:',
    'agentTopPLabel': 'Top P:',
    'agentMaxOutputLabel': 'Max Output Length:',
    'defaultAgentName': 'Default', // Added for default agent
    'imageAlt': 'Image {index}',
    'viewImageTitle': 'View Original',
    'deleteImageTitle': 'Delete Image',
    'newAgentBaseName': 'Agent', // Added: Base word for new agent naming
    'stopStreamingTitle': 'Stop Generating', // Added: Stop button title

    // --- JS Dynamic Messages ---
    'apiKeyMissingError': 'Please set your API key in the "Model" tab first',
    'saveSuccessToast': 'Saved',
    'saveFailedToast': 'Save failed: {error}',
    'settingsSaved': 'Saved',
    'connectionTestSuccess': 'Connection successful',
    'connectionTestFailed': 'Connection failed: {error}',
    'contextClearedSuccess': 'Chat history and context cleared',
    'pageContentExtractedSuccess': 'Successfully extracted page content',
    'newAgentCreatedToast': 'New agent created',
    'agentDeletedToast': 'Agent deleted',
    // Agent Import/Export
    importAgentConfigTitle: 'Import Agent Configuration (.json)',
    exportAgentConfigTitle: 'Export Agent Configuration (.json)',
    agentExportEmptyError: 'No agents to export.',
    agentExportSuccess: 'Agent configuration exported.',
    agentExportError: 'Error exporting agent configuration: {error}',
    agentImportErrorInvalidFormatArray: 'Import failed: Invalid file format, JSON array required.',
    agentImportErrorInvalidAgentData: 'Import failed: Invalid or incomplete agent data at index {index}.',
    agentImportSuccess: 'Import complete: Added {imported}, Updated {updated} agents.',
    agentImportError: 'Error importing agent configuration: {error}',
    agentImportErrorFileRead: 'Error reading import file.',
    'agentSaveFailedNameConflict': 'Save failed: Agent ID "{agentId}" already exists',
    'agentSaveFailedNotFound': 'Save failed: Agent not found',
    'minOneAgentError': 'Keep at least one agent',
    'chatExportEmptyError': 'No chat history to export',
    'chatExportSuccess': 'Chat history exported',
    'regenerateError': 'Error regenerating response: {error}',
    'thinking': 'Thinking...',
    'messageDeleted': 'Message deleted',
    'deleteFailedNotFound': 'Delete failed: Message not found',
    'deleteFailedElementNotFound': 'Delete failed: Message element not found',
    'regenerateFailedNotFound': 'Regenerate failed: Message not found',
    'regenerateFailedUserNotFound': 'Regenerate failed: Could not find the corresponding user message',
    'buttonPositionSaved': 'Button position saved',
    'buttonPositionLoaded': 'Button position loaded: top={top}, right=fixed',
    'buttonPositionLoadError': 'Error loading button position',
    'buttonPositionSaveError': 'Error saving button position',
    'setDefaultButtonPositionLog': 'Setting default button position',
    'agentSettingsSaved': 'Saved',
    'testingConnection': 'Testing connection...',
    'saving': 'Saving...',
    'containsNImages': '[Contains {count} image(s)]', // For text export
  }
};

// Function to get a translation string
// function _(key, replacements = {}) {
//   let lang = state?.language || 'zh-CN'; // Default to Chinese if state not available yet
//   let translation = translations[lang]?.[key] || translations['zh-CN']?.[key] || key; // Fallback chain: current -> zh-CN -> key
//
//   for (const placeholder in replacements) {
//     translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
//   }
//   return translation;
// }

// Make translations globally accessible (or pass it around)
// window.translations = translations;
// window._ = _; // Optional: make the helper global too