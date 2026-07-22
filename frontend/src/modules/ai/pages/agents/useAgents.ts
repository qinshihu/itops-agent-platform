import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import type { Agent, Server, DbConnection } from './types';

const PRESET_INPUTS: Record<string, string> = {
  '告警处理 Agent': '服务器CPU使用率异常，当前值92%，阈值80%，请分析并提供处理建议',
  '告警处理': '服务器CPU使用率异常，当前值92%，阈值80%，请分析并提供处理建议',
  '故障诊断 Agent': '应用服务响应超时，请诊断可能的原因并提供排查步骤',
  '故障诊断': '应用服务响应超时，请诊断可能的原因并提供排查步骤',
  '日志分析 Agent': '系统日志中有多个错误记录，请分析并找出问题根源',
  '日志分析': '系统日志中有多个错误记录，请分析并找出问题根源',
  '系统巡检 Agent': '请执行系统健康检查，检查CPU、内存、磁盘、网络状态',
  '系统巡检': '请执行系统健康检查，检查CPU、内存、磁盘、网络状态',
  '变更执行 Agent': '请执行Nginx服务重启操作',
  '变更执行': '请执行Nginx服务重启操作',
  '文档生成 Agent': '请生成今天的系统运维报告',
  '文档生成': '请生成今天的系统运维报告',
  '合规检查 Agent': '请执行安全合规检查，验证系统配置是否符合安全标准',
  '合规检查': '请执行安全合规检查，验证系统配置是否符合安全标准',
  '服务器命令执行 Agent': '请检查服务器磁盘使用情况',
  '服务器命令执行': '请检查服务器磁盘使用情况',
  '自动巡检 Agent': '请对所有服务器执行批量巡检',
  '自动巡检': '请对所有服务器执行批量巡检',
  '数据库运维 Agent': '检查数据库健康状态',
  '数据库运维': '检查数据库健康状态'
};

export function useAgents() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<{output: string, time: number} | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>('');

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents', selectedCategory, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get('/agents', { params });
      // v4 修复：api 拦截器已剥外层 data，这里 data 就是后端的 data 字段（即数组）
      // 原代码 `data?.items || []` 永远走兜底空数组，导致 useAgents 模式下完全不显示 agent
      return (Array.isArray(data) ? data : []) as Agent[];
    },
  });

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const { data } = await api.get('/servers');
      return (Array.isArray(data) ? data : []) as Server[];
    },
  });

  const { data: dbConnections } = useQuery({
    queryKey: ['db-connections'],
    queryFn: async () => {
      const { data } = await api.get('/db-connections');
      return (Array.isArray(data) ? data : []) as DbConnection[];
    },
  });

  const categories = Array.from(new Set((agents || []).map(a => a.category).filter(Boolean) as string[]));

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ agentId, input, serverIds, databaseId }: { agentId: string, input: string, serverIds?: string[], databaseId?: string }) => {
      const payload: Record<string, unknown> = { input };
      if (serverIds && serverIds.length > 0) payload.serverIds = serverIds;
      if (databaseId) payload.databaseId = databaseId;
      const { data } = await api.post(`/agents/${agentId}/test`, payload);
      return data;
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定要删除Agent "${name}" 吗？`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingAgent(null);
    setShowModal(true);
  };

  const handleTest = (agent: Agent) => {
    setEditingAgent(agent);
    setTestResult(null);
    setShowTestModal(true);

    const isDbAgent = agent.name.includes('数据库运维');

    if (isDbAgent) {
      setSelectedServerIds([]);
      const firstEnabled = dbConnections?.find((d) => d.enabled);
      if (firstEnabled) {
        setSelectedDatabaseId(firstEnabled.id);
      } else {
        setSelectedDatabaseId('');
      }
    } else {
      if (servers && servers.length > 0 && selectedServerIds.length === 0) {
        setSelectedServerIds(servers.filter((s) => s.enabled).map((s) => s.id));
      }
    }

    const defaultInput = PRESET_INPUTS[agent.name] || '请描述您要处理的运维问题';
    setTestInput(defaultInput);
  };

  const runTest = () => {
    if (!editingAgent || !testInput) return;
    setIsTesting(true);

    const isDbAgent = editingAgent.name.includes('数据库运维');

    testMutation.mutate(
      {
        agentId: editingAgent.id,
        input: testInput,
        serverIds: isDbAgent ? undefined : (selectedServerIds.length > 0 ? selectedServerIds : undefined),
        databaseId: isDbAgent ? selectedDatabaseId : undefined
      },
      {
        onSuccess: (data) => {
          setTestResult({ output: data.output, time: data.executionTime });
          queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
        onSettled: () => setIsTesting(false),
      }
    );
  };

  const filteredAgents = agents || [];

  return {
    // state
    showModal, setShowModal,
    editingAgent, setEditingAgent,
    selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery,
    showDetail, setShowDetail,
    testInput, setTestInput,
    showTestModal, setShowTestModal,
    testResult, setTestResult,
    isTesting,
    selectedServerIds, setSelectedServerIds,
    selectedDatabaseId, setSelectedDatabaseId,
    // data
    agents,
    isLoading,
    servers,
    dbConnections,
    categories,
    filteredAgents,
    // mutations
    deleteMutation,
    testMutation,
    // handlers
    handleDelete,
    handleEdit,
    handleNew,
    handleTest,
    runTest,
  };
}