/**
 * Webhook 通知渠道 section widget（2026-07-21 拆分）
 *
 * 从原 NotificationSettings.tsx L181-206 抽出
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { ToggleSwitch } from './ToggleSwitch';
import type { NotificationConfig } from './types';

export interface WebhookChannelSectionProps {
  config: NotificationConfig;
  onChange: (updater: Partial<NotificationConfig>) => void;
}

export function WebhookChannelSection({ config, onChange }: WebhookChannelSectionProps) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">Webhook</p>
          <p className="text-xs text-text-secondary">通过 HTTP Webhook 接收通知</p>
        </div>
        <ToggleSwitch
          checked={config.webhook_enabled}
          onChange={(b) => onChange({ webhook_enabled: b })}
          ariaLabel="启用 Webhook"
        />
      </div>
      {config.webhook_enabled && (
        <div>
          <label className="block text-xs text-text-secondary mb-1.5">Webhook URL</label>
          <input
            type="url"
            placeholder="https://hooks.example.com/webhook"
            value={config.webhook_url}
            onChange={(e) => onChange({ webhook_url: e.target.value })}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}
