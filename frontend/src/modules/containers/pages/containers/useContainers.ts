import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useContainerTab } from './useContainerTab';
import { useNetworkTab } from './useNetworkTab';
import { useEndpointTab } from './useEndpointTab';
import type { Tab } from '../types';

/**
 * useContainers — 容器主页面聚合 hook
 *
 * 仅负责：tab 切换 + 当前 endpointId 选择
 * 实际业务状态/查询/变更拆到三个子 hook：
 *   - useContainerTab  容器列表
 *   - useNetworkTab    Docker 网络
 *   - useEndpointTab   Docker 端点
 */
export function useContainers() {
  const [activeTab, setActiveTab] = useState<Tab>('containers');
  const [endpointId, setEndpointId] = useState('local');
  const queryClient = useQueryClient();

  const container = useContainerTab(endpointId);
  const network = useNetworkTab(endpointId);
  const endpoint = useEndpointTab();

  return {
    // Shared
    activeTab, setActiveTab,
    endpointId, setEndpointId,
    queryClient,
    // spread 子 hook（networksQueryKey 来自 useNetworkTab）
    ...container,
    ...network,
    ...endpoint,
  };
}
