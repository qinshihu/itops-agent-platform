/**
 * DbConnections 数据 hook（2026-07-21 拆分）
 *
 * 把原 DbConnections.tsx L29-225 的 state + query + mutation + handlers 抽出
 * 包含：
 * - 7 useState（isModalOpen / editingConn / searchQuery / showDeleteConfirm / pendingDelete / showPassword / formData）
 * - 1 useState 内部（isTestingConn）—— 嵌入 testConnectMutation
 * - 1 useQuery（db-connections）
 * - 4 useMutation（create / update / delete / testConnect）
 * - 5 handlers（resetForm / handleEdit / handleSubmit / handleDelete / confirmDelete / handleTestConnection）
 * - 1 derived（filtered）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import { useToast } from '@/contexts/ToastContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  DEFAULT_DB_CONNECTION_FORM,
  type DbConnection,
  type DbConnectionFormData,
  type DbConnectionPayload,
} from './types';

export interface UseDbConnectionsDataResult {
  // state
  isModalOpen: boolean;
  setIsModalOpen: (b: boolean) => void;
  editingConn: DbConnection | null;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (b: boolean) => void;
  pendingDelete: { id: string; name: string } | null;
  setPendingDelete: (d: { id: string; name: string } | null) => void;
  showPassword: boolean;
  setShowPassword: (b: boolean) => void;
  formData: DbConnectionFormData;
  setFormData: React.Dispatch<React.SetStateAction<DbConnectionFormData>>;

  // query
  connections: DbConnection[] | undefined;
  isLoading: boolean;

  // derived
  filtered: DbConnection[];

  // mutations
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isTesting: boolean;

  // handlers
  resetForm: () => void;
  handleAddNew: () => void;
  handleEdit: (conn: DbConnection) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleDelete: (id: string, name: string) => void;
  confirmDelete: () => void;
  handleTestConnection: () => void;
}

function buildPayload(form: DbConnectionFormData): DbConnectionPayload {
  return {
    name: form.name,
    db_type: form.db_type,
    host: form.host,
    port: Number(form.port),
    username: form.username,
    password: form.password || undefined,
    database: form.database,
    description: form.description || undefined,
    tags: form.tags
      ? form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    enabled: form.enabled,
  };
}

export function useDbConnectionsData(): UseDbConnectionsDataResult {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<DbConnection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<DbConnectionFormData>(DEFAULT_DB_CONNECTION_FORM);

  useEscapeKey({
    onEscape: () => {
      setIsModalOpen(false);
      setEditingConn(null);
      resetForm();
    },
    enabled: isModalOpen,
  });
  useEscapeKey({
    onEscape: () => {
      setShowDeleteConfirm(false);
      setPendingDelete(null);
    },
    enabled: showDeleteConfirm,
  });

  // ── Query ──
  const { data: connections, isLoading } = useQuery({
    queryKey: ['db-connections'],
    queryFn: async () => {
      const { data } = await api.get('/db-connections');
      return data as DbConnection[];
    },
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (payload: DbConnectionPayload) => {
      const { data } = await api.post('/db-connections', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-connections'] });
      toast.success('数据库连接创建成功');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '创建失败')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DbConnectionPayload }) => {
      const { data } = await api.put(`/db-connections/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-connections'] });
      toast.success('数据库连接更新成功');
      setIsModalOpen(false);
      setEditingConn(null);
      resetForm();
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '更新失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/db-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-connections'] });
      toast.success('数据库连接已删除');
      setShowDeleteConfirm(false);
      setPendingDelete(null);
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '删除失败')),
  });

  const [isTestingConn, setIsTestingConn] = useState(false);

  const testConnectMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/db-connections/test-connect', payload);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || '数据库连接成功');
      setIsTestingConn(false);
    },
    onError: (err: unknown) => {
      const detail = getAxiosErrorMessage(err, '连接失败');
      toast.error(`连接失败: ${detail}`);
      setIsTestingConn(false);
    },
  });

  // ── Derived ──
  const filtered = useMemo(() => {
    if (!connections) return [];
    if (!searchQuery) return connections;
    const q = searchQuery.toLowerCase();
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q) ||
        c.database.toLowerCase().includes(q) ||
        c.db_type.toLowerCase().includes(q),
    );
  }, [connections, searchQuery]);

  // ── Handlers ──
  const resetForm = useCallback(() => {
    setFormData(DEFAULT_DB_CONNECTION_FORM);
    setShowPassword(false);
  }, []);

  const handleAddNew = useCallback(() => {
    resetForm();
    setEditingConn(null);
    setIsModalOpen(true);
  }, [resetForm]);

  const handleEdit = useCallback(
    (conn: DbConnection) => {
      setEditingConn(conn);
      setFormData({
        name: conn.name,
        db_type: conn.db_type,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password: '',
        database: conn.database,
        description: conn.description || '',
        tags: conn.tags
          ? typeof conn.tags === 'string'
            ? conn.tags
            : JSON.stringify(conn.tags)
          : '',
        enabled: conn.enabled === 1,
      });
      setIsModalOpen(true);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const payload = buildPayload(formData);
      if (editingConn) {
        if (!formData.password) {
          delete payload.password;
        }
        updateMutation.mutate({ id: editingConn.id, payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [editingConn, formData, createMutation, updateMutation],
  );

  const handleDelete = useCallback((id: string, name: string) => {
    setPendingDelete({ id, name });
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (pendingDelete) {
      deleteMutation.mutate(pendingDelete.id);
    }
  }, [pendingDelete, deleteMutation]);

  const handleTestConnection = useCallback(() => {
    if (editingConn) {
      // 编辑时测试已保存的连接
      setIsTestingConn(true);
      api
        .post(`/db-connections/${editingConn.id}/test`)
        .then((res) => {
          toast.success((res.data as { message?: string }).message || '数据库连接成功');
          setIsTestingConn(false);
        })
        .catch((err: unknown) => {
          const detail = getAxiosErrorMessage(err, '连接失败');
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
  }, [editingConn, formData, toast, testConnectMutation]);

  return {
    isModalOpen,
    setIsModalOpen,
    editingConn,
    searchQuery,
    setSearchQuery,
    showDeleteConfirm,
    setShowDeleteConfirm,
    pendingDelete,
    setPendingDelete,
    showPassword,
    setShowPassword,
    formData,
    setFormData,

    connections,
    isLoading,

    filtered,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTesting: isTestingConn,

    resetForm,
    handleAddNew,
    handleEdit,
    handleSubmit,
    handleDelete,
    confirmDelete,
    handleTestConnection,
  };
}
