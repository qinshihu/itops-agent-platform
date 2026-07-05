/**
 * Repository 层 - 统一数据访问入口
 *
 * 业务代码应通过 repository 访问数据库，而非直接 `import db`。
 * 这样测试时可替换 repository 为 mock，无需 mock 整个 SQLite。
 *
 * 阶段 4A 建立的基础设施，新代码强制走 repository；老代码渐进式迁移。
 */

export { alertRepository, deviceAssociationsRepo, correlationsRepo, aarsLogsRepo, noiseReductionRepo, workflowMappingsRepo, webhookLogsRepo, processingRecordsRepo, alertConfigsRepo, autoAnalysisRepo, automataTrustRepo, probeStatsRepo } from './alertRepository';
export type {
  AlertFilters, AlertRecord, AlertProviderConfigRecord,
  AlertDeviceAssociationRecord, AlertDeviceAssociationInput,
  AlertCorrelationGroupRecord, AlertCorrelationGroupCreateInput, AlertCorrelationGroupListFilters,
  AlertCorrelationMemberRecord, AlertCorrelationMemberInput,
  AarsResponseLogRecord, AarsResponseLogInput,
  AlertNoiseReductionRecord, AlertNoiseReductionCreateInput,
  AlertWorkflowMappingRecord, AlertWorkflowMappingCreateInput, AlertWorkflowMappingUpdateInput,
  AlertWebhookLogInput, AlertWebhookLogRecord,
  AlertProcessingRecord,
  AlertConfigRecord, AlertConfigCreateInput, AlertConfigUpdateInput,
  AlertNotificationRecord, AlertNotificationInsertInput,
  AutoAnalysisRecord, AutoAnalysisSaveInput,
} from './alertRepository';

export { agentExecutionRepository } from './agentExecutionRepository';

export { auditLogRepository } from './auditLogRepository';
export type { AuditLogRecord, AuditLogInsertInput, AuditLogListFilters } from './auditLogRepository';
export type { AgentExecutionRecord, AgentExecutionCreateInput, AgentExecutionStatus } from './agentExecutionRepository';

export { dcRepository, roomsRepo, racksRepo, slotsRepo, devicesRepo, pdusRepo, cablesRepo, powerRepo } from './dcRepository';
export type {
  DcRackRecord, DcDeviceRecord, DcPduRecord, DcCableRecord,
  DcRackCreateInput, DcDeviceCreateInput,
  DcRoomCreateInput, DcRoomUpdateInput,
  RackListFilters,
  SlotRecord, SlotCreateInput, SlotImportInput, SlotUpdateInput,
  DeviceTypeCreateInput, DeviceTypeUpdateInput,
  ManufacturerCreateInput, ManufacturerUpdateInput,
  LifecycleCreateInput, LifecycleListFilters, UnallocatedQueryFilters,
  PduCreateInput, PduUpdateInput, PduImportInput,
  CableCreateInput, CableUpdateInput, CableListFilters,
  PowerPanelCreateInput, PowerPanelUpdateInput,
  PowerFeedCreateInput, PowerFeedUpdateInput, FeedListFilters,
} from './dcRepository';

export { settingsRepository } from './settingsRepository';
export type { SettingRecord } from './settingsRepository';

export { serverRepository, serversRepo, groupsRepo, sshKeysRepo, topologyRepo } from './serverRepository';
export type {
  ServerRecord, ServerCreateInput, ServerUpdateInput,
  ServerGroupRecord, ServerGroupCreateInput,
  SshKeyRecord,
} from './serverRepository';

export { agentRepository } from './agentRepository';
export type {
  AgentRecord, AgentWithModelNames, AgentListFilters,
  AgentCreateInput, AgentUpdateInput, AgentLlmConfig,
} from './agentRepository';

export { networkDeviceRepository } from './networkDeviceRepository';
export type {
  NetworkDeviceRecord, NetworkDeviceWithCredentialName, NetworkDeviceCredentials,
  NetworkDeviceSshCredentials, NetworkDeviceBasic,
  NetworkDeviceCreateInput, NetworkDeviceUpdateInput, NetworkDeviceDiscoveryInput,
} from './networkDeviceRepository';

export { snmpRepository, snmpCredentialsRepo, snmpTrapEventsRepo, snmpInspectionRepo, baselineMetricsRepo, snmpPollingRepo } from './snmpRepository';
export type {
  SnmpCredentialRecord, SnmpCredentialListRow, SnmpCredentialDetailRow,
  SnmpCredentialCreateInput, SnmpCredentialUpdateInput,
  SnmpTrapEventInsertInput,
  InspectionHistoryRecord, InterfaceMetricRecord,
} from './snmpRepository';

export { networkSubnetRepository, networkSubnetsRepo, networkIpsRepo } from './networkSubnetRepository';
export type {
  NetworkSubnetRecord, NetworkSubnetListRow,
  NetworkSubnetCreateInput, NetworkSubnetUpdateInput,
  NetworkIpRecord, NetworkIpUpdateInput, NetworkIpListFilters, NetworkIpBatchUpdateInput,
} from './networkSubnetRepository';

export { workflowRepository, workflowsRepo, tasksRepo, scheduledTasksRepo } from './workflowRepository';
export type {
  WorkflowRecord, WorkflowCreateInput, WorkflowUpdateInput,
  TaskRecord, TaskCreateInput, TaskCreateWithStatusInput, TaskListFilters, TaskLogEntry,
  ScheduledTaskRecord, ScheduledTaskWithWorkflow,
  ScheduledTaskCreateInput, ScheduledTaskUpdateInput,
} from './workflowRepository';

