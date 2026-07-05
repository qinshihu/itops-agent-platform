import { Box, Search, RefreshCw, Plus, Play, Square, RotateCcw, Eye, FileText, Activity, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { containerName, statusBadge, formatDate } from '../types';
import type { useContainers } from './useContainers';

type Ctx = ReturnType<typeof useContainers>;

export function ContainersTab({ ctx }: { ctx: Ctx }) {
  const {
    queryClient,
    containersQueryKey,
    containerData, containersLoading, containersError,
    page, setPage, pageSize,
    search, setSearch,
    statusFilter, setStatusFilter,
    showCreateModal, setShowCreateModal,
    createImage, setCreateImage,
    createName, setCreateName,
    createPorts, setCreatePorts,
    createEnv, setCreateEnv,
    createVolumes, setCreateVolumes,
    createRestart, setCreateRestart,
    createMemory, setCreateMemory,
    createCpuShares, setCreateCpuShares,
    containerActionMutation,
    deleteContainerMutation,
    createContainerMutation,
    resetCreateForm,
    setSelectedContainerId,
    setSelectedContainerName,
    setShowDetailDrawer,
    setShowLogsDrawer,
    setShowStatsDrawer,
  } = ctx;

  return (
    <>
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索容器名/镜像..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-blue-500"
        >
          <option value="">全部状态</option>
          <option value="running">运行中</option>
          <option value="exited">已停止</option>
          <option value="paused">已暂停</option>
        </select>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: containersQueryKey })}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建容器
        </button>
      </div>

      {/* Error state */}
      {containersError && (
        <div className="flex flex-col items-center justify-center py-20">
          <Box className="w-16 h-16 text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">容器服务不可用</h3>
          <p className="text-text-secondary text-sm mb-6 text-center max-w-md">
            Docker 引擎连接失败，请检查 Docker 是否正在运行。
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: containersQueryKey })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> 重试
          </button>
        </div>
      )}

      {/* Loading / Table */}
      {!containersError && (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">镜像</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">端口</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">创建时间</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {containersLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                ) : containerData?.data.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">暂无容器</td></tr>
                ) : (
                  (containerData?.data || []).map((c) => {
                    const state = (c.State || c.state || '').toLowerCase();
                    const badge = statusBadge(state);
                    const ports = c.Ports?.filter((p) => p.PublicPort).map((p) => `${p.PublicPort}→${p.PrivatePort}`) || [];
                    return (
                      <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">{containerName(c)}</div>
                          <div className="text-xs text-text-tertiary font-mono">{c.id?.substring(0, 12)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-text-primary truncate max-w-[160px]">{c.Image || c.image || '-'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {state || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-text-secondary font-mono">
                            {ports.length > 0 ? ports.join(', ') : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                          <div className="text-xs text-text-secondary">{formatDate(c.Created || c.created)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => containerActionMutation.mutate({ id: c.id, action: 'start' })}
                              className="p-1.5 rounded hover:bg-green-500/10 text-text-secondary hover:text-green-400 transition-colors"
                              title="启动"
                            ><Play className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => containerActionMutation.mutate({ id: c.id, action: 'stop' })}
                              className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                              title="停止"
                            ><Square className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => containerActionMutation.mutate({ id: c.id, action: 'restart' })}
                              className="p-1.5 rounded hover:bg-yellow-500/10 text-text-secondary hover:text-yellow-400 transition-colors"
                              title="重启"
                            ><RotateCcw className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => {
                                setSelectedContainerId(c.id);
                                setSelectedContainerName(containerName(c));
                                setShowDetailDrawer(true);
                              }}
                              className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors"
                              title="详情"
                            ><Eye className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => {
                                setSelectedContainerId(c.id);
                                setSelectedContainerName(containerName(c));
                                setShowLogsDrawer(true);
                              }}
                              className="p-1.5 rounded hover:bg-slate-500/10 text-text-secondary hover:text-slate-300 transition-colors"
                              title="日志"
                            ><FileText className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => {
                                setSelectedContainerId(c.id);
                                setSelectedContainerName(containerName(c));
                                setShowStatsDrawer(true);
                              }}
                              className="p-1.5 rounded hover:bg-purple-500/10 text-text-secondary hover:text-purple-400 transition-colors"
                              title="状态"
                            ><Activity className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => { if (confirm(`确定要删除容器 ${containerName(c)} 吗？`)) deleteContainerMutation.mutate(c.id); }}
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
          {/* Pagination */}
          {containerData && containerData.total > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-text-tertiary">
                共 {containerData.total} 个，第 {page} / {Math.ceil(containerData.total / pageSize)} 页
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                ><ChevronLeft className="w-4 h-4" /></button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil((containerData?.total || 0) / pageSize)}
                  className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create Container Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">创建容器</h3>
              <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">镜像 <span className="text-red-400">*</span></label>
                <input type="text" value={createImage} onChange={(e) => setCreateImage(e.target.value)} placeholder="nginx:latest" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">容器名称</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="可选" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">端口映射</label>
                <input type="text" value={createPorts} onChange={(e) => setCreatePorts(e.target.value)} placeholder="8080:80,443:443" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                <p className="text-xs text-text-tertiary mt-1">格式: 宿主机端口:容器端口, 逗号分隔</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">环境变量</label>
                <input type="text" value={createEnv} onChange={(e) => setCreateEnv(e.target.value)} placeholder="KEY=VALUE,KEY2=VALUE2" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">数据卷挂载</label>
                <input type="text" value={createVolumes} onChange={(e) => setCreateVolumes(e.target.value)} placeholder="/host/path:/container/path" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">重启策略</label>
                  <select value={createRestart} onChange={(e) => setCreateRestart(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                    <option value="no">不重启</option>
                    <option value="always">总是重启</option>
                    <option value="on-failure">失败时重启</option>
                    <option value="unless-stopped">除非停止</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">内存限制 (MB)</label>
                  <input type="number" value={createMemory} onChange={(e) => setCreateMemory(e.target.value)} placeholder="不限制" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">CPU 权重</label>
                <input type="number" value={createCpuShares} onChange={(e) => setCreateCpuShares(e.target.value)} placeholder="默认 1024" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => createContainerMutation.mutate()} disabled={!createImage.trim() || createContainerMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {createContainerMutation.isPending ? '创建中...' : <><Plus className="w-4 h-4" /> 创建</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}