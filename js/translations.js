const translations = {
  'zh-CN': {
    // --- General UI ---
    'appName': 'Pagetalk',
    'loading': '加载中...',
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

    // --- 更新通告相关翻译 ---
    'changelogTitle': '更新',
    'changelogDate': '日期',
    'changelogChanges': '更新内容',
    'changelogOK': 'OK', 
    'changelogNeverShow': '不再显示', 

    // --- HTML Elements (sidepanel.html) ---
    'htmlLang': 'zh-CN',
    'pageTitle': 'Pagetalk',
    'modelLabel': '模型：',
    'modelSelectLabel': '选择模型',
    'agentLabel': '助手：',
    'agentSelectLabel': '选择助手',
    'clearContextTitle': '清除聊天记录',
    'closePanelTitle': '关闭面板',
    'welcomeHeading': '欢迎使用 Pagetalk :)',
    'summarizeAction': '总结一下',
    'imagePreviewAlt': 'Full size image preview', // Keep English for alt? Or translate? Let's translate.
    'imagePreviewAltTranslated': '全尺寸图片预览',
    'chatStatusPlaceholder': '', // Placeholder for status messages
    'uploadImageTitle': '上传图片',
    'userInputPlaceholder': '输入消息...',
    'userInputContextPlaceholder': '输入@选择多个标签页进行对话',
    'sendMessageTitle': '发送消息',
    'settingsTab': '设置', // Footer tab
    'chatTab': '聊天', // Footer tab
    'generalSettingsNav': '通用',
    'agentSettingsNav': '助手',
    'modelSettingsNav': '模型',
    'generalSettingsHeading': '通用设置',
    'languageLabel': '语言：',
    'exportChatLabel': '导出聊天记录：',
    'exportFormatMarkdown': 'Markdown',
    'exportFormatText': 'Text',
    'exportButton': '导出',
    'agentSettingsHeading': '助手设置',
    'agentsListHeading': '助手',
    'addNewAgentTitle': '添加新助手',
    'deleteConfirmHeading': '确认删除',
    'deleteConfirmPrompt': '您确定要删除助手 "{agentName}" 吗？此操作无法撤销。', // Placeholder for agent name
    'modelSettingsHeading': '模型设置',
    'apiKeyLabel': 'Gemini API Key:',
    'apiKeyPlaceholder': '输入您的API Key',
    'toggleApiKeyVisibilityTitle': 'Toggle API Key visibility', // Keep English for title? Let's translate.
    'toggleApiKeyVisibilityTitleTranslated': '切换API密钥可见性',
    'apiKeyHint': '获取您的API Key', // Link text is separate
    'modelSelectLabelSettings': '模型：', // Model selection in settings
    'connectionStatusPlaceholder': '', // Placeholder for connection status
    'themeToggleTitle': '切换深色/浅色模式',
    'contextStatusPrefix': '上下文：',
    'contextStatusNone': '无',
    'contextStatusExtracting': '正在提取...',
    'contextStatusFailed': '提取失败',
    'contextStatusChars': '{charCount} 字符', // Placeholder for character count
    'connectionIndicatorConnected': '已连接',
    'connectionIndicatorDisconnected': '未连接',
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
    // YouTube video handling
    'addYoutubeLinkTitle': '添加YouTube链接',
    'addYoutubeVideoTitle': '添加YouTube视频',
    'enterYoutubeLinkPrompt': '请输入YouTube视频链接：',
    'youtubeLinkPlaceholder': 'https://www.youtube.com/watch?v=...',
    'cancelButton': '取消',
    'addButton': '添加',
    'videoAlt': '视频 {index}',
    'viewVideoTitle': '播放视频',
    'deleteVideoTitle': '删除视频',
    'invalidYouTubeUrl': '请输入有效的YouTube链接',
    'newAgentBaseName': '助手', // 新增：用于新助手命名的基础词
    'stopStreamingTitle': '终止输出', // 新增：终止按钮标题

    // --- JS Dynamic Messages ---
    'apiKeyMissingError': '请先在"模型"选项卡中设置API密钥',
    'saveSuccessToast': '已保存',
    'saveFailedToast': '保存失败：{error}', // Placeholder for error message
    'settingsSaved': '已保存', // Used in showConnectionStatus for success
    'connectionTestSuccess': '连接成功', // Used in showConnectionStatus for success
    'connectionTestFailed': '连接失败: {error}', // Placeholder for error message
    'contextClearedSuccess': '聊天记录已清除',
    'pageContentExtractedSuccess': '成功提取页面内容',
    'newAgentCreatedToast': '新助手已创建',
    'agentDeletedToast': '助手已删除',
    'agentSaveFailedNameConflict': '保存失败：助手 ID "{agentId}" 已存在',
    'agentSaveFailedNotFound': '保存失败：找不到助手',
    'minOneAgentError': '至少保留一个助手',
    // Agent Import/Export
    'importAgentsButton': '导入',
    'exportAgentsButton': '导出',
    'addNewAgentButton': '添加',
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
    'save': '保存',
    'saving': '保存中...',
    'savingInProgress': '正在保存中...',
    'containsNImages': '[包含 {count} 张图片]', // For text export
    'tabContentLoadedSuccess': '页面已加载',
    'tabContentLoadFailed': '无法加载页面 \'{title}...\' 内容: {error}',

    // --- 划词助手相关翻译 ---
    'textSelectionHelper': '划词助手',
    'textSelectionHelperEnabled': '启用划词助手',
    'interpret': '解读',
    'translate': '翻译',
    'chat': '对话',
    'interpretSystemPrompt': '解读一下',
    'translateSystemPrompt': '翻译一下',
    'interpretSettings': '解读设置',
    'translateSettings': '翻译设置',
    'customOptions': '自定义',
    'addCustomOption': '添加自定义选项',
    'optionName': '选项名称',
    'systemPrompt': '系统提示词',
    'temperature': '温度',
    'model': '模型',
    'optionOrder': '选项顺序',
    'dragToReorder': '拖拽调整顺序',
    'deleteOption': '删除',
    'editOption': '编辑',
    'saveOption': '保存',
    'cancelEdit': '取消',
    'copy': '复制',
    'regenerateResponse': '重新生成',
    'textSelectionHelperSettings': '划词助手设置',
    'customOptionSettings': '自定义选项设置',
    'newCustomOption': '新建自定义选项',
    'editCustomOption': '编辑',
    'deleteCustomOption': '删除',
    'confirmDeleteOption': '确定要删除这个自定义选项吗？',
    'optionNameRequired': '请输入选项名称',
    'systemPromptRequired': '请输入系统提示词',
    'customOptionCreated': '自定义选项已创建',
    'customOptionUpdated': '自定义选项已更新',
    'customOptionDeleted': '自定义选项已删除',
    'noCustomOptions': '暂无自定义选项',
    'contextWindow': '上下文窗口',
    'contextBefore': '前置上下文token数',
    'contextAfter': '后置上下文token数',
    'maxOutputLength': '最大输出长度',
    'optionIcon': '选项图标',
    'selectIcon': '选择图标',
    'searchIcons': '搜索图标...',
    'lucideLoadError': 'Lucide图标库加载失败，请刷新页面重试',
    'autoSaveNotice': '更改将自动保存',

    // --- 模型管理相关翻译 ---
    'selectedModelsTitle': '已选择的模型',
    'addModelsButton': '添加',
    'addModelsTitle': '添加模型',
    'addModelsDialogTitle': '添加模型',
    'addModelsDialogClose': '关闭',
    'modelsFoundMessage': '获取到 {count} 个新模型，请选择要添加的模型：',
    'selectedCountMessage': '已选择 {count} 个模型',
    'addModelsConfirm': '添加',
    'addModelsCancel': '取消',
    'fetchingModels': '获取中...',
    'noNewModelsFound': '没有获取到模型',
    'modelsAddedSuccess': '成功添加 {count} 个新模型',
    'modelsReactivatedSuccess': '成功重新激活 {count} 个模型',
    'modelsAddedAndReactivatedSuccess': '成功添加 {added} 个新模型，重新激活 {activated} 个模型',
    'fetchModelsError': '获取模型失败: {error}',
    'modelManagerUnavailable': '模型管理器不可用',
    'removeModelTooltip': '移除此模型',
    'minOneModelError': '至少需要保留一个模型',
    'cannotRemoveProtectedModel': '无法删除受保护的模型',

    // --- 代理设置相关翻译 ---
    'proxyAddressLabel': '代理地址：',
    'proxyAddressPlaceholder': 'http://127.0.0.1:7890 或 socks5://127.0.0.1:1080',
    'proxyAddressHint': '支持 HTTP 和 SOCKS5 代理，留空则禁用代理。',
    'proxySetSuccess': '代理设置已应用',
    'proxySetError': '代理设置失败：{error}',
    'proxyCleared': '代理设置已清除',
    'testProxy': '测试',
    'proxyInvalidUrl': '代理地址格式无效，请检查格式',

    // --- 划词助手默认提示词 ---
    'defaultInterpretPrompt': '解读一下',
    'defaultTranslatePrompt': `# 角色
你是一个为中文用户服务的、强大的划词翻译与语言学习助手。

# 规则
根据用户所选择的文本，严格遵循以下规则，直接输出结果，无需任何互动。

1.  **输入为外文单词（以英文为主）**：
    以"单词卡"的格式，清晰地提供：
    - **音标**：美式。
    - **核心释义**：最常用最正宗的 1-3 个中文意思。
    - **实用例句**：1-2 条地道例句，并附上翻译。
    - **深度拓展 (可选)**：如果单词有有趣的来源、文化背景或易混淆点，用中文简要说明。

2.  **输入为中文内容**：
    将其翻译成英文，给出英文单词，并满足：
    - **提供多种译文**：给出 2-3 个最地道翻译选项（若选中的是单词，则给出音标）。
    - **辨析与语境**：用中文清晰解释每个译文的语气、侧重点及最适用的场景。`,
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

    // --- Changelog Related Translations ---
    'changelogTitle': 'Updates',
    'changelogVersion': '', 
    'changelogDate': 'Date',
    'changelogChanges': 'Changes',
    'changelogOK': 'OK', 
    'changelogNeverShow': 'Don\'t show again',

    // --- HTML Elements (sidepanel.html) ---
    'htmlLang': 'en',
    'pageTitle': 'Pagetalk',
    'modelLabel': 'Model:',
    'modelSelectLabel': 'Select Model',
    'agentLabel': 'Agent:',
    'agentSelectLabel': 'Select Agent',
    'clearContextTitle': 'Clear chat history',
    'closePanelTitle': 'Close Panel',
    'welcomeHeading': 'Welcome to Pagetalk :)',
    'summarizeAction': 'Summarize',
    'imagePreviewAlt': 'Full size image preview',
    'imagePreviewAltTranslated': 'Full size image preview', // Keep English for alt
    'chatStatusPlaceholder': '',
    'uploadImageTitle': 'Upload Image',
    'userInputPlaceholder': 'Enter message...',
    'userInputContextPlaceholder': 'Type @ to select multiple tabs for conversation',
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
    'apiKeyHint': 'Get Your API Key in',
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
    // YouTube video handling
    'addYoutubeLinkTitle': 'Add YouTube URL',
    'addYoutubeVideoTitle': 'Add YouTube Video',
    'enterYoutubeLinkPrompt': 'Enter a YouTube video URL to include in your message:',
    'youtubeLinkPlaceholder': 'https://www.youtube.com/watch?v=...',
    'cancelButton': 'Cancel',
    'addButton': 'Add',
    'videoAlt': 'Video {index}',
    'viewVideoTitle': 'Play Video',
    'deleteVideoTitle': 'Delete Video',
    'invalidYouTubeUrl': 'Please enter a valid YouTube URL',
    'newAgentBaseName': 'Agent', // Added: Base word for new agent naming
    'stopStreamingTitle': 'Stop Generating', // Added: Stop button title

    // --- JS Dynamic Messages ---
    'apiKeyMissingError': 'Please set your API key in the "Model" tab first',
    'saveSuccessToast': 'Saved',
    'saveFailedToast': 'Save failed: {error}',
    'settingsSaved': 'Saved',
    'connectionTestSuccess': 'Connection successful',
    'connectionTestFailed': 'Connection failed: {error}',
    'contextClearedSuccess': 'Chat history cleared',
    'pageContentExtractedSuccess': 'Successfully extracted page content',
    'newAgentCreatedToast': 'New agent created',
    'agentDeletedToast': 'Agent deleted',
    // Agent Import/Export
    'importAgentsButton': 'Import',
    'exportAgentsButton': 'Export',
    'addNewAgentButton': 'Add',
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
    'savingInProgress': 'Saving in progress...',
    'containsNImages': '[Contains {count} image(s)]', // For text export
    'tabContentLoadedSuccess': 'Page content loaded',
    'tabContentLoadFailed': 'Failed to load content for tab \'{title}...\': {error}',

    // --- Text Selection Helper Related Translations ---
    'textSelectionHelper': 'Selection Tool',
    'textSelectionHelperEnabled': 'Enable Selection Tool',
    'interpret': 'Interpret',
    'translate': 'Translate',
    'chat': 'Chat',
    'interpretSystemPrompt': 'Interpret this',
    'translateSystemPrompt': 'Translate this',
    'interpretSettings': 'Interpret Settings',
    'translateSettings': 'Translate Settings',
    'customOptions': 'Custom',
    'addCustomOption': 'Add Custom Option',
    'optionName': 'Name',
    'systemPrompt': 'System Prompt',
    'temperature': 'Temperature',
    'model': 'Model',
    'optionOrder': 'Option Order',
    'dragToReorder': 'Drag to reorder',
    'deleteOption': 'Delete',
    'editOption': 'Edit',
    'saveOption': 'Save',
    'cancelEdit': 'Cancel',
    'copy': 'Copy',
    'regenerateResponse': 'Regenerate',
    'textSelectionHelperSettings': 'Selection Tool Settings',
    'customOptionSettings': 'Custom Options Settings',
    'newCustomOption': 'New Custom Option',
    'editCustomOption': 'Edit',
    'deleteCustomOption': 'Delete',
    'confirmDeleteOption': 'Are you sure you want to delete this custom option?',
    'optionNameRequired': 'Please enter option name',
    'systemPromptRequired': 'Please enter system prompt',
    'customOptionCreated': 'Custom option created',
    'customOptionUpdated': 'Custom option updated',
    'customOptionDeleted': 'Custom option deleted',
    'noCustomOptions': 'No custom options yet',
    'contextWindow': 'Context Window',
    'contextBefore': 'Context Before (chars)',
    'contextAfter': 'Context After (chars)',
    'maxOutputLength': 'Max Output Length',
    'optionIcon': 'Option Icon',
    'selectIcon': 'Select Icon',
    'searchIcons': 'Search icons...',
    'lucideLoadError': 'Failed to load Lucide icon library, please refresh the page and try again',
    'autoSaveNotice': 'Changes will be saved automatically',

    // --- Model Management Related Translations ---
    'selectedModelsTitle': 'Selected Models',
    'addModelsButton': 'Add',
    'addModelsTitle': 'Add Models',
    'addModelsDialogTitle': 'Add Models',
    'addModelsDialogClose': 'Close',
    'modelsFoundMessage': 'Found {count} new models, please select the models to add:',
    'selectedCountMessage': 'Selected {count} models',
    'addModelsConfirm': 'Add',
    'addModelsCancel': 'Cancel',
    'fetchingModels': 'Fetching...',
    'noNewModelsFound': 'No new models found',
    'modelsAddedSuccess': 'Successfully added {count} new models',
    'modelsReactivatedSuccess': 'Successfully reactivated {count} models',
    'modelsAddedAndReactivatedSuccess': 'Successfully added {added} new models and reactivated {activated} models',
    'fetchModelsError': 'Failed to fetch models: {error}',
    'modelManagerUnavailable': 'Model manager unavailable',
    'removeModelTooltip': 'Remove this model',
    'minOneModelError': 'At least one model must be kept',
    'cannotRemoveProtectedModel': 'Cannot remove protected model',

    // --- Proxy Settings Related Translations ---
    'proxyAddressLabel': 'Proxy Url:',
    'proxyAddressPlaceholder': 'http://127.0.0.1:7890 or socks5://127.0.0.1:1080',
    'proxyAddressHint': 'Supports HTTP and SOCKS5 proxies, leave empty to disable.',
    'proxySetSuccess': 'Proxy settings applied',
    'proxySetError': 'Failed to set proxy: {error}',
    'proxyCleared': 'Proxy settings cleared',
    'testProxy': 'Test',
    'proxyInvalidUrl': 'Invalid proxy url format, please check the format',

    // --- Text Selection Helper Default Prompts ---
    'defaultInterpretPrompt': 'Interpret this',
    'defaultTranslatePrompt': `# Role
You are a powerful Polyglot Translator and Language Companion for an English-speaking user.

# Rules
Analyze the selected text and strictly follow the rules below. Provide the output directly, without any conversational interaction.

1.  **If the input is English:**
    Your goal is to provide a rich translation into Chinese, intended for language learning.
    - **For a single word:** Display a "Chinese Word Card" with:
        - **Pinyin:** The phonetic transcription.
        - **Core Meanings:** The 1-3 most common definitions in English.
        - **Examples:** 1-2 practical example sentences in Chinese, with their English translations.
        - **Deep Dive (Optional):** Briefly explain in English any interesting character origins, cultural context, or common points of confusion.
    - **For a phrase or sentence:** Translate it into Chinese.
        - Provide 2-3 different translation options.
        - Clearly explain in English the nuance, tone, and the most appropriate context for each option.

2.  **If the input is any other language (e.g., Chinese, Spanish, Japanese):**
    Your goal is to provide a clear and accurate English translation.
    - Translate the text into natural, idiomatic English.
    - If the input is a single, non-trivial word, you may also provide a brief explanation or a close synonym to clarify its meaning.`,
  }
};

/**
 * 获取默认提示词
 * @param {string} type - 提示词类型 ('interpret' 或 'translate')
 * @param {string} language - 语言代码 ('zh-CN' 或 'en')
 * @returns {string} 默认提示词
 */
function getDefaultPrompt(type, language = 'zh-CN') {
  const key = type === 'interpret' ? 'defaultInterpretPrompt' : 'defaultTranslatePrompt';
  return translations[language]?.[key] || translations['zh-CN']?.[key] || '';
}

/**
 * 检查是否为默认提示词
 * @param {string} prompt - 要检查的提示词
 * @param {string} type - 提示词类型 ('interpret' 或 'translate')
 * @returns {boolean} 是否为任何语言的默认提示词
 */
function isDefaultPrompt(prompt, type) {
  const zhPrompt = getDefaultPrompt(type, 'zh-CN');
  const enPrompt = getDefaultPrompt(type, 'en');
  return prompt === zhPrompt || prompt === enPrompt;
}

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
window.translations = translations;
// window._ = _; // Optional: make the helper global too

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
  window.getDefaultPrompt = getDefaultPrompt;
  window.isDefaultPrompt = isDefaultPrompt;
}
