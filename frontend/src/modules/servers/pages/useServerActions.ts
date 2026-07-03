import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import type { Server, ServerGroup, CommandResult, CommandHistoryItem, ComplianceCheck } from './types';

interface ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
}

interface ServerImportItem {
  name: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key: number;
  description: string;
  tags: string[];
  group_id?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors?: string[];
}

export function useServerActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  // ---------- State ----------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    port: 22,
    username: '',
    password: '',
    private_key: '',
    use_ssh_key: false,
    description: '',
    tags: '',
    os_type: 'linux' as 'linux' | 'windows',
    vnc_port: 5900,
    vnc_password: '',
  });
  const [command, setCommand] = useState('');
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [complianceResults, setComplianceResults] = useState<Record<string, CommandResult> | null>(null);
  const [isRunningCompliance, setIsRunningCompliance] = useState(false);
  const [activeTab, setActiveTab] = useState<'servers' | 'compliance' | 'command-history' | 'compliance-history'>('servers');
  const [showComplianceOptions, setShowComplianceOptions] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingDeleteServer, setPendingDeleteServer] = useState<{ id: string; name: string } | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isCollectingMetrics, setIsCollectingMetrics] = useState(false);
  // AI 命令生成相关
  const [isAiCommandModalOpen, setIsAiCommandModalOpen] = useState(false);
  const [aiCommandServer, setAiCommandServer] = useState<Server | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGeneratedCommand, setAiGeneratedCommand] = useState('');
  const [aiCommandExplanation, setAiCommandExplanation] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [selectedAiAgent, setSelectedAiAgent] = useState<{ id: string; name: string } | null>(null);
  const [showAiCommandConfirm, setShowAiCommandConfirm] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState('');

  // SSH Key related
  const [selectedSshKeyId, setSelectedSshKeyId] = useState<string>('');
  const [sshKeySearchQuery, setSshKeySearchQuery] = useState('');
  const [showSshKeyDropdown, setShowSshKeyDropdown] = useState(false);

  // Group related
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '', parent_id: '' });
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);

  // Import related
  const [importData, setImportData] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Group sidebar
  const [showGroups, setShowGroups] = useState(false);

  // Tag input
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Compliance options
  const [complianceOptions, setComplianceOptions] = useState({ useAI: true, concurrency: 5 });

  // ---------- ESC key support ----------
  useEscapeKey({ onEscape: () => { setIsModalOpen(false); setSelectedServer(null); resetForm(); }, enabled: isModalOpen });
  useEscapeKey({ onEscape: () => setIsImportModalOpen(false), enabled: isImportModalOpen });
  useEscapeKey({ onEscape: () => { setIsGroupModalOpen(false); setEditingGroup(null); }, enabled: isGroupModalOpen });
  useEscapeKey({ onEscape: () => { setIsAiCommandModalOpen(false); setAiPrompt(''); setAiGeneratedCommand(''); setAiCommandExplanation(''); setAiGenerationError(''); setShowAiCommandConfirm(false); }, enabled: isAiCommandModalOpen });
  useEscapeKey({ onEscape: () => { setIsDeleteConfirmOpen(false); setPendingDeleteServer(null); }, enabled: isDeleteConfirmOpen });

  // ---------- Tag utilities ----------
  // 关闭标签建议下拉框（点击外部时）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parseCurrentTags = useCallback(() => {
    return formData.tags ? formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  }, [formData.tags]);

  const getLastTagFragment = useCallback(() => {
    const raw = formData.tags;
    const lastCommaIndex = raw.lastIndexOf(',');
    return lastCommaIndex >= 0 ? raw.substring(lastCommaIndex + 1).trim() : (raw || '').trim();
  }, [formData.tags]);

  const addTagToInput = useCallback(
    (tag: string) => {
      const raw = formData.tags;
      const lastCommaIndex = raw.lastIndexOf(',');
      const beforeLast = lastCommaIndex >= 0 ? raw.substring(0, lastCommaIndex + 1) : '';
      setFormData({ ...formData, tags: beforeLast + tag + ', ' });
      tagInputRef.current?.focus();
    },
    [formData],
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const current = parseCurrentTags();
      const filtered = current.filter((t: string) => t !== tagToRemove);
      setFormData({ ...formData, tags: filtered.join(', ') });
    },
    [formData.tags],
  );

  // ---------- Queries ----------
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return res.data.data as Array<{ id: string; name: string; enabled: number; category?: string }>;
    },
    enabled: true,
  });

  const { data: sshKeys } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: async () => {
      const res = await api.get('/api/ssh-keys');
      return res.data.data as Array<{ id: string; name: string; key_type: string; fingerprint: string | null; usage_count: number }>;
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ['server-groups'],
    queryFn: async () => {
      const res = await api.get('/api/server-groups/tree');
      return res.data.data as ServerGroup[];
    },
  });

  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
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

  // 过滤后的标签建议
  const filteredTagSuggestions = useCallback(() => {
    const current = parseCurrentTags();
    const fragment = getLastTagFragment().toLowerCase();
    return allTags.filter((tag: string) => {
      if (current.includes(tag)) return false;
      if (fragment) return tag.toLowerCase().includes(fragment);
      return true;
    });
  }, [allTags, parseCurrentTags, getLastTagFragment]);

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
      const res = await api.get(`/api/servers/${selectedServer.id}/command-history`);
      return res.data.data as CommandHistoryItem[];
    },
    enabled: !!selectedServer && activeTab === 'command-history',
  });

  const { data: complianceHistory, refetch: refetchComplianceHistory } = useQuery({
    queryKey: ['complianceHistory', selectedServer?.id],
    queryFn: async () => {
      if (!selectedServer) return [];
      const res = await api.get(`/api/servers/${selectedServer.id}/compliance-history`);
      return res.data.data as ComplianceCheck[];
    },
    enabled: !!selectedServer && activeTab === 'compliance-history',
  });

  // ---------- Mutations ----------
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
        ssh_key_id: selectedSshKeyId || undefined,
      };
      const res = await api.post('/api/servers', payload);
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
      const res = await api.put(`/api/servers/${id}`, payload);
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
      await api.delete(`/api/servers/${id}`);
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
      const res = await api.post(`/api/server-commands/${id}/test`);
      return res.data;
    },
  });

  const executeCommandMutation = useMutation({
    mutationFn: async ({ id, command }: { id: string; command: string }) => {
      const res = await api.post(`/api/server-commands/${id}/exec`, { command });
      return res.data;
    },
    onSuccess: () => {
      refetchCommandHistory();
    },
  });

  const runComplianceMutation = useMutation({
    mutationFn: async ({ id, options }: { id: string; options?: { useAI?: boolean; concurrency?: number } }) => {
      const res = await api.post(`/api/server-commands/${id}/compliance`, options || {});
      return res.data;
    },
    onSuccess: () => {
      refetchComplianceHistory();
    },
  });

  const collectInfoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/server-management/${id}/collect-info`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const collectAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/server-management/collect-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const collectMetricsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/server-management/${id}/collect-metrics`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const collectAllMetricsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/server-management/collect-all-metrics');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const importServersMutation = useMutation({
    mutationFn: async (data: { servers: ServerImportItem[]; test_connection: boolean }) => {
      const res = await api.post('/api/server-management/import', data);
      return res.data;
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: typeof groupFormData) => {
      const res = await api.post('/api/server-groups', data);
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
    mutationFn: async ({ id, data }: { id: string; data: typeof groupFormData }) => {
      const res = await api.put(`/api/server-groups/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-groups'] });
      setIsGroupModalOpen(false);
      setGroupFormData({ name: '', description: '', parent_id: '' });
      setEditingGroup(null);
    },
  });

  // ---------- Handlers ----------
  function resetForm() {
    setFormData({
      name: '',
      hostname: '',
      port: 22,
      username: '',
      password: '',
      private_key: '',
      use_ssh_key: false,
      description: '',
      tags: '',
      os_type: 'linux' as 'linux' | 'windows',
      vnc_port: 5900,
      vnc_password: '',
    });
    setSelectedSshKeyId('');
    setSshKeySearchQuery('');
    setShowSshKeyDropdown(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServer) {
      updateMutation.mutate({ id: selectedServer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (server: Server) => {
    setSelectedServer(server);
    const serverSshKeyId = server.ssh_key_id || '';
    setSelectedSshKeyId(serverSshKeyId);

    if (serverSshKeyId && sshKeys) {
      const key = sshKeys.find(k => k.id === serverSshKeyId);
      if (key) {
        setSshKeySearchQuery(`${key.name} (${key.key_type})`);
      }
    } else {
      setSshKeySearchQuery('');
    }

    setFormData({
      name: server.name,
      hostname: server.hostname,
      port: server.port,
      username: server.username,
      password: '',
      private_key: '',
      use_ssh_key: !!server.use_ssh_key,
      description: server.description || '',
      tags: server.tags ? server.tags.join(', ') : '',
      os_type: server.os_type || 'linux',
      vnc_port: server.vnc_port || 5900,
      vnc_password: '',
    });
    setIsModalOpen(true);
  };

  const handleTestConnection = (server: Server) => {
    testConnectionMutation.mutate(server.id, {
      onSuccess: (data) => {
        toast.success(data.data.message);
      },
    });
  };

  const handleExecuteCommand = () => {
    if (!selectedServer || !command) return;
    setIsExecuting(true);
    executeCommandMutation.mutate(
      { id: selectedServer.id, command },
      {
        onSuccess: (data) => {
          setCommandResult(data.data);
        },
        onSettled: () => {
          setIsExecuting(false);
        },
      },
    );
  };

  const handleRunCompliance = (server: Server) => {
    setSelectedServer(server);
    setShowComplianceOptions(true);
  };

  const startComplianceCheck = () => {
    if (!selectedServer) return;
    setShowComplianceOptions(false);
    setIsRunningCompliance(true);
    setActiveTab('compliance');
    runComplianceMutation.mutate(
      { id: selectedServer.id, options: complianceOptions },
      {
        onSuccess: (data) => {
          setComplianceResults(data.data);
        },
        onSettled: () => {
          setIsRunningCompliance(false);
        },
      },
    );
  };

  const handleCollectInfo = async (server: Server) => {
    setIsCollecting(true);
    try {
      await collectInfoMutation.mutateAsync(server.id);
      toast.success(`已更新 ${server.name} 的主机信息`);
    } catch {
      toast.error('采集失败');
    } finally {
      setIsCollecting(false);
    }
  };

  // AI 生成命令
  const handleAiGenerateCommand = async () => {
    if (!aiCommandServer || !aiPrompt.trim()) return;

    const enabledAgent = selectedAiAgent;
    if (!enabledAgent) {
      setAiGenerationError('没有可用的 AI Agent，请先在 Agent 管理页面创建并启用一个 Agent');
      return;
    }

    setAiGenerationError('');
    setIsAiGenerating(true);
    try {
      const serverInfo = {
        os_name: aiCommandServer.os || '未知',
        os_type: aiCommandServer.os_type || 'linux',
        hostname: aiCommandServer.hostname || '',
        ip_address: aiCommandServer.ip_address || '',
        cpu_cores: aiCommandServer.cpu_cores || '',
        memory_gb: aiCommandServer.memory_gb || '',
        disk_gb: aiCommandServer.disk_gb || '',
      };

      const userInput = `目标服务器信息：
操作系统名称：${serverInfo.os_name}
操作系统类型：${serverInfo.os_type}
主机名/IP：${serverInfo.hostname || serverInfo.ip_address}
${serverInfo.cpu_cores ? `CPU核心数：${serverInfo.cpu_cores}` : ''}
${serverInfo.memory_gb ? `内存大小：${serverInfo.memory_gb}GB` : ''}
${serverInfo.disk_gb ? `磁盘大小：${serverInfo.disk_gb}GB` : ''}

用户需求：${aiPrompt}`;

      const res = await api.post(`/api/agents/${enabledAgent.id}/test`, {
        input: userInput,
        serverIds: [aiCommandServer.id],
      });

      const output = res.data.data.output;
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          setAiGeneratedCommand(result.command);
          setAiCommandExplanation(result.explanation);
        } catch {
          setAiGeneratedCommand(output);
          setAiCommandExplanation('AI 生成的命令，请确认后执行');
        }
      } else {
        setAiGeneratedCommand(output);
        setAiCommandExplanation('AI 生成的命令，请确认后执行');
      }
    } catch (err) {
      const errorMsg = (err as ApiError).response?.data?.error || (err as ApiError).response?.data?.message || (err as ApiError).message || '未知错误';
      setAiGenerationError(`生成失败：${errorMsg}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // 执行 AI 生成的命令
  const handleExecuteAiCommand = () => {
    if (!aiCommandServer || !aiGeneratedCommand) return;
    setShowAiCommandConfirm(true);
  };

  const confirmExecuteAiCommand = () => {
    setShowAiCommandConfirm(false);
    setIsAiCommandModalOpen(false);
    setAiGeneratedCommand('');
    setAiCommandExplanation('');
    setAiPrompt('');
    setActiveTab('servers');
    setSelectedServer(aiCommandServer);
    setCommand(aiGeneratedCommand);
    setCommandResult(null);

    setIsExecuting(true);
    executeCommandMutation.mutate(
      { id: aiCommandServer!.id, command: aiGeneratedCommand },
      {
        onSuccess: (data) => {
          setCommandResult(data.data);
        },
        onSettled: () => {
          setIsExecuting(false);
        },
      },
    );
  };

  const handleCollectAll = async () => {
    setIsCollecting(true);
    try {
      const result = await collectAllMutation.mutateAsync();
      toast.success(`采集完成: ${result.data.success} 成功, ${result.data.failed} 失败`);
    } catch {
      toast.error('批量采集失败');
    } finally {
      setIsCollecting(false);
    }
  };

  const handleCollectMetrics = async (server: Server) => {
    setIsCollectingMetrics(true);
    try {
      await collectMetricsMutation.mutateAsync(server.id);
      toast.success(`已采集 ${server.name} 的性能指标`);
    } catch {
      toast.error('采集失败');
    } finally {
      setIsCollectingMetrics(false);
    }
  };

  const handleCollectAllMetrics = async () => {
    setIsCollectingMetrics(true);
    try {
      const result = await collectAllMetricsMutation.mutateAsync();
      toast.success(`指标采集完成: ${result.data.success} 成功, ${result.data.failed} 失败`);
    } catch {
      toast.error('批量采集失败');
    } finally {
      setIsCollectingMetrics(false);
    }
  };

  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: groupFormData });
    } else {
      createGroupMutation.mutate(groupFormData);
    }
  };

  const handleImport = async () => {
    try {
      const servers = importData
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            const item = JSON.parse(line);
            return {
              name: item.name,
              hostname: item.hostname,
              port: item.port || 22,
              username: item.username,
              password: item.password,
              private_key: item.private_key,
              use_ssh_key: item.use_ssh_key || 0,
              description: item.description || '',
              tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()) : [],
              group_id: item.group_id || undefined,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (servers.length === 0) {
        toast.error('没有有效的服务器数据，请检查 JSON 格式');
        return;
      }

      const result = await importServersMutation.mutateAsync({ servers, test_connection: true });
      setImportResult(result.data);
      toast.success(`导入成功: ${result.data.success} 成功, ${result.data.failed} 失败`);
    } catch (err) {
      toast.error((err as ApiError).response?.data?.error || '导入失败');
    }
  };

  // 打开 AI 命令对话框的辅助函数
  const openAiCommandForServer = (server: Server) => {
    setAiCommandServer(server);
    setAiPrompt('');
    setAiGeneratedCommand('');
    setAiCommandExplanation('');
    setAiGenerationError('');
    setShowAiCommandConfirm(false);
    if (agents) {
      const cmdAgent = agents.find(
        a => a.enabled === 1 && (a.name?.includes('命令生成') || a.category?.includes('命令生成')),
      );
      const serverAgent = agents.find(
        a =>
          a.enabled === 1 &&
          (a.category?.includes('服务器') || a.name?.includes('命令') || a.name?.includes('服务')),
      );
      const firstAgent = agents.find(a => a.enabled === 1);
      setSelectedAiAgent(cmdAgent || serverAgent || firstAgent || null);
    }
    setIsAiCommandModalOpen(true);
  };

  return {
    // State
    isModalOpen, setIsModalOpen,
    selectedServer, setSelectedServer,
    formData, setFormData,
    command, setCommand,
    commandResult, setCommandResult,
    isExecuting, setIsExecuting,
    complianceResults, setComplianceResults,
    isRunningCompliance, setIsRunningCompliance,
    activeTab, setActiveTab,
    showComplianceOptions, setShowComplianceOptions,
    selectedTag, setSelectedTag,
    selectedGroupId, setSelectedGroupId,
    isImportModalOpen, setIsImportModalOpen,
    isGroupModalOpen, setIsGroupModalOpen,
    isDeleteConfirmOpen, setIsDeleteConfirmOpen,
    pendingDeleteServer, setPendingDeleteServer,
    isCollecting, setIsCollecting,
    isCollectingMetrics, setIsCollectingMetrics,
    // AI
    isAiCommandModalOpen, setIsAiCommandModalOpen,
    aiCommandServer, setAiCommandServer,
    aiPrompt, setAiPrompt,
    aiGeneratedCommand, setAiGeneratedCommand,
    aiCommandExplanation, setAiCommandExplanation,
    isAiGenerating, setIsAiGenerating,
    selectedAiAgent, setSelectedAiAgent,
    showAiCommandConfirm, setShowAiCommandConfirm,
    aiGenerationError, setAiGenerationError,
    // SSH
    selectedSshKeyId, setSelectedSshKeyId,
    sshKeySearchQuery, setSshKeySearchQuery,
    showSshKeyDropdown, setShowSshKeyDropdown,
    // Group
    groupFormData, setGroupFormData,
    editingGroup, setEditingGroup,
    // Import
    importData, setImportData,
    importResult, setImportResult,
    // Sidebar
    showGroups, setShowGroups,
    // Tags
    tagDropdownOpen, setTagDropdownOpen,
    tagInputRef, tagDropdownRef,
    // Compliance options
    complianceOptions, setComplianceOptions,
    // Data
    agents, sshKeys, groupsData, servers, isLoading,
    allTags, filteredSshKeys, filteredTagSuggestions,
    filteredServers,
    commandHistory, refetchCommandHistory,
    complianceHistory, refetchComplianceHistory,
    // Tag utilities
    parseCurrentTags, getLastTagFragment, addTagToInput, removeTag,
    // Handlers
    resetForm, handleSubmit, handleEdit, handleTestConnection,
    handleExecuteCommand, handleRunCompliance, startComplianceCheck,
    handleCollectInfo, handleAiGenerateCommand, handleExecuteAiCommand,
    confirmExecuteAiCommand, handleCollectAll, handleCollectMetrics,
    handleCollectAllMetrics, handleGroupSubmit, handleImport,
    openAiCommandForServer,
    // Mutations
    createMutation, updateMutation, deleteMutation,
    testConnectionMutation, executeCommandMutation,
    runComplianceMutation,
    // Nav
    navigate,
    // Query client
    queryClient,
  };
}
