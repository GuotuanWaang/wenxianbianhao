# Task Plan: 项目更名与 Latest Release 更新

## Goal
将项目名称改为“文献分类编号与题名翻译”，同步更新中英文 README，并发布新的 GitHub Latest Release。

## Current Phase
Phase 4 (提交与发布 Latest Release)

## Phases
### Phase 1: 范围确认与定位
- [x] 检查项目名相关配置与文档位置
- [x] 检查当前版本与已有 GitHub Release
- [x] 更新计划文件进入本轮任务
- **Status:** complete

### Phase 2: 改名与文档同步
- [x] 更新插件显示名（manifest/bootstrap）
- [x] 更新 `README.md` 中英文项目名称
- [x] 同步 README 版本号到新版本
- **Status:** complete

### Phase 3: 构建与验证
- [x] 执行构建生成新版本 XPI
- [x] 校验版本号与产物文件名一致
- [x] 记录验证结果
- **Status:** complete

### Phase 4: 提交与发布 Latest Release
- [ ] 提交并推送代码到 `origin/main`
- [ ] 创建/更新 GitHub Release 为最新版本
- [ ] 附加新版本 XPI 资产
- **Status:** in_progress

### Phase 5: 交付
- [ ] 汇总修改内容、提交号和 Release 链接
- [ ] 向用户回传结果
- **Status:** pending

## Key Questions
1. 改名仅影响显示名，还是连插件 ID/偏好前缀也一起调整？
2. Release 版本是否采用 `v0.2.4`（基于现有 `0.2.3` 递增）？
3. 是否保留构建产物文件命名 `collection-numbering-<version>.xpi`？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 显示名改为“文献分类编号与题名翻译” | 直接满足用户命名要求 |
| 保持插件 ID 与偏好前缀不变 | 避免破坏已有安装与设置迁移 |
| 版本从 `0.2.3` 升级到 `0.2.4` | 作为一次可发布变更 |
| 保持 XPI 文件名前缀 `collection-numbering-` | 减少兼容风险并复用现有构建脚本 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 暂无 | - | - |

## Notes
- 当前 GitHub Release 列表显示 `v0.1.4` 为 Latest，需要发布新版本覆盖。
