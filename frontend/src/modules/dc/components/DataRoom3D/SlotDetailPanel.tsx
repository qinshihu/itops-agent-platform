import type { Rack3D, SlotInfo } from './types';

interface Props {
  rack: Rack3D;
  slots: SlotInfo[];
  onClose: () => void;
}

const typeColors: Record<string, string> = {
  server: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  network_device: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  vm_host: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  pdu: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  storage: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const statusColors: Record<string, string> = {
  online: 'text-green-400',
  offline: 'text-red-400',
  warning: 'text-orange-400',
  unknown: 'text-slate-500',
};

export default function SlotDetailPanel({ rack, slots, onClose }: Props) {
  const usagePercent = rack.totalU > 0 ? Math.round((rack.usedU / rack.totalU) * 100) : 0;

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-[320px] max-h-[70vh] bg-[#0a1420]/95 backdrop-blur-xl border border-cyan-500/20 rounded-xl shadow-2xl shadow-cyan-500/5 overflow-hidden transition-all duration-300">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/30">
        <div>
          <h3 className="text-sm font-bold text-white">{rack.name}</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {rack.usedU}/{rack.totalU}U · {usagePercent}% 已用
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* 进度条 */}
      <div className="px-4 py-2">
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usagePercent > 80 ? 'bg-orange-500' : usagePercent > 60 ? 'bg-yellow-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* U 位列表 */}
      <div className="overflow-y-auto max-h-[calc(70vh-120px)] px-4 pb-4">
        {slots.length === 0 ? (
          <p className="text-[11px] text-slate-600 text-center py-6">暂无设备信息</p>
        ) : (
          <div className="space-y-1.5">
            {slots.map((slot, i) => {
              const typeColor = typeColors[slot.deviceType] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
              const statusColor = statusColors[slot.deviceStatus || 'unknown'] || 'text-slate-500';
              return (
                <div
                  key={slot.id || i}
                  className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-transparent hover:border-cyan-500/20 transition-colors"
                >
                  {/* U 位标签 */}
                  <span className="text-[10px] text-slate-600 font-mono w-12 shrink-0">
                    {slot.startU}-{slot.endU}U
                  </span>

                  {/* 设备信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white truncate">{slot.deviceName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] px-1 rounded border ${typeColor}`}>
                        {slot.deviceType}
                      </span>
                      <span className={`text-[9px] ${statusColor}`}>
                        ● {slot.deviceStatus}
                      </span>
                    </div>
                  </div>

                  {/* 资源占用 */}
                  <div className="text-right shrink-0">
                    {slot.cpuUsage != null && (
                      <div className="text-[9px] text-slate-500">
                        CPU {slot.cpuUsage}%
                      </div>
                    )}
                    {slot.memUsage != null && (
                      <div className="text-[9px] text-slate-500">
                        内存 {slot.memUsage}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
