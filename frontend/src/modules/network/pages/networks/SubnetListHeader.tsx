/**
 * 子网管理页 header + 创建按钮 + 刷新按钮 widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L389-407 抽出
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { RefreshCw, Plus } from 'lucide-react';

export interface SubnetListHeaderProps {
  onRefresh: () => void;
  onAdd: () => void;
}

export function SubnetListHeader({ onRefresh, onAdd }: SubnetListHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-xl font-bold text-text-primary">网段管理</h1>
        <p className="text-text-secondary text-sm mt-0.5">IP子网规划与地址分配</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
        >
          <RefreshCw size={14} />
          刷新
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          <Plus size={14} />
          新建子网
        </button>
      </div>
    </div>
  );
}
