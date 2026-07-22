import { Plus, Search, Upload, Bot, Activity, Zap, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { message, Modal } from 'antd';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAgents } from './agents/useAgents';
import AgentList from './agents/AgentList';
import AgentDetail from './agents/AgentDetail';
import AgentEditor from './agents/AgentEditor';
import AgentTestPanel from './agents/AgentTestPanel';
import api from '@/lib/api';
import type { Agent as _Agent } from './agents/types';

// Re-export types for backward compatibility
export type { Agent } from './agents/types';

export default function Agents() {
  const vm = useAgents();
  const queryClient = useQueryClient();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['agents', 'stats', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/agents/stats/summary');
      return (data.data ?? data) as {
        totalAgents: number;
        enabledAgents: number;
        presetAgents: number;
        totalExecutions: number;
        categoryStats: Array<{ category: string | null; count: number }>;
      };
    },
  });

  const handleImport = async () => {
    if (!importFile) {
      message.error('请先选择导入文件');
      return;
    }
    try {
      setImporting(true);
      const text = await importFile.text();
      const json = JSON.parse(text);
      const agents = Array.isArray(json) ? json : json.agents;
      if (!Array.isArray(agents)) {
        throw new Error('文件格式错误：缺少 agents 数组');
      }
      const { data } = await api.post('/agents/import', { agents });
      message.success(`导入成功：共导入 ${data.data.importedCount} 个 Agent`);
      setImportModalOpen(false);
      setImportFile(null);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      message.error((err as Error).message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  if (vm.showDetail) {
    return (
      <AgentDetail
        agentId={vm.showDetail}
        onBack={() => vm.setShowDetail(null)}
        deleteMutation={vm.deleteMutation}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Agent管理</h1>
            <p className="text-text-secondary">管理运维自动化Agent</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 font-semibold hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="w-5 h-5" />
              导入
            </button>
            <button
              onClick={vm.handleNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-semibold hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              新建Agent
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-xl rounded-2xl p-5 border border-blue-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-500/20">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs text-text-tertiary">总数</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats?.totalAgents ?? 0}</div>
            <div className="text-xs text-text-tertiary mt-1">Agent 总数</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/5 backdrop-blur-xl rounded-2xl p-5 border border-green-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/20">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs text-text-tertiary">在线</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats?.enabledAgents ?? 0}</div>
            <div className="text-xs text-text-tertiary mt-1">
              启用率{' '}
              {stats?.totalAgents ? Math.round((stats.enabledAgents / stats.totalAgents) * 100) : 0}
              %
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-violet-600/5 backdrop-blur-xl rounded-2xl p-5 border border-purple-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-500/20">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs text-text-tertiary">预设</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats?.presetAgents ?? 0}</div>
            <div className="text-xs text-text-tertiary mt-1">预设 Agent</div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/5 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/20">
                <BarChart3 className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs text-text-tertiary">执行</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {stats?.totalExecutions ?? 0}
            </div>
            <div className="text-xs text-text-tertiary mt-1">总执行次数</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-r from-surface to-background backdrop-blur-xl rounded-2xl p-5 border border-border/50 flex flex-wrap gap-4 items-center shadow-lg">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={vm.searchQuery}
              onChange={(e) => vm.setSearchQuery(e.target.value)}
              placeholder="搜索Agent..."
              className="px-4 py-2 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all w-64"
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-text-secondary font-medium">分类:</span>
            <button
              onClick={() => vm.setSelectedCategory(null)}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                !vm.selectedCategory
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary',
              )}
            >
              全部
            </button>
            {vm.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => vm.setSelectedCategory(vm.selectedCategory === cat ? null : cat)}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                  vm.selectedCategory === cat
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <AgentList
          filteredAgents={vm.filteredAgents}
          isLoading={vm.isLoading}
          onShowDetail={vm.setShowDetail}
          onTest={vm.handleTest}
          onEdit={vm.handleEdit}
          onDelete={vm.handleDelete}
        />
      </div>

      {vm.showModal && (
        <AgentEditor agent={vm.editingAgent} onClose={() => vm.setShowModal(false)} />
      )}

      {vm.showTestModal && vm.editingAgent && (
        <AgentTestPanel
          editingAgent={vm.editingAgent}
          testInput={vm.testInput}
          setTestInput={vm.setTestInput}
          testResult={vm.testResult}
          isTesting={vm.isTesting}
          selectedServerIds={vm.selectedServerIds}
          setSelectedServerIds={vm.setSelectedServerIds}
          selectedDatabaseId={vm.selectedDatabaseId}
          setSelectedDatabaseId={vm.setSelectedDatabaseId}
          servers={vm.servers}
          dbConnections={vm.dbConnections}
          runTest={vm.runTest}
          onClose={() => vm.setShowTestModal(false)}
        />
      )}

      <Modal
        title="导入 Agent"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportFile(null);
        }}
        onOk={handleImport}
        confirmLoading={importing}
        okText="导入"
        cancelText="取消"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            选择 JSON 文件导入 Agent 配置。文件格式需为{' '}
            <code className="px-1.5 py-0.5 bg-surface rounded text-xs">{'{"agents": [...] }'}</code>{' '}
            或直接是数组。
          </p>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              importFile
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-border hover:border-blue-500/30 hover:bg-surface/50'
            }`}
            onClick={() => document.getElementById('agent-import-file')?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-text-tertiary" />
            {importFile ? (
              <div>
                <p className="text-sm font-medium text-text-primary">{importFile.name}</p>
                <p className="text-xs text-text-tertiary mt-1">
                  {(importFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-text-primary">点击选择文件或拖拽到此处</p>
                <p className="text-xs text-text-tertiary mt-1">支持 .json 格式</p>
              </div>
            )}
            <input
              id="agent-import-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setImportFile(file);
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
