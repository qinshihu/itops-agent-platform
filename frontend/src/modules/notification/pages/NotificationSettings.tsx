/**
 * NotificationSettings 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 NotificationSettings.tsx 592 行（workspace 略大于 git HEAD 562）包含：
 *   - 6 useState（config + testStatus + testMessage + saveStatus + 3 visibility）
 *   - 1 useQuery（load config）
 *   - 1 useMutation（save config）
 *   - 1 large testNotificationChannel() handler
 *   - 主 page 含 4 channel section + 2 rule section + save button
 *
 * 拆分后行为：9 个子模块按职责分离 + 主入口仅编排 ~80 行
 *   - types.ts                       — NotificationConfig + DEFAULT_CONFIG (50)
 *   - useNotificationSettings.ts     — 全部 hooks + handlers (230)
 *   - helpers.ts                     — mergeNotificationConfig deep merge (40)
 *   - ToggleSwitch.tsx               — iOS 风开关复用组件 (30)
 *   - WebhookChannelSection.tsx      — Webhook 渠道 UI (40)
 *   - EmailChannelSection.tsx        — 邮件 SMTP 渠道 UI (110)
 *   - WechatChannelSection.tsx       — 企业微信渠道 UI (90)
 *   - DingtalkChannelSection.tsx     — 钉钉渠道 UI (90)
 *   - NotificationRulesSection.tsx   — 告警 + 任务规则 section (90)
 *   - index.ts                       — barrel (15)
 *
 * 桶兼容：原 `import NotificationSettings from '.../NotificationSettings'`（包括 settings tab + lazy import + split-components.test）全部仍可用
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationSettings } from './notification-settings/useNotificationSettings';
import { mergeNotificationConfig } from './notification-settings/helpers';
import { WebhookChannelSection } from './notification-settings/WebhookChannelSection';
import { EmailChannelSection } from './notification-settings/EmailChannelSection';
import { WechatChannelSection } from './notification-settings/WechatChannelSection';
import { DingtalkChannelSection } from './notification-settings/DingtalkChannelSection';
import { NotificationRulesSection } from './notification-settings/NotificationRulesSection';

export default function NotificationSettings() {
  const { t: _t } = useTranslation();
  const data = useNotificationSettings();

  const handleConfigChange = (updater: Parameters<typeof mergeNotificationConfig>[1]) => {
    data.setNotificationConfig((prev) => mergeNotificationConfig(prev, updater));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          通知设置
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          配置告警通知和任务状态通知的方式，支持邮件、企业微信和钉钉
        </p>
      </div>

      <div className="space-y-6">
        {/* ==================== 通知渠道配置 ==================== */}
        <div className="bg-background rounded-lg p-5 space-y-5">
          <h4 className="font-medium text-text-primary">通知渠道</h4>

          <WebhookChannelSection config={data.notificationConfig} onChange={handleConfigChange} />

          <EmailChannelSection
            config={data.notificationConfig}
            onChange={handleConfigChange}
            showPassword={data.showSmtpPassword}
            setShowPassword={data.setShowSmtpPassword}
            testStatus={data.testStatus.email}
            testMessage={data.testMessage.email || ''}
            onTest={() => data.testNotificationChannel('email')}
          />

          <WechatChannelSection
            config={data.notificationConfig}
            onChange={handleConfigChange}
            showUrl={data.showWechatUrl}
            setShowUrl={data.setShowWechatUrl}
            testStatus={data.testStatus.wechat}
            testMessage={data.testMessage.wechat || ''}
            onTest={() => data.testNotificationChannel('wechat')}
          />

          <DingtalkChannelSection
            config={data.notificationConfig}
            onChange={handleConfigChange}
            showUrl={data.showDingtalkUrl}
            setShowUrl={data.setShowDingtalkUrl}
            testStatus={data.testStatus.dingtalk}
            testMessage={data.testMessage.dingtalk || ''}
            onTest={() => data.testNotificationChannel('dingtalk')}
          />
        </div>

        {/* ==================== 告警 + 任务 通知规则 ==================== */}
        <NotificationRulesSection config={data.notificationConfig} onChange={handleConfigChange} />

        {/* ==================== 保存按钮 ==================== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.saveStatus === 'saving' && (
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
            )}
            {data.saveStatus === 'saved' && (
              <p className="text-xs text-status-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                已保存
              </p>
            )}
            {data.saveStatus === 'error' && (
              <p className="text-xs text-status-failed flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                保存失败
              </p>
            )}
          </div>
          <button
            onClick={data.saveConfig}
            disabled={data.saveStatus === 'saving'}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {data.saveStatus === 'saving' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            保存通知配置
          </button>
        </div>
      </div>
    </div>
  );
}
