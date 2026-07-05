import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, RefreshCw, Plus, Trash2, X } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import type { VolumeItem } from './types';
import { formatDate } from './types';

// ── Props ──────────────────────────────────────────────

interface VolumeSectionProps {
  endpointId: string;
}

// ── Component ──────────────────────────────────────────

export function VolumeSection({ endpointId }: VolumeSectionProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showVolCreateModal, setShowVolCreateModal] = useState(false);
  const [volName, setVolName] = useState('');
  const [volDriver, setVolDriver] = useState('local');

  // ═══ QUERIES ═══════════════════════════════════════════

  const volumesQueryKey = ['containers-volumes', endpointId];
  const { data: volumes = [], isLoading: volumesLoading, error: volumesError } = useQuery<VolumeItem[]>({
    queryKey: volumesQueryKey,
    queryFn: async () => {
      const res = await api.get('/containers/volumes/list', {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return res.data.data || [];
    },
  });

  // ═══ MUTATIONS ═════════════════════════════════════════

  const createVolumeMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/volumes', { name: volName, driver: volDriver }, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: volumesQueryKey });
      toast.success('数据卷已创建');
      setShowVolCreateModal(false);
      setVolName('');
      setVolDriver('local');
    },
    onError: () => toast.error('创建数据卷失败'),
  });

  const deleteVolumeMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/containers/volumes/${id}`, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: volumesQueryKey });
      toast.success('数据卷已删除');
    },
    onError: () => toast.error('删除数据卷失败'),
  });

  // ═══ RENDER ═══════════════════════════════════════════

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: volumesQueryKey })}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
        <button
          onClick={() => setShowVolCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 创建数据卷
        </button>
      </div>

      {volumesError && (
        <div className="flex flex-col items-center justify-center py-20">
          <HardDrive className="w-16 h-16 text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">数据卷服务不可用</h3>
          <p className="text-text-secondary text-sm mb-4">Docker 引擎连接失败。</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: volumesQueryKey })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> 重试
          </button>
        </div>
      )}

      {!volumesError && (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">驱动</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">挂载点</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">创建时间</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {volumesLoading ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                ) : volumes.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-text-tertiary">暂无数据卷</td></tr>
                ) : (
                  volumes.map((v) => (
                    <tr key={v.Name || v.name} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-text-primary">{v.Name || v.name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-text-secondary">{v.Driver || v.driver || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-text-tertiary font-mono truncate max-w-[260px]">{v.Mountpoint || v.mountpoint || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                        <div className="text-xs text-text-secondary">{formatDate(v.CreatedAt || v.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => { if (confirm('确定要删除此数据卷吗？')) deleteVolumeMutation.mutate(v.Name || v.name || ''); }}
                          className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                          title="删除"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Volume Modal ── */}
      {showVolCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowVolCreateModal(false); setVolName(''); setVolDriver('local'); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">创建数据卷</h3>
              <button onClick={() => { setShowVolCreateModal(false); setVolName(''); setVolDriver('local'); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">名称 <span className="text-red-400">*</span></label>
                <input type="text" value={volName} onChange={(e) => setVolName(e.target.value)} placeholder="数据卷名称" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">驱动</label>
                <select value={volDriver} onChange={(e) => setVolDriver(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                  <option value="local">local</option>
                  <option value="nfs">nfs</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowVolCreateModal(false); setVolName(''); setVolDriver('local'); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => createVolumeMutation.mutate()} disabled={!volName.trim() || createVolumeMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {createVolumeMutation.isPending ? '创建中...' : <><Plus className="w-4 h-4" /> 创建</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
