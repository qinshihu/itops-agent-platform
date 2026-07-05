import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Loader2, Plus } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import type { SnmpTrap } from './types';

export function SnmpTrapsTab() {
  const queryClient = useQueryClient();

  const { data: traps = [], isLoading: trapsLoading } = useQuery({
    queryKey: ['snmp-traps'],
    queryFn: () => api.get('/snmp/traps?limit=50').then(r => r.data.data || []),
    refetchInterval: 30000,
  });

  const testTrapMutation = useMutation({
    mutationFn: () => api.post('/snmp/traps/test'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snmp-traps'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-text-primary">SNMP Trap 接收记录</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              监听中 (端口 162)
            </span>
            <span>自动刷新 30s</span>
            <button
              onClick={() => testTrapMutation.mutate()}
              disabled={testTrapMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {testTrapMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              生成测试 Trap
            </button>
          </div>
        </div>

        {trapsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
          </div>
        ) : traps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Activity className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无 Trap 记录</p>
            <p className="text-xs mt-1">当网络设备发送 SNMP Trap 时，将在此显示</p>
          </div>
        ) : (
          <div className="space-y-2">
            {traps.map((trap: SnmpTrap, idx: number) => (
              <div key={idx} className="bg-background rounded-lg p-3 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-tertiary">
                      {new Date((trap.received_at || trap.timestamp) ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-primary font-mono">{trap.sourceIp || trap.source}</span>
                  </div>
                  {trap.severity && (
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      trap.severity === 'critical' ? 'bg-status-failed/10 text-status-failed' :
                      trap.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-blue-500/10 text-blue-400'
                    )}>
                      {trap.severity}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-primary">{trap.message || trap.description || JSON.stringify(trap.data || trap)}</p>
                {trap.oid && <p className="text-xs font-mono text-text-tertiary mt-1">{trap.oid}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
