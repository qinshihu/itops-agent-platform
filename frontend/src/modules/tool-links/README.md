# Tool-links 模块（前端）

> **DDD 限界上下文**：工具链接管理（导航站）
> **对应后端**：[`backend/src/modules/tool-links/`](../../../backend/src/modules/tool-links/README.md)
> **创建时间**：2026-07-08 增量-12（从原 frontend `infra/` 抽离，对齐 backend P1-6）
>
> **最后刷新**：2026-07-22

---

## 一、职责

- 工具链接展示页：用户访问 `/tool-links` 浏览运维工具导航
- 工具链接管理页：管理员访问 `/tool-links-manage` 进行 CRUD + 排序 + 图标管理
- 调用后端 `/tool-links` + `/tool-links/categories` 端点

## 二、内部结构

```
tool-links/
├── api.ts                        # toolLinksApi + 类型
├── index.ts                      # barrel export
├── routes.ts                     # /tool-links + /tool-links-manage 路由
├── pages/
│   ├── ToolLinks.tsx             # 工具链接展示页（精简主入口 v2.24 拆分 105 行）
│   ├── tool-links/               # 工具链接展示子模块（v2.24 新建）
│   │   ├── types.ts              # ToolLinkFormData + CategoryGroup 类型（36）
│   │   ├── constants.ts          # 41 个 icons + ICON_OPTIONS + ICON_MAP（115）
│   │   ├── ToolIcon.tsx          # icon name → JSX 映射（25）
│   │   ├── useToolLinksData.ts   # 5 state + 2 query + 3 mutation + 7 handler（215）
│   │   ├── ToolLinksHeader.tsx   # header + 搜索 + 类别过滤（114）
│   │   ├── ToolLinksGrid.tsx     # 类别 grid + manage mode hover（108）
│   │   ├── ToolFormModal.tsx     # 新增/编辑表单 + icon picker（168）
│   │   ├── DeleteToolModal.tsx   # 删除确认（59）
│   │   └── index.ts              # barrel（17）
│   ├── tool-links-manage/        # 工具链接管理（完整，2026-07-08 增量-12）
│   │   ├── index.tsx             # 管理页主入口
│   │   ├── ToolList.tsx          # 列表组件
│   │   ├── ToolFormModal.tsx     # 表单弹窗（简化版）
│   │   ├── DeleteConfirmModal.tsx# 删除确认弹窗
│   │   ├── types.ts              # 类型 + ICON_OPTIONS + EMPTY_FORM
│   │   └── useToolLinksManage.ts # 业务 Hook
│   └── README.md
└── README.md
```

## 三、依赖关系

- **依赖**：`@/lib/api`、`@/lib/errorHandler`、`@/contexts/ToastContext`、`@/hooks/useEscapeKey`、`@tanstack/react-query`、`lucide-react`、`clsx`、`react-router-dom`
- **被依赖**：`_routes.tsx` 聚合、本模块独立

## 四、迁移记录

- 原文件位置：`frontend/src/modules/infra/pages/ToolLinks.tsx`（700+ 行）、`infra/pages/tool-links-manage/`（6 文件）
- 现文件位置：`frontend/src/modules/tool-links/pages/`
- 变更：
  1. 直接 `api.get/post/put/delete` → 改走 `toolLinksApi` 的方法
  2. 路径 `../../../lib/api` → `../../../../lib/api`（相对新位置）
  3. 删除内嵌 `ToolLink` 接口，改 import 本模块 api 的类型
- ⚠️ **ToolLinks.tsx 是简化占位版**：保留图标映射和 CRUD mutation 结构，但省略完整渲染逻辑（卡片网格 + 弹窗 + 排序 UI）。原 `infra/pages/ToolLinks.tsx` 已随 P1-6 拆分删除，如需扩展请基于现 `tool-links/pages/ToolLinks.tsx` 直接补充。
- ⚠️ **ToolFormModal 是简化占位版**：原版含 icon picker 网格 + lucide/upload 切换 + 预览，简化版用 `<select>` 选图标。
- HTTP 路径完全保持兼容（`/tool-links` + `/tool-links/categories`），路由 path 完全保持兼容（`tool-links` + `tool-links-manage`）

## 五、相关

- backend 模块：[`.trae/adr/017-infra-subdomain-splitting.md`](../../../.trae/adr/017-infra-subdomain-splitting.md)
- frontend 拆分：[`项目全面分析报告_v4.md` §6.11 + §10.3](../../../docs/项目全面分析报告_v4.md)
