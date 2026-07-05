// alertRepository — 告警域统一数据访问层（拆分后的聚合入口）
//
// 采用子 repository 聚合模式（同 dcRepository / workflowRepository）：
//   - alerts + alert_provider_configs + audit_logs（原有，顶层方法，见 coreAlerts.ts）
//   - deviceAssociations  (alert_device_associations + alert_device_match_log)
//   - correlations        (alert_correlation_groups + alert_correlation_members)
//   - aarsLogs            (aars_response_logs)
//   - noiseReduction      (alert_noise_reduction)
//   - workflowMappings    (alert_workflow_mappings)
//   - webhookLogs         (alert_webhook_logs)
//
// 业务代码请使用：
//   import { alertRepository } from '../repositories';
//   const alert = alertRepository.getById(id);
//   const log = alertRepository.aarsLogs.getByAlertId(id);

export type {
  AlertFilters,
  AlertRecord,
  AlertProviderConfigRecord,
  AlertDeviceAssociationRecord,
  AlertDeviceAssociationInput,
  AlertCorrelationGroupRecord,
  AlertCorrelationGroupCreateInput,
  AlertCorrelationGroupListFilters,
  AlertCorrelationMemberRecord,
  AlertCorrelationMemberInput,
  AarsResponseLogRecord,
  AarsResponseLogInput,
  AlertNoiseReductionRecord,
  AlertNoiseReductionCreateInput,
  AlertWorkflowMappingRecord,
  AlertWorkflowMappingCreateInput,
  AlertWorkflowMappingUpdateInput,
  AlertWebhookLogInput,
  AlertWebhookLogRecord,
  AlertProcessingRecord,
  AlertConfigRecord,
  AlertConfigCreateInput,
  AlertConfigUpdateInput,
  AlertNotificationRecord,
  AlertNotificationInsertInput,
} from './types';

export { deviceAssociationsRepo } from './deviceAssociations';
export { correlationsRepo } from './correlations';
export { aarsLogsRepo } from './aarsLogs';
export { noiseReductionRepo } from './noiseReduction';
export { workflowMappingsRepo } from './workflowMappings';
export { webhookLogsRepo } from './webhookLogs';
export { processingRecordsRepo } from './processingRecords';
export { alertConfigsRepo } from './alertConfigs';
export { autoAnalysisRepo } from './autoAnalysis';
export type { AutoAnalysisRecord, AutoAnalysisSaveInput } from './autoAnalysis';
export { automataTrustRepo } from './automataTrust';
export type { AutomataTrustRecord } from './automataTrust';
export { probeStatsRepo } from './probeStats';
export type { ProbeExecutionStatsRecord } from './probeStats';

import { deviceAssociationsRepo } from './deviceAssociations';
import { correlationsRepo } from './correlations';
import { aarsLogsRepo } from './aarsLogs';
import { noiseReductionRepo } from './noiseReduction';
import { workflowMappingsRepo } from './workflowMappings';
import { webhookLogsRepo } from './webhookLogs';
import { processingRecordsRepo } from './processingRecords';
import { alertConfigsRepo } from './alertConfigs';
import { autoAnalysisRepo } from './autoAnalysis';
import * as core from './coreAlerts';

// ── 主 repository（聚合原有方法 + 子 repository）──
//
// coreAlerts.ts 中的方法以独立导出函数形式存在（getAll/getById/create/...），
// 这里通过 `...core` 展开为方法。注意 `delete` 是 JS 保留字，无法作为独立函数名，
// 故核心模块中以 `deleteAlert` 命名，此处映射回 `delete` 以保持原 API 兼容。

export const alertRepository = {
  ...core,
  delete: core.deleteAlert,
  deviceAssociations: deviceAssociationsRepo,
  correlations: correlationsRepo,
  aarsLogs: aarsLogsRepo,
  noiseReduction: noiseReductionRepo,
  workflowMappings: workflowMappingsRepo,
  webhookLogs: webhookLogsRepo,
  processingRecords: processingRecordsRepo,
  alertConfigs: alertConfigsRepo,
  autoAnalysis: autoAnalysisRepo,
};