/**
 * Kubernetes 搜索框
 *
 * 从原 Kubernetes.tsx 抽离（2026-07-08 增量-13）。
 */

import { Search, X } from 'lucide-react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBox({ value, onChange, placeholder = '搜索...' }: SearchBoxProps) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border text-text-primary text-sm rounded-lg pl-9 pr-3 py-2 w-56 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SearchBox;
