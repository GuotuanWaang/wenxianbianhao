# Task Plan: Zotero 8 文献分类编号插件

## Goal
实现一个 Zotero 8 插件，在用户选中的分类（Collection）中为文献按顺序生成编号，并把编号写入文献字段，支持重复执行时按规则更新。

## Current Phase
Complete

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Execute the plan step by step
- [x] Write plugin code and assets
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver usage notes to user
- **Status:** complete

## Key Questions
1. 编号写入哪个字段最稳妥（extra、callNumber、shortTitle）？
2. 编号规则是什么（纯数字、固定前缀、补零位数）？
3. 是否需要按当前排序结果编号，还是按创建时间等固定规则？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 编号写入 `extra/CollectionNumber`，不再写入 `callNumber` | 避免与索书号及其他插件冲突，降低字段污染风险 |
| 通过 Zotero 菜单触发，对当前选中分类生效 | 符合“对分类下文献编号”的主要场景，交互简单 |
| 参数通过原生 prompt 分步输入 | 避免自定义 UI，确保 Zotero 8 下兼容性与开发效率 |
| 打包方式采用纯脚本 zip 出 `.xpi` | 无额外构建依赖，便于本地快速迭代 |
| 使用 `ItemTreeManager.registerColumn` 注册“编号”列并排到创建者前 | 满足列表展示诉求且不篡改作者数据 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 读取不存在的参考脚本 `build-variants.js` | 1 | 改为读取实际存在的 `scripts/build-xpi.sh` |

## Notes
- 先确保插件结构可在 Zotero 8 加载，再扩展设置能力。
