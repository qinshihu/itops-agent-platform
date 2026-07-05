import { Plus, RefreshCw, Search } from 'lucide-react';
import clsx from 'clsx';

interface VMToolbarProps {
  search: string;
  statusFilter: string;
  syncing: boolean;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onRefresh: () => void;
  onSync: () => void;
  onCreateVM: () => void;
}

export function VMToolbar({
  search,
  statusFilter,
  syncing,
  onSearchChange,
  onStatusFilterChange,
  onRefresh,
  onSync,
  onCreateVM,
}: VMToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索名称/IP..."
          className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value)}
        className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
      >
        <option value="">全部状态</option>
        <option value="running">运行中</option>
        <option value="stopped">已关机</option>
        <option value="suspended">已挂起</option>
      </select>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        刷新
      </button>
      <button
        onClick={onSync}
        disabled={syncing}
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
      >
        <RefreshCw className={clsx('w-4 h-4', syncing && 'animate-spin')} />
        同步
      </button>
      <button
        onClick={onCreateVM}
        className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors ml-auto"
      >
        <Plus className="w-4 h-4" />
        新建 VM
      </button>
    </div>
  );
}
