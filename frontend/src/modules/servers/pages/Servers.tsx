/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, Server, Terminal, CheckCircle2,
  AlertCircle, ShieldCheck, Wifi, History, Clock, FolderTree,
  Upload, RefreshCw, ChevronRight, ChevronDown, Cpu,
  HardDrive, MemoryStick, Monitor, FolderPlus, MonitorPlay,
  Bot, Key, Search, Settings,
  Sparkles, X, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { ImportExport } from '../../../modules/infra/components/ImportExport';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  use_ssh_key: number;
  description?: string;
  tags?: string[];
  enabled: number;
  last_connected?: string;
  created_at: string;
  os?: string;
  os_type?: 'linux' | 'windows' | 'unknown';
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  ip_address?: string;
  private_ip?: string;
  groups?: Array<{ id: string; name: string }>;
}

interface ServerGroup {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  server_count?: number;
  children_count?: number;
  children?: ServerGroup[];
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
  aiAnalysis?: string;
}

interface CommandHistoryItem {
  id: string;
  server_id: string;
  command: string;
  stdout: string;
  stderr: string;
  success: number;
  execution_time_ms: number;
  executed_by: string;
  executed_at: string;
}

interface ComplianceCheck {
  id: string;
  server_id: string;
  check_name: string;
  check_results: string;
  status: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

export default function Servers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
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
    vnc_password: ''
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

  // ESC key support for modals
  useEscapeKey({ onEscape: () => { setIsModalOpen(false); setSelectedServer(null); resetForm(); }, enabled: isModalOpen });
  useEscapeKey({ onEscape: () => setIsImportModalOpen(false), enabled: isImportModalOpen });
  useEscapeKey({ onEscape: () => { setIsGroupModalOpen(false); setEditingGroup(null); }, enabled: isGroupModalOpen });
  useEscapeKey({ onEscape: () => { setIsAiCommandModalOpen(false); setAiPrompt(''); setAiGeneratedCommand(''); setAiCommandExplanation(''); setAiGenerationError(''); setShowAiCommandConfirm(false); }, enabled: isAiCommandModalOpen });
  useEscapeKey({ onEscape: () => { setIsDeleteConfirmOpen(false); setPendingDeleteServer(null); }, enabled: isDeleteConfirmOpen });

