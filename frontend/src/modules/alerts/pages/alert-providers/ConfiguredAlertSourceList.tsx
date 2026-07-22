/**
 * AlertProviders 已配置告警源列表（2026-07-21 拆分）
 *
 * 从原 AlertProviders.tsx L333-396 抽出已配置告警源的卡片网格
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { clsx } from 'clsx';
import { Edit, Trash2, Globe, Link, Copy, CheckCircle } from 'lucide-react';
import type { AlertProvider, AlertProviderConfig } from './types';

export interface ConfiguredAlertSourceListProps {
  configs: AlertProviderConfig[] | null | undefined;
  providers: AlertProvider[] | null | undefined;
  copied: string;
  getWebhookUrl: (providerId: string) => string;
  onCopy: (text: string, id: string) => void;
  onEdit: (config: AlertProviderConfig) => void;
  onDelete: (id: string) => void;
  deletePending: boolean;
}

export function ConfiguredAlertSourceList({
  configs,
  providers,
  copied,
  getWebhookUrl,
  onCopy,
  onEdit,
  onDelete,
  deletePending,
}: ConfiguredAlertSourceListProps) {
  if (!configs || configs.length === 0) return null;

  return (
    <div className="px-6 py-4 border-b border-slate-700">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">
        已配置的告警源 ({configs.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((config) => {
          const relatedProvider = providers?.find((p) => p.id === config.provider_id);
          const webhookUrl = getWebhookUrl(config.provider_id);
          return (
            <div
              key={config.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                    <Globe className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{config.name}</h3>
                    <span className="text-xs text-slate-400">
                      {relatedProvider?.name || config.provider_id} · {relatedProvider?.type}
                    </span>
                  </div>
                </div>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    config.enabled
                      ? 'bg-green-900/50 text-green-300'
                      : 'bg-slate-700 text-slate-400',
                  )}
                >
                  {config.enabled ? '已启用' : '已禁用'}
                </span>
              </div>

              {/* Webhook URL */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Link className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-slate-400">Webhook 接收地址:</span>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 bg-slate-900 px-2 py-1.5 rounded text-xs text-blue-300 overflow-x-auto whitespace-nowrap select-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => onCopy(webhookUrl, config.id)}
                    className="p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition-all flex-shrink-0"
                    title="复制"
                  >
                    {copied === config.id ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                </div>
              </div>

              {/* Config Fields Summary */}
              {config.config && Object.keys(config.config).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {Object.entries(config.config)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded"
                      >
                        {k}:{' '}
                        {typeof v === 'string'
                          ? v.length > 20
                            ? v.substring(0, 20) + '...'
                            : v
                          : String(v)}
                      </span>
                    ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(config)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 text-sm transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  onClick={() => onDelete(config.id)}
                  disabled={deletePending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-800 text-sm transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
