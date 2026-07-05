import clsx from 'clsx';
import { Play, BookOpen, Edit, Trash2 } from 'lucide-react';
import type { Agent } from './types';

interface AgentListProps {
  filteredAgents: Agent[];
  isLoading: boolean;
  onShowDetail: (id: string) => void;
  onTest: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (id: string, name: string) => void;
}

export default function AgentList({ filteredAgents, isLoading, onShowDetail, onTest, onEdit, onDelete }: AgentListProps) {
  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
      {filteredAgents.map((agent) => (
        <div
          key={agent.id}
          className="group relative bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 border border-border hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl -z-10 group-hover:opacity-100 opacity-50 transition-opacity" />

          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => onShowDetail(agent.id)}>
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
                onClick={() => onTest(agent)}
                className="p-2.5 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="测试"
              >
                <Play className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => onShowDetail(agent.id)}
                className="p-2.5 hover:bg-slate-700/50 text-text-secondary hover:text-text-primary rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="详情"
              >
                <BookOpen className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => onEdit(agent)}
                className="p-2.5 hover:bg-slate-700/50 text-text-secondary hover:text-text-primary rounded-xl transition-all hover:scale-105 active:scale-95"
                title="编辑"
              >
                <Edit className="w-4.5 h-4.5" />
              </button>
              {agent.is_preset !== 1 && (
                <button
                  onClick={() => onDelete(agent.id, agent.name)}
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
  );
}