import type { OverviewData, OverviewSummary } from './types';

interface Props {
  overview: OverviewData | null;
  timeStr: string;
  uptime: string;
  isReal: boolean;
}

export default function DashboardOverlay({ overview, timeStr, uptime, isReal }: Props) {
  const summary: OverviewSummary = overview?.summary || {
    totalDevices: 0, onlineDevices: 0, alertDevices: 0,
    offlineDevices: 0, avgTemp: 0, avgHumidity: 0, totalRacks: 0,
  };

  return (
    <>
      {/* 数据模式标识 */}
      <div className="absolute top-2 left-2 z-20">
        <span
          className={`text-[10px] px-2 py-0.5 rounded ${
            isReal
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
          }`}
        >
          {isReal ? '● 实时数据' : '● 演示数据'}
        </span>
      </div>

      {/* 右上角系统状态 */}
      <div className="absolute top-2 right-[120px] z-20 flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#0a0e1a]/80 backdrop-blur border border-cyan-500/15 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-400">系统正常</span>
        </div>
      </div>

      {/* 标题 - 居中 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap pointer-events-none">
        <h1 className="text-base font-bold tracking-[5px] bg-gradient-to-r from-cyan-400 via-white to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(0,150,255,0.3)] animate-gradient">
          ● 机房数字孪生监控平台 ●
        </h1>
      </div>

      {/* 时间 + 温度 */}
      <div className="absolute top-10 left-2 z-20 text-[10px] text-slate-500 font-mono">
        {timeStr} · ☀ {(summary.avgTemp || 24.5).toFixed(0)}°C 晴朗
      </div>
      <div className="absolute top-12 left-2 z-20 text-[10px] text-slate-500 font-mono">
        {uptime}
      </div>

      {/* 顶部统计卡片 - 左侧 */}
      <div className="absolute top-10 left-2 z-20 flex gap-2 pointer-events-none" style={{ marginTop: '20px' }}>
        {[
          { label: '总机柜', value: summary.totalRacks, icon: '🗄️', color: 'text-cyan-400' },
          { label: '总设备', value: summary.totalDevices, icon: '🖥️', color: 'text-gray-300' },
          { label: '在线率', value: summary.totalDevices > 0
              ? `${((summary.onlineDevices / summary.totalDevices) * 100).toFixed(1)}%`
              : '0%', icon: '📊', color: 'text-green-400' },
          { label: '告警', value: summary.alertDevices, icon: '🚨', color: summary.alertDevices > 0 ? 'text-red-400' : 'text-green-400' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0a1420]/70 backdrop-blur border border-gray-700/30 rounded-lg px-2.5 py-1.5 min-w-[80px] shadow-lg">
            <div className="text-[10px] text-slate-500 mb-0.5">{s.icon} {s.label}</div>
            <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* PUE 大数字 */}
      <div className="absolute top-10 right-4 z-20 text-right pointer-events-none">
        <div className="text-[10px] text-slate-500 mb-0.5">PUE</div>
        <div className="text-2xl font-bold font-mono bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          {(overview?.pue || 0).toFixed(2)}
        </div>
      </div>

      {/* 无数据覆盖层 */}
      {!isReal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="text-center bg-[#0a0e1a]/80 backdrop-blur border border-cyan-500/20 rounded-2xl px-8 py-6">
            <div className="text-4xl mb-3">🏚</div>
            <h3 className="text-lg font-bold text-white mb-2">暂无数据中心资产</h3>
            <p className="text-sm text-slate-400 mb-4">请先在数据中心管理中添加机房和机柜</p>
            <a
              href="/dc-manage"
              className="inline-block px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white text-sm pointer-events-auto hover:opacity-90 transition-opacity"
            >
              前往数据中心管理
            </a>
          </div>
        </div>
      )}
    </>
  );
}
