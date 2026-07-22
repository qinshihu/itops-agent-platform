/**
 * useServerActions mutations 子模块（2026-07-21 拆分）
 *
 * 包含 11 个 useMutation：
 * - CRUD: createServerMutation / updateServerMutation / deleteServerMutation
 * - 命令: testConnectionMutation / executeCommandMutation / runComplianceMutation
 * - 采集: collectInfoMutation / collectAllMutation / collectMetricsMutation / collectAllMetricsMutation
 * - 批量: importServersMutation
 * - 分组: createGroupMutation / updateGroupMutation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import type { ApiError, ServerImportItem } from './types';

interface ServerActionsMutations {
  queryClient: ReturnType<typeof useQueryClient>;
  createMutation: any;
  updateMutation: any;
  deleteMutation: any;
  testConnectionMutation: any;
  executeCommandMutation: any;
  runComplianceMutation: any;
  collectInfoMutation: any;
  collectAllMutation: any;
  collectMetricsMutation: any;
  collectAllMetricsMutation: any;
  importServersMutation: any;
  createGroupMutation: any;
  updateGroupMutation: any;
}

export function useServerActionsMutations(
  toast: any,
  resetForm: () => void,
  setIsModalOpen: (v: boolean) => void,
  setSelectedServer: (v: any) => void,
  setIsDeleteConfirmOpen: (v: boolean) => void,
  setPendingDeleteServer: (v: { id: string; name: string } | null) => void,
  setGroupFormData: (v: any) => void,
  setEditingGroup: (v: any) => void,
  setIsGroupModalOpen: (v: boolean) => void,
  formData: any,
  selectedSshKeyId: string,
  refetchCommandHistory: () => void,
  refetchComplianceHistory: () => void,
): ServerActionsMutations {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
        ssh_key_id: selectedSshKeyId || undefined,
      };
      const res = await api.post('/servers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      resetForm();
      setIsModalOpen(false);
      toast.success('服务器已添加');
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || '添加服务器失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload: Record<string, unknown> = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : undefined,
        ssh_key_id: selectedSshKeyId || undefined,
      };
      if (data.private_key) {
        payload.private_key = data.private_key;
      } else {
        delete payload.private_key;
      }
      const res = await api.put(`/servers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      resetForm();
      setIsModalOpen(false);
      setSelectedServer(null);
      toast.success('服务器已更新');
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || '更新服务器失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      setIsDeleteConfirmOpen(false);
      setPendingDeleteServer(null);
      toast.success('服务器已删除');
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || '删除服务器失败');
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/server-commands/${id}/test`);
      return res.data;
    },
  });

  const executeCommandMutation = useMutation({
    mutationFn: async ({ id, command }: { id: string; command: string }) => {
      const res = await api.post(`/server-commands/${id}/exec`, { command });
      return res.data;
    },
    onSuccess: () => {
      refetchCommandHistory();
    },
  });

  const runComplianceMutation = useMutation({
    mutationFn: async ({ id, options }: { id: string; options?: { useAI?: boolean; concurrency?: number } }) => {
      const res = await api.post(`/server-commands/${id}/compliance`, options || {});
      return res.data;
    },
    onSuccess: () => {
      refetchComplianceHistory();
    },
  });

  const collectInfoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/server-management/${id}/collect-info`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const collectAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/server-management/collect-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const collectMetricsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/server-management/${id}/collect-metrics`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const collectAllMetricsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/server-management/collect-all-metrics');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const importServersMutation = useMutation({
    mutationFn: async (data: { servers: ServerImportItem[]; test_connection: boolean }) => {
      const res = await api.post('/server-management/import', data);
      return res.data;
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/server-groups', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-groups'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      setIsGroupModalOpen(false);
      setGroupFormData({ name: '', description: '', parent_id: '' });
      setEditingGroup(null);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/server-groups/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-groups'] });
      setIsGroupModalOpen(false);
      setGroupFormData({ name: '', description: '', parent_id: '' });
      setEditingGroup(null);
    },
  });

  return {
    queryClient,
    createMutation, updateMutation, deleteMutation,
    testConnectionMutation, executeCommandMutation, runComplianceMutation,
    collectInfoMutation, collectAllMutation, collectMetricsMutation, collectAllMetricsMutation,
    importServersMutation,
    createGroupMutation, updateGroupMutation,
  };
}
