# Findings & Decisions

## Requirements
- 用户需要一个 Zotero 8 插件。
- 主要功能：对某个分类（Collection）下的文献进行编号。
- 在编号基础上增加 DeepSeek API 英文题目翻译功能。
- 项目文件放在 `/Users/guotuan/Desktop/VS/wenxianbianhao`。
- 用户当前请求：先读取项目并撰写中英文 README，随后发布到 GitHub。

## Research Findings
- 目标目录当前为空，需要从零创建插件工程。
- 任务是多步骤开发，已启用文件化规划流程管理状态。
- 本机已有 Zotero 插件样例：`/Users/guotuan/Desktop/VS/open/cesi/collection-dedup`。
- 可复用结构：`manifest.json`（`manifest_version: 2`，`strict_max_version: 8.99.*`）+ `bootstrap.js`（`startup` / `onMainWindowLoad` / `shutdown` 生命周期）。
- 菜单注入方式可复用：在 `menu_ToolsPopup` 添加命令，在 `zotero-collectionmenu` 添加分类右键命令。
- `collection.getChildItems(false, false)` 可遍历分类下条目，搭配 `item.isRegularItem()` 可过滤出文献条目。
- `item.setField(\"extra\", value)` + `await item.saveTx()` 可写入插件专用编号，不占用索书号字段。
- Zotero 8 提供 `Zotero.ItemTreeManager.registerColumn()`，可注册自定义列并在主列表展示。
- `paper-classifier` 已验证：API 调用建议用 `XMLHttpRequest`；配置建议使用 `Zotero.Prefs.get/set(fullKey, true)` 并做 legacy 分支回退。
- 对 `deepseek-reasoner` 空响应场景，`paper-classifier` 采用回退到 `deepseek-chat` 的策略可提升稳定性。
- 需要在 Zotero 设置左侧显示插件配置时，应使用 `Zotero.PreferencePanes.register()` 注册 `preferencesPane.xhtml`。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 采用菜单命令触发批量编号 | 用户容易理解，开发复杂度低 |
| 默认从 1 开始顺序编号并支持补零 | 满足常见文献管理需求 |
| 采用 `collection-dedup` 的插件骨架改造 | 已验证适用于 Zotero 7/8，减少兼容风险 |
| 增加“是否覆盖已有编号”开关 | 允许增量编号，避免误覆盖已有插件编号 |
| 构建产物固定输出到 `dist/collection-numbering-<version>.xpi` | 便于安装与版本管理 |
| 增加插件头像并写入 `manifest.icons` | 让插件在 Zotero 插件列表中可识别 |
| 翻译功能以独立菜单命令提供（翻译 + 配置） | 降低与编号流程耦合，操作更清晰 |
| 翻译结果存储到插件专用 `relations` | 避免污染 `extra`，并保留原始标题不变 |
| “配置 DeepSeek 翻译”改为打开 Zotero 设置页 | 与用户预期一致，避免弹窗配置体验不一致 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 暂无 Zotero 8 运行环境可直接联调 | 先完成结构与逻辑代码，并提供安装测试步骤 |
| `callNumber` 与其他插件冲突 | 改为 `extra/CollectionNumber` 存储，并将列表“编号”列改读该值 |
| 需要避免重复出现 UI/兼容性问题 | 参照 `paper-classifier` 的偏好读写、API 调用、错误处理模式，并新增开发提示文档固化规则 |

## Resources
- 项目目录：`/Users/guotuan/Desktop/VS/wenxianbianhao`
- 规划文件：`task_plan.md`, `findings.md`, `progress.md`
- 参考插件：`/Users/guotuan/Desktop/VS/open/cesi/collection-dedup/manifest.json`
- 参考插件：`/Users/guotuan/Desktop/VS/open/cesi/collection-dedup/bootstrap.js`
- 构建脚本：`/Users/guotuan/Desktop/VS/wenxianbianhao/scripts/build-xpi.sh`
- 插件主逻辑：`/Users/guotuan/Desktop/VS/wenxianbianhao/bootstrap.js`
- 参考实现：`/Users/guotuan/Desktop/VS/openfenleiii/paper-classifier/paper-classifier/addon/deepseekClient.js`
- 开发提示：`/Users/guotuan/Desktop/VS/wenxianbianhao/PAPER_CLASSIFIER_DEV_PROMPT.md`

## 2026-02-28 README & 发布任务新发现
- 远端仓库已存在：`origin -> https://github.com/GuotuanWaang/wenxianbianhao.git`。
- 当前分支为 `main`，并跟踪 `origin/main`。
- 工作区包含未提交改动与未跟踪文件（包含 `dist/collection-numbering-0.2.0~0.2.3.xpi`、`addon/` 等）。
- 当前 `manifest.json` 版本为 `0.2.3`，README 需与该版本特性保持一致。
- 当前 README 主要是中文说明，尚未形成结构化中英双语文档。
- 源码确认：
  - 编号写入 `extra/CollectionNumber`。
  - 题名翻译写入 `relations`（predicate: `https://local.collection-numbering.plugin/relation/title-translation`）。
  - Zotero 设置页通过 `Zotero.PreferencePanes.register()` 注册 `addon/chrome/content/preferencesPane.xhtml`。

## Visual/Browser Findings
- 本任务未使用网页或视觉信息源。
