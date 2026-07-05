# 基础设施模块（前端）

## 职责
系统级基础设施管理：系统设置、脚本管理、审计日志、工具链接、工具箱、导入导出。

## 内部结构
```
infra/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (491 行)
├── pages/
│   ├── Settings.tsx                      # 系统设置 (693 行)
│   │   └── settings/
│   │       ├── GeneralSettings.tsx       # 通用设置
│   │       ├── SecuritySettings.tsx      # 安全设置
│   │       └── ModelSettings.tsx         # 模型设置
│   ├── Scripts.tsx                       # 脚本管理
│   ├── AuditLogs.tsx                     # 审计日志
│   ├── ToolLinks.tsx                     # 工具链接
│   ├── ToolLinksManage.tsx               # 工具链接管理
│   └── Tools.tsx                         # 工具箱
├── components/
│   ├── AddDeviceModal.tsx                # 添加设备弹窗
│   └── ImportExport.tsx                  # 导入导出
└── index.ts
```

## 对应后端
`backend/src/modules/infra/`

## 说明
以下功能已拆分为独立模块：
- `notification/` — 通知记录 + 通知渠道配置
- `change-management/` — 审批管理
- `config-management/` — 配置模板
- `backup/` — 备份管理