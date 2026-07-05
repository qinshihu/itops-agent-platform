# 容器模块（前端）

## 职责
容器与虚拟机管理：Docker 容器、镜像、网络、卷、Compose 编排、虚拟机全生命周期。

## 内部结构
```
containers/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (793 行)
├── pages/
│   ├── Containers.tsx                    # 容器入口（2 行，re-export）
│   ├── containers/
│   │   ├── index.tsx                     # 容器主页面
│   │   ├── ContainersTab.tsx             # 容器列表 Tab
│   │   ├── NetworksTab.tsx               # 网络列表 Tab
│   │   ├── EndpointsTab.tsx              # 端点列表 Tab
│   │   └── useContainers.ts              # 容器数据 hook
│   ├── ContainerDetail.tsx               # 容器详情
│   ├── ContainerLogs.tsx                 # 容器日志
│   ├── ContainerMonitor.tsx              # 容器监控
│   ├── Images.tsx                        # 镜像管理
│   ├── Volumes.tsx                       # 卷管理
│   ├── VolumeSection.tsx                 # 卷操作区
│   ├── ImageSection.tsx                  # 镜像操作区
│   ├── ImageRegistry.tsx                 # 镜像仓库
│   ├── ComposeEditor.tsx                 # Docker Compose 编辑
│   ├── SnapshotPolicies.tsx              # 快照策略
│   ├── VmDetailPanel.tsx                 # 虚拟机详情面板
│   ├── VmCreateWizard.tsx                # 虚拟机创建向导
│   ├── VirtualMachines.tsx               # 虚拟机管理入口 (143 行)
│   ├── types.ts                          # 共享类型
│   └── virtual-machines/
│       ├── useVirtualMachines.ts         # 虚拟机数据 hook
│       ├── VMList.tsx                    # 虚拟机列表
│       ├── PlatformManagementModal.tsx   # 平台管理弹窗
│       ├── SnapshotsDrawer.tsx           # 快照抽屉
│       ├── VMFormModal.tsx               # 虚拟机表单弹窗
│       ├── VMStatsDrawer.tsx             # 统计抽屉
│       ├── CloneVMModal.tsx              # 克隆弹窗
│       ├── VMToolbar.tsx                 # 工具栏
│       ├── VMStatsCards.tsx              # 统计卡片
│       ├── VMPlatformSelector.tsx        # 平台选择器
│       ├── DeleteVMConfirm.tsx           # 删除确认
│       ├── vmDisplay.tsx                 # 显示工具
│       └── types.ts                      # 子模块类型
└── index.ts
```

## 对应后端
`backend/src/modules/containers/`