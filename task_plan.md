# Task Plan: README 双语化与 GitHub 开源发布

## Goal
读取并梳理当前项目实现，撰写准确的中英文双语 `README.md`，并将最新代码发布到 GitHub 仓库。

## Current Phase
Complete

## Phases
### Phase 1: 项目审阅与状态确认
- [x] 检查仓库结构与关键文件
- [x] 检查 Git 状态与远程仓库配置
- [x] 记录当前实现细节到 findings.md
- **Status:** complete

### Phase 2: README 双语文档重写
- [x] 基于实际实现整理功能说明
- [x] 生成中文+英文双语结构
- [x] 覆盖安装、构建、配置、使用流程
- **Status:** complete

### Phase 3: 本地验证
- [x] 验证 README 中命令与产物路径可用
- [x] 记录验证结果到 progress.md
- **Status:** complete

### Phase 4: GitHub 开源发布
- [x] 检查分支与待提交文件
- [x] 提交 README 及必要更新
- [x] 推送到 `origin/main`
- **Status:** complete

### Phase 5: 交付说明
- [x] 汇总修改内容与仓库地址
- [x] 向用户回传发布结果
- **Status:** complete

## Key Questions
1. README 采用单文件双语（中文在前、英文在后）还是双文件拆分？
2. 文档中是否明确写明题名翻译存储在 `relations`（而非 `extra`）？
3. 当前远端仓库是否已存在且可直接推送？
4. 是否需要在 README 中保留历史版本说明（0.1.x/0.2.x）？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 采用单文件双语 `README.md` | 满足“中英文 README”要求且便于维护 |
| 功能说明以源码行为为准（`bootstrap.js` + `manifest.json`） | 避免 README 与实现不一致 |
| 开源发布目标使用现有 `origin`：`GuotuanWaang/wenxianbianhao` | 仓库已初始化，最小化发布成本 |
| 在 README 明确“题名翻译写入 relations，不写入 Extra” | 与 0.2.x 当前实现一致，减少误解 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 暂无 | - | - |

## Notes
- 当前工作树已有历史未提交改动，本轮将基于现状继续推进，不回滚用户已有变更。
