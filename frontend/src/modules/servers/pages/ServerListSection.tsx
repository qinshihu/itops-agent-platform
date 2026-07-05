import { useNavigate } from 'react-router-dom';
import {
  Server, Terminal, CheckCircle2, AlertCircle, ShieldCheck, Wifi, History, Clock, FolderTree,
  Upload, RefreshCw, _Plus, Edit, Trash2, Cpu, HardDrive, MemoryStick, Monitor,
  MonitorPlay, Sparkles, FolderPlus,
} from 'lucide-react';
import clsx from 'clsx';
import type { Server as ServerType, ServerGroup } from './types';
import { GroupTree } from './ServerGroupSection';

interface ServerListSectionProps {
  // Data
  servers: ServerType[];
  isLoading: boolean;
  groupsData: ServerGroup[] | undefined;
  allTags: string[];
  filteredServers: ServerType[];
  // Selection
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  selectedGroupId: string | null;
  onSelectGroupId: (id: string | null) => void;
  // Toolbar state
  showGroups: boolean;
  onToggleGroups: () => void;
  isCollecting: boolean;
  isCollectingMetrics: boolean;
  // Handlers
  onCollectAll: () => void;
  onCollectAllMetrics: () => void;
  onOpenImport: () => void;
  onOpenGroupModal: () => void;
  onTestConnection: (server: ServerType) => void;
  onCollectInfo: (server: ServerType) => void;
  onCollectMetrics: (server: ServerType) => void;
  onEdit: (server: ServerType) => void;
  onDelete: (id: string, name: string) => void;
  onOpenAiCommand: (server: ServerType) => void;
  onSelectForCommand: (server: ServerType) => void;
  onRunCompliance: (server: ServerType) => void;
  onViewCommandHistory: (server: ServerType) => void;
  onViewComplianceHistory: (server: ServerType) => void;
}

