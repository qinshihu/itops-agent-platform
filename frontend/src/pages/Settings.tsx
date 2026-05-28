import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Bell, Database, Shield, Loader2, CheckCircle2, AlertCircle, Sun, Moon, Lock, BookOpen, Upload, FileText, Globe, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { validatePassword, getPasswordStrength } from '../utils/passwordValidator';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('api');
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { user, login, updateUser } = useAuth();
  const navigate = useNavigate();
  
  // 密码修改状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState('');
  
  // API密钥本地状态
  const [doubaoApiKey, setDoubaoApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [doubaoModel, setDoubaoModel] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [doubaoApiBase, setDoubaoApiBase] = useState('');
  const [openaiApiBase, setOpenaiApiBase] = useState('');
  const [localAiModel, setLocalAiModel] = useState('qwen2.5:7b');
  const [localAiApiBase, setLocalAiApiBase] = useState('http://host.docker.internal:11434/v1');
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // 通知配置本地状态
  const [notificationConfig, setNotificationConfig] = useState({
    webhook_enabled: true,
    email_enabled: false,
    wechat_enabled: false,
    dingtalk_enabled: false,
    email_config: {},
    wechat_config: {},
    dingtalk_config: {},
    alert_notification: {
      critical: true,
      warning: true,
      info: false
    },
    task_notification: {
      success: true,
      failed: true,
      running: false
    }
  });

  // QAnything 配置查询
  useQuery({
    queryKey: ['qanythingConfig'],
    queryFn: async () => {
      const res = await api.get('/api/knowledge/qanything/config');
      if (res.data.data) {
        // 保留前端已有的真实 apiKey，防止被后端脱敏值覆盖
        const backendData = res.data.data;
        if (backendData.apiKey && backendData.apiKey.includes('****')) {
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
      setQanythingTestMessage(err.response?.data?.message || '连接失败');
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
  const [notificationSaveStatus, setNotificationSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
        setPasswordError(response.data.message || '密码修改失败');
        setPasswordStatus('error');
        setTimeout(() => setPasswordStatus('idle'), 3000);
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || '密码修改失败');
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
    }
  };

  const { data: apiKeyStatus } = useQuery({
    queryKey: ['apiKeyStatus'],
    queryFn: async () => {
      const res = await api.get('/api/settings/api-keys');
      if (res.data.data?.doubao?.masked) {
        setDoubaoApiKey('masked');
      }
      if (res.data.data?.openai?.masked) {
        setOpenaiApiKey('masked');
      }
      if (res.data.data?.doubao?.model) {
        setDoubaoModel(res.data.data.doubao.model);
      }
      if (res.data.data?.openai?.model) {
        setOpenaiModel(res.data.data.openai.model);
      }
      if (res.data.data?.doubao?.apiBase) {
        setDoubaoApiBase(res.data.data.doubao.apiBase);
      }
      if (res.data.data?.openai?.apiBase) {
        setOpenaiApiBase(res.data.data.openai.apiBase);
      }
      if (res.data.data?.localAi?.model) {
        setLocalAiModel(res.data.data.localAi.model);
      }
      if (res.data.data?.localAi?.apiBase) {
        setLocalAiApiBase(res.data.data.localAi.apiBase);
      }
      return res.data.data;
    },
  });

  const apiKeysMutation = useMutation({
    mutationFn: async ({ 
      doubaoApiKey, openaiApiKey, doubaoModel, openaiModel, doubaoApiBase, openaiApiBase, localAiModel, localAiApiBase
    }: { 
      doubaoApiKey?: string; openaiApiKey?: string; doubaoModel?: string; openaiModel?: string;
      doubaoApiBase?: string; openaiApiBase?: string;
      localAiModel?: string; localAiApiBase?: string;
    }) => {
      const res = await api.put('/api/settings/api-keys', { 
        doubaoApiKey, openaiApiKey, doubaoModel, openaiModel, doubaoApiBase, openaiApiBase, localAiModel, localAiApiBase
      });
      return res.data;
    },
    onMutate: () => {
      setApiKeySaveStatus('saving');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeyStatus'] });
      setApiKeySaveStatus('saved');
      setTimeout(() => setApiKeySaveStatus('idle'), 2000);
    },
    onError: () => {
      setApiKeySaveStatus('error');
      setTimeout(() => setApiKeySaveStatus('idle'), 3000);
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (provider: 'doubao' | 'openai' | 'local') => {
      const res = await api.delete(`/api/settings/api-keys/${provider}`);
      return res.data;
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeyStatus'] });
      // 重置对应提供商的本地状态
      if (provider === 'doubao') {
        setDoubaoApiKey('');
        setDoubaoModel('');
        setDoubaoApiBase('');
      }
      if (provider === 'openai') {
        setOpenaiApiKey('');
        setOpenaiModel('');
        setOpenaiApiBase('');
      }
      if (provider === 'local') {
        setLocalAiModel('qwen2.5:7b');
        setLocalAiApiBase('http://host.docker.internal:11434/v1');
      }
    },
  });

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

  const handleSaveApiKeys = () => {
    const payload: any = {};
    if (doubaoApiKey !== 'masked') {
      payload.doubaoApiKey = doubaoApiKey;
    }
    if (openaiApiKey !== 'masked') {
      payload.openaiApiKey = openaiApiKey;
    }
    payload.doubaoModel = doubaoModel;
    payload.openaiModel = openaiModel;
    payload.doubaoApiBase = doubaoApiBase;
    payload.openaiApiBase = openaiApiBase;
    payload.localAiModel = localAiModel;
    payload.localAiApiBase = localAiApiBase;
    
    apiKeysMutation.mutate(payload);
  };

  const tabs = [
    { id: 'api', name: 'AI 模型', icon: Key },
    { id: 'qanything', name: '知识库', icon: BookOpen },
    { id: 'notifications', name: '通知设置', icon: Bell },
    { id: 'database', name: '数据库', icon: Database },
    { id: 'security', name: '安全设置', icon: Shield },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">设置</h1>
          <p className="text-text-secondary">配置系统参数和API密钥</p>
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
              {activeTab === 'api' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      API密钥配置
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">
                      配置AI服务的API密钥。所有密钥仅存储在后端，不暴露到前端。
                    </p>
                  </div>

                  {/* 已配置模型列表 */}
                  {(apiKeyStatus?.doubao?.configured || apiKeyStatus?.openai?.configured || apiKeyStatus?.localAi?.configured) && (
                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-3">已配置的模型</h4>
                      <div className="space-y-2">
                        {apiKeyStatus?.doubao?.configured && (
                          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-text-primary">豆包 ({apiKeyStatus.doubao.model})</p>
                              <p className="text-xs text-text-secondary">密钥: {apiKeyStatus.doubao.masked}</p>
                            </div>
                            <button
                              onClick={() => deleteModelMutation.mutate('doubao')}
                              disabled={deleteModelMutation.isPending}
                              className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-all"
                            >
                              {deleteModelMutation.isPending ? '删除中...' : '删除'}
                            </button>
                          </div>
                        )}
                        {apiKeyStatus?.openai?.configured && (
                          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-text-primary">OpenAI ({apiKeyStatus.openai.model})</p>
                              <p className="text-xs text-text-secondary">密钥: {apiKeyStatus.openai.masked}</p>
                            </div>
                            <button
                              onClick={() => deleteModelMutation.mutate('openai')}
                              disabled={deleteModelMutation.isPending}
                              className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-all"
                            >
                              {deleteModelMutation.isPending ? '删除中...' : '删除'}
                            </button>
                          </div>
                        )}
                        {apiKeyStatus?.localAi?.configured && (
                          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-text-primary">本地 AI ({apiKeyStatus.localAi.model})</p>
                              <p className="text-xs text-text-secondary">地址: {apiKeyStatus.localAi.apiBase}</p>
                            </div>
                            <button
                              onClick={() => deleteModelMutation.mutate('local')}
                              disabled={deleteModelMutation.isPending}
                              className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-all"
                            >
                              {deleteModelMutation.isPending ? '删除中...' : '删除'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="bg-background rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-text-primary">豆包 API</h4>
                        <span
                          className={clsx(
                            'px-2 py-1 rounded text-xs font-medium',
                            apiKeyStatus?.doubao?.configured
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-status-failed/10 text-status-failed'
                          )}
                        >
                          {apiKeyStatus?.doubao?.configured ? '已配置' : '未配置'}
                        </span>
                      </div>
                      {apiKeyStatus?.doubao?.configured && doubaoApiKey === 'masked' && (
                        <p className="text-sm text-text-secondary mb-3">
                          当前密钥: {apiKeyStatus.doubao.masked}
                        </p>
                      )}
                      <input
                        type="password"
                        placeholder="输入豆包 API 密钥"
                        value={doubaoApiKey === 'masked' ? '' : doubaoApiKey}
                        onChange={(e) => setDoubaoApiKey(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <input
                        type="text"
                        placeholder="输入模型 ID (默认: doubao-4o)"
                        value={doubaoModel}
                        onChange={(e) => setDoubaoModel(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <input
                        type="text"
                        placeholder="输入 API 地址 (默认: https://ark.cn-beijing.volces.com/api/v3)"
                        value={doubaoApiBase}
                        onChange={(e) => setDoubaoApiBase(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <p className="text-xs text-text-secondary">
                        输入您的豆包 API 密钥、模型 ID 和 API 地址
                      </p>
                    </div>

                    <div className="bg-background rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-text-primary">OpenAI API</h4>
                        <span
                          className={clsx(
                            'px-2 py-1 rounded text-xs font-medium',
                            apiKeyStatus?.openai?.configured
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-status-failed/10 text-status-failed'
                          )}
                        >
                          {apiKeyStatus?.openai?.configured ? '已配置' : '未配置'}
                        </span>
                      </div>
                      {apiKeyStatus?.openai?.configured && openaiApiKey === 'masked' && (
                        <p className="text-sm text-text-secondary mb-3">
                          当前密钥: {apiKeyStatus.openai.masked}
                        </p>
                      )}
                      <input
                        type="password"
                        placeholder="输入 OpenAI API 密钥"
                        value={openaiApiKey === 'masked' ? '' : openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <input
                        type="text"
                        placeholder="输入模型 ID (默认: gpt-4o)"
                        value={openaiModel}
                        onChange={(e) => setOpenaiModel(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <input
                        type="text"
                        placeholder="输入 API 地址 (默认: https://api.openai.com/v1)"
                        value={openaiApiBase}
                        onChange={(e) => setOpenaiApiBase(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <p className="text-xs text-text-secondary">
                        输入您的 OpenAI API 密钥、模型 ID 和 API 地址
                      </p>
                    </div>

                    {/* 本地 AI 大模型配置 */}
                    <div className="bg-background rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-text-primary">本地 AI 大模型</h4>
                        <span
                          className={clsx(
                            'px-2 py-1 rounded text-xs font-medium',
                            apiKeyStatus?.localAi?.configured
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-status-failed/10 text-status-failed'
                          )}
                        >
                          {apiKeyStatus?.localAi?.configured ? '已配置' : '未配置'}
                        </span>
                      </div>
                      {apiKeyStatus?.localAi?.configured && (
                        <p className="text-sm text-text-secondary mb-3">
                          当前地址: {apiKeyStatus.localAi.apiBase}
                        </p>
                      )}
                      <select
                        value={localAiModel}
                        onChange={(e) => setLocalAiModel(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      >
                        <option value="qwen2.5:7b">Qwen 2.5 7B</option>
                        <option value="qwen2.5:14b">Qwen 2.5 14B</option>
                        <option value="llama3.1:8b">Llama 3.1 8B</option>
                        <option value="llama3.1:70b">Llama 3.1 70B</option>
                        <option value="mistral:7b">Mistral 7B</option>
                        <option value="deepseek-coder:6.7b">DeepSeek Coder 6.7B</option>
                        <option value="gemma2:9b">Gemma 2 9B</option>
                        <option value="phi3:3.8b">Phi 3 3.8B</option>
                      </select>
                      <input
                        type="text"
                        placeholder="输入本地 AI API 地址 (默认: http://host.docker.internal:11434/v1)"
                        value={localAiApiBase}
                        onChange={(e) => setLocalAiApiBase(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary mb-3"
                      />
                      <p className="text-xs text-text-secondary">
                        支持 Ollama、LM Studio、vLLM 等 OpenAI 兼容 API。本地模型无需 API Key。
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {apiKeySaveStatus === 'saving' && (
                          <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
                        )}
                        {apiKeySaveStatus === 'saved' && (
                          <p className="text-xs text-status-success flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            已保存
                          </p>
                        )}
                        {apiKeySaveStatus === 'error' && (
                          <p className="text-xs text-status-failed flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            保存失败
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleSaveApiKeys}
                        disabled={apiKeySaveStatus === 'saving'}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {apiKeySaveStatus === 'saving' && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        保存配置
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                      配置告警通知和任务状态通知的方式
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-4">通知渠道</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">Webhook</p>
                            <p className="text-xs text-text-secondary">通过外部Webhook接收通知</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={notificationConfig.webhook_enabled}
                              onChange={(e) => setNotificationConfig({...notificationConfig, webhook_enabled: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">邮件</p>
                            <p className="text-xs text-text-secondary">通过邮件接收通知</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={notificationConfig.email_enabled}
                              onChange={(e) => setNotificationConfig({...notificationConfig, email_enabled: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">企业微信</p>
                            <p className="text-xs text-text-secondary">通过企业微信接收通知</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={notificationConfig.wechat_enabled}
                              onChange={(e) => setNotificationConfig({...notificationConfig, wechat_enabled: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">钉钉</p>
                            <p className="text-xs text-text-secondary">通过钉钉接收通知</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={notificationConfig.dingtalk_enabled}
                              onChange={(e) => setNotificationConfig({...notificationConfig, dingtalk_enabled: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-4">告警通知</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-text-secondary">严重告警</p>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
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
                          <p className="text-sm text-text-secondary">警告告警</p>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
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
                          <p className="text-sm text-text-secondary">信息通知</p>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
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

                    <div className="bg-background rounded-lg p-4">
                      <h4 className="font-medium text-text-primary mb-4">任务通知</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-text-secondary">任务成功</p>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
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
                            <input
                              type="checkbox"
                              className="sr-only peer"
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
                            <input
                              type="checkbox"
                              className="sr-only peer"
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
                      <h4 className="font-medium text-text-primary mb-2">数据备份</h4>
                      <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all">
                        创建备份
                      </button>
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
                        <h4 className="font-medium text-text-primary">主题设置</h4>
                        <p className="text-sm text-text-secondary">
                          选择深色或浅色主题
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

        {/* 微信公众号二维码 */}
        <div className="bg-surface rounded-xl p-6 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">关注我们</h3>
          <p className="text-sm text-text-secondary mb-4">扫码关注微信公众号，获取更多运维资讯</p>
          <div className="flex justify-center">
            <img
              src="/wechaterweima.png"
              alt="微信公众号二维码"
              className="max-w-full h-auto rounded-lg border border-border"
              style={{ maxHeight: '300px', objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
