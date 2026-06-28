import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, ExternalLink, Globe, Cog, Search, X, CheckCircle2,
  ArrowUp, ArrowDown, AlertTriangle, Wrench, Monitor, Activity, Shield,
  BarChart3, LineChart, Bell, Database, Terminal, Cloud, Lock, Radio,
  Server, Layers, BookOpen, MessageSquare, Clock, MapPin, GitBranch,
  Play, Zap, Users, Network, Key, FileSearch, FileText, FileCode,
  Eye, EyeOff, Image, Upload, XCircle, ArrowLeft,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

const ICON_OPTIONS = [
  'ExternalLink', 'Globe', 'Monitor', 'Activity', 'Shield', 'BarChart3',
  'LineChart', 'Bell', 'Database', 'Terminal', 'Cloud', 'Lock', 'Radio',
  'Server', 'Layers', 'BookOpen', 'MessageSquare', 'Clock', 'MapPin',
  'GitBranch', 'Play', 'Zap', 'Users', 'Network', 'Key', 'FileSearch',
  'FileText', 'FileCode', 'Wrench', 'Cog', 'Search', 'AlertTriangle',
];

interface ToolLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  image_icon: string | null;
  category: string;
  description: string | null;
  sort_order: number;
  is_external: number;
  created_at: string;
  updated_at: string;
}

