import { Globe, RefreshCw, Plus, Eye, Trash2, X, Box } from 'lucide-react';
import type { useContainers } from './useContainers';

type Ctx = ReturnType<typeof useContainers>;

export function NetworksTab({ ctx }: { ctx: Ctx }) {
  const {
    queryClient,
    networksQueryKey,
    networks, networksLoading, networksError,
    showNetCreateModal, setShowNetCreateModal,
    showNetDetailDrawer, setShowNetDetailDrawer,
    netDetailData: _netDetailData, _setNetDetailData,
    netName, setNetName,
    netDriver, setNetDriver,
    netSubnet, setNetSubnet,
    netGateway, setNetGateway,
    netInternal, setNetInternal,
    netAttachable, setNetAttachable,
    createNetworkMutation,
    deleteNetworkMutation,
    displayNetDetail,
    resetNetForm,
  } = ctx;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: networksQueryKey })}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
        <button
          onClick={() => setShowNetCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 创建网络
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总网络数</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{networks.length}</p>
            </div>
            <Globe className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">Bridge 网络</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {networks.filter((n) => (n.Driver || n.driver) === 'bridge').length}
              </p>
            </div>
            <Globe className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">连接容器</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {networks.reduce((sum, n) => {
                  const containers = n.Containers || n.containers || {};
                  return sum + Object.keys(containers).length;
                }, 0)}
              </p>
            </div>
            <Box className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {networksError && (
        <div className="flex flex-col items-center justify-center py-20">
          <Globe className="w-16 h-16 text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">网络服务不可用</h3>
          <p className="text-text-secondary text-sm mb-4">Docker 引擎连接失败。</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: networksQueryKey })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> 重试
          </button>
        </div>
      )}

      {!networksError && (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">驱动</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">范围</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">子网</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">网关</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">容器</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {networksLoading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                ) : networks.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">暂无网络</td></tr>
                ) : (
                  networks.map((net) => {
                    const containers = net.Containers || net.containers || {};
                    const containerCount = Object.keys(containers).length;
                    const ipam = net.IPAM;
                    const subnet = ipam?.Config?.[0]?.Subnet || '-';
                    const gateway = ipam?.Config?.[0]?.Gateway || '-';
                    return (
                      <tr key={net.Id || net.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">{net.Name || net.name}</div>
                          <div className="text-xs text-text-tertiary font-mono">{(net.Id || net.id || '').substring(0, 12)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-primary">{net.Driver || net.driver}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-secondary">{net.Scope || net.scope}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                          <div className="text-xs text-text-secondary font-mono">{subnet}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                          <div className="text-xs text-text-secondary font-mono">{gateway}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-primary">{containerCount}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setNetDetailData(net); setShowNetDetailDrawer(true); }}
                              className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors"
                              title="详情"
                            ><Eye className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => { if (confirm('确定要删除此网络吗？')) deleteNetworkMutation.mutate(net.Id || net.id || ''); }}
                              className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                              title="删除"
                            ><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* ── Create Network Modal ── */}
      {showNetCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowNetCreateModal(false); resetNetForm(); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">创建网络</h3>
              <button onClick={() => { setShowNetCreateModal(false); resetNetForm(); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">名称 <span className="text-red-400">*</span></label>
                <input type="text" value={netName} onChange={(e) => setNetName(e.target.value)} placeholder="网络名称" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">驱动</label>
                <select value={netDriver} onChange={(e) => setNetDriver(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                  <option value="bridge">bridge</option>
                  <option value="host">host</option>
                  <option value="overlay">overlay</option>
                  <option value="macvlan">macvlan</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">子网</label>
                  <input type="text" value={netSubnet} onChange={(e) => setNetSubnet(e.target.value)} placeholder="172.20.0.0/16" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">网关</label>
                  <input type="text" value={netGateway} onChange={(e) => setNetGateway(e.target.value)} placeholder="172.20.0.1" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={netInternal} onChange={(e) => setNetInternal(e.target.checked)} className="rounded bg-background border-border" />
                  <span className="text-sm text-text-primary">内部网络</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={netAttachable} onChange={(e) => setNetAttachable(e.target.checked)} className="rounded bg-background border-border" />
                  <span className="text-sm text-text-primary">允许连接</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowNetCreateModal(false); resetNetForm(); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => createNetworkMutation.mutate()} disabled={!netName.trim() || createNetworkMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {createNetworkMutation.isPending ? '创建中...' : <><Plus className="w-4 h-4" /> 创建</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Network Detail Drawer ── */}
      {showNetDetailDrawer && displayNetDetail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNetDetailDrawer(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">网络详情: {displayNetDetail.Name || displayNetDetail.name}</h3>
              </div>
              <button onClick={() => setShowNetDetailDrawer(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-text-secondary mb-3">基本信息</h4>
                <div className="space-y-2">
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">名称</span><span className="text-sm text-text-primary">{displayNetDetail.Name || displayNetDetail.name || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">ID</span><span className="text-sm text-text-primary font-mono">{(displayNetDetail.Id || displayNetDetail.id || '').substring(0, 16)}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">驱动</span><span className="text-sm text-text-primary">{displayNetDetail.Driver || displayNetDetail.driver || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">范围</span><span className="text-sm text-text-primary">{displayNetDetail.Scope || displayNetDetail.scope || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">子网</span><span className="text-sm text-text-primary font-mono">{displayNetDetail.IPAM?.Config?.[0]?.Subnet || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">网关</span><span className="text-sm text-text-primary font-mono">{displayNetDetail.IPAM?.Config?.[0]?.Gateway || '-'}</span></div>
                </div>
              </div>
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-text-secondary mb-3">连接容器</h4>
                {(() => {
                  const containers = displayNetDetail.Containers || displayNetDetail.containers || {};
                  const entries = Object.entries(containers);
                  if (entries.length === 0) return <p className="text-xs text-text-tertiary">暂无容器连接</p>;
                  return entries.map(([cid, info]) => (
                    <div key={cid} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-text-primary">{info.Name}</span>
                      <span className="text-xs text-text-tertiary font-mono">{info.IPv4Address || '-'}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}