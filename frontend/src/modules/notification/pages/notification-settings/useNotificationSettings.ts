/**
 * NotificationSettings 数据 hook（2026-07-21 拆分）
 *
 * 把原 NotificationSettings.tsx L9-162 的 state + query + mutation + handlers 抽出
 * 包含：
 * - 4 useState（notificationConfig + testStatus + testMessage + saveStatus + 3 visibility）
 * - 1 useQuery（notificationConfig）
 * - 1 useMutation（save config）
 * - 3 test handlers (email / wechat / dingtalk) — 它们共用 `testNotificationChannel(channel)` factory
 * - 1 save config handler
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  type ChannelName,
  type ChannelTestStatus,
  type NotificationConfig,
  type SaveStatus,
} from './types';

export interface UseNotificationSettingsResult {
  // state
  notificationConfig: NotificationConfig;
  setNotificationConfig: React.Dispatch<React.SetStateAction<NotificationConfig>>;
  testStatus: Record<string, ChannelTestStatus>;
  testMessage: Record<string, string>;
  saveStatus: SaveStatus;
  // toggles for password / url show/hide
  showWechatUrl: boolean;
  setShowWechatUrl: (b: boolean) => void;
  showDingtalkUrl: boolean;
  setShowDingtalkUrl: (b: boolean) => void;
  showSmtpPassword: boolean;
  setShowSmtpPassword: (b: boolean) => void;

  // handlers
  testNotificationChannel: (channel: ChannelName) => Promise<void>;
  saveConfig: () => void;
}

export function useNotificationSettings(): UseNotificationSettingsResult {
  const queryClient = useQueryClient();
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(
    DEFAULT_NOTIFICATION_CONFIG,
  );
  const [testStatus, setTestStatus] = useState<Record<string, ChannelTestStatus>>({
    email: 'idle',
    wechat: 'idle',
    dingtalk: 'idle',
  });
  const [testMessage, setTestMessage] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showWechatUrl, setShowWechatUrl] = useState(false);
  const [showDingtalkUrl, setShowDingtalkUrl] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // ── 通用测试发送逻辑 ──
  const testNotificationChannel = useCallback(
    async (channel: ChannelName) => {
      setTestStatus((prev) => ({ ...prev, [channel]: 'testing' }));
      setTestMessage((prev) => ({ ...prev, [channel]: '' }));

      try {
        let body: Record<string, unknown> = {};

        if (channel === 'email') {
          if (!notificationConfig.email_config.smtp_host || !notificationConfig.email_config.user) {
            setTestStatus((prev) => ({ ...prev, [channel]: 'error' }));
            setTestMessage((prev) => ({
              ...prev,
              [channel]: '请先填写 SMTP 服务器和邮箱账号',
            }));
            setTimeout(() => setTestStatus((prev) => ({ ...prev, [channel]: 'idle' })), 3000);
            return;
          }
          body = {
            smtp_host: notificationConfig.email_config.smtp_host,
            smtp_port: notificationConfig.email_config.smtp_port,
            user: notificationConfig.email_config.user,
            password: notificationConfig.email_config.password,
            to: notificationConfig.email_config.user,
          };
        } else if (channel === 'wechat') {
          if (!notificationConfig.wechat_config.webhook_url) {
            setTestStatus((prev) => ({ ...prev, [channel]: 'error' }));
            setTestMessage((prev) => ({
              ...prev,
              [channel]: '请先填写企业微信 Webhook URL',
            }));
            setTimeout(() => setTestStatus((prev) => ({ ...prev, [channel]: 'idle' })), 3000);
            return;
          }
          body = { webhook_url: notificationConfig.wechat_config.webhook_url };
        } else if (channel === 'dingtalk') {
          if (!notificationConfig.dingtalk_config.webhook_url) {
            setTestStatus((prev) => ({ ...prev, [channel]: 'error' }));
            setTestMessage((prev) => ({
              ...prev,
              [channel]: '请先填写钉钉 Webhook URL',
            }));
            setTimeout(() => setTestStatus((prev) => ({ ...prev, [channel]: 'idle' })), 3000);
            return;
          }
          body = { webhook_url: notificationConfig.dingtalk_config.webhook_url };
        }

        const { data } = await api.post(`/notification-config/test/${channel}`, body);

        if (data.success) {
          setTestStatus((prev) => ({ ...prev, [channel]: 'success' }));
          setTestMessage((prev) => ({
            ...prev,
            [channel]: data.message || '测试发送成功',
          }));
        } else {
          setTestStatus((prev) => ({ ...prev, [channel]: 'error' }));
          setTestMessage((prev) => ({
            ...prev,
            [channel]: data.error || '测试发送失败',
          }));
        }
      } catch (err: unknown) {
        setTestStatus((prev) => ({ ...prev, [channel]: 'error' }));
        setTestMessage((prev) => ({
          ...prev,
          [channel]: getAxiosErrorMessage(err, '测试发送失败'),
        }));
      }

      setTimeout(() => setTestStatus((prev) => ({ ...prev, [channel]: 'idle' })), 5000);
    },
    [notificationConfig],
  );

  // ── 查询 config（仅 load-on-mount side effect，无 server state）──
  useQuery({
    queryKey: ['notificationConfig'],
    queryFn: async () => {
      const { data } = await api.get('/notification-config');
      if (data) {
        setNotificationConfig(data);
      }
      return data;
    },
  });

  // ── 保存 mutation ──
  const mutation = useMutation({
    mutationFn: async (config: NotificationConfig) => {
      const { data } = await api.put('/notification-config', config);
      return data;
    },
    onMutate: () => {
      setSaveStatus('saving');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationConfig'] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  const saveConfig = useCallback(() => {
    mutation.mutate(notificationConfig);
  }, [mutation, notificationConfig]);

  return {
    notificationConfig,
    setNotificationConfig,
    testStatus,
    testMessage,
    saveStatus,
    showWechatUrl,
    setShowWechatUrl,
    showDingtalkUrl,
    setShowDingtalkUrl,
    showSmtpPassword,
    setShowSmtpPassword,
    testNotificationChannel,
    saveConfig,
  };
}
