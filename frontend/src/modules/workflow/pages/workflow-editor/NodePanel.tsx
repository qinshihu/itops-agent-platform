import type { Node } from '@xyflow/react';
import { Shield, Layers } from 'lucide-react';
import type { Agent, Provider } from './types';
import { NodeConfigPanel } from './NodeConfigPanel';

interface NodePanelProps {
  agents: Agent[];
  providers: Provider[];
  selectedNode: Node | null;
  onDeleteSelectedNode: () => void;
  onDuplicateSelectedNode: () => void;
  onUpdateNodeLabel: (nodeId: string, value: string) => void;
  onUpdateNodeDescription: (nodeId: string, value: string) => void;
  onUpdateNodeInputKey: (nodeId: string, value: string) => void;
  onUpdateNodeOutputKey: (nodeId: string, value: string) => void;
  onUpdateNodePrompt: (nodeId: string, value: string) => void;
  onUpdateApprovalConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateProviderId: (nodeId: string, pid: string) => void;
  onUpdateProviderConfig: (nodeId: string, key: string, value: unknown) => void;
}

export function NodePanel({
  agents,
  providers,
  selectedNode,
  onDeleteSelectedNode,
  onDuplicateSelectedNode,
  onUpdateNodeLabel,
  onUpdateNodeDescription,
  onUpdateNodeInputKey,
  onUpdateNodeOutputKey,
  onUpdateNodePrompt,
  onUpdateApprovalConfig,
  onUpdateProviderId,
  onUpdateProviderConfig,
}: NodePanelProps) {
  return (
    <div className="w-80 border-r border-border bg-surface flex flex-col min-h-0">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4" />
          可用节点
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/reactflow/nodeType', 'approval');
              event.dataTransfer.effectAllowed = 'move';
            }}
            className="p-3 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:border-orange-500 hover:bg-orange-500/15 cursor-move transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-orange-400" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary text-sm">审批节点</div>
                <div className="text-xs text-text-secondary">人工确认</div>
              </div>
            </div>
            <div className="text-xs text-text-secondary line-clamp-2 mt-1">
              暂停工作流等待人工审批，支持超时自动拒绝
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <div className="text-xs font-semibold text-text-secondary mb-2">Agent 节点</div>
          </div>
          {agents.filter((agent) => agent.enabled === 1).map((agent) => (
            <div
              key={agent.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow/nodeType', 'agent');
                event.dataTransfer.setData('application/reactflow/agentId', agent.id);
                event.dataTransfer.setData('application/reactflow/agentName', agent.name);
                event.dataTransfer.setData('application/reactflow/agentAvatar', agent.avatar || '🤖');
                event.dataTransfer.setData('application/reactflow/agentDescription', agent.description || '');
                event.dataTransfer.setData('application/reactflow/agentSystemPrompt', agent.system_prompt || '');
                event.dataTransfer.effectAllowed = 'move';
              }}
              className="p-3 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 cursor-move transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{agent.avatar || '🤖'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary text-sm truncate">{agent.name}</div>
                  <div className="text-xs text-text-secondary truncate">{agent.role}</div>
                </div>
              </div>
              {agent.description && (
                <div className="text-xs text-text-secondary line-clamp-2 mt-1">{agent.description}</div>
              )}
            </div>
          ))}
          {agents.filter((agent) => agent.enabled === 1).length === 0 && (
            <div className="text-center py-4 text-text-secondary">
              <p className="text-xs">暂无可用Agent</p>
            </div>
          )}

          <div className="pt-3 border-t border-border">
            <div className="text-xs font-semibold text-text-secondary mb-2">Provider 节点（执行动作）</div>
          </div>
          {providers.map((provider) => (
            <div
              key={provider.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow/nodeType', 'provider');
                event.dataTransfer.setData('application/reactflow/providerId', provider.id);
                event.dataTransfer.setData('application/reactflow/providerName', provider.name);
                event.dataTransfer.setData('application/reactflow/providerType', provider.type);
                event.dataTransfer.setData('application/reactflow/providerSchema', JSON.stringify(provider.configSchema));
                event.dataTransfer.effectAllowed = 'move';
              }}
              className="p-3 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 cursor-move transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">
                  {provider.type === 'notification'
                    ? '🔔'
                    : provider.type === 'action'
                      ? '⚡'
                      : provider.type === 'script'
                        ? '📜'
                        : provider.type === 'alert'
                          ? '🚨'
                          : '🔧'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary text-sm truncate">{provider.name}</div>
                  <div className="text-xs text-text-secondary truncate">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        provider.type === 'notification'
                          ? 'bg-blue-500/20 text-blue-400'
                          : provider.type === 'action'
                            ? 'bg-green-500/20 text-green-400'
                            : provider.type === 'script'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {provider.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {providers.length === 0 && (
            <div className="text-center py-4 text-text-secondary">
              <p className="text-xs">暂无可用Provider</p>
            </div>
          )}
        </div>
      </div>

      {selectedNode && (
        <NodeConfigPanel
          selectedNode={selectedNode}
          providers={providers}
          onDelete={onDeleteSelectedNode}
          onDuplicate={onDuplicateSelectedNode}
          onUpdateLabel={onUpdateNodeLabel}
          onUpdateDescription={onUpdateNodeDescription}
          onUpdateInputKey={onUpdateNodeInputKey}
          onUpdateOutputKey={onUpdateNodeOutputKey}
          onUpdatePrompt={onUpdateNodePrompt}
          onUpdateApprovalConfig={onUpdateApprovalConfig}
          onUpdateProviderId={onUpdateProviderId}
          onUpdateProviderConfig={onUpdateProviderConfig}
        />
      )}
    </div>
  );
}