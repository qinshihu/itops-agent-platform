import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, Key, CheckCircle2, X, Copy, Eye, EyeOff,
  Shield, Fingerprint, Info, Search, Server, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface SSHKey {
  id: string;
  name: string;
  key_type: string;
  fingerprint: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

interface UsageServer {
  id: string;
  name: string;
  hostname: string;
}

export default function SSHKeys() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<SSHKey | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    private_key: '',
    description: '',
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<SSHKey | null>(null);
  const [usageServers, setUsageServers] = useState<UsageServer[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: sshKeys, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: async () => {
      const res = await api.get('/api/ssh-keys');
      return res.data.data as SSHKey[];
    },
  });

  const { data: fullKeyData } = useQuery({
    queryKey: ['ssh-key', expandedKey],
    queryFn: async () => {
      if (!expandedKey) return null;
      const res = await api.get(`/api/ssh-keys/${expandedKey}`);
      return res.data.data as SSHKey & { private_key: string };
    },
    enabled: !!expandedKey,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.post('/api/ssh-keys', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      resetForm();
      setIsModalOpen(false);
      toast.success('SSH 密钥已添加');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await api.put(`/api/ssh-keys/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      resetForm();
      setIsModalOpen(false);
      setSelectedKey(null);
      toast.success('SSH 密钥已更新');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/ssh-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setDeleteConfirmKey(null);
      toast.success('SSH 密钥已删除');
    },
    onError: () => {
      setDeleteConfirmKey(null);
    },
  });

  const resetForm = () => {
    setFormData({ name: '', private_key: '', description: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKey) {
      const data: Partial<typeof formData> = {
        name: formData.name,
        description: formData.description,
      };
      if (formData.private_key) {
        data.private_key = formData.private_key;
      }
      updateMutation.mutate({ id: selectedKey.id, data });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (key: SSHKey) => {
    setSelectedKey(key);
    setFormData({ name: key.name, private_key: '', description: key.description || '' });
    setIsModalOpen(true);
  };

  const handleCopyFingerprint = (fingerprint: string) => {
    navigator.clipboard.writeText(fingerprint);
    toast.success('指纹已复制到剪贴板');
  };

  const handleCopyKey = () => {
    if (fullKeyData?.private_key) {
      navigator.clipboard.writeText(fullKeyData.private_key);
      toast.success('私钥已复制到剪贴板');
    }
  };

  const handleViewUsage = async (key: SSHKey) => {
    setUsageLoading(true);
    setUsageServers(null);
    try {
      const res = await api.get(`/api/ssh-keys/${key.id}/usage`);
      setUsageServers(res.data.data.servers);
    } catch {
      toast.error('获取使用情况失败');
    }
    setUsageLoading(false);
  };

  const filteredKeys = Array.isArray(sshKeys) ? sshKeys.filter((key) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      key.name.toLowerCase().includes(q) ||
      (key.description || '').toLowerCase().includes(q) ||
      (key.fingerprint || '').toLowerCase().includes(q) ||
      key.key_type.toLowerCase().includes(q)
    );
  }) : [];

  const getKeyTypeText = (type: string) => {
    const map: Record<string, string> = {
      openssh: 'OpenSSH',
      rsa: 'RSA',
      ec: 'EC',
      dsa: 'DSA',
      pkcs8: 'PKCS#8',
      unknown: '未知',
    };
    return map[type] || type;
  };

  const getKeyTypeColor = (type: string) => {
    const map: Record<string, string> = {
      openssh: 'text-emerald-500 bg-emerald-500/10',
      rsa: 'text-blue-500 bg-blue-500/10',
      ec: 'text-purple-500 bg-purple-500/10',
      dsa: 'text-yellow-500 bg-yellow-500/10',
      pkcs8: 'text-cyan-500 bg-cyan-500/10',
      unknown: 'text-text-secondary bg-background',
    };
    return map[type] || map.unknown;
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">SSH 密钥管理</h1>
            <p className="text-text-secondary">统一管理服务器 SSH 认证私钥，添加服务器时可直接选择使用</p>
          </div>
          <button
            onClick={() => { resetForm(); setSelectedKey(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加 SSH 密钥
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary mb-1">安全说明</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 flex-shrink-0 text-status-success" />
                  <span><strong>AES 加密存储</strong>：所有私钥在数据库中加密存储</span>
                </div>
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 flex-shrink-0 text-status-warning" />
                  <span><strong>指纹标识</strong>：自动生成 SHA256 指纹便于识别</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 text-status-failed" />
                  <span><strong>按需解密</strong>：连接服务器时自动解密私钥</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索密钥名称、描述、指纹..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
          />
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-border" />
                  <div className="flex-1">
                    <div className="h-4 bg-border rounded w-1/4 mb-2" />
                    <div className="h-3 bg-border rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
              <Key className="w-14 h-14 mb-4 opacity-40" />
              <p className="text-lg mb-1">{searchQuery ? '未找到匹配的 SSH 密钥' : '暂无 SSH 密钥'}</p>
              <p className="text-sm mb-4">{searchQuery ? '请调整搜索关键词' : '添加您的第一个 SSH 私钥，后续添加服务器时可直接选择使用'}</p>
              {!searchQuery && (
                <button
                  onClick={() => { resetForm(); setSelectedKey(null); setIsModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加第一个 SSH 密钥
                </button>
              )}
            </div>
          ) : (
            filteredKeys.map((key) => (
              <div
                key={key.id}
                className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <Key className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <h3 className="text-base font-semibold text-text-primary truncate">{key.name}</h3>
                        <span className={clsx('px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0', getKeyTypeColor(key.key_type))}>
                          {getKeyTypeText(key.key_type)}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary flex-shrink-0">
                          <Server className="w-3 h-3" />
                          {key.usage_count} 台服务器
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {key.usage_count > 0 && (
                          <button
                            onClick={() => handleViewUsage(key)}
                            className="p-1.5 hover:bg-background rounded-lg transition-colors"
                            title="查看使用该密钥的服务器"
                          >
                            <Server className="w-4 h-4 text-text-secondary" />
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedKey(expandedKey === key.id ? null : key.id)}
                          className="p-1.5 hover:bg-background rounded-lg transition-colors"
                          title="查看私钥"
                        >
                          {expandedKey === key.id ? (
                            <EyeOff className="w-4 h-4 text-text-secondary" />
                          ) : (
                            <Eye className="w-4 h-4 text-text-secondary" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(key)}
                          className="p-1.5 hover:bg-background rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-text-secondary" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmKey(key)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {key.description && (
                      <p className="text-sm text-text-secondary mb-2">{key.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-text-tertiary">
                      {key.fingerprint && (
                        <div className="flex items-center gap-1.5">
                          <Fingerprint className="w-3 h-3" />
                          <code className="font-mono">{key.fingerprint}</code>
                          <button
                            onClick={() => handleCopyFingerprint(key.fingerprint!)}
                            className="p-0.5 hover:text-text-primary transition-colors"
                            title="复制指纹"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span>创建于 {new Date(key.created_at).toLocaleDateString()}</span>
                    </div>

                    {expandedKey === key.id && fullKeyData && (
                      <div className="mt-4 p-4 bg-black/60 border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-text-tertiary">私钥内容</span>
                          <button
                            onClick={handleCopyKey}
                            className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            复制私钥
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                          {fullKeyData.private_key}
                        </pre>
                      </div>
                    )}

                    {usageServers !== null && (
                      <div className="mt-4 p-4 bg-background/50 border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-text-primary">使用该密钥的服务器（{usageServers.length} 台）</span>
                          <button onClick={() => setUsageServers(null)} className="p-0.5 hover:bg-surface rounded transition-colors">
                            <X className="w-3.5 h-3.5 text-text-tertiary" />
                          </button>
                        </div>
                        {usageLoading ? (
                          <p className="text-xs text-text-tertiary animate-pulse">加载中...</p>
                        ) : usageServers.length === 0 ? (
                          <p className="text-xs text-text-tertiary">无关联服务器</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {usageServers.map((srv) => (
                              <div key={srv.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface/50 rounded-lg text-xs">
                                <Server className="w-3 h-3 text-primary flex-shrink-0" />
                                <span className="text-text-primary truncate font-medium">{srv.name}</span>
                                <span className="text-text-tertiary truncate">{srv.hostname}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-text-primary mb-6">
              {selectedKey ? '编辑 SSH 密钥' : '添加 SSH 密钥'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">密钥名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: production-key, deploy-key"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  私钥 {selectedKey && '（留空则不修改）'}
                </label>
                <textarea
                  value={formData.private_key}
                  onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                  placeholder={selectedKey ? '留空以保持当前私钥不变' : '粘贴您的 SSH 私钥内容...'}
                  rows={8}
                  className="w-full px-4 py-2 bg-black/60 border border-border rounded-lg focus:outline-none focus:border-primary font-mono text-sm text-green-400 resize-none"
                  required={!selectedKey}
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  支持 OpenSSH、RSA、EC、DSA 等格式的私钥
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="密钥用途说明..."
                  rows={2}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); setSelectedKey(null); }}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedKey ? '保存更改' : '添加密钥'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmKey && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
            </div>
            <div className="text-sm text-text-secondary mb-4">
              <p>确定要删除密钥 <strong className="text-text-primary">{deleteConfirmKey.name}</strong> 吗？</p>
              {deleteConfirmKey.usage_count > 0 && (
                <p className="mt-2 text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  该密钥正被 <strong>{deleteConfirmKey.usage_count}</strong> 台服务器使用，无法删除
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmKey(null)}
                className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmKey.id)}
                disabled={deleteConfirmKey.usage_count > 0}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2',
                  deleteConfirmKey.usage_count > 0
                    ? 'bg-red-500/20 text-red-400/50 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                )}
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
