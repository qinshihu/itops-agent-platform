/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';

export default function NotificationSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showWechatUrl, setShowWechatUrl] = useState(false);
  const [showDingtalkUrl, setShowDingtalkUrl] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState({
    webhook_enabled: true,
    webhook_url: '',
    email_enabled: false,
    email_config: {
      smtp_host: '',
      smtp_port: 465,
      user: '',
      password: '',
    },
    wechat_enabled: false,
    wechat_config: {
      webhook_url: '',
    },
    dingtalk_enabled: false,
    dingtalk_config: {
      webhook_url: '',
    },
    alert_notification: {
      critical: true,
      warning: true,
      info: false,
    },
    task_notification: {
      success: true,
      failed: true,
      running: false,
    },
  });

  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({
    email: 'idle',
    wechat: 'idle',
    dingtalk: 'idle',
  });
  const [testMessage, setTestMessage] = useState<Record<string, string>>({});

  const [notificationSaveStatus, setNotificationSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 发送测试通知
  const testNotificationChannel = async (channel: string) => {
    setTestStatus(prev => ({ ...prev, [channel]: 'testing' }));
    setTestMessage(prev => ({ ...prev, [channel]: '' }));

    try {
      let body: any = {};

      if (channel === 'email') {
        if (!notificationConfig.email_config.smtp_host || !notificationConfig.email_config.user) {
          setTestStatus(prev => ({ ...prev, [channel]: 'error' }));
          setTestMessage(prev => ({ ...prev, [channel]: '请先填写 SMTP 服务器和邮箱账号' }));
          setTimeout(() => setTestStatus(prev => ({ ...prev, [channel]: 'idle' })), 3000);
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
          setTestStatus(prev => ({ ...prev, [channel]: 'error' }));
          setTestMessage(prev => ({ ...prev, [channel]: '请先填写企业微信 Webhook URL' }));
          setTimeout(() => setTestStatus(prev => ({ ...prev, [channel]: 'idle' })), 3000);
          return;
        }
        body = { webhook_url: notificationConfig.wechat_config.webhook_url };
      } else if (channel === 'dingtalk') {
        if (!notificationConfig.dingtalk_config.webhook_url) {
          setTestStatus(prev => ({ ...prev, [channel]: 'error' }));
          setTestMessage(prev => ({ ...prev, [channel]: '请先填写钉钉 Webhook URL' }));
          setTimeout(() => setTestStatus(prev => ({ ...prev, [channel]: 'idle' })), 3000);
          return;
        }
        body = { webhook_url: notificationConfig.dingtalk_config.webhook_url };
      }

      const res = await api.post(
        `/api/notification-config/test/${channel}`,
        body
      );

      if (res.data.success) {
        setTestStatus(prev => ({ ...prev, [channel]: 'success' }));
        setTestMessage(prev => ({ ...prev, [channel]: res.data.message || '测试发送成功' }));
      } else {
        setTestStatus(prev => ({ ...prev, [channel]: 'error' }));
        setTestMessage(prev => ({ ...prev, [channel]: res.data.error || '测试发送失败' }));
      }
    } catch (err: any) {
      setTestStatus(prev => ({ ...prev, [channel]: 'error' }));
      setTestMessage(prev => ({ ...prev, [channel]: err.response?.data?.error || err.message || '测试发送失败' }));
    }

    setTimeout(() => setTestStatus(prev => ({ ...prev, [channel]: 'idle' })), 5000);
  };

  useQuery({
    queryKey: ['notificationConfig'],
    queryFn: async () => {
      const res = await api.get('/api/notification-config');
      if (res.data.data) {
        setNotificationConfig(res.data.data);
      }
      return res.data.data;
    },
  });

  const notificationConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const res = await api.put('/api/notification-config', config);
      return res.data;
    },
    onMutate: () => {
      setNotificationSaveStatus('saving');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationConfig'] });
      setNotificationSaveStatus('saved');
      setTimeout(() => setNotificationSaveStatus('idle'), 2000);
    },
    onError: () => {
      setNotificationSaveStatus('error');
      setTimeout(() => setNotificationSaveStatus('idle'), 3000);
    },
  });

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

          {/* ── Webhook ── */}
          <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Webhook</p>
                <p className="text-xs text-text-secondary">通过 HTTP Webhook 接收通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.webhook_enabled}
                  onChange={(e) => setNotificationConfig({...notificationConfig, webhook_enabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            {notificationConfig.webhook_enabled && (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Webhook URL</label>
                <input type="url"
                  placeholder="https://hooks.example.com/webhook"
                  value={notificationConfig.webhook_url}
                  onChange={(e) => setNotificationConfig({...notificationConfig, webhook_url: e.target.value})}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* ── 邮件 ── */}
          <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">邮件 (SMTP)</p>
                <p className="text-xs text-text-secondary">通过 SMTP 邮件服务器发送通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.email_enabled}
                  onChange={(e) => setNotificationConfig({...notificationConfig, email_enabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {notificationConfig.email_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-text-secondary mb-1.5">SMTP 服务器</label>
                  <input type="text" placeholder="smtp.qq.com"
                    value={notificationConfig.email_config.smtp_host}
                    onChange={(e) => setNotificationConfig({
                      ...notificationConfig,
                      email_config: {...notificationConfig.email_config, smtp_host: e.target.value}
                    })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-text-secondary mb-1.5">SMTP 端口</label>
                  <input type="number" min="1" max="65535"
                    value={notificationConfig.email_config.smtp_port}
                    onChange={(e) => setNotificationConfig({
                      ...notificationConfig,
                      email_config: {...notificationConfig.email_config, smtp_port: parseInt(e.target.value) || 465}
                    })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-text-secondary mb-1.5">邮箱账号</label>
                  <input type="email" placeholder="admin@example.com"
                    value={notificationConfig.email_config.user}
                    onChange={(e) => setNotificationConfig({
                      ...notificationConfig,
                      email_config: {...notificationConfig.email_config, user: e.target.value}
                    })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-text-secondary mb-1.5">SMTP 密码/授权码</label>
                  <div className="relative">
                    <input type={showSmtpPassword ? 'text' : 'password'}
                      value={notificationConfig.email_config.password}
                      onChange={(e) => setNotificationConfig({
                        ...notificationConfig,
                        email_config: {...notificationConfig.email_config, password: e.target.value}
                      })}
                      className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors text-xs"
                    >
                      {showSmtpPassword ? '隐藏' : '显示'}
                    </button>
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">QQ邮箱/163邮箱请使用授权码</p>
                </div>
                <div className="col-span-2 flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => testNotificationChannel('email')}
                    disabled={testStatus.email === 'testing'}
                    className="px-3 py-1.5 text-xs bg-surface border border-border text-text-secondary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {testStatus.email === 'testing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    {testStatus.email === 'testing' ? '发送中...' : '发送测试邮件'}
                  </button>
                  {testStatus.email === 'success' && (
                    <span className="text-xs text-status-success flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {testMessage.email || '测试邮件发送成功'}
                    </span>
                  )}
                  {testStatus.email === 'error' && (
                    <span className="text-xs text-status-failed flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {testMessage.email || '发送失败'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 企业微信 ── */}
          <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">企业微信</p>
                <p className="text-xs text-text-secondary">通过企业微信机器人 Webhook 发送通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.wechat_enabled}
                  onChange={(e) => setNotificationConfig({...notificationConfig, wechat_enabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {notificationConfig.wechat_enabled && (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Webhook URL</label>
                <div className="relative">
                  <input
                    type={showWechatUrl ? 'url' : 'password'}
                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                    value={notificationConfig.wechat_config.webhook_url}
                    onChange={(e) => setNotificationConfig({
                      ...notificationConfig,
                      wechat_config: {...notificationConfig.wechat_config, webhook_url: e.target.value}
                    })}
                    className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWechatUrl(!showWechatUrl)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                  >
                    {showWechatUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => testNotificationChannel('wechat')}
                    disabled={testStatus.wechat === 'testing'}
                    className="px-3 py-1.5 text-xs bg-surface border border-border text-text-secondary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {testStatus.wechat === 'testing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    {testStatus.wechat === 'testing' ? '发送中...' : '发送测试消息'}
                  </button>
                  {testStatus.wechat === 'success' && (
                    <span className="text-xs text-status-success flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {testMessage.wechat || '测试消息发送成功'}
                    </span>
                  )}
                  {testStatus.wechat === 'error' && (
                    <span className="text-xs text-status-failed flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {testMessage.wechat || '发送失败'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 钉钉 ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">钉钉</p>
                <p className="text-xs text-text-secondary">通过钉钉机器人 Webhook 发送通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.dingtalk_enabled}
                  onChange={(e) => setNotificationConfig({...notificationConfig, dingtalk_enabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {notificationConfig.dingtalk_enabled && (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Webhook URL</label>
                <div className="relative">
                  <input
                    type={showDingtalkUrl ? 'url' : 'password'}
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                    value={notificationConfig.dingtalk_config.webhook_url}
                    onChange={(e) => setNotificationConfig({
                      ...notificationConfig,
                      dingtalk_config: {...notificationConfig.dingtalk_config, webhook_url: e.target.value}
                    })}
                    className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDingtalkUrl(!showDingtalkUrl)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                  >
                    {showDingtalkUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => testNotificationChannel('dingtalk')}
                    disabled={testStatus.dingtalk === 'testing'}
                    className="px-3 py-1.5 text-xs bg-surface border border-border text-text-secondary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {testStatus.dingtalk === 'testing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    {testStatus.dingtalk === 'testing' ? '发送中...' : '发送测试消息'}
                  </button>
                  {testStatus.dingtalk === 'success' && (
                    <span className="text-xs text-status-success flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {testMessage.dingtalk || '测试消息发送成功'}
                    </span>
                  )}
                  {testStatus.dingtalk === 'error' && (
                    <span className="text-xs text-status-failed flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {testMessage.dingtalk || '发送失败'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== 告警通知过滤 ==================== */}
        <div className="bg-background rounded-lg p-4">
          <h4 className="font-medium text-text-primary mb-4">告警通知</h4>
          <p className="text-xs text-text-secondary mb-3">选择需要发送通知的告警等级</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">严重告警 (Critical)</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.alert_notification.critical}
                  onChange={(e) => setNotificationConfig({
                    ...notificationConfig,
                    alert_notification: {...notificationConfig.alert_notification, critical: e.target.checked}
                  })}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">警告告警 (Warning)</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.alert_notification.warning}
                  onChange={(e) => setNotificationConfig({
                    ...notificationConfig,
                    alert_notification: {...notificationConfig.alert_notification, warning: e.target.checked}
                  })}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">信息通知 (Info)</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.alert_notification.info}
                  onChange={(e) => setNotificationConfig({
                    ...notificationConfig,
                    alert_notification: {...notificationConfig.alert_notification, info: e.target.checked}
                  })}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
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
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.task_notification.success}
                  onChange={(e) => setNotificationConfig({
                    ...notificationConfig,
                    task_notification: {...notificationConfig.task_notification, success: e.target.checked}
                  })}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">任务失败</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.task_notification.failed}
                  onChange={(e) => setNotificationConfig({
                    ...notificationConfig,
                    task_notification: {...notificationConfig.task_notification, failed: e.target.checked}
                  })}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">任务运行中</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={notificationConfig.task_notification.running}
                  onChange={(e) => setNotificationConfig({
                    ...notificationConfig,
                    task_notification: {...notificationConfig.task_notification, running: e.target.checked}
                  })}
                />
                <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>
        </div>

        {/* ==================== 保存按钮 ==================== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {notificationSaveStatus === 'saving' && (
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
            )}
            {notificationSaveStatus === 'saved' && (
              <p className="text-xs text-status-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                已保存
              </p>
            )}
            {notificationSaveStatus === 'error' && (
              <p className="text-xs text-status-failed flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                保存失败
              </p>
            )}
          </div>
          <button
            onClick={() => notificationConfigMutation.mutate(notificationConfig)}
            disabled={notificationSaveStatus === 'saving'}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {notificationSaveStatus === 'saving' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            保存通知配置
          </button>
        </div>
      </div>
    </div>
  );
}
