/**
 * 更新日志模块 - 管理版本更新记录并显示更新通告
 */

// 更新日志记录，按照时间倒序排列
const changelog = [
    {
        version: "3.7.2",
        date: "2025-08-22",
        changes: {
            "zh-CN": [
                "1. 多 tab 列表 UI 更新，现在可以一次选择多个页面",
                "2. 修改了 Gemini 的默认加载模型"
            ],
            "en": [
                "1. Multi-tab list UI updated: you can now select multiple pages at once",
                "2. Updated Gemini default model"
            ]
        }
    },
    {
        version: "3.7.1",
        date: "2025-08-12",
        changes: {
            "zh-CN": [
                "1. 修复了在macOS上使用输入法时，划词助手对话框中按回车键会直接发送消息的bug。"
            ],
            "en": [
                "1. Fixed a bug on macOS where pressing Enter in the text selection helper's chat box would send the message directly while using an IME."
            ]
        }
    },
    {
        version: "3.7.0",
        date: "2025-07-29",
        changes: {
            "zh-CN": [
                "1. 优化图片发送样式"
            ],
            "en": [
                "1. Optimized image sending style"
            ]
        }
    },
    {
        version: "3.6.9",
        date: "2025-07-08",
        changes: {
            "zh-CN": [
                "1. 修复mac系统输入bug"
            ],
            "en": [
                "1. Fixed Mac system input bug"
            ]
        }
    },
    {
        version: "3.6.8",
        date: "2025-06-29",
        changes: {
            "zh-CN": [
                "1. 增加快捷操作，现在可以自定义快捷操作按钮并在首页使用",
                "2. 增加Ollama和LM Studio供应商支持",
                "3. 增加数据统一管理模块，一键导出助手、划词助手、快捷操作配置，API KEY配置、已选模型配置",
                "4. 重构通用设置UI",
                "5. 修复一些bug"
            ],
            "en": [
                "1. Added 'Quick Actions' feature - you can now customize quick action buttons and use them on the homepage",
                "2. Added Ollama and LM Studio provider support",
                "3. Added unified data management module - one-click export of agents, Selection Tool, quick actions configurations, API KEY configurations, and selected model configurations",
                "4. Refactored general settings UI",
                "5. Fixed some bugs"
            ]
        }
    },
    {
        version: "3.6.5",
        date: "2025-06-29",
        changes: {
            "zh-CN": [
                "1. 修复了划词助手自定义选项在某些情况下刷新后会消失的Bug",
                "2. 为了提高设置的稳定性，划词助手的配置将不再跨设备同步",
                "3. 其他核心设置（如助手、API Key）的同步不受影响",
                "4. 现有用户的设置将自动迁移，无需手动操作"
            ],
            "en": [
                "1. Fixed a bug where Selection Tool custom options would disappear after refresh in certain situations",
                "2. To improve settings stability, Selection Tool configurations will no longer sync across devices",
                "3. Other core settings (such as agents, API keys) sync functionality remains unaffected",
                "4. Existing user settings will be automatically migrated without manual intervention"
            ]
        }
    },
    {
        version: "3.6.4",
        date: "2025-06-27",
        changes: {
            "zh-CN": [
                "1. 修复自定义选项在顺序栏的icon显示问题",
                "2. 给自定义选项编辑界面加入手动保存按钮",
                "3. 一些小优化"
            ],
            "en": [
                "1. Fixed icon display issue for custom options in the order bar",
                "2. Added manual save button to custom options edit interface",
                "3. Some minor optimizations"
            ]
        }
    },
    {
        version: "3.6.3",
        date: "2025-06-26",
        changes: {
            "zh-CN": [
                "1. 修复划词助手自定义选项过多时无法显示的bug。",
                "2. 增加划词助手导入导出功能。",
                "3. 优化按钮样式。",
                "4. 优化划词助手选项栏样式。"
            ],
            "en": [
                "1. Fixed a bug where Selection Tool custom options couldn't be displayed when there were too many.",
                "2. Added import/export functionality for Selection Tool.",
                "3. Optimized button styles.",
                "4. Optimized Selection Tool options bar styles."
            ]
        }
    },
    {
        version: "3.6.1",
        date: "2025-06-22",
        changes: {
            "zh-CN": [
                "1. 修复了划词助手“对话”功能的上下文获取逻辑。",
                "2. 修复了划词助手“对话”功能对系统助手的继承逻辑。",
                "3. 修复了当上下文token设置为0时，划词助手仍然提取上下文的bug。",
                "4. 修复了在线PDF解析失败的bug。"
            ],
            "en": [
                "1. Fixed context retrieval logic for the Selection Tool's 'Chat' function.",
                "2. Fixed assistant inheritance logic for the Selection Tool's 'Chat' function.",
                "3. Fixed a bug where the Selection Tool would still extract context when the token count was set to 0.",
                "4. Fixed online PDF parsing failure bug ."
            ]
        }
    },
    {
        version: "3.6.0",
        date: "2025-06-22",
        changes: {
            "zh-CN": [
                "1. 支持了多个提供商，现在可以自定义添加提供商和模型",
                "2. 与屎山搏斗失败，无法实现思考过程输出和渲染，请见谅"
            ],
            "en": [
                "1. Added support for multiple providers. You can now add custom providers and models.",
                "2. Lost the battle with legacy code and was unable to implement the thinking process output and rendering. Please forgive me."
            ]
        }
    },
    {
        version: "3.5.1",
        date: "2025-06-17",
        changes: {
            "zh-CN": [
                "1. 新增Gemini模型：gemini-2.5-flash、gemini-2.5-pro、gemini-2.5-flash-lite-preview-06-17",
                "2. 将gemini-2.5-flash-preview-05-20替换为正式版gemini-2.5-flash",
            ],
            "en": [
                "1. Added new Gemini models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite-preview-06-17",
                "2. Replaced gemini-2.5-flash-preview-05-20 with official gemini-2.5-flash",
            ]
        }
    },
    {
        version: "3.5.0",
        date: "2025-06-16",
        changes: {
            "zh-CN": [
                "1. 划词助手：现在你可以尝试这个非常牛逼的功能，划词→选择解读、翻译或对话，又或者是自定义你自己的选项，PageTalk不再仅仅是个侧栏AI插件。",
                "2. 更新http, socks5代理支持",
                "3. 修复一些小bug",
                "备注：如果遇到任何问题，请先尝试刷新网页、刷新插件或重启浏览器，若仍存在，请联系kronos13v@gmail.com"
            ],
            "en": [
                "1. Text Selection Helper: Try this amazing new feature! Select text → choose interpret, translate, or chat, or customize your own options. PageTalk is no longer just a sidebar AI extension.",
                "2. Updated HTTP and SOCKS5 proxy support",
                "3. Fixed various minor bugs",
                "Note: If you encounter any issues, please try refreshing the webpage, reloading the extension, or restarting the browser first. If problems persist, contact kronos13v@gmail.com"
            ]
        }
    },
    {
        version: "3.0.0",
        date: "2025-05-28",
        changes: {
            "zh-CN": [
                "功能：",
                "1. 新增多标签页交互功能，可以在输入框输入@以选择其他页面纳入上下文，进行对话。🌐",
                "2. 支持YouTube URL解析。📺",
                "   （2.0-flash一次只能解析一个视频，2.5-flash则可以解析多个视频）",
                "   注意：2.0-flash也许会提示“一次只能上传一个链接”，请不要理会，点击重新生成按钮即可。",
                "优化和bug修复：",
                "1. 优化了动效，重构了一些UI，更加直观、美观。✨",
                "2. 修复了诸多bug。🐛"
            ],
            "en": [
                "Features:",
                "1. New Multi-Tab Interaction: Type `@` in the input box to select other open tabs and include their content in the conversation context. 🌐",
                "2. YouTube URL Parsing Support: 📺",
                "   (Gemini 2.0-flash can parse one video URL at a time, while 2.5-flash can parse multiple video URLs.)",
                "   Note for 2.0-flash users: If you encounter a \"Only one link can be uploaded at a time\" prompt, please ignore it and click the \"Regenerate\" button.",
                "Optimizations & Bug Fixes:",
                "1. UI/UX Enhancements: Refactored UI and optimized animations for a more intuitive and visually appealing experience. ✨",
                "2. Numerous Bug Fixes: Addressed and resolved various bugs. 🐛"
            ]
        }
    },
    {
        version: "2.7.5",
        date: "2025-05-25",
        changes: {
            "zh-CN": [
                "新增pdf解析功能（在线，非本地pdf），现在可以在网页中的pdf和PageTalk对话",
                "聊天界面的小幅优化",
                "修复了agent的删除bug"
            ],
            "en": [
                "Added PDF parsing feature (online, not local), now you can chat with PageTalk in web PDFs",
                "Minor UI optimizations in chat interface",
                "Fixed agent deletion bug"
            ]
        }
    },
    {
        version: "2.7.1",
        date: "2025-05-22",
        changes: {
            "zh-CN": [
                "新增更新通告功能，首次使用新版本时显示更新内容",
                "自动检测浏览器语言并设置默认语言"
            ],
            "en": [
                "Added update notification feature to display changes when using a new version",
                "Automatically detect browser language and set default language"
            ]
        }
    },
    {
        version: "2.7.0",
        date: "2025-05-20",
        changes: {
            "zh-CN": [
                "新增2.5-flash和2.5-flash-thinking模型",
                "2.0-flash和2.5-flash现在支持Url提取"
            ],
            "en": [
                "Added 2.5-flash and 2.5-flash-thinking models",
                "2.0-flash and 2.5-flash now support URL extraction"
            ]
        }
    }
];

