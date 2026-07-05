import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Clock, Edit, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../../lib/api';
import type { Agent, AgentExecution, AgentDetailInnerProps } from './types';

export default function AgentDetail({ agentId, onBack, deleteMutation }: AgentDetailInnerProps) {
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agents', agentId],
    queryFn: async () => {
      const res = await api.get(`/agents/${agentId}`);
      return res.data.data as Agent;
    },
  });

  const { data: executions, isLoading: executionsLoading } = useQuery({
    queryKey: ['agents', agentId, 'executions'],
    queryFn: async () => {
      const res = await api.get(`/agents/${agentId}/executions`, { params: { limit: 30 } });
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