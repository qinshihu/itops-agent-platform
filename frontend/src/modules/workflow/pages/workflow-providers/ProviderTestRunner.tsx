/**
 * WorkflowProviders 测试执行器 Panel（2026-07-21 拆分）
 *
 * 从原 WorkflowProviders.tsx L695-810 抽出
 * 包含：执行测试 section（parameters inputs + buttons + spinner）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { FileCode, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { WorkflowProvider } from './types';

export interface ProviderTestRunnerProps {
  provider: WorkflowProvider;
  testConfig: Record<string, string>;
  setTestConfig: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  testMutationPending: boolean;
  testMutationVariables: unknown;
  onTest: () => void;
  onClearResult: () => void;
}

export default function ProviderTestRunner({
  provider,
  testConfig,
  setTestConfig,
  testMutationPending,
  testMutationVariables,
  onTest,
  onClearResult,
}: ProviderTestRunnerProps) {
  const paramEntries = Object.entries(provider.configSchema.properties || {});
  const isCurrentRunning =
    testMutationPending &&
    (testMutationVariables as { providerId?: string })?.providerId === provider.id;

  return (
    <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-status-success" />
        <span className="text-sm font-semibold text-text-primary">执行测试</span>
        {isCurrentRunning && (
          <span className="text-xs text-text-tertiary ml-2">执行中...</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {paramEntries.length === 0 ? (
          <p className="text-sm text-text-tertiary">该动作不需要参数，直接点击执行即可</p>
        ) : (
          <div className="grid gap-3">
            {paramEntries.map(([name, prop]) => {
              const isRequired = provider.configSchema.required?.includes(name);
              const type = prop.type || 'string';
              const desc = prop.description;
              const enumValues = prop.enum as string[] | undefined;
              return (
                <div key={name}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-xs font-medium text-text-secondary font-mono">
                      {name}
                    </label>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-text-tertiary">
                      {type}
                    </span>
                    {isRequired && (
                      <span className="text-[10px] text-orange-400 font-medium">必填</span>
                    )}
                  </div>
                  {enumValues && enumValues.length > 0 ? (
                    <select
                      value={testConfig[name] ?? ''}
                      onChange={(e) =>
                        setTestConfig((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">-- 请选择 --</option>
                      {enumValues.map((val, i) => (
                        <option key={i} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  ) : type === 'boolean' ? (
                    <select
                      value={testConfig[name] ?? ''}
                      onChange={(e) =>
                        setTestConfig((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">-- 请选择 --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : type === 'object' || type === 'array' ? (
                    <textarea
                      value={testConfig[name] ?? ''}
                      onChange={(e) =>
                        setTestConfig((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      placeholder={desc || `输入 ${type} 类型的 JSON 值`}
                      rows={3}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={testConfig[name] ?? ''}
                      onChange={(e) =>
                        setTestConfig((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      placeholder={desc || `输入 ${name}`}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onTest}
            disabled={isCurrentRunning}
            className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30"
          >
            <Play className="w-4 h-4" />
            {isCurrentRunning ? '执行中...' : '执行测试'}
          </button>
          {/* 注：外部 result 渲染从 ProviderDetailPanel 处理（避免重新拆分小型 widget）*/}
        </div>
      </div>
    </div>
  );
}
