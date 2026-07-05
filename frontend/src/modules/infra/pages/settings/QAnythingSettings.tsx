import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Globe, Loader2, CheckCircle2, AlertCircle, Upload, FileText, Wifi,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '../../../../lib/errorHandler';

interface QAnythingConfig {
  enabled: boolean;
  apiBase: string;
  apiKey: string;
  kbId: string;
  mode: 'cloud' | 'local';
  topK: number;
}

const initialConfig: QAnythingConfig = {
  enabled: false,
  apiBase: '',
  apiKey: '',
  kbId: '',
  mode: 'cloud',
  topK: 5,
};

/**
 * QAnything 知识库配置页面
 *
 * 包含：
 *   - 连接配置（启用开关、模式、API 地址、密钥、知识库 ID、检索数量）
 *   - 测试连接
 *   - 文档上传（拖拽 + 选择文件）
 */
export default function QAnythingSettings() {
  const queryClient = useQueryClient();

  // ── 配置状态 ──
  const [config, setConfig] = useState<QAnythingConfig>(initialConfig);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // ── 上传状态 ──
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // ── 加载现有配置 ──
  useQuery({
    queryKey: ['qanythingConfig'],
    queryFn: async () => {
      const res = await api.get('/knowledge/qanything/config');
      if (res.data.data) {
        const backendData = res.data.data;
        // 保留已有的 API Key（后端脱敏返回 ****）
        if (backendData.apiKey?.includes('****')) {
          backendData.apiKey = config.apiKey;
        }
        setConfig(backendData);
      }
      return res.data.data;
    },
  });

  // ── Mutations ──
  const configMutation = useMutation({
    mutationFn: async (payload: QAnythingConfig) => {
      const res = await api.post('/knowledge/qanything/config', payload);
      return res.data;
    },
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qanythingConfig'] });
      setSaveStatus('saved');
      setTestMessage('配置已保存');
      setTestStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setTimeout(() => setTestStatus('idle'), 3000);
    },
    onError: (err: unknown) => {
      setSaveStatus('error');
      setTestMessage(getAxiosErrorMessage(err, '保存失败'));
      setTestStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      setTimeout(() => setTestStatus('idle'), 5000);
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/knowledge/qanything/test');
      return res.data;
    },
    onMutate: () => {
      setTestStatus('testing');
      setTestMessage('');
    },
    onSuccess: (data) => {
      setTestStatus(data.success ? 'success' : 'error');
      setTestMessage(data.message);
    },
    onError: (err: unknown) => {
      setTestStatus('error');
      setTestMessage(getAxiosErrorMessage(err, '连接失败'));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const res = await api.post('/knowledge/qanything/upload-batch', formData, {
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
    onError: (err: unknown) => {
      setUploadStatus('error');
      setUploadMessage(getAxiosErrorMessage(err, '上传失败'));
      setTimeout(() => setUploadStatus('idle'), 5000);
    },
  });

  // ── 业务处理 ──
  const handleTest = () => {
    if (!config.apiBase.trim()) {
      setTestStatus('error');
      setTestMessage('请先填写 API 地址');
      setTimeout(() => setTestStatus('idle'), 3000);
      return;
    }
    testMutation.mutate();
  };

  const handleUpload = () => {
    if (!config.enabled) {
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

  const handleSave = () => {
    if (config.enabled) {
      if (!config.apiBase.trim()) {
        setSaveStatus('error');
        setTestMessage('API 地址不能为空');
        setTestStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        setTimeout(() => setTestStatus('idle'), 3000);
        return;
      }
      if (!config.kbId.trim()) {
        setSaveStatus('error');
        setTestMessage('知识库 ID 不能为空');
        setTestStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        setTimeout(() => setTestStatus('idle'), 3000);
        return;
      }
      if (config.mode === 'cloud' && !config.apiKey.trim()) {
        setSaveStatus('error');
        setTestMessage('API Key 不能为空');
        setTestStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        setTimeout(() => setTestStatus('idle'), 3000);
        return;
      }
    }
    configMutation.mutate(config);
  };

  // ── 拖拽处理 ──
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          知识库配置 (QAnything)
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          对接 QAnything 知识库，支持 PDF/Word/Excel 等多种格式文档上传，自动解析并用于 Agent 检索增强。
        </p>
      </div>

      {/* 连接配置 */}
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
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          {/* 部署模式 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">部署模式</label>
            <div className="flex gap-3">
              <button
                onClick={() => setConfig({ ...config, mode: 'cloud' })}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  config.mode === 'cloud'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-secondary border-border hover:border-primary/50'
                )}
              >️ 云端 API</button>
              <button
                onClick={() => setConfig({ ...config, mode: 'local' })}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  config.mode === 'local'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-secondary border-border hover:border-primary/50'
                )}
              >本地部署</button>
            </div>
            <p className="text-xs text-text-secondary mt-2">
              {config.mode === 'cloud'
                ? '使用网易有道云端 QAnything API，需外网访问'
                : '本地 Docker 部署，数据不出服务器，更安全'}
            </p>
          </div>

          {/* API 地址 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">API 地址</label>
            <input
              type="text"
              placeholder={config.mode === 'cloud' ? 'https://openapi.youdao.com/q_anything/api' : 'http://localhost:8777'}
              value={config.apiBase}
              onChange={(e) => setConfig({ ...config, apiBase: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-text-secondary mt-1">
              {config.mode === 'cloud'
                ? '云端 API 地址: https://openapi.youdao.com/q_anything/api'
                : '本地部署默认地址: http://localhost:8777'}
            </p>
          </div>

          {/* API 密钥 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {config.mode === 'cloud' ? '管理秘钥' : 'API Key'}
            </label>
            <input
              type="password"
              placeholder={config.mode === 'cloud' ? '从 QAnything 管理后台获取' : '本地部署通常不需要'}
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* 知识库 ID */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">知识库 ID</label>
            <input
              type="text"
              placeholder="KBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_xxxxxx"
              value={config.kbId}
              onChange={(e) => setConfig({ ...config, kbId: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-text-secondary mt-1">在 QAnything 管理后台创建知识库后获取 ID</p>
          </div>

          {/* 检索数量 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">每次检索返回的片段数</label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.topK}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 5;
                setConfig({ ...config, topK: Math.max(1, Math.min(20, val)) });
              }}
              className="w-32 px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-text-secondary ml-2">默认 5，范围 1-20</span>
          </div>

          {/* 测试连接 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {testStatus === 'testing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              测试连接
            </button>
            {testStatus === 'success' && (
              <span className="text-sm text-status-success flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />{testMessage}
              </span>
            )}
            {testStatus === 'error' && (
              <span className="text-sm text-status-failed flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />{testMessage}
              </span>
            )}
          </div>

          {/* 保存配置 */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />}
              {saveStatus === 'saved' && (
                <p className="text-xs text-status-success flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />已保存
                </p>
              )}
              {saveStatus === 'error' && (
                <p className="text-xs text-status-failed flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />保存失败
                </p>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
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
            >选择文件</label>
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
                      <span className="text-xs text-text-secondary">{formatFileSize(file.size)}</span>
                      <button
                        onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== index))}
                        className="text-xs text-status-failed hover:text-status-failed/80 transition-colors"
                      >移除</button>
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
            onClick={handleUpload}
            disabled={!config.enabled || uploadFiles.length === 0 || uploadStatus === 'uploading'}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadStatus === 'uploading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />上传中...</>
            ) : (
              <><Upload className="w-4 h-4" />上传到知识库</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}