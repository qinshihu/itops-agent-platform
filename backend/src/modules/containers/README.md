# 容器/虚拟机模块 (`containers/`)

> **DDD 限界上下文**：容器与虚拟机全生命周期
> **聚合根**：`Container`、`VirtualMachine`、`Image`、`VMSnapshot`、`VMMigration`
> **最后刷新**：2026-07-22

## 职责
容器和虚拟机全生命周期管理：Docker 多主机、KVM/Proxmox/VMware 三适配器、镜像仓库、卷管理、快照策略、VM 迁移。

## 内部结构（2026-07-22 实测：routes 实际挂 12 个子路径）
```
containers/
├── routes.ts                  # 模块路由聚合（12 个子路由）
├── routes/                    # 13 路由文件
│   ├── containerRoutes.ts          # /containers/*
│   ├── dockerRoutes.ts             # /docker/*         （Deprecation: true，建议改 /containers/*）
│   ├── dockerMonitorRoutes.ts      # /docker-monitor/* WebSocket container:stats
│   ├── dockerVolumeRoutes.ts       # /docker-volumes/* Docker Volume (≠ storage_volumes)
│   ├── imageRoutes.ts              # /images/*         镜像管理（支持 endpointId 多主机）
│   ├── volumeRoutes.ts             # /volumes/*        storage_volumes 表
│   ├── registryRoutes.ts           # /registries/*     镜像仓库
│   ├── virtualMachineRoutes.ts     # /virtual-machines/* VM CRUD
│   ├── vmManagementRoutes.ts       # /vm-management/*  平台 CRUD
│   ├── vmMigrationRoutes.ts        # /vm-migrations/*  VM 迁移
│   ├── snapshotPolicyRoutes.ts     # /snapshot-policies/* 快照策略
│   └── containerRoutes.ts          # （重复列出）服务内 containerLogService / MonitorService
├── services/                  # 41 服务文件（含 4 个测试文件）
│   ├── docker/                ← Docker 适配（已拆 5 子文件）
│   │   ├── containerOps.ts / imageOps.ts / networkOps.ts / volumeOps.ts
│   │   └── dockerService.ts
│   ├── vmManagement/
│   │   ├── kvmAdapter/        ← KVM 适配（**已按职责拆分**）
│   │   │   ├── index.ts                   (工厂 + barrel)
│   │   │   ├── sshClient.ts               (SSH 通道)
│   │   │   ├── mappers.ts + mappers.test.ts
│   │   │   ├── infrastructureOps.ts       (基础设施 CRUD)
│   │   │   ├── vmLifecycle.ts             (创建/删除/迁移)
│   │   │   ├── vmPower.ts                 (启动/停止/重启)
│   │   │   └── vmSnapshot.ts              (快照)
│   │   ├── proxmoxAdapter/    ← Proxmox VE 适配（**已按职责拆分**）
│   │   │   ├── index.ts                   (工厂 + barrel)
│   │   │   ├── apiClient.ts               (REST API 客户端)
│   │   │   ├── mappers.ts
│   │   │   ├── infrastructureOps.ts
│   │   │   ├── vmLifecycle.ts
│   │   │   ├── vmPower.ts
│   │   │   └── vmSnapshot.ts
│   │   ├── vmware/            ← VMware vCenter 适配（**已按职责拆分**）
│   │   │   ├── index.ts                   (工厂 + barrel)
│   │   │   ├── vmwareAdapter.ts           (vCenter 连接)
│   │   │   ├── vmCrud.ts / vmMigration.ts / vmMonitoring.ts / vmSnapshot.ts
│   │   ├── vmAdapter.ts                   (平台无关统一抽象)
│   │   ├── index.ts                       (VMManagementService 主类 - 1-line delegate)
│   │   └── vmManagementService/            (按职责拆 7 个子模块)
│   │       ├── types.ts                       (类型 barrel)
│   │       ├── lifecycle.ts                   (init + load + createAdapter + getAdapter)
│   │       ├── platformOps.ts                 (6 个平台 CRUD + testConnection)
│   │       ├── auditOps.ts                    (logAudit + getAuditLogs)
│   │       ├── vmOps.ts                       (8 个 VM CRUD + template)
│   │       ├── powerOps.ts                    (3 个电源操作)
│   │       ├── snapshotOps.ts                 (5 个快照 + migrateVM)
│   │       └── infraOps.ts                    (getVMStats + listHosts/Datastores/Networks)
│   ├── dockerService.ts / dockerEndpointCrudService.ts / multiHostDockerService.ts
│   ├── containerLogService.ts / containerMonitorService.ts
│   ├── registryService.ts / imageRegistryRepository
│   ├── storageVolumeCrudService.ts / virtualMachineCrudService.ts
│   ├── vmMigrationService.ts / vmSnapshotSchedulerService.ts
└── ...
```

## 路由端点（受保护）

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/containers/*` | `containerRoutes.ts` | Docker 容器/网络/端点管理 |
| `/docker/*` | `dockerRoutes.ts` | **Deprecation: true**（建议改 /containers/*） |
| `/docker-monitor/*` | `dockerMonitorRoutes.ts` | 容器实时监控（WebSocket `container:stats`） |
| `/docker-volumes/*` | `dockerVolumeRoutes.ts` | Docker Volume（与 storage_volumes 不同） |
| `/images/*` | `imageRoutes.ts` | 镜像管理（支持 endpointId 多主机） |
| `/volumes/*` | `volumeRoutes.ts` | 存储卷（storage_volumes 表） |
| `/registries/*` | `registryRoutes.ts` | 镜像仓库 |
| `/virtual-machines/*` | `virtualMachineRoutes.ts` | VM CRUD（VMware/Proxmox/KVM） |
| `/vm-management/*` | `vmManagementRoutes.ts` | 平台 CRUD + 审计 |
| `/vm-migrations/*` | `vmMigrationRoutes.ts` | VM 迁移 |
| `/snapshot-policies/*` | `snapshotPolicyRoutes.ts` | 快照策略 |

## 依赖关系
- 依赖 `servers/`（SSH 连接）、`network/`（部分网络操作）
- 被 `monitor/`（监控面板）、`workflow/`（修复流程）、`auto/`（自动伸缩）调用

## 关键说明
- **三平台适配器已全部按职责拆分**（v5 实测）：
  - KVM：`kvmAdapter/` 7 文件（基础设施/生命周期/电源/快照/映射/SSH 通道）
  - Proxmox：`proxmoxAdapter/` 7 文件（基础设施/生命周期/电源/快照/映射/REST 客户端）
  - VMware：`vmware/` 6 文件（CRUD/迁移/监控/快照/Adapter）
- 统一抽象层：`vmAdapter.ts` 提供平台无关的 VM 操作接口，运行时按平台分发
- 仓储聚合：`containersRepository/` 7 子仓储（dockerEndpoint/imageRegistry/storageVolume/vmMigration/vmSnapshotPolicy/vmPlatform/vmAuditLog）
- 多主机 Docker：通过 `multiHostDockerService` 跨多个 Docker Endpoint 统一管理