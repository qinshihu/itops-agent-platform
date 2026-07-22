/**
 * Subnet 单卡片 widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L457-509 抽出
 * 单个子网卡片（header + 信息行 + 用量条 + 操作）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { Router, Layers, MapPin, Edit, Trash2 } from 'lucide-react';
import { STATUS_MAP, TYPE_MAP, type SubnetInfo } from './types';

export interface SubnetCardProps {
  subnet: SubnetInfo;
  onSelect: (s: SubnetInfo) => void;
  onEdit: (s: SubnetInfo) => void;
  onDelete: (s: SubnetInfo) => void;
}

export function SubnetCard({ subnet: s, onSelect, onEdit, onDelete }: SubnetCardProps) {
  const type = TYPE_MAP[s.network_type] || TYPE_MAP.other;
  const status = STATUS_MAP[s.status || 'active'] || STATUS_MAP.active;
  const usagePercent = s.total_ips > 0 ? Math.round((s.used_ips / s.total_ips) * 100) : 0;

  return (
    <div
      onClick={() => onSelect(s)}
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-mono group-hover:text-primary transition-colors">
            {s.cidr}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">{s.name}</p>
        </div>
        <span className={clsx('text-xs px-2 py-0.5 rounded', type.color)}>{type.label}</span>
      </div>

      <div className="space-y-1.5 text-xs text-text-secondary mb-3">
        {s.gateway && (
          <div className="flex items-center gap-1">
            <Router size={12} />
            <span className="font-mono">{s.gateway}</span>
          </div>
        )}
        {s.vlan_id && (
          <div className="flex items-center gap-1">
            <Layers size={12} />
            VLAN {s.vlan_id}
          </div>
        )}
        {s.location && (
          <div className="flex items-center gap-1">
            <MapPin size={12} />
            {s.location}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-text-tertiary">使用率</span>
          <span className="text-text-secondary font-mono">
            {s.used_ips}/{s.total_ips} ({usagePercent}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              usagePercent > 80
                ? 'bg-red-400'
                : usagePercent > 50
                ? 'bg-yellow-400'
                : 'bg-green-400',
            )}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
        <span className={clsx('text-xs px-2 py-0.5 rounded', status.color)}>{status.label}</span>
        <div className="flex-1" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(s);
          }}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface transition-colors"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`确定要删除子网 ${s.cidr} 吗？`)) {
              onDelete(s);
            }
          }}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
