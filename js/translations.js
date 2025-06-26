// 避免重复声明
if (typeof window.translations === 'undefined') {
  window.translations = {
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
    'retry': '重试',

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
    'welcomeHeading': '欢迎使用 PageTalk :)',
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

    // --- API 错误消息 ---
    'apiKeyNotValidError': '连接失败：API密钥无效，请检查您的密钥。',
    'connectionFailedGeneric': '连接失败：{error}',
    'networkErrorGeneric': '连接失败：网络错误或服务器无法访问。',
    'serverUnreachableError': '连接失败：无法连接到服务器，请检查您的网络连接。',
    'httpErrorGeneric': 'HTTP错误 {status}',
    'httpErrorWithMessage': 'HTTP错误 {status}，无法解析错误响应。',

    // --- 内容提取错误消息 ---
    'unableToExtractContent': '无法提取页面内容。',
    'fallbackToBodyText': '(回退到正文文本) ',
    'contentTruncated': '...(内容已截断)',
    'pdfExtractionFailed': '从PDF.js查看器DOM提取文本失败，回退到Readability。',
    'pdfLibraryInitFailed': 'PDF.js库初始化失败。',
    'pdfFetchFailed': '获取PDF失败',
    'pdfFetchFailedWithError': '获取PDF失败：{error}',
    'extractionError': '提取页面内容时出错: {error}',
    'readabilityNotLoaded': '错误：无法加载页面内容提取库。',
    'pdfProcessingError': 'PDF处理错误：{error}',
    'embeddedPdfTitle': '嵌入式PDF',

    // --- 默认提示词 ---
    'defaultInterpretPrompt': '请解释这段文本的含义：',
    'defaultTranslatePrompt': '翻译一下',
    'defaultChatPrompt': '你是一个有用的助手',

    // --- 代理相关错误消息 ---
    'proxyConnectionFailed': '代理服务器 {proxy} 连接失败，已自动清除代理设置以恢复网络连接。',

    // --- 通用错误消息 ---
    'unknownErrorLoadingTab': '加载标签页时发生未知错误',
    'unifiedApiNotAvailable': '统一API接口不可用',
    'translationsNotFound': '未找到翻译对象。',

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
    'chatSettings': '对话设置',
    'customOptions': '自定义',
    'addCustomOption': '添加自定义选项',
    'add': '添加',
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
    'delete': '删除',
    'cancel': '取消',
    'deleteFailed': '删除失败',
    'optionNameRequired': '请输入选项名称',
    'systemPromptRequired': '请输入系统提示词',
    'customOptionCreated': '自定义选项已创建',
    'customOptionUpdated': '自定义选项已更新',
    'customOptionDeleted': '自定义选项已删除',
    'noCustomOptions': '暂无自定义选项',
    'importCustomOptions': '导入',
    'exportCustomOptions': '导出',
    'noCustomOptionsToExport': '没有自定义选项可以导出',
    'exportFailed': '导出失败',
    'importFailed': '导入失败：文件格式不正确',
    'noOptionsInFile': '文件中没有找到自定义选项',
    'importConflictTitle': '导入冲突',
    'importConflictMessage': '发现重名选项',
    'importConflictOptions': '请选择处理方式：',
    'overwriteExisting': '覆盖现有',
    'skipConflicts': '跳过',
    'cancelImport': '取消',
    'noNewOptionsToImport': '没有新选项可以导入',
    'importSuccess': '成功导入 {count} 个自定义选项',
    'contextWindow': '上下文窗口',
    'contextBefore': '前置上下文token数',
    'contextAfter': '后置上下文token数',
    'contextSettings': '上下文设置',
    'customContext': '自定义上下文',
    'fullContext': '读取全部上下文',
    'maxOutputLength': '最大输出长度',
    'optionIcon': '选项图标',
    'selectIcon': '选择图标',
    'searchIcons': '搜索图标...',
    'lucideLoadError': 'Lucide图标库加载失败，请刷新页面重试',
    'autoSaveNotice': '更改将自动保存',

    // --- 模型管理相关翻译 ---
    'selectedModelsTitle': '已选择的模型',
    'addModelsTitle': '添加模型',
    'addModelsDialogTitle': '添加模型',
    'addModelsDialogClose': '关闭',
    'searchModelsPlaceholder': '搜索模型...',
    'modelsFoundMessage': '找到 {count} 个新模型，请选择要添加的模型：',
    'manualAddModel': '手动添加',
    'manualAddModelDialogTitle': '手动添加模型',
    'manualAddModelName': '模型名称',
    'manualAddModelNamePlaceholder': '输入模型显示名称',
    'manualAddModelId': '模型ID',
    'manualAddModelIdPlaceholder': '输入API调用时使用的模型ID',
    'manualAddModelProvider': '选择供应商',
    'manualAddModelProviderPlaceholder': '选择模型所属的供应商',
    'manualAddModelCancel': '取消',
    'manualAddModelConfirm': '添加',
    'manualAddModelSuccess': '模型添加成功',
    'manualAddModelError': '添加模型失败',
    'manualAddModelExists': '模型已存在',
    'manualAddModelInvalidInput': '请填写所有必填字段',
    'selectedCountMessage': '已选择 {count} 个模型',
    'addModelsConfirm': '添加',
    'addModelsCancel': '取消',
    'fetchingModels': '查找中...',
    'noNewModelsFound': '没有找到新模型',
    'modelsAddedSuccess': '成功添加 {count} 个新模型',
    'modelsReactivatedSuccess': '成功重新激活 {count} 个模型',
    'modelsAddedAndReactivatedSuccess': '成功添加 {added} 个新模型，重新激活 {activated} 个模型',
    'fetchModelsError': '添加模型失败: {error}',
    'modelManagerUnavailable': '模型管理器不可用',
    'removeModelTooltip': '移除此模型',
    'minOneModelError': '至少需要保留一个模型',
    'cannotRemoveProtectedModel': '无法删除受保护的模型',
    'modelManagerUnavailable': 'API 测试功能不可用',
    'apiKeyMissingError': '请先输入 API Key',
    'connectionTestFailed': '测试失败: {error}',
    'noNewModelsFound': '未找到新的可用模型',
    'modelsAddedSuccess': '成功添加 {count} 个模型',
    'modelsReactivatedSuccess': '成功重新激活 {count} 个模型',
    'modelsAddedAndReactivatedSuccess': '成功添加 {added} 个模型，重新激活 {activated} 个模型',
    'fetchModelsError': '添加模型失败: {error}',

    // --- 代理设置相关翻译 ---
    'proxyAddressLabel': '代理地址：',
    'proxyAddressPlaceholder': 'http://127.0.0.1:7890 或 socks5://127.0.0.1:1080',
    'proxyAddressHint': '支持 HTTP 和 SOCKS5 代理，适用于所有AI供应商，留空则禁用代理。',
    'proxySetSuccess': '代理设置已应用',
    'proxySetError': '代理设置失败：{error}',
    'proxyCleared': '代理设置已清除',
    'testProxy': '测试',
    'proxyInvalidUrl': '代理地址格式无效，请检查格式',

    // --- 多供应商设置相关翻译 ---
    'aiProviderLabel': '供应商：',
    'testConnection': '测试',
    'discoverModels': '添加',
    'currentModelLabel': '当前模型：',
    'testingConnection': '测试中...',
    'discoveringModels': '添加中...',
    'noModelsSelected': '暂无已选择的模型，点击"添加"来添加',
    'providerApiKeyPlaceholder': '输入您的 API Key',
    'getApiKeyHint': '获取 API Key',
    'selectedText': '选中文本',
    'relatedContext': '相关上下文',
    'userQuestion': '用户问题',

    // --- 自定义提供商相关翻译 ---
    'addProvider': '添加',
    'customProviderTitle': 'OpenAI Compatible',
    'customProviderIdLabel': 'Provider ID:',
    'customProviderIdPlaceholder': '输入提供商ID（可选）',
    'customProviderBaseUrlLabel': 'Base URL:',
    'customProviderBaseUrlPlaceholder': 'https://api.example.com',
    'customProviderApiKeyLabel': 'API Key:',
    'customProviderApiKeyPlaceholder': '输入您的API Key',
    'customProviderSave': '添加',
    'customProviderSuccess': '自定义提供商添加成功',
    'customProviderError': '添加提供商失败',
    'customProviderExists': '该提供商ID已存在',
    'customProviderInvalidUrl': '请输入有效的URL地址',
    'customProviderEdit': '保存',
    'customProviderDelete': '删除提供商',
    'customProviderDeleteConfirm': '确定要删除提供商 "{name}" 吗？',
    'customProviderDeleteSuccess': '自定义提供商已删除',
    'customProviderDeleteError': '删除提供商失败',
    'customProviderUpdateSuccess': '提供商更新成功',

    // --- 划词助手默认提示词 ---
    'defaultInterpretPrompt': '请解释这段文本的含义：',
    'defaultTranslatePrompt': `# 角色
你是一个为中文用户服务的、强大的划词翻译与语言学习助手。

# 核心指令
你将接收一段用户划词选中的文本。请严格根据文本的语言和长度，判断其类型，并遵循以下对应规则，直接输出结果，无需任何解释或互动。

---

### 规则 1：处理单个英文单词
- **判断条件**：用户选中的文本是 **单个** 英文单词。
- **输出格式**：生成【单词卡】。
  - **单词**：[单词本身]
  - **音标**：[美式音标]
  - **核心释义**：[1-3 个最核心的中文意思]
  - **实用例句**：[1-2 条地道例句，附中文翻译]
  - **深度拓展 (可选)**：[如果单词有有趣的来源、文化背景或易混淆点，用中文简要说明]

---

### 规则 2：处理英文短语或句子
- **判断条件**：用户选中的文本是包含 **多个单词** 的英文短语或句子。
- **输出格式**：提供【翻译与解析】。
  - **核心翻译**：提供一个最通用、最自然的中文翻译。
  - **其他译法 (可选)**：如果存在，提供 1-2 个在不同语境下的其他翻译选项。
  - **用法解析**：用中文简要说明不同译法之间的细微差别、语气或适用语境，帮助用户理解。

---

### 规则 3：处理中文内容
- **判断条件**：用户选中的文本是中文词语或句子。
- **输出格式**：提供【英文翻译建议】。
  - **提供 2-3 个翻译选项**：给出最地道的英文翻译。如果选中的是中文单词，请为对应的英文单词附上美式音标。
  - **辨析与语境**：用中文清晰解释每个译文的语气、侧重点及最适用的场景，帮助用户选择最恰当的表达。`,
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
    'retry': 'Retry',

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
    'welcomeHeading': 'Welcome to PageTalk :)',
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

    // --- API Error Messages ---
    'apiKeyNotValidError': 'Connection failed: API key not valid. Please check your key.',
    'connectionFailedGeneric': 'Connection failed: {error}',
    'networkErrorGeneric': 'Connection failed: Network error or server unreachable.',
    'serverUnreachableError': 'Connection failed: Could not reach the server. Check your internet connection.',
    'httpErrorGeneric': 'HTTP error {status}',
    'httpErrorWithMessage': 'HTTP error {status}, unable to parse error response.',

    // --- Content Extraction Error Messages ---
    'unableToExtractContent': 'Unable to extract page content.',
    'fallbackToBodyText': '(Fallback to body text) ',
    'contentTruncated': '...(Content truncated)',
    'pdfExtractionFailed': 'Failed to extract text from PDF.js viewer DOM, falling back to Readability.',
    'pdfLibraryInitFailed': 'PDF.js library failed to initialize.',
    'pdfFetchFailed': 'Failed to fetch PDF',
    'pdfFetchFailedWithError': 'Failed to fetch PDF: {error}',
    'extractionError': 'Error extracting page content: {error}',
    'readabilityNotLoaded': 'Error: Unable to load page content extraction library.',
    'pdfProcessingError': 'Error processing PDF: {error}',
    'embeddedPdfTitle': 'Embedded PDF',

    // --- Default Prompts ---
    'defaultInterpretPrompt': 'Please explain the meaning of this text:',
    'defaultTranslatePrompt': 'Translate this',
    'defaultChatPrompt': 'You are a helpful assistant',

    // --- Proxy Related Error Messages ---
    'proxyConnectionFailed': 'Proxy server {proxy} connection failed, proxy settings have been automatically cleared to restore network connection.',

    // --- Generic Error Messages ---
    'unknownErrorLoadingTab': 'Unknown error loading tab',
    'unifiedApiNotAvailable': 'Unified API interface not available',
    'translationsNotFound': 'Translations object not found.',

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
    'chatSettings': 'Chat Settings',
    'customOptions': 'Custom',
    'addCustomOption': 'Add Custom Option',
    'add': 'Add',
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
    'delete': 'Delete',
    'cancel': 'Cancel',
    'deleteFailed': 'Delete failed',
    'optionNameRequired': 'Please enter option name',
    'systemPromptRequired': 'Please enter system prompt',
    'customOptionCreated': 'Custom option created',
    'customOptionUpdated': 'Custom option updated',
    'customOptionDeleted': 'Custom option deleted',
    'noCustomOptions': 'No custom options yet',
    'importCustomOptions': 'Import',
    'exportCustomOptions': 'Export',
    'noCustomOptionsToExport': 'No custom options to export',
    'exportFailed': 'Export failed',
    'importFailed': 'Import failed: Invalid file format',
    'noOptionsInFile': 'No custom options found in file',
    'importConflictTitle': 'Import Conflict',
    'importConflictMessage': 'Found duplicate option names',
    'importConflictOptions': 'Please choose how to handle:',
    'overwriteExisting': 'Overwrite',
    'skipConflicts': 'Skip',
    'cancelImport': 'Cancel',
    'noNewOptionsToImport': 'No new options to import',
    'importSuccess': 'Successfully imported {count} custom options',
    'contextWindow': 'Context Window',
    'contextBefore': 'Context Before (chars)',
    'contextAfter': 'Context After (chars)',
    'contextSettings': 'Context Settings',
    'customContext': 'Custom Context',
    'fullContext': 'Full Context',
    'maxOutputLength': 'Max Output Length',
    'optionIcon': 'Option Icon',
    'selectIcon': 'Select Icon',
    'searchIcons': 'Search icons...',
    'lucideLoadError': 'Failed to load Lucide icon library, please refresh the page and try again',
    'autoSaveNotice': 'Changes will be saved automatically',

    // --- Model Management Related Translations ---
    'selectedModelsTitle': 'Selected Models',
    'addModelsTitle': 'Add Models',
    'addModelsDialogTitle': 'Add Models',
    'addModelsDialogClose': 'Close',
    'searchModelsPlaceholder': 'Search models...',
    'modelsFoundMessage': 'Found {count} new models, please select the models to add:',
    'manualAddModel': 'Manual Add',
    'manualAddModelDialogTitle': 'Manual Add Model',
    'manualAddModelName': 'Model Name',
    'manualAddModelNamePlaceholder': 'Enter model display name',
    'manualAddModelId': 'Model ID',
    'manualAddModelIdPlaceholder': 'Enter model ID for API calls',
    'manualAddModelProvider': 'Select Provider',
    'manualAddModelProviderPlaceholder': 'Select the provider for this model',
    'manualAddModelCancel': 'Cancel',
    'manualAddModelConfirm': 'Add',
    'manualAddModelSuccess': 'Model added successfully',
    'manualAddModelError': 'Failed to add model',
    'manualAddModelExists': 'Model already exists',
    'manualAddModelInvalidInput': 'Please fill in all required fields',
    'selectedCountMessage': 'Selected {count} models',
    'addModelsConfirm': 'Add',
    'addModelsCancel': 'Cancel',
    'fetchingModels': 'Searching...',
    'noNewModelsFound': 'No new models found',
    'modelsAddedSuccess': 'Successfully added {count} new models',
    'modelsReactivatedSuccess': 'Successfully reactivated {count} models',
    'modelsAddedAndReactivatedSuccess': 'Successfully added {added} new models and reactivated {activated} models',
    'fetchModelsError': 'Failed to add models: {error}',
    'modelManagerUnavailable': 'Model manager unavailable',
    'removeModelTooltip': 'Remove this model',
    'minOneModelError': 'At least one model must be kept',
    'cannotRemoveProtectedModel': 'Cannot remove protected model',
    'modelManagerUnavailable': 'API test function unavailable',
    'apiKeyMissingError': 'Please enter API Key first',
    'connectionTestFailed': 'Test failed: {error}',
    'noNewModelsFound': 'No new models found',
    'modelsAddedSuccess': 'Successfully added {count} models',
    'modelsReactivatedSuccess': 'Successfully reactivated {count} models',
    'modelsAddedAndReactivatedSuccess': 'Successfully added {added} models and reactivated {activated} models',
    'fetchModelsError': 'Failed to add models: {error}',

    // --- Proxy Settings Related Translations ---
    'proxyAddressLabel': 'Proxy Url:',
    'proxyAddressPlaceholder': 'http://127.0.0.1:7890 or socks5://127.0.0.1:1080',
    'proxyAddressHint': 'Supports HTTP and SOCKS5 proxies for all AI providers, leave empty to disable.',
    'proxySetSuccess': 'Proxy settings applied',
    'proxySetError': 'Failed to set proxy: {error}',
    'proxyCleared': 'Proxy settings cleared',
    'testProxy': 'Test',
    'proxyInvalidUrl': 'Invalid proxy url format, please check the format',

    // --- Multi-Provider Settings Related Translations ---
    'aiProviderLabel': 'Provider:',
    'testConnection': 'Test',
    'discoverModels': 'Add',
    'currentModelLabel': 'Current Model:',
    'testingConnection': 'Testing...',
    'discoveringModels': 'Adding...',
    'noModelsSelected': 'No models selected yet, click "Add" to add models',
    'providerApiKeyPlaceholder': 'Enter your API Key',
    'getApiKeyHint': 'Get API Key',
    'selectedText': 'Selected Text',
    'relatedContext': 'Related Context',
    'userQuestion': 'User Question',

    // --- Custom Provider Related Translations ---
    'addProvider': 'Add',
    'customProviderTitle': 'OpenAI Compatible',
    'customProviderIdLabel': 'Provider ID:',
    'customProviderIdPlaceholder': 'Enter provider ID (optional)',
    'customProviderBaseUrlLabel': 'Base URL:',
    'customProviderBaseUrlPlaceholder': 'https://api.example.com',
    'customProviderApiKeyLabel': 'API Key:',
    'customProviderApiKeyPlaceholder': 'Enter your API Key',
    'customProviderSave': 'Add',
    'customProviderSuccess': 'Custom provider added successfully',
    'customProviderError': 'Failed to add provider',
    'customProviderExists': 'Provider ID already exists',
    'customProviderInvalidUrl': 'Please enter a valid URL',
    'customProviderEdit': 'Save',
    'customProviderDelete': 'Delete Provider',
    'customProviderDeleteConfirm': 'Are you sure you want to delete provider "{name}"?',
    'customProviderDeleteSuccess': 'Custom provider deleted successfully',
    'customProviderDeleteError': 'Failed to delete provider',
    'customProviderUpdateSuccess': 'Provider updated successfully',

    // --- Text Selection Helper Default Prompts ---
    'defaultInterpretPrompt': 'Please explain the meaning of this text:',
    'defaultTranslatePrompt': `# Role
You are a powerful Polyglot Translator and Language Companion, designed to help an English-speaking user learn languages, with a special focus on Chinese.

# Core Directive
Analyze the user's selected text. First, determine its language and whether it's a single word or a longer phrase/sentence. Then, strictly follow the corresponding rule below. Provide the output directly, without any conversational preamble.

---

### Rule 1: Single English Word
- **Condition:** The selected text is a **single English word**.
- **Format:** Generate a **[Chinese Word Card]**.
  - **Word:** [The Chinese translation]
  - **Pinyin:** [Phonetic transcription]
  - **Core Meanings:** [1-3 most common definitions in English]
  - **Example Sentence:** [A practical Chinese sentence using the word, with its English translation]
  - **Character Insight (Optional):** [Briefly explain in English the character components/radicals, cultural context, or interesting origins. e.g., for 好 (hǎo), explain it's composed of 女 (woman) and 子 (child).]

---

### Rule 2: English Phrase or Sentence
- **Condition:** The selected text is an **English phrase or sentence** (multiple words).
- **Format:** Provide **[Chinese Translation Options]**.
  - **Option 1:** [The most common or standard Chinese translation]
    - **Context:** [Explain in English its tone, nuance, and typical usage.]
  - **Option 2:** [An alternative Chinese translation]
    - **Context:** [Explain how it differs from Option 1, e.g., more formal, informal, or emphasizes a different aspect.]

---

### Rule 3: Single Chinese Word/Character
- **Condition:** The selected text is a **single Chinese word or character** (e.g., 你好, 爱).
- **Format:** Generate an **[English Definition Card]**.
  - **Pinyin:** [Phonetic transcription]
  - **Core Meaning:** [The primary English definition]
  - **Example Sentence:** [The Chinese word used in a simple sentence, with its English translation]
  - **Breakdown (Optional):** [If it's a multi-character word, list the individual characters and their meanings. e.g., for 电脑 (diànnǎo), break it down into 电 (electric) + 脑 (brain).]

---

### Rule 4: Chinese Phrase or Sentence
- **Condition:** The selected text is a **Chinese phrase or sentence**.
- **Format:** Provide **[English Translation & Analysis]**.
  - **Primary Translation:** [The most natural and accurate English translation.]
  - **Literal Translation (Optional):** [A word-for-word translation if it helps with understanding the structure, marked as "Literal".]
  - **Keywords / Nuances:** [Identify 1-2 key words or grammatical structures in the original Chinese and explain their meaning or function in English to aid learning.]

---

### Rule 5: Any Other Language (Fallback Rule)
- **Condition:** The selected text is **not English or Chinese**.
- **Format:** Provide a **[Direct English Translation]**.
  - **Identify the language** if possible (e.g., Spanish to English:).
  - **Provide a clear and accurate English translation.**
  - If the input is a single word, you may provide a brief definition or synonym to clarify its meaning.`,
  }
  };
}

/**
 * 获取默认提示词
 * @param {string} type - 提示词类型 ('interpret' 或 'translate')
 * @param {string} language - 语言代码 ('zh-CN' 或 'en')
 * @returns {string} 默认提示词
 */
function getDefaultPrompt(type, language = 'zh-CN') {
  const key = type === 'interpret' ? 'defaultInterpretPrompt' : 'defaultTranslatePrompt';
  return window.translations[language]?.[key] || window.translations['zh-CN']?.[key] || '';
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
// window.translations is already set above
// window._ = _; // Optional: make the helper global too

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
  window.getDefaultPrompt = getDefaultPrompt;
  window.isDefaultPrompt = isDefaultPrompt;
}
