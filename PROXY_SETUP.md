# PageTalk 代理功能设置指南

## 概述

PageTalk 现在支持代理功能，可以通过HTTP和SOCKS代理服务器访问所有AI供应商的API。这对于在受限网络环境中使用PageTalk非常有用。

支持的AI供应商包括：
- **Google Gemini** - generativelanguage.googleapis.com
- **OpenAI** - api.openai.com
- **Anthropic Claude** - api.anthropic.com
- **SiliconFlow** - api.siliconflow.cn
- **OpenRouter** - openrouter.ai
- **DeepSeek** - api.deepseek.com
- **ChatGLM** - open.bigmodel.cn
- **自定义OpenAI兼容供应商** - 用户配置的域名

## 支持的代理类型

- **HTTP代理**: `http://proxy-server:port`
- **HTTPS代理**: `https://proxy-server:port`
- **SOCKS4代理**: `socks4://proxy-server:port`
- **SOCKS5代理**: `socks5://proxy-server:port`

## 设置步骤

1. 打开PageTalk扩展面板
2. 点击底部的"设置"标签
3. 在"常规设置"部分找到"代理地址"输入框
4. 输入你的代理服务器地址，例如：
   - `http://127.0.0.1:7890`
   - `socks5://127.0.0.1:1080`
5. 点击"测试代理"按钮验证连接
6. 如果测试成功，代理设置将自动保存并应用

## 代理测试功能

新增的"测试代理"按钮会：
- 验证代理地址格式
- 尝试通过代理连接到多个AI供应商的服务器
- 测试Google Gemini、OpenAI、Anthropic等主要供应商的连接
- 显示连接结果（成功/失败）

## 智能代理机制 🆕

PageTalk 结合了选择性代理和自动健康检查，提供最佳的用户体验：

### 选择性代理
- **精准路由**: 仅对所有AI供应商的API请求使用代理
- **多供应商支持**: 支持Google Gemini、OpenAI、Anthropic、SiliconFlow等所有供应商
- **直连优先**: 所有其他网络流量（包括正常浏览）都走直连
- **零干扰**: 代理失效时不影响正常的网页浏览

### 自动健康检查
- **快速检查**: 每5秒自动检查一次代理连接状态
- **多端点测试**: 使用多个AI供应商端点进行健康检查，提高可靠性
- **快速响应**: 连续2次检查失败后立即清除代理设置
- **自动恢复**: 清除代理后浏览器立即恢复正常网络连接
- **用户通知**: 显示友好的通知消息告知用户代理已被自动清除

### 技术实现
- 使用 PAC 脚本实现域名级别的选择性代理
- 支持所有AI供应商域名：
  - `generativelanguage.googleapis.com` (Google Gemini)
  - `api.openai.com` (OpenAI)
  - `api.anthropic.com` (Anthropic Claude)
  - `api.siliconflow.cn` (SiliconFlow)
  - `openrouter.ai` (OpenRouter)
  - `api.deepseek.com` (DeepSeek)
  - `open.bigmodel.cn` (ChatGLM)
  - 以及用户自定义的OpenAI兼容供应商域名
- 其他所有域名都使用直连

### 用户体验
- 🎯 **精准代理**: 只有插件功能使用代理，不影响其他网络活动
- 🌐 **正常浏览**: 即使代理失效，也能正常浏览网页
- 🛡️ **双重保护**: 选择性代理+自动清除机制确保网络连接稳定
- 📢 **及时通知**: 代理问题时会及时通知用户

## 工作原理

### 1. 选择性代理设置
PageTalk使用Chrome的`chrome.proxy` API配合PAC脚本实现选择性代理：
- 仅对所有AI供应商的API域名使用代理
- 其他所有网络请求走直连
- 不影响正常的网页浏览

### 2. 请求路由
只有以下请求会通过代理服务器：
- 主面板的所有AI供应商API调用
- 划词助手的所有AI供应商API调用
- 模型测试和发现功能的API调用
- 自定义供应商的API调用
- 其他所有请求（包括网页浏览）都走直连

