/**
 * 通知规则 section（告警 + 任务）（2026-07-21 拆分）
 *
 * 从原 NotificationSettings.tsx L478-555 抽出
 * 包含：告警 critical/warning/info 通知 toggle + 任务 success/failed/running 通知 toggle
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { ToggleSwitch } from './ToggleSwitch';
import type { NotificationConfig } from './types';

export interface NotificationRulesSectionProps {
  config: NotificationConfig;
  onChange: (updater: Partial<NotificationConfig>) => void;
}

export function NotificationRulesSection({
  config,
  onChange,
}: NotificationRulesSectionProps) {
  return (
    <>
      {/* ==================== 告警通知过滤 ==================== */}
      <div className="bg-background rounded-lg p-4">
        <h4 className="font-medium text-text-primary mb-4">告警通知</h4>
        <p className="text-xs text-text-secondary mb-3">选择需要发送通知的告警严重度</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">严重告警 (critical)</p>
            <ToggleSwitch
              checked={config.alert_notification.critical}
              onChange={(b) =>
                onChange({
                  alert_notification: { ...config.alert_notification, critical: b },
                })
              }
              ariaLabel="启用 critical 通知"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">警告告警 (warning)</p>
            <ToggleSwitch
              checked={config.alert_notification.warning}
              onChange={(b) =>
                onChange({
                  alert_notification: { ...config.alert_notification, warning: b },
                })
              }
              ariaLabel="启用 warning 通知"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">信息告警 (info)</p>
            <ToggleSwitch
              checked={config.alert_notification.info}
              onChange={(b) =>
                onChange({
                  alert_notification: { ...config.alert_notification, info: b },
                })
              }
              ariaLabel="启用 info 通知"
            />
          </div>
        </div>
      </div>

      {/* ==================== 任务通知过滤 ==================== */}
      <div className="bg-background rounded-lg p-4">
        <h4 className="font-medium text-text-primary mb-4">任务通知</h4>
        <p className="text-xs text-text-secondary mb-3">选择需要发送通知的任务状态</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">任务成功</p>
            <ToggleSwitch
              checked={config.task_notification.success}
              onChange={(b) =>
                onChange({
                  task_notification: { ...config.task_notification, success: b },
                })
              }
              ariaLabel="启用任务成功通知"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">任务失败</p>
            <ToggleSwitch
              checked={config.task_notification.failed}
              onChange={(b) =>
                onChange({
                  task_notification: { ...config.task_notification, failed: b },
                })
              }
              ariaLabel="启用任务失败通知"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">任务运行中</p>
            <ToggleSwitch
              checked={config.task_notification.running}
              onChange={(b) =>
                onChange({
                  task_notification: { ...config.task_notification, running: b },
                })
              }
              ariaLabel="启用任务运行通知"
            />
          </div>
        </div>
      </div>
    </>
  );
}
