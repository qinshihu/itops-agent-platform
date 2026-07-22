import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { EndpointHost, EndpointItem } from '../types';

/**
 * useEndpointTab — Docker 端点 Tab 的状态/查询/变更
 */
export function useEndpointTab() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showEpCreateModal, setShowEpCreateModal] = useState(false);
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [epName, setEpName] = useState('');
  const [epHost, setEpHost] = useState('');
  const [epPort, setEpPort] = useState('2375');
  const [epProtocol, setEpProtocol] = useState('tcp');
  const [epTlsCa, setEpTlsCa] = useState('');
  const [epTlsCert, setEpTlsCert] = useState('');
  const [epTlsKey, setEpTlsKey] = useState('');

  const endpointsQueryKey = ['containers-hosts'];
  const { data: hosts = [] } = useQuery<EndpointHost[]>({
    queryKey: endpointsQueryKey,
    queryFn: async () => {
      const { data } = await api.get('/containers/hosts');
      return data || [];
    },
  });

  const endpointsListQueryKey = ['containers-endpoints'];
  const { data: endpoints = [], isLoading: endpointsLoading, error: endpointsError } = useQuery<EndpointItem[]>({
    queryKey: endpointsListQueryKey,
    queryFn: async () => {
      const { data } = await api.get('/containers/endpoints');
      return data || [];
    },
  });

  const createEndpointMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/endpoints', {
        name: epName, host: epHost,
        port: parseInt(epPort) || 2375, protocol: epProtocol,
        tlsCa: epProtocol === 'tcp+tls' ? epTlsCa || undefined : undefined,
        tlsCert: epProtocol === 'tcp+tls' ? epTlsCert || undefined : undefined,
        tlsKey: epProtocol === 'tcp+tls' ? epTlsKey || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已添加');
      setShowEpCreateModal(false);
      resetEpForm();
    },
    onError: () => toast.error('添加端点失败'),
  });

  const updateEndpointMutation = useMutation({
    mutationFn: () =>
      api.put(`/containers/endpoints/${editingEpId}`, {
        name: epName, host: epHost,
        port: parseInt(epPort) || 2375, protocol: epProtocol,
        tlsCa: epProtocol === 'tcp+tls' ? epTlsCa || undefined : undefined,
        tlsCert: epProtocol === 'tcp+tls' ? epTlsCert || undefined : undefined,
        tlsKey: epProtocol === 'tcp+tls' ? epTlsKey || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已更新');
      setShowEpCreateModal(false);
      resetEpForm();
    },
    onError: () => toast.error('更新端点失败'),
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/containers/endpoints/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已删除');
    },
    onError: () => toast.error('删除端点失败'),
  });

  const testEndpointMutation = useMutation({
    mutationFn: (ep: { host: string; port: number; protocol: string; tlsCa?: string; tlsCert?: string; tlsKey?: string }) =>
      api.post('/containers/endpoints/test', ep),
    onSuccess: (res) => {
      const payload = res.data?.data as { success?: boolean; message?: string } | undefined;
      const ok = payload?.success ?? false;
      toast.success(ok ? '连接测试成功' : `连接失败: ${payload?.message || '未知错误'}`);
    },
    onError: () => toast.error('测试请求失败'),
  });

  const refreshEndpointMutation = useMutation({
    mutationFn: (id: string) => api.post(`/containers/endpoints/${id}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      toast.success('端点已刷新');
    },
    onError: () => toast.error('刷新端点失败'),
  });

  function resetEpForm() {
    setEpName(''); setEpHost(''); setEpPort('2375'); setEpProtocol('tcp');
    setEpTlsCa(''); setEpTlsCert(''); setEpTlsKey('');
    setEditingEpId(null);
  }

  function openEpEditModal(ep: EndpointItem) {
    setEditingEpId(ep.id);
    setEpName(ep.name);
    setEpHost(ep.host);
    setEpPort(String(ep.port || 2375));
    setEpProtocol(ep.protocol || 'tcp');
    setEpTlsCa(ep.tlsCa || '');
    setEpTlsCert(ep.tlsCert || '');
    setEpTlsKey(ep.tlsKey || '');
    setShowEpCreateModal(true);
  }

  return {
    // state
    showEpCreateModal, setShowEpCreateModal,
    editingEpId, setEditingEpId,
    epName, setEpName,
    epHost, setEpHost,
    epPort, setEpPort,
    epProtocol, setEpProtocol,
    epTlsCa, setEpTlsCa,
    epTlsCert, setEpTlsCert,
    epTlsKey, setEpTlsKey,
    // data
    hosts, endpoints, endpointsLoading, endpointsError,
    endpointsQueryKey, endpointsListQueryKey,
    // mutations
    createEndpointMutation, updateEndpointMutation,
    deleteEndpointMutation, testEndpointMutation, refreshEndpointMutation,
    // helpers
    resetEpForm, openEpEditModal,
  };
}
