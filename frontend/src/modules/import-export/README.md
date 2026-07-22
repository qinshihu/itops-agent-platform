# Import-export 模块（前端）

> **DDD 限界上下文**：数据导入导出（跨业务通用工具）
> **对应后端**：[`backend/src/modules/import-export/`](../../../backend/src/modules/import-export/README.md)
> **创建时间**：2026-07-08 增量-12（从原 frontend `infra/components/ImportExport.tsx` 抽离，对齐 backend P1-6）
>
> **最后刷新**：2026-07-22

---

## 一、职责

- 提供通用 `<ImportExport>` 组件，被其他模块页面引用（servers/alerts/audit-logs/reports）
- 提供"导入导出"演示页 `/import-export-demo`
- 调用后端 `/import-export/{resource}/export` + `/import-export/{resource}/import` 端点

## 二、内部结构

```
import-export/
├── api.ts                       # importExportApi + 类型 + resourceLabels
├── index.ts                     # barrel export
├── routes.ts                    # /import-export-demo 路由
├── components/
│   └── ImportExport.tsx         # 通用组件（被其他模块复用）
├── pages/
│   └── ImportExportDemo.tsx     # 演示页
└── README.md
```

## 三、依赖关系

- **依赖**：`@/lib/api`、`@/contexts/ToastContext`、`@/lib/errorHandler`、`lucide-react`
- **被依赖**：其他模块（servers/alerts/audit/backup）通过 `importExportApi` 或 `<ImportExport>` 组件引用

## 四、迁移记录

- 原文件位置：`frontend/src/modules/infra/components/ImportExport.tsx`（210 行）
- 现文件位置：`frontend/src/modules/import-export/components/ImportExport.tsx`（160 行）
- 变更：
  1. 直接 `api.get('/api/import-export/...')` → 改走 `importExportApi.exportResource()` + `downloadFile()` 辅助方法
  2. `resourceType` 类型从 string 收窄到 `'servers' | 'alerts' | 'audit-logs' | 'reports'` 字面量联合
  3. `ImportResult` 类型从局部移到 api.ts
- HTTP 路径完全保持兼容（`/import-export/{type}/export` + `/import-export/{type}/import`），路由 path 新增 `import-export-demo`
- **前端零行为变更**，仅为目录重组 + API 调用规范化

## 五、相关

- backend 模块：[`.trae/adr/017-infra-subdomain-splitting.md`](../../../.trae/adr/017-infra-subdomain-splitting.md)
- frontend 拆分：[`项目全面分析报告_v4.md` §6.11 + §10.3](../../../docs/项目全面分析报告_v4.md)
