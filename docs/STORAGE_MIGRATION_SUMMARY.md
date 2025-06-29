# 划词助手存储迁移总结

## 问题背景

根据用户反馈，划词助手的自定义选项在导入或添加后会消失，这是由于 Chrome 的 `chrome.storage.sync` 同步机制导致的。当用户的云端有旧的配置数据时，Chrome 会用云端的旧数据覆盖本地新保存的数据，导致新添加的自定义选项"消失"。

## 解决方案

将 `textSelectionHelperSettings`（划词助手设置）的存储从 `chrome.storage.sync` 迁移到 `chrome.storage.local`，以避免云端同步覆盖问题。

## 修改的文件

### 1. `js/text-selection-helper-settings.js`

#### 主要修改：
- **loadSettings()**: 改为从 `chrome.storage.local` 读取 `textSelectionHelperSettings`，语言设置仍从 `chrome.storage.sync` 读取
- **saveSettings()**: 改为保存到 `chrome.storage.local`
- **setupLanguageChangeListener()**: 增加对 `local` 存储变化的监听
- **新增 migrateDataFromSyncToLocal()**: 数据迁移函数，将现有的 sync 数据迁移到 local

#### 具体变更：
```javascript
// 原来：
chrome.storage.sync.get(['language', 'textSelectionHelperSettings'], ...)
chrome.storage.sync.set({ textSelectionHelperSettings: settingsToSave }, ...)

// 修改后：
chrome.storage.sync.get(['language'], ...)  // 语言设置仍在sync
chrome.storage.local.get(['textSelectionHelperSettings'], ...)  // 划词助手设置改为local
chrome.storage.local.set({ textSelectionHelperSettings: settingsToSave }, ...)
```

### 2. `js/text-selection-helper.js`

#### 主要修改：
- **initEnabledStateCache()**: 改为从 `chrome.storage.local` 读取
- **setupSettingsChangeListener()**: 改为监听 `local` 存储的变化
- **getTextSelectionHelperSettings()**: 改为从 `chrome.storage.local` 读取

#### 具体变更：
```javascript
// 原来：
chrome.storage.sync.get(['textSelectionHelperSettings'], ...)
if (namespace === 'sync' && changes.textSelectionHelperSettings) ...

// 修改后：
chrome.storage.local.get(['textSelectionHelperSettings'], ...)
if (namespace === 'local' && changes.textSelectionHelperSettings) ...
```

### 3. `js/background.js`

#### 主要修改：
- **chrome.storage.onChanged 监听器**: 增加对 `local` 存储变化的处理，将划词助手设置变化的广播逻辑移到 local 存储处理中

#### 具体变更：
```javascript
// 新增对 local 存储的监听
if (namespace === 'local') {
    // 处理划词助手设置变化
    if (changes.textSelectionHelperSettings) {
        // 广播到所有标签页
    }
}
```

## 数据迁移机制

### 迁移逻辑（改进版）：
1. 检查 `chrome.storage.local` 中是否已有 `textSelectionHelperSettingsVersion` 版本标记
2. 如果版本标记已存在，跳过迁移（避免重复执行）
3. 如果没有版本标记，从 `chrome.storage.sync` 中读取 `textSelectionHelperSettings`
4. 如果 sync 中有数据，复制到 local 存储并设置版本标记为 '1.0'
5. 清除 sync 存储中的 `textSelectionHelperSettings`（避免未来冲突）
6. 如果 sync 中没有数据，仍然设置版本标记，避免重复检查

### 版本标记机制：
- 使用 `textSelectionHelperSettingsVersion: '1.0'` 作为迁移完成标记
- 确保每个用户只执行一次迁移，提高性能和稳定性
- 即使迁移失败或无数据，也会设置标记避免重复尝试

### 迁移时机：
- 在 `initTextSelectionHelperSettings()` 函数开始时自动执行
- 确保用户现有的设置不会丢失

## 影响分析

### 正面影响：
1. **解决同步覆盖问题**: 避免云端旧数据覆盖本地新数据
2. **提高稳定性**: 本地存储更稳定，不受网络和同步状态影响
3. **向后兼容**: 自动迁移现有数据，用户无感知

### 权衡：
1. **失去跨设备同步**: 划词助手的自定义选项将不再跨设备同步
2. **存储分离**: 语言设置等仍在 sync 存储，划词助手设置在 local 存储

## 测试建议

1. 使用 `test_storage_migration.html` 测试迁移逻辑
2. 验证现有用户的设置是否正确迁移
3. 测试新用户的设置保存和读取
4. 验证设置变化的实时同步是否正常工作

## 部署注意事项

1. 这是一个破坏性变更，需要在版本说明中告知用户
2. 建议在发布前进行充分测试
3. 考虑在设置页面添加说明，告知用户划词助手设置不再跨设备同步

## 回滚方案

如果需要回滚，可以：
1. 将所有 `chrome.storage.local` 调用改回 `chrome.storage.sync`
2. 创建反向迁移函数，将数据从 local 迁移回 sync
3. 移除 local 存储的监听逻辑
