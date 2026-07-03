
/**
 * 数据库迁移注册中心
 * 
 * 版本号已规范化为连续序列 v001-v040
 * 迁移执行顺序与版本号一致
 */

import type { Migration } from './migrationFramework';
import { MigrationManager } from './migrationFramework';

// === 基础迁移 v001-v006 ===
import v001InitialSchema from './v001_initial_schema';
import v002AddApiProvider from './v002_add_api_provider';
import v003AddAIModelsTable from './v003_add_ai_models';
import v004AddAgentModelFields from './v004_add_agent_model_fields';
import v005SSHKeyPasswordSupport from './v005_ssh_key_password_support';
import v006NetworkDeviceCredentials from './v006_network_device_credentials';

// === 凭证与用户 v007-v008 ===
import v007CredentialsTable from './v007_credentials_table';
import v008FixUsersIdType from './v008_fix_users_id_type';

// === 网络覆盖 v009-v010 ===
import { up as v009Up, down as v009Down } from './v009_network_complete_coverage';
import { up as v010Up, down as v010Down } from './v010_snmp_channel';

// === 时区与发现 v012-v015 ===
import v012TimezoneMigration from './v012_timezone_migration';
import v013NetworkDiscovery from './v013_network_discovery';
import v014AlertCorrelation from './v014_alert_correlation';
import v015NotificationColumns from './v015_notification_columns';

// === 数据库与审批 v016-v018 ===
import v016DatabasesTable from './v016_databases_table';
import v017ApprovalRequests from './v017_approval_requests';
import v018AlertAutoResponse from './v018_alert_auto_response';

// === 工作流与审批 v019-v020 ===
import v019WorkflowEngineEnhancement from './v019_workflow_engine_enhancement';
import v020DatabasesTable from './v020_databases_table';

// === 配置与容器 v022-v027 ===
import v022ConfigTemplates from './v022_config_templates';
import v023VirtualMachines from './v023_virtual_machines';
import v024Containers from './v024_containers';
import v025ContainerImages from './v025_container_images';
import v026Volumes from './v026_volumes';
import v027AiRemediations from './v027_ai_remediations';

// === 数据中心 v028-v030 ===
import v028DcInfrastructure from './v028_dc_infrastructure';
import v029DcLifecycle from './v029_dc_lifecycle';
import v030DcRoomMonitor from './v030_dc_room_monitor';

// === 网络子网 v031 ===
import v031NetworkSubnets from './v031_network_subnets';

// === DCIM 增强 v032-v037 ===
import { up as v032Up, down as v032Down } from './v032_device_manufacturers';
import { up as v033Up, down as v033Down } from './v033_device_types';
import { up as v034Up, down as v034Down } from './v034_device_type_slot_definitions';
import { up as v035Up, down as v035Down } from './v035_dc_power_panels';
import { up as v036Up, down as v036Down } from './v036_dc_power_feeds';
import { up as v037Up, down as v037Down } from './v037_dc_cables';

// === 工具链接 v038-v039 ===
import v038ToolLinks from './v038_tool_links';
import v039ToolLinkImage from './v039_tool_link_image';

// === 告警 Provider 配置 v040 ===
import v040AlertProviderConfigs from './v040_alert_provider_configs';

// === DC 机房能效 v041 ===
import v041DcRoomEnergy from './v041_dc_room_energy';

// === ensureTables 下沉 v042-v050（阶段3：service 表结构下沉到 migration）===
import v042BaselineMetrics from './v042_baseline_metrics';
import v043AlertProcessingRecords from './v043_alert_processing_records';
import v044ComposeProjects from './v044_compose_projects';
import v045ImageRegistries from './v045_image_registries';
import v046DockerEndpoints from './v046_docker_endpoints';
import v047K8sContexts from './v047_k8s_contexts';
import v048AutoScaleTables from './v048_auto_scale_tables';
import v049VmMigrations from './v049_vm_migrations';
import v050VmSnapshotPolicies from './v050_vm_snapshot_policies';

// === ensureTable 残留清理 v051-v054（阶段3 补遗）===
import v051AiRemediationsColumns from './v051_ai_remediations_columns';
import v052KnowledgeBase from './v052_knowledge_base';
import v053EscalationHistory from './v053_escalation_history';
import v054AlertAutoAnalysis from './v054_alert_auto_analysis';

// === 运行时建表残留清理 v055 ===
import v055VmManagementTables from './v055_vm_management_tables';

// Helper: wrap sync up/down into async
function wrapAsync(fn: (db: any) => void): (db: any) => Promise<void> {
  return async (db: any) => { fn(db); };
}

// v009-v010: 导出的不是 Migration 对象，手动包裹
const v009NetworkCompleteCoverage: Migration = {
  id: '20240101000009',
  version: 9,
  name: 'network_complete_coverage',
  description: 'Network devices complete coverage: config backup, LLDP, topology, alert associations',
  up: async (db: any) => { v009Up(db); },
  down: async (db: any) => { v009Down(db); },
};

