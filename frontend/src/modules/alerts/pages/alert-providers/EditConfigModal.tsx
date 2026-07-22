/**
 * AlertProviders 配置编辑 Modal（2026-07-21 拆分）
 *
 * 从原 AlertProviders.tsx L486-633 抽出独立 Modal
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { clsx } from 'clsx';
import { TestTube, Info, Copy, CheckCircle } from 'lucide-react';
import type { AlertProvider, AlertProviderConfig, FormField, TestResult } from './types';
import type { ProviderGuide } from './providerGuides';

export interface EditConfigModalProps {
  provider: AlertProvider;
  editingConfig: AlertProviderConfig | null;
  configName: string;
  setConfigName: (s: string) => void;
  configFormData: Record<string, unknown>;
  setConfigFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  configEnabled: boolean;
  setConfigEnabled: (b: boolean) => void;
  copied: string;
  copy: (text: string, id: string) => Promise<void>;
  testResult: TestResult | null;
  testing: boolean;
  onTestConnection: () => Promise<void>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  createPending: boolean;
  updatePending: boolean;
  getWebhookUrl: (providerId: string) => string;
  formFields: FormField[];
  guide: ProviderGuide | null;
}

export function EditConfigModal({
  provider,
  editingConfig,
  configName,
  setConfigName,
  configFormData,
  setConfigFormData,
  configEnabled,
  setConfigEnabled,
  copied,
  copy,
  testResult,
  testing,
  onTestConnection,
  onSubmit,
  onClose,
  createPending,
  updatePending,
  getWebhookUrl,
  formFields,
  guide,
}: EditConfigModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 rounded-t-xl z-10">
          <h3 className="text-lg font-semibold text-slate-100">
            {editingConfig ? `编辑配置: ${configName}` : `新建 ${provider.name} 配置`}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition-all text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* Config Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">
              配置名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 transition-all"
              placeholder="例如: 生产环境 Prometheus"
            />
          </div>

          {/* Provider ID (readonly when editing) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">告警源类型</label>
            <input
              type="text"
              disabled
              value={`${provider.name} (${provider.type})`}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* Dynamic Form Fields from configSchema */}
          {formFields.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-200 mb-2">配置参数</label>
              <div className="space-y-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                {formFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-300">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.description && (
                      <p className="text-xs text-slate-500 mb-1">{field.description}</p>
                    )}
                    {field.type === 'boolean' ? (
                      <select
                        value={configFormData[field.key] ? 'true' : 'false'}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [field.key]: e.target.value === 'true',
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    ) : field.enum ? (
                      <select
                        value={(configFormData[field.key] as string) || ''}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="">请选择</option>
                        {field.enum.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={(configFormData[field.key] as number) ?? ''}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [field.key]: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                        placeholder={`请输入${field.label}`}
                      />
                    ) : field.key.includes('url') || field.key.includes('endpoint') ? (
                      <input
                        type="url"
                        value={(configFormData[field.key] as string) || ''}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm font-mono"
                        placeholder={`https://...`}
                      />
                    ) : field.key.includes('token') ||
                      field.key.includes('password') ||
                      field.key.includes('secret') ? (
                      <input
                        type="password"
                        value={(configFormData[field.key] as string) || ''}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                        placeholder="请输入（自动加密存储）"
                      />
                    ) : (
                      <input
                        type="text"
                        value={(configFormData[field.key] as string) || ''}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                        placeholder={`请输入${field.label}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Webhook URL (always show for reference) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">Webhook 接收地址</label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 bg-slate-950 px-3 py-2.5 rounded-lg text-xs text-green-300 overflow-x-auto whitespace-nowrap select-all border border-slate-700">
                {getWebhookUrl(provider.id)}
              </code>
              <button
                type="button"
                onClick={() => copy(getWebhookUrl(provider.id), 'modal-url')}
                className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all flex-shrink-0"
                title="复制"
              >
                {copied === 'modal-url' ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-300" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              将此地址配置到 {provider.name} 的 Webhook/Alertmanager 中
            </p>
          </div>

          {/* Usage Guide */}
          {guide && (
            <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">{guide.title}</span>
              </div>
              <div className="space-y-1">
                {guide.steps.map((step, i) => (
                  <p key={i} className="text-xs text-blue-400/80">
                    {step}
                  </p>
                ))}
              </div>
              {guide.note && (
                <p className="text-xs text-blue-400/60 mt-2 border-t border-blue-800/30 pt-2">
                  {guide.note}
                </p>
              )}
            </div>
          )}

          {/* Test Connection */}
          <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={onTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm font-medium"
            >
              <TestTube className="w-4 h-4" />
              {testing ? '测试中...' : '测试连接'}
            </button>
            {testResult && (
              <span className={clsx('text-sm', testResult.ok ? 'text-green-400' : 'text-red-400')}>
                {testResult.ok ? '✓' : '✗'} {testResult.message}
              </span>
            )}
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              id="config-enabled"
              checked={configEnabled}
              onChange={(e) => setConfigEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="config-enabled" className="text-sm text-slate-200">
              启用此告警源（启用后 Webhook 地址才会生效）
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 hover:bg-slate-600 transition-all font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createPending || updatePending}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all font-medium shadow-sm"
            >
              {createPending || updatePending
                ? '保存中...'
                : editingConfig
                  ? '更新配置'
                  : '创建配置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
