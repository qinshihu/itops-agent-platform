/**
 * 搜索 + 类型过滤 widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L425-439 抽出
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Search } from 'lucide-react';
import { TYPE_MAP } from './types';

export interface SubnetSearchFilterProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (s: string) => void;
}

export function SubnetSearchFilter({
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
}: SubnetSearchFilterProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="搜索名称、CIDR、位置..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-primary"
        />
      </div>
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
      >
        <option value="">全部类型</option>
        {Object.entries(TYPE_MAP).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}
