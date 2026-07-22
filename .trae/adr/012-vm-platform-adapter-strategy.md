# ADR-012: 虚拟机平台适配器策略

**日期**: 2026-07-04
**状态**: Accepted
**架构层**: 应用架构层

---

## 背景

IT 运维平台需要管理多种虚拟机平台。实际生产环境中常见：
- **KVM** — Linux 原生虚拟化，libvirt 管理
- **Proxmox VE** — 基于 KVM 的开源虚拟化管理平台
- **VMware vSphere** — 企业级虚拟化市场领导者

需要设计一套统一的 VM 管理抽象层，屏蔽底层平台差异。

---

## 决策

### 策略模式：统一接口 + 平台适配器

每个平台实现 `VmAdapter` 接口，上层通过 `vmAdapter` 统一调用：

```typescript
interface VmAdapter {
  platform: 'kvm' | 'proxmox' | 'vmware';
  
  // 生命周期
  create(config: VmCreateConfig): Promise<VmInfo>;
  start(vmId: string): Promise<void>;
  stop(vmId: string): Promise<void>;
  restart(vmId: string): Promise<void>;
  forceStop(vmId: string): Promise<void>;
  delete(vmId: string): Promise<void>;
  
  // 查询
  getInfo(vmId: string): Promise<VmInfo>;
  list(): Promise<VmInfo[]>;
  getStatus(vmId: string): Promise<VmStatus>;
  
  // 快照
  createSnapshot(vmId: string, name: string, memory?: boolean): Promise<SnapshotInfo>;
  listSnapshots(vmId: string): Promise<SnapshotInfo[]>;
  restoreSnapshot(vmId: string, snapshotId: string): Promise<void>;
  deleteSnapshot(vmId: string, snapshotId: string): Promise<void>;
  
  // 迁移
  migrate(vmId: string, targetHost: string, live?: boolean): Promise<void>;
}

interface VmCreateConfig {
  name: string;
  cpu: number;
  memory: number;        // MB
  disk: number;          // GB
  networks: Array<{
    bridge: string;
    model: string;
  }>;
  isoPath?: string;
  osType?: string;
}
```

### 三个适配器

| 适配器 | 通信方式 | 路径 |
|--------|---------|------|
| KVM Adapter | SSH → libvirt virsh 命令 | `containers/services/vmManagement/kvmAdapter/` |
| Proxmox Adapter | Proxmox VE REST API | `containers/services/vmManagement/proxmoxAdapter/` |
| VMware Adapter | vSphere Web Services API | `containers/services/vmManagement/vmwareAdapter.ts` |

### 平台配置管理

```typescript
// 平台配置存储在数据库中（vm_platforms 表）
interface PlatformConfig {
  id: string;
  type: 'kvm' | 'proxmox' | 'vmware';
  name: string;
  host: string;
  port: number;
  auth: {
    username: string;
    password?: string;        // 加密存储
    sshKey?: string;          // KVM SSH 密钥
    token?: string;           // Proxmox API Token
  };
  enabled: boolean;
}
```

### 快照策略调度

`vmSnapshotSchedulerService` 提供定时快照策略：
- Cron 表达式调度
- 内存快照选项（包含运行状态）
- 保留策略（最多保留 N 个）
- 快照创建/过期/清理自动化

---

## 替代方案评估

### 每平台独立模块
- ~~代码重复~~：每个平台独立实现在 route/service 层导致 3x 代码量

### Terraform / OpenTofu
- ~~不适合运维场景~~：Terraform 面向 IaC 声明式管理，不是运维平台的操作式管理
- ~~状态文件管理~~：额外状态维护成本

### 仅支持单一平台
- ~~不满足需求~~：实际用户环境混合使用多种虚拟化平台

---

## 后果

### 正面
- 新增平台只需实现 `VmAdapter` 接口，不影响现有代码
- 前端统一 `VmCreateWizard` / `VmDetailPanel` 组件，对用户屏蔽平台差异
- KVM 适配器通过 SSH 管理，无需额外 daemon，降低运维成本
- 快照策略引擎与平台解耦，所有平台共享同一调度逻辑

### 负面
- 适配器接口可能因平台特性过少/过多
- VMware 适配器需要额外的 vSphere SDK 依赖
- 不同平台对快照支持程度不一（如 KVM 默认不支持内存快照）

### 缓解措施
- `VmAdapter` 接口仅定义最小公分母操作，平台特有功能通过 `capabilities` 字段声明
- 前端根据 `capabilities` 动态显示/隐藏功能按钮
- 快照策略中的 `snapshotMemory` 字段在创建策略时校验平台是否支持