  // 获取 Agent 列表（用于 AI 生成命令）
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return res.data.data as Array<{ id: string; name: string; enabled: number; category?: string }>;
    },
    enabled: true
  });
  // 认证凭证列表（用于选择已有凭证）
  const { data: sshKeys } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: async () => {
      const res = await api.get('/api/ssh-keys');
      return res.data.data as Array<{ id: string; name: string; key_type: string; fingerprint: string | null; usage_count: number }>;
    },
  });
  const [selectedSshKeyId, setSelectedSshKeyId] = useState<string>('');
  const [sshKeySearchQuery, setSshKeySearchQuery] = useState('');
  const [showSshKeyDropdown, setShowSshKeyDropdown] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '', parent_id: '' });
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
  const [importData, setImportData] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [showGroups, setShowGroups] = useState(false);
  // 标签输入相关
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

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

  // 解析当前已输入的标签
  const parseCurrentTags = useCallback(() => {
    return formData.tags ? formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  }, [formData.tags]);

  // 获取输入框中最后一段文本（用于过滤建议）
  const getLastTagFragment = useCallback(() => {
    const raw = formData.tags;
    const lastCommaIndex = raw.lastIndexOf(',');
    return lastCommaIndex >= 0 ? raw.substring(lastCommaIndex + 1).trim() : (raw || '').trim();
  }, [formData.tags]);

  // 添加标签到输入框
  const addTagToInput = useCallback((tag: string) => {
    const raw = formData.tags;
    const lastCommaIndex = raw.lastIndexOf(',');
    const beforeLast = lastCommaIndex >= 0 ? raw.substring(0, lastCommaIndex + 1) : '';
    // 替换最后一段为选中的标签，并追加逗号和空格
    setFormData({ ...formData, tags: beforeLast + tag + ', ' });
    tagInputRef.current?.focus();
  }, [formData]);

  // 从已选标签中删除
  const removeTag = useCallback((tagToRemove: string) => {
    const current = parseCurrentTags();
    const filtered = current.filter((t: string) => t !== tagToRemove);
    setFormData({ ...formData, tags: filtered.join(', ') });
  }, [formData.tags]);

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
  const allTags = Array.from(new Set(
    (Array.isArray(servers) ? servers : [])
      .flatMap((server: Server) => Array.isArray(server.tags) ? server.tags : [])
  )).sort();

  // 过滤认证凭证列表（按名称、类型或指纹搜索）
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

  // 过滤后的标签建议（排除已选的，按输入过滤）
  const filteredTagSuggestions = () => {
    const current = parseCurrentTags();
    const fragment = getLastTagFragment().toLowerCase();
    return allTags.filter((tag: string) => {
      if (current.includes(tag)) return false;
      if (fragment) return tag.toLowerCase().includes(fragment);
      return true;
    });
  };

  // 根据选中的标签或分组筛选服务器
  const safeServers = Array.isArray(servers) ? servers : [];
  const filteredServers = selectedGroupId
    ? safeServers.filter((server: Server) => (server.groups || []).some((g: any) => g.id === selectedGroupId))
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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
        ssh_key_id: selectedSshKeyId || undefined
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
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || '添加服务器失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload: Record<string, unknown> = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : undefined,
        ssh_key_id: selectedSshKeyId || undefined
      };
      // 编辑模式下 private_key 为空则不发送，避免覆盖已有密钥
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
    onError: (err: any) => {
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
    onError: (err: any) => {
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

  const [complianceOptions, setComplianceOptions] = useState({
    useAI: true,
    concurrency: 5
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
    mutationFn: async (data: { servers: any[]; test_connection: boolean }) => {
      const res = await api.post('/api/server-management/import', data);
      return res.data;
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: any) => {
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
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
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

  const resetForm = () => {
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
      vnc_password: ''
    });
    setSelectedSshKeyId('');
    setSshKeySearchQuery('');
    setShowSshKeyDropdown(false);
  };

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
    const serverSshKeyId = (server as any).ssh_key_id || '';
    setSelectedSshKeyId(serverSshKeyId);
    
    // 如果有认证凭证 ID，设置搜索框显示名称
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
      os_type: (server as any).os_type || 'linux',
      vnc_port: (server as any).vnc_port || 5900,
      vnc_password: ''
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
      }
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
      { 
        id: selectedServer.id,
        options: complianceOptions
      },
      {
        onSuccess: (data) => {
          setComplianceResults(data.data);
        },
        onSettled: () => {
          setIsRunningCompliance(false);
        },
      }
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
        disk_gb: aiCommandServer.disk_gb || ''
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
        serverIds: [aiCommandServer.id]
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
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || '未知错误';
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
      }
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
      const servers = importData.split('\n').filter(Boolean).map((line) => {
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
            group_id: item.group_id || undefined
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      if (servers.length === 0) {
        toast.error('没有有效的服务器数据，请检查 JSON 格式');
        return;
      }

      const result = await importServersMutation.mutateAsync({ servers, test_connection: true });
      setImportResult(result.data);
      toast.success(`导入成功: ${result.data.success} 成功, ${result.data.failed} 失败`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || '导入失败');
    }
  };

  const GroupTree = ({ groups, level = 0 }: { groups: ServerGroup[]; level?: number }) => (
    <div className={level > 0 ? 'ml-4' : ''}>
      {groups.map((group) => (
        <div key={group.id}>
          <div
            className={clsx(
              'flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors text-sm',
              selectedGroupId === group.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-background text-text-secondary'
            )}
            onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
          >
            {group.children && group.children.length > 0 ? (
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
            )}
            <FolderTree className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{group.name}</span>
            {group.server_count !== undefined && group.server_count > 0 && (
              <span className="ml-auto text-xs text-text-secondary">({group.server_count})</span>
            )}
          </div>
          {group.children && group.children.length > 0 && (
            <GroupTree groups={group.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === 'servers') {
      return (
        <>
          {/* 工具栏 */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowGroups(!showGroups)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border',
                showGroups
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border bg-surface text-text-secondary hover:text-text-primary'
              )}
            >
              <FolderTree className="w-4 h-4" />
              分组
            </button>
            <button
              onClick={handleCollectAll}
              disabled={isCollecting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-4 h-4', isCollecting && 'animate-spin')} />
              采集所有主机信息
            </button>
            <button
              onClick={handleCollectAllMetrics}
              disabled={isCollectingMetrics}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-4 h-4', isCollectingMetrics && 'animate-spin')} />
              采集所有性能指标
            </button>
            <button
              onClick={() => { setIsImportModalOpen(true); setImportResult(null); setImportData(''); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              <Upload className="w-4 h-4" />
              批量导入
            </button>
            <button
              onClick={() => { setEditingGroup(null); setGroupFormData({ name: '', description: '', parent_id: '' }); setIsGroupModalOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              新建分组
            </button>
          </div>

          <div className="flex gap-4">
            {/* 分组侧边栏 */}
            {showGroups && (
              <div className="w-56 flex-shrink-0 bg-surface border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-text-primary">服务器分组</h3>
                  <button
                    onClick={() => setSelectedGroupId(null)}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    清除筛选
                  </button>
                </div>
                {groupsData && groupsData.length > 0 ? (
                  <GroupTree groups={groupsData} />
                ) : (
                  <p className="text-xs text-text-secondary py-4 text-center">暂无分组</p>
                )}
              </div>
            )}

            {/* 服务器列表 */}
            <div className="flex-1">
              {/* 标签筛选器 */}
              {allTags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedTag(null); setSelectedGroupId(null); }}
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm transition-colors',
                      !selectedTag && !selectedGroupId
                        ? 'bg-primary text-white'
                        : 'bg-background border border-border text-text-secondary hover:bg-surface'
                    )}
                  >
                    全部
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => { setSelectedTag(selectedTag === tag ? null : tag); setSelectedGroupId(null); }}
                      className={clsx(
                        'px-3 py-1 rounded-full text-sm transition-colors',
                        selectedTag === tag
                          ? 'bg-primary text-white'
                          : 'bg-background border border-border text-text-secondary hover:bg-surface'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-surface border border-border rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-border rounded w-1/2 mb-2" />
                      <div className="h-3 bg-border rounded w-3/4" />
                    </div>
                  ))
                ) : filteredServers.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-text-secondary">
                    <Server className="w-12 h-12 mb-4 opacity-50" />
                    <p>{selectedTag ? `没有带标签 "${selectedTag}" 的服务器` : selectedGroupId ? '该分组下暂无服务器' : '暂无服务器，请添加第一个服务器'}</p>
                  </div>
                ) : filteredServers.map((server) => (
                  <div key={server.id} className={clsx(
                    'relative bg-surface border rounded-lg p-4 min-w-0 overflow-hidden',
                    server.os_type === 'linux' 
                      ? 'border-yellow-500/30' 
                      : server.os_type === 'windows' 
                        ? 'border-blue-500/30' 
                        : 'border-border'
                  )}>
                    {/* 操作系统左侧标识条 */}
                    <div className={clsx(
                      'absolute left-0 top-0 bottom-0 w-1',
                      server.os_type === 'linux' 
                        ? 'bg-gradient-to-b from-yellow-500 to-orange-500' 
                        : server.os_type === 'windows' 
                          ? 'bg-gradient-to-b from-blue-500 to-cyan-500' 
                          : 'bg-gradient-to-b from-text-tertiary/50 to-text-tertiary/30'
                    )} />
                    
                    <div className="flex items-start justify-between mb-3 min-w-0 pl-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          server.os_type === 'linux' 
                            ? 'bg-yellow-500/10' 
                            : server.os_type === 'windows' 
                              ? 'bg-blue-500/10' 
                              : 'bg-primary/10'
                        )}>
                          <Server className={clsx('w-4 h-4',
                            server.os_type === 'linux' 
                              ? 'text-yellow-500' 
                              : server.os_type === 'windows' 
                                ? 'text-blue-500' 
                                : 'text-primary'
                          )} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-text-primary truncate">{server.name}</h3>
                          <p className="text-xs text-text-secondary truncate">{server.hostname}:{server.port}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {server.os_type === 'windows' && (
                          <button
                            onClick={() => navigate(`/remote-desktop/${server.id}`)}
                            className="p-1 hover:bg-background rounded transition-colors"
                            title="远程桌面"
                          >
                            <MonitorPlay className="w-4 h-4 text-text-secondary" />
                          </button>
                        )}
                        <button
                          onClick={() => handleTestConnection(server)}
                          className="p-1 hover:bg-background rounded transition-colors"
                          title="测试连接"
                        >
                          <Wifi className="w-4 h-4 text-text-secondary" />
                        </button>
                        <button
                          onClick={() => handleCollectInfo(server)}
                          disabled={isCollecting}
                          className="p-1 hover:bg-background rounded transition-colors disabled:opacity-50"
                          title="采集主机信息"
                        >
                          <RefreshCw className={clsx('w-4 h-4 text-text-secondary', isCollecting && 'animate-spin')} />
                        </button>
                        <button
                          onClick={() => handleCollectMetrics(server)}
                          disabled={isCollectingMetrics}
                          className="p-1 hover:bg-background rounded transition-colors disabled:opacity-50"
                          title="采集性能指标"
                        >
                          <Monitor className={clsx('w-4 h-4 text-text-secondary', isCollectingMetrics && 'animate-spin')} />
                        </button>
                        <button
                          onClick={() => {
                            setPendingDeleteServer({ id: server.id, name: server.name });
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="p-1 hover:bg-background rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-status-failed" />
                        </button>
                        <button
                          onClick={() => handleEdit(server)}
                          className="p-1 hover:bg-background rounded transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-text-secondary" />
                        </button>
                      </div>
                    </div>
                    {server.description && (
                      <p className="text-xs text-text-secondary mb-3">{server.description}</p>
                    )}
                    
                    {/* 主机扩展信息 */}
                    {(server.os || server.cpu_cores || server.memory_gb || server.disk_gb) && (
                      <div className="mb-3 p-2 bg-background rounded-lg">
                        {server.os && (
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
                            <Monitor className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{server.os}</span>
                          </div>
                        )}
                        {(server.cpu_cores !== undefined || server.memory_gb !== undefined || server.disk_gb !== undefined) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {server.cpu_cores !== undefined && (
                              <div className="flex items-center gap-1.5 text-text-secondary">
                                <Cpu className="w-3 h-3 flex-shrink-0" />
                                <span>{server.cpu_cores} 核</span>
                              </div>
                            )}
                            {server.memory_gb !== undefined && (
                              <div className="flex items-center gap-1.5 text-text-secondary">
                                <MemoryStick className="w-3 h-3 flex-shrink-0" />
                                <span>{server.memory_gb} GB</span>
                              </div>
                            )}
                            {server.disk_gb !== undefined && (
                              <div className="flex items-center gap-1.5 text-text-secondary">
                                <HardDrive className="w-3 h-3 flex-shrink-0" />
                                <span>{server.disk_gb} GB</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 分组展示 */}
                    {server.groups && server.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {server.groups.map((g) => (
                          <span key={g.id} className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-xs rounded-full flex items-center gap-1">
                            <FolderTree className="w-2.5 h-2.5" />
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 标签展示 */}
                    {server.tags && server.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {server.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-3">
                      {server.last_connected ? (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          <CheckCircle2 className="w-3 h-3 text-status-success" />
                          最后连接: {new Date(server.last_connected).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          <AlertCircle className="w-3 h-3 text-status-warning" />
                          未连接过
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <button
                        onClick={() => {
                          setAiCommandServer(server);
                          setAiPrompt('');
                          setAiGeneratedCommand('');
                          setAiCommandExplanation('');
                          setAiGenerationError('');
                          setShowAiCommandConfirm(false);
                          if (agents) {
                            const cmdAgent = agents.find(a =>
                              a.enabled === 1 && (
                                a.name?.includes('命令生成') ||
                                a.category?.includes('命令生成')
                              )
                            );
                            const serverAgent = agents.find(a =>
                              a.enabled === 1 && (
                                a.category?.includes('服务器') ||
                                a.name?.includes('命令') ||
                                a.name?.includes('服务')
                              )
                            );
                            const firstAgent = agents.find(a => a.enabled === 1);
                            setSelectedAiAgent(cmdAgent || serverAgent || firstAgent || null);
                          }
                          setIsAiCommandModalOpen(true);
                        }}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg text-xs font-medium text-purple-300 whitespace-nowrap hover:from-purple-600/30 hover:to-blue-600/30 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>AI 执行</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedServer(server);
                          setCommandResult(null);
                        }}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary whitespace-nowrap hover:bg-background transition-colors"
                      >
                        <Terminal className="w-4 h-4" />
                        <span>执行命令</span>
                      </button>
                      <button
                        onClick={() => handleRunCompliance(server)}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary whitespace-nowrap hover:bg-background transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>合规检查</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => {
                          setSelectedServer(server);
                          setActiveTab('command-history');
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>命令历史</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedServer(server);
                          setActiveTab('compliance-history');
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>检查历史</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    } else if (activeTab === 'compliance' && selectedServer) {
      return (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-text-primary">合规检查结果</h2>
              <p className="text-sm text-text-secondary">{selectedServer.name} - {selectedServer.hostname}</p>
            </div>
            {isRunningCompliance && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                正在执行检查...
              </div>
            )}
          </div>

          {/* 合规检查选项 */}
          <div className="mb-6 p-4 bg-background rounded-lg border border-border">
            <h3 className="text-sm font-medium text-text-primary mb-4">检查选项</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface/50 transition-colors border border-transparent hover:border-border">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={complianceOptions.useAI}
                    onChange={(e) => {
                      setComplianceOptions(prev => ({
                        ...prev,
                        useAI: e.target.checked
                      }));
                    }}
                    disabled={isRunningCompliance}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-surface border-2 border-border rounded-full peer peer-checked:bg-primary peer-checked:border-primary transition-all cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full shadow-md absolute top-1 left-1 peer-checked:translate-x-4 transition-transform"></div>
                  </div>
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">AI 智能分析</span>
                    {complianceOptions.useAI && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">推荐</span>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary mt-0.5">
                    {complianceOptions.useAI 
                      ? '🤖 对检查结果进行智能分析，给出专业建议' 
                      : '⚡ 仅执行命令，检查速度提升 60%'
                    }
                  </span>
                </div>
              </label>
              <div className="flex items-center gap-3 p-2 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text-primary">并发执行数</span>
                  <span className="text-xs text-text-secondary mt-0.5">同时执行的检查命令数量</span>
                </div>
                <select
                  value={complianceOptions.concurrency}
                  onChange={(e) => {
                    setComplianceOptions(prev => ({
                      ...prev,
                      concurrency: parseInt(e.target.value)
                    }));
                  }}
                  disabled={isRunningCompliance}
                  className="ml-auto w-28 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary font-medium"
                >
                  <option value={3}>3 (较慢)</option>
                  <option value={5}>5 (推荐)</option>
                  <option value={8}>8 (较快)</option>
                  <option value={10}>10 (最快)</option>
                </select>
              </div>
            </div>
          </div>

          {complianceResults ? (
            <div className="space-y-4">
              {Object.entries(complianceResults).map(([checkName, result]) => (
                <div key={checkName} className="bg-background rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-text-primary">
                      {checkName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h4>
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-medium',
                      result.success ? 'bg-status-success/10 text-status-success' : 'bg-status-failed/10 text-status-failed'
                    )}>
                      {result.success ? '成功' : '失败'}
                    </span>
                  </div>
                  
                  {/* AI 分析结果 */}
                  {result.aiAnalysis && (
                    <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 text-primary">🤖</div>
                        <span className="text-sm font-medium text-primary">AI 分析建议</span>
                      </div>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{result.aiAnalysis}</p>
                    </div>
                  )}
                  
                  <details className="mt-2">
                    <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                      查看原始命令和输出
                    </summary>
                    <div className="mt-2">
                      <div className="text-sm text-text-secondary mb-1">命令: <code className="font-mono text-xs bg-surface px-1 rounded">{result.command}</code></div>
                      {result.stdout && (
                        <div className="mt-2">
                          <p className="text-xs text-text-secondary mb-1">输出:</p>
                          <pre className="bg-surface p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-40 overflow-y-auto">
                            {result.stdout}
                          </pre>
                        </div>
                      )}
                      {result.stderr && (
                        <div className="mt-2">
                          <p className="text-xs text-status-warning mb-1">错误:</p>
                          <pre className="bg-status-failed/5 p-3 rounded text-xs overflow-x-auto text-status-failed font-mono max-h-40 overflow-y-auto">
                            {result.stderr}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-text-secondary">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>点击&quot;合规检查&quot;按钮开始执行检查</p>
            </div>
          )}

          {/* 重新检查按钮 */}
          {complianceResults && (
            <div className="mt-6 pt-6 border-t border-border flex justify-center">
              <button
                onClick={() => handleRunCompliance(selectedServer)}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Settings className="w-4 h-4" />
                重新执行检查（设置选项）
              </button>
            </div>
          )}
        </div>
      );
    } else if (activeTab === 'command-history' && selectedServer) {
      const handleExportCommandHistory = async () => {
        try {
          const response = await api.get(`/api/servers/${selectedServer.id}/command-history/export`, {
            responseType: 'blob'
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `command-history-${selectedServer.id}-${Date.now()}.json`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        } catch (error) {
          console.error('导出失败:', error);
        }
      };

      return (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-primary">命令历史 - {selectedServer.name}</h2>
            <button
              onClick={handleExportCommandHistory}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <span>📥</span>
              导出历史
            </button>
          </div>
          <div className="space-y-4">
            {commandHistory?.map((item) => (
              <div key={item.id} className="bg-background rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs text-text-secondary">
                      {new Date(item.executed_at).toLocaleString()}
                    </span>
                  </div>
                  <span className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    item.success ? 'bg-status-success/10 text-status-success' : 'bg-status-failed/10 text-status-failed'
                  )}>
                    {item.success ? '成功' : '失败'}
                  </span>
                </div>
                <div className="mb-2">
                  <code className="font-mono text-sm bg-surface px-2 py-1 rounded text-text-primary">
                    {item.command}
                  </code>
                </div>
                {item.stdout && (
                  <details className="mt-2">
                    <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                      输出 ({item.stdout.length} 字符)
                    </summary>
                    <pre className="mt-2 bg-surface p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-40 overflow-y-auto">
                      {item.stdout}
                    </pre>
                  </details>
                )}
                {item.stderr && (
                  <details className="mt-2">
                    <summary className="text-xs text-status-warning cursor-pointer hover:text-text-primary">
                      错误 ({item.stderr.length} 字符)
                    </summary>
                    <pre className="mt-2 bg-status-failed/5 p-3 rounded text-xs overflow-x-auto text-status-failed font-mono max-h-40 overflow-y-auto">
                      {item.stderr}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            {(!commandHistory || commandHistory.length === 0) && (
              <div className="text-center py-12 text-text-secondary">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无命令历史</p>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeTab === 'compliance-history' && selectedServer) {
      const handleExportComplianceHistory = async () => {
        try {
          const response = await api.get(`/api/servers/${selectedServer.id}/compliance-history/export`, {
            responseType: 'blob'
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `compliance-history-${selectedServer.id}-${Date.now()}.json`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        } catch (error) {
          console.error('导出失败:', error);
        }
      };

      return (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-primary">合规检查历史 - {selectedServer.name}</h2>
            <button
              onClick={handleExportComplianceHistory}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <span>📥</span>
              导出历史
            </button>
          </div>
          <div className="space-y-4">
            {complianceHistory?.map((check) => (
              <div key={check.id} className="bg-background rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-text-primary">{check.check_name}</h4>
                  <span className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    check.status === 'completed' ? 'bg-status-success/10 text-status-success' : 
                    check.status === 'running' ? 'bg-status-running/10 text-status-running' : 
                    'bg-status-failed/10 text-status-failed'
                  )}>
                    {check.status === 'completed' ? '已完成' : check.status === 'running' ? '执行中' : '失败'}
                  </span>
                </div>
                <div className="text-xs text-text-secondary space-y-1">
                  <p>开始: {check.started_at ? new Date(check.started_at).toLocaleString() : '-'}</p>
                  <p>完成: {check.completed_at ? new Date(check.completed_at).toLocaleString() : '-'}</p>
                </div>
                {check.check_results && (
                  <details className="mt-3">
                    <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                      查看结果
                    </summary>
                    <pre className="mt-2 bg-surface p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-60 overflow-y-auto">
                      {check.check_results}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            {(!complianceHistory || complianceHistory.length === 0) && (
              <div className="text-center py-12 text-text-secondary">
                <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无合规检查历史</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">服务器管理</h1>
            <p className="text-text-secondary">管理和监控您的服务器</p>
          </div>
          <div className="flex items-center gap-3">
            <ImportExport resourceType="servers" onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['servers'] })} />
            <button
              onClick={() => {
                resetForm();
                setSelectedServer(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加服务器
            </button>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary mb-2">使用说明</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gradient-to-b from-yellow-500 to-orange-500 flex-shrink-0" />
                  <span><strong>Linux 服务器</strong>：左侧黄橙渐变标识，支持 SSH 命令执行</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gradient-to-b from-blue-500 to-cyan-500 flex-shrink-0" />
                  <span><strong>Windows 服务器</strong>：左侧蓝青渐变标识，支持远程桌面</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 flex-shrink-0" />
                  <span><strong>采集信息</strong>：获取服务器 OS、CPU、内存、磁盘等信息</span>
                </div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 flex-shrink-0" />
                  <span><strong>执行命令</strong>：通过 SSH 远程执行命令，查看执行历史</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => {
              setActiveTab('servers');
              setSelectedServer(null);
            }}
            className={clsx(
              'px-4 py-2 border-b-2 text-sm transition-colors',
              activeTab === 'servers'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            服务器列表
          </button>
          {selectedServer && (
            <>
              <button
                onClick={() => setActiveTab('compliance')}
                className={clsx(
                  'px-4 py-2 border-b-2 text-sm transition-colors',
                  activeTab === 'compliance'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                )}
              >
                合规检查
              </button>
              <button
                onClick={() => setActiveTab('command-history')}
                className={clsx(
                  'px-4 py-2 border-b-2 text-sm transition-colors',
                  activeTab === 'command-history'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                )}
              >
                命令历史
              </button>
              <button
                onClick={() => setActiveTab('compliance-history')}
                className={clsx(
                  'px-4 py-2 border-b-2 text-sm transition-colors',
                  activeTab === 'compliance-history'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                )}
              >
                检查历史
              </button>
            </>
          )}
        </div>

        {/* 内容区域 */}
        {renderTabContent()}

        {/* 命令执行模态框 */}
        {selectedServer && (activeTab === 'servers' || activeTab === 'compliance') && commandResult !== null && (
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">命令执行结果</h3>
              <button
                onClick={() => setCommandResult(null)}
                className="p-1 hover:bg-background rounded transition-colors"
              >
                <Trash2 className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-secondary mb-1">执行的命令:</p>
                <code className="font-mono text-sm bg-background px-2 py-1 rounded text-text-primary">
                  {commandResult.command}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">状态:</span>
                <span className={clsx(
                  'px-2 py-1 rounded text-xs font-medium',
                  commandResult.success ? 'bg-status-success/10 text-status-success' : 'bg-status-failed/10 text-status-failed'
                )}>
                  {commandResult.success ? '成功' : '失败'}
                </span>
                <span className="text-xs text-text-secondary ml-4">
                  耗时: {commandResult.duration}ms
                </span>
              </div>
              {commandResult.stdout && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">输出:</p>
                  <pre className="bg-background p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-60 overflow-y-auto">
                    {commandResult.stdout}
                  </pre>
                </div>
              )}
              {commandResult.stderr && (
                <div>
                  <p className="text-xs text-status-warning mb-1">错误:</p>
                  <pre className="bg-status-failed/5 p-3 rounded text-xs overflow-x-auto text-status-failed font-mono max-h-60 overflow-y-auto">
                    {commandResult.stderr}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 快速命令执行区域 */}
        {selectedServer && (activeTab === 'servers' || activeTab === 'compliance') && (
          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              在 {selectedServer.name} 上执行命令
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">命令</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="输入要执行的命令..."
                    className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                    disabled={isExecuting}
                  />
                  <button
                    onClick={handleExecuteCommand}
                    disabled={!command || isExecuting}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        执行中...
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4" />
                        执行
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-text-secondary">常用命令:</span>
                {['uname -a', 'df -h', 'free -h', 'uptime', 'whoami', 'ps aux'].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => setCommand(cmd)}
                    className="px-2 py-1 bg-background border border-border rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 添加/编辑服务器模态框 */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-text-primary mb-6">
                {selectedServer ? '编辑服务器' : '添加服务器'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">名称 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例如: 生产服务器"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">主机名/IP *</label>
                    <input
                      type="text"
                      value={formData.hostname}
                      onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                      placeholder="例如: 192.168.1.100"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">端口</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                      placeholder="22"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">操作系统类型</label>
                    <select
                      value={formData.os_type}
                      onChange={(e) => setFormData({ ...formData, os_type: e.target.value as 'linux' | 'windows' })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                    >
                      <option value="linux">Linux</option>
                      <option value="windows">Windows</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">用户名 *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="例如: root"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use_ssh_key"
                    checked={formData.use_ssh_key}
                    onChange={(e) => setFormData({ ...formData, use_ssh_key: e.target.checked })}
                    className="rounded border-border"
                  />
                  <label htmlFor="use_ssh_key" className="text-sm text-text-secondary">使用认证凭证</label>
                </div>

                {!formData.use_ssh_key ? (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">密码</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={selectedServer ? '留空以保持不变' : '输入密码'}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">SSH 私钥</label>
                    {sshKeys && sshKeys.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-3.5 h-3.5 text-text-tertiary" />
                          <span className="text-xs text-text-tertiary">从已有密钥中选择</span>
                        </div>
                        
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                          <input
                            type="text"
                            value={sshKeySearchQuery}
                            onChange={(e) => setSshKeySearchQuery(e.target.value)}
                            onFocus={() => setShowSshKeyDropdown(true)}
                            onBlur={() => {
                              setTimeout(() => setShowSshKeyDropdown(false), 200);
                            }}
                            placeholder="搜索密钥名称、类型或指纹..."
                            className="w-full pl-10 pr-10 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary text-sm"
                          />
                          {selectedSshKeyId && sshKeys.find(k => k.id === selectedSshKeyId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSshKeyId('');
                                setSshKeySearchQuery('');
                                setFormData({ ...formData, private_key: '' });
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {showSshKeyDropdown && (
                          <div className="mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg z-10">
                            {filteredSshKeys.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-text-tertiary text-center">
                                未找到匹配的密钥
                              </div>
                            ) : (
                              filteredSshKeys.map((key) => (
                                <button
                                  key={key.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={async () => {
                                    try {
                                      const res = await api.get(`/api/ssh-keys/${key.id}`);
                                      setSelectedSshKeyId(key.id);
                                      setSshKeySearchQuery(`${key.name} (${key.key_type})`);
                                      setFormData({ ...formData, private_key: res.data.data.private_key });
                                      setShowSshKeyDropdown(false);
                                    } catch {
                                      toast.error('获取 SSH 私钥失败');
                                    }
                                  }}
                                  className={clsx(
                                    'w-full px-4 py-2.5 text-left hover:bg-primary/5 transition-colors border-b border-border/50 last:border-b-0',
                                    selectedSshKeyId === key.id && 'bg-primary/10'
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-text-primary font-medium">{key.name}</span>
                                    <span className="text-xs text-text-tertiary">{key.key_type}</span>
                                  </div>
                                  {key.fingerprint && (
                                    <div className="text-xs text-text-tertiary mt-0.5 font-mono">
                                      {key.fingerprint.slice(0, 30)}...
                                    </div>
                                  )}
                                  {key.usage_count > 0 && (
                                    <div className="text-xs text-status-success mt-0.5">
                                      已用于 {key.usage_count} 台服务器
                                    </div>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}

                        {selectedSshKeyId && sshKeys.find(k => k.id === selectedSshKeyId) && !showSshKeyDropdown && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-status-success">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>当前已选择: {sshKeys.find((k) => k.id === selectedSshKeyId)?.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => { resetForm(); setIsModalOpen(false); navigate('/ssh-keys'); }}
                            className="text-xs text-primary hover:underline"
                          >
                            + 管理认证凭证
                          </button>
                        </div>
                      </div>
                    )}
                    <textarea
                      value={formData.private_key}
                      onChange={(e) => {
                        setSelectedSshKeyId('');
                        setFormData({ ...formData, private_key: e.target.value });
                      }}
                      placeholder={selectedServer && !selectedSshKeyId ? '留空以保持不变' : selectedSshKeyId ? '已选择上方密钥，手动编辑可覆盖' : '粘贴您的私钥，或从上方选择已有密钥...'}
                      rows={6}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary font-mono text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="服务器描述..."
                    rows={3}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    标签
                  </label>
                  {/* 已选标签展示 */}
                  {parseCurrentTags().length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {parseCurrentTags().map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                    {/* 标签输入框 + 下拉建议 */}
                    <div className="relative">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        onFocus={() => setTagDropdownOpen(true)}
                        onBlur={() => {
                          // 延迟关闭，让下拉按钮的onClick先触发
                          setTimeout(() => setTagDropdownOpen(false), 200);
                        }}
                        placeholder="输入标签名称，从下方选择或手动输入（逗号分隔）"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                      />
                      {/* 下拉建议框 */}
                      {tagDropdownOpen && filteredTagSuggestions().length > 0 && (
                        <div
                          ref={tagDropdownRef}
                          className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto animate-fade-in"
                        >
                          <div className="px-3 py-2 text-xs text-text-tertiary border-b border-border">
                            选择已有标签
                          </div>
                          {filteredTagSuggestions().map((tag: string) => (
                            <button
                              key={tag}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); addTagToInput(tag); }}
                              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-primary/10 transition-colors flex items-center gap-2"
                            >
                              <span className="w-2 h-2 rounded-full bg-primary/50 flex-shrink-0" />
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  {allTags.length === 0 && (
                    <p className="mt-1 text-xs text-text-tertiary">添加服务器后，标签将在此处显示为可选项</p>
                  )}
                </div>

                {formData.os_type === 'windows' && (
                  <div className="pt-2 border-t border-border">
                    <h4 className="text-sm font-medium text-text-primary mb-3">VNC 配置（远程桌面）</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">VNC 端口</label>
                        <input
                          type="number"
                          value={formData.vnc_port}
                          onChange={(e) => setFormData({ ...formData, vnc_port: parseInt(e.target.value) || 5900 })}
                          placeholder="5900"
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">VNC 密码</label>
                        <input
                          type="password"
                          value={formData.vnc_password}
                          onChange={(e) => setFormData({ ...formData, vnc_password: e.target.value })}
                          placeholder={selectedServer ? '留空以保持不变' : 'VNC 密码'}
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                      setSelectedServer(null);
                    }}
                    className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {selectedServer ? '保存更改' : '添加服务器'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 批量导入模态框 */}
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-text-primary mb-4">批量导入服务器</h3>
              <p className="text-sm text-text-secondary mb-4">每行一个 JSON 对象，包含以下字段：name, hostname, port, username, password, use_ssh_key(0/1), description, tags(逗号分隔)</p>
              <div className="mb-4 p-3 bg-background rounded-lg">
                <p className="text-xs text-text-secondary font-mono mb-2">示例:</p>
                <pre className="text-xs text-text-secondary font-mono overflow-x-auto">{`{"name":"Web-01","hostname":"192.168.1.10","port":22,"username":"root","password":"xxx","use_ssh_key":0,"description":"生产服务器","tags":"prod,web"}`}</pre>
              </div>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="每行一个 JSON 对象..."
                rows={8}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary font-mono text-sm"
              />
              {importResult && (
                <div className="mt-4 p-4 bg-background rounded-lg">
                  <h4 className="font-medium text-text-primary mb-2">导入结果</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="text-2xl font-bold text-status-success">{importResult.success}</span>
                      <p className="text-xs text-text-secondary">成功</p>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-status-failed">{importResult.failed}</span>
                      <p className="text-xs text-text-secondary">失败</p>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-text-secondary">{importResult.skipped}</span>
                      <p className="text-xs text-text-secondary">跳过(重复)</p>
                    </div>
                  </div>
                  {importResult.details && importResult.details.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      {importResult.details.map((d: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1 text-xs">
                          <span>{d.name} ({d.hostname})</span>
                          <span className={d.status === 'success' ? 'text-status-success' : d.status === 'duplicate' ? 'text-text-secondary' : 'text-status-failed'}>
                            {d.status === 'success' ? '✓ 成功' : d.status === 'duplicate' ? '跳过' : `✗ ${d.error}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importData}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  导入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 分组管理模态框 */}
        {isGroupModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold text-text-primary mb-6">
                {editingGroup ? '编辑分组' : '新建分组'}
              </h3>
              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">分组名称 *</label>
                  <input
                    type="text"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    placeholder="例如: 生产环境"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">父分组</label>
                  <select
                    value={groupFormData.parent_id}
                    onChange={(e) => setGroupFormData({ ...groupFormData, parent_id: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  >
                    <option value="">无 (根分组)</option>
                    {(groupsData || []).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                  <textarea
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    placeholder="分组描述..."
                    rows={3}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setIsGroupModalOpen(false); setEditingGroup(null); }}
                    className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {editingGroup ? '保存更改' : '创建分组'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AI 命令生成模态框 */}
        {isAiCommandModalOpen && aiCommandServer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl p-8 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
                    <Bot className="w-5 h-5 text-text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">AI 智能命令生成</h3>
                    <p className="text-sm text-text-secondary mt-1.5">
                      {aiCommandServer.name} ({aiCommandServer.hostname})
                      {selectedAiAgent && (
                        <span className="ml-2 text-text-tertiary">
                          · 默认调用 <span className="font-medium text-text-secondary">{selectedAiAgent.name} Agent</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAiCommandModalOpen(false);
                    setAiPrompt('');
                    setAiGeneratedCommand('');
                    setAiCommandExplanation('');
                    setAiGenerationError('');
                    setShowAiCommandConfirm(false);
                  }}
                  className="p-2 hover:bg-background rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* 无 Agent 提示 */}
              {!selectedAiAgent && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300 font-medium">
                    没有可用的 AI Agent。请先前往「Agent 管理」页面创建并启用一个 Agent。
                  </p>
                </div>
              )}

              {/* 生成错误提示 */}
              {aiGenerationError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300 font-medium">{aiGenerationError}</p>
                </div>
              )}

              {/* 操作系统信息展示 */}
              <div className="mb-6 p-3 bg-background border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Server className="w-4 h-4 text-text-secondary" />
                    <span className="text-text-secondary">目标操作系统：</span>
                    <span className="text-text-primary font-medium">
                      {aiCommandServer?.os || aiCommandServer?.os_type || 'linux (默认，未采集信息)'}
                    </span>
                  </div>
                  {!aiCommandServer?.os && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      建议先采集服务器信息，以便生成更准确的命令
                    </span>
                  )}
                </div>
              </div>

              {/* 输入提示 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">请描述您要执行的操作</label>
                <div className="relative">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="例如：查看磁盘使用情况 / 查看内存占用前 10 的进程 / 检查 Nginx 是否运行..."
                    rows={3}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:border-purple-500 text-text-primary resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiGenerateCommand();
                      }
                    }}
                  />
                  <button
                    onClick={handleAiGenerateCommand}
                    disabled={isAiGenerating || !aiPrompt.trim()}
                    className="absolute right-3 bottom-3 px-4 py-1.5 bg-text-primary text-surface rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAiGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        生成命令
                      </>
                    )}
                  </button>
                </div>
                {/* 快捷提示 - 根据操作系统类型显示不同选项 */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(aiCommandServer?.os_type === 'windows' ? [
                    '查看磁盘使用情况',
                    '检查内存占用前10的进程',
                    '查看端口监听情况',
                    '检查IIS服务状态',
                    '查看系统负载情况',
                    '查看系统事件日志',
                    '查看当前登录用户',
                    '清理临时文件',
                    '检查Windows服务状态'
                  ] : [
                    '查看磁盘使用率',
                    '检查内存占用前10的进程',
                    '查看端口监听情况',
                    '检查Nginx服务状态',
                    '查看系统负载情况',
                    '查看系统日志最后20行',
                    '查看当前登录用户',
                    '清理临时文件',
                    '检查Docker容器状态'
                  ]).map((tip) => (
                    <button
                      key={tip}
                      onClick={() => setAiPrompt(tip)}
                      className="px-4 py-1.5 bg-surface/80 border border-border/50 text-text-primary rounded-full text-sm hover:bg-surface hover:border-purple-500/40 transition-colors"
                    >
                      {tip}
                    </button>
                  ))}
                </div>
              </div>

              {/* 生成的命令 */}
              {aiGeneratedCommand && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-text-secondary">AI 生成的命令（可编辑）</label>
                    <button
                      onClick={() => navigator.clipboard.writeText(aiGeneratedCommand)}
                      className="text-xs text-text-tertiary hover:text-text-secondary"
                    >
                      复制命令
                    </button>
                  </div>
                  <textarea
                    value={aiGeneratedCommand}
                    onChange={(e) => setAiGeneratedCommand(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-black/80 border border-border rounded-lg font-mono text-sm text-green-400 focus:outline-none focus:border-purple-500 resize-y"
                  />
                  {aiCommandExplanation && (
                    <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
                      <p className="text-sm text-yellow-300 dark:text-yellow-200 font-medium">
                        <strong>💡 说明：</strong>{aiCommandExplanation}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
                    <p className="text-sm text-red-300 dark:text-red-200 font-medium">
                      <strong>⚠️ 警告：</strong>请仔细确认命令的安全性和正确性，再执行！错误的命令可能导致数据丢失或系统故障。
                    </p>
                  </div>
                </div>
              )}

              {/* 按钮组 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsAiCommandModalOpen(false);
                    setAiPrompt('');
                    setAiGeneratedCommand('');
                    setAiCommandExplanation('');
                    setAiGenerationError('');
                    setShowAiCommandConfirm(false);
                  }}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                {aiGeneratedCommand && (
                  <>
                    <button
                      onClick={() => {
                        setAiGeneratedCommand('');
                        setAiCommandExplanation('');
                        setAiGenerationError('');
                        handleAiGenerateCommand();
                      }}
                      disabled={isAiGenerating}
                      className="flex-1 px-4 py-2 bg-surface border border-border text-text-secondary rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={clsx('w-4 h-4', isAiGenerating && 'animate-spin')} />
                      重新生成
                    </button>
                    <button
                      onClick={handleExecuteAiCommand}
                      className="flex-1 px-4 py-2 bg-text-primary text-surface rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <Terminal className="w-4 h-4" />
                      确认并执行
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI 命令执行确认弹窗 */}
        {showAiCommandConfirm && aiCommandServer && aiGeneratedCommand && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
            <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4">
              <h3 className="text-lg font-bold text-text-primary mb-4">确认执行命令</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Server className="w-4 h-4 text-text-secondary" />
                  <span className="text-text-secondary">目标服务器：</span>
                  <span className="text-text-primary font-medium">{aiCommandServer.name} ({aiCommandServer.hostname})</span>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">执行命令：</span>
                  <div className="mt-1 bg-black/80 rounded-lg p-3">
                    <code className="text-green-400 font-mono text-sm break-all">{aiGeneratedCommand}</code>
                  </div>
                </div>
                {aiCommandExplanation && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      <strong>💡 说明：</strong>{aiCommandExplanation}
                    </p>
                  </div>
                )}
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-300 font-medium">
                    ⚠️ 此操作将在目标服务器上执行命令，请确认命令的安全性！
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAiCommandConfirm(false)}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmExecuteAiCommand}
                  className="flex-1 px-4 py-2 bg-text-primary text-surface rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Terminal className="w-4 h-4" />
                  确认执行
                </button>
              </div>
            </div>
          </div>
        )}
        {isDeleteConfirmOpen && pendingDeleteServer && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => { setIsDeleteConfirmOpen(false); setPendingDeleteServer(null); }}>
            <div className="bg-gradient-to-br from-surface/70 to-background/70 backdrop-blur-xl rounded-xl p-6 w-full max-w-md mx-4 border border-red-500/20" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                删除服务器
              </h3>
              <p className="text-text-secondary mb-6">
                确定要删除服务器 <span className="text-text-primary font-medium">{pendingDeleteServer.name}</span> 吗？此操作不可撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsDeleteConfirmOpen(false); setPendingDeleteServer(null); }}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate(pendingDeleteServer.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 合规检查选项弹窗 */}
        {showComplianceOptions && selectedServer && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setShowComplianceOptions(false)}>
            <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">合规检查</h3>
                    <p className="text-sm text-text-secondary mt-1">{selectedServer.name} ({selectedServer.hostname})</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowComplianceOptions(false)}
                  className="p-2 hover:bg-background rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="space-y-6">
                {/* AI 智能分析开关 */}
                <div className="p-4 bg-background rounded-lg border border-border">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">AI 智能分析</span>
                        {complianceOptions.useAI && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">推荐</span>
                        )}
                      </div>
                      <span className="text-xs text-text-tertiary mt-1">
                        {complianceOptions.useAI 
                          ? '🤖 对检查结果进行智能分析，给出专业建议' 
                          : '⚡ 仅执行命令，检查速度提升 60%'
                        }
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={complianceOptions.useAI}
                        onChange={(e) => setComplianceOptions(prev => ({ ...prev, useAI: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface border-2 border-border rounded-full peer peer-checked:bg-primary peer-checked:border-primary transition-all">
                        <div className="w-4 h-4 bg-white rounded-full shadow-md absolute top-0.5 left-0.5 peer-checked:translate-x-5 transition-transform"></div>
                      </div>
                    </div>
                  </label>
                </div>

                {/* 并发数选择 */}
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-medium text-text-primary">并发执行数</span>
                      <p className="text-xs text-text-tertiary mt-1">同时执行的检查命令数量</p>
                    </div>
                    <span className="text-lg font-bold text-primary">{complianceOptions.concurrency}</span>
                  </div>
                  <div className="flex gap-2">
                    {[3, 5, 8, 10].map(num => (
                      <button
                        key={num}
                        onClick={() => setComplianceOptions(prev => ({ ...prev, concurrency: num }))}
                        className={clsx(
                          'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                          complianceOptions.concurrency === num
                            ? 'bg-primary text-white'
                            : 'bg-surface text-text-secondary hover:text-text-primary border border-border'
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-text-tertiary">
                    <span>较慢（稳定）</span>
                    <span>推荐</span>
                    <span>较快（对服务器压力大）</span>
                  </div>
                </div>

                {/* 预计时间提示 */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300">
                    ⏱️ 预计执行时间：约 <strong>{complianceOptions.useAI ? 15 + (10 - complianceOptions.concurrency) * 2 : 3 + (10 - complianceOptions.concurrency)}</strong> 秒
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowComplianceOptions(false)}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={startComplianceCheck}
                  disabled={isRunningCompliance}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRunningCompliance ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      检查中...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      开始检查
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