export default function ToolLinksManage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ToolLink | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconMode, setIconMode] = useState<'lucide' | 'upload'>('lucide');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    icon: 'ExternalLink',
    category: '未分类',
    description: '',
    sort_order: 0,
    is_external: true,
  });

  useEscapeKey({ onEscape: () => { setIsModalOpen(false); setSelectedTool(null); setShowIconPicker(false); }, enabled: isModalOpen });
  useEscapeKey({ onEscape: () => setDeleteConfirm(null), enabled: !!deleteConfirm });

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tool-links'],
    queryFn: async () => {
      const res = await api.get('/api/tool-links');
      return res.data.data as ToolLink[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/api/tool-links', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success('工具链接已添加');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || '添加失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) => api.put(`/api/tool-links/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success('工具链接已更新');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || '更新失败');
    },
  });

  const uploadIconMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('icon', file);
      return api.post(`/api/tool-links/${id}/upload-icon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      toast.success('图标已上传');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || '图标上传失败');
    },
  });

  const deleteIconMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tool-links/${id}/icon`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      toast.success('图标已重置');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || '重置图标失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tool-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      setDeleteConfirm(null);
      toast.success('工具链接已删除');
    },
    onError: () => setDeleteConfirm(null),
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTool(null);
    setShowIconPicker(false);
    setFormData({ name: '', url: '', icon: 'ExternalLink', category: '未分类', description: '', sort_order: 0, is_external: true });
  };

  const handleEdit = (tool: ToolLink) => {
    setSelectedTool(tool);
    setFormData({
      name: tool.name,
      url: tool.url,
      icon: tool.icon,
      category: tool.category,
      description: tool.description || '',
      sort_order: tool.sort_order,
      is_external: tool.is_external === 1,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTool) {
      updateMutation.mutate({ id: selectedTool.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const moveOrder = (tool: ToolLink, direction: 'up' | 'down') => {
    if (!tools) return;
    const sorted = [...tools].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const idx = sorted.findIndex(t => t.id === tool.id);
    if (idx < 0) return;
    const neighbor = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!neighbor) return;
    // Swap sort_order
    const temp = tool.sort_order;
    updateMutation.mutate({ id: tool.id, data: { sort_order: neighbor.sort_order } });
    updateMutation.mutate({ id: neighbor.id, data: { sort_order: temp } });
  };

  const filteredTools = Array.isArray(tools)
    ? tools.filter(t => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          t.url.toLowerCase().includes(q)
        );
      }).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">工具链接配置</h1>
            <p className="text-text-secondary text-sm">管理运维工具导航链接，支持自定义名称、链接、图标和分类</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/tool-links')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-tertiary hover:text-text-primary hover:bg-slate-700/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <button
            onClick={() => { closeModal(); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加工具
          </button>
        </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索工具名称、分类、描述..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
          />
        </div>

        {/* Tool List */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">排序</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">名称</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">URL</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">分类</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">图标</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">描述</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-text-secondary">加载中...</td>
                </tr>
              ) : filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-text-secondary">
                    <div className="flex flex-col items-center gap-2">
                      <Globe className="w-10 h-10 opacity-40" />
                      <p>{searchQuery ? '未找到匹配的工具' : '暂无工具链接，点击"添加工具"开始配置'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool, index) => (
                  <tr key={tool.id} className="border-b border-border/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-text-tertiary w-5">{tool.sort_order}</span>
                        <button
                          onClick={() => moveOrder(tool, 'up')}
                          disabled={index === 0}
                          className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                          title="上移"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveOrder(tool, 'down')}
                          disabled={index === filteredTools.length - 1}
                          className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                          title="下移"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{tool.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-tertiary truncate max-w-[200px] block">{tool.url}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-text-primary">{tool.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {tool.image_icon ? (
                          <img src={tool.image_icon} alt="" className="w-6 h-6 object-contain rounded" />
                        ) : (
                          <span className="text-xs text-text-tertiary font-mono">{tool.icon}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-tertiary truncate max-w-[150px] block">
                        {tool.description || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                          title="打开"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleEdit(tool)}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(tool)}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && Array.isArray(tools) && (
          <div className="text-xs text-text-tertiary">
            共 {tools.length} 个工具链接，{new Set(tools.map(t => t.category)).size} 个分类
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { if (!showIconPicker) closeModal(); }}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-primary">
                {selectedTool ? '编辑工具链接' : '添加工具链接'}
              </h3>
              <button onClick={closeModal} className="p-1 rounded-lg text-text-tertiary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">工具名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: Zabbix"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">链接 URL *</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://zabbix.example.com"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  required
                />
              </div>

              {/* Icon Mode Tabs */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">图标</label>
                <div className="flex gap-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setIconMode('lucide')}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      iconMode === 'lucide'
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-slate-700/30'
                    )}
                  >
                    <Cog className="w-3.5 h-3.5" />
                    Lucide 图标
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIconMode('upload'); setShowIconPicker(false); }}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      iconMode === 'upload'
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-slate-700/30'
                    )}
                  >
                    <Image className="w-3.5 h-3.5" />
                    自定义图片
                  </button>
                </div>

                {iconMode === 'lucide' ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-text-primary text-sm hover:border-primary/50 transition-colors"
                    >
                      <Cog className="w-4 h-4" />
                      <span>{formData.icon}</span>
                    </button>
                    {showIconPicker && (
                      <div className="absolute top-full left-0 mt-1 w-72 max-h-48 overflow-y-auto bg-surface border border-border rounded-lg shadow-xl z-10 p-2 grid grid-cols-6 gap-1">
                        {ICON_OPTIONS.map(icon => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => { setFormData({ ...formData, icon }); setShowIconPicker(false); }}
                            className={clsx(
                              'p-2 rounded-lg text-xs transition-colors flex flex-col items-center gap-1',
                              formData.icon === icon
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'text-text-tertiary hover:bg-slate-700/30 hover:text-text-primary'
                            )}
                          >
                            <Cog className="w-4 h-4" />
                            <span className="truncate w-full text-center text-[9px]">{icon}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp,image/x-icon"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || !selectedTool) return;
                        setUploading(true);
                        uploadIconMutation.mutate(
                          { id: selectedTool.id, file },
                          { onSettled: () => setUploading(false) }
                        );
                      }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-6 bg-background border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      {selectedTool?.image_icon ? (
                        <>
                          <img
                            src={selectedTool.image_icon}
                            alt="当前图标"
                            className="w-14 h-14 object-contain rounded-lg"
                          />
                          <span className="text-xs text-text-tertiary">点击更换图片</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-text-tertiary" />
                          <span className="text-xs text-text-tertiary">上传自定义图标</span>
                          <span className="text-[10px] text-text-tertiary">支持 PNG/JPG/GIF/SVG，最大 2MB</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {selectedTool?.image_icon && (
                        <button
                          type="button"
                          onClick={() => deleteIconMutation.mutate(selectedTool.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          删除自定义图标
                        </button>
                      )}
                      {uploading && (
                        <span className="text-xs text-text-tertiary animate-pulse">上传中...</span>
                      )}
                    </div>
                    {!selectedTool && (
                      <p className="text-xs text-text-tertiary mt-1">请先创建工具，编辑时可上传自定义图标</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">分类</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="监控系统"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    <option value="监控系统" />
                    <option value="日志系统" />
                    <option value="堡垒机" />
                    <option value="告警系统" />
                    <option value="自动化" />
                    <option value="数据库" />
                    <option value="网络" />
                    <option value="CI/CD" />
                    <option value="安全" />
                  </datalist>
                </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="工具用途说明"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">排序权重</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  />
                  <p className="mt-1 text-[10px] text-text-tertiary">数字越小越靠前</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">打开方式</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_external}
                      onChange={e => setFormData({ ...formData, is_external: e.target.checked })}
                      className="rounded border-border bg-background text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-text-primary flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      新窗口打开
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedTool ? '保存更改' : '添加工具'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
            </div>
            <p className="text-sm text-text-secondary mb-2">
              确定要删除工具链接 <strong className="text-text-primary">{deleteConfirm.name}</strong> 吗？
            </p>
            <p className="text-xs text-text-tertiary mb-6">此操作不可撤销</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
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
