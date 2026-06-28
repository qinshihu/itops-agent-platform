import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Edit, Trash2, Play, Clock, Search, 
  ChevronLeft, BookOpen, Server, Database
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import MarkdownOutput from '../../../shared/components/MarkdownOutput';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: number;
  is_preset: number;
  category?: string;
  tags?: string[];
  description?: string;
  usage_count?: number;
  last_used_at?: string;
  primary_model_id?: string;
  fallback_model_id?: string;
  primary_model_name?: string;
  fallback_model_name?: string;
}

interface AIModel {
  id: string;
  name: string;
  provider_type: string;
  model_id: string;
  enabled: number;
}

interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  enabled: number;
}

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  database: string;
  description?: string;
  enabled: number;
}

interface AgentExecution {
  id: string;
  agent_id: string;
  agent_name: string;
  input_text: string;
  output_text: string;
  status: string;
  error_message?: string;
  execution_time_ms: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export default function Agents() {
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
      const res = await api.get('/api/agents', { params });
      return res.data.data as Agent[];
    },
  });

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
      return res.data.data as Server[];
    },
  });

  const { data: dbConnections } = useQuery({
    queryKey: ['db-connections'],
    queryFn: async () => {
      const res = await api.get('/api/db-connections');
      return res.data.data as DbConnection[];
    },
  });

  // Get unique categories from agents
  const categories = Array.from(new Set((agents || []).map(a => a.category).filter(Boolean) as string[]));

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/agents/${id}`);
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
      const res = await api.post(`/api/agents/${agentId}/test`, payload);
      return res.data.data;
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
      // 数据库运维Agent：清空服务器选择，默认选中第一个可用的数据库
      setSelectedServerIds([]);
      const firstEnabled = dbConnections?.find((d) => d.enabled);
      if (firstEnabled) {
        setSelectedDatabaseId(firstEnabled.id);
      } else {
        setSelectedDatabaseId('');
      }
    } else {
      // 其他Agent：默认选择所有服务器
      if (servers && servers.length > 0 && selectedServerIds.length === 0) {
        setSelectedServerIds(servers.filter((s) => s.enabled).map((s) => s.id));
      }
    }
    
    // 根据 Agent 名字自动填入预设的测试输入
    const presetInputs: Record<string, string> = {
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
    
    const defaultInput = presetInputs[agent.name] || '请描述您要处理的运维问题';
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

  if (showDetail) {
    return (
      <AgentDetailInner 
        agentId={showDetail} 
        onBack={() => setShowDetail(null)} 
        deleteMutation={deleteMutation}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Agent管理</h1>
            <p className="text-text-secondary">管理运维自动化Agent</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-semibold hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              新建Agent
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-r from-surface to-background backdrop-blur-xl rounded-2xl p-5 border border-border/50 flex flex-wrap gap-4 items-center shadow-lg">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索Agent..."
              className="px-4 py-2 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all w-64"
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-text-secondary font-medium">分类:</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                !selectedCategory
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25"
                  : "bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary"
              )}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={clsx(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  selectedCategory === cat
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25"
                    : "bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 border border-border/50 animate-pulse">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-slate-700/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-slate-700/50 rounded" />
                    <div className="h-4 w-24 bg-slate-700/50 rounded" />
                  </div>
                </div>
                <div className="space-y-2 mb-5">
                  <div className="h-4 bg-slate-700/50 rounded" />
                  <div className="h-4 w-3/4 bg-slate-700/50 rounded" />
                </div>
                <div className="border-t border-slate-700/30 pt-3 space-y-2">
                  <div className="h-4 bg-slate-700/50 rounded" />
                  <div className="h-4 bg-slate-700/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="group relative bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 border border-border hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Background glow effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl -z-10 group-hover:opacity-100 opacity-50 transition-opacity" />
                
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowDetail(agent.id)}>
                    <div className="relative">
                      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 shadow-lg shadow-blue-500/20 text-3xl">
                        {agent.avatar}
                      </div>
                      <div className="absolute -bottom-1 -right-1">
                        <div className={clsx(
                          "w-4 h-4 rounded-full border-2 border-surface",
                          agent.enabled ? "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-500/40" : "bg-gradient-to-r from-slate-500 to-slate-600"
                        )} />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary tracking-tight group-hover:text-blue-300 transition-colors">{agent.name}</h3>
                      <p className="text-sm text-text-secondary mt-1">{agent.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {agent.is_preset === 1 && (
                      <span className="px-3 py-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-400 text-xs rounded-full border border-blue-500/30 font-medium">
                        预设
                      </span>
                    )}
                    {agent.category && (
                      <span className="px-3 py-1 bg-slate-700/50 text-text-primary text-xs rounded-full border border-slate-600/50">
                        {agent.category}
                      </span>
                    )}
                  </div>
                </div>

                {agent.description && (
                  <p className="text-sm text-text-secondary mb-4 line-clamp-2 leading-relaxed">
                    {agent.description}
                  </p>
                )}

                {/* Tags */}
                {agent.tags && agent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {agent.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-slate-600/50 text-xs text-text-primary rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {agent.tags.length > 3 && (
                      <span className="text-xs text-text-tertiary px-2 py-1">
                        +{agent.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-2 mb-5 pt-3 border-t border-border/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-tertiary">主模型</span>
                    <span className="text-text-primary font-medium">{agent.primary_model_name || agent.model || '-'}</span>
                  </div>
                  {agent.fallback_model_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-tertiary">备选模型</span>
                      <span className="text-text-primary font-medium">{agent.fallback_model_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-text-tertiary">使用次数</span>
                    <span className="text-text-primary font-medium">{agent.usage_count || 0}</span>
                  </div>
                  {agent.last_used_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-tertiary">最后使用</span>
                      <span className="text-text-primary">
                        {new Date(agent.last_used_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/30">
                  <span
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-semibold',
                      agent.enabled
                        ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                    )}
                  >
                    {agent.enabled ? '在线' : '离线'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleTest(agent)}
                      className="p-2.5 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                      title="测试"
                    >
                      <Play className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => setShowDetail(agent.id)}
                      className="p-2.5 hover:bg-slate-700/50 text-text-secondary hover:text-text-primary rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                      title="详情"
                    >
                      <BookOpen className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(agent)}
                      className="p-2.5 hover:bg-slate-700/50 text-text-secondary hover:text-text-primary rounded-xl transition-all hover:scale-105 active:scale-95"
                      title="编辑"
                    >
                      <Edit className="w-4.5 h-4.5" />
                    </button>
                    {agent.is_preset !== 1 && (
                      <button
                        onClick={() => handleDelete(agent.id, agent.name)}
                        className="p-2.5 hover:bg-red-500/20 text-red-400 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        title="删除"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AgentModal
          agent={editingAgent}
          onClose={() => setShowModal(false)}
        />
      )}

      {showTestModal && editingAgent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl w-full max-w-3xl border border-border shadow-2xl shadow-blue-500/10 flex flex-col max-h-[90vh]">
            {/* 头部 */}
            <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-2xl">
                  {editingAgent.avatar}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">测试 {editingAgent.name}</h2>
                  <p className="text-sm text-text-secondary">{editingAgent.role}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all"
              >
                ✕
              </button>
            </div>
            
            {/* 内容区域 - 可滚动 */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* 数据库/服务器选择 */}
              <div className="pt-3 border-t border-border/30">
                {editingAgent.name.includes('数据库运维') ? (
                  <>
                    <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      选择数据库
                    </label>
                    {dbConnections && dbConnections.length > 0 ? (
                      <div className="space-y-2">
                        {dbConnections.filter((d) => d.enabled).map((conn) => (
                          <label key={conn.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer">
                            <input
                              type="radio"
                              name="databaseId"
                              checked={selectedDatabaseId === conn.id}
                              onChange={() => setSelectedDatabaseId(conn.id)}
                              className="w-4 h-4 rounded-full border-slate-600 text-blue-500 focus:ring-blue-500/50"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-text-primary">{conn.name}</div>
                              <div className="text-xs text-text-tertiary">{conn.db_type}://{conn.host}:{conn.port}/{conn.database}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">暂无数据库连接。请先在数据库连接管理中添加。</p>
                    )}
                    {selectedDatabaseId && dbConnections && (
                      <p className="mt-2 text-xs text-text-tertiary">
                        已选择: {dbConnections.find((d) => d.id === selectedDatabaseId)?.name}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      选择服务器
                    </label>
                    {servers && servers.length > 0 ? (
                      <div className="space-y-2">
                        {servers.filter((s) => s.enabled).map((server) => (
                          <label key={server.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedServerIds.includes(server.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServerIds([...selectedServerIds, server.id]);
                                } else {
                                  setSelectedServerIds(selectedServerIds.filter((id) => id !== server.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-text-primary">{server.name}</div>
                              <div className="text-xs text-text-tertiary">{server.hostname}:{server.port}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">暂无可用的服务器</p>
                    )}
                    {selectedServerIds.length > 0 && servers && (
                      <p className="mt-2 text-xs text-text-tertiary">
                        已选择 {selectedServerIds.length} 台服务器: {selectedServerIds.map((id) => servers.find((s) => s.id === id)?.name).join(', ')}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  输入内容
                </label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="请输入要发送给Agent的内容..."
                  className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-32 resize-none"
                />
              </div>

              <button
                onClick={runTest}
                disabled={!testInput || isTesting || (editingAgent?.name.includes('数据库运维') && !selectedDatabaseId)}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 font-semibold"
              >
                {isTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    执行中...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    运行测试
                  </>
                )}
              </button>

              {testResult && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-text-primary">输出结果</span>
                    <span className="text-xs text-text-tertiary">
                      耗时: {testResult.time}ms
                    </span>
                  </div>
                  <div className="bg-surface rounded-xl p-4 border border-border max-h-64 overflow-y-auto scrollbar-thin">
                    <MarkdownOutput content={testResult.output} />
                  </div>
                </div>
              )}
            </div>

            {/* 底部 - 固定 */}
            <div className="p-6 border-t border-border/30 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="w-full px-6 py-3 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all duration-300 font-semibold border border-slate-600/30"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AgentDetailInnerProps {
  agentId: string;
  onBack: () => void;
  deleteMutation: { mutate: (id: string) => void };
}

function AgentDetailInner({ agentId, onBack, deleteMutation }: AgentDetailInnerProps) {
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agents', agentId],
    queryFn: async () => {
      const res = await api.get(`/api/agents/${agentId}`);
      return res.data.data as Agent;
    },
  });

  const { data: executions, isLoading: executionsLoading } = useQuery({
    queryKey: ['agents', agentId, 'executions'],
    queryFn: async () => {
      const res = await api.get(`/api/agents/${agentId}/executions`, { params: { limit: 30 } });
      return res.data.data as { executions: AgentExecution[], pagination: { total: number; page: number; limit: number } };
    },
  });

  if (agentLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800/50 rounded-xl transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-2xl shadow-lg shadow-blue-500/20">
                {agent.avatar}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-3">
                  {agent.name}
                </h1>
                <p className="text-sm text-text-secondary">{agent.role}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 border border-border shadow-lg">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-sm text-text-tertiary block mb-1">分类</span>
                <span className="text-text-primary">{agent.category || '-'}</span>
              </div>
              <div>
                <span className="text-sm text-text-tertiary block mb-1">主模型</span>
                <span className="text-text-primary font-medium">{agent.primary_model_name || agent.model || '-'}</span>
              </div>
              {agent.fallback_model_name && (
                <div>
                  <span className="text-sm text-text-tertiary block mb-1">备选模型</span>
                  <span className="text-text-primary font-medium">{agent.fallback_model_name}</span>
                </div>
              )}
              <div>
                <span className="text-sm text-text-tertiary block mb-1">温度</span>
                <span className="text-text-primary">{agent.temperature}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-text-tertiary block mb-1">使用次数</span>
                <span className="text-text-primary font-medium">{agent.usage_count || 0}</span>
              </div>
              <div>
                <span className="text-sm text-text-tertiary block mb-1">最后使用</span>
                <span className="text-text-primary">
                  {agent.last_used_at ? new Date(agent.last_used_at).toLocaleString() : '-'}
                </span>
              </div>
              <div>
                <span className="text-sm text-text-tertiary block mb-1">状态</span>
                <span className={clsx(
                  "px-3 py-1.5 rounded-full text-xs font-semibold",
                  agent.enabled
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                )}>
                  {agent.enabled ? '在线' : '离线'}
                </span>
              </div>
            </div>
          </div>

          {agent.tags && agent.tags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <span className="text-sm text-text-tertiary block mb-2">标签</span>
              <div className="flex flex-wrap gap-1.5">
                {agent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-slate-600/50 text-xs text-text-primary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {agent.system_prompt && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <span className="text-sm text-text-tertiary block mb-2">系统提示词</span>
              <div className="bg-surface rounded-xl p-4 border border-border">
                <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
                  {agent.system_prompt}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 border border-border shadow-lg">
          <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-text-secondary" />
            执行历史
          </h2>
          
          {executionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (!executions || executions.executions.length === 0) ? (
            <div className="text-center py-12 text-text-secondary">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无执行记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.executions.map((exec) => (
                <div key={exec.id} className="bg-surface rounded-xl p-4 border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-semibold",
                        exec.status === 'success' 
                          ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                      )}>
                        {exec.status === 'success' ? '成功' : '失败'}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {new Date(exec.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-text-tertiary">
                      {exec.execution_time_ms}ms
                    </span>
                  </div>
                  <div className="mb-3">
                    <span className="text-xs text-text-tertiary block mb-1">输入:</span>
                    <p className="text-sm text-text-primary">{exec.input_text}</p>
                  </div>
                  <div>
                    <span className="text-xs text-text-tertiary block mb-1">输出:</span>
                    <pre className="text-sm text-text-primary whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
                      {exec.output_text}
                    </pre>
                  </div>
                  {exec.error_message && (
                    <div className="mt-2">
                      <span className="text-xs text-amber-400 block mb-1">错误:</span>
                      <p className="text-sm text-red-400">{exec.error_message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 border border-border shadow-lg">
          <div className="flex gap-3">
            <button
              onClick={() => {
                onBack();
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-semibold"
            >
              <Edit className="w-4 h-4" />
              编辑 Agent
            </button>
            {agent.is_preset !== 1 && (
              <button
                onClick={() => {
                  if (confirm(`确定要删除Agent "${agent.name}" 吗？`)) {
                    deleteMutation.mutate(agent.id);
                    onBack();
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30 rounded-xl hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                删除 Agent
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentModal({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(agent?.tags) ? agent.tags.join(', ') : ''
  );
  const [showTestModal, setShowTestModal] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  
  const { data: aiModels } = useQuery({
    queryKey: ['aiModels'],
    queryFn: async () => {
      const res = await api.get('/api/ai-models');
      return res.data.data as AIModel[];
    }
  });
  
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    avatar: agent?.avatar || '🤖',
    role: agent?.role || '',
    system_prompt: agent?.system_prompt || '',
    model: agent?.model || 'doubao-4o',
    temperature: agent?.temperature || 0.7,
    enabled: agent?.enabled !== 0,
    category: agent?.category || '',
    description: agent?.description || '',
    primary_model_id: agent?.primary_model_id || '',
    fallback_model_id: agent?.fallback_model_id || '',
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { tags?: string[] }) => {
      if (agent) {
        await api.put(`/api/agents/${agent.id}`, data);
      } else {
        await api.post('/api/agents', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    mutation.mutate({ ...formData, tags });
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;
    
    setTestLoading(true);
    setTestResult(null);
    
    try {
      const testAgent = {
        ...formData,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        id: agent?.id || 'test'
      };
      
      const res = await api.post(`/api/agents/${testAgent.id}/test`, {
        input: testInput
      });
      
      setTestResult(res.data.data.result || '测试完成，无返回结果');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setTestResult(`测试失败: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl shadow-blue-500/10">
        <h2 className="text-xl font-bold text-text-primary mb-6">
          {agent ? '编辑Agent' : '新建Agent'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Agent名称
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                头像
              </label>
              <input
                type="text"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="使用emoji作为头像"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                角色描述
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                分类
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="" className="bg-surface">选择分类...</option>
                <option value="告警处理" className="bg-surface">告警处理</option>
                <option value="故障处理" className="bg-surface">故障处理</option>
                <option value="数据分析" className="bg-surface">数据分析</option>
                <option value="巡检审计" className="bg-surface">巡检审计</option>
                <option value="服务器管理" className="bg-surface">服务器管理</option>
                <option value="操作执行" className="bg-surface">操作执行</option>
                <option value="文档报告" className="bg-surface">文档报告</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-20"
              placeholder="简短描述这个Agent的作用"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              系统提示词
            </label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-40"
              required
            />
          </div>

          <div className="bg-background rounded-xl p-4 border border-border/30">
            <label className="block text-sm font-medium text-text-primary mb-3">
              主模型 *
            </label>
            <select
              value={formData.primary_model_id}
              onChange={(e) => setFormData({ ...formData, primary_model_id: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="" className="bg-surface">选择主模型...</option>
              {(aiModels || []).filter((m: { enabled: number }) => m.enabled === 1).map((model: { id: string; name: string }) => (
                <option key={model.id} value={model.id} className="bg-surface">
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">
              Agent 执行时优先使用的模型
            </p>
          </div>

          <div className="bg-background rounded-xl p-4 border border-border/30">
            <label className="block text-sm font-medium text-text-primary mb-3">
              备选模型 (可选)
            </label>
            <select
              value={formData.fallback_model_id}
              onChange={(e) => setFormData({ ...formData, fallback_model_id: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="" className="bg-surface">选择备选模型...</option>
              {(aiModels || []).filter((m: { enabled: number }) => m.enabled === 1).map((model: { id: string; name: string }) => (
                <option key={model.id} value={model.id} className="bg-surface">
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">
              主模型失败时自动切换到备选模型
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                温度参数
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                标签 (逗号分隔)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="例如: 运维, 自动化, 测试"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
            />
            <label htmlFor="enabled" className="text-sm text-text-primary">
              启用此Agent
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-400 border border-blue-500/30 rounded-xl hover:from-blue-600/30 hover:to-purple-600/30 transition-all font-semibold"
            >
              🧪 测试 Agent
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all font-semibold border border-slate-600/30"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:shadow-none transition-all duration-300 font-semibold"
            >
              {mutation.isPending ? '保存中...' : (agent ? '保存' : '创建')}
            </button>
          </div>
        </form>

        {/* 测试模态框 */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl w-full max-w-3xl border border-border shadow-2xl shadow-blue-500/10 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  🧪 测试 Agent
                </h2>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    输入测试内容
                  </label>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-32 resize-none"
                    placeholder="输入您想让这个 Agent 处理的内容..."
                  />
                </div>

                <button
                  onClick={handleTest}
                  disabled={testLoading || !testInput.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold"
                >
                  {testLoading ? '测试中...' : '运行测试'}
                </button>

                {testResult && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      测试结果
                    </label>
                    <div className="p-4 bg-surface rounded-xl border border-border max-h-64 overflow-y-auto scrollbar-thin">
                      <pre className="text-sm text-text-primary whitespace-pre-wrap">
                        {testResult}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border/30 flex-shrink-0">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="w-full px-6 py-3 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all duration-300 font-semibold border border-slate-600/30"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
