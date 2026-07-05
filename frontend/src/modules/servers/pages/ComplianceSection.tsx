import { ShieldCheck, Settings } from 'lucide-react';
import clsx from 'clsx';
import type { Server, CommandResult, ComplianceCheck as _ComplianceCheck } from './types';

interface ComplianceSectionProps {
  selectedServer: Server;
  isRunningCompliance: boolean;
  complianceResults: Record<string, CommandResult> | null;
  complianceOptions: { useAI: boolean; concurrency: number };
  onComplianceOptionsChange: (fn: (prev: { useAI: boolean; concurrency: number }) => { useAI: boolean; concurrency: number }) => void;
  onRunCompliance: (server: Server) => void;
}

export function ComplianceSection({
  selectedServer,
  isRunningCompliance,
  complianceResults,
  complianceOptions,
  onComplianceOptionsChange,
  onRunCompliance,
}: ComplianceSectionProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-text-primary">合规检查结果</h2>
          <p className="text-sm text-text-secondary">
            {selectedServer.name} - {selectedServer.hostname}
          </p>
        </div>
        {isRunningCompliance && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            正在执行检查...
          </div>
        )}
      </div>

      {/* 合规检查选项 */}
      <div className="mb-6 p-4 bg-background rounded-lg border border-border">
        <h3 className="text-sm font-medium text-text-primary mb-4">检查选项</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface/50 transition-colors border border-transparent hover:border-border">
            <div className="relative">
              <input
                type="checkbox"
                checked={complianceOptions.useAI}
                onChange={(e) => {
                  onComplianceOptionsChange(prev => ({
                    ...prev,
                    useAI: e.target.checked,
                  }));
                }}
                disabled={isRunningCompliance}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-surface border-2 border-border rounded-full peer peer-checked:bg-primary peer-checked:border-primary transition-all cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full shadow-md absolute top-1 left-1 peer-checked:translate-x-4 transition-transform"></div>
              </div>
            </div>
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">AI 智能分析</span>
                {complianceOptions.useAI && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                    推荐
                  </span>
                )}
              </div>
              <span className="text-xs text-text-tertiary mt-0.5">
                {complianceOptions.useAI
                  ? '🤖 对检查结果进行智能分析，给出专业建议'
                  : '⚡ 仅执行命令，检查速度提升 60%'}
              </span>
            </div>
          </label>
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">并发执行数</span>
              <span className="text-xs text-text-secondary mt-0.5">同时执行的检查命令数量</span>
            </div>
            <select
              value={complianceOptions.concurrency}
              onChange={(e) => {
                onComplianceOptionsChange(prev => ({
                  ...prev,
                  concurrency: parseInt(e.target.value),
                }));
              }}
              disabled={isRunningCompliance}
              className="ml-auto w-28 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary font-medium"
            >
              <option value={3}>3 (较慢)</option>
              <option value={5}>5 (推荐)</option>
              <option value={8}>8 (较快)</option>
              <option value={10}>10 (最快)</option>
            </select>
          </div>
        </div>
      </div>

      {complianceResults ? (
        <div className="space-y-4">
          {Object.entries(complianceResults).map(([checkName, result]) => (
            <div key={checkName} className="bg-background rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-text-primary">
                  {checkName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h4>
                <span
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    result.success
                      ? 'bg-status-success/10 text-status-success'
                      : 'bg-status-failed/10 text-status-failed',
                  )}
                >
                  {result.success ? '成功' : '失败'}
                </span>
              </div>

              {/* AI 分析结果 */}
              {result.aiAnalysis && (
                <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 text-primary">🤖</div>
                    <span className="text-sm font-medium text-primary">AI 分析建议</span>
                  </div>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{result.aiAnalysis}</p>
                </div>
              )}

              <details className="mt-2">
                <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                  查看原始命令和输出
                </summary>
                <div className="mt-2">
                  <div className="text-sm text-text-secondary mb-1">
                    命令:{' '}
                    <code className="font-mono text-xs bg-surface px-1 rounded">{result.command}</code>
                  </div>
                  {result.stdout && (
                    <div className="mt-2">
                      <p className="text-xs text-text-secondary mb-1">输出:</p>
                      <pre className="bg-surface p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-40 overflow-y-auto">
                        {result.stdout}
                      </pre>
                    </div>
                  )}
                  {result.stderr && (
                    <div className="mt-2">
                      <p className="text-xs text-status-warning mb-1">错误:</p>
                      <pre className="bg-status-failed/5 p-3 rounded text-xs overflow-x-auto text-status-failed font-mono max-h-40 overflow-y-auto">
                        {result.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-text-secondary">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>点击"合规检查"按钮开始执行检查</p>
        </div>
      )}

      {/* 重新检查按钮 */}
      {complianceResults && (
        <div className="mt-6 pt-6 border-t border-border flex justify-center">
          <button
            onClick={() => onRunCompliance(selectedServer)}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Settings className="w-4 h-4" />
            重新执行检查（设置选项）
          </button>
        </div>
      )}
    </div>
  );
}
