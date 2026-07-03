// ── webhookLogs 子 repository ──

import db from '../../models/database';
import type { AlertWebhookLogInput } from './types';

export const webhookLogsRepo = {
  /**
   * 记录 webhook 调用日志
   * 对应：webhookRoutes.logWebhookInvocation
   */
  logInvocation(input: AlertWebhookLogInput): void {
    db.prepare(
      `INSERT INTO alert_webhook_logs (id, source, status, alert_count, resolved_count, error_message, ip_address, user_agent, processing_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.source,
      input.status,
      input.alert_count,
      input.resolved_count,
      input.error_message ?? null,
      input.ip_address ?? null,
      input.user_agent ?? null,
      input.processing_time_ms ?? null
    );
  },
};