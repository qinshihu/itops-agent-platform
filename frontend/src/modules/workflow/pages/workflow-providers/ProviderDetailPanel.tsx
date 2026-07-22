/**
 * WorkflowProviders 右侧 Detail Panel（2026-07-21 拆分）
 *
 * 从原 WorkflowProviders.tsx L490-852 抽出右侧 detail panel：
 * - 空状态（未选择 provider）
 * - Provider header（icon + name + copy id）
 * - 3 个 Stat Card（参数数 / 必填 / 类型）
 * - 4 个 section（使用场景 / 参数表 / 输入输出示例 + 测试执行器）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import {
  Copy,
  Check,
  Sparkles,
  Code2,
  FileCode,
  Wrench,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { TYPE_CONFIG, type TypeKey, type WorkflowProvider, type ProviderTestResult } from './types';
import { getProviderMeta } from './providerMeta';
import ProviderTestRunner from './ProviderTestRunner';

export interface ProviderDetailPanelProps {
  selectedProvider: WorkflowProvider | null;
  copiedId: string | null;
  testResults: Record<string, ProviderTestResult>;
  testConfig: Record<string, string>;
  setTestConfig: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  testMutationPending: boolean;
  testMutationVariables: unknown;
  onCopy: (text: string, id: string) => void;
  onTest: () => void;
  onClearResult: () => void;
}

export default function ProviderDetailPanel({
  selectedProvider,
  copiedId,
  testResults,
  testConfig,
  setTestConfig,
  testMutationPending,
  testMutationVariables,
  onCopy,
  onTest,
  onClearResult,
}: ProviderDetailPanelProps) {
  if (!selectedProvider) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mb-4">
          <Wrench className="w-10 h-10 text-text-tertiary/40" />
        </div>
        <h3 className="text-lg font-semibold text-text-secondary mb-2">选择一个动作</h3>
        <p className="text-sm text-text-tertiary max-w-sm">
          从左侧列表中选择一个工作流动作，查看详细的参数配置并进行执行测试
        </p>
      </div>
    );
  }

  const cfg = TYPE_CONFIG[selectedProvider.type as TypeKey] || TYPE_CONFIG.action;
  const Icon = cfg.icon;
  const meta = getProviderMeta(selectedProvider.id);
  const paramEntries = Object.entries(selectedProvider.configSchema.properties || {});
  const currentTest = testResults[selectedProvider.id];
  const isCurrentTestRunning =
    testMutationPending &&
    (testMutationVariables as { providerId?: string })?.providerId === selectedProvider.id;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/40 bg-surface/30">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-text-primary font-mono">
                    {selectedProvider.id}
                  </h2>
                  <button
                    onClick={() => onCopy(selectedProvider.id, 'provider-id')}
                    className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface transition-colors"
                    title="复制动作 ID"
                  >
                    {copiedId === 'provider-id' ? (
                      <Check className="w-4 h-4 text-status-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-text-secondary mt-1">{selectedProvider.name}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mt-3 pl-14">{meta.description}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface rounded-xl border border-border/60 p-4">
            <div className="text-xs text-text-tertiary mb-1">参数数量</div>
            <div className="text-2xl font-bold text-text-primary">{paramEntries.length}</div>
          </div>
          <div className="bg-surface rounded-xl border border-border/60 p-4">
            <div className="text-xs text-text-tertiary mb-1">必填参数</div>
            <div className="text-2xl font-bold text-orange-400">
              {selectedProvider.configSchema.required?.length || 0}
            </div>
          </div>
          <div className="bg-surface rounded-xl border border-border/60 p-4">
            <div className="text-xs text-text-tertiary mb-1">动作类型</div>
            <div className="text-lg font-bold text-text-primary">{cfg.label}</div>
          </div>
        </div>

        {/* Scenarios */}
        <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-status-success" />
            <span className="text-sm font-semibold text-text-primary">典型使用场景</span>
          </div>
          <div className="p-4 space-y-2">
            {meta.scenarios.map((scenario, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                <span className="text-sm text-text-secondary">{scenario}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Params table */}
        <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-text-primary">配置参数</span>
            <span className="text-xs text-text-tertiary ml-auto">{paramEntries.length} 个参数</span>
          </div>
          {paramEntries.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-sm">该动作不需要配置参数</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary font-mono">
                    参数名
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">
                    类型
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">
                    必填
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">
                    说明
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">
                    可选值
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paramEntries.map(([name, prop]) => {
                  const isRequired = selectedProvider.configSchema.required?.includes(name);
                  const type = prop.type || 'unknown';
                  const desc = prop.description || '-';
                  const enumValues = prop.enum;
                  return (
                    <tr key={name} className="hover:bg-background/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-text-primary">{name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-background text-text-secondary font-mono">
                          {type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isRequired ? (
                          <span className="text-xs text-orange-400 font-medium">必填</span>
                        ) : (
                          <span className="text-xs text-text-tertiary">可选</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{desc}</td>
                      <td className="px-4 py-3">
                        {enumValues && enumValues.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {enumValues.map((val, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 text-[10px] bg-background text-text-secondary rounded font-mono"
                              >
                                {String(val)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-text-tertiary">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Input/Output example */}
        <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-text-primary">输入输出示例</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div className="text-xs font-medium text-text-secondary mb-1.5">输入参数</div>
              <pre className="text-xs font-mono text-text-primary bg-background/60 rounded-lg p-3 whitespace-pre-wrap break-all border border-border/40">
                {meta.example.input}
              </pre>
            </div>
            <div>
              <div className="text-xs font-medium text-text-secondary mb-1.5">输出结果</div>
              <pre className="text-xs font-mono text-text-primary bg-background/60 rounded-lg p-3 whitespace-pre-wrap break-all border border-border/40">
                {meta.example.output}
              </pre>
            </div>
          </div>
        </div>

        {/* Test runner */}
        <ProviderTestRunner
          provider={selectedProvider}
          testConfig={testConfig}
          setTestConfig={setTestConfig}
          testMutationPending={testMutationPending}
          testMutationVariables={testMutationVariables}
          onTest={onTest}
          onClearResult={onClearResult}
        />

        {/* Test result */}
        {currentTest && (
          <div
            className={`rounded-xl border overflow-hidden ${
              currentTest.success
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div
              className={`px-4 py-3 flex items-center gap-2 border-b ${
                currentTest.success ? 'border-green-500/20' : 'border-red-500/20'
              }`}
            >
              {currentTest.success ? (
                <>
                  <Check className="w-4 h-4 text-status-success" />
                  <span className="text-sm font-semibold text-status-success">执行成功</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-status-failed" />
                  <span className="text-sm font-semibold text-status-failed">执行失败</span>
                </>
              )}
            </div>
            <div className="p-4">
              <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
                {currentTest.error || currentTest.result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
