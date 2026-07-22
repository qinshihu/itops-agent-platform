# Audit 模块（前端）

> **DDD 限界上下文**：审计日志查询
> **对应后端**：[`backend/src/modules/audit/`](../../../backend/src/modules/audit/README.md)
> **创建时间**：2026-07-08 增量-12（从原 frontend `infra/` 抽离，对齐 backend P1-6）
>
> **最后刷新**：2026-07-22

---

## 一、职责

- 审计日志查询 UI：分页列表、操作筛选、详情查看、统计卡片
- 调用后端 `/audit` + `/audit/stats/summary` 端点

## 二、内部结构

```
audit/
├── api.ts              # auditApi + AuditLog 类型
├── index.ts            # barrel export
├── routes.ts           # /audit 路由
├── pages/
│   └── AuditLogs.tsx   # 主页面
└── README.md           # 本文档
```

## 三、依赖关系

- **依赖**：`@/lib/api`（统一 axios 实例）、`@tanstack/react-query`、`lucide-react`、`clsx`
- **被依赖**：`_routes.tsx` 聚合、本模块独立

## 四、迁移记录

- 原文件：`frontend/src/modules/infra/pages/AuditLogs.tsx`（267 行）
- 现文件：`frontend/src/modules/audit/pages/AuditLogs.tsx`（270 行）
- 变更：直接 `api.get('/audit')` → 改走 `auditApi.listAuditLogs()`；移除内嵌 `AuditLog` 接口，改 import 本模块 api 的类型
- HTTP 路径完全保持兼容（`/audit` + `/audit/stats/summary`），路由 path 完全保持兼容（`audit`）
- **前端零行为变更**，仅为目录重组 + API 调用规范化

## 五、相关

- backend 模块：[`.trae/adr/017-infra-subdomain-splitting.md`](../../../.trae/adr/017-infra-subdomain-splitting.md)（audit 是 P1-6 抽离出的 6 个模块之一）
- frontend 拆分：[`项目全面分析报告_v4.md` §6.11 + §10.3](../../../docs/项目全面分析报告_v4.md)