// 当前版本号
const currentVersion = changelog[0].version;

/**
 * 初始化更新通告功能
 */
function initChangelog() {
    // 在 DOM 加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('changelog-modal');
        const okButton = document.getElementById('changelog-ok-btn');
        const neverShowCheckbox = document.getElementById('never-show-checkbox');
        const changelogList = document.getElementById('changelog-list');
        
        // 为 OK 按钮添加事件监听
        okButton.addEventListener('click', () => {
            closeChangelogModal(neverShowCheckbox.checked);
        });
        
        // 从本地存储中获取最后查看的版本
        const lastViewedVersion = localStorage.getItem('lastViewedVersion');
        
        // 确保元素存在，否则可能会导致错误
        if (modal && changelogList) {
            // 如果有新版本且用户没有选择不再显示该版本的更新
            const shouldShowChangelog = shouldShowChangelogModal(lastViewedVersion);
            
            if (shouldShowChangelog) {
                // 设置语言（在填充内容之前）
                setupLanguage();
                
                // 填充更新日志内容
                populateChangelogContent(changelogList);
                
                // 设置多语言支持
                setupChangelogTranslations();
                
                // 显示模态框
                modal.style.display = 'block';
            }
        }
    });
}

/**
 * 设置语言，首先尝试使用用户已设置的语言，
 * 如果没有设置，则尝试使用浏览器语言
 */
