import { Network, MoreHorizontal, Cpu, MemoryStick, Wifi, History, Play, Settings, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string;
  os_version?: string;
  ssh_port: number;
  username: string;
  location?: string;
  role?: string;
  status: string;
  last_inspection_at?: string;
  last_inspection_result?: string;
  created_at: string;
  updated_at: string;
  snmp_enabled?: number;
  snmp_credential_name?: string;
}

interface NetworkDeviceCardProps {
  device: NetworkDevice;
  onEdit: (device: NetworkDevice) => void;
  onDelete: (device: NetworkDevice) => void;
  onInspect: (device: NetworkDevice, type: 'standard' | 'custom' | 'full') => void;
  onSnmpInspect?: (device: NetworkDevice) => void;
  onSnmpTestConnection?: (device: NetworkDevice) => void;
  onTestConnection: (device: NetworkDevice) => void;
  onHistory: (device: NetworkDevice) => void;
}

const vendorConfig: Record<string, { label: string; color: string; bgClass: string; icon: string }> = {
  huawei: { label: '华为', color: 'text-red-400', bgClass: 'bg-red-500/10 border border-red-500/20', icon: '🔴' },
  cisco: { label: '思科', color: 'text-blue-400', bgClass: 'bg-blue-500/10 border border-blue-500/20', icon: '🔵' },
  h3c: { label: '华三', color: 'text-green-400', bgClass: 'bg-green-500/10 border border-green-500/20', icon: '' },
  ruijie: { label: '锐捷', color: 'text-purple-400', bgClass: 'bg-purple-500/10 border border-purple-500/20', icon: '🟣' },
  zte: { label: '中兴', color: 'text-orange-400', bgClass: 'bg-orange-500/10 border border-orange-500/20', icon: '' }
};

const roleIcons: Record<string, { icon: string; label: string }> = {
  router: { icon: '🌐', label: '路由器' },
  switch: { icon: '🔀', label: '交换机' },
  firewall: { icon: '🛡️', label: '防火墙' },
  ap: { icon: '📡', label: 'AP' }
};

export default function NetworkDeviceCard({ device, onEdit, onDelete, onInspect, onSnmpInspect, onSnmpTestConnection, onTestConnection, onHistory }: NetworkDeviceCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleToggleMenu = () => {
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 160 });
    }
    setShowMenu(!showMenu);
  };

  const vendor = vendorConfig[device.vendor] || { label: device.vendor, color: 'text-text-secondary', bgClass: 'bg-surface border border-border', icon: '⚪' };
  const role = roleIcons[device.role || ''] || { icon: '📦', label: device.role || '设备' };

  const statusColor = device.status === 'online' ? 'bg-green-500' : 'bg-gray-500';
  const statusText = device.status === 'online' ? '在线' : '离线';

  const formatLastInspection = (date?: string) => {
    if (!date) return '未巡检';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return `${Math.floor(diff / (1000 * 60))} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="bg-surface rounded-xl border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary truncate max-w-[160px]">{device.name}</h3>
              <p className="text-xs text-text-secondary font-mono">{device.ip_address}</p>
            </div>
          </div>
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={handleToggleMenu}
              className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div
                ref={menuRef}
                className="fixed w-40 bg-surface rounded-lg shadow-xl border border-border py-1 z-50"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <button
                  onClick={() => { setShowMenu(false); onInspect(device, 'standard'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <Play className="w-3 h-3" />
                  标准巡检
                </button>
                <button
                  onClick={() => { setShowMenu(false); onInspect(device, 'full'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <Cpu className="w-3 h-3" />
                  全面巡检
                </button>
                <button
                  onClick={() => { setShowMenu(false); onInspect(device, 'custom'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  自定义巡检
                </button>
                {device.snmp_enabled === 1 && onSnmpInspect && (
                  <>
                    <button
                      onClick={() => { setShowMenu(false); onSnmpInspect(device); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Cpu className="w-3 h-3" />
                      SNMP 巡检
                    </button>
                  </>
                )}
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { setShowMenu(false); onTestConnection(device); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <Wifi className="w-3 h-3" />
                  测试连接
                </button>
                <button
                  onClick={() => { setShowMenu(false); onHistory(device); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <History className="w-3 h-3" />
                  巡检历史
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { setShowMenu(false); onEdit(device); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <Edit className="w-3 h-3" />
                  编辑
                </button>
                <button
                  onClick={() => { setShowMenu(false); onDelete(device); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${vendor.bgClass} ${vendor.color}`}>
            {vendor.icon} {vendor.label}
          </span>
          {device.model && (
            <span className="px-2 py-0.5 text-xs text-text-secondary bg-background border border-border rounded">
              {device.model}
            </span>
          )}
          <span className="px-2 py-0.5 text-xs text-text-secondary bg-background border border-border rounded">
            {role.icon} {role.label}
          </span>
          {device.snmp_enabled === 1 && (
            <span className="px-2 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded" title={device.snmp_credential_name ? `SNMP: ${device.snmp_credential_name}` : 'SNMP'}
            >
              SNMP
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          {device.location && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">位置</span>
              <span className="font-medium text-text-primary">{device.location}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">状态</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="font-medium text-text-primary">{statusText}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">最后巡检</span>
            <span className="font-medium text-text-primary">{formatLastInspection(device.last_inspection_at)}</span>
          </div>
          {device.last_inspection_result && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">巡检结果</span>
              <span className="font-medium text-text-primary truncate max-w-[100px]">{device.last_inspection_result}</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 flex items-center justify-between bg-background/50">
        {device.snmp_enabled === 1 && onSnmpTestConnection ? (
          <button
            onClick={() => onSnmpTestConnection(device)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
          >
            <Wifi className="w-3 h-3" />
            SNMP 测试连接
          </button>
        ) : (
          <button
            onClick={() => onInspect(device, 'standard')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
          >
            <Play className="w-3 h-3" />
            一键巡检
          </button>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTestConnection(device)}
            className="p-1.5 text-text-secondary hover:text-green-400 hover:bg-green-500/10 rounded-md transition-colors"
            title="测试连接"
          >
            <Wifi className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onHistory(device)}
            className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
            title="巡检历史"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(device)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
