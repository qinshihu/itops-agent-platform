import { Tag, Empty } from 'antd';
import { CuboidIcon as Cube } from 'lucide-react';
import type { Slot, Rack } from './types';
import { typeLabelMap } from './types';

interface Props {
  rack: Rack | null;
  slots: Slot[];
  onSelectSlot: (slot: Slot) => void;
}

export default function SlotsPanel({ rack, slots, onSelectSlot }: Props) {
  if (!rack) {
    return (
      <div className="flex items-center justify-center h-64 text-text-tertiary">
        <Empty description="请从左侧选择一个机柜" />
      </div>
    );
  }

  const totalU = rack.total_u || 42;
  const usedU = slots.filter((s) => s.device_id).reduce(
    (sum, s) => sum + (s.end_u - s.start_u + 1), 0
  );
  const utilPercent = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;

  // 构建 U 行
  const rows: React.ReactNode[] = [];
  const occupiedSlots = slots.filter((s) => s.device_id);

  for (let u = totalU; u >= 1; u--) {
    const slot = slots.find((s) => s.start_u <= u && s.end_u >= u && s.device_id);

    if (slot && slot.start_u === u) {
      // 合并行
      const height = slot.end_u - slot.start_u + 1;
      const bgColor =
        slot.device_type === 'server'
          ? 'bg-blue-900/40 border-blue-700/50'
          : slot.device_type === 'network_device'
          ? 'bg-purple-900/40 border-purple-700/50'
          : slot.device_type === 'vm_host'
          ? 'bg-cyan-900/40 border-cyan-700/50'
          : 'bg-gray-700/40 border-gray-600/50';

      rows.push(
        <div
          key={u}
          className={`flex items-center border-b border-gray-800/50 ${bgColor} cursor-pointer hover:brightness-125 transition-all group`}
          style={{ height: `${height * 36}px`, minHeight: '36px' }}
          onClick={() => onSelectSlot(slot)}
        >
          <div className="w-10 text-[10px] text-text-tertiary text-center shrink-0">{u}</div>
          <div className="flex-1 flex items-center px-2 gap-2">
            <div className={`w-2 h-2 rounded-full ${slot.server_status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-medium text-text-primary">{slot.device_name || '(未命名)'}</span>
            <Tag className="text-[10px] leading-none m-0" color="blue">
              {typeLabelMap[slot.device_type] || slot.device_type}
            </Tag>
            {slot.ip_address && (
              <span className="text-[10px] text-text-tertiary ml-1">{slot.ip_address}</span>
            )}
            {slot.cpu_usage !== undefined && (
              <span className="text-[10px] text-text-tertiary ml-auto flex items-center gap-2">
                <span className={slot.cpu_usage > 80 ? 'text-red-400' : ''}>CPU {slot.cpu_usage}%</span>
                <span className={slot.memory_usage > 80 ? 'text-red-400' : ''}>MEM {slot.memory_usage}%</span>
              </span>
            )}
          </div>
        </div>
      );
    } else if (slot && slot.start_u < u && slot.end_u >= u) {
      // 属于合并行的中间部分 — 跳过
      continue;
    } else {
      // 空 U 位
      rows.push(
        <div
          key={u}
          className="flex items-center border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors"
          style={{ height: '36px' }}
        >
          <div className="w-10 text-[10px] text-text-tertiary text-center shrink-0">{u}</div>
          <div className="flex-1" />
        </div>
      );
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/50">
      {/* 头部 */}
      <div className="px-3 py-2 border-b border-gray-800 text-sm font-medium text-text-secondary flex items-center gap-2">
        <Cube size={14} />
        {rack.name} ({rack.room_name || rack.room_label || '?'}) — {totalU}U
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span>
            已占用: <strong className="text-blue-400">{usedU}U</strong> ({utilPercent}%)
          </span>
          <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                utilPercent > 85 ? 'bg-red-500' : utilPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${utilPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* U 位列表 */}
      <div className="overflow-auto" style={{ maxHeight: '700px' }}>
        {rows}
      </div>
    </div>
  );
}
