Cherry Studio通过一套完整的中间件架构来实现不同推理模型的CoT可视化，以下是核心实现方案：

## 1. 推理模型识别

Cherry Studio使用正则表达式来识别推理模型，支持多种模型格式： models.ts:214-215
```typescript
export const REASONING_REGEX =
  /^(o\d+(?:-[\w-]+)?|.*\b(?:reasoning|reasoner|thinking)\b.*|.*-[rR]\d+.*|.*\bqwq(?:-[\w-]+)?\b.*|.*\bhunyuan-t1(?:-[\w-]+)?\b.*|.*\bglm-zero-preview\b.*|.*\bgrok-3-mini(?:-[\w-]+)?\b.*)$/i
```

这个正则表达式覆盖了o1系列、reasoning/reasoner模型、qwq系列、hunyuan-t1、glm-zero-preview等推理模型。

## 2. 思考内容数据结构

专门定义了`ThinkingMessageBlock`类型来存储思考过程： newMessage.ts:72-76

```
// 思考块 - 模型推理过程
export interface ThinkingMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.THINKING
  content: string
  thinking_millsec?: number
}
```
## 3. 不同模型的处理策略

### DeepSeek Reasoner处理

对于DeepSeek等通过`reasoning_content`字段返回思考过程的模型，在OpenAI客户端中提取： OpenAIApiClient.ts:658-665


```
          // 处理推理内容 (e.g. from OpenRouter DeepSeek-R1)
          // @ts-ignore - reasoning_content is not in standard OpenAI types but some providers use it
          const reasoningText = contentSource.reasoning_content || contentSource.reasoning
          if (reasoningText) {
            controller.enqueue({
              type: ChunkType.THINKING_DELTA,
              text: reasoningText
            })
          }
```
### ChatGLM 标签处理

对于ChatGLM等使用`<think>`标签包裹思考过程的模型，专门实现了标签提取中间件： ThinkingTagExtractionMiddleware.ts:12-15


```
// 不同模型的思考标签配置
const reasoningTags: TagConfig[] = [
  { openingTag: '<think>', closingTag: '</think>', separator: '\n' },
  { openingTag: '###Thinking', closingTag: '###Response', separator: '\n' }
]
```
标签提取使用`TagExtractor`类来解析标签内容： tagExtraction.ts:50-125
```
/**
 * 处理文本块，返回处理结果
 */
processText(newText: string): TagExtractionResult[] {
  this.state.textBuffer += newText
  const results: TagExtractionResult[] = []

  // 处理标签提取逻辑
  while (true) {
    const nextTag = this.state.isInsideTag ? this.config.closingTag : this.config.openingTag
    const startIndex = getPotentialStartIndex(this.state.textBuffer, nextTag)

    if (startIndex == null) {
      const content = this.state.textBuffer
      if (content.length > 0) {
        results.push({
          content: this.addPrefix(content),
          isTagContent: this.state.isInsideTag,
          complete: false
        })

        if (this.state.isInsideTag) {
          this.state.accumulatedTagContent += this.addPrefix(content)
          this.state.hasTagContent = true
        }
      }
      this.state.textBuffer = ''
      break
    }

    // 处理标签前的内容
    const contentBeforeTag = this.state.textBuffer.slice(0, startIndex)
    if (contentBeforeTag.length > 0) {
      results.push({
        content: this.addPrefix(contentBeforeTag),
        isTagContent: this.state.isInsideTag,
        complete: false
      })

      if (this.state.isInsideTag) {
        this.state.accumulatedTagContent += this.addPrefix(contentBeforeTag)
        this.state.hasTagContent = true
      }
    }

    const foundFullMatch = startIndex + nextTag.length <= this.state.textBuffer.length

    if (foundFullMatch) {
      // 如果找到完整的标签
      this.state.textBuffer = this.state.textBuffer.slice(startIndex + nextTag.length)

      // 如果刚刚结束一个标签内容，生成完整的标签内容结果
      if (this.state.isInsideTag && this.state.hasTagContent) {
        results.push({
          content: '',
          isTagContent: false,
          complete: true,
          tagContentExtracted: this.state.accumulatedTagContent
        })
        this.state.accumulatedTagContent = ''
        this.state.hasTagContent = false
      }

      this.state.isInsideTag = !this.state.isInsideTag
      this.state.afterSwitch = true

      if (this.state.isInsideTag) {
        this.state.isFirstTag = false
      } else {
        this.state.isFirstText = false
      }
    } else {
      this.state.textBuffer = this.state.textBuffer.slice(startIndex)
      break
    }
  }

  return results
}

```
## 4. 流处理中间件架构

