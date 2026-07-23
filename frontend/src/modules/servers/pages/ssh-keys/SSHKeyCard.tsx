/**
 * SSHKey Card widget（2026-07-21 拆分）
 *
 * 从原 SSHKeys.tsx L296-428 抽出
 * 凭证卡片（含 fingerprint + private key 展开 + usage servers 展开）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { Eye, EyeOff, Edit, Trash2, Server, Lock, Key, Copy, Fingerprint, X } from 'lucide-react';
import type { SshKey } from './types';
import { getKeyTypeColor, getKeyTypeText } from './constants';
import type { UsageServer } from './types';

export interface SSHKeyCardProps {
  keyData: SshKey;
  expandedKey: string | null;
  setExpandedKey: (id: string | null) => void;
  fullKeyData: (SshKey & { private_key: string }) | null | undefined;
  usageServers: UsageServer[] | null;
  usageLoading: boolean;
  setUsageServers: (servers: UsageServer[] | null) => void;
  handleViewUsage: (key: SshKey) => Promise<void>;
  handleCopyFingerprint: (fingerprint: string) => void;
  handleCopyKey: () => void;
  handleEdit: (key: SshKey) => void;
  setDeleteConfirmKey: (k: SshKey | null) => void;
}

export function SSHKeyCard({
  keyData,
  expandedKey,
  setExpandedKey,
  fullKeyData,
  usageServers,
  usageLoading,
  setUsageServers,
  handleViewUsage,
  handleCopyFingerprint,
  handleCopyKey,
  handleEdit,
  setDeleteConfirmKey,
}: SSHKeyCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#334155]/60 bg-[#1a2236]/90 backdrop-blur-sm p-4 transition-all duration-200 hover:border-[#3b82f6]/50 hover:bg-[#1e2940] hover:shadow-md hover:shadow-blue-500/5">
      <div className="relative">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              keyData.auth_type === 'password'
                ? 'bg-gradient-to-br from-[#f97316]/20 to-[#ea580c]/15 border-[#f97316]/25'
                : 'bg-gradient-to-br from-[#3b82f6]/20 to-[#0ea5e9]/15 border-[#3b82f6]/25',
            )}
          >
            {keyData.auth_type === 'password' ? (
              <Lock className="h-4 w-4 text-[#fb923c]" />
            ) : (
              <Key className="h-4 w-4 text-[#60a5fa]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-text-primary/95">
                {keyData.name}
              </h3>
              <span
                className={clsx(
                  'inline-flex shrink-0 items-center px-1.5 py-0.5 text-[10px] font-semibold rounded',
                  getKeyTypeColor(keyData.key_type ?? '', keyData.auth_type),
                )}
              >
                {getKeyTypeText(keyData.key_type ?? '', keyData.auth_type)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#94a3b8]">
              <Server className="h-3 w-3" />
              <span>{keyData.usage_count ?? 0} 台设备</span>
              <span className="mx-1 text-[#4a5568]">·</span>
              <span>
                {keyData.created_at
                  ? new Date(keyData.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })
                  : '-'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
            {(keyData.usage_count ?? 0) > 0 && (
              <button
                onClick={() => handleViewUsage(keyData)}
                className="rounded-md p-1.5 text-[#94a3b8] transition-colors hover:bg-white/5 hover:text-[#60a5fa]"
                title="查看服务器"
              >
                <Server className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpandedKey(expandedKey === keyData.id ? null : keyData.id)}
              className="rounded-md p-1.5 text-[#94a3b8] transition-colors hover:bg-white/5 hover:text-[#60a5fa]"
              title="查看私钥"
            >
              {expandedKey === keyData.id ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => handleEdit(keyData)}
              className="rounded-md p-1.5 text-[#94a3b8] transition-colors hover:bg-white/5 hover:text-[#60a5fa]"
              title="编辑"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteConfirmKey(keyData)}
              className="rounded-md p-1.5 text-[#94a3b8] transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {keyData.fingerprint && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#334155]/50 bg-[#111827]/60 px-2.5 py-1.5">
            <Fingerprint className="h-3 w-3 shrink-0 text-[#3b82f6]/50" />
            <code className="truncate text-[11px] font-mono text-[#cbd5e1]">
              {keyData.fingerprint}
            </code>
            <button
              onClick={() => handleCopyFingerprint(keyData.fingerprint!)}
              className="ml-auto shrink-0 rounded p-0.5 text-[#64748b] transition-colors hover:text-[#60a5fa]"
              title="复制指纹"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}

        {expandedKey === keyData.id && fullKeyData && (
          <div className="mt-4 p-4 bg-black/60 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-tertiary">私钥内容</span>
              <button
                onClick={handleCopyKey}
                className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3" />
                复制私钥
              </button>
            </div>
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {fullKeyData.private_key}
            </pre>
          </div>
        )}

        {usageServers !== null && (
          <div className="mt-4 p-4 bg-background/50 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-primary">
                使用该凭证的服务器（{usageServers.length} 台）
              </span>
              <button
                onClick={() => setUsageServers(null)}
                className="p-0.5 hover:bg-surface rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-text-tertiary" />
              </button>
            </div>
            {usageLoading ? (
              <p className="text-xs text-text-tertiary animate-pulse">加载中...</p>
            ) : usageServers.length === 0 ? (
              <p className="text-xs text-text-tertiary">无关联服务器</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {usageServers.map((srv) => (
                  <div
                    key={srv.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-surface/50 rounded-lg text-xs"
                  >
                    <Server className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-text-primary truncate font-medium">{srv.name}</span>
                    <span className="text-text-tertiary truncate">{srv.hostname}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
