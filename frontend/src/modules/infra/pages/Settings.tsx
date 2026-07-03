/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Database, Shield, Loader2, CheckCircle2, AlertCircle, BookOpen, Upload, FileText, Globe, Wifi, Brain } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';
import ModelSettings from './settings/ModelSettings';
import NotificationSettings from '../../notification/pages/NotificationSettings';
import BackupSettings from '../../backup/pages/BackupSettings';
import SecuritySettings from './settings/SecuritySettings';
import GeneralSettings from './settings/GeneralSettings';

export default function Settings() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('models');
  const queryClient = useQueryClient();

  // 如果是强制修改密码，自动切换到安全设置标签
  useEffect(() => {
    if (searchParams.get('changePassword') === 'true') {
      setActiveTab('security');
    }
  }, [searchParams]);

  // ========== QAnything 配置（保留在主入口） ==========

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

  useQuery({
    queryKey: ['qanythingConfig'],
    queryFn: async () => {
      const res = await api.get('/api/knowledge/qanything/config');
      if (res.data.data) {
        const backendData = res.data.data;
        if (backendData.apiKey?.includes('****')) {
          backendData.apiKey = qanythingConfig.apiKey;
        }
        setQanythingConfig(backendData);
      }
      return res.data.data;
    },
  });

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

  // ========== Tab 定义 ==========

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
              {/* ========== AI 模型配置 ========== */}
              {activeTab === 'models' && <ModelSettings />}

              {/* ========== QAnything 知识库 ========== */}
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

              {/* ========== 通知配置 ========== */}
              {activeTab === 'notifications' && <NotificationSettings />}

              {/* ========== 数据库/备份 ========== */}
              {activeTab === 'database' && <BackupSettings />}

              {/* ========== 安全设置 + 通用设置 ========== */}
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

                  <SecuritySettings />
                  <GeneralSettings />
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