### 思考块处理中间件

负责处理直接从API返回的推理内容，计算思考时间并生成完成事件： ThinkChunkMiddleware.ts:50-87
```
  transform(chunk: GenericChunk, controller) {
    if (chunk.type === ChunkType.THINKING_DELTA) {
      const thinkingChunk = chunk as ThinkingDeltaChunk

      // 第一次接收到思考内容时记录开始时间
      if (!hasThinkingContent) {
        hasThinkingContent = true
        thinkingStartTime = Date.now()
      }

      accumulatedThinkingContent += thinkingChunk.text

      // 更新思考时间并传递
      const enhancedChunk: ThinkingDeltaChunk = {
        ...thinkingChunk,
        thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
      }
      controller.enqueue(enhancedChunk)
    } else if (hasThinkingContent && thinkingStartTime > 0) {
      // 收到任何非THINKING_DELTA的chunk时，如果有累积的思考内容，生成THINKING_COMPLETE
      const thinkingCompleteChunk: ThinkingCompleteChunk = {
        type: ChunkType.THINKING_COMPLETE,
        text: accumulatedThinkingContent,
        thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
      }
      controller.enqueue(thinkingCompleteChunk)
      hasThinkingContent = false
      accumulatedThinkingContent = ''
      thinkingStartTime = 0

      // 继续传递当前chunk
      controller.enqueue(chunk)
    } else {
      // 其他情况直接传递
      controller.enqueue(chunk)
    }
  }
})

```
### 标签提取中间件

专门处理文本流中的思考标签，将标签内容转换为思考块： ThinkingTagExtractionMiddleware.ts:62-110
```
transform(chunk: GenericChunk, controller) {
  if (chunk.type === ChunkType.TEXT_DELTA) {
    const textChunk = chunk as TextDeltaChunk

    // 使用 TagExtractor 处理文本
    const extractionResults = tagExtractor.processText(textChunk.text)

    for (const extractionResult of extractionResults) {
      if (extractionResult.complete && extractionResult.tagContentExtracted) {
        // 生成 THINKING_COMPLETE 事件
        const thinkingCompleteChunk: ThinkingCompleteChunk = {
          type: ChunkType.THINKING_COMPLETE,
          text: extractionResult.tagContentExtracted,
          thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
        }
        controller.enqueue(thinkingCompleteChunk)

        // 重置思考状态
        hasThinkingContent = false
        thinkingStartTime = 0
      } else if (extractionResult.content.length > 0) {
        if (extractionResult.isTagContent) {
          // 第一次接收到思考内容时记录开始时间
          if (!hasThinkingContent) {
            hasThinkingContent = true
            thinkingStartTime = Date.now()
          }

          const thinkingDeltaChunk: ThinkingDeltaChunk = {
            type: ChunkType.THINKING_DELTA,
            text: extractionResult.content,
            thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
          }
          controller.enqueue(thinkingDeltaChunk)
        } else {
          // 发送清理后的文本内容
          const cleanTextChunk: TextDeltaChunk = {
            ...textChunk,
            text: extractionResult.content
          }
          controller.enqueue(cleanTextChunk)
        }
      }
    }
  } else {
    // 其他类型的chunk直接传递（包括 THINKING_DELTA, THINKING_COMPLETE 等）
    controller.enqueue(chunk)
  }
},

```
## 5. 消息流处理

