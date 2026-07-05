import { Input, Tag, Spin, Empty } from 'antd';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { typeColorMap, typeLabelMap } from './types';
import type { DeviceGroup, RackGroup, DeviceSlot } from './types';

interface Props {
  groups: DeviceGroup[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
}

export default function DevicesTab({ groups, loading, search, onSearchChange }: Props) {
  const navigate = useNavigate();

  const filtered = groups
    .map((room: DeviceGroup) => ({
      ...room,
      racks: room.racks
        ? Object.fromEntries(
            Object.entries(room.racks).filter(([, rack]: [string, RackGroup]) =>
              !search ||
              rack.rack_name?.toLowerCase().includes(search.toLowerCase()) ||
              rack.devices?.some((d: DeviceSlot) =>
                d.device_name?.toLowerCase().includes(search.toLowerCase())
              )
            )
          )
        : {},
    }))
    .filter((r: DeviceGroup & { racks: Record<string, RackGroup> }) => Object.keys(r.racks).length > 0);

  const navigateToDevice = (device: DeviceSlot) => {
    const routeMap: Record<string, string> = {
      server: '/servers',
      network_device: '/network-devices',
      vm_host: '/virtual-machines',
    };
    navigate(routeMap[device.device_type || ''] || '/dc-manage');
  };

  return (
    <Spin spinning={loading}>
      <div className="mb-4">
        <Input
          prefix={<Search size={14} className="text-text-tertiary" />}
          placeholder="搜索设备名称或机柜编号..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          allowClear
          className="max-w-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <Empty description="暂无设备数据，请先在 U位 中分配设备到机柜" />
      ) : (
        <div className="space-y-6">
          {filtered.map((room) => (
            <div key={room.room_id} className="border border-gray-700 rounded-lg p-3">
              <div className="text-sm font-semibold text-text-primary mb-2">{room.room_name}</div>
              {Object.values(room.racks).map((rack: RackGroup) => (
                <div key={rack.rack_id} className="mb-3 last:mb-0">
                  <div className="text-xs font-semibold text-text-secondary mb-1">{rack.rack_name}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {rack.devices?.map((dev: DeviceSlot) => (
                      <div
                        key={dev.slot_id}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-700/50 hover:border-cyan-500/40 bg-gray-800/30 cursor-pointer transition-colors"
                        onClick={() => navigateToDevice(dev)}
                      >
                        <div>
                          <div className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                            <Tag color={typeColorMap[dev.device_type || ''] || 'default'} className="text-[10px] leading-none m-0">
                              {typeLabelMap[dev.device_type || ''] || dev.device_type}
                            </Tag>
                            {dev.device_name || '(未命名)'}
                          </div>
                          <div className="text-[10px] text-text-tertiary mt-0.5">
                            U{dev.start_u}-U{dev.end_u}
                            {dev.ip_address ? ` · ${dev.ip_address}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Spin>
  );
}