function setupLanguage() {
    // 如果已有语言设置就使用已有设置
    if (localStorage.getItem('language')) {
        return;
    }
    
    // 否则尝试检测浏览器语言并设置
    const browserLang = getBrowserLanguage();
    if (browserLang === 'zh-CN' || browserLang.startsWith('zh')) {
        localStorage.setItem('language', 'zh-CN');
    } else {
        localStorage.setItem('language', 'en');
    }
}

/**
 * 获取浏览器语言设置
 * @returns {string} 浏览器语言代码
 */
function getBrowserLanguage() {
    return navigator.language || 
           navigator.userLanguage || 
           navigator.browserLanguage || 
           navigator.systemLanguage || 
           'en';
}

/**
 * 判断是否应该显示更新通告模态框
 * @param {string} lastViewedVersion 用户最后查看的版本
 * @returns {boolean} 是否应该显示更新通告
 */
function shouldShowChangelogModal(lastViewedVersion) {
    // 如果用户选择了不再显示这个版本的更新，直接返回 false
    if (localStorage.getItem(`hideChangelog_${currentVersion}`) === 'true') {
        return false;
    }
    
    // 修改逻辑：只有当上次查看的版本不是当前版本时才显示更新通告
    // 这样即使用户刷新页面，也会继续显示更新通告，除非明确关闭
    return lastViewedVersion !== currentVersion;
}

