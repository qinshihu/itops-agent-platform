import { useRef, useEffect } from 'react';
import type { AlertItem } from './types';

interface Props {
  alerts: AlertItem[];
}

const severityColors: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  warning: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

export default function AlertPanel({ alerts }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current || alerts.length === 0) return;
    const el = scrollRef.current;
    const interval = setInterval(() => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
        el.scrollTop = 0;
      } else {
        el.scrollBy({ top: 20, behavior: 'smooth' });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-16 right-4 z-20 w-[280px] bg-[#0a1420]/90 backdrop-blur-md border border-red-500/15 rounded-xl overflow-hidden shadow-lg shadow-red-500/5">
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border-b border-red-500/10">
        <span className="text-xs">🔔</span>
        <span className="text-xs font-semibold text-red-400">实时告警</span>
        <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded-full font-mono">
          {alerts.length}
        </span>
      </div>
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto scroll-smooth">
        {alerts.slice(0, 20).map((a, i) => (
          <div
            key={a.id || i}
            className={`px-3 py-1.5 border-b border-gray-800/50 text-[10px] ${
              severityColors[a.severity] || 'text-slate-400'
            }`}
          >
            <span className="font-medium truncate block">{a.title}</span>
            {a.source && <span className="text-[9px] text-slate-600">{a.source}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
