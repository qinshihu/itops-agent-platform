import { Plus, Search } from 'lucide-react';
import clsx from 'clsx';
import { useAgents } from './agents/useAgents';
import AgentList from './agents/AgentList';
import AgentDetail from './agents/AgentDetail';
import AgentEditor from './agents/AgentEditor';
import AgentTestPanel from './agents/AgentTestPanel';
import type { Agent as _Agent } from './agents/types';

// Re-export types for backward compatibility
export type { Agent } from './agents/types';

export default function Agents() {
  const vm = useAgents();

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
              onClick={vm.handleNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-semibold hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              新建Agent
            </button>
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
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                !vm.selectedCategory
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25"
                  : "bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary"
              )}
            >
              全部
            </button>
            {vm.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => vm.setSelectedCategory(vm.selectedCategory === cat ? null : cat)}
                className={clsx(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  vm.selectedCategory === cat
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25"
                    : "bg-surface border border-border text-text-secondary hover:bg-slate-700/80 hover:text-text-primary"
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
        <AgentEditor
          agent={vm.editingAgent}
          onClose={() => vm.setShowModal(false)}
        />
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
    </div>
  );
}