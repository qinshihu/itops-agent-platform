/**
 * DbConnections 页面 header + 添加按钮（2026-07-21 拆分）
 *
 * 从原 DbConnections.tsx L238-287 抽出
 * 包含：标题 + 添加按钮 + 4 统计卡片 + 搜索框
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { Database, Search, Plus, Check, X, Server } from 'lucide-react';
import type { DbConnection } from './types';

export interface DbConnectionsHeaderProps {
  connections: DbConnection[] | undefined;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  onAddNew: () => void;
}

const STAT_CONFIG = [
  { label: '总连接数', key: 'total', icon: Database, color: 'blue' },
  { label: '已启用', key: 'enabled', icon: Check, color: 'emerald' },
  { label: '已禁用', key: 'disabled', icon: X, color: 'red' },
  { label: 'MySQL', key: 'mysql', icon: Server, color: 'amber' },
] as const;

export function DbConnectionsHeader({
  connections,
  searchQuery,
  setSearchQuery,
  onAddNew,
}: DbConnectionsHeaderProps) {
  const list = connections || [];
  const getStatValue = (key: string): number => {
    switch (key) {
      case 'total':
        return list.length;
      case 'enabled':
        return list.filter((c) => c.enabled).length;
      case 'disabled':
        return list.filter((c) => !c.enabled).length;
      case 'mysql':
        return list.filter((c) => c.db_type === 'mysql').length;
      default:
        return 0;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Database className="w-7 h-7 text-blue-400" />
            数据库管理
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            管理数据库连接配置，供数据库运维 Agent 调用 dbskiter 使用
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          添加连接
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <div
                className={clsx(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  `bg-${stat.color}-500/20 text-${stat.color}-400`,
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{getStatValue(stat.key)}</div>
                <div className="text-xs text-text-secondary">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="搜索名称、主机、数据库类型..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>
    </>
  );
}
