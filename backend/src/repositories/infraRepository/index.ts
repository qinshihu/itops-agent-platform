/**
 * infraRepository — infra 域基础设施表的统一数据访问层
 *
 * 采用子 repository 聚合模式：
 *   - toolLinksRepo        (tool_links)
 *   - scriptsRepo          (scripts)
 *   - notificationsRepo    (notifications)
 *   - configTemplatesRepo  (config_templates)
 *   - configTemplateHistoryRepo (config_template_history)
 *   - reportsRepo          (reports)
 *   - reportSchedulesRepo  (report_schedules)
 *   - approvalsRepo        (approval_requests)
 */

export { toolLinksRepo } from './toolLinksRepo';
export { scriptsRepo } from './scriptsRepo';
export { notificationsRepo } from './notificationsRepo';
export { configTemplatesRepo } from './configTemplatesRepo';
export { configTemplateHistoryRepo } from './configTemplateHistoryRepo';
export { reportsRepo } from './reportsRepo';
export { reportSchedulesRepo } from './reportSchedulesRepo';
export { approvalsRepo } from './approvalsRepo';

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
} from './types';

import { toolLinksRepo } from './toolLinksRepo';
import { scriptsRepo } from './scriptsRepo';
import { notificationsRepo } from './notificationsRepo';
import { configTemplatesRepo } from './configTemplatesRepo';
import { configTemplateHistoryRepo } from './configTemplateHistoryRepo';
import { reportsRepo } from './reportsRepo';
import { reportSchedulesRepo } from './reportSchedulesRepo';
import { approvalsRepo } from './approvalsRepo';

export const infraRepository = {
  toolLinks: toolLinksRepo,
  scripts: scriptsRepo,
  notifications: notificationsRepo,
  configTemplates: configTemplatesRepo,
  configTemplateHistory: configTemplateHistoryRepo,
  reports: reportsRepo,
  reportSchedules: reportSchedulesRepo,
  approvals: approvalsRepo,
};