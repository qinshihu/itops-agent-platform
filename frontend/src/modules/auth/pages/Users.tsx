/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

interface User {
  id: string;
  username: string;
  email: string | null;
  role: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export default function Users() {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    role: 'viewer',
    enabled: true,
  });
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data as User[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/api/users', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      resetForm();
      toast.success('用户创建成功');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '用户创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/api/users/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      resetForm();
      toast.success('用户更新成功');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '用户更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('用户删除成功');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '用户删除失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { password, ...dataWithoutPassword } = formData;
      if (password) {
        updateMutation.mutate({ id: editingUser.id, data: formData });
      } else {
        updateMutation.mutate({ id: editingUser.id, data: dataWithoutPassword });
      }
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email || '',
      role: user.role,
      enabled: !!user.enabled,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      email: '',
      role: 'viewer',
      enabled: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getRoleBadge = (role: string) => {
    const roles = {
      admin: { label: '管理员', class: 'bg-red-500/10 text-red-500' },
      operator: { label: '运维', class: 'bg-blue-500/10 text-blue-500' },
      viewer: { label: '只读', class: 'bg-green-500/10 text-green-500' },
    };
    return roles[role as keyof typeof roles] || { label: role, class: 'bg-text-secondary/10 text-text-secondary' };
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">用户管理</h1>
            <p className="text-text-secondary">管理系统用户和权限</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            新建用户
          </button>
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">用户名</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">邮箱</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">角色</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">状态</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">创建时间</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      加载中...
                    </td>
                  </tr>
                ) : usersData?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      暂无用户
                    </td>
                  </tr>
                ) : (
                  usersData?.map((user) => (
                    <tr key={user.id} className="hover:bg-background transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{user.username}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {user.email || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-1 rounded-full text-xs font-medium", getRoleBadge(user.role).class)}>
                          {getRoleBadge(user.role).label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          user.enabled ? 'bg-green-500/10 text-green-500' : 'bg-text-secondary/10 text-text-secondary'
                        )}>
                          {user.enabled ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 hover:bg-background rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(user.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
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
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingUser ? '编辑用户' : '新建用户'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-background rounded"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">用户名</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  密码 {editingUser && '(留空则不修改)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="输入密码"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">邮箱</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="输入邮箱地址"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">角色</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="admin">管理员 - 拥有所有权限</option>
                  <option value="operator">运维 - 可执行操作和管理</option>
                  <option value="viewer">只读 - 仅可查看</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <label htmlFor="enabled" className="text-sm text-text-secondary">启用用户</label>
              </div>
              <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                <p className="text-sm text-yellow-500">
                  注意：管理员用户拥有系统的完全访问权限，请谨慎分配。
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-background border border-border rounded-lg text-text-primary hover:bg-surface transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {editingUser ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
