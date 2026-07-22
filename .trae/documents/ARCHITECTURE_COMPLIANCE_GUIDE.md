# 架构合规指南 — 新贡献者必读（精简版）

> **5 分钟读懂本项目架构规则**。所有内容已与 [.trae/rules/architecture.md](../rules/architecture.md) 对齐。
>
> **完整规则**：[.trae/rules/architecture.md](../rules/architecture.md)

---

## 5 分钟读懂：架构核心

### 一句话

```
core/  →  modules/  →  routes/      ← 依赖方向（单向）
业务代码不碰 SQL，必须经过 repositories/
routes 只做 3 件事：参数校验 → 鉴权 → 调 service
```

### 4A 分层（4 个文件位置）

| 层 | 位置 | 职责 |
|----|------|------|
| 业务架构层 | modules/*/services/WorkflowEngine.ts 等 | 状态机、审批规则（系统的"宪法"） |
| 应用架构层 | modules/<24 modules> | 模块编排 + 功能实现 |
| 数据架构层 | repositories/ + models/database/ | 数据访问，**业务代码不碰 SQL** |
| 技术架构层 | core/ + middleware/ + shared/ | 基础设施，**禁止 import modules/** |

完整 24 模块清单：.trae/rules/architecture.md §1.2

---

## PR 前自检（6 个问题）

在提交 PR 前，问自己这 6 个问题。**任何一项答案是"是"，CI 会直接拦截**。

| # | 问题 | CI 规则 |
|:--:|------|---------|
| 1 | routes 写了业务逻辑吗？ | → 移到 services/ |
| 2 | core/ 或 repositories/ import 了 modules/ 吗？ | → CI 拦截 |
| 3 | 跨模块 import 了对方 routes.ts 吗？ | → 改用 services/ |
| 4 | 用了 `any` 类型吗？ | → 替换为 `unknown` 或具体类型 |
| 5 | 用了 `console.error` 而不是 `logger.error` 吗？ | → 替换为 `logger` |
| 6 | **routes/ 里直接 import 了 repositories/ 吗？** | → 必须经 services/ 中的 CRUD service（P1-5 强制） |

完整禁止清单：.trae/rules/architecture.md §四.2

---

## 新贡献者 5 步上手

1. **读本文件**（5 分钟）— 你正在读
2. **读 [.trae/rules/architecture.md](../rules/architecture.md)**（30 分钟）— 完整规则
3. **看现有模块** — 任一 `modules/<module>/README.md` 作为模板
4. **改完后跑** — `npm run lint` + `npx tsc --noEmit` + `npm run check:deps`
5. **PR 描述必填** — 关联 Issue + 改动文件列表

---

## 常见任务（指向规则文件）

| 任务 | 看哪份规则？ |
|------|----------|
| 新增 CRUD 实体 | architecture.md §三.1 文件组织 + §三.2 路由层规则 |
| 新增 Agent 工具 | architecture.md §1.2.1 双工具系统 + ADR-021 |
| 修改架构 | architecture.md + 提 ADR |
| 跨模块调用 | architecture.md §2.1 领域间通信规则 |
| 写测试 | testing.md §二/§三 |

---

## 关联文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 架构完整规则 | [.trae/rules/architecture.md](../rules/architecture.md) | 4A + DDD + 编码约束（AI 必读） |
| 顶层规则 | [.trae/rules/top-rules.md](../rules/top-rules.md) | 强制报告 + 开发方式 |
| 前端规范 | [.trae/rules/frontend.md](../rules/frontend.md) | 23 模块前端编码 |
| 测试规范 | [.trae/rules/testing.md](../rules/testing.md) | 后端 + 前端测试 |
| 错误复盘流程 | [.trae/rules/lessons-learned.md](../rules/lessons-learned.md) | L1/L2/L3 错误沉淀 |
| ADR 决策记录 | [../adr/README.md](../adr/README.md) | 26 份架构决策 |
| 技术架构设计意图 | [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) | 决策背景 |

---
