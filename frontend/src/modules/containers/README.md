# 容器与虚拟化模块（前端）

## 职责
容器与虚拟机管理：Docker 容器、镜像、网络、卷、Compose 编排、虚拟机全生命周期（VMware/Proxmox/KVM 三适配器）、快照策略、迁移、自动伸缩目标选择。

## 内部结构
```
containers/
├── routes.ts                             # 模块路由（懒加载）
├── api.ts                                # API 类型与调用封装
├── pages/
│   ├── Containers.tsx                    # 容器入口（re-export）
│   ├── containers/                       # 容器 + 镜像 + 卷 + 网络 + 端点 主区
│   │   ├── index.tsx                     # Tab 容器
│   │   ├── ContainersTab.tsx             # 容器列表 Tab
│   │   ├── NetworksTab.tsx               # 网络列表 Tab
│   │   ├── EndpointsTab.tsx              # 端点列表 Tab
│   │   ├── useContainerTab.ts            # 容器 Tab hook（拆分后）
│   │   ├── useNetworkTab.ts              # 网络 Tab hook
│   │   ├── useEndpointTab.ts             # 端点 Tab hook
│   │   └── useContainers.ts              # 聚合 hook（34 行）
│   ├── ContainerDetail.tsx               # 容器详情 Drawer
│   ├── ContainerLogs.tsx                 # 容器日志（WebSocket）
│   ├── ContainerMonitor.tsx              # 容器监控（WebSocket）
│   ├── Images.tsx                        # 镜像管理（/images + /images/pull + /images/sync）
│   ├── Volumes.tsx                       # 存储卷管理（/volumes → storage_volumes 表）
│   ├── VolumeSection.tsx                 # 卷操作区
│   ├── ImageSection.tsx                  # 镜像操作区
│   ├── ImageRegistry.tsx                 # 镜像仓库（/registries）
│   ├── ComposeEditor.tsx                 # Docker Compose 编辑
│   ├── SnapshotPolicies.tsx              # 快照策略
│   ├── VirtualMachines.tsx               # 虚拟机管理入口
│   ├── types.ts                          # 共享类型
│   └── virtual-machines/                 # 虚拟机子页面
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

## 关键路由

| 路径 | 后端 | 说明 |
|------|------|------|
| `/containers` | `/api/v1/containers/*` | Docker 容器/网络/端点管理 |
| `/container-monitor` | `/api/v1/docker-monitor/*` | 容器监控（实时 WebSocket 推送 `container:stats`） |
| `/container-logs` | `/api/v1/containers/:id/logs` + WebSocket `container:log:entry` | 容器日志流 |
| `/images` | `/api/v1/images/*` | 镜像管理（支持 endpointId 多主机） |
| `/volumes` | `/api/v1/volumes/*` | 存储卷（`storage_volumes` 表） |
| `/docker-volumes` | `/api/v1/docker-volumes/*` | Docker Volume（与 storage_volumes 是不同概念） |
| `/image-registry` | `/api/v1/registries/*` | 镜像仓库（密码已加密存储） |
| `/compose` | `/api/v1/compose/*` | Compose 编排 |
| `/virtual-machines` | `/api/v1/virtual-machines/*` | 虚拟机管理（VMware/Proxmox/KVM） |
| `/snapshot-policies` | `/api/v1/snapshot-policies/*` | 快照策略 |
| `/auto-scale` | `/api/v1/auto-scale/*` | 自动伸缩（页面在 `auto/` 模块） |

## 对应后端
`backend/src/modules/containers/` + `backend/src/modules/auto/`

## 刷新记录
- **2026-07-22**：核对 12 子路由表与子模块拆分（containers/virtual-machines）

## 已知限制
- `/docker/*` 后端路由已标记 `Deprecation: true`，应改用 `/containers/*`
- VMware 适配器 `verifyTls` 默认 `true`，自签证书平台需手动设 `config.verifyTls = false`
- K8s Deployment 伸缩需在 `autoScaleService` 中启用（已实现 `k8s_deployment` targetType）
