## 变更类型

<!-- 请勾选以下适用的类型 -->

- [ ] Bug 修复 (fix)
- [ ] 新功能 (feat)
- [ ] 文档更新 (docs)
- [ ] 代码重构 (refactor)
- [ ] 样式/格式调整 (style)
- [ ] 测试相关 (test)
- [ ] 构建/部署/脚本 (chore)

## 变更描述

<!-- 请简要描述本次 PR 的变更内容 -->

## 相关问题

<!-- 关联的 Issue 编号，例如 Fixes #123 -->

## 测试方法

<!-- 请描述如何测试这些变更 -->

- [ ] 已在本地环境测试通过
- [ ] 已运行 `npm run check:arch` 检查架构约束
- [ ] 已运行 `npm run lint` 检查代码风格
- [ ] 已运行 `npm run format` 检查代码格式
- [ ] 已运行后端测试 `cd backend && npm test`
- [ ] 已更新相关文档（如适用）

## 架构约束说明

<!-- 本次变更是否涉及以下操作？请勾选并说明 -->

- [ ] 新增/修改了 `core/` 文件 — 确认没有导入 `modules/`
- [ ] 新增了模块间跨模块路由引用 — 确认使用 `services/` 通信
- [ ] 新增了模块 — 确认包含 `index.ts` 和 `routes.ts`
- [ ] 新增了前端跨模块引用 — 确认使用 `shared/` 组件
- [ ] 无以上情况

## 单文件行数检查（必填）

<!-- 参见 [rules/top-rules.md §二/§四](../../.trae/rules/top-rules.md) 与 [architecture.md §3.3](../../.trae/rules/architecture.md) -->

- [ ] 本次新增/重写的所有 .ts/.tsx 文件 ≤500 行（不含注释/空行）
- [ ] 超 500 行的既有文件本次**未修改**，或已提供拆分 PR（参见 [ADR-031 大文件拆分方法论](../../.trae/adr/031-v2-large-file-splitting-methodology.md) + [ADR-034 v001 migration 拆分](../../.trae/adr/034-v001-migration-splitting.md) 拆分范例）

## ADR 关联（架构变更时必填）

<!-- 本次变更是否影响架构、模块边界、依赖方向？ -->

- [ ] 本次变更**未影响**架构
- [ ] 本次变更影响架构，已新增/更新 ADR：`.trae/adr/NNN-<slug>.md`（编号接续现有 034，或参考 `adr/README.md` 取下一个可用编号）
- [ ] 不适用

## 截图（前端变更适用）

<!-- 如果涉及前端 UI 变更，请附上截图 -->

## 补充说明

<!-- 其他需要说明的内容 -->
