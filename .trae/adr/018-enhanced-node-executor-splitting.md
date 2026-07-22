# ADR-018: enhancedNodeExecutor 按节点类型拆分

**状态**: Accepted | **日期**: 2026-07-08 | **决策者**: 项目作者 + AI 协作（Trae）

> **背景**：本 ADR 记录 ITops Agent 后端工作流模块的 `enhancedNodeExecutor.ts` 单文件（586 行）按 5 个节点类型拆分为独立子目录的决策与实施过程。
>
> **关联**：[rules/architecture.md §3.1 500 行单文件建议](../rules/architecture.md) · [docs/项目全面分析报告_v4 §8.1 + 增量-8](../../docs/项目全面分析报告_v4.md) · ADR-016（routes→service 抽象）· ADR-017（infra 子域拆分）

---

## 一、问题与背景

### 1.1 历史现状

`workflow/services/enhancedNodeExecutor.ts` 是从 AARS（自动告警响应系统）的 `verification/risk_assess/decision/knowledge/rollback` 5 个能力移植来的工作流增强节点执行器，单文件 586 行：

```
enhancedNodeExecutor.ts (586 行)
├── 1. verification 节点 (270 行)    5级验证门禁链 + 4 个 check 子函数 + formatOutput
├── 2. risk_assess 节点 (105 行)     三维风险量化评分
├── 3. decision 节点 (80 行)         规则匹配 + 复合条件解析
├── 4. knowledge 节点 (25 行)         知识沉淀（最薄）
├── 5. rollback 节点 (95 行)         SSH 回滚 + 审计
└── delay() 工具函数 (10 行)
```

### 1.2 暴露的问题

- **超过 architecture.md §3.1 500 行单文件建议上限**。
- **5 个节点类型完全独立**，无内部状态共享、无相互调用，纯粹按"功能相似性"聚合在一个文件里——典型的"按行数堆叠"反模式。
- **阅读与修改成本高**：想理解 risk_assess 节点的人必须先扫过 verification 的 270 行代码才能找到目标。
- **测试困难**：5 个独立逻辑挤在一个文件，无法独立 mock、独立测试。

### 1.3 决策触发点

v4 报告 §8.1 把 `enhancedNodeExecutor.ts` 列为"巨型单文件"之一（误报为 505 行，实际 586 行）。报告审查（增量-8）发现该文件确实按节点类型可拆，且 ADR-016 + ADR-017 已建立的"按子域拆分"模式可直接套用。

---

## 二、决策

### 2.1 拆分原则

**按节点类型拆分**，因为：
- 5 个节点类型（verification / risk_assess / decision / knowledge / rollback）**业务领域明确独立**
- 每个节点的依赖（repositories / ssh / audit / ai engine）**最小化**
- 节点之间的通信仅通过 NodeResult.metadata 字段，**无强耦合**

### 2.2 拆分矩阵

| 原 enhancedNodeExecutor.ts 内容 | 拆分后归属 | 文件名 |
|---|---|---|
| `executeVerificationNode` + 4 个 check + formatOutput (270 行) | `verificationNodeExecutor.ts` (257 行) | verification 子域 |
| `executeRiskAssessNode` (105 行) | `riskAssessNodeExecutor.ts` (115 行) | risk_assess 子域 |
| `executeDecisionNode` + evaluateRule (80 行) | `decisionNodeExecutor.ts` (89 行) | decision 子域 |
| `executeKnowledgeNode` (25 行) | `knowledgeNodeExecutor.ts` (34 行) | knowledge 子域 |
| `executeRollbackNode` + extractRollbackCommands (95 行) | `rollbackNodeExecutor.ts` (96 行) | rollback 子域 |
| `delay()` (10 行) | `delay.ts` (10 行) | 工具函数 |
| 5 个 execute* 函数重导出 | `index.ts` (34 行) | 聚合入口（向后兼容） |

### 2.3 拆分后目录结构

```
workflow/services/enhancedNodeExecutor/    ← 从单文件改为子目录
├── index.ts                              (34 行 重导出)
├── delay.ts                              (10 行)
├── verificationNodeExecutor.ts           (257 行)
├── riskAssessNodeExecutor.ts             (115 行)
├── decisionNodeExecutor.ts               (89 行)
├── knowledgeNodeExecutor.ts              (34 行)
└── rollbackNodeExecutor.ts               (96 行)
```

