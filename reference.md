
**OpenRouter API 信息：**

1.  **Base URL:** `https://openrouter.ai/api/v1`
2.  **认证方式:** 使用 API Key 进行认证，通过 `Authorization: Bearer YOUR_API_KEY` 请求头发送。
3.  **必需的请求头:** `Authorization: Bearer <OPENROUTER_API_KEY>` 和 `Content-Type: application/json`。可选请求头包括 `HTTP-Referer` 和 `X-Title`，用于在 OpenRouter 网站上标识你的应用。
4.  **Chat Completions (`/v1/chat/completions`) 请求体结构:** 结构与 OpenAI Chat API 非常相似。
    *   **必需参数:** `messages` (消息数组) 或 `prompt` (字符串，二选一)。
    *   **常用参数:** `model` (模型名称，推荐包含组织前缀，如 `openai/gpt-4o`)，`stream` (布尔值，是否启用流式响应)，`temperature` (浮点数，控制随机性，范围 [0, 2])，`max_tokens` (整数，最大生成令牌数)。
    *   **其他可选参数:** `response_format`, `stop`, `seed`, `top_p`, `top_k`, `frequency_penalty`, `presence_penalty`, `repetition_penalty`, `logit_bias`, `top_logprobs`, `min_p`, `top_a`, `prediction`, `transforms`, `models`, `route`, `provider`。
    *   `messages` 数组中的每个消息对象通常包含 `role` (`user`, `assistant`, `system`, `tool`) 和 `content` (字符串或 ContentPart 数组)。
5.  **流式响应 (SSE) 格式:** 支持 Server-Sent Events (SSE)。在请求体中设置 `stream: true` 启用。流中的数据块通常在 `data: {...}` 行中，包含 `choices` 数组，每个 choice 包含 `delta` 属性，其中 `delta.content` 包含生成的文本片段。流结束时会有 `data: [DONE]` 标记。最后会有一个包含 `usage` 信息的块。
6.  **错误响应格式:** 响应中包含 `error` 对象，其结构为 `{"code": number, "message": string, "metadata"?: Record<string, unknown>}`。

**SiliconFlow API 信息：**

1.  **Base URL:** `https://api.siliconflow.cn/v1` 或 `https://api.ap.siliconflow.com/v1` (示例中都出现过，前者在中文文档中先出现)。
2.  **认证方式:** 使用 API Key 进行认证，通过 `Authorization: Bearer YOUR_API_KEY` 请求头发送 (OpenAI SDK 中表现为 `api_key="YOUR_KEY"`)。
3.  **必需的请求头:** 文档中直接列出请求头的示例是使用 OpenAI SDK 的方式，SDK 会自动处理，但根据标准 REST API 实践和文档中提到的 Bearer token，应包含 `Authorization: Bearer <YOUR_API_KEY>` 和 `Content-Type: application/json`。
4.  **Chat Completions (`/v1/chat/completions`) 请求体结构:** 结构与 OpenAI Chat API 类似。
    *   **必需参数:** `messages` (消息数组)。
    *   **常用参数:** `model` (模型名称，如 `deepseek-ai/DeepSeek-V3`)，`messages` (消息数组)，`temperature` (浮点数)，`max_tokens` (整数)，`stream` (布尔值)。
    *   **其他可选参数:** `response_format`, `stop`, `top_k`, `top_p`, `frequency_penalty` 等。
    *   `messages` 数组结构与 OpenAI 类似，包含 `role` (`system`, `user`, `assistant`) 和 `content`。
5.  **流式响应 (SSE) 格式:** 在请求体中设置 `stream=True` 启用流式输出。响应处理方式与 OpenAI SDK 示例类似，通过迭代响应对象，检查 `chunk.choices[0].delta.content` 获取文本片段。这表明它也遵循类似 SSE 的格式。
6.  **错误响应格式:** 文档中列出了常见的错误代码及其原因和解决方案，例如 400 (参数格式错误), 401 (API Key 未正确设置), 403 (权限不足), 429 (请求速率限制), 503/504 (模型过载)。具体的错误响应体结构未在文本中详细给出，但通常会包含错误代码和错误信息。

