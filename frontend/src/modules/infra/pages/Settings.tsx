/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Database, Shield, Loader2, CheckCircle2, AlertCircle, Sun, Moon, Lock, BookOpen, Upload, FileText, Globe, Wifi, Brain, Eye, EyeOff, Languages } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { validatePassword, getPasswordStrength } from '../../../utils/passwordValidator';
import AIModels from '../../ai/pages/AIModels';

interface Backup {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('models');
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { user, login, updateUser } = useAuth();
  const navigate = useNavigate();

  // 创建备份 mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/backups/create');
      return res.data;
    },
    onSuccess: () => {
      alert('备份创建成功！');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.response?.data?.message || '备份创建失败');
    }
  });

  // 备份历史查询
  const { data: backupHistoryData } = useQuery({
    queryKey: ['backupHistory'],
    queryFn: async () => {
      const res = await api.get('/api/backups/history');
      return res.data.data;
    }
  });
  const backupHistory = (backupHistoryData || []) as Backup[];

  // 恢复备份 mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const res = await api.post(`/api/backups/restore/${backupId}`);
      return res.data;
    },
    onSuccess: () => {
      alert('备份恢复成功！系统将自动重启...');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.response?.data?.message || '备份恢复失败');
    }
  });

  // 删除备份 mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const res = await api.delete(`/api/backups/${backupId}`);
      return res.data;
    },
    onSuccess: () => {
      alert('备份删除成功！');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.response?.data?.message || '备份删除失败');
    }
  });

  // 上传备份 mutation
  const uploadBackupMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('backup', file);
      const res = await api.post('/api/backups/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      alert('备份上传成功！');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.response?.data?.message || '备份上传失败');
    }
  });
  
  // 密码修改状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState('');
  
  // 通知配置本地状态
  const [showWechatUrl, setShowWechatUrl] = useState(false);
  const [showDingtalkUrl, setShowDingtalkUrl] = useState(false);
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

  // QAnything 配置查询
  useQuery({
    queryKey: ['qanythingConfig'],
    queryFn: async () => {
      const res = await api.get('/api/knowledge/qanything/config');
      if (res.data.data) {
        // 保留前端已有的真实 apiKey，防止被后端脱敏值覆盖
        const backendData = res.data.data;
        if (backendData.apiKey?.includes('****')) {
          backendData.apiKey = qanythingConfig.apiKey;
        }
        setQanythingConfig(backendData);
      }
      return res.data.data;
    },
  });

  // QAnything 配置保存
  const qanythingConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const res = await api.post('/api/knowledge/qanything/config', config);
      return res.data;
    },
    onMutate: () => {
      setQanythingSaveStatus('saving');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qanythingConfig'] });
      setQanythingSaveStatus('saved');
      setQanythingTestMessage('配置已保存');
      setQanythingTestStatus('success');
      setTimeout(() => setQanythingSaveStatus('idle'), 2000);
      setTimeout(() => setQanythingTestStatus('idle'), 3000);
    },
    onError: (err: any) => {
      setQanythingSaveStatus('error');
      setQanythingTestMessage(err.response?.data?.error || '保存失败');
      setQanythingTestStatus('error');
      setTimeout(() => setQanythingSaveStatus('idle'), 3000);
      setTimeout(() => setQanythingTestStatus('idle'), 5000);
    },
  });

  // QAnything 连接测试
  const qanythingTestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/knowledge/qanything/test');
      return res.data;
    },
    onMutate: () => {
      setQanythingTestStatus('testing');
      setQanythingTestMessage('');
    },
    onSuccess: (data) => {
      setQanythingTestStatus(data.success ? 'success' : 'error');
      setQanythingTestMessage(data.message);
    },
    onError: (err: any) => {
      setQanythingTestStatus('error');
      setQanythingTestMessage(err.response?.data?.error || err.response?.data?.message || '连接失败');
    },
  });

  const handleTestQAnythingConnection = () => {
    if (!qanythingConfig.apiBase.trim()) {
      setQanythingTestStatus('error');
      setQanythingTestMessage('请先填写 API 地址');
      setTimeout(() => setQanythingTestStatus('idle'), 3000);
      return;
    }
    qanythingTestMutation.mutate();
  };

  const handleUploadDocuments = () => {
    if (!qanythingConfig.enabled) {
      setUploadStatus('error');
      setUploadMessage('请先启用 QAnything 知识库并保存配置');
      setTimeout(() => setUploadStatus('idle'), 5000);
      return;
    }
    if (uploadFiles.length === 0) {
      setUploadStatus('error');
      setUploadMessage('请先选择要上传的文件');
      setTimeout(() => setUploadStatus('idle'), 3000);
      return;
    }
    uploadMutation.mutate(uploadFiles);
  };

  // 文档上传
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      const res = await api.post('/api/knowledge/qanything/upload-batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onMutate: () => {
      setUploadStatus('uploading');
      setUploadMessage('');
    },
    onSuccess: (data) => {
      setUploadStatus('success');
      setUploadMessage(`成功上传 ${data.summary?.success || 0} 个文件，失败 ${data.summary?.failed || 0} 个`);
      setUploadFiles([]);
      setTimeout(() => setUploadStatus('idle'), 5000);
    },
    onError: (err: any) => {
      setUploadStatus('error');
      setUploadMessage(err.response?.data?.error || '上传失败');
      setTimeout(() => setUploadStatus('idle'), 5000);
    },
  });
  // 密码显示状态
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // 通知渠道测试状态
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

  // QAnything 配置本地状态
  const [qanythingConfig, setQanythingConfig] = useState({
    enabled: false,
    apiBase: '',
    apiKey: '',
    kbId: '',
    mode: 'cloud' as 'cloud' | 'local',
    topK: 5,
  });
  const [qanythingSaveStatus, setQanythingSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [qanythingTestStatus, setQanythingTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [qanythingTestMessage, setQanythingTestMessage] = useState('');

  // 文档上传状态
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // 如果是强制修改密码，自动切换到安全设置标签
  useEffect(() => {
    if (searchParams.get('changePassword') === 'true') {
      setActiveTab('security');
    }
  }, [searchParams]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setUploadFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveQAnythingConfig = () => {
    if (qanythingConfig.enabled) {
      if (!qanythingConfig.apiBase.trim()) {
        setQanythingSaveStatus('error');
        setQanythingTestMessage('API 地址不能为空');
        setQanythingTestStatus('error');
        setTimeout(() => setQanythingSaveStatus('idle'), 3000);
        setTimeout(() => setQanythingTestStatus('idle'), 3000);
        return;
      }
      if (!qanythingConfig.kbId.trim()) {
        setQanythingSaveStatus('error');
        setQanythingTestMessage('知识库 ID 不能为空');
        setQanythingTestStatus('error');
        setTimeout(() => setQanythingSaveStatus('idle'), 3000);
        setTimeout(() => setQanythingTestStatus('idle'), 3000);
        return;
      }
      // 云端模式要求 API Key，本地模式可不填
      if (qanythingConfig.mode === 'cloud' && !qanythingConfig.apiKey.trim()) {
        setQanythingSaveStatus('error');
        setQanythingTestMessage('API Key 不能为空');
        setQanythingTestStatus('error');
        setTimeout(() => setQanythingSaveStatus('idle'), 3000);
        setTimeout(() => setQanythingTestStatus('idle'), 3000);
        return;
      }
    }
    qanythingConfigMutation.mutate(qanythingConfig);
  };

  // 密码修改处理
  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordStatus('saving');
    
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
      return;
    }
    
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      setPasswordError(passwordCheck.message);
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
      return;
    }
    
    try {
      const response = await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });
      
      if (response.data.success) {
        setPasswordStatus('saved');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        if (user) {
          const updatedUser = { ...user, passwordMustChange: false };
          updateUser(updatedUser);
        }
        
        // 清除 URL 中的 changePassword 参数
        navigate('/settings', { replace: true });
        
        setTimeout(() => setPasswordStatus('idle'), 3000);
      } else {
        setPasswordError(response.data.error || response.data.message || '密码修改失败');
        setPasswordStatus('error');
        setTimeout(() => setPasswordStatus('idle'), 3000);
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || err.response?.data?.message || '密码修改失败');
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
    }
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

  const tabs = [
    { id: 'models', name: t('settings.models'), icon: Brain },
    { id: 'qanything', name: t('dashboard.knowledge'), icon: BookOpen },
    { id: 'notifications', name: t('settings.monitoring'), icon: Bell },
    { id: 'database', name: t('settings.backup'), icon: Database },
    { id: 'security', name: t('settings.security'), icon: Shield },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">{t('settings.title')}</h1>
          <p className="text-text-secondary">{t('settings.languageDesc')}</p>
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="flex">
            <div className="w-64 border-r border-border p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-primary text-white'
                          : 'text-text-secondary hover:bg-background'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex-1 p-6">
              {activeTab === 'models' && <AIModels />}

              {activeTab === 'qanything' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      知识库配置 (QAnything)
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">
                      对接 QAnything 知识库，支持 PDF/Word/Excel 等多种格式文档上传，自动解析并用于 Agent 检索增强。
                    </p>
                  </div>

                  {/* 知识库连接配置 */}
                  <div className="bg-background rounded-lg p-6">
                    <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      连接配置
                    </h4>
                    
                    <div className="space-y-4">
                      {/* 启用开关 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-text-primary">启用 QAnything 知识库</p>
                          <p className="text-xs text-text-secondary">启用后，Agent 执行时将优先检索 QAnything 知识库</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={qanythingConfig.enabled}
                            onChange={(e) => setQanythingConfig({...qanythingConfig, enabled: e.target.checked})}
                          />
                          <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                      </div>

                      {/* 部署模式 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">部署模式</label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setQanythingConfig({...qanythingConfig, mode: 'cloud'})}
                            className={clsx(
                              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                              qanythingConfig.mode === 'cloud'
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface text-text-secondary border-border hover:border-primary/50'
                            )}
                          >
                            ️ 云端 API
                          </button>
                          <button
                            onClick={() => setQanythingConfig({...qanythingConfig, mode: 'local'})}
                            className={clsx(
                              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                              qanythingConfig.mode === 'local'
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface text-text-secondary border-border hover:border-primary/50'
                            )}
                          >
                             本地部署
                          </button>
                        </div>
                        <p className="text-xs text-text-secondary mt-2">
                          {qanythingConfig.mode === 'cloud' 
                            ? '使用网易有道云端 QAnything API，需外网访问' 
                            : '本地 Docker 部署，数据不出服务器，更安全'}
                        </p>
                      </div>

                      {/* API 地址 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">API 地址</label>
                        <input
                          type="text"
                          placeholder={qanythingConfig.mode === 'cloud' ? 'https://openapi.youdao.com/q_anything/api' : 'http://localhost:8777'}
                          value={qanythingConfig.apiBase}
                          onChange={(e) => setQanythingConfig({...qanythingConfig, apiBase: e.target.value})}
                          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                        <p className="text-xs text-text-secondary mt-1">
                          {qanythingConfig.mode === 'cloud' 
                            ? '云端 API 地址: https://openapi.youdao.com/q_anything/api' 
                            : '本地部署默认地址: http://localhost:8777'}
                        </p>
                      </div>

                      {/* API 密钥 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          {qanythingConfig.mode === 'cloud' ? '管理秘钥' : 'API Key'}
                        </label>
                        <input
                          type="password"
                          placeholder={qanythingConfig.mode === 'cloud' ? '从 QAnything 管理后台获取' : '本地部署通常不需要'}
                          value={qanythingConfig.apiKey}
                          onChange={(e) => setQanythingConfig({...qanythingConfig, apiKey: e.target.value})}
                          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* 知识库 ID */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">知识库 ID</label>
                        <input
                          type="text"
                          placeholder="KBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_xxxxxx"
                          value={qanythingConfig.kbId}
                          onChange={(e) => setQanythingConfig({...qanythingConfig, kbId: e.target.value})}
                          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                        <p className="text-xs text-text-secondary mt-1">
                          在 QAnything 管理后台创建知识库后获取 ID
                        </p>
                      </div>

                      {/* 检索数量 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          每次检索返回的片段数
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={qanythingConfig.topK}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 5;
                            setQanythingConfig({...qanythingConfig, topK: Math.max(1, Math.min(20, val))});
                          }}
                          className="w-32 px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                        <span className="text-xs text-text-secondary ml-2">默认 5，范围 1-20</span>
                      </div>

                      {/* 测试连接 */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={handleTestQAnythingConnection}
                          disabled={qanythingTestStatus === 'testing'}
                          className="px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {qanythingTestStatus === 'testing' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wifi className="w-4 h-4" />
                          )}
                          测试连接
                        </button>
                        
                        {qanythingTestStatus === 'success' && (
                          <span className="text-sm text-status-success flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            {qanythingTestMessage}
                          </span>
                        )}
                        {qanythingTestStatus === 'error' && (
                          <span className="text-sm text-status-failed flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {qanythingTestMessage}
                          </span>
                        )}
                      </div>

                      {/* 保存配置 */}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          {qanythingSaveStatus === 'saving' && (
                            <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
                          )}
                          {qanythingSaveStatus === 'saved' && (
                            <p className="text-xs text-status-success flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              已保存
                            </p>
                          )}
                          {qanythingSaveStatus === 'error' && (
                            <p className="text-xs text-status-failed flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              保存失败
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleSaveQAnythingConfig}
                          disabled={qanythingSaveStatus === 'saving'}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {qanythingSaveStatus === 'saving' && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          保存配置
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 文档上传 */}
                  <div className="bg-background rounded-lg p-6">
                    <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      上传文档到知识库
                    </h4>
                    
                    <div className="space-y-4">
                      <div 
                        className={clsx(
                          'border-2 border-dashed rounded-lg p-8 text-center transition-all',
                          isDragOver ? 'border-primary bg-primary/5' : 'border-border'
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <FileText className="w-12 h-12 mx-auto text-text-secondary mb-3" />
                        <p className="text-sm text-text-primary mb-1">拖拽文件到此处，或点击选择文件</p>
                        <p className="text-xs text-text-secondary">支持 PDF/Word/Excel/PPT/Markdown/TXT/CSV/图片</p>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.csv,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              setUploadFiles((prev) => [...prev, ...Array.from(files)]);
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all cursor-pointer text-sm"
                        >
                          选择文件
                        </label>
                      </div>

                      {/* 已选文件列表 */}
                      {uploadFiles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-text-primary">已选择 {uploadFiles.length} 个文件:</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {uploadFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-surface rounded-lg">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FileText className="w-4 h-4 text-text-secondary flex-shrink-0" />
                                  <span className="text-sm text-text-secondary truncate">{file.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-text-secondary">
                                    {formatFileSize(file.size)}
                                  </span>
                                  <button
                                    onClick={() => removeFile(index)}
                                    className="text-xs text-status-failed hover:text-status-failed/80 transition-colors"
                                  >
                                    移除
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 上传状态 */}
                      {uploadStatus !== 'idle' && (
                        <div className={clsx(
                          'p-3 rounded-lg flex items-center gap-2',
                          uploadStatus === 'uploading' && 'bg-blue-500/10 text-blue-400',
                          uploadStatus === 'success' && 'bg-green-500/10 text-green-400',
                          uploadStatus === 'error' && 'bg-red-500/10 text-red-400'
                        )}>
                          {uploadStatus === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
                          {uploadStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
                          {uploadStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                          <span className="text-sm">{uploadMessage}</span>
                        </div>
                      )}

                      {/* 上传按钮 */}
                      <button
                          onClick={handleUploadDocuments}
                          disabled={!qanythingConfig.enabled || uploadFiles.length === 0 || uploadStatus === 'uploading'}
                          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                        {uploadStatus === 'uploading' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            上传到知识库
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
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
              )}

              {activeTab === 'database' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      数据库设置
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">
                      数据库配置和备份设置
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-2">数据库类型</h4>
                      <p className="text-sm text-text-secondary">SQLite (当前)</p>
                    </div>

                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-2">数据路径</h4>
                      <p className="text-sm text-text-secondary">./data/app.db</p>
                    </div>

                    <div className="bg-background rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-text-primary">数据备份</h4>
                        <div className="flex gap-2">
                          <label className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            上传备份
                            <input 
                              type="file" 
                              accept=".db,.db.gz"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadBackupMutation.mutate(file);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          <button
                            onClick={() => createBackupMutation.mutate()}
                            disabled={createBackupMutation.isPending}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {createBackupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {createBackupMutation.isPending ? '创建中...' : '创建备份'}
                          </button>
                        </div>
                      </div>
                      
                      {/* 备份历史列表 */}
                      {backupHistory.length > 0 ? (
                        <div className="space-y-2">
                          {backupHistory.map((backup) => (
                            <div key={backup.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-text-primary">{backup.filename}</p>
                                <p className="text-xs text-text-secondary">
                                  {new Date(backup.createdAt).toLocaleString()} • {formatFileSize(backup.size)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      const token = localStorage.getItem('token');
                                      const response = await fetch(`/api/backups/download/${backup.id}`, {
                                        headers: {
                                          'Authorization': `Bearer ${token}`
                                        }
                                      });
                                      
                                      if (!response.ok) {
                                        throw new Error('下载失败');
                                      }
                                      
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = backup.filename || `backup-${backup.id}.db`;
                                      document.body.appendChild(a);
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
                                    } catch (err) {
                                      alert('下载失败：' + (err as Error).message);
                                    }
                                  }}
                                  className="px-3 py-1 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                                >
                                  下载
                                </button>
                                <button
                                  onClick={() => restoreBackupMutation.mutate(backup.id)}
                                  disabled={restoreBackupMutation.isPending}
                                  className="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                                >
                                  恢复
                                </button>
                                <button
                                  onClick={() => deleteBackupMutation.mutate(backup.id)}
                                  disabled={deleteBackupMutation.isPending}
                                  className="px-3 py-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-text-secondary">暂无备份</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      安全设置
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">
                      配置安全策略和访问控制
                    </p>
                  </div>

                  {/* 修改密码 */}
                  <div className="bg-background rounded-lg p-6">
                    <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      修改密码
                    </h4>
                    {searchParams.get('changePassword') === 'true' && (
                      <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2 text-yellow-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">首次登录需要修改密码</p>
                          <p className="text-xs mt-1">为了您的账户安全，请修改默认密码后继续使用</p>
                        </div>
                      </div>
                    )}
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">当前密码</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="请输入当前密码"
                          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">新密码</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="请输入新密码（至少8位）"
                          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                        {newPassword && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-text-secondary">密码强度</span>
                              <span className={`text-sm font-medium ${getPasswordStrength(newPassword).color}`}>
                                {getPasswordStrength(newPassword).label}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className={`h-1 flex-1 rounded-full ${
                                    i <= getPasswordStrength(newPassword).score
                                      ? getPasswordStrength(newPassword).color.replace('text-', 'bg-')
                                      : 'bg-border'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {Object.entries(validatePassword(newPassword).details).map(([key, value]) => (
                                <div key={key} className={`flex items-center gap-1 ${value ? 'text-status-success' : 'text-text-tertiary'}`}>
                                  {value ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                                  <span>
                                    {key === 'minLength' && '至少8位'}
                                    {key === 'uppercase' && '大写字母'}
                                    {key === 'lowercase' && '小写字母'}
                                    {key === 'number' && '数字'}
                                    {key === 'special' && '特殊字符'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">确认新密码</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="请再次输入新密码"
                          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                        {confirmPassword && newPassword && (
                          <div className="mt-1 flex items-center gap-1 text-xs">
                            {newPassword === confirmPassword ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-status-success" />
                                <span className="text-status-success">密码匹配</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-status-failed" />
                                <span className="text-status-failed">密码不匹配</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {passwordError && (
                        <p className="text-sm text-status-failed flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {passwordError}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        {passwordStatus === 'saving' && (
                          <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
                        )}
                        {passwordStatus === 'saved' && (
                          <p className="text-sm text-status-success flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            密码修改成功
                          </p>
                        )}
                        <button
                          onClick={handlePasswordChange}
                          disabled={passwordStatus === 'saving'}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {passwordStatus === 'saving' && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          修改密码
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                      <div>
                        <h4 className="font-medium text-text-primary">{t('settings.language')}</h4>
                        <p className="text-sm text-text-secondary">
                          {t('settings.languageDesc')}
                        </p>
                      </div>
                      <select
                        value={i18n.language}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        className="px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary text-sm"
                      >
                        <option value="zh-CN">中文</option>
                        <option value="en">English</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                      <div>
                        <h4 className="font-medium text-text-primary">{t('settings.theme')}</h4>
                        <p className="text-sm text-text-secondary">
                          {t('settings.themeDesc')}
                        </p>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface/80 transition-colors"
                      >
                        {theme === 'dark' ? (
                          <Moon className="w-5 h-5" />
                        ) : (
                          <Sun className="w-5 h-5" />
                        )}
                        <span className="text-sm text-text-primary">
                          {theme === 'dark' ? '深色主题' : '浅色主题'}
                        </span>
                      </button>
                    </div>

                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-2">CORS配置</h4>
                      <p className="text-sm text-text-secondary mb-3">
                        允许的前端域名
                      </p>
                      <input
                        type="text"
                        defaultValue="http://localhost:3000"
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 社区 & 微信群 */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="relative p-6">
            {/* 微信名片 — 右上角 */}
            <div className="absolute top-10 right-5 flex flex-col items-center z-10">
              <img
                src="/wechaterweima.png"
                alt="微信公众号名片"
                className="rounded-md"
                style={{ width: '560px', height: 'auto', objectFit: 'contain' }}
              />
              <span className="text-sm text-text-muted mt-4 text-center leading-tight">
                扫码关注公众号，加入项目交流群
              </span>
            </div>

            {/* 标题 + 简介 — 避开右侧名片 */}
            <h3 className="text-lg font-semibold text-text-primary mb-1 pr-[600px]">加入社区</h3>
            <p className="text-sm text-text-secondary mb-4 pr-[600px]">
              因兴趣和热爱相聚，一起打造好用的开源 AI 运维平台
            </p>

            {/* 上方简短信息 — 避开右侧名片 */}
            <div className="text-sm text-text-secondary leading-relaxed space-y-2 mb-4 pr-[600px]">
              <p>
                👋 欢迎加入{' '}
                <span className="text-text-primary font-medium">ITOps Agent Platform</span>{' '}
                项目群，最新代码在{' '}
                <code className="bg-bg-muted px-1.5 py-0.5 rounded text-xs font-mono">dev</code>{' '}
                分支。
              </p>
              <div className="space-y-1">
                <p>
                  ✨ 在线演示：
                  <a href="https://agentdemo-0mwug01t6.maozi.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    agentdemo-0mwug01t6.maozi.io
                  </a>
                </p>
                <p>
                  📚 文档手册：
                  <a href="https://aiopsdoc-0mwug01t6.maozi.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    aiopsdoc-0mwug01t6.maozi.io
                  </a>
                </p>
              </div>
            </div>

            {/* 下方长内容 — 避开右侧名片 */}
            <div className="text-sm text-text-secondary leading-relaxed space-y-3 pr-[600px]">
              <div>
                <p className="text-text-primary font-medium mb-1">💡 开发初心</p>
                <p>
                  开发这个项目的初心不是为了利益，是为了解放运维。趁着 AI
                  的东风，真正把 AI
                  和运维的场景落地，帮大家从繁琐、重复、无意义的工作里解放出来。做一个真正好用、能解决实际问题的免费开源平台，让大家可以多陪陪家人，多做点自己真正喜欢的事。
                </p>
                <p className="mt-2 text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️
                  注意：不允许闭源二次开发、打包销售、SaaS
                  化运营等商业用途，承诺永久开源！
                </p>
              </div>

              <div className="space-y-1">
                <p>💡 所有想法、建议、需求、Bug，统一到这里提：</p>
                <p>
                  <a href="https://github.com/qinshihu/itops-agent-platform/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    github.com/qinshihu/itops-agent-platform/issues
                  </a>
                </p>
              </div>

              <div className="space-y-1 text-text-muted">
                <p>
                  • 所有二开请基于最新{' '}
                  <code className="bg-bg-muted px-1 py-0.5 rounded text-xs font-mono">dev</code>{' '}
                  分支开发，统一接口与界面风格
                </p>
                <p>• 所有需求、bug、建议统一提在 GitHub Issues，群内只做讨论</p>
                <p>• 提交代码：Fork 仓库 → 开发 → 提 PR</p>
              </div>

              <p className="text-text-muted italic">
                每行代码、每个反馈、每条建议，都在让这个项目变得更好。我们素未谋面，却能凭着兴趣热爱共同的想法一起创造有价值有意义的东西。学习成长，做好一件事，期待每一位同行的参与！
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
