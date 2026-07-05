import { ShieldCheck, X } from 'lucide-react';
import clsx from 'clsx';
import type { Server as ServerType } from '../types';

interface ComplianceOptions {
  useAI: boolean;
  concurrency: number;
}

interface ServerComplianceOptionsModalProps {
  isOpen: boolean;
  selectedServer: ServerType | null;
  complianceOptions: ComplianceOptions;
  onComplianceOptionsChange: (updater: (prev: ComplianceOptions) => ComplianceOptions) => void;
  isRunningCompliance: boolean;
  onClose: () => void;
  onStartCheck: () => void;
}

export function ServerComplianceOptionsModal({
  isOpen,
  selectedServer,
  complianceOptions,
  onComplianceOptionsChange,
  isRunningCompliance,
  onClose,
  onStartCheck,
}: ServerComplianceOptionsModalProps) {
  if (!isOpen || !selectedServer) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">合规检查</h3>
              <p className="text-sm text-text-secondary mt-1">
                {selectedServer.name} ({selectedServer.hostname})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="space-y-6">
          {/* AI 智能分析开关 */}
          <div className="p-4 bg-background rounded-lg border border-border">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">AI 智能分析</span>
                  {complianceOptions.useAI && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                      推荐
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-tertiary mt-1">
                  {complianceOptions.useAI
                    ? '🤖 对检查结果进行智能分析，给出专业建议'
                    : '⚡ 仅执行命令，检查速度提升 60%'}
                </span>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={complianceOptions.useAI}
                  onChange={(e) =>
                    onComplianceOptionsChange((prev) => ({ ...prev, useAI: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface border-2 border-border rounded-full peer peer-checked:bg-primary peer-checked:border-primary transition-all">
                  <div className="w-4 h-4 bg-white rounded-full shadow-md absolute top-0.5 left-0.5 peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </div>
            </label>
          </div>

          {/* 并发数选择 */}
          <div className="p-4 bg-background rounded-lg border border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-medium text-text-primary">并发执行数</span>
                <p className="text-xs text-text-tertiary mt-1">同时执行的检查命令数量</p>
              </div>
              <span className="text-lg font-bold text-primary">
                {complianceOptions.concurrency}
              </span>
            </div>
            <div className="flex gap-2">
              {[3, 5, 8, 10].map((num) => (
                <button
                  key={num}
                  onClick={() =>
                    onComplianceOptionsChange((prev) => ({ ...prev, concurrency: num }))
                  }
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                    complianceOptions.concurrency === num
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-secondary hover:text-text-primary border border-border',
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-text-tertiary">
              <span>较慢（稳定）</span>
              <span>推荐</span>
              <span>较快（对服务器压力大）</span>
            </div>
          </div>

          {/* 预计时间提示 */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300">
              ⏱️ 预计执行时间：约{' '}
              <strong>
                {complianceOptions.useAI
                  ? 15 + (10 - complianceOptions.concurrency) * 2
                  : 3 + (10 - complianceOptions.concurrency)}
              </strong>{' '}
              秒
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onStartCheck}
            disabled={isRunningCompliance}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRunningCompliance ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                检查中...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                开始检查
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}