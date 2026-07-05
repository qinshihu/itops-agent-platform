import { X as XIcon, Loader2 } from 'lucide-react';
import { sanitizeText } from '../../../../lib/xss';
import type { Alert, AutomationLog } from './types';

function formatAutomationLogDetails(details: string | null) {
  if (!details) return '无详情';
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

interface AutomationLogPanelProps {
  alert: Alert;
  onClose: () => void;
  logs: AutomationLog[];
  loading: boolean;
}

export default function AutomationLogPanel({
  alert,
  onClose,
  logs,
  loading,
}: AutomationLogPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border max-w-3xl w-full shadow-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">自动处理记录</h3>
            <p className="text-sm text-text-secondary mt-1">{sanitizeText(alert.title)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center gap-3 text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>加载处理中...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-text-secondary">暂无自动处理记录</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border border-border rounded-lg p-3 bg-background">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-text-primary">{log.action}</span>
                    <span className="text-xs text-text-secondary">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap break-all">
                    {formatAutomationLogDetails(log.details)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}