export function ServerListSection({
  _servers,
  isLoading,
  groupsData,
  allTags,
  filteredServers,
  selectedTag,
  onSelectTag,
  selectedGroupId,
  onSelectGroupId,
  showGroups,
  onToggleGroups,
  isCollecting,
  isCollectingMetrics,
  onCollectAll,
  onCollectAllMetrics,
  onOpenImport,
  onOpenGroupModal,
  onTestConnection,
  onCollectInfo,
  onCollectMetrics,
  onEdit,
  onDelete,
  onOpenAiCommand,
  onSelectForCommand,
  onRunCompliance,
  onViewCommandHistory,
  onViewComplianceHistory,
}: ServerListSectionProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onToggleGroups}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border',
            showGroups
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border bg-surface text-text-secondary hover:text-text-primary',
          )}
        >
          <FolderTree className="w-4 h-4" />
          分组
        </button>
        <button
          onClick={onCollectAll}
          disabled={isCollecting}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', isCollecting && 'animate-spin')} />
          采集所有主机信息
        </button>
        <button
          onClick={onCollectAllMetrics}
          disabled={isCollectingMetrics}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', isCollectingMetrics && 'animate-spin')} />
          采集所有性能指标
        </button>
        <button
          onClick={onOpenImport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          <Upload className="w-4 h-4" />
          批量导入
        </button>
        <button
          onClick={onOpenGroupModal}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          新建分组
        </button>
      </div>

      <div className="flex gap-4">
        {/* 分组侧边栏 */}
        {showGroups && (
          <div className="w-56 flex-shrink-0 bg-surface border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-primary">服务器分组</h3>
              <button
                onClick={() => onSelectGroupId(null)}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                清除筛选
              </button>
            </div>
            {groupsData && groupsData.length > 0 ? (
              <GroupTree groups={groupsData} selectedGroupId={selectedGroupId} onSelectGroup={onSelectGroupId} />
            ) : (
              <p className="text-xs text-text-secondary py-4 text-center">暂无分组</p>
            )}
          </div>
        )}

        {/* 服务器列表 */}
        <div className="flex-1">
          {/* 标签筛选器 */}
          {allTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  onSelectTag(null);
                  onSelectGroupId(null);
                }}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm transition-colors',
                  !selectedTag && !selectedGroupId
                    ? 'bg-primary text-white'
                    : 'bg-background border border-border text-text-secondary hover:bg-surface',
                )}
              >
                全部
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    onSelectTag(selectedTag === tag ? null : tag);
                    onSelectGroupId(null);
                  }}
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm transition-colors',
                    selectedTag === tag
                      ? 'bg-primary text-white'
                      : 'bg-background border border-border text-text-secondary hover:bg-surface',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-border rounded w-1/2 mb-2" />
                  <div className="h-3 bg-border rounded w-3/4" />
                </div>
              ))
            ) : filteredServers.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-text-secondary">
                <Server className="w-12 h-12 mb-4 opacity-50" />
                <p>
                  {selectedTag
                    ? `没有带标签 "${selectedTag}" 的服务器`
                    : selectedGroupId
                      ? '该分组下暂无服务器'
                      : '暂无服务器，请添加第一个服务器'}
                </p>
              </div>
            ) : (
              filteredServers.map((server) => (
                <div
                  key={server.id}
                  className={clsx(
                    'relative bg-surface border rounded-lg p-4 min-w-0 overflow-hidden',
                    server.os_type === 'linux'
                      ? 'border-yellow-500/30'
                      : server.os_type === 'windows'
                        ? 'border-blue-500/30'
                        : 'border-border',
                  )}
                >
                  {/* 操作系统左侧标识条 */}
                  <div
                    className={clsx(
                      'absolute left-0 top-0 bottom-0 w-1',
                      server.os_type === 'linux'
                        ? 'bg-gradient-to-b from-yellow-500 to-orange-500'
                        : server.os_type === 'windows'
                          ? 'bg-gradient-to-b from-blue-500 to-cyan-500'
                          : 'bg-gradient-to-b from-text-tertiary/50 to-text-tertiary/30',
                    )}
                  />

                  <div className="flex items-start justify-between mb-3 min-w-0 pl-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          server.os_type === 'linux'
                            ? 'bg-yellow-500/10'
                            : server.os_type === 'windows'
                              ? 'bg-blue-500/10'
                              : 'bg-primary/10',
                        )}
                      >
                        <Server
                          className={clsx(
                            'w-4 h-4',
                            server.os_type === 'linux'
                              ? 'text-yellow-500'
                              : server.os_type === 'windows'
                                ? 'text-blue-500'
                                : 'text-primary',
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-text-primary truncate">{server.name}</h3>
                        <p className="text-xs text-text-secondary truncate">
                          {server.hostname}:{server.port}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {server.os_type === 'windows' && (
                        <button
                          onClick={() => navigate(`/remote-desktop/${server.id}`)}
                          className="p-1 hover:bg-background rounded transition-colors"
                          title="远程桌面"
                        >
                          <MonitorPlay className="w-4 h-4 text-text-secondary" />
                        </button>
                      )}
                      <button
                        onClick={() => onTestConnection(server)}
                        className="p-1 hover:bg-background rounded transition-colors"
                        title="测试连接"
                      >
                        <Wifi className="w-4 h-4 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => onCollectInfo(server)}
                        disabled={isCollecting}
                        className="p-1 hover:bg-background rounded transition-colors disabled:opacity-50"
                        title="采集主机信息"
                      >
                        <RefreshCw className={clsx('w-4 h-4 text-text-secondary', isCollecting && 'animate-spin')} />
                      </button>
                      <button
                        onClick={() => onCollectMetrics(server)}
                        disabled={isCollectingMetrics}
                        className="p-1 hover:bg-background rounded transition-colors disabled:opacity-50"
                        title="采集性能指标"
                      >
                        <Monitor className={clsx('w-4 h-4 text-text-secondary', isCollectingMetrics && 'animate-spin')} />
                      </button>
                      <button
                        onClick={() => onDelete(server.id, server.name)}
                        className="p-1 hover:bg-background rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-status-failed" />
                      </button>
                      <button
                        onClick={() => onEdit(server)}
                        className="p-1 hover:bg-background rounded transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4 text-text-secondary" />
                      </button>
                    </div>
                  </div>
                  {server.description && (
                    <p className="text-xs text-text-secondary mb-3">{server.description}</p>
                  )}

                  {/* 主机扩展信息 */}
                  {(server.os || server.cpu_cores || server.memory_gb || server.disk_gb) && (
                    <div className="mb-3 p-2 bg-background rounded-lg">
                      {server.os && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
                          <Monitor className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{server.os}</span>
                        </div>
                      )}
                      {(server.cpu_cores !== undefined ||
                        server.memory_gb !== undefined ||
                        server.disk_gb !== undefined) && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {server.cpu_cores !== undefined && (
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <Cpu className="w-3 h-3 flex-shrink-0" />
                              <span>{server.cpu_cores} 核</span>
                            </div>
                          )}
                          {server.memory_gb !== undefined && (
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <MemoryStick className="w-3 h-3 flex-shrink-0" />
                              <span>{server.memory_gb} GB</span>
                            </div>
                          )}
                          {server.disk_gb !== undefined && (
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <HardDrive className="w-3 h-3 flex-shrink-0" />
                              <span>{server.disk_gb} GB</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 分组展示 */}
                  {server.groups && server.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {server.groups.map((g) => (
                        <span
                          key={g.id}
                          className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-xs rounded-full flex items-center gap-1"
                        >
                          <FolderTree className="w-2.5 h-2.5" />
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 标签展示 */}
                  {server.tags && server.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {server.tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    {server.last_connected ? (
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        <CheckCircle2 className="w-3 h-3 text-status-success" />
                        最后连接: {new Date(server.last_connected).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        <AlertCircle className="w-3 h-3 text-status-warning" />
                        未连接过
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      onClick={() => onOpenAiCommand(server)}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg text-xs font-medium text-purple-300 whitespace-nowrap hover:from-purple-600/30 hover:to-blue-600/30 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>AI 执行</span>
                    </button>
                    <button
                      onClick={() => onSelectForCommand(server)}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary whitespace-nowrap hover:bg-background transition-colors"
                    >
                      <Terminal className="w-4 h-4" />
                      <span>执行命令</span>
                    </button>
                    <button
                      onClick={() => onRunCompliance(server)}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary whitespace-nowrap hover:bg-background transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>合规检查</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => onViewCommandHistory(server)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>命令历史</span>
                    </button>
                    <button
                      onClick={() => onViewComplianceHistory(server)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>检查历史</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
