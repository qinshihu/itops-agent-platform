/**
 * useServerActions 数据查询子模块（2026-07-21 拆分）
 *
 * 包含 4 个 useQuery：
 * - agents（AI agent 列表）
 * - sshKeys（SSH 密钥列表）
 * - groupsData（服务器分组树）
 * - servers（服务器列表）
 * - commandHistory / complianceHistory（按 selectedServer.id 动态）
 *
 * 衍生数据：allTags / filteredSshKeys / filteredServers
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import type { Server, ServerGroup, CommandHistoryItem, ComplianceCheck } from '../types';

interface ServerActionsQueries {
  agents: any[] | undefined;
  sshKeys: any[] | undefined;
  groupsData: ServerGroup[] | undefined;
  servers: Server[] | undefined;
  isLoading: boolean;
  allTags: string[];
  filteredSshKeys: any[];
  filteredServers: Server[];
  commandHistory: CommandHistoryItem[] | undefined;
  refetchCommandHistory: () => void;
  complianceHistory: ComplianceCheck[] | undefined;
  refetchComplianceHistory: () => void;
}

export function useServerActionsQueries(
  selectedServer: Server | null,
  selectedTag: string | null,
  selectedGroupId: string | null,
  activeTab: string,
  sshKeySearchQuery: string,
): ServerActionsQueries {
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/agents');
      return res.data.data as Array<{ id: string; name: string; enabled: number; category?: string }>;
    },
    enabled: true,
  });

  const { data: sshKeys } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: async () => {
      const res = await api.get('/ssh-keys');
      return res.data.data as Array<{ id: string; name: string; key_type: string; fingerprint: string | null; usage_count: number }>;
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ['server-groups'],
    queryFn: async () => {
      const res = await api.get('/server-groups/tree');
      return res.data.data as ServerGroup[];
    },
  });

  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/servers');
      return res.data.data as Server[];
    },
  });

  // 获取所有唯一的标签
  const allTags = Array.from(
    new Set(
      (Array.isArray(servers) ? servers : []).flatMap((server: Server) =>
        Array.isArray(server.tags) ? server.tags : [],
      ),
    ),
  ).sort();

  // 过滤认证凭证列表
  const filteredSshKeys = useMemo(() => {
    if (!sshKeys) return [];
    if (!sshKeySearchQuery) return sshKeys;
    const query = sshKeySearchQuery.toLowerCase();
    return sshKeys.filter((key) => {
      return (
        key.name.toLowerCase().includes(query) ||
        (key.key_type || '').toLowerCase().includes(query) ||
        (key.fingerprint || '').toLowerCase().includes(query)
      );
    });
  }, [sshKeys, sshKeySearchQuery]);

  // 根据选中的标签或分组筛选服务器
  const safeServers = Array.isArray(servers) ? servers : [];
  const filteredServers = selectedGroupId
    ? safeServers.filter((server: Server) => (server.groups || []).some((g: { id: string; name: string }) => g.id === selectedGroupId))
    : selectedTag
      ? safeServers.filter((server: Server) => (Array.isArray(server.tags) ? server.tags : []).includes(selectedTag))
      : safeServers;

  const { data: commandHistory, refetch: refetchCommandHistory } = useQuery({
    queryKey: ['commandHistory', selectedServer?.id],
    queryFn: async () => {
      if (!selectedServer) return [];
      const res = await api.get(`/servers/${selectedServer.id}/command-history`);
      return res.data.data as CommandHistoryItem[];
    },
    enabled: !!selectedServer && activeTab === 'command-history',
  });

  const { data: complianceHistory, refetch: refetchComplianceHistory } = useQuery({
    queryKey: ['complianceHistory', selectedServer?.id],
    queryFn: async () => {
      if (!selectedServer) return [];
      const res = await api.get(`/servers/${selectedServer.id}/compliance-history`);
      return res.data.data as ComplianceCheck[];
    },
    enabled: !!selectedServer && activeTab === 'compliance-history',
  });

  return {
    agents, sshKeys, groupsData, servers, isLoading,
    allTags, filteredSshKeys, filteredServers,
    commandHistory, refetchCommandHistory,
    complianceHistory, refetchComplianceHistory,
  };
}