### 3. 错误处理
如果代理连接失败：
- 插件功能会显示错误信息
- 正常网页浏览不受影响
- 用户可以自主决定是否修复代理

## 常见问题

### Q: 为什么代理测试失败？
A: 可能的原因：
- 代理服务器地址错误
- 代理服务器未运行
- 网络连接问题
- 代理服务器需要认证（暂不支持）

### Q: 如何禁用代理？
A: 清空代理地址输入框即可禁用代理功能。

### Q: 支持需要用户名密码的代理吗？
A: 当前版本暂不支持需要认证的代理服务器。

### Q: 代理失效时会影响正常浏览吗？
A: 不会。PageTalk 使用选择性代理，只有插件的AI供应商API调用会使用代理。即使代理失效，您仍然可以正常浏览网页，只是无法使用插件功能。

### Q: 代理被自动清除了怎么办？
A: 这是正常的保护机制。当代理服务器不可用时，系统会自动清除代理设置以确保插件功能正常。重新启动代理服务器后，再次设置即可。

### Q: 如何关闭自动代理检查？
A: 自动检查是为了保护用户体验而设计的，无法关闭。但只有在设置了代理地址时才会启动检查，且检查频率很低不会影响性能。

## 技术实现

### 选择性代理配置
```javascript
const pacScriptData = 'function FindProxyForURL(url, host) {\n' +
    '    if (host === "generativelanguage.googleapis.com" || \n' +
    '        host === "api.openai.com" || \n' +
    '        host === "api.anthropic.com" || \n' +
    '        host === "api.siliconflow.cn" || \n' +
    '        host === "openrouter.ai" || \n' +
    '        host === "api.deepseek.com" || \n' +
    '        host === "open.bigmodel.cn") {\n' +
    '        return "PROXY 127.0.0.1:7890";\n' +
    '    }\n' +
    '    return "DIRECT";\n' +
    '}';

const proxyConfig = {
    mode: "pac_script",
    pacScript: {
        data: pacScriptData
    }
};
```

### API请求处理
所有API请求都通过统一的`makeApiRequest`函数处理，该函数会：
1. 检查代理设置
2. 应用代理配置
3. 发起请求
4. 处理错误

## 故障排除

1. **检查代理服务器状态**
   - 确保代理服务器正在运行
   - 验证端口号正确

2. **检查网络连接**
   - 尝试直接访问代理服务器
   - 检查防火墙设置

3. **查看控制台日志**
   - 打开浏览器开发者工具
   - 查看Console标签中的错误信息

4. **重置代理设置**
   - 清空代理地址
   - 重新输入正确的代理信息

## 更新日志

### v3.5.1
- 新增代理支持功能
- 添加代理测试按钮
- 改进错误处理和用户反馈
- 支持HTTP、HTTPS、SOCKS4、SOCKS5代理

### v3.5.2
- 🆕 实现选择性代理机制，仅对 Gemini API 使用代理
- 🛡️ 代理失效不影响正常网页浏览
- ⚡ 使用 PAC 脚本实现精准的域名级代理路由
- 📢 新增自动代理健康检查机制
- 🔄 每5秒自动检查代理连接状态，连续2次失败即清理

### v3.6.0
- 🌐 **多供应商代理支持**: 扩展代理功能支持所有AI供应商
- 🔧 **统一代理架构**: 重构代理系统，支持Google Gemini、OpenAI、Anthropic、SiliconFlow、OpenRouter、DeepSeek、ChatGLM等
- 🎯 **智能域名检测**: 自动识别AI API域名，动态应用代理规则
- 🧪 **增强测试功能**: 代理测试支持多个供应商端点验证
- 🔄 **改进健康检查**: 使用多个AI供应商端点进行健康检查，提高可靠性
- 📦 **自定义供应商支持**: 用户添加的OpenAI兼容供应商也支持代理
- 🛠️ **统一API调用**: 所有API适配器统一使用代理请求工具
