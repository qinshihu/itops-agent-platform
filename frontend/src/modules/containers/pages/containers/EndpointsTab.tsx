import { Server, RefreshCw, Plus, Edit, Trash2, Activity, X } from 'lucide-react';
import { statusBadge } from '../types';
import type { useContainers } from './useContainers';

type Ctx = ReturnType<typeof useContainers>;

export function EndpointsTab({ ctx }: { ctx: Ctx }) {
  const {
    queryClient,
    endpointsListQueryKey,
    endpointsQueryKey,
    endpoints, endpointsLoading, endpointsError,
    showEpCreateModal, setShowEpCreateModal,
    editingEpId,
    epName, setEpName,
    epHost, setEpHost,
    epPort, setEpPort,
    epProtocol, setEpProtocol,
    epTlsCa, setEpTlsCa,
    epTlsCert, setEpTlsCert,
    epTlsKey, setEpTlsKey,
    createEndpointMutation,
    updateEndpointMutation,
    deleteEndpointMutation,
    testEndpointMutation,
    refreshEndpointMutation,
    resetEpForm,
    openEpEditModal,
  } = ctx;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
            queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
          }}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
        <button
          onClick={() => setShowEpCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 添加端点
        </button>
      </div>

      {endpointsError && (
        <div className="flex flex-col items-center justify-center py-20">
          <Server className="w-16 h-16 text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">端点服务不可用</h3>
          <p className="text-text-secondary text-sm mb-4">无法加载端点列表。</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: endpointsListQueryKey })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> 重试
          </button>
        </div>
      )}

      {!endpointsError && (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">主机</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">端口</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">协议</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {endpointsLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                ) : endpoints.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">暂无端点</td></tr>
                ) : (
                  endpoints.map((ep) => {
                    const badge = statusBadge(ep.status);
                    return (
                      <tr key={ep.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">{ep.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-primary">{ep.host}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-secondary">{ep.port || '-'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">{ep.protocol}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {ep.status === 'active' ? '可用' : ep.status === 'error' ? '异常' : '不可用'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {ep.id !== 'local' && (
                              <button
                                onClick={() => openEpEditModal(ep)}
                                className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors text-xs"
                                title="编辑"
                              ><Edit className="w-3.5 h-3.5" /></button>
                            )}
                            {ep.id !== 'local' && (
                              <button
                                onClick={() => refreshEndpointMutation.mutate(ep.id)}
                                className="p-1.5 rounded hover:bg-green-500/10 text-text-secondary hover:text-green-400 transition-colors text-xs"
                                title="刷新"
                              ><RefreshCw className="w-3.5 h-3.5" /></button>
                            )}
                            {ep.id !== 'local' && (
                              <button
                                onClick={() => testEndpointMutation.mutate({ host: ep.host, port: ep.port, protocol: ep.protocol, tlsCa: ep.tlsCa, tlsCert: ep.tlsCert, tlsKey: ep.tlsKey })}
                                className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors text-xs"
                                title="测试"
                              ><Activity className="w-3.5 h-3.5" /></button>
                            )}
                            {ep.id !== 'local' && (
                              <button
                                onClick={() => { if (confirm('确定要删除此端点吗？')) deleteEndpointMutation.mutate(ep.id); }}
                                className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                title="删除"
                              ><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Endpoint Modal ── */}
      {showEpCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowEpCreateModal(false); resetEpForm(); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">{editingEpId ? '编辑 Docker 端点' : '添加 Docker 端点'}</h3>
              <button onClick={() => { setShowEpCreateModal(false); resetEpForm(); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">名称 <span className="text-red-400">*</span></label>
                <input type="text" value={epName} onChange={(e) => setEpName(e.target.value)} placeholder="生产服务器" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">主机 <span className="text-red-400">*</span></label>
                  <input type="text" value={epHost} onChange={(e) => setEpHost(e.target.value)}
                    disabled={!!editingEpId} placeholder="192.168.1.100"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">端口</label>
                  <input type="number" value={epPort} onChange={(e) => setEpPort(e.target.value)} placeholder="2375" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">协议</label>
                <select value={epProtocol} onChange={(e) => setEpProtocol(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                  <option value="socket">Socket</option>
                  <option value="tcp">TCP</option>
                  <option value="tcp+tls">TCP + TLS</option>
                </select>
              </div>
              {epProtocol === 'tcp+tls' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">TLS CA 证书</label>
                    <textarea value={epTlsCa} onChange={(e) => setEpTlsCa(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">TLS 证书</label>
                    <textarea value={epTlsCert} onChange={(e) => setEpTlsCert(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">TLS 密钥</label>
                    <textarea value={epTlsKey} onChange={(e) => setEpTlsKey(e.target.value)} rows={3} placeholder="-----BEGIN PRIVATE KEY-----" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setShowEpCreateModal(false); resetEpForm(); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button
                  onClick={() => editingEpId ? updateEndpointMutation.mutate() : createEndpointMutation.mutate()}
                  disabled={!epName.trim() || (!editingEpId && !epHost.trim()) || createEndpointMutation.isPending || updateEndpointMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {editingEpId
                    ? (updateEndpointMutation.isPending ? '保存中...' : <><Edit className="w-4 h-4" /> 保存</>)
                    : (createEndpointMutation.isPending ? '添加中...' : <><Plus className="w-4 h-4" /> 添加</>)
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}