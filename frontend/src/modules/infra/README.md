# 基础设施模块（前端）

## 职责
系统级基础设施管理：当前仅保留 Agent 工具测试 UI（Tools 页面）。

> **历史演变**：原 infra/ 模块在 backend P1-6 拆分后，frontend 同步拆分为 5 个新模块（2026-07-08 增量-12）：
> - `audit/` — 审计日志
> - `settings/` — 系统设置
> - `scripts/` — 脚本管理
> - `tool-links/` — 工具链接
> - `import-export/` — 导入导出
>
> 此外以下功能已拆分为独立模块：
> - `notification/` — 通知记录 + 通知渠道配置
> - `change-management/` — 审批管理
> - `config-management/` — 配置模板
> - `backup/` — 备份管理

## 内部结构
```
infra/
├── routes.ts                             # 模块路由（仅注册 /tools）
├── pages/
│   └── Tools.tsx                         # Agent 工具测试 UI（直接调用 @/lib/api）
├── components/
│   └── AddDeviceModal.tsx                # 添加设备弹窗（v2.30 拆分后精简主入口 102 行）（被 network/ 模块复用）
│       └── add-device-modal/             # 子模块（v2.30 新建）
│           ├── types.ts                          # 5 interface + createDefaultFormData（101）
│           ├── constants.ts                      # vendors + roles + tabs + TAB_ICONS（35）
│           ├── useAddDeviceModal.ts              # 5 state + 1 effect + 2 query + 3 handler（257）
│           ├── BasicInfoSection.tsx              # 名称 / IP / 厂商 / 角色 / 位置（91）
│           ├── SshConfigSection.tsx              # SSH 凭证 + user/pass/enable（157）
│           ├── SnmpConfigSection.tsx             # SNMP 凭证 + port + 测试（102）
│           ├── TestResultBanner.tsx              # 成功/失败反馈 banner（32）
│           ├── DeviceTabBar.tsx                  # SSH/SNMP tab 切换（44）
│           ├── ModalFooter.tsx                   # SSH 测试 / 取消 / 确认（67）
│           └── index.ts                          # barrel（23）
└── index.ts                              # 仅导出 infraRoutes
```

## API 调用说明
本模块**已无独立 `api.ts` 文件**（2026-07-19 清理死代码，原 491 行 `infraApi` 对象已全部迁移到对应独立模块或无人使用）：
- `pages/Tools.tsx` 直接 `import api from '@/lib/api'`
- `components/AddDeviceModal.tsx` 直接 `import api from '@/lib/api'`

## 对应后端
`backend/src/modules/infra/`（P1-6 后仅保留 `restartService.ts`）

## 刷新记录
- **2026-07-22**：核对 Tools.tsx / AddDeviceModal 当前结构（已无独立 api.ts）
