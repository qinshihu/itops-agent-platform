/**
 * SSHKeys 数据 hook（2026-07-21 拆分）
 *
 * 把原 SSHKeys.tsx L20-186 的 state + query + mutation + handlers 抽出
 * 包含：
 * - 7 useState（isModalOpen / selectedKey / formData / expandedKey / deleteConfirmKey / usageServers / usageLoading / searchQuery）
 * - 2 useQuery（ssh-keys list / single key full private）
 * - 3 useMutation（create / update / delete）
 * - 6 handlers（resetForm / handleSubmit / handleEdit / handleCopyFingerprint / handleCopyKey / handleViewUsage）
 * - 1 derived（filteredKeys）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '../../../../lib/errorHandler';
import { useToast } from '../../../../contexts/ToastContext';
import type { SshKey } from './types';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import { DEFAULT_FORM_DATA, type SSHKeyFormData, type UsageServer } from './types';

export interface UseSSHKeysDataResult {
  // state
  isModalOpen: boolean;
  setIsModalOpen: (b: boolean) => void;
  selectedKey: SshKey | null;
  setSelectedKey: (k: SshKey | null) => void;
  formData: SSHKeyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SSHKeyFormData>>;
  expandedKey: string | null;
  setExpandedKey: (id: string | null) => void;
  deleteConfirmKey: SshKey | null;
  setDeleteConfirmKey: (k: SshKey | null) => void;
  usageServers: UsageServer[] | null;
  setUsageServers: React.Dispatch<React.SetStateAction<UsageServer[] | null>>;
  usageLoading: boolean;
  searchQuery: string;
  setSearchQuery: (s: string) => void;

  // queries
  sshKeys: SshKey[] | null;
  isLoading: boolean;
  fullKeyData: (SshKey & { private_key: string }) | null | undefined;

  // mutations
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;

  // derived
  filteredKeys: SshKey[];

  // handlers
  resetForm: () => void;
  handleAddNew: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleEdit: (key: SshKey) => void;
  handleCopyFingerprint: (fingerprint: string) => void;
  handleCopyKey: () => void;
  handleDeleteConfirmed: () => void;
  handleViewUsage: (key: SshKey) => Promise<void>;
}

export function useSSHKeysData(): UseSSHKeysDataResult {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<SshKey | null>(null);
  const [formData, setFormData] = useState<SSHKeyFormData>(DEFAULT_FORM_DATA);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<SshKey | null>(null);
  const [usageServers, setUsageServers] = useState<UsageServer[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  useEscapeKey({
    onEscape: () => {
      setIsModalOpen(false);
      resetForm();
      setSelectedKey(null);
    },
    enabled: isModalOpen,
  });
  useEscapeKey({ onEscape: () => setDeleteConfirmKey(null), enabled: !!deleteConfirmKey });

  // ── Queries ──
  const { data: sshKeys, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: async () => {
      const { data } = await api.get('/ssh-keys');
      return data as SshKey[];
    },
  });

  const { data: fullKeyData } = useQuery({
    queryKey: ['ssh-key', expandedKey],
    queryFn: async () => {
      if (!expandedKey) return null;
      const { data } = await api.get(`/ssh-keys/${expandedKey}`);
      return data as SshKey & { private_key: string };
    },
    enabled: !!expandedKey,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (data: SSHKeyFormData) => {
      const { data: result } = await api.post('/ssh-keys', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      resetForm();
      setIsModalOpen(false);
      toast.success('认证凭证已添加');
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '添加失败，请重试'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SSHKeyFormData> }) => {
      const { data: result } = await api.put(`/ssh-keys/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      resetForm();
      setIsModalOpen(false);
      setSelectedKey(null);
      toast.success('认证凭证已更新');
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '更新失败，请重试'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ssh-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setDeleteConfirmKey(null);
      toast.success('认证凭证已删除');
    },
    onError: () => {
      setDeleteConfirmKey(null);
    },
  });

  // ── Handlers ──
  const handleAddNew = useCallback(() => {
    resetForm();
    setSelectedKey(null);
    setIsModalOpen(true);
  }, [resetForm]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedKey) {
        const data: Partial<SSHKeyFormData> = {
          name: formData.name,
          auth_type: formData.auth_type,
          description: formData.description,
        };
        if (formData.auth_type === 'key' && formData.private_key) {
          data.private_key = formData.private_key;
        }
        if (formData.auth_type === 'password') {
          if (formData.username) data.username = formData.username;
          if (formData.password) data.password = formData.password;
        }
        updateMutation.mutate({ id: selectedKey.id, data });
      } else {
        const data: SSHKeyFormData = { ...formData };
        if (data.auth_type === 'key') {
          data.username = '';
          data.password = '';
        } else {
          data.private_key = '';
        }
        createMutation.mutate(data);
      }
    },
    [selectedKey, formData, createMutation, updateMutation],
  );

  const handleEdit = useCallback((key: SshKey) => {
    setSelectedKey(key);
    setFormData({
      name: key.name,
      auth_type: key.auth_type,
      username: key.username || '',
      password: '',
      private_key: '',
      description: key.description || '',
    });
    setIsModalOpen(true);
  }, []);

  const handleCopyFingerprint = useCallback(
    (fingerprint: string) => {
      navigator.clipboard.writeText(fingerprint);
      toast.success('指纹已复制到剪贴板');
    },
    [toast],
  );

  const handleCopyKey = useCallback(() => {
    if (fullKeyData?.private_key) {
      navigator.clipboard.writeText(fullKeyData.private_key);
      toast.success('私钥已复制到剪贴板');
    }
  }, [fullKeyData, toast]);

  const handleDeleteConfirmed = useCallback(() => {
    if (!deleteConfirmKey) return;
    deleteMutation.mutate(deleteConfirmKey.id);
  }, [deleteConfirmKey, deleteMutation]);

  const handleViewUsage = useCallback(
    async (key: SshKey) => {
      setUsageLoading(true);
      setUsageServers(null);
      try {
        const { data } = await api.get(`/ssh-keys/${key.id}/usage`);
        setUsageServers(data.servers);
      } catch {
        toast.error('获取使用情况失败');
      }
      setUsageLoading(false);
    },
    [toast],
  );

  // ── Derived ──
  const filteredKeys = useMemo(() => {
    if (!Array.isArray(sshKeys)) return [];
    const q = searchQuery.toLowerCase();
    if (!q) return sshKeys;
    return sshKeys.filter(
      (key) =>
        key.name.toLowerCase().includes(q) ||
        (key.description || '').toLowerCase().includes(q) ||
        (key.fingerprint || '').toLowerCase().includes(q) ||
        (key.key_type ?? '').toLowerCase().includes(q),
    );
  }, [sshKeys, searchQuery]);

  return {
    // state
    isModalOpen,
    setIsModalOpen,
    selectedKey,
    setSelectedKey,
    formData,
    setFormData,
    expandedKey,
    setExpandedKey,
    deleteConfirmKey,
    setDeleteConfirmKey,
    usageServers,
    setUsageServers,
    usageLoading,
    searchQuery,
    setSearchQuery,
    // queries
    sshKeys: sshKeys ?? null,
    isLoading,
    fullKeyData,
    // mutations
    createPending: createMutation.isPending,
    updatePending: updateMutation.isPending,
    deletePending: deleteMutation.isPending,
    // derived
    filteredKeys,
    // handlers
    resetForm,
    handleAddNew,
    handleSubmit,
    handleEdit,
    handleCopyFingerprint,
    handleCopyKey,
    handleDeleteConfirmed,
    handleViewUsage,
  };
}
