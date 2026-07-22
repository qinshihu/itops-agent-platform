# ADR-004: Repository 模式与数据访问层

**状态**: 已采纳 | **日期**: 2025-Q2 | **决策者**: 项目作者

## 背景

项目初期，业务代码直接调用 `models/database.ts` 执行 SQL，导致：

1. SQL 散落各处，无法统一管理
2. 测试时需要 mock SQLite，复杂且慢
3. 业务逻辑和数据访问耦合，修改数据库结构影响面大

核心需求：

1. 统一的数据库访问抽象
2. 测试友好（可 mock）
3. 业务代码与 SQL 解耦
4. 渐进式迁移（老代码逐步迁移，新代码强制走 repository）

## 决策

采用 **Repository 模式**，所有数据访问通过 `repositories/` 完成。

## 设计要点

### 分层结构

```
业务代码 (services/routes)  →  repositories/  →  models/database/index.ts (SQLite)
           ↑ 只调 repository                      ↑ 禁止直接调用
```

### Barrel Export 统一出口

```typescript
// repositories/index.ts 统一导出，业务代码一行 import 即可
import {
  serverRepository,
  alertRepository,
  workflowRepository,
} from "../../repositories";
```

### 子仓储聚合

大型表的 repository 拆分为子仓库：

```
repositories/alertRepository/
├── index.ts          ← 聚合导出（barrel）
├── coreAlerts.ts     ← 告警基础 CRUD
├── correlations.ts   ← 告警关联
├── noiseReduction.ts ← 降噪
├── autoAnalysis.ts   ← 自动分析
└── ...
```

### 类型安全

每个 repository 定义完整的 TypeScript 类型：

```typescript
interface ServerRecord { id, name, hostname, ... }
interface ServerCreateInput { name, hostname, ... }
interface ServerFilters { groupId?, status?, search? }
```

### 测试 Mock

```typescript
container.replace("serverRepository", {
  getById: vi.fn().mockReturnValue({ id: "1", name: "test" }),
  list: vi.fn().mockReturnValue([]),
});
```

## 后果

### 正面

- 业务代码不再直接写 SQL，可读性大幅提升
- 测试时只需 mock repository 对象，测试速度提升
- 数据库结构变更只需修改 repository 内部，不影响业务代码
- 通过 barrel export 统一引用，无需在多个文件中重复 import 路径

### 负面

- 简单查询也需要经过 repository，增加了一个间接层
- 子仓储拆分带来文件数量增加（alertRepository 有 14 个文件）
- 需要维护 repository 的 TypeScript 类型定义

## 约束

- **禁止**业务代码直接调用 `models/database/index.ts`
- Repository 纯数据访问，**禁止**包含业务判断逻辑
- 新增表必须先写 migration，再创建 repository

## 相关

- ADR-002: SQLite 数据库选择
