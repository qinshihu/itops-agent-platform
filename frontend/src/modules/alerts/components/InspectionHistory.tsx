import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, History, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '../../../lib/api';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

interface InspectionHistoryProps {
  deviceId: string;
  deviceName: string;
  onClose: () => void;
}

interface HistoryItem {
  id: string;
  device_id: string;
  inspection_type: 'standard' | 'custom' | 'full' | 'snmp';
  status: 'success' | 'partial' | 'failed';
  commands_executed: number;
  commands_failed: number;
  results: string;
  summary: string;
  duration_ms: number;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  standard: '标准巡检',
  custom: '自定义巡检',
  full: '全面巡检',
  snmp: 'SNMP 巡检'
};

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    success: 'bg-green-500/10 text-green-400 border border-green-500/20',
    partial: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20'
  };
  const labels: Record<string, string> = {
    success: '成功',
    partial: '部分失败',
    failed: '失败'
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status] || 'bg-surface text-text-secondary border border-border'}`}>
      {labels[status] || status}
    </span>
  );
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

export default function InspectionHistory({ deviceId, deviceName, onClose }: InspectionHistoryProps) {
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  useEscapeKey({ onEscape: () => { if (selectedHistory) setSelectedHistory(null); else onClose(); } });

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['inspection-history', deviceId],
    queryFn: () => api.get(`/api/network-devices/${deviceId}/history`).then(res => res.data.data)
  });

  const handleViewDetails = (item: HistoryItem) => {
    setSelectedHistory(item);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-text-secondary" />
            <h3 className="text-base font-medium text-text-primary">
              巡检历史 - {deviceName}
            </h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="w-12 h-12 text-text-secondary/40 mb-3" />
              <p className="text-sm text-text-secondary">暂无巡检记录</p>
              <p className="text-xs text-text-secondary/60 mt-1">执行巡检后这里会显示历史记录</p>
            </div>
          ) : (
            <div className="p-6 space-y-2">
              {history.map((item: HistoryItem) => (
                <div
                  key={item.id}
                  onClick={() => handleViewDetails(item)}
                  className="flex items-center justify-between p-4 bg-background rounded-lg hover:bg-background/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {item.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : item.status === 'partial' ? (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {typeLabels[item.inspection_type]}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {new Date(item.created_at).toLocaleString('zh-CN')} · {formatDuration(item.duration_ms)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(item.status)}
                    <p className="text-xs text-text-secondary mt-1">
                      {item.commands_executed} 命令 · {item.commands_failed} 失败
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-background/50 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
          >
            关闭
          </button>
        </div>
      </div>

      {selectedHistory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h4 className="text-base font-medium text-text-primary">
                巡检详情
              </h4>
              <button
                onClick={() => setSelectedHistory(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-secondary">巡检类型</span>
                  <p className="font-medium text-text-primary">{typeLabels[selectedHistory.inspection_type]}</p>
                </div>
                <div>
                  <span className="text-text-secondary">状态</span>
                  <p className="mt-1">{getStatusBadge(selectedHistory.status)}</p>
                </div>
                <div>
                  <span className="text-text-secondary">执行时间</span>
                  <p className="font-medium text-text-primary">{formatDuration(selectedHistory.duration_ms)}</p>
                </div>
                <div>
                  <span className="text-text-secondary">创建时间</span>
                  <p className="font-medium text-text-primary">{new Date(selectedHistory.created_at).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <span className="text-text-secondary">命令执行</span>
                  <p className="font-medium text-text-primary">{selectedHistory.commands_executed}</p>
                </div>
                <div>
                  <span className="text-text-secondary">命令失败</span>
                  <p className="font-medium text-text-primary">{selectedHistory.commands_failed}</p>
                </div>
              </div>

              {selectedHistory.summary && (
                <div>
                  <span className="text-sm text-text-secondary">巡检摘要</span>
                  <p className="mt-1 text-sm text-text-primary bg-background p-3 rounded-md">{selectedHistory.summary}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-4 bg-background/50 border-t border-border">
              <button
                onClick={() => setSelectedHistory(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
