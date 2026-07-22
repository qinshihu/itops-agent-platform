import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Clock, Edit, Trash2, Download, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { message, Modal } from 'antd';
import api from '@/lib/api';
import type { Agent, AgentExecution, AgentDetailInnerProps } from './types';

export default function AgentDetail({ agentId, onBack, deleteMutation }: AgentDetailInnerProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'executions'>('info');
  const [executionStatus, setExecutionStatus] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<AgentExecution | null>(null);

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agents', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/agents/${agentId}`);
      const result = data.data ?? data;
      return result as Agent;
    },
  });

  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: ['agents', agentId, 'executions', executionStatus],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (executionStatus !== 'all') params.status = executionStatus;
      const { data } = await api.get(`/agents/${agentId}/executions`, { params });
      return (data.data ?? data) as {
        executions: AgentExecution[];
        pagination: { total: number; limit: number; offset: number };
      };
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

  const executions = executionsData?.executions ?? [];

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
          <button
            onClick={async () => {
              try {
                const { data } = await api.get(`/agents/export/${agentId}`);
                const exportData = data.data ?? data;
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `agent-${agent.name}-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                message.success('导出成功');
              } catch {
                message.error('导出失败');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600/50 to-slate-700/50 text-text-primary rounded-xl hover:from-slate-600 hover:to-slate-700 transition-all duration-300 font-medium border border-slate-600/50"
          >
            <Download className="w-4 h-4" />
            导出配置
          </button>
        </div>

        <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="flex border-b border-border/50 px-6">
            <button
              onClick={() => setActiveTab('info')}
              className={clsx(
                'px-5 py-4 text-sm font-medium transition-all relative',
                activeTab === 'info'
                  ? 'text-blue-400'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                配置信息
              </div>
              {activeTab === 'info' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('executions')}
              className={clsx(
                'px-5 py-4 text-sm font-medium transition-all relative',
                activeTab === 'executions'
                  ? 'text-blue-400'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                执行历史
                {executionsData?.pagination?.total !== undefined &&
                  executionsData.pagination.total > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                      {executionsData.pagination.total}
                    </span>
                  )}
              </div>
              {activeTab === 'executions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'info' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-text-tertiary block mb-1">分类</span>
                      <span className="text-text-primary">{agent.category || '-'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-text-tertiary block mb-1">主模型</span>
                      <span className="text-text-primary font-medium">
                        {agent.primary_model_name || agent.model || '-'}
                      </span>
                    </div>
                    {agent.fallback_model_name && (
                      <div>
                        <span className="text-sm text-text-tertiary block mb-1">备选模型</span>
                        <span className="text-text-primary font-medium">
                          {agent.fallback_model_name}
                        </span>
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
                      <span className="text-text-primary font-medium">
                        {agent.usage_count || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-text-tertiary block mb-1">最后使用</span>
                      <span className="text-text-primary">
                        {agent.last_used_at ? new Date(agent.last_used_at).toLocaleString() : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-text-tertiary block mb-1">状态</span>
                      <span
                        className={clsx(
                          'px-3 py-1.5 rounded-full text-xs font-semibold',
                          agent.enabled
                            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30',
                        )}
                      >
                        {agent.enabled ? '在线' : '离线'}
                      </span>
                    </div>
                  </div>
                </div>

                {agent.tags && agent.tags.length > 0 && (
                  <div className="pt-4 border-t border-border/30">
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
                  <div className="pt-4 border-t border-border/30">
                    <span className="text-sm text-text-tertiary block mb-2">系统提示词</span>
                    <div className="bg-surface rounded-xl p-4 border border-border">
                      <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
                        {agent.system_prompt}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'executions' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {['all', 'success', 'error'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setExecutionStatus(status)}
                      className={clsx(
                        'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300',
                        executionStatus === status
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                          : 'bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary',
                      )}
                    >
                      {status === 'all' ? '全部' : status === 'success' ? '成功' : '失败'}
                    </button>
                  ))}
                </div>

                {executionsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : executions.length === 0 ? (
                  <div className="text-center py-12 text-text-secondary">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无执行记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {executions.map((exec) => (
                      <div
                        key={exec.id}
                        className="bg-surface rounded-xl p-4 border border-border hover:border-blue-500/30 transition-all cursor-pointer"
                        onClick={() => setSelectedExecution(exec)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span
                              className={clsx(
                                'px-3 py-1.5 rounded-full text-xs font-semibold',
                                exec.status === 'success'
                                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30',
                              )}
                            >
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
                        <p className="text-sm text-text-primary line-clamp-2">{exec.input_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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

      <Modal
        title="执行详情"
        open={!!selectedExecution}
        onCancel={() => setSelectedExecution(null)}
        footer={null}
        width={800}
      >
        {selectedExecution && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold',
                  selectedExecution.status === 'success'
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30',
                )}
              >
                {selectedExecution.status === 'success' ? '执行成功' : '执行失败'}
              </span>
              <span className="text-xs text-text-tertiary">
                耗时: {selectedExecution.execution_time_ms}ms
              </span>
            </div>
            <div>
              <span className="text-xs text-text-tertiary block mb-1">执行时间</span>
              <p className="text-sm text-text-primary">
                {new Date(selectedExecution.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-xs text-text-tertiary block mb-1">输入</span>
              <div className="bg-surface rounded-xl p-4 border border-border">
                <p className="text-sm text-text-primary whitespace-pre-wrap">
                  {selectedExecution.input_text}
                </p>
              </div>
            </div>
            <div>
              <span className="text-xs text-text-tertiary block mb-1">输出</span>
              <div className="bg-surface rounded-xl p-4 border border-border max-h-80 overflow-y-auto scrollbar-thin">
                <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
                  {selectedExecution.output_text}
                </pre>
              </div>
            </div>
            {selectedExecution.error_message && (
              <div>
                <span className="text-xs text-amber-400 block mb-1">错误信息</span>
                <p className="text-sm text-red-400">{selectedExecution.error_message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