const v010SnmpChannel: Migration = {
  id: '20240101000010',
  version: 10,
  name: 'snmp_channel',
  description: 'SNMP channel support: credentials, traps, polling, interface metrics',
  up: async (db: any) => { v010Up(db); },
  down: async (db: any) => { v010Down(db); },
};

// v032-v037: NetBox 借鉴的核心 DCIM 增强
const v032DeviceManufacturers: Migration = {
  id: '20250101000032',
  version: 32,
  name: 'device_manufacturers',
  description: 'Device manufacturers table (from NetBox dcim.Manufacturer)',
  up: wrapAsync(v032Up),
  down: wrapAsync(v032Down),
};

const v033DeviceTypes: Migration = {
  id: '20250101000033',
  version: 33,
  name: 'device_types',
  description: 'Device type templates table (from NetBox dcim.DeviceType)',
  up: wrapAsync(v033Up),
  down: wrapAsync(v033Down),
};

const v034DeviceTypeSlotDefinitions: Migration = {
  id: '20250101000034',
  version: 34,
  name: 'device_type_slot_definitions',
  description: 'Device type slot/port templates (from NetBox dcim.ComponentTemplate)',
  up: wrapAsync(v034Up),
  down: wrapAsync(v034Down),
};

const v035DcPowerPanels: Migration = {
  id: '20250101000035',
  version: 35,
  name: 'dc_power_panels',
  description: 'Power distribution panels for DC (from NetBox dcim.PowerPanel)',
  up: wrapAsync(v035Up),
  down: wrapAsync(v035Down),
};

const v036DcPowerFeeds: Migration = {
  id: '20250101000036',
  version: 36,
  name: 'dc_power_feeds',
  description: 'Power feeds from panels to racks (from NetBox dcim.PowerFeed)',
  up: wrapAsync(v036Up),
  down: wrapAsync(v036Down),
};

const v037DcCables: Migration = {
  id: '20250101000037',
  version: 37,
  name: 'dc_cables',
  description: 'Simplified cable connections for topology visualization (from NetBox dcim.Cable)',
  up: wrapAsync(v037Up),
  down: wrapAsync(v037Down),
};

// 告警自动响应（原 v018）
const v018AlertAutoResponseMigration: Migration = {
  id: '20250101000018',
  version: 18,
  name: 'alert_auto_response',
  description: 'Alert auto response system',
  up: wrapAsync(v018AlertAutoResponse.up),
  down: wrapAsync(v018AlertAutoResponse.down),
};

// v038-v039: 工具链接
const v038ToolLinksMigration: Migration = {
  id: '20250101000038',
  version: 38,
  name: 'tool_links',
  description: 'Tool links table',
  up: wrapAsync(v038ToolLinks.up),
  down: wrapAsync(v038ToolLinks.down),
};

const v039ToolLinkImageMigration: Migration = {
  id: '20250101000039',
  version: 39,
  name: 'tool_link_image',
  description: 'Tool link image support',
  up: wrapAsync(v039ToolLinkImage.up),
  down: wrapAsync(v039ToolLinkImage.down),
};

// v022-v031: 需要包裹的迁移（这些文件导出 { up, down } 函数）
const v022ConfigTemplatesMigration: Migration = {
  id: '20250101000022', version: 22, name: 'config_templates',
  description: 'Config templates table',
  up: wrapAsync(v022ConfigTemplates.up), down: wrapAsync(v022ConfigTemplates.down),
};
const v023VirtualMachinesMigration: Migration = {
  id: '20250101000023', version: 23, name: 'virtual_machines',
  description: 'Virtual machines table',
  up: wrapAsync(v023VirtualMachines.up), down: wrapAsync(v023VirtualMachines.down),
};
const v024ContainersMigration: Migration = {
  id: '20250101000024', version: 24, name: 'containers',
  description: 'Containers table',
  up: wrapAsync(v024Containers.up), down: wrapAsync(v024Containers.down),
};
const v025ContainerImagesMigration: Migration = {
  id: '20250101000025', version: 25, name: 'container_images',
  description: 'Container images table',
  up: wrapAsync(v025ContainerImages.up), down: wrapAsync(v025ContainerImages.down),
};
const v026VolumesMigration: Migration = {
  id: '20250101000026', version: 26, name: 'volumes',
  description: 'Volumes table',
  up: wrapAsync(v026Volumes.up), down: wrapAsync(v026Volumes.down),
};
const v027AiRemediationsMigration: Migration = {
  id: '20250101000027', version: 27, name: 'ai_remediations',
  description: 'AI remediations table',
  up: wrapAsync(v027AiRemediations.up), down: wrapAsync(v027AiRemediations.down),
};
const v028DcInfrastructureMigration: Migration = {
  id: '20250101000028', version: 28, name: 'dc_infrastructure',
  description: 'Data center infrastructure tables',
  up: wrapAsync(v028DcInfrastructure.up), down: wrapAsync(v028DcInfrastructure.down),
};
const v029DcLifecycleMigration: Migration = {
  id: '20250101000029', version: 29, name: 'dc_lifecycle',
  description: 'Data center lifecycle tables',
  up: wrapAsync(v029DcLifecycle.up), down: wrapAsync(v029DcLifecycle.down),
};
const v030DcRoomMonitorMigration: Migration = {
  id: '20250101000030', version: 30, name: 'dc_room_monitor',
  description: 'Data center room monitor tables',
  up: wrapAsync(v030DcRoomMonitor.up), down: wrapAsync(v030DcRoomMonitor.down),
};
const v031NetworkSubnetsMigration: Migration = {
  id: '20250101000031', version: 31, name: 'network_subnets',
  description: 'Network subnet management tables',
  up: wrapAsync(v031NetworkSubnets.up), down: wrapAsync(v031NetworkSubnets.down),
};

