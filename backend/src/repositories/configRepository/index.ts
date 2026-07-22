/**
 * configRepository — config-management 模块的数据访问聚合入口
 *
 * 组合 composes_projects、network_config_backups、config_repair_records 三个子仓库。
 */

import { composeProjectsRepo } from './composeProjectsRepo';
export { composeProjectsRepo };
export type { ComposeProjectRecord, ComposeProjectCreateInput, ComposeProjectUpdateInput } from './composeProjectsRepo';

import { networkConfigBackupsRepo } from './networkConfigBackupsRepo';
export { networkConfigBackupsRepo };
export type { NetworkConfigBackupRecord, NetworkConfigBackupWithDevice, NetworkConfigBackupCreateInput } from './networkConfigBackupsRepo';

import { configRepairRecordsRepo } from './configRepairRecordsRepo';
export { configRepairRecordsRepo };
export type { ConfigRepairRecord, ConfigRepairCreateInput, ConfigRepairListFilters } from './configRepairRecordsRepo';

export const configRepository = {
  composeProjects: composeProjectsRepo,
  networkConfigBackups: networkConfigBackupsRepo,
  configRepairRecords: configRepairRecordsRepo,
};