/**
 * vmManagementService 类型 barrel（2026-07-21 拆分）
 *
 * 把主类使用到的外部类型重导出，便于子模块统一管理
 * 拆分原则遵循 architecture.md §3.3.1 第 3 条「向后兼容的 import 路径」
 */
export type {
  VirtualMachine,
  VMStats,
  VMSnapshot,
  VMTemplate,
  HypervisorHost,
  Datastore,
  VirtualNetwork,
  VMPlatformConfig,
  CreateVMRequest,
  CloneVMRequest,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
  HypervisorType,
} from '../../../../../types/vmManagement';
export type { VMAdapter } from '../vmAdapter';
