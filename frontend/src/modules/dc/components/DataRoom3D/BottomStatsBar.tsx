import type { OverviewData, OverviewSummary } from './types';

interface Props {
  overview: OverviewData | null;
}

const METRICS = [
  { key: 'pue', icon: '⚡', label: 'PUE', fmt: (v: number) => v.toFixed(2), color: 'text-cyan-400' },
  { key: 'totalPower', icon: '🔌', label: '总功', fmt: (v: number) => `${v.toFixed(1)}kW`, color: 'text-gray-300' },
  { key: 'coolingPower', icon: '❄', label: '制冷', fmt: (v: number) => `${v.toFixed(1)}kW`, color: 'text-cyan-400' },
  { key: 'itPower', icon: '💻', label: 'IT', fmt: (v: number) => `${v.toFixed(1)}kW`, color: 'text-gray-300' },
];

const SUMMARY_METRICS = [
  { key: 'avgTemp', icon: '🌡', label: '温度', fmt: (v: number) => `${v.toFixed(1)}°C`, color: 'text-green-400' },
  { key: 'avgHumidity', icon: '💧', label: '湿度', fmt: (v: number) => `${v}%`, color: 'text-cyan-400' },
  { key: 'totalDevices', icon: '🖥', label: '设备', fmt: (v: number) => v.toLocaleString(), color: 'text-gray-300' },
  { key: 'onlineDevices', icon: '✅', label: '在线', fmt: (v: number) => v.toLocaleString(), color: 'text-green-400' },
  { key: 'alertDevices', icon: '⚠', label: '告警', fmt: (v: number) => v, color: 'text-orange-400' },
  { key: 'offlineDevices', icon: '❌', label: '离线', fmt: (v: number) => v, color: 'text-red-400' },
];

export default function BottomStatsBar({ overview }: Props) {
  const summary: OverviewSummary = overview?.summary || {
    totalDevices: 0, onlineDevices: 0, alertDevices: 0,
    offlineDevices: 0, avgTemp: 0, avgHumidity: 0, totalRacks: 0,
  };

  const allMetrics = [
    ...METRICS.map(m => ({ ...m, value: m.fmt((overview as any)?.[m.key] ?? 0) })),
    ...SUMMARY_METRICS.map(m => ({ ...m, value: m.fmt((summary as any)?.[m.key] ?? 0) })),
  ];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-[1200px]">
      <div className="bg-[#0a1420]/85 backdrop-blur-md border border-cyan-500/15 rounded-xl px-4 py-2.5 shadow-lg shadow-cyan-500/5">
        <div className="grid grid-cols-10 gap-2">
          {allMetrics.map((m, i) => (
            <div key={i} className="text-center group hover:bg-white/5 rounded-lg py-1 transition-colors">
              <div className="text-[11px] leading-tight mb-0.5">{m.icon}</div>
              <div className={`text-xs font-bold font-mono ${m.color || 'text-gray-300'}`}>{m.value}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
