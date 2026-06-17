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
];

export function createMigrationManager(db: any): MigrationManager {
  const manager = new MigrationManager(db);
  manager.registerBatch(ALL_MIGRATIONS);
  return manager;
}

export { MigrationManager } from './migrationFramework';
export type { Migration, MigrationRecord, MigrationResult } from './migrationFramework';
