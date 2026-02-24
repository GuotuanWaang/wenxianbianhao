# Findings & Decisions

## Requirements
- 用户需要一个 Zotero 8 插件。
- 主要功能：对某个分类（Collection）下的文献进行编号。
- 项目文件放在 `/Users/guotuan/Desktop/VS/wenxianbianhao`。

## Research Findings
- 目标目录当前为空，需要从零创建插件工程。
- 任务是多步骤开发，已启用文件化规划流程管理状态。
- 本机已有 Zotero 插件样例：`/Users/guotuan/Desktop/VS/open/cesi/collection-dedup`。
- 可复用结构：`manifest.json`（`manifest_version: 2`，`strict_max_version: 8.99.*`）+ `bootstrap.js`（`startup` / `onMainWindowLoad` / `shutdown` 生命周期）。
- 菜单注入方式可复用：在 `menu_ToolsPopup` 添加命令，在 `zotero-collectionmenu` 添加分类右键命令。
- `collection.getChildItems(false, false)` 可遍历分类下条目，搭配 `item.isRegularItem()` 可过滤出文献条目。
- `item.setField(\"extra\", value)` + `await item.saveTx()` 可写入插件专用编号，不占用索书号字段。
- Zotero 8 提供 `Zotero.ItemTreeManager.registerColumn()`，可注册自定义列并在主列表展示。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 采用菜单命令触发批量编号 | 用户容易理解，开发复杂度低 |
| 默认从 1 开始顺序编号并支持补零 | 满足常见文献管理需求 |
| 采用 `collection-dedup` 的插件骨架改造 | 已验证适用于 Zotero 7/8，减少兼容风险 |
| 增加“是否覆盖已有编号”开关 | 允许增量编号，避免误覆盖已有插件编号 |
| 构建产物固定输出到 `dist/collection-numbering-<version>.xpi` | 便于安装与版本管理 |
| 增加插件头像并写入 `manifest.icons` | 让插件在 Zotero 插件列表中可识别 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 暂无 Zotero 8 运行环境可直接联调 | 先完成结构与逻辑代码，并提供安装测试步骤 |
| `callNumber` 与其他插件冲突 | 改为 `extra/CollectionNumber` 存储，并将列表“编号”列改读该值 |

## Resources
- 项目目录：`/Users/guotuan/Desktop/VS/wenxianbianhao`
- 规划文件：`task_plan.md`, `findings.md`, `progress.md`
- 参考插件：`/Users/guotuan/Desktop/VS/open/cesi/collection-dedup/manifest.json`
- 参考插件：`/Users/guotuan/Desktop/VS/open/cesi/collection-dedup/bootstrap.js`
- 构建脚本：`/Users/guotuan/Desktop/VS/wenxianbianhao/scripts/build-xpi.sh`
- 插件主逻辑：`/Users/guotuan/Desktop/VS/wenxianbianhao/bootstrap.js`

## Visual/Browser Findings
- 本任务未使用网页或视觉信息源。