// v019-v021: 需要包裹的迁移
const v019WorkflowEngineEnhancementMigration: Migration = {
  id: '20250101000019', version: 19, name: 'workflow_engine_enhancement',
  description: 'Workflow engine enhancement',
  up: wrapAsync(v019WorkflowEngineEnhancement.up), down: wrapAsync(v019WorkflowEngineEnhancement.down),
};
const v020DatabasesTableMigration: Migration = {
  id: '20250101000020', version: 20, name: 'databases_table',
  description: 'Databases table for database connection management',
  up: wrapAsync(v020DatabasesTable.up), down: wrapAsync(v020DatabasesTable.down),
};

// === 所有迁移按版本号排序 ===
export const ALL_MIGRATIONS: Migration[] = [
  // v001-v006: 基础
  v001InitialSchema,
  v002AddApiProvider,
  v003AddAIModelsTable,
  v004AddAgentModelFields,
  v005SSHKeyPasswordSupport,
  v006NetworkDeviceCredentials,
  // v007-v008: 凭证与用户
  v007CredentialsTable,
  v008FixUsersIdType,
  // v009-v010: 网络覆盖
  v009NetworkCompleteCoverage,
  v010SnmpChannel,
  // v012-v015: 时区与发现
  v012TimezoneMigration,
  v013NetworkDiscovery,
  v014AlertCorrelation,
  v015NotificationColumns,
  // v016-v018: 数据库与审批
  v016DatabasesTable,
  v017ApprovalRequests,
  v018AlertAutoResponseMigration,
  // v019-v020: 工作流与审批
  v019WorkflowEngineEnhancementMigration,
  v020DatabasesTableMigration,
  // v022-v027: 配置与容器
  v022ConfigTemplatesMigration,
  v023VirtualMachinesMigration,
  v024ContainersMigration,
  v025ContainerImagesMigration,
  v026VolumesMigration,
  v027AiRemediationsMigration,
  // v028-v030: 数据中心
  v028DcInfrastructureMigration,
  v029DcLifecycleMigration,
  v030DcRoomMonitorMigration,
  // v031: 网络子网
  v031NetworkSubnetsMigration,
  // v032-v037: DCIM 增强
  v032DeviceManufacturers,
  v033DeviceTypes,
  v034DeviceTypeSlotDefinitions,
  v035DcPowerPanels,
  v036DcPowerFeeds,
  v037DcCables,
  // v038-v039: 工具链接
  v038ToolLinksMigration,
  v039ToolLinkImageMigration,
  // v040: 告警 Provider 配置
  v040AlertProviderConfigs,
  // v041: DC 机房能效（PUE/功耗）
  v041DcRoomEnergy,
  // v042-v050: ensureTables 下沉（阶段3）
  v042BaselineMetrics,
  v043AlertProcessingRecords,
  v044ComposeProjects,
  v045ImageRegistries,
  v046DockerEndpoints,
  v047K8sContexts,
  v048AutoScaleTables,
  v049VmMigrations,
  v050VmSnapshotPolicies,
  // v051-v054: ensureTable 残留清理（阶段3 补遗）
  v051AiRemediationsColumns,
  v052KnowledgeBase,
  v053EscalationHistory,
  v054AlertAutoAnalysis,
  // v055: 运行时建表残留清理（initVMManagement 下沉）
  v055VmManagementTables,
];

export function createMigrationManager(db: any): MigrationManager {
  const manager = new MigrationManager(db);
  manager.registerBatch(ALL_MIGRATIONS);
  return manager;
}

export { MigrationManager } from './migrationFramework';
export type { Migration, MigrationRecord, MigrationResult } from './migrationFramework';
