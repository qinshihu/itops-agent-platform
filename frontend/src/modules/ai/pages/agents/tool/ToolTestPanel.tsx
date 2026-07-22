/**
 * ToolTestPanel —— 工具执行测试面板
 * v2.1（2026-07-21）：从 AgentToolsPage.tsx 拆分
 *
 * P2-9 关键改造：
 * - testArgs 类型：Record<string, string> → Record<string, unknown>
 * - 动态编辑器：boolean → select；number → type="number"；
 *                object/array → textarea (JSON)；其他 → text input
 * - 提交前调用 buildToolArgs() 一次性转换，无需 JSON.parse
 */

import { Play, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AgentTool, ToolTestResult } from './types';
import { buildToolArgs } from './types';

interface ToolTestPanelProps {
  tool: AgentTool;
  testArgs: Record<string, unknown>;
  setTestArgs: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  testResult: ToolTestResult | undefined;
  isPending: boolean;
  onTest: () => void;
  onClearResult: () => void;
  onError: (msg: string) => void;
}

export function ToolTestPanel({
  tool,
  testArgs,
  setTestArgs,
  testResult,
  isPending,
  onTest,
  onClearResult,
  onError,
}: ToolTestPanelProps) {
  const paramEntries = Object.entries(tool.schema.properties || {});

  // 客户端必填校验（提前于提交）
  const handleTest = () => {
    const built = buildToolArgs(tool.schema, testArgs);
    const required = tool.schema.required || [];
    const missing = required.filter((r) => built[r] === undefined);
    if (missing.length > 0) {
      onError(`缺少必填参数: ${missing.join(', ')}`);
      return;
    }
    onTest();
  };

  return (
    <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <Play className="w-4 h-4 text-status-success" />
        <span className="text-sm font-semibold text-text-primary">执行测试</span>
        {isPending && (
          <span className="text-xs text-text-tertiary ml-2">执行中...</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {paramEntries.length === 0 ? (
          <p className="text-sm text-text-tertiary">该工具不需要参数，直接点击执行即可</p>
        ) : (
          <div className="grid gap-3">
            {paramEntries.map(([name, prop]) => {
              const isRequired = tool.schema.required?.includes(name);
              const type = (prop as { type?: string }).type || 'string';
              const desc = (prop as { description?: string }).description;

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

                  {/* P2-9：动态编辑器 */}
                  {type === 'boolean' ? (
                    <select
                      value={
                        testArgs[name] === true
                          ? 'true'
                          : testArgs[name] === false
                            ? 'false'
                            : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setTestArgs((prev) => ({
                          ...prev,
                          [name]: v === '' ? undefined : v === 'true',
                        }));
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">-- 请选择 --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : type === 'number' || type === 'integer' ? (
                    <input
                      type="number"
                      value={
                        typeof testArgs[name] === 'number'
                          ? (testArgs[name] as number)
                          : (testArgs[name] as string) ?? ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setTestArgs((prev) => ({
                          ...prev,
                          [name]: v === '' ? undefined : Number(v),
                        }));
                      }}
                      placeholder={desc || `输入 ${name}`}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  ) : type === 'object' || type === 'array' ? (
                    <textarea
                      value={
                        typeof testArgs[name] === 'string'
                          ? (testArgs[name] as string)
                          : testArgs[name] !== undefined
                            ? JSON.stringify(testArgs[name], null, 2)
                            : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') {
                          setTestArgs((prev) => ({ ...prev, [name]: undefined }));
                          return;
                        }
                        // 尝试实时解析 JSON，解析失败时保留原始字符串以便编辑
                        try {
                          setTestArgs((prev) => ({ ...prev, [name]: JSON.parse(v) }));
                        } catch {
                          setTestArgs((prev) => ({ ...prev, [name]: v }));
                        }
                      }}
                      placeholder={desc || `输入 ${type} 类型的 JSON 值`}
                      rows={3}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={(testArgs[name] as string) ?? ''}
                      onChange={(e) =>
                        setTestArgs((prev) => ({ ...prev, [name]: e.target.value }))
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
            onClick={handleTest}
            disabled={isPending}
            className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30"
          >
            <Play className="w-4 h-4" />
            {isPending ? '执行中...' : '执行测试'}
          </button>
          {testResult && (
            <button
              onClick={onClearResult}
              className="px-4 py-2 bg-background hover:bg-surface/80 text-text-secondary rounded-lg text-sm font-medium border border-border/60 transition-all flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              清除结果
            </button>
          )}
        </div>

        {testResult && (
          <div
            className={`mt-4 rounded-xl border overflow-hidden ${
              testResult.success
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div
              className={`px-4 py-3 flex items-center gap-2 border-b ${
                testResult.success ? 'border-green-500/20' : 'border-red-500/20'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-status-success" />
                  <span className="text-sm font-semibold text-status-success">执行成功</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-status-failed" />
                  <span className="text-sm font-semibold text-status-failed">执行失败</span>
                </>
              )}
            </div>
            <div className="p-4">
              <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
                {testResult.error || testResult.result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolTestPanel;