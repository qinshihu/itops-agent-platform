import { MigrationManager, Migration } from './migrationFramework';
import v001InitialSchema from './v001_initial_schema';
import v002AddApiProvider from './v002_add_api_provider';
import v003AddAIModelsTable from './v003_add_ai_models';
import v004AddAgentModelFields from './v004_add_agent_model_fields';
import v005SSHKeyPasswordSupport from './v005_ssh_key_password_support';
import v006NetworkDeviceCredentials from './v006_network_device_credentials';
import v007FixUsersIdType from './v007_fix_users_id_type';
import { up as v009Up, down as v009Down } from './v009_network_complete_coverage';
import { up as v010Up, down as v010Down } from './v010_snmp_channel';
import v012TimezoneMigration from './v012_timezone_migration';
import v013NetworkDiscovery from './v013_network_discovery';
import v014AlertCorrelation from './v014_alert_correlation';
import v015NotificationColumns from './v015_notification_columns';
import v016DatabasesTable from './v016_databases_table';
import v017ApprovalRequests from './v017_approval_requests';

// ===== 新增迁移（合并自其他分支） =====
import v007CredentialsTable from './v007_credentials_table';
import v016ToolLinks from './v016_tool_links';
import v017ToolLinkImage from './v017_tool_link_image';
import v018AlertAutoResponse from './v018_alert_auto_response';
import v018WorkflowEngineEnhancement from './v018_workflow_engine_enhancement';
import v019DatabasesTable from './v019_databases_table';
import v020ApprovalRequests from './v020_approval_requests';
import v021ConfigTemplates from './v021_config_templates';
import v022VirtualMachines from './v022_virtual_machines';
import v023Containers from './v023_containers';
import v024ContainerImages from './v024_container_images';
import v025Volumes from './v025_volumes';
import v026AiRemediations from './v026_ai_remediations';
import v027DcInfrastructure from './v027_dc_infrastructure';
import v028DcLifecycle from './v028_dc_lifecycle';
import v029DcRoomMonitor from './v029_dc_room_monitor';
import v030NetworkSubnets from './v030_network_subnets';

// Helper: wrap sync up/down into async
function wrapAsync(fn: (db: any) => void): (db: any) => Promise<void> {
  return async (db: any) => { fn(db); };
}

// v009 / v010 导出的不是 Migration 对象，手动包裹
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

// 版本号冲突的迁移重新编号（从 30 开始）
const v031CredentialsTable: Migration = {
  id: '20250101000031',
  version: 31,
  name: 'credentials_table_v7',
  description: 'Credentials table (from v007, renumbered due to conflict)',
  up: wrapAsync(v007CredentialsTable.up),
  down: wrapAsync(v007CredentialsTable.down),
};

const v032ToolLinks: Migration = {
  id: '20250101000032',
  version: 32,
  name: 'tool_links_v16',
  description: 'Tool links table (from v016, renumbered due to conflict)',
  up: wrapAsync(v016ToolLinks.up),
  down: wrapAsync(v016ToolLinks.down),
};

const v033ToolLinkImage: Migration = {
  id: '20250101000033',
  version: 33,
  name: 'tool_link_image_v17',
  description: 'Tool link image support (from v017, renumbered due to conflict)',
  up: wrapAsync(v017ToolLinkImage.up),
  down: wrapAsync(v017ToolLinkImage.down),
};

const v034AlertAutoResponse: Migration = {
  id: '20250101000034',
  version: 34,
  name: 'alert_auto_response_v18',
  description: 'Alert auto response system (from v018, renumbered due to conflict)',
  up: wrapAsync(v018AlertAutoResponse.up),
  down: wrapAsync(v018AlertAutoResponse.down),
};

const v035WorkflowEngineEnhancement: Migration = {
  id: '20250101000035',
  version: 35,
  name: 'workflow_engine_enhancement_v18',
  description: 'Workflow engine enhancement (from v018, renumbered due to conflict)',
  up: wrapAsync(v018WorkflowEngineEnhancement.up),
  down: wrapAsync(v018WorkflowEngineEnhancement.down),
};

// 无冲突的新迁移
const v019DatabasesTableMigration: Migration = {
  id: '20250101000019',
  version: 19,
  name: 'databases_table',
  description: 'Databases table for database connection management',
  up: wrapAsync(v019DatabasesTable.up),
  down: wrapAsync(v019DatabasesTable.down),
};

const v020ApprovalRequestsMigration: Migration = {
  id: '20250101000020',
  version: 20,
  name: 'approval_requests',
  description: 'Approval requests table',
  up: wrapAsync(v020ApprovalRequests.up),
  down: wrapAsync(v020ApprovalRequests.down),
};