/**
 * 填充更新日志内容
 * @param {HTMLElement} container 更新日志容器元素
 */
function populateChangelogContent(container) {
    container.innerHTML = '';
    
    // 获取当前语言
    const currentLang = localStorage.getItem('language') || 'zh-CN';
    // 如果当前语言不是支持的语言，则使用英文作为后备
    const lang = (currentLang === 'zh-CN') ? 'zh-CN' : 'en';
    
    // 只显示最新版本的更新日志
    const latestVersion = changelog[0];
    
    const versionEl = document.createElement('div');
    versionEl.className = 'changelog-item';
    
    const versionHeader = document.createElement('div');
    versionHeader.className = 'changelog-version';
    
    const versionNumber = document.createElement('span');
    versionNumber.className = 'changelog-version-number';
    // 直接显示版本号，不添加前缀
    versionNumber.textContent = latestVersion.version;
    
    const versionDate = document.createElement('span');
    versionDate.className = 'changelog-version-date';
    versionDate.textContent = latestVersion.date;
    
    versionHeader.appendChild(versionNumber);
    versionHeader.appendChild(versionDate);
    
    const changesList = document.createElement('ul');
    changesList.className = 'changelog-changes';
    
    // 根据当前语言选择相应的更新内容
    const changes = latestVersion.changes[lang] || latestVersion.changes['en'];
    
    changes.forEach(change => {
        const changeItem = document.createElement('li');
        changeItem.textContent = change;
        changesList.appendChild(changeItem);
    });
    
    versionEl.appendChild(versionHeader);
    versionEl.appendChild(changesList);
    
    container.appendChild(versionEl);
}

/**
 * 设置更新通告的多语言翻译
 */
function setupChangelogTranslations() {
    // 获取当前语言
    const currentLang = localStorage.getItem('language') || 'zh-CN';
    
    // 设置标题和副标题
    document.getElementById('changelog-title').textContent = _('changelogTitle');
    
    // 设置按钮和复选框文本
    document.getElementById('changelog-ok-btn').textContent = _('changelogOK');
    document.getElementById('never-show-label').textContent = _('changelogNeverShow');
}

/**
 * 关闭更新通告模态框
 * @param {boolean} neverShowAgain 是否不再显示当前版本的更新
 */
function closeChangelogModal(neverShowAgain) {
    const modal = document.getElementById('changelog-modal');

    // 隐藏模态框
    if (modal) {
        modal.style.display = 'none';
    }

    // 如果选择了不再显示当前版本更新，记录到 localStorage
    if (neverShowAgain) {
        localStorage.setItem(`hideChangelog_${currentVersion}`, 'true');
        // 同时更新最后查看的版本
        localStorage.setItem('lastViewedVersion', currentVersion);
    }
    // 否则不更新 lastViewedVersion，这样在刷新页面后还会显示

    // 新增：尝试在关闭模态框后聚焦聊天输入框
    // 需要能够访问到聊天输入框元素和聊天标签页的激活状态
    const userInput = document.getElementById('user-input');
    const chatTab = document.getElementById('chat'); // 假设聊天标签页的 ID 是 'chat'
    if (userInput && chatTab && chatTab.classList.contains('active')) {
        // 只有当聊天标签页是激活状态时才聚焦
        setTimeout(() => userInput.focus(), 0); // 使用 setTimeout 将聚焦操作推迟到下一个事件循环，确保模态框完全消失
        // console.log("Changelog modal closed, focusing user input.");
    }
}

/**
 * 获取翻译字符串
 * @param {string} key 翻译键名
 * @returns {string} 翻译结果
 */
function _(key) {
    // 优先使用统一 i18n 工具（若可用）
    if (window.I18n && typeof window.I18n.tr === 'function') {
        return window.I18n.tr(key);
    }

    const currentLang = localStorage.getItem('language') || 'zh-CN';
    // 退回到 translations.js 提供的全局对象
    if (typeof window.translations !== 'undefined') {
        return window.translations[currentLang]?.[key] ||
               window.translations['zh-CN']?.[key] ||
               key;
    }
    return key;
}

// 导出更新日志相关函数和数据
window.Changelog = {
    init: initChangelog,
    currentVersion
};

// 初始化更新通告功能
initChangelog();
