/**
 * 邮件 SMTP 通知渠道 section widget（2026-07-21 拆分）
 *
 * 从原 NotificationSettings.tsx L208-379 抽出
 * 包含：toggle + SMTP server/port/user/password + 测试按钮
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { ToggleSwitch } from './ToggleSwitch';
import type { ChannelTestStatus, NotificationConfig } from './types';

export interface EmailChannelSectionProps {
  config: NotificationConfig;
  onChange: (updater: Partial<NotificationConfig>) => void;
  showPassword: boolean;
  setShowPassword: (b: boolean) => void;
  testStatus: ChannelTestStatus;
  testMessage: string;
  onTest: () => void;
}

export function EmailChannelSection({
  config,
  onChange,
  showPassword,
  setShowPassword,
  testStatus,
  testMessage,
  onTest,
}: EmailChannelSectionProps) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">邮件 (SMTP)</p>
          <p className="text-xs text-text-secondary">通过 SMTP 邮件服务器发送通知</p>
        </div>
        <ToggleSwitch
          checked={config.email_enabled}
          onChange={(b) => onChange({ email_enabled: b })}
          ariaLabel="启用邮件通知"
        />
      </div>

      {config.email_enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-text-secondary mb-1.5">SMTP 服务器</label>
            <input
              type="text"
              placeholder="smtp.qq.com"
              value={config.email_config.smtp_host}
              onChange={(e) =>
                onChange({
                  email_config: { ...config.email_config, smtp_host: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-text-secondary mb-1.5">SMTP 端口</label>
            <input
              type="number"
              min="1"
              max="65535"
              value={config.email_config.smtp_port}
              onChange={(e) =>
                onChange({
                  email_config: {
                    ...config.email_config,
                    smtp_port: parseInt(e.target.value, 10) || 465,
                  },
                })
              }
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-text-secondary mb-1.5">邮箱账号</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={config.email_config.user}
              onChange={(e) =>
                onChange({
                  email_config: { ...config.email_config, user: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-text-secondary mb-1.5">
              密码 {config.email_config.password_set && <span className="text-text-tertiary ml-1">(已配置)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.email_config.password}
                onChange={(e) =>
                  onChange({
                    email_config: { ...config.email_config, password: e.target.value },
                  })
                }
                className="w-full px-3 py-2 pr-9 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                placeholder={config.email_config.password_set ? '留空保持不变' : ''}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <button
              onClick={onTest}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {testStatus === 'success' && (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {testStatus === 'error' && (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              测试邮件发送
            </button>
            {testMessage && testStatus !== 'idle' && (
              <p
                className={`text-xs ${testStatus === 'success' ? 'text-status-success' : testStatus === 'error' ? 'text-status-failed' : 'text-text-secondary'}`}
              >
                {testMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
