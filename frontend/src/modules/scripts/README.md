# Scripts 模块（前端）

> **DDD 限界上下文**：脚本管理（维护脚本 CRUD + 执行）
> **对应后端**：[`backend/src/modules/scripts/`](../../../backend/src/modules/scripts/README.md)
> **创建时间**：2026-07-08 增量-12（从原 frontend `infra/` 抽离，对齐 backend P1-6）
>
> **最后刷新**：2026-07-22

---

## 一、职责

- 脚本 CRUD UI：列表/分类筛选/创建/编辑/删除
- 脚本执行 UI：参数填写 + 执行结果展示（前端模拟，后端真实执行）
- 调用后端 `/scripts` + `/scripts/categories` 端点

## 二、内部结构

```
scripts/
├── api.ts                       # scriptsApi + Script 类型
├── index.ts                     # barrel export
├── routes.ts                    # /scripts 路由
├── pages/
│   └── Scripts.tsx              # 主页面（含 ScriptFormModal 内嵌组件）
└── README.md                    # 本文档
```

## 三、依赖关系

- **依赖**：`@/lib/api`（统一 axios 实例）、`@tanstack/react-query`、`lucide-react`、`date-fns`、`clsx`
- **被依赖**：`_routes.tsx` 聚合、本模块独立

## 四、迁移记录

- 原文件：`frontend/src/modules/infra/pages/Scripts.tsx`（308 行）
- 现文件：`frontend/src/modules/scripts/pages/Scripts.tsx`（473 行）
- 变更：
  1. 直接 `api.get('/scripts')` → 改走 `scriptsApi.listScripts()`
  2. 移除内嵌 `ScriptParameter` / `Script` 接口，改 import 本模块 api 的类型
  3. 删除/创建/更新操作改走 scriptsApi
- HTTP 路径完全保持兼容（`/scripts` + `/scripts/categories`），路由 path 完全保持兼容（`scripts`）
- **前端零行为变更**，仅为目录重组 + API 调用规范化

## 五、相关

- backend 模块：[`.trae/adr/017-infra-subdomain-splitting.md`](../../../.trae/adr/017-infra-subdomain-splitting.md)
- frontend 拆分：[`项目全面分析报告_v4.md` §6.11 + §10.3](../../../docs/项目全面分析报告_v4.md)
