# ADR-007: 前后端模块 1:1 映射约定

**状态**: 已采纳 | **日期**: 2025-Q1 | **决策者**: 项目作者

## 背景

AI 辅助开发中最常见的问题是前后端字段不匹配、API 路径不一致、同一概念在前端和后端叫法不同。这导致 AI 生成的前端代码可能调用了不存在的后端接口，或传了错误格式的数据。

核心需求：
1. 前后端模块结构一一对应，降低认知负担
2. API 契约显性化，字段名自动对齐
3. AI 能根据模块名快速定位前/后端代码

## 决策

前后端模块采用 **1:1 映射**：

```
backend/src/modules/alerts/    ↔  frontend/src/modules/alerts/
backend/src/modules/servers/   ↔  frontend/src/modules/servers/
backend/src/modules/workflow/  ↔  frontend/src/modules/workflow/
...
```

## 设计要点

### 目录结构对齐

```
后端                                      前端
modules/alerts/                          modules/alerts/
├── routes.ts         ← API 定义          ├── routes.ts        ← 路由配置
├── routes/                               ├── pages/           ← 页面组件
│   ├── alertRoutes.ts                    │   ├── AlertList.tsx
│   └── alertMappingRoutes.ts             │   └── AlertDetail.tsx
├── services/                             ├── components/      ← UI 组件
│   ├── alertService.ts                   │   └── AlertTable.tsx
│   └── alertCorrelationService.ts        ├── api.ts           ← API 调用
└── README.md                             └── README.md
```

### API 契约通过 Zod 统一

后端定义 Zod schema → 前端 TypeScript 类型推导 → 字段自动对齐：

```typescript
// 后端 shared/schemas/apiValidation.ts
export const createAlertSchema = z.object({
  name: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']),
  serverId: z.string().uuid(),
});

// 前端可直接推断类型（或通过 openapi-typescript 自动生成）
type CreateAlertInput = z.infer<typeof createAlertSchema>;
```

### 跨模块引用规则

前端模块禁止直接 import 对方模块的页面组件：
```
✅ import { ErrorDisplay } from '../../shared/components/ErrorDisplay';
❌ import { AlertTable } from '../../alerts/components/AlertTable';
```

## 后果

### 正面
- AI 提需求时只需指定模块名，就能同时定位前后端代码
- 前后端统一命名（alert 不是 alarm，task 不是 job）
- 新人/社区贡献者能快速对应前后端文件
- CI 中 `dependency-cruiser` 校验前端跨模块 import

### 负面
- 某些共享类型需要在前后端各定义一份
- 如果前后端模块粒度不一致，需要额外调整

### 缓解措施
- Zod schema 作为前后端契约的唯一可信源
- 未来可引入 `openapi-typescript` 从后端路由自动生成前端 API 类型

## 相关

- ADR-005: 模块边界定义
- `.dependency-cruiser.json`: 前端跨模块依赖检查规则
