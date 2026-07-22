import { CheckCircle2, Loader2, Wifi, X } from 'lucide-react';
import type { NetworkDevice } from './types';

interface InspectionModalProps {
  device: NetworkDevice;
  inspectionType: 'standard' | 'custom' | 'full';
  customDescription: string;
  setCustomDescription: (v: string) => void;
  isInspecting: boolean;
  onClose: () => void;
  onStart: () => void;
}

const STANDARD_ITEMS = ['CPU 使用率', '内存使用率', '接口状态', '版本信息', '路由表', '系统日志', '环境状态', '电源/风扇'];
const FULL_ITEMS = ['CPU', '内存', '接口', '版本', '路由', '日志', '环境', '电源', '风扇', 'STP', 'VLAN', 'ARP', 'MAC'];

export function InspectionModal({
  device, inspectionType, customDescription, setCustomDescription,
  isInspecting, onClose, onStart,
}: InspectionModalProps) {
  const canStart = !isInspecting && !(inspectionType === 'custom' && !customDescription.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-medium text-text-primary">巡检 - {device.name}</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {inspectionType === 'standard' && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">标准巡检将检查以下项目：</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {STANDARD_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-2 text-text-secondary">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />{item}
                  </div>
                ))}
              </div>
            </div>
          )}
          {inspectionType === 'custom' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-primary">巡检需求描述</label>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="例如：检查 BGP 邻居状态，查看 ACL 配置..."
                className="w-full h-24 px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-colors"
              />
              <p className="text-xs text-text-secondary/60">系统将通过知识库检索相关命令并分析结果</p>
            </div>
          )}
          {inspectionType === 'full' && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">全面巡检将执行所有标准巡检项，包括：</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {FULL_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-2 text-text-secondary">
                    <CheckCircle2 className="w-3 h-3 text-primary" />{item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-background/50 rounded-b-xl border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
          >取消</button>
          <button
            onClick={onStart}
            disabled={!canStart}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isInspecting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />巡检中...</>
            ) : (
              <><Wifi className="w-4 h-4" />开始巡检</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}