export { knowledgeRepository } from './knowledgeRepository';
export type {
  KnowledgeRecord, KnowledgeListFilters, KnowledgeQueryFilters,
  KnowledgeCreateInput, KnowledgeCreateRestInput, KnowledgeUpdateRestInput,
} from './knowledgeRepository';

export { userRepository } from './userRepository';
export type {
  UserRecord, UserListItem, UserAuthRecord, UserCacheFields, UserLockoutStatus,
  UserCreateInput, UserUpdateInput,
} from './userRepository';

export { remediationPolicyRepository } from './remediationPolicyRepository';
export type {
  RemediationPolicyRecord, RemediationPolicyListFilters,
  RemediationPolicyCreateInput, RemediationPolicyMinimalInput,
  RemediationPolicySeedInput, RemediationPolicyUpdateInput,
} from './remediationPolicyRepository';

export { remediationAuditRepository } from './remediationAuditRepository';
export type { RemediationAuditRecord } from './remediationAuditRepository';

export { autoScaleRepository } from './autoScaleRepository';
export type { AutoScaleRuleRecord, AutoScaleHistoryRecord } from './autoScaleRepository';

export { virtualMachineRepository } from './virtualMachineRepository';
export type {
  VirtualMachineRecord, VirtualMachineListFilters,
  VirtualMachineInsertInput, VirtualMachineUpdateInput, VirtualMachineUpsertInput,
} from './virtualMachineRepository';

export { dbConnectionRepository } from './dbConnectionRepository';
export type {
  DbConnectionRecord, DbConnectionInsertInput, DbConnectionUpdateInput,
} from './dbConnectionRepository';

export { infraRepository, toolLinksRepo, scriptsRepo, notificationsRepo, configTemplatesRepo, configTemplateHistoryRepo, reportsRepo, reportSchedulesRepo, approvalsRepo } from './infraRepository/index';
export type {
  ToolLinkRecord, ToolLinkCreateInput, ToolLinkUpdateInput,
  ScriptRecord, ScriptRecordRaw, ScriptCreateInput, ScriptUpdateInput, ScriptListFilters,
  NotificationRecord, NotificationCreateInput, NotificationListFilters, NotificationStats,
  ConfigTemplateRecord, ConfigTemplateCreateInput, ConfigTemplateUpdateInput,
  ConfigTemplateListFilters, ConfigTemplateApplyResult,
  ConfigTemplateFullCreateInput, ConfigTemplateFullUpdateInput, ConfigTemplateFullListFilters,
  ConfigTemplateHistoryRecord, ConfigTemplateHistoryCreateInput, ConfigTemplateHistoryListFilters,
  ReportRecord, ReportCreateInput, ReportUpdateInput,
  ReportScheduleRecord, ReportScheduleCreateInput, ReportScheduleUpdateInput,
  ApprovalListFilters,
} from './infraRepository/index';

export { analyticsRepository } from './analyticsRepository';
export type {
  InspectionCenterResult, InspectionCenterCounts,
  DeviceOverview, DashboardLinkageStats,
  InspectionHistoryTrend, DeviceTrend, TrendSummary,
  DashboardStats, AlertTrendPoint, TaskTrendPoint,
  AgentStatItem, AgentStatsResult, TaskDistribution,
  RemediationStats, SlaStats, ServerMetricLatest, ServerMetricsDashboard,
  FullDashboard, AlertSourceStats, ReportAnalytics,
} from './analyticsRepository';

export { tokenBlacklistRepository } from './tokenBlacklistRepository';
export { credentialRepository } from './credentialRepository';
export { k8sContextRepository } from './k8sContextRepository';
export { aiModelRepository } from './aiModelRepository';
export type { AIModelRecord, AIModelCreateInput, AIModelUpdateInput } from './aiModelRepository';

export { changeRepository } from './changeRepository';
export type { ChangeRecord, ChangeCreateInput, ChangeListFilters, ChangeUpdateFields } from './changeRepository';

export { configRepository, composeProjectsRepo, networkConfigBackupsRepo, configRepairRecordsRepo } from './configRepository';
export type { ComposeProjectRecord, ComposeProjectCreateInput, ComposeProjectUpdateInput, NetworkConfigBackupRecord, NetworkConfigBackupWithDevice, NetworkConfigBackupCreateInput, ConfigRepairRecord, ConfigRepairCreateInput, ConfigRepairListFilters } from './configRepository';

export { monitorRepository, serverMetricsRepo } from './monitorRepository';
export type { ServerMetricRecord, ServerMetricInsertInput } from './monitorRepository';

export { vmMigrationRepository, vmSnapshotPolicyRepository, vmPlatformRepository, vmAuditLogRepository, imageRegistryRepository, dockerEndpointRepository } from './containersRepository';
export type {
  VmMigrationRecord, VmMigrationCreateInput, VmMigrationListFilters,
  VmSnapshotPolicyRecord, VmSnapshotPolicyCreateInput,
  VmPlatformRecord, VmPlatformCreateInput,
  VmAuditLogRecord, VmAuditLogCreateInput, VmAuditLogListFilters,
  ImageRegistryRecord, ImageRegistryCreateInput,
  DockerEndpointRecord, DockerEndpointCreateInput,
} from './containersRepository';