实现了思考内容的流式处理回调： messageThunk.ts:474-521
```
onThinkingChunk: async (text, thinking_millsec) => {
  accumulatedThinking += text
  if (thinkingBlockId) {
    const blockChanges: Partial<MessageBlock> = {
      content: accumulatedThinking,
      status: MessageBlockStatus.STREAMING,
      thinking_millsec: thinking_millsec
    }
    throttledBlockUpdate(thinkingBlockId, blockChanges)
  } else if (initialPlaceholderBlockId) {
    // First chunk for this block: Update type and status immediately
    lastBlockType = MessageBlockType.THINKING
    const initialChanges: Partial<MessageBlock> = {
      type: MessageBlockType.THINKING,
      content: accumulatedThinking,
      status: MessageBlockStatus.STREAMING
    }
    thinkingBlockId = initialPlaceholderBlockId
    initialPlaceholderBlockId = null
    dispatch(updateOneBlock({ id: thinkingBlockId, changes: initialChanges }))
    saveUpdatedBlockToDB(thinkingBlockId, assistantMsgId, topicId, getState)
  } else {
    const newBlock = createThinkingBlock(assistantMsgId, accumulatedThinking, {
      status: MessageBlockStatus.STREAMING,
      thinking_millsec: 0
    })
    thinkingBlockId = newBlock.id // 立即设置ID，防止竞态条件
    await handleBlockTransition(newBlock, MessageBlockType.THINKING)
  }
},
onThinkingComplete: (finalText, final_thinking_millsec) => {
  if (thinkingBlockId) {
    const changes = {
      type: MessageBlockType.THINKING,
      content: finalText,
      status: MessageBlockStatus.SUCCESS,
      thinking_millsec: final_thinking_millsec
    }
    cancelThrottledBlockUpdate(thinkingBlockId)
    dispatch(updateOneBlock({ id: thinkingBlockId, changes }))
    saveUpdatedBlockToDB(thinkingBlockId, assistantMsgId, topicId, getState)
  } else {
    console.warn(
      `[onThinkingComplete] Received thinking.complete but last block was not THINKING (was ${lastBlockType}) or lastBlockId  is null.`
    )
  }
  thinkingBlockId = null
},

```


流处理服务负责分发不同类型的数据块： StreamProcessingService.ts:63-69
```
case ChunkType.THINKING_DELTA: {
  if (callbacks.onThinkingChunk) callbacks.onThinkingChunk(data.text, data.thinking_millsec)
  break
}
case ChunkType.THINKING_COMPLETE: {
  if (callbacks.onThinkingComplete) callbacks.onThinkingComplete(data.text, data.thinking_millsec)
  break

```
## 6. UI可视化组件

`ThinkingBlock`组件实现可折叠的思考过程显示，包含灯泡图标、思考时间和复制功能： ThinkingBlock.tsx:54-106
```
return (
  <CollapseContainer
    activeKey={activeKey}
    size="small"
    onChange={() => setActiveKey((key) => (key ? '' : 'thought'))}
    className="message-thought-container"
    expandIconPosition="end"
    items={[
      {
        key: 'thought',
        label: (
          <MessageTitleLabel>
            <motion.span
              style={{ height: '18px' }}
              variants={lightbulbVariants}
              animate={isThinking ? 'active' : 'idle'}
              initial="idle">
              <Lightbulb size={18} />
            </motion.span>
            <ThinkingText>
              <ThinkingTimeSeconds blockThinkingTime={block.thinking_millsec} isThinking={isThinking} />
            </ThinkingText>
            {/* {isThinking && <BarLoader color="#9254de" />} */}
            {!isThinking && (
              <Tooltip title={t('common.copy')} mouseEnterDelay={0.8}>
                <ActionButton
                  className="message-action-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyThought()
                  }}
                  aria-label={t('common.copy')}>
                  {!copied && <i className="iconfont icon-copy"></i>}
                  {copied && <CheckOutlined style={{ color: 'var(--color-primary)' }} />}
                </ActionButton>
              </Tooltip>
            )}
          </MessageTitleLabel>
        ),
        children: (
          //  FIXME: 临时兼容
          <div
            style={{
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family)',
              fontSize
            }}>
            <Markdown block={block} />
          </div>
        )
      }
    ]}
  />
)

```
## Notes

这套架构的核心优势在于通过中间件模式实现了对不同推理模型格式的统一处理。你可以参考这个设计，在你的浏览器插件中实现：

1. **模型识别层**：根据模型ID判断是否为推理模型
2. **数据解析层**：分别处理`reasoning_content`字段和`<think>`标签格式
3. **流处理层**：实时解析和分发思考内容
4. **UI展示层**：可折叠的思考过程组件

对于你提到的提供商（OpenAI、Claude、Gemini、OpenRouter、SiliconFlow、DeepSeek、智谱AI），可以根据各自的响应格式实现相应的解析逻辑。