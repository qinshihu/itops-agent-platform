import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import { withEndpointParams } from '../types';
import type { NetworkItem } from '../types';

/**
 * useNetworkTab — Docker 网络 Tab 的状态/查询/变更
 */
export function useNetworkTab(endpointId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showNetCreateModal, setShowNetCreateModal] = useState(false);
  const [showNetDetailDrawer, setShowNetDetailDrawer] = useState(false);
  const [netDetailData, setNetDetailData] = useState<NetworkItem | null>(null);
  const [netName, setNetName] = useState('');
  const [netDriver, setNetDriver] = useState('bridge');
  const [netSubnet, setNetSubnet] = useState('');
  const [netGateway, setNetGateway] = useState('');
  const [netInternal, setNetInternal] = useState(false);
  const [netAttachable, setNetAttachable] = useState(false);

  const networksQueryKey = ['containers-networks', endpointId];
  const { data: networks = [], isLoading: networksLoading, error: networksError } = useQuery<NetworkItem[]>({
    queryKey: networksQueryKey,
    queryFn: async () => {
      const { data } = await api.get('/containers/networks/list', {
        params: withEndpointParams(endpointId),
      });
      return data || [];
    },
  });

  const ep = { endpointId: endpointId !== 'local' ? endpointId : undefined };

  const createNetworkMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/networks', {
        name: netName, driver: netDriver,
        subnet: netSubnet || undefined, gateway: netGateway || undefined,
        internal: netInternal, attachable: netAttachable,
      }, { params: ep }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: networksQueryKey });
      toast.success('网络已创建');
      setShowNetCreateModal(false);
      resetNetForm();
    },
    onError: () => toast.error('创建网络失败'),
  });

  const deleteNetworkMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/containers/networks/${id}`, { params: ep }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: networksQueryKey });
      toast.success('网络已删除');
    },
    onError: () => toast.error('删除网络失败'),
  });

  const { data: networkDetailData } = useQuery({
    queryKey: ['network-detail', netDetailData?.Id || netDetailData?.id],
    queryFn: async () => {
      const id = netDetailData?.Id || netDetailData?.id;
      const { data } = await api.get(`/containers/networks/${id}`, {
        params: withEndpointParams(endpointId),
      });
      return data as NetworkItem;
    },
    enabled: showNetDetailDrawer && !!(netDetailData?.Id || netDetailData?.id),
  });

  const displayNetDetail = networkDetailData || netDetailData;

  function resetNetForm() {
    setNetName(''); setNetDriver('bridge'); setNetSubnet('');
    setNetGateway(''); setNetInternal(false); setNetAttachable(false);
  }

  return {
    // state
    showNetCreateModal, setShowNetCreateModal,
    showNetDetailDrawer, setShowNetDetailDrawer,
    netDetailData, setNetDetailData,
    netName, setNetName,
    netDriver, setNetDriver,
    netSubnet, setNetSubnet,
    netGateway, setNetGateway,
    netInternal, setNetInternal,
    netAttachable, setNetAttachable,
    // data
    networks, networksLoading, networksError, networksQueryKey,
    networkDetailData, displayNetDetail,
    // mutations
    createNetworkMutation, deleteNetworkMutation,
    resetNetForm,
  };
}
