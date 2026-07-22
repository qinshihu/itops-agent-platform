/**
 * DbConnection 单卡 widget（2026-07-21 拆分）
 *
 * 从原 DbConnections.tsx L303-364 抽出
 * 含 db_type icon + name + URL + status badge + 编辑/删除
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { Database, Edit, Trash2, Server, Shield, RefreshCw } from 'lucide-react';
import { DB_TYPE_COLORS, type DbConnection } from './types';

export interface DbConnectionCardProps {
  connection: DbConnection;
  onEdit: (conn: DbConnection) => void;
  onDelete: (id: string, name: string) => void;
}

export function DbConnectionCard({ connection: conn, onEdit, onDelete }: DbConnectionCardProps) {
  const colorClass = DB_TYPE_COLORS[conn.db_type] || DB_TYPE_COLORS.mysql;

  return (
    <div
      className={clsx(
        'bg-surface border rounded-xl p-5 transition-all hover:bg-slate-800/80 hover:scale-[1.01]',
        conn.enabled ? 'border-border' : 'border-red-500/20 opacity-60',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center border',
              colorClass,
            )}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text-primary">{conn.name}</h3>
              {!conn.enabled && (
                <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full border border-red-500/20">
                  已禁用
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {conn.db_type}://{conn.host}:{conn.port}/{conn.database}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(conn)}
            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(conn.id, conn.name)}
            className="p-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {conn.description && (
        <p className="text-sm text-text-secondary mt-3 line-clamp-1">{conn.description}</p>
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <Server className="w-3 h-3" />
          {conn.host}:{conn.port}
        </span>
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          {conn.username}
        </span>
        <span className="flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          {new Date(conn.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
