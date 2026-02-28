# Paper-Classifier 插件开发提示（Zotero 8）

以下提示可直接用于让开发者/AI 按“稳定兼容优先”的方式实现 Zotero 8 Bootstrap 插件，避免历史上出现的 UI 与兼容性问题。

## 建议提示词

请扮演资深 Zotero 8 插件工程师，实现一个 Bootstrap 插件，并严格遵守以下要求：

1. 兼容性优先
- 使用 `manifest_version: 2`。
- `applications.zotero` 使用稳定兼容范围：
  - `strict_min_version: "6.999"`
  - `strict_max_version: "9.9.*"`
- 在 `bootstrap.js` 的 `startup` 中同时兼容 `rootURI` 与 `resourceURI`。
- 启动时等待 `Zotero.initializationPromise`，如存在则等待 `Zotero.uiReadyPromise`。

2. UI 与设置页稳定性
- 提供工具菜单入口（主功能 + 设置入口），并在窗口卸载时清理菜单节点。
- 使用 `Zotero.PreferencePanes.register()` 注册设置页，避免重复注册：
  - 注册前清理同 ID/同 pluginID 历史 pane
  - 异步重试（最多 60 秒）等待 Preference API 可用
- 设置页输入控件用脚本驱动读写，不依赖脆弱的旧式自动绑定。

3. 偏好读写与迁移
- 统一用 `Zotero.Prefs.get(fullKey, true)` / `Zotero.Prefs.set(fullKey, value, true)` 读写全局偏好。
- 对历史错误分支做回退读取与自动迁移（读到旧值后写回正确分支）。
- 关键配置（API Key、模型、Endpoint）提供默认值与空值校验。

4. DeepSeek API 调用
- 采用 `XMLHttpRequest` 以兼容 Zotero 运行环境。
- 请求超时、网络错误、非 2xx 响应要给出明确错误消息。
- 响应解析需兼容多种结构（`message.content`、`text`、数组片段等）。
- 对 `deepseek-reasoner` 空内容场景增加一次 `deepseek-chat` 回退重试。

5. 构建与打包
- 构建脚本只打包必需文件，避免旧条目残留。
- 构建前删除同名输出包，防止 zip 增量污染。
- 包含 `icons` 多尺寸资源（16/32/48/96/128）。

6. 交付标准
- 提供完整安装步骤、使用步骤、已知限制与排错说明。
- 输出最小可复现场景与验证清单（语法检查、打包检查、关键功能手测）。
