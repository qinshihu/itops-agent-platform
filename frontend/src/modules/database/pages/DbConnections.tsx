/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, Database, Search, X, Check, AlertTriangle,
  Server, RefreshCw, Shield, Eye, EyeOff
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  database: string;
  description?: string;
  tags?: string[];
  enabled: number;
  created_at: string;
  updated_at: string;
}

export default function DbConnections() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<DbConnection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    db_type: 'mysql',
    host: '',
    port: 3306,
    username: '',
    password: '',
    database: '',
    description: '',
    tags: '',
    enabled: true
  });

  useEscapeKey({ onEscape: () => { setIsModalOpen(false); setEditingConn(null); resetForm(); }, enabled: isModalOpen });
  useEscapeKey({ onEscape: () => { setShowDeleteConfirm(false); setPendingDelete(null); }, enabled: showDeleteConfirm });

  const { data: connections, isLoading } = useQuery({
    queryKey: ['db-connections'],
    queryFn: async () => {
      const res = await api.get('/api/db-connections');
      return res.data.data as DbConnection[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post('/api/db-connections', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-connections'] });
      toast.success('数据库连接创建成功');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || '创建失败');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await api.put(`/api/db-connections/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-connections'] });
      toast.success('数据库连接更新成功');
      setIsModalOpen(false);
      setEditingConn(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || '更新失败');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/db-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-connections'] });
      toast.success('数据库连接已删除');
      setShowDeleteConfirm(false);
      setPendingDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || '删除失败');
    }
  });

  const [isTestingConn, setIsTestingConn] = useState(false);

  const testConnectMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post('/api/db-connections/test-connect', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || '数据库连接成功');
      setIsTestingConn(false);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.response?.data?.error || '连接失败';
      toast.error(`连接失败: ${detail}`);
      setIsTestingConn(false);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      db_type: 'mysql',
      host: '',
      port: 3306,
      username: '',
      password: '',
      database: '',
      description: '',
      tags: '',
      enabled: true
    });
    setShowPassword(false);
  };

  const handleEdit = (conn: DbConnection) => {
    setEditingConn(conn);
    setFormData({
      name: conn.name,
      db_type: conn.db_type,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: '', // 不填充密码，留空表示不修改
      database: conn.database,
      description: conn.description || '',
      tags: conn.tags ? (typeof conn.tags === 'string' ? conn.tags : JSON.stringify(conn.tags)) : '',
      enabled: conn.enabled === 1
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      ...formData,
      port: Number(formData.port),
      enabled: formData.enabled,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    };
    if (editingConn) {
      if (!formData.password) delete payload.password; // 编辑时留空密码不传
      updateMutation.mutate({ id: editingConn.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setPendingDelete({ id, name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
  };

  const handleTestConnection = () => {
    if (editingConn) {
      // 编辑时测试已保存的连接
      setIsTestingConn(true);
      api.post(`/api/db-connections/${editingConn.id}/test`)
        .then((res) => {
          toast.success(res.data.message || '数据库连接成功');
          setIsTestingConn(false);
        })
        .catch((err) => {
          const detail = err?.response?.data?.detail || err?.response?.data?.error || '连接失败';
          toast.error(`连接失败: ${detail}`);
          setIsTestingConn(false);
        });
    } else {
      // 新建时测试当前表单参数
      setIsTestingConn(true);
      testConnectMutation.mutate({
        db_type: formData.db_type,
        host: formData.host,
        port: Number(formData.port),
        username: formData.username,
        password: formData.password,
        database: formData.database,
      });
    }
  };

  const filtered = useMemo(() => {
    if (!connections) return [];
    if (!searchQuery) return connections;
    const q = searchQuery.toLowerCase();
    return connections.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.database.toLowerCase().includes(q) ||
      c.db_type.toLowerCase().includes(q)
    );
  }, [connections, searchQuery]);

  const dbTypeColors: Record<string, string> = {
    mysql: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    postgresql: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    oracle: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sqlite: 'bg-slate-500/20 text-text-secondary border-slate-500/30'
  };

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              <Database className="w-7 h-7 text-blue-400" />
              数据库管理
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              管理数据库连接配置，供数据库运维 Agent 调用 dbskiter 使用
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingConn(null); setIsModalOpen(true); }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            添加连接
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: '总连接数', value: connections?.length || 0, icon: Database, color: 'blue' },
            { label: '已启用', value: connections?.filter(c => c.enabled).length || 0, icon: Check, color: 'emerald' },
            { label: '已禁用', value: connections?.filter(c => !c.enabled).length || 0, icon: X, color: 'red' },
            { label: 'MySQL', value: connections?.filter(c => c.db_type === 'mysql').length || 0, icon: Server, color: 'amber' }
          ].map((stat, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', `bg-${stat.color}-500/20 text-${stat.color}-400`)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
                <div className="text-xs text-text-secondary">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 搜索 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索名称、主机、数据库类型..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* 列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>暂无数据库连接</p>
            <p className="text-sm mt-1">点击上方"添加连接"按钮创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((conn) => (
              <div
                key={conn.id}
                className={clsx(
                  'bg-surface border rounded-xl p-5 transition-all hover:bg-slate-800/80 hover:scale-[1.01]',
                  conn.enabled ? 'border-border' : 'border-red-500/20 opacity-60'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center border', dbTypeColors[conn.db_type] || dbTypeColors.mysql)}>
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-text-primary">{conn.name}</h3>
                        {!conn.enabled && (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full border border-red-500/20">已禁用</span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {conn.db_type}://{conn.host}:{conn.port}/{conn.database}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(conn)}
                      className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(conn.id, conn.name)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {conn.description && (
                  <p className="text-sm text-text-secondary mt-3 line-clamp-1">{conn.description}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {conn.host}:{conn.port}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {conn.username}
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {new Date(conn.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建/编辑模态框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface backdrop-blur-xl rounded-2xl w-full max-w-lg border border-border shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-text-primary">
                {editingConn ? '编辑数据库连接' : '添加数据库连接'}
              </h2>
              <button
                onClick={() => { setIsModalOpen(false); setEditingConn(null); resetForm(); }}
                className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">连接名称 *</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：生产环境MySQL"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">数据库类型 *</label>
                  <select
                    value={formData.db_type}
                    onChange={(e) => setFormData({ ...formData, db_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="oracle">Oracle</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">端口 *</label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">主机地址 *</label>
                  <input
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="127.0.0.1"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">数据库名 *</label>
                  <input
                    required
                    value={formData.database}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                    placeholder="数据库名称"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">用户名 *</label>
                  <input
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="root"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {editingConn ? '密码（留空不修改）' : '密码 *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingConn}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingConn ? '••••••' : '请输入密码'}
                      className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-all"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="可选，填写连接用途说明"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">标签（逗号分隔）</label>
                <input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="prod, mysql, business"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
                />
                <label htmlFor="enabled" className="text-sm text-text-primary">启用连接</label>
              </div>
            </form>

            <div className="p-6 border-t border-border/30 flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingConn(null); resetForm(); }}
                className="flex-1 px-4 py-2.5 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all font-medium border border-slate-600/30"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConn || !formData.host || !formData.username || (!formData.password && !editingConn) || !formData.database}
                className="flex-1 px-4 py-2.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTestingConn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    测试连接
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? '保存中...' : (editingConn ? '保存修改' : '创建连接')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {showDeleteConfirm && pendingDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface backdrop-blur-xl rounded-2xl w-full max-w-md border border-red-500/20 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
            </div>
            <p className="text-text-primary mb-6">
              确定要删除数据库连接 <span className="font-semibold text-text-primary">"{pendingDelete.name}"</span> 吗？此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setPendingDelete(null); }}
                className="flex-1 px-4 py-2.5 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all font-medium"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
