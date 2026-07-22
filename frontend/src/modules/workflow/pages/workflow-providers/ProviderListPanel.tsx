/**
 * WorkflowProviders 左侧 List Panel（2026-07-21 拆分）
 *
 * 从原 WorkflowProviders.tsx L381-489 抽出左侧 list panel
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { Search, ChevronRight } from 'lucide-react';
import { TYPE_CONFIG, type TypeKey, type WorkflowProvider } from './types';

export interface ProviderListPanelProps {
  providers: WorkflowProvider[] | null | undefined;
  filteredProviders: WorkflowProvider[];
  selectedId: string | null;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  activeType: TypeKey | 'all';
  setActiveType: (t: TypeKey | 'all') => void;
  typeCounts: Record<string, number>;
  onSelectProvider: (id: string) => void;
  totalProvidersCount: number;
}

export default function ProviderListPanel({
  filteredProviders,
  selectedId,
  isLoading,
  searchQuery,
  setSearchQuery,
  activeType,
  setActiveType,
  typeCounts,
  onSelectProvider,
}: ProviderListPanelProps) {
  return (
    <div className="w-[380px] flex flex-col border-r border-border/40 bg-background/60">
      <div className="p-4 space-y-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索动作名称或 ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeType === 'all'
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface/80 border border-border/60'
            }`}
          >
            全部
          </button>
          {(Object.keys(TYPE_CONFIG) as TypeKey[]).map((key) => {
            const cfg = TYPE_CONFIG[key];
            const count = typeCounts[key] || 0;
            if (count === 0) return null;
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveType(key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeType === key
                    ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                    : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface/80 border border-border/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-text-tertiary text-sm">加载中...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-text-tertiary/40 mx-auto mb-3" />
            <p className="text-text-tertiary text-sm">未找到匹配的动作</p>
          </div>
        ) : (
          filteredProviders.map((provider) => {
            const cfg = TYPE_CONFIG[provider.type as TypeKey] || TYPE_CONFIG.action;
            const Icon = cfg.icon;
            const isSelected = selectedId === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => onSelectProvider(provider.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${
                  isSelected
                    ? `bg-surface border-primary/50 shadow-lg shadow-primary/10`
                    : `bg-surface/50 border-border/60 hover:border-border hover:bg-surface`
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-medium text-text-primary truncate">
                        {provider.id}
                      </code>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">{provider.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {Object.keys(provider.configSchema.properties || {}).length} 个参数
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
