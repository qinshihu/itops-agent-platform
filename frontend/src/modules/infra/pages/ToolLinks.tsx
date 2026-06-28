import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ExternalLink, Globe, Cog, Plus, Search, Copy, X, CheckCircle2,
  ArrowUp, ArrowDown, AlertTriangle, Wrench, Monitor, Activity, Shield,
  BarChart3, LineChart, Bell, Database, Terminal, Cloud, Lock, Radio,
  Server, Layers, BookOpen, MessageSquare, Clock, MapPin, GitBranch,
  Play, Zap, Users, Network, Key, FileSearch, FileText, FileCode,
  Image, Upload, XCircle, Edit, Trash2, Settings,
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
}

const iconMap: Record<string, any> = {
  ExternalLink, Globe, Cog, Plus, Search, Edit, Copy,
  Wrench, Monitor, Activity, Shield, FileSearch, BarChart3,
  LineChart, Bell, AlertTriangle, Database, Terminal,
  Cloud, Lock, Radio, Server, Layers, BookOpen, MessageSquare,
  Clock, Map, MapPin, GitBranch, Play, Zap, Users, Network, Key,
};

function ToolIcon({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = iconMap[iconName] || ExternalLink;
  return <Icon className={className || 'w-5 h-5'} />;
}

export default function ToolLinks() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showManage, setShowManage] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ToolLink | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconMode, setIconMode] = useState<'lucide' | 'upload'>('lucide');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '', url: '', icon: 'ExternalLink', category: '未分类',
    description: '', sort_order: 0, is_external: true,
  });

  useEscapeKey({ onEscape: () => { setIsModalOpen(false); setSelectedTool(null); setShowIconPicker(false); }, enabled: isModalOpen });
  useEscapeKey({ onEscape: () => setDeleteConfirm(null), enabled: !!deleteConfirm });

  const { data: groupedData, isLoading } = useQuery({
    queryKey: ['tool-links', 'categories'],
    queryFn: async () => {
      const res = await api.get('/api/tool-links/categories');
      return res.data.data as Record<string, ToolLink[]>;
    },
  });

  const { data: allTools } = useQuery({
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
      toast.success(t('common.success'));
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || t('common.failed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      api.put(`/api/tool-links/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success(t('common.success'));
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || t('common.failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tool-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      setDeleteConfirm(null);
      toast.success(t('common.success'));
    },
    onError: () => setDeleteConfirm(null),
  });

  const uploadIconMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('icon', file);
      return api.post(`/api/tool-links/${id}/upload-icon`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      toast.success(t('common.success'));
    },
  });

  const deleteIconMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tool-links/${id}/icon`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      toast.success(t('common.success'));
    },
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
      name: tool.name, url: tool.url, icon: tool.icon, category: tool.category,
      description: tool.description || '', sort_order: tool.sort_order, is_external: tool.is_external === 1,
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

  const handleOpen = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  const handleCopyUrl = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(url).then(() => toast.success(t('toolLinks.copied')));
  };

  const moveOrder = (tool: ToolLink, direction: 'up' | 'down') => {
    if (!allTools) return;
    const sorted = [...allTools].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const idx = sorted.findIndex(t => t.id === tool.id);
    if (idx < 0) return;
    const neighbor = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!neighbor) return;
    updateMutation.mutate({ id: tool.id, data: { sort_order: neighbor.sort_order } });
    updateMutation.mutate({ id: neighbor.id, data: { sort_order: tool.sort_order } });
  };

  const filteredCategories = groupedData
    ? Object.entries(groupedData).reduce((acc, [category, tools]) => {
        const filtered = tools.filter(t => {
          if (!searchQuery) return true;
          const q = searchQuery.toLowerCase();
          return t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || category.toLowerCase().includes(q);
        });
        if (filtered.length > 0) acc[category] = filtered;
        return acc;
      }, {} as Record<string, ToolLink[]>)
    : {};

  const filteredAllTools = allTools
    ? allTools.filter(t => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || t.url.toLowerCase().includes(q);
      }).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('toolLinks.title')}</h1>
            <p className="text-sm text-text-secondary mt-1">{t('toolLinks.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {showManage && (
              <button
                onClick={() => setShowManage(false)}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors text-sm font-medium"
              >
                <Globe className="w-4 h-4" />
                浏览模式
              </button>
            )}
            <button
              onClick={() => setShowManage(!showManage)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium',
                showManage
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-surface border border-border text-text-primary hover:bg-background'
              )}
            >
              <Settings className="w-4 h-4" />
              工具管理
            </button>
            <button
              onClick={() => { closeModal(); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              添加工具
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('toolLinks.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary text-sm"
          />
        </div>

        {/* Card Grid Mode */}
        {!showManage && (
          isLoading ? (
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-6 w-32 bg-border rounded animate-pulse mb-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="bg-surface border border-border rounded-xl p-5 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-border" />
                          <div className="flex-1"><div className="h-4 bg-border rounded w-1/2 mb-2" /><div className="h-3 bg-border rounded w-3/4" /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(filteredCategories).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
              <Globe className="w-14 h-14 mb-4 opacity-30" />
              <p className="text-base mb-1">{searchQuery ? t('toolLinks.noMatch') : t('toolLinks.noTools')}</p>
              <p className="text-sm mb-6">{searchQuery ? t('toolLinks.noMatchHint') : ''}</p>
              {!searchQuery && (
                <button onClick={() => { closeModal(); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" />添加工具
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.keys(filteredCategories).map((category) => {
                const tools = filteredCategories[category];
                return (
                  <div key={category}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-800 border-slate-600 text-slate-300">{category}</div>
                      <div className="flex-1 h-px bg-border/50" />
                      <span className="text-xs text-text-tertiary">{tools.length} 个工具</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {tools.map((tool) => (
                        <div
                          key={tool.id}
                          className="group relative overflow-hidden rounded-xl border border-border bg-surface hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="relative p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 overflow-hidden border bg-slate-800/80 border-slate-700/30 group-hover:border-primary/30 transition-all">
                                {tool.image_icon ? (
                                  <img src={tool.image_icon} alt={tool.name} className="w-full h-full object-contain p-1" />
                                ) : (
                                  <ToolIcon iconName={tool.icon} className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-primary transition-colors">{tool.name}</h3>
                                {tool.description && (
                                  <p className="text-xs text-text-tertiary line-clamp-2 mt-1">{tool.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
                              <button onClick={() => handleOpen(tool.url)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                <ExternalLink className="w-3 h-3" />打开
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleEdit(tool); }} className="p-1.5 rounded-lg text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="编辑">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => handleCopyUrl(e, tool.url)} className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-slate-700/30 transition-colors" title={t('toolLinks.copyLink')}>
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Manage Table Mode */}
        {showManage && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-800/30">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">排序</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">名称</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">URL</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">分类</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllTools.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-text-secondary">
                    <div className="flex flex-col items-center gap-2"><Globe className="w-10 h-10 opacity-40" /><p>{searchQuery ? t('toolLinks.noMatch') : t('toolLinks.noTools')}</p></div>
                  </td></tr>
                ) : (
                  filteredAllTools.map((tool, index) => (
                    <tr key={tool.id} className="border-b border-border/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-text-tertiary w-5">{tool.sort_order}</span>
                          <button onClick={() => moveOrder(tool, 'up')} disabled={index === 0} className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                          <button onClick={() => moveOrder(tool, 'down')} disabled={index === filteredAllTools.length - 1} className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm font-medium text-text-primary">{tool.name}</span></td>
                      <td className="px-4 py-3"><span className="text-xs text-text-tertiary truncate max-w-[200px] block">{tool.url}</span></td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-text-primary">{tool.category}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"><ExternalLink className="w-4 h-4" /></a>
                          <button onClick={() => handleEdit(tool)} className="p-1.5 rounded-lg text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirm(tool)} className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {showManage && Array.isArray(allTools) && (
          <div className="text-xs text-text-tertiary">{allTools.length} 个工具, {new Set(allTools.map(t => t.category)).size} 个分类</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { if (!showIconPicker) closeModal(); }}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-primary">{selectedTool ? '编辑工具' : '添加工具'}</h3>
              <button onClick={closeModal} className="p-1 rounded-lg text-text-tertiary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">工具名称 *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Zabbix" className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">工具地址 *</label>
                <input type="url" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://zabbix.example.com" className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">图标</label>
                <div className="flex gap-1 mb-3">
                  <button type="button" onClick={() => setIconMode('lucide')} className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium', iconMode === 'lucide' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-text-tertiary hover:text-text-primary hover:bg-slate-700/30')}>Lucide 图标</button>
                  <button type="button" onClick={() => { setIconMode('upload'); setShowIconPicker(false); }} className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium', iconMode === 'upload' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-text-tertiary hover:text-text-primary hover:bg-slate-700/30')}>上传图片</button>
                </div>
                {iconMode === 'lucide' ? (
                  <div className="relative">
                    <button type="button" onClick={() => setShowIconPicker(!showIconPicker)} className="w-full flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-text-primary text-sm"><Cog className="w-4 h-4" /><span>{formData.icon}</span></button>
                    {showIconPicker && (
                      <div className="absolute top-full left-0 mt-1 w-72 max-h-48 overflow-y-auto bg-surface border border-border rounded-lg shadow-xl z-10 p-2 grid grid-cols-6 gap-1">
                        {ICON_OPTIONS.map(icon => (
                          <button key={icon} type="button" onClick={() => { setFormData({ ...formData, icon }); setShowIconPicker(false); }} className={clsx('p-2 rounded-lg text-xs flex flex-col items-center gap-1', formData.icon === icon ? 'bg-primary/20 text-primary border border-primary/30' : 'text-text-tertiary hover:bg-slate-700/30 hover:text-text-primary')}><Cog className="w-4 h-4" /><span className="truncate w-full text-center text-[9px]">{icon}</span></button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp,image/x-icon" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file || !selectedTool) return; setUploading(true); uploadIconMutation.mutate({ id: selectedTool.id, file }, { onSettled: () => setUploading(false) }); }} />
                    <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 px-4 py-6 bg-background border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                      {selectedTool?.image_icon ? (
                        <><img src={selectedTool.image_icon} alt="" className="w-14 h-14 object-contain rounded-lg" /><span className="text-xs text-text-tertiary">点击替换</span></>
                      ) : (
                        <><Upload className="w-8 h-8 text-text-tertiary" /><span className="text-xs text-text-tertiary">上传自定义图标</span><span className="text-[10px] text-text-tertiary">PNG/JPG/GIF/SVG, max 2MB</span></>
                      )}
                    </div>
                    {selectedTool?.image_icon && (
                      <button type="button" onClick={() => deleteIconMutation.mutate(selectedTool.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-2"><XCircle className="w-3 h-3" />移除图标</button>
                    )}
                    {!selectedTool && <p className="text-xs text-text-tertiary mt-1">先创建工具，再编辑上传图标</p>}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">分类</label>
                <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="监控系统" className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary" list="category-suggestions" />
                <datalist id="category-suggestions">
                  <option value="监控系统" /><option value="日志系统" /><option value="堡垒机" />
                  <option value="告警系统" /><option value="自动化" /><option value="数据库" />
                  <option value="网络" /><option value="CI/CD" /><option value="安全" />
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">描述</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="工具描述" className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">排序</label>
                  <input type="number" min={0} value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.is_external} onChange={e => setFormData({ ...formData, is_external: e.target.checked })} className="rounded border-border bg-background text-primary focus:ring-primary" />
                    <span className="text-sm text-text-primary flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />外部链接</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors">取消</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
              <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
            </div>
            <p className="text-sm text-text-secondary mb-2">确定要删除此工具链接吗？此操作不可撤销。</p>
            <p className="text-xs text-text-tertiary mb-6"><strong className="text-text-primary">{deleteConfirm.name}</strong></p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors">取消</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm.id)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
