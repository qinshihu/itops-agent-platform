/**
 * ToolHistoryPanel —— 调用历史面板
 * v2.1（2026-07-21）：从 AgentToolsPage.tsx 拆分
 */

import { History, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ToolHistoryItem } from './types';

interface ToolHistoryPanelProps {
  history: ToolHistoryItem[];
  onClear: () => void;
}

export function ToolHistoryPanel({ history, onClear }: ToolHistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <History className="w-4 h-4 text-text-secondary" />
        <span className="text-sm font-semibold text-text-primary">调用历史</span>
        <span className="text-xs text-text-tertiary ml-auto">最近 {history.length} 条</span>
        <button
          onClick={onClear}
          className="text-xs text-text-tertiary hover:text-text-secondary px-2 py-0.5 rounded hover:bg-background/50 transition-colors"
        >
          清空
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-border/40">
        {history.map((h) => (
          <li
            key={h.id}
            className="px-4 py-2.5 flex items-center gap-3 hover:bg-background/30 transition-colors"
          >
            {h.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-status-failed flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-text-primary truncate">{h.toolId}</code>
                <span className="text-[10px] text-text-tertiary flex-shrink-0">
                  {new Date(h.timestamp).toLocaleTimeString('zh-CN')}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary truncate mt-0.5 font-mono">
                {h.resultPreview}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ToolHistoryPanel;