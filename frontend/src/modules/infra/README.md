# 基础设施模块（前端）

## 页面
- `Settings.tsx` — 系统设置（模型配置 + 知识库 + 安全设置 + 通用设置）
- `Scripts.tsx` — 脚本管理
- `AuditLogs.tsx` — 审计日志
- `ToolLinks.tsx` — 工具链接
- `ToolLinksManage.tsx` — 工具链接管理
- `Tools.tsx` — 工具箱

## 组件
- `AddDeviceModal.tsx` — 添加设备弹窗
- `ImportExport.tsx` — 导入导出

## 对应后端
`backend/src/modules/infra/`

## 说明
通知（Notifications/NotificationSettings）、审批（Approvals）、配置模板（ConfigTemplates）、
备份（BackupSettings）已拆分为独立模块：
- `notification/` — 通知记录 + 通知渠道配置
- `change-management/` — 审批管理
- `config-management/` — 配置模板
- `backup/` — 备份管理
