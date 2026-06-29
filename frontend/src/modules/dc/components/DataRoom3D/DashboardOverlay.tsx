import type { OverviewData, OverviewSummary, Rack3D, AlertItem } from './types';
import type { ViewMode } from './Scene';

interface DashboardOverlayProps {
  overview: OverviewData | null;
  racks: Rack3D[];
  alerts: AlertItem[];
  timeStr: string;
  uptime: string;
  isReal: boolean;
  searchQuery: string;
  viewMode: ViewMode;
  onSearchChange: (q: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigateDC: () => void;
}

export default function DashboardOverlay({
  overview,
  racks,
  alerts,
  timeStr,
  isReal,
  searchQuery,
  viewMode,
  onSearchChange,
  onViewModeChange,
  onNavigateDC,
}: DashboardOverlayProps) {
  const summary: OverviewSummary = overview?.summary || {
    totalDevices: 0, onlineDevices: 0, alertDevices: 0,
    offlineDevices: 0, avgTemp: 0, avgHumidity: 0, totalRacks: 0,
  };

  const pue = overview?.pue ?? 0;
  const totalPower = ((overview as any)?.totalPower || 0) / 1000;
  const coolingPower = ((overview as any)?.coolingPower || 0) / 1000;
  const itPower = ((overview as any)?.itPower || 0) / 1000;

  // 使用真实机柜数据生成左侧机柜状态列表
  const rackStatusList = racks.slice(0, 12).map(r => ({
    name: r.name,
    pct: r.totalU > 0 ? Math.round((r.usedU / r.totalU) * 100) : 0,
    warn: r.alertCount > 0,
  }));

  // 使用真实告警数据生成底部告警条
  const alertItems = alerts.length > 0
    ? alerts.slice(0, 10).map(a => ({
        time: a.time || '',
        msg: a.title || '',
        level: (a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
      }))
    : [];

  const viewModes: { key: ViewMode; label: string }[] = [
    { key: 'overview', label: '总览' },
    { key: 'zoneA', label: 'A区' },
    { key: 'zoneB', label: 'B区' },
  ];

  return (
    <>
      {/* ── 顶部标题栏 ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-8 py-2.5 bg-gradient-to-b from-[rgba(12,24,50,0.9)] to-[rgba(8,16,32,0.7)] backdrop-blur-xl border-b border-[rgba(0,245,255,0.15)]">
        <div className="flex items-center gap-5">
          <span className="text-[12px] text-[#5a7a94] font-mono tracking-[0.5px]">{timeStr}</span>
        </div>

        <h1 className="text-2xl font-bold tracking-[5px] bg-gradient-to-r from-[#00f5ff] via-white to-[#00ff88] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient"
          style={{ filter: 'drop-shadow(0 0 12px rgba(0,245,255,0.3))' }}>
          <span className="text-[#00f5ff] text-xs animate-pulse">◆</span>
          {' '}机房数字孪生监控平台{' '}
          <span className="text-[#00f5ff] text-xs animate-pulse">◆</span>
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.3)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute w-full h-full rounded-full bg-[#00ff88] animate-ping opacity-60" />
              <span className="relative w-full h-full rounded-full bg-[#00ff88]" />
            </span>
            <span className="text-[11px] text-[#00ff88]">{isReal ? '系统运行正常' : '演示模式'}</span>
          </div>
          <button
            onClick={onNavigateDC}
            className="px-4 py-1.5 rounded-full bg-[rgba(0,245,255,0.08)] border border-[rgba(0,245,255,0.2)] text-[11px] text-[#00f5ff] hover:bg-[rgba(0,245,255,0.15)] transition-all"
          >
            数据中心管理
          </button>
        </div>
      </div>

      {/* ── 指标卡片行 ── */}
      <div className="absolute top-14 left-4 right-4 z-20 flex gap-2.5 overflow-x-auto">
        {[
          { label: 'PUE', value: pue > 0 ? pue.toFixed(2) : '--', icon: '⚡', cls: 'text-[#00f5ff]' },
          { label: '总功耗', value: totalPower > 0 ? `${totalPower.toFixed(1)} kW` : '--', icon: '🔌', cls: 'text-[#00f5ff]' },
          { label: '制冷功耗', value: coolingPower > 0 ? `${coolingPower.toFixed(1)} kW` : '--', icon: '❄', cls: 'text-[#00f5ff]' },
          { label: 'IT功耗', value: itPower > 0 ? `${itPower.toFixed(1)} kW` : '--', icon: '💻', cls: 'text-[#00f5ff]' },
          { label: '平均温度', value: summary.avgTemp > 0 ? `${summary.avgTemp.toFixed(1)}°C` : '--', icon: '🌡', cls: 'text-[#00ff88]' },
          { label: '平均湿度', value: summary.avgHumidity > 0 ? `${summary.avgHumidity}%` : '--', icon: '💧', cls: 'text-[#00f5ff]' },
          { label: '设备总数', value: summary.totalDevices.toLocaleString(), icon: '🖥', cls: 'text-[#00f5ff]' },
          { label: '在线', value: summary.onlineDevices.toLocaleString(), icon: '✅', cls: 'text-[#00ff88]' },
          { label: '告警', value: summary.alertDevices, icon: '⚠', cls: 'text-[#ffaa00]' },
          { label: '离线', value: summary.offlineDevices, icon: '❌', cls: 'text-[#ff3366]' },
        ].map((m, i) => (
          <div key={i} className="flex-1 min-w-[110px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[rgba(10,18,38,0.88)] border border-[rgba(0,245,255,0.15)] backdrop-blur-xl hover:border-[rgba(0,245,255,0.4)] hover:shadow-[0_0_20px_rgba(0,245,255,0.3)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-[rgba(0,245,255,0.08)] text-xl">
              {m.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#5a7a94] uppercase tracking-[0.5px]">{m.label}</span>
              <span className={`text-base font-bold font-mono ${m.cls}`}
                style={{ filter: `drop-shadow(0 0 6px ${m.cls === 'text-[#00f5ff]' ? 'rgba(0,245,255,0.3)' : m.cls === 'text-[#00ff88]' ? 'rgba(0,255,136,0.3)' : m.cls === 'text-[#ffaa00]' ? 'rgba(255,170,0,0.3)' : 'rgba(255,51,102,0.3)'})` }}>
                {m.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 左侧面板 ── */}
      <div className="absolute left-4 top-36 bottom-20 z-20 w-[18%] flex flex-col gap-3">
        {/* 搜索 */}
        <div className="rounded-2xl bg-[rgba(10,18,38,0.88)] border border-[rgba(0,245,255,0.15)] backdrop-blur-xl p-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5a7a94]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索机柜名称..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[rgba(0,0,0,0.3)] border border-[rgba(0,245,255,0.15)] rounded-lg text-[#e8edf3] placeholder:text-[#5a7a94] focus:outline-none focus:border-[rgba(0,245,255,0.4)] transition-all"
            />
          </div>
        </div>

        {/* 机柜状态 */}
        <div className="flex-1 rounded-2xl bg-[rgba(10,18,38,0.88)] border border-[rgba(0,245,255,0.15)] backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[rgba(0,245,255,0.06)] to-transparent border-b border-[rgba(0,245,255,0.15)]">
            <span className="text-sm">🗄</span>
            <h3 className="text-[13px] font-semibold text-[#e8edf3] tracking-[1px]">机柜状态</h3>
          </div>
          <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-y-auto">
            {rackStatusList.length > 0 ? rackStatusList.map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="w-10 text-[11px] text-[#5a7a94] font-mono font-medium">{r.name}</span>
                <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-800 ${r.warn ? 'bg-gradient-to-r from-[#ff6600] to-[#ffaa00]' : 'bg-gradient-to-r from-[#0099aa] to-[#00f5ff]'}`}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[11px] text-[#5a7a94] font-mono">{r.pct}%</span>
              </div>
            )) : (
              <div className="text-center text-[11px] text-[#5a7a94] py-4">暂无数据</div>
            )}
          </div>
        </div>
      </div>

      {/* ── 场景控制按钮 ── */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex gap-2 px-1.5 py-1 rounded-full bg-[rgba(8,16,32,0.85)] border border-[rgba(0,245,255,0.15)] backdrop-blur-xl">
        {viewModes.map((v) => (
          <button
            key={v.key}
            onClick={() => onViewModeChange(v.key)}
            className={`px-4 py-2 rounded-full text-xs font-medium tracking-[0.5px] transition-all ${
              viewMode === v.key
                ? 'bg-gradient-to-r from-[rgba(0,245,255,0.2)] to-[rgba(0,245,255,0.08)] text-[#00f5ff] shadow-[0_0_12px_rgba(0,245,255,0.15)]'
                : 'text-[#5a7a94] hover:text-[#00f5ff] hover:bg-[rgba(0,245,255,0.1)]'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── 底部告警条 ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-12 flex items-center bg-gradient-to-t from-[rgba(8,16,32,0.9)] to-[rgba(6,12,24,0.85)] backdrop-blur-xl border-t border-[rgba(0,245,255,0.15)] px-6">
        <div className="flex items-center gap-2 pr-3 border-r border-[rgba(0,245,255,0.15)] flex-shrink-0">
          <span className="text-sm">🔔</span>
          <span className="text-xs font-semibold text-[#ff3366] tracking-[0.5px]">实时告警</span>
          <span className="px-2 py-0.5 rounded-full bg-[#ff3366] text-white text-[10px] font-bold">{summary.alertDevices}</span>
        </div>
        <div className="flex-1 ml-3 overflow-hidden relative"
          style={{ maskImage: 'linear-gradient(90deg, transparent, black 2%, black 98%, transparent)' }}>
          {alertItems.length > 0 ? (
            <div className="flex gap-6 animate-scroll-alerts whitespace-nowrap">
              {[...alertItems, ...alertItems].map((a, i) => (
                <div key={i} className={`inline-flex items-center gap-1.5 text-[11px] flex-shrink-0 ${a.level === 'critical' ? 'text-[#ff3366]' : a.level === 'warning' ? 'text-[#ffaa00]' : 'text-[#00f5ff]'}`}>
                  <span className="text-[#5a7a94] font-mono">{a.time}</span>
                  <span className="text-[rgba(0,245,255,0.2)]">|</span>
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-[#5a7a94]">暂无告警</div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 200% center; }
        }
        .animate-gradient { animation: gradient 4s ease infinite; }
        @keyframes scroll-alerts {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-alerts { animation: scroll-alerts 30s linear infinite; }
      `}</style>
    </>
  );
}
