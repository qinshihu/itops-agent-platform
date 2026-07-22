/**
 * containersRepository — 容器与虚拟机相关子仓库聚合导出
 *
 * 包含以下子仓库：
 *   - vmMigrationRepository       (vm_migrations)
 *   - vmSnapshotPolicyRepository   (vm_snapshot_policies)
 *   - vmPlatformRepository         (vm_platforms)
 *   - vmAuditLogRepository         (vm_audit_logs)
 *   - imageRegistryRepository      (image_registries)
 *   - dockerEndpointRepository     (docker_endpoints)
 *   - storageVolumeRepository      (storage_volumes)
 */

export { vmMigrationRepository } from './vmMigrationRepository';
export type { VmMigrationRecord, VmMigrationCreateInput, VmMigrationListFilters } from './vmMigrationRepository';

export { vmSnapshotPolicyRepository } from './vmSnapshotPolicyRepository';
export type { VmSnapshotPolicyRecord, VmSnapshotPolicyCreateInput } from './vmSnapshotPolicyRepository';

export { vmPlatformRepository } from './vmPlatformRepository';
export type { VmPlatformRecord, VmPlatformCreateInput } from './vmPlatformRepository';

export { vmAuditLogRepository } from './vmAuditLogRepository';
export type { VmAuditLogRecord, VmAuditLogCreateInput, VmAuditLogListFilters } from './vmAuditLogRepository';

export { imageRegistryRepository } from './imageRegistryRepository';
export type { ImageRegistryRecord, ImageRegistryCreateInput } from './imageRegistryRepository';

export { dockerEndpointRepository } from './dockerEndpointRepository';
export type { DockerEndpointRecord, DockerEndpointCreateInput } from './dockerEndpointRepository';

export { storageVolumeRepository } from './storageVolumeRepository';
export type { StorageVolumeRecord, StorageVolumeInput, StorageVolumeListFilters } from './storageVolumeRepository';