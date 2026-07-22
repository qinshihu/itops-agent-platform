/**
 * IP 列表表格 widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L289-388 抽出
 * checkbox + IP 地址 + 状态 + 设备 + MAC + 备注 表格
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { IP_STATUS_MAP, type IpInfo } from './types';

export interface IpListTableProps {
  ips: IpInfo[];
  isLoading: boolean;
  selectedIps: Set<string>;
  onToggleIp: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
}

export function IpListTable({
  ips,
  isLoading,
  selectedIps,
  onToggleIp,
  onToggleAll,
}: IpListTableProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-surface border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary w-10">
                <input
                  type="checkbox"
                  checked={ips.length > 0 && selectedIps.size === ips.length}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">IP 地址</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">状态</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">设备</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">MAC</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-tertiary">
                  加载中...
                </td>
              </tr>
            ) : ips.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-tertiary">
                  无 IP 数据
                </td>
              </tr>
            ) : (
              ips.map((ip) => {
                const isSelected = selectedIps.has(ip.id);
                return (
                  <tr
                    key={ip.id}
                    className={clsx(
                      'hover:bg-surface/50 transition-colors cursor-pointer',
                      isSelected && 'bg-primary/5',
                    )}
                    onClick={() => onToggleIp(ip.id)}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="pointer-events-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-text-primary">
                      {ip.ip_address}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'inline-block px-2 py-0.5 rounded text-xs font-medium',
                          IP_STATUS_MAP[ip.status]?.className,
                        )}
                      >
                        {IP_STATUS_MAP[ip.status]?.label || ip.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-text-secondary">
                      {ip.device_name || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-text-tertiary">
                      {ip.mac_address || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-text-secondary">
                      {ip.last_seen
                        ? `最后活跃: ${new Date(ip.last_seen).toLocaleString()}`
                        : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