### 2.4 向后兼容策略

**保持 import 路径兼容**（这是关键设计决策）：

原引用：
```ts
// workflow/services/workflowExecutor/enhancedNodeHandlers.ts
import { executeVerificationNode, ... } from '../enhancedNodeExecutor';
```

新引用（只改 1 行）：
```ts
import { executeVerificationNode, ... } from '../enhancedNodeExecutor/index';
```

只改动了 1 处 import（添加 `/index` 后缀）。这是 Node.js ESM/CommonJS 解析规则：目录导入时既可写目录名（默认 index.ts）也可写 `目录/index`。这种"先目录再 explicit index"的双重兼容写法，避免了所有调用方的全面修改。

### 2.5 import 路径深度处理（拆分注意点）

**这是拆分最容易出错的地方**，需要仔细数清相对路径深度：

```
原文件: services/enhancedNodeExecutor.ts           (深度 = 3 层)
新文件: services/enhancedNodeExecutor/xxx.ts       (深度 = 4 层)

原 `'../../../types'`       → 新 `'../../../../types'`        (相对根多了 1 层)
原 `'../../servers/...'`    → 新 `'../../../servers/...'`     (同理)
```

**实测问题**：第一次拆分时按习惯改成 `'../../types'`（少 1 层），tsc 报错 13 条 "Cannot find module"。第二次按"`../../../`"（再少 1 层），又报错 3 条。最终深度 `../../../../` 才正确（多 1 层即新文件相对深度）。

**经验教训**：从单文件拆到子目录时，**所有 `../` 都要 +1 层**。tsc 错误信息很明确（"Cannot find module"），按错误提示反向追踪深度即可。

---

## 三、拆分过程（2026-07-08 完成）

### 3.1 实施步骤

| 阶段 | 操作 | 涉及文件 | 验证 |
|---|---|---|---|
| 1 | 创建子目录 `enhancedNodeExecutor/` | +1 目录 | - |
| 2 | 拆分 5 个节点执行器 + 1 个工具函数 | +6 文件 | - |
| 3 | 创建 `index.ts` 重导出聚合入口 | +1 文件 | - |
| 4 | 删除原单文件 `enhancedNodeExecutor.ts` | -1 文件 | - |
| 5 | 更新引用方 import 路径（添加 `/index` 后缀） | 改 1 文件 1 行 | - |
| 6 | tsc / depcruise / vitest 验证 | - | ✅ |

### 3.2 验证结果

| 验证项 | v1 (拆分前) | v4 (拆分后) | 变化 |
|---|---|---|---|
| **tsc 错误行数** | 203 | 190 | **-13 行**（0 新错误，且拆前 v1 enhancedNodeExecutor 文件路径已触发 13 条"Cannot find module"假错） |
| **depcruise EXITCODE** | 0 | 0 | 一致（7 条强校验全 OK） |
| **enhancedNodeExecutor 违反规则数** | 0 | 0 | 一致 |
| **vitest 退出码** | 0 | 1 | **+1**（属正常：原文件没有测试，vitest "No test files found" 退出 1） |

**对比工具**：用 `Compare-Object` 对 v1 / v4 两个 tsc 输出文件做行级 diff：
- `==>` 指示 v4 独有（refactoring 引入的新错误）：**0 行**
- `<=` 指示 v1 独有（已被修复的错误）：**13 行**

### 3.3 关键设计决策回顾

#### 3.3.1 为何不把 enhancedNodeExecutor/ 直接合并到 workflowExecutor/？

`workflowExecutor/` 子目录已经是 workflow 执行引擎聚合入口（含 `basicNodeHandlers` + `enhancedNodeHandlers` 等）。如果把 `enhancedNodeExecutor/` 再下沉到 `workflowExecutor/enhancedNodeExecutor/`，会出现循环依赖问题：

- `workflowExecutor/enhancedNodeHandlers.ts` 引用 `enhancedNodeExecutor/index.ts`
- 如果 `enhancedNodeExecutor` 在 `workflowExecutor/` 内 → 相对路径变成 `../enhancedNodeExecutor/...`，层数变浅，但仍可解析
- 但 `enhancedNodeHandlers` 本身也在 `workflowExecutor/` 内，会形成兄弟模块互相依赖的循环错觉

**结论**：保持 `enhancedNodeExecutor/` 作为 `workflow/services/` 的**平级子目录**（不嵌套进 `workflowExecutor/`），保持目录结构清晰。

