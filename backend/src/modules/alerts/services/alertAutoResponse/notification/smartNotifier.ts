/**
 * =============================================================================
 * AARS v2 — 智能通知路由
 *
 * 职责：
 *   1. 根据告警严重度、处理阶段、时间段选择通知渠道
 *   2. 紧急告警走多渠道（企微+钉钉）
 *   3. 一般通知仅走默认渠道
 *   4. 通知内容含修复方案摘要和操作指引
 * =============================================================================
 */

import { notificationService } from '../../../../infra/services/notificationService';
import { logger } from '../../../../../utils/logger';
import type { DeviceRuntimeProfile } from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';

export type NotificationReason =
  | 'diagnosis_complete'
  | 'auto_executed'
  | 'approval_required'
  | 'resolved'
  | 'execution_failed'
  | 'rolled_back'
  | 'escalated';

interface NotifyParams {
  alertId: string;
  alertTitle: string;
  alertSeverity: string;
  device: DeviceRuntimeProfile;
  reason: NotificationReason;
  summary: string;
  detail: string;
  commands?: string[];
  approvalId?: string;
}

class SmartNotifier {
  /**
   * 智能通知
   * 根据原因和严重度自动选择渠道和模板
   */
  async notify(params: NotifyParams): Promise<void> {
    const channels = this.selectChannels(params);
    const content = this.buildContent(params);

    for (const channel of channels) {
      try {
        await notificationService.sendNotification({
          type: this.mapReasonToType(params.reason),
          title: content.title,
          content: content.body,
          related_alert_id: params.alertId,
        });
        logger.info(`[SmartNotifier] Sent ${params.reason} notification via ${channel}`);
      } catch (err: unknown) {
        logger.warn(`[SmartNotifier] Failed to send via ${channel}: ${getErrorMessage(err)}`);
      }
    }
  }

  /**
   * 根据原因和严重度选择渠道
   */
  private selectChannels(params: NotifyParams): string[] {
    const isCritical = params.alertSeverity === 'critical' || params.alertSeverity === 'disaster';
    const isUrgent = params.reason === 'execution_failed' || params.reason === 'escalated' || params.reason === 'rolled_back';

    if (isCritical || isUrgent) {
      return ['wecom', 'dingtalk', 'email']; // 全渠道
    }

    if (params.reason === 'approval_required') {
      return ['wecom', 'dingtalk']; // 双渠道
    }

    return ['wecom']; // 默认仅企微
  }

  /**
   * 构建通知内容
   */
  private buildContent(params: NotifyParams): { title: string; body: string } {
    const prefix = this.getSeverityPrefix(params.alertSeverity);
    const deviceInfo = `${params.device.hostname || params.device.ip} (${params.device.type === 'server' ? '服务器' : '网络设备'})`;

    let body = `**设备**: ${deviceInfo}\n**摘要**: ${params.summary}\n\n${params.detail}`;

    switch (params.reason) {
      case 'diagnosis_complete':
        body = `📋 诊断完成\n**设备**: ${deviceInfo}\n**根因**: ${params.summary}\n\n${params.detail}`;
        break;

      case 'auto_executed':
        body = `🔧 已自动修复\n**设备**: ${deviceInfo}\n**修复方案**: ${params.summary}\n\n${params.detail}`;
        if (params.commands && params.commands.length > 0) {
          body += `\n\n**执行命令**:\n${params.commands.map(c => `\`${c}\``).join('\n')}`;
        }
        break;

      case 'approval_required':
        body = `🔐 修复审批请求\n**设备**: ${deviceInfo}\n**建议方案**: ${params.summary}\n\n请审核是否执行以下命令：\n${
          params.commands?.map(c => `\`${c}\``).join('\n') || '(无命令)'
        }\n\n✅ 同意执行 | ❌ 拒绝`;
        break;

      case 'resolved':
        body = `✅ 告警已解除\n**设备**: ${deviceInfo}\n**处理结果**: ${params.summary}\n\n${params.detail}`;
        break;

      case 'execution_failed':
      case 'rolled_back':
        body = `❌ 修复失败${params.reason === 'rolled_back' ? '（已回滚）' : ''}\n**设备**: ${deviceInfo}\n**错误**: ${params.summary}\n\n${params.detail}\n\n🔴 需要人工介入处理`;
        break;

      case 'escalated':
        body = `🚨 告警升级\n**设备**: ${deviceInfo}\n**原因**: ${params.summary}\n\n${params.detail}\n\n⏰ 需要立即人工处理`;
        break;
    }

    return {
      title: `${prefix} ${this.getReasonLabel(params.reason)}: ${params.alertTitle.substring(0, 100)}`,
      body,
    };
  }

  private getSeverityPrefix(severity: string): string {
    const map: Record<string, string> = {
      'disaster': '🚨',
      'critical': '🔴',
      'high': '🟠',
      'warning': '🟡',
      'medium': '🔵',
      'info': 'ℹ️',
    };
    return map[severity] || '🔵';
  }

  private getReasonLabel(reason: NotificationReason): string {
    const map: Record<string, string> = {
      'diagnosis_complete': '诊断完成',
      'auto_executed': '自动修复',
      'approval_required': '审批请求',
      'resolved': '告警解除',
      'execution_failed': '修复失败',
      'rolled_back': '已回滚',
      'escalated': '告警升级',
    };
    return map[reason] || reason;
  }

  private mapReasonToType(reason: NotificationReason): string {
    const map: Record<string, string> = {
      'diagnosis_complete': 'auto_analysis',
      'auto_executed': 'auto_remediation',
      'approval_required': 'remediation_approval',
      'resolved': 'alert_resolved',
      'execution_failed': 'remediation_failed',
      'rolled_back': 'remediation_failed',
      'escalated': 'alert_escalated',
    };
    return map[reason] || 'notification';
  }
}

export const smartNotifier = new SmartNotifier();
