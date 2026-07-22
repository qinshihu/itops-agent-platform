/**
 * 企业微信通知渠道 section widget（2026-07-21 拆分）
 *
 * 从原 NotificationSettings.tsx L383-440 抽出
 * 包含：toggle + Webhook URL（显隐切换）+ 测试按钮
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ToggleSwitch } from './ToggleSwitch';
import type { ChannelTestStatus, NotificationConfig } from './types';

export interface WechatChannelSectionProps {
  config: NotificationConfig;
  onChange: (updater: Partial<NotificationConfig>) => void;
  showUrl: boolean;
  setShowUrl: (b: boolean) => void;
  testStatus: ChannelTestStatus;
  testMessage: string;
  onTest: () => void;
}

export function WechatChannelSection({
  config,
  onChange,
  showUrl,
  setShowUrl,
  testStatus,
  testMessage,
  onTest,
}: WechatChannelSectionProps) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">企业微信</p>
          <p className="text-xs text-text-secondary">通过企业微信群机器人 Webhook 发送通知</p>
        </div>
        <ToggleSwitch
          checked={config.wechat_enabled}
          onChange={(b) => onChange({ wechat_enabled: b })}
          ariaLabel="启用企业微信"
        />
      </div>
      {config.wechat_enabled && (
        <div className="space-y-2">
          <label className="block text-xs text-text-secondary mb-1.5">Webhook URL</label>
          <div className="relative">
            <input
              type={showUrl ? 'text' : 'password'}
              value={config.wechat_config.webhook_url}
              onChange={(e) =>
                onChange({
                  wechat_config: { webhook_url: e.target.value },
                })
              }
              className="w-full px-3 py-2 pr-9 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowUrl(!showUrl)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={onTest}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {testStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {testStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
            测试企业微信
          </button>
          {testMessage && testStatus !== 'idle' && (
            <p
              className={`text-xs ${testStatus === 'success' ? 'text-status-success' : testStatus === 'error' ? 'text-status-failed' : 'text-text-secondary'}`}
            >
              {testMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
