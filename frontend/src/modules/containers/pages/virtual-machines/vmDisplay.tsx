import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

export const powerColors: Record<string, string> = {
  poweredOn: 'bg-green-500/20 text-green-400 border-green-500/30',
  poweredOff: 'bg-red-500/20 text-red-400 border-red-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export const powerLabels: Record<string, string> = {
  poweredOn: '运行中',
  poweredOff: '已关机',
  suspended: '已挂起',
};

export function platformStatusIcon(status: string) {
  switch (status) {
    case 'active': return <Wifi className="w-4 h-4 text-green-400" />;
    case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
    default: return <WifiOff className="w-4 h-4 text-text-tertiary" />;
  }
}

export function formatMem(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}
