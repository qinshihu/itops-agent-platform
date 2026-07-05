import { Server, CheckCircle } from 'lucide-react';
import type { Workflow, Server as ServerType } from './types';

interface ServerSelectModalProps {
  workflow: Workflow;
  servers: ServerType[];
  selectedServers: string[];
  executingWorkflow: string | null;
  onToggleServer: (serverId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCancel: () => void;
  onExecute: () => void;
}

export default function ServerSelectModal({
  workflow,
  servers,
  selectedServers,
  executingWorkflow,
  onToggleServer,
  onSelectAll,
  onClearSelection,
  onCancel,
  onExecute,
}: ServerSelectModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4">
        <h3 className="text-xl font-bold text-text-primary mb-2">选择服务器</h3>
        <p className="text-text-secondary mb-4">
          请选择要在哪些服务器上执行工作流 &quot;{workflow.name}&quot;
        </p>

        <div className="flex items-center justify-between mb-4 p-3 bg-background rounded-lg border border-border">
          <span className="text-sm text-text-secondary">
            已选择: <span className="font-medium text-primary">{selectedServers.length}</span> / {servers?.length || 0}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-sm px-3 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
            >
              全选
            </button>
            <button
              onClick={onClearSelection}
              className="text-sm px-3 py-1 bg-surface border border-border text-text-secondary rounded hover:bg-background transition-colors"
            >
              清空
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
          {servers?.map((server) => (
            <button
              key={server.id}
              onClick={() => onToggleServer(server.id)}
              disabled={!!executingWorkflow}
              className={`w-full p-4 text-left rounded-lg border transition-all disabled:opacity-50 flex items-center gap-3 ${
                selectedServers.includes(server.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary hover:bg-primary/5'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                selectedServers.includes(server.id)
                  ? 'bg-primary border-primary text-white'
                  : 'border-gray-300'
              }`}>
                {selectedServers.includes(server.id) && <CheckCircle className="w-3.5 h-3.5" />}
              </div>
              <Server className={`w-5 h-5 ${selectedServers.includes(server.id) ? 'text-primary' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="font-medium text-text-primary">{server.name}</div>
                <div className="text-sm text-text-secondary">{server.hostname}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onExecute}
            disabled={selectedServers.length === 0 || !!executingWorkflow}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executingWorkflow ? '执行中...' : `执行 (${selectedServers.length}台)`}
          </button>
        </div>
      </div>
    </div>
  );
}