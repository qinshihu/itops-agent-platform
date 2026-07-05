import { Terminal, History } from 'lucide-react';
import clsx from 'clsx';
import { logger } from '@/lib/logger';
import api from '../../../../lib/api';
import type { Server as ServerType, CommandHistoryItem } from '../types';

interface CommandHistorySectionProps {
  selectedServer: ServerType;
  commandHistory: CommandHistoryItem[] | undefined;
}

export function CommandHistorySection({
  selectedServer,
  commandHistory,
}: CommandHistorySectionProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-text-primary">命令历史 - {selectedServer.name}</h2>
        <button
          onClick={async () => {
            try {
              const response = await api.get(
                `/api/servers/${selectedServer.id}/command-history/export`,
                { responseType: 'blob' },
              );
              const url = window.URL.createObjectURL(new Blob([response.data]));
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', `command-history-${selectedServer.id}-${Date.now()}.json`);
              document.body.appendChild(link);
              link.click();
              link.remove();
            } catch (error) {
              logger.error('导出失败:', error);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span>📥</span>
          导出历史
        </button>
      </div>
      <div className="space-y-4">
        {commandHistory?.map((item) => (
          <div key={item.id} className="bg-background rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-text-secondary" />
                <span className="text-xs text-text-secondary">
                  {new Date(item.executed_at).toLocaleString()}
                </span>
              </div>
              <span
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium',
                  item.success
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-status-failed/10 text-status-failed',
                )}
              >
                {item.success ? '成功' : '失败'}
              </span>
            </div>
            <div className="mb-2">
              <code className="font-mono text-sm bg-surface px-2 py-1 rounded text-text-primary">
                {item.command}
              </code>
            </div>
            {item.stdout && (
              <details className="mt-2">
                <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                  输出 ({item.stdout.length} 字符)
                </summary>
                <pre className="mt-2 bg-surface p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-40 overflow-y-auto">
                  {item.stdout}
                </pre>
              </details>
            )}
            {item.stderr && (
              <details className="mt-2">
                <summary className="text-xs text-status-warning cursor-pointer hover:text-text-primary">
                  错误 ({item.stderr.length} 字符)
                </summary>
                <pre className="mt-2 bg-status-failed/5 p-3 rounded text-xs overflow-x-auto text-status-failed font-mono max-h-40 overflow-y-auto">
                  {item.stderr}
                </pre>
              </details>
            )}
          </div>
        ))}
        {(!commandHistory || commandHistory.length === 0) && (
          <div className="text-center py-12 text-text-secondary">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无命令历史</p>
          </div>
        )}
      </div>
    </div>
  );
}