import { Plus, RefreshCw, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { ImportExport } from '../../../../modules/import-export/components/ImportExport';
import type { Server as ServerType } from '../types';

interface ServerToolbarProps {
  queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => void };
  resetForm: () => void;
  setSelectedServer: (s: ServerType | null) => void;
  setIsModalOpen: (v: boolean) => void;
  selectedServer: ServerType | null;
  activeTab: string;
  setActiveTab: (tab: 'servers' | 'compliance' | 'command-history' | 'compliance-history') => void;
}

export function ServerToolbar({
  queryClient,
  resetForm,
  setSelectedServer,
  setIsModalOpen,
  selectedServer,
  activeTab,
  setActiveTab,
}: ServerToolbarProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">服务器管理</h1>
          <p className="text-text-secondary">管理和监控您的服务器</p>
        </div>
        <div className="flex items-center gap-3">
          <ImportExport
            resourceType="servers"
            onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['servers'] })}
          />
          <button
            onClick={() => {
              resetForm();
              setSelectedServer(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加服务器
          </button>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary mb-2">使用说明</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-yellow-500 to-orange-500 flex-shrink-0" />
                <span>
                  <strong>Linux 服务器</strong>：左侧黄橙渐变标识，支持 SSH 命令执行
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-blue-500 to-cyan-500 flex-shrink-0" />
                <span>
                  <strong>Windows 服务器</strong>：左侧蓝青渐变标识，支持远程桌面
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3 h-3 flex-shrink-0" />
                <span>
                  <strong>采集信息</strong>：获取服务器 OS、CPU、内存、磁盘等信息
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="w-3 h-3 flex-shrink-0" />
                <span>
                  <strong>执行命令</strong>：通过 SSH 远程执行命令，查看执行历史
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => {
            setActiveTab('servers');
            setSelectedServer(null);
          }}
          className={clsx(
            'px-4 py-2 border-b-2 text-sm transition-colors',
            activeTab === 'servers'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary',
          )}
        >
          服务器列表
        </button>
        {selectedServer && (
          <>
            <button
              onClick={() => setActiveTab('compliance')}
              className={clsx(
                'px-4 py-2 border-b-2 text-sm transition-colors',
                activeTab === 'compliance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              合规检查
            </button>
            <button
              onClick={() => setActiveTab('command-history')}
              className={clsx(
                'px-4 py-2 border-b-2 text-sm transition-colors',
                activeTab === 'command-history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              命令历史
            </button>
            <button
              onClick={() => setActiveTab('compliance-history')}
              className={clsx(
                'px-4 py-2 border-b-2 text-sm transition-colors',
                activeTab === 'compliance-history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              检查历史
            </button>
          </>
        )}
      </div>
    </>
  );
}