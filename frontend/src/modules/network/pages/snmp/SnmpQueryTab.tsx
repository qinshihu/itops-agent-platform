import { useState } from 'react';
import {
  Loader2, AlertCircle, Monitor, Wifi, Search, List,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../../lib/api';
import type { ApiError, SnmpQueryResult, SnmpInterface } from './types';
import { VERSIONS } from './types';

export function SnmpQueryTab() {
  const [queryHost, setQueryHost] = useState('');
  const [queryCommunity, setQueryCommunity] = useState('public');
  const [queryVersion, setQueryVersion] = useState('v2c');
  const [queryResult, setQueryResult] = useState<SnmpQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  const fetchSystemInfo = async () => {
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const { data } = await api.post('/snmp/system-info', {
        host: queryHost, community: queryCommunity, version: queryVersion,
      });
      setQueryResult({ type: 'system-info', data: data });
    } catch (err: unknown) {
      const e = err as ApiError;
      setQueryResult({ type: 'error', data: e.response?.data?.message || e.message || '请求失败' });
    }
    setQueryLoading(false);
  };

  const fetchInterfaces = async () => {
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const { data } = await api.post('/snmp/interfaces', {
        host: queryHost, community: queryCommunity, version: queryVersion,
      });
      setQueryResult({ type: 'interfaces', data: data });
    } catch (err: unknown) {
      const e = err as ApiError;
      setQueryResult({ type: 'error', data: e.response?.data?.message || e.message || '请求失败' });
    }
    setQueryLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 查询控制面板 */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-medium text-text-primary flex items-center gap-2">
          <Search className="w-4 h-4" />
          SNMP 查询
        </h3>
        <div>
          <label className="block text-xs text-text-secondary mb-1.5">目标设备 IP</label>
          <input type="text" placeholder="192.168.1.1"
            value={queryHost}
            onChange={e => setQueryHost(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Community</label>
            <input type="text" placeholder="public"
              value={queryCommunity}
              onChange={e => setQueryCommunity(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">SNMP 版本</label>
            <select value={queryVersion}
              onChange={e => setQueryVersion(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              {VERSIONS.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSystemInfo} disabled={!queryHost || queryLoading}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary hover:border-emerald-400/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4 text-emerald-400" />}
            系统信息
          </button>
          <button onClick={fetchInterfaces} disabled={!queryHost || queryLoading}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary hover:border-emerald-400/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
            接口列表
          </button>
        </div>
      </div>

      {/* 查询结果 */}
      <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-5 min-h-[400px]">
        {queryLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
          </div>
        ) : !queryResult ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
            <Search className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">输入目标 IP 后点击查询</p>
          </div>
        ) : queryResult.type === 'error' ? (
          <div className="flex flex-col items-center justify-center h-64 text-status-failed">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{queryResult.data}</p>
          </div>
        ) : queryResult.type === 'system-info' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4 text-emerald-400" />
              <h4 className="font-medium text-text-primary">系统信息 - {queryHost}</h4>
            </div>
            {queryResult.data && Object.entries(queryResult.data).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-sm text-text-secondary min-w-[140px] font-mono">{key}</span>
                <span className="text-sm text-text-primary">{String(val)}</span>
              </div>
            ))}
          </div>
        ) : queryResult.type === 'interfaces' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <List className="w-4 h-4 text-emerald-400" />
              <h4 className="font-medium text-text-primary">接口列表 - {queryHost}</h4>
              <span className="text-xs text-text-secondary ml-2">共 {queryResult.data?.length || 0} 个接口</span>
            </div>
            {queryResult.data?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="pb-2 pr-4">索引</th>
                      <th className="pb-2 pr-4">名称</th>
                      <th className="pb-2 pr-4">描述</th>
                      <th className="pb-2 pr-4">状态</th>
                      <th className="pb-2 pr-4">速率</th>
                      <th className="pb-2 pr-4">MAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.data.map((iface: SnmpInterface, idx: number) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-background/50">
                        <td className="py-2 pr-4 font-mono text-text-tertiary">{iface.index}</td>
                        <td className="py-2 pr-4 text-text-primary">{iface.name}</td>
                        <td className="py-2 pr-4 text-text-secondary max-w-[200px] truncate">{iface.descr}</td>
                        <td className="py-2 pr-4">
                          <span className={clsx(
                            'text-xs px-2 py-0.5 rounded-full',
                            iface.operStatus === 'up' ? 'bg-status-success/10 text-status-success' : 'bg-status-failed/10 text-status-failed'
                          )}>
                            {iface.operStatus === 'up' ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-text-secondary">{iface.speed ? `${(iface.speed / 1e6).toFixed(0)} Mbps` : '-'}</td>
                        <td className="py-2 font-mono text-xs text-text-tertiary">{iface.physAddr || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-tertiary text-sm py-4 text-center">未获取到接口数据</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
