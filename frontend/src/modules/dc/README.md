# 数据中心模块（前端）

## 职责
数据中心基础设施管理：3D 机房可视化、机柜管理、设备管理、PDU 管理、Netbox 集成。

## 内部结构
```
dc/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (481 行)
├── pages/
│   ├── DataRoom.tsx                      # 3D 机房入口
│   └── DataCenterManage/
│       ├── index.tsx                     # 数据中心管理主页
│       ├── useDataCenter.ts              # 数据中心数据 hook (631 行)
│       ├── types.ts                      # 共享类型
│       ├── OverviewTab.tsx               # 概览 Tab
│       ├── RoomManagement.tsx            # 机房管理
│       ├── RackManagement.tsx            # 机柜管理
│       ├── SlotsPanel.tsx                # 槽位面板
│       ├── SlotModals.tsx                # 槽位弹窗
│       ├── DevicesTab.tsx                # 设备 Tab
│       ├── PDUManagement.tsx             # PDU 管理
│       ├── NetboxTabs.tsx                # Netbox 集成 Tab
│       ├── LifecycleTab.tsx              # 生命周期 Tab
│       └── ExportImportTab.tsx           # 导入导出 Tab
└── components/
    └── DataRoom3D/
        ├── index.tsx                     # 3D 场景入口
        ├── Scene.tsx                     # Three.js 场景 (412 行)
        ├── useDataRoom.ts                # 3D 数据 hook
        ├── types.ts                      # 3D 子模块类型
        ├── DashboardOverlay.tsx          # 仪表盘覆盖层
        ├── SlotDetailPanel.tsx           # 槽位详情面板
        ├── AlertPanel.tsx                # 告警面板
        ├── BottomStatsBar.tsx            # 底部统计栏
        └── LoadingScreen.tsx             # 加载屏幕
```

## 对应后端
`backend/src/modules/dc/`

## 刷新记录
- **2026-07-22**：核对 13 Tab + DataRoom3D 子模块