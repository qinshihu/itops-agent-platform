# 共享层 (`shared/`)

## 结构
```
shared/
├── components/   ← ErrorBoundary, ProtectedRoute, MarkdownOutput
├── layouts/      ← Layout（主布局）
└── pages/        ← NotFound, FrontendTests
```

## 职责
跨模块共享的基础组件和工具：错误边界、路由守卫、Markdown 渲染、主布局、通用页面。

## 备注
- `shared/config/` 和 `shared/hooks/` 已清理（暂无通用内容）
- 如出现跨模块复用的 hooks 或配置，应放在此处而非重复在各模块中