const v021ConfigTemplatesMigration: Migration = {
  id: '20250101000021',
  version: 21,
  name: 'config_templates',
  description: 'Config templates table',
  up: wrapAsync(v021ConfigTemplates.up),
  down: wrapAsync(v021ConfigTemplates.down),
};

const v022VirtualMachinesMigration: Migration = {
  id: '20250101000022',
  version: 22,
  name: 'virtual_machines',
  description: 'Virtual machines table',
  up: wrapAsync(v022VirtualMachines.up),
  down: wrapAsync(v022VirtualMachines.down),
};

const v023ContainersMigration: Migration = {
  id: '20250101000023',
  version: 23,
  name: 'containers',
  description: 'Containers table',
  up: wrapAsync(v023Containers.up),
  down: wrapAsync(v023Containers.down),
};

const v024ContainerImagesMigration: Migration = {
  id: '20250101000024',
  version: 24,
  name: 'container_images',
  description: 'Container images table',
  up: wrapAsync(v024ContainerImages.up),
  down: wrapAsync(v024ContainerImages.down),
};

const v025VolumesMigration: Migration = {
  id: '20250101000025',
  version: 25,
  name: 'volumes',
  description: 'Volumes table',
  up: wrapAsync(v025Volumes.up),
  down: wrapAsync(v025Volumes.down),
};

const v026AiRemediationsMigration: Migration = {
  id: '20250101000026',
  version: 26,
  name: 'ai_remediations',
  description: 'AI remediations table',
  up: wrapAsync(v026AiRemediations.up),
  down: wrapAsync(v026AiRemediations.down),
};

const v027DcInfrastructureMigration: Migration = {
  id: '20250101000027',
  version: 27,
  name: 'dc_infrastructure',
  description: 'Data center infrastructure tables',
  up: wrapAsync(v027DcInfrastructure.up),
  down: wrapAsync(v027DcInfrastructure.down),
};

const v028DcLifecycleMigration: Migration = {
  id: '20250101000028',
  version: 28,
  name: 'dc_lifecycle',
  description: 'Data center lifecycle tables',
  up: wrapAsync(v028DcLifecycle.up),
  down: wrapAsync(v028DcLifecycle.down),
};

const v029DcRoomMonitorMigration: Migration = {
  id: '20250101000029',
  version: 29,
  name: 'dc_room_monitor',
  description: 'Data center room monitor tables',
  up: wrapAsync(v029DcRoomMonitor.up),
  down: wrapAsync(v029DcRoomMonitor.down),
};

const v030NetworkSubnetsMigration: Migration = {
  id: '20250101000040',
  version: 40,
  name: 'network_subnets',
  description: 'Network subnet management tables (subnets + IP addresses)',
  up: wrapAsync(v030NetworkSubnets.up),
  down: wrapAsync(v030NetworkSubnets.down),
};

export const ALL_MIGRATIONS: Migration[] = [
  v001InitialSchema,
  v002AddApiProvider,
  v003AddAIModelsTable,
  v004AddAgentModelFields,
  v005SSHKeyPasswordSupport,
  v006NetworkDeviceCredentials,
  v007FixUsersIdType,
  v009NetworkCompleteCoverage,
  v010SnmpChannel,
  v012TimezoneMigration,
  v013NetworkDiscovery,
  v014AlertCorrelation,
  v015NotificationColumns,
  v016DatabasesTable,
  v017ApprovalRequests,
  // 新增迁移（无冲突）
  v019DatabasesTableMigration,
  v020ApprovalRequestsMigration,
  v021ConfigTemplatesMigration,
  v022VirtualMachinesMigration,
  v023ContainersMigration,
  v024ContainerImagesMigration,
  v025VolumesMigration,
  v026AiRemediationsMigration,
  v027DcInfrastructureMigration,
  v028DcLifecycleMigration,
  v029DcRoomMonitorMigration,
  v030NetworkSubnetsMigration,
  // 重新编号的迁移（版本号冲突已解决）
  v031CredentialsTable,
  v032ToolLinks,
  v033ToolLinkImage,
  v034AlertAutoResponse,
  v035WorkflowEngineEnhancement,
];

export function createMigrationManager(db: any): MigrationManager {
  const manager = new MigrationManager(db);
  manager.registerBatch(ALL_MIGRATIONS);
  return manager;
}

export { MigrationManager } from './migrationFramework';
export type { Migration, MigrationRecord, MigrationResult } from './migrationFramework';
