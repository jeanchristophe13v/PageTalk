# PageTalk 重构计划与交接（2025-08-10）

本文档作为本轮重构的任务交接，包含总体目标、技术路线与下一步待办。

## 一、总体目标
- 消除硬编码与重复实现，降低维护成本
- 统一数据流/适配层接口，提升扩展性（新增供应商/模型时少改动）
- 强化 i18n 一致性与可测试性
- 保障现有功能零回归

## 二、已确定的架构原则
- 网络请求：一处封装（`js/utils/proxyRequest.js`）+ 统一 URL 构建（`js/utils/apiUrl.js`）
- 供应商与模型：以 `providerManager` 为单一事实来源（`providers`/类型/默认 `apiHost`）
- i18n：统一从 `window.translations` / `getCurrentTranslations()` 获取，避免在各处散落 `_()` 的实现
- 流式输出：统一回调签名 `(chunk, isComplete)`，适配器侧只负责协议解析

## 三、下一步待办（详细）

### A. 去除残留的直连端点硬编码
- 范围：
  - `js/modelManager.js`（存在 Gemini 列表直连端点）
  - `js/api.js`（Google 流式端点仍为完整 URL，可改为：从 `providerManager` 获取 Google `apiHost` 后拼接）
- 做法：
  - 所有端点均以 `providerManager.providers[providerId].apiHost` + `formatApiUrl`（必要时）构建
- 验收：切换 Google 模型时，调用路径随 `apiHost` 配置生效（含自定义覆盖）

### B. 代理健康检查与测试端点集中
- 目标：将 `background.js` 中用于健康检查/测试的端点表集中为常量或由 `providers` 派生
- 做法：
  - 新增 `js/utils/proxyHealth.js`（建议）：根据 `providers` 自动生成基础健康检查端点（`apiHost + '/'`）
  - `handleProxyTestRequest` / `checkProxyHealth` 统一从工具模块取端点列表
- 验收：修改 `providers` 即可影响健康检查端点，无需手工维护多处列表

### C. 未用导入与重复翻译函数清理
- 扫描：`ui.js`、`settings.js`、`chat.js`、`image.js` 等，存在局部 `_()` 的重复实现
- 做法：
  - 新增 `js/utils/i18n.js`（建议），统一导出 `tr(key, rep)` + `getCurrentTranslations()`
  - 逐步替换局部 `_()` 为工具函数，保留极少数必要的内联以降低改动面
- 验收：构建/运行无未用变量告警；UI 切换语言后静态/动态文案均能正确刷新

### D. i18n 全量梳理与补齐
- 扫描：未使用翻译键、遗留硬编码文本
- 做法：
  - 对照 `js/translations.js`，为缺失键补齐中英翻译
  - `updateUIElementsWithTranslations` 覆盖度再检查
- 验收：在中/英文下进行主要流程操作，无英文/中文硬编码外泄

### E. 流式处理与适配器细化
- 目标：减少适配器间流式解析重复
- 做法：
  - 在适配器保留协议层解析（SSE 解析），但复用统一的 `streamCallback` 契约，避免 UI 侧差异
  - 评估是否将部分通用解析逻辑下沉（可选）
- 验收：`OpenAI/Anthropic/Gemini` 三类流式输出表现一致、无闪烁与丢块

### F. 手动测试清单（建议）
- 代理关闭/开启下：
  - `Google`、`OpenAI`、`Anthropic` 三类模型流式问答
  - 模型列表拉取与 API Key 测试
- 自定义提供商：
  - 新增自定义 `apiHost` + `apiKey`，验证 `/models` 与 `/chat/completions` 行为
- i18n：
  - 切换 `zh-CN`/`en`，验证设置页、主面板、对话区、快捷操作列表

## 四、风险与回滚
- 风险：端点拼接逻辑统一后，若个别供应商存在非标准路径，需在 `apiUrl.js` 特判（已覆盖 `openrouter`、`chatglm`）
- 回滚：变更均为“集中化与替换导入”，可通过 Git 单文件回退

## 五、交接要点（Where to look）
- 统一请求封装：`js/utils/proxyRequest.js`（代理感知的一处入口）
- URL 构建：`js/utils/apiUrl.js`（新增）
- 供应商单一来源：`js/providerManager.js`（`providers`、`API_TYPES`）
- Background 入口：`js/background.js`（消息分发、健康检查、直连流式调用）
- 统一 API（面板侧桥接）：`js/api.js`（`window.PageTalkAPI`、流式 handler）

---

## 已完成清单（第二批追加，2025-08-10）
- 代理健康检查与测试端点集中
  - 新增 `js/utils/proxyHealth.js`，`background.js` 改为动态端点派生
- 端点去直连 & 代理识别增强
  - Gemini 流式/测试端点改为基于 `apiHost`；`isAIApiRequest` 动态派生域名集合
- i18n 统一与覆盖提升
  - 新增 `js/utils/i18n.js`；移除多处本地 `_()`/`getCurrentTranslations()`
  - 扩大 `sidepanel.html` 的 `data-i18n*` 绑定范围；`ui.js` 增强批量刷新
  - `text-selection-helper.js` 接入统一 i18n；操作按钮 title 改为翻译键
- 初始化体验优化
  - 避免连接状态“未连接”闪烁（`hasDeterminedConnection`）；修复“成功提取页面内容”键名直显

## 下一步建议（第三批）
1) i18n 收尾
- 全量扫描剩余硬编码文本（含 `text-selection-helper.js` 中窗口标题/提示等），统一加 `data-i18n` 并补键
- 清理 `translations.js` 未使用键；对照代码使用处补缺失键

2) 死代码与未用变量清理
- 运行构建/静态检查，移除无引用的函数与变量，瘦身体积

3) 统一事件/回调约定
- 收敛 UI 通知与状态栏更新的调用时机，避免重复渲染

4) 端到端回归清单
- “无代理/有代理（正常/失败）” 组合 + 三类提供商基础流程
- 自定义提供商：增/改/删生命周期与模型/聊天验证

> 上述建议可分两次提交：i18n 收尾 → 清理与回归，便于回溯与回退。 