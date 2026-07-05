import { Search } from 'lucide-react';

interface AlertFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  severityFilter: string;
  onSeverityChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
}

export default function AlertFilterBar({
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityChange,
  statusFilter,
  onStatusChange,
}: AlertFilterBarProps) {
  return (
    <div className="p-6 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">告警列表</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索告警..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="all">所有级别</option>
          <option value="critical">严重</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="all">所有状态</option>
          <option value="new">新</option>
          <option value="acknowledged">已确认</option>
          <option value="resolved">已解决</option>
        </select>
      </div>
    </div>
  );
}