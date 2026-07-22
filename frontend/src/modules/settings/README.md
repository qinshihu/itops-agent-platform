# Settings 模块（前端）

> **DDD 限界上下文**：系统设置 + AI 模型管理
> **对应后端**：[`backend/src/modules/settings/`](../../../backend/src/modules/settings/README.md)
> **创建时间**：2026-07-08 增量-12（从原 frontend `infra/` 抽离，对齐 backend P1-6）
>
> **最后刷新**：2026-07-22

---

## 一、职责

- 系统设置 UI：通用设置（GeneralSettings）、安全设置（SecuritySettings）
- AI 模型管理 UI：模型列表 / 表单弹窗（ModelSettings 子目录）
- QAnything 知识库配置 UI（QAnythingSettings 子目录）
- 调用后端 `/settings` 端点（settings 表 CRUD）

> **注**：与 settings 相关但归属其他模块的端点：
>
> - `/knowledge/qanything/*` → `ai/` 模块
> - `/notification-config` → `notification/` 模块
> - `/backups/*` → `backup/` 模块
> - `/ai-models` → `ai/` 模块的 `ai-models/` 子目录

## 二、内部结构

```
settings/
├── api.ts                                # settingsApi + Setting / SettingInput 类型
├── index.ts                              # barrel export: routes + api + 类型
├── routes.ts                             # /settings 路由（懒加载）
├── pages/
│   ├── Settings.tsx                      # 设置页主入口（Tabs 切换子页）
│   └── settings/
│       ├── GeneralSettings.tsx           # 通用设置
│       ├── ModelSettings.tsx             # AI 模型管理
│       ├── QAnythingSettings.tsx         # QAnything 知识库配置
│       └── SecuritySettings.tsx          # 安全设置
└── README.md                             # 本文档
```

## 三、依赖关系

- **依赖**：
  - `@/lib/api`（统一 axios 实例）
  - `@/contexts/ThemeContext`（主题切换，P1-6 已修复 useTheme 重复实现）
  - `antd`、`@ant-design/icons`、`lucide-react`、`tailwindcss`
- **被依赖**：
  - `modules/_routes.tsx` 聚合注册 `settingsRoutes`
  - `config/navigation.ts` 导航项 `/settings`

## 四、路由端点

| 路径        | 组件           | 说明                                    |
| ----------- | -------------- | --------------------------------------- |
| `/settings` | `Settings.tsx` | 设置页主入口（内部 Tabs 切换 4 个子页） |

## 五、迁移记录

- 原文件：`frontend/src/modules/infra/pages/Settings.tsx` 等（P1-6 前位于 infra/ 模块）
- 现文件：`frontend/src/modules/settings/`
- 变更：目录抽离为独立模块；API 调用规范化为 `settingsApi`
- HTTP 路径完全保持兼容（`/settings`）
- **前端零行为变更**，仅为目录重组

## 六、相关

- 后端模块：[`.trae/adr/017-infra-subdomain-splitting.md`](../../../.trae/adr/017-infra-subdomain-splitting.md)（settings 是 P1-6 抽离出的 6 个模块之一）
- 前端规范：[`.trae/rules/frontend.md`](../../../.trae/rules/frontend.md) §23 模块清单 #23