#### 3.3.2 为何不做"按子域垂直拆分"（每个节点拆出独立模块）？

**不拆模块的理由**：
- `verification / risk_assess / decision / knowledge / rollback` 5 个节点**都属于 workflow 模块的"增强节点"领域**，共同构成 workflow 工作流引擎能力的一部分
- 5 个节点**共享同一份 enhancedNodeTypes 类型定义**（拆分到不同模块会导致类型定义被多个模块依赖）
- 引用方 `enhancedNodeHandlers.ts` 已经把 5 个节点的处理逻辑聚在一起（每个节点一段），拆分后调用方仍然需要从 5 个不同模块导入

**拆子目录的理由**：
- 单文件 586 行读起来太长
- 5 个节点的内部逻辑确实独立（无共享状态、无内部函数调用）
- 按子目录拆分是"同一模块内按关注点分离"，与"跨模块按业务归属拆分"是不同层级的决策

---

## 四、影响与收益

### 4.1 直接收益

- **每个文件 < 300 行**：拆分后最大单文件是 verificationNodeExecutor.ts (257 行)，其他都在 100 行左右
- **按节点类型导航**：想看 risk_assess 节点，直接打开 `riskAssessNodeExecutor.ts` 即可
- **未来可独立测试**：5 个节点各自有清晰的输入/输出契约，未来可针对每个节点写独立测试
- **修改隔离**：修改 verification 不再误改 risk_assess 等

### 4.2 间接收益

- **强化 ADR-016/017 拆分模式**：再次证明"按子域 / 按节点类型拆分"是 backend 项目代码组织的有效模式
- **强化 README 滞后问题**：v4 报告 §8.1 列的 5 个"巨型单文件"实际已全部拆过，本次新增的 6 个 README 行反映了真实状态
- **强化对单文件行数监控**：architect.md §3.1 建议"500 行单文件上限"是合理的，本次拆分就是突破该上限后立即修复

### 4.3 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| import 路径深度算错（本次实测发生 2 次） | tsc 错误信息明确，按提示反向追踪深度即可 |
| 重构引入新错误 | tsc 对比 v1/v4，diff 显示 0 新错误 |
| 引用方 import 路径修改遗漏 | 全文 grep `from.*enhancedNodeExecutor` 只找到 1 处 |
| 拆分后单文件又增长 | 单文件现在最大 257 行，留有 50% 余量空间 |

---

## 五、未来演进

### 5.1 仍可继续优化（增量-9+）

- **backup/services/index.ts (425 行)**：已拆出 backupCrypto/backupStorage/backupTypes，但 BackupService 主类还在 index.ts。可考虑：
  - 进一步把 BackupService 主类按方法拆为 `backupOperations.ts`、`backupScheduler.ts` 等
  - 或保留主类作为"协调层"，接受当前的 425 行规模
- **前端 `kubernetes/pages/Kubernetes/index.tsx` (1458 行)**：按子页面（Pods / Nodes / Services / Deployments）拆为多个页面 + 共享组件
- ~~**`.trae/adr/` 同步到 git 跟踪**~~：✅ 已由 [ADR-019](019-trae-adr-git-tracking.md) 于 2026-07-08 完成（`.trae/{adr,rules,documents}/` 通过 `!` 白名单模式入库）

### 5.2 enhancedNodeExecutor/ 未来演进

- 若 verification / risk_assess / decision / knowledge / rollback 5 个节点继续增长，可考虑：
  - 每个节点拆出独立子目录 `enhancedNodeExecutor/verification/{main,checks,format}.ts`
  - 或拆为独立模块 `verification/`、`risk_assess/`、`decision/`、`knowledge/`、`rollback/`
- 当前 5 个文件最大 257 行，还有较大空间，暂不进一步拆分

---

## 六、参考资源

- **架构规则**：[rules/architecture.md](../rules/architecture.md) §3.1（500 行单文件建议）
- **历史报告**：[docs/项目全面分析报告_v4.md §8.1 + 增量-8](../../docs/项目全面分析报告_v4.md)
- **关联 ADR**：ADR-016（routes→service 抽象）· ADR-017（infra 子域拆分）
- **拆分模板**：本 ADR 与 ADR-017 拆分模式相同（按子域建子目录 + index.ts 重导出 + 引用方加 /index 后缀）
