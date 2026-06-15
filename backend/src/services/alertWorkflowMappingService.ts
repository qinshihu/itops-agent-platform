import { randomUUID } from 'crypto';
import db, { getIOInstance } from '../models/database';
import { createAuditLog } from './auditService';
import { logger } from '../utils/logger';

interface AlertWorkflowMatchInput {
  alertId: string;
  source: string;
  severity: string;
  title: string;
}

export function triggerAlertWorkflowMapping({
  alertId,
  source,
  severity,
  title,
}: AlertWorkflowMatchInput): string | null {
  try {
    const existingAlert = db.prepare(
      'SELECT related_task_id FROM alerts WHERE id = ?'
    ).get(alertId) as { related_task_id?: string | null } | undefined;

    if (existingAlert?.related_task_id) {
      return existingAlert.related_task_id;
    }

    const mappings = db.prepare(`
      SELECT *
      FROM alert_workflow_mappings
      WHERE enabled = 1
      AND (alert_source = ? OR alert_source IS NULL)
      AND (alert_severity = ? OR alert_severity IS NULL)
      ORDER BY
        CASE WHEN alert_source = ? THEN 0 ELSE 1 END,
        CASE WHEN alert_severity = ? THEN 0 ELSE 1 END,
        created_at ASC
    `).all(source, severity, source, severity) as Array<{
      alert_title_pattern?: string | null;
      workflow_id: string;
    }>;

    const normalizedTitle = title.toLowerCase();
    const matchedMapping = mappings.find((mapping) => {
      if (!mapping.alert_title_pattern) {
        return true;
      }

      return normalizedTitle.includes(mapping.alert_title_pattern.toLowerCase());
    });

    if (!matchedMapping) {
      return null;
    }

    const taskId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, created_at, initial_input, related_alert_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      matchedMapping.workflow_id,
      `自动处理告警: ${title.substring(0, 50)}`,
      'pending',
      now,
      JSON.stringify({ alertId, source, severity, title }),
      alertId
    );

    db.prepare(
      'UPDATE alerts SET related_task_id = ? WHERE id = ?'
    ).run(taskId, alertId);

    createAuditLog({
      action: 'auto_trigger_workflow',
      resource_type: 'task',
      resource_id: taskId,
      details: { alertId, workflowId: matchedMapping.workflow_id, source, severity },
    });

    const io = getIOInstance();
    if (io) {
      io.emit('task:created', {
        id: taskId,
        name: `自动处理告警: ${title}`,
        workflowId: matchedMapping.workflow_id,
      });
    }

    return taskId;
  } catch (error) {
    logger.error('Error triggering alert workflow mapping:', error);
    return null;
  }
}
