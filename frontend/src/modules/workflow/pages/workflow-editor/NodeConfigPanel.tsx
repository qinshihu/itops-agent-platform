import { useQuery } from '@tanstack/react-query';
import { Bot, Copy, Trash2, Settings, Shield, Wrench } from 'lucide-react';
import type { Node } from '@xyflow/react';
import type { ApprovalNodeData, Provider, ProviderNodeData } from './types';
import { VerificationConfig } from './node-configs/VerificationConfig';
import { RiskAssessConfig } from './node-configs/RiskAssessConfig';
import { DecisionConfig } from './node-configs/DecisionConfig';
import { KnowledgeConfig } from './node-configs/KnowledgeConfig';
import { RollbackConfig } from './node-configs/RollbackConfig';
import { ConditionConfig } from './node-configs/ConditionConfig';
import { LoopConfig } from './node-configs/LoopConfig';
import { ParallelConfig } from './node-configs/ParallelConfig';
import { HttpConfig } from './node-configs/HttpConfig';
import { NotifyConfig } from './node-configs/NotifyConfig';
import { DelayConfig } from './node-configs/DelayConfig';
import aiApi from '../../../ai/api';
import type { Agent } from '../../../ai/api';

interface NodeConfigPanelProps {
  selectedNode: Node;
  providers: Provider[];
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdateLabel: (nodeId: string, value: string) => void;
  onUpdateDescription: (nodeId: string, value: string) => void;
  onUpdateInputKey: (nodeId: string, value: string) => void;
  onUpdateOutputKey: (nodeId: string, value: string) => void;
  onUpdatePrompt: (nodeId: string, value: string) => void;
  onUpdateApprovalConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateProviderId: (nodeId: string, pid: string) => void;
  onUpdateProviderConfig: (nodeId: string, key: string, value: unknown) => void;
  onUpdateVerificationConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateRiskAssessConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateDecisionConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateKnowledgeConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateRollbackConfig: (nodeId: string, partial: Record<string, unknown>) => void;
  onUpdateGenericConfig: (nodeId: string, partial: Record<string, unknown>) => void;
}

export function NodeConfigPanel({
  selectedNode,
  providers,
  onDelete,
  onDuplicate,
  onUpdateLabel,
  onUpdateDescription,
  onUpdateInputKey,
  onUpdateOutputKey,
  onUpdatePrompt,
  onUpdateApprovalConfig,
  onUpdateProviderId,
  onUpdateProviderConfig,
  onUpdateVerificationConfig,
  onUpdateRiskAssessConfig,
  onUpdateDecisionConfig,
  onUpdateKnowledgeConfig,
  onUpdateRollbackConfig,
  onUpdateGenericConfig,
}: NodeConfigPanelProps) {
  return (
    <div className="border-t border-border p-4 bg-background/50 overflow-y-auto max-h-96">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          节点配置
        </h3>
        <div className="flex gap-1">
          <button
            onClick={onDuplicate}
            className="p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
            title="复制节点"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title="删除节点"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-2">显示名称</label>
          <input
            type="text"
            value={(selectedNode.data?.label as string) || ''}
            onChange={(e) => onUpdateLabel(selectedNode.id, e.target.value)}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-2">节点描述</label>
          <textarea
            value={(selectedNode.data?.description as string) || ''}
            onChange={(e) => onUpdateDescription(selectedNode.id, e.target.value)}
            placeholder="描述这个节点的作用"
            rows={2}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none"
          />
        </div>

        {selectedNode.type === 'approval' && (
          <ApprovalConfig
            selectedNode={selectedNode}
            onUpdateApprovalConfig={onUpdateApprovalConfig}
          />
        )}

        {selectedNode.type === 'provider' && (
          <ProviderConfig
            selectedNode={selectedNode}
            providers={providers}
            onUpdateProviderId={onUpdateProviderId}
            onUpdateProviderConfig={onUpdateProviderConfig}
          />
        )}

        {selectedNode.type === 'verification' && (
          <VerificationConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateVerificationConfig}
          />
        )}

        {selectedNode.type === 'risk_assess' && (
          <RiskAssessConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateRiskAssessConfig}
          />
        )}

        {selectedNode.type === 'decision' && (
          <DecisionConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateDecisionConfig}
          />
        )}

        {selectedNode.type === 'knowledge' && (
          <KnowledgeConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateKnowledgeConfig}
          />
        )}

        {selectedNode.type === 'rollback' && (
          <RollbackConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateRollbackConfig}
          />
        )}

        {selectedNode.type === 'condition' && (
          <ConditionConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateGenericConfig}
          />
        )}

        {selectedNode.type === 'loop' && (
          <LoopConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateGenericConfig}
          />
        )}

        {selectedNode.type === 'parallel' && (
          <ParallelConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateGenericConfig}
          />
        )}

        {selectedNode.type === 'http' && (
          <HttpConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateGenericConfig}
          />
        )}

        {selectedNode.type === 'notify' && (
          <NotifyConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateGenericConfig}
          />
        )}

        {selectedNode.type === 'delay' && (
          <DelayConfig
            selectedNode={selectedNode}
            onUpdate={onUpdateGenericConfig}
          />
        )}

        {selectedNode.type !== 'approval' &&
          selectedNode.type !== 'provider' &&
          selectedNode.type !== 'verification' &&
          selectedNode.type !== 'risk_assess' &&
          selectedNode.type !== 'decision' &&
          selectedNode.type !== 'knowledge' &&
          selectedNode.type !== 'rollback' &&
          selectedNode.type !== 'condition' &&
          selectedNode.type !== 'loop' &&
          selectedNode.type !== 'parallel' &&
          selectedNode.type !== 'http' &&
          selectedNode.type !== 'notify' &&
          selectedNode.type !== 'delay' && (
            <AgentConfig
              selectedNode={selectedNode}
              onUpdateInputKey={onUpdateInputKey}
              onUpdateOutputKey={onUpdateOutputKey}
              onUpdatePrompt={onUpdatePrompt}
              onUpdateGenericConfig={onUpdateGenericConfig}
            />
          )}
      </div>
    </div>
  );
}

function ApprovalConfig({
  selectedNode,
  onUpdateApprovalConfig,
}: {
  selectedNode: Node;
  onUpdateApprovalConfig: (nodeId: string, partial: Record<string, unknown>) => void;
}) {
  const config = (selectedNode.data as ApprovalNodeData)?.approvalConfig || {};

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-orange-500" />
        审批配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">审批说明</label>
          <textarea
            value={config.description || ''}
            onChange={(e) => onUpdateApprovalConfig(selectedNode.id, { description: e.target.value })}
            placeholder="向审批人说明需要确认的内容"
            rows={2}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">超时时间（秒）</label>
          <input
            type="number"
            value={config.timeout || 3600}
            onChange={(e) => onUpdateApprovalConfig(selectedNode.id, { timeout: parseInt(e.target.value) || 3600 })}
            min={60}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">超时后自动拒绝，0 表示不超时</p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">超时行为</label>
          <select
            value={config.timeoutAction || 'reject'}
            onChange={(e) => onUpdateApprovalConfig(selectedNode.id, { timeoutAction: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            <option value="reject">自动拒绝</option>
            <option value="wait">继续等待</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ProviderConfig({
  selectedNode,
  providers,
  onUpdateProviderId,
  onUpdateProviderConfig,
}: {
  selectedNode: Node;
  providers: Provider[];
  onUpdateProviderId: (nodeId: string, pid: string) => void;
  onUpdateProviderConfig: (nodeId: string, key: string, value: unknown) => void;
}) {
  const data = selectedNode.data as ProviderNodeData;
  const config = data?.config || {};

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-green-500" />
        Provider 配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Provider</label>
          <select
            value={data?.providerId || ''}
            onChange={(e) => onUpdateProviderId(selectedNode.id, e.target.value)}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            <option value="">选择 Provider...</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type})
              </option>
            ))}
          </select>
        </div>
        {data?.configSchema?.properties && (
          <div>
            <label className="block text-sm text-text-secondary mb-2">配置参数</label>
            <div className="space-y-2">
              {Object.entries(data.configSchema.properties).map(([key, schema]) => (
                <div key={key}>
                  <label className="block text-xs text-text-secondary mb-1">
                    {schema.title || key}
                    {schema.description && <span className="text-text-tertiary ml-1">({schema.description})</span>}
                  </label>
                  {schema.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={!!config[key]}
                      onChange={(e) => onUpdateProviderConfig(selectedNode.id, key, e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                  ) : schema.enum ? (
                    <select
                      value={String(config[key] || '')}
                      onChange={(e) => onUpdateProviderConfig(selectedNode.id, key, e.target.value)}
                      className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                    >
                      <option value="">选择...</option>
                      {schema.enum.map((v: string) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={schema.type === 'number' ? 'number' : 'text'}
                      value={String(config[key] || '')}
                      onChange={(e) => {
                        const val = schema.type === 'number' ? Number(e.target.value) : e.target.value;
                        onUpdateProviderConfig(selectedNode.id, key, val);
                      }}
                      placeholder={schema.default || ''}
                      className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-text-secondary space-y-1">
            <p>• ID: {String(selectedNode.id)}</p>
            <p>• Provider: {String(data?.providerName || '-')}</p>
            <p>• 类型: {String(data?.providerType || '-')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentConfig({
  selectedNode,
  onUpdateInputKey,
  onUpdateOutputKey,
  onUpdatePrompt,
  onUpdateGenericConfig,
}: {
  selectedNode: Node;
  onUpdateInputKey: (nodeId: string, value: string) => void;
  onUpdateOutputKey: (nodeId: string, value: string) => void;
  onUpdatePrompt: (nodeId: string, value: string) => void;
  onUpdateGenericConfig: (nodeId: string, partial: Record<string, unknown>) => void;
}) {
  // v3 P0-9：让用户从下拉框选 Agent，而不是硬编码 agentId
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-for-workflow'],
    queryFn: () => aiApi.listAgents(),
    staleTime: 30000,
  });
  const selectedAgentId = (selectedNode.data?.agentId as string) || '';

  return (
    <>
      <div className="pt-3 border-t border-border">
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-500" />
          Agent 选择
        </h4>
        <div>
          <label className="block text-sm text-text-secondary mb-1">选择 Agent</label>
          <select
            value={selectedAgentId}
            onChange={(e) =>
              onUpdateGenericConfig(selectedNode.id, { agentId: e.target.value })
            }
            disabled={agentsLoading}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            <option value="">{agentsLoading ? '加载中...' : '请选择 Agent'}</option>
            {(agents ?? [])
              .filter((a: Agent) => a.enabled === 1 || a.enabled === undefined)
              .map((a: Agent) => (
                <option key={a.id} value={a.id}>
                  {a.avatar ? `${a.avatar} ` : ''}
                  {a.name}（{a.role}）
                </option>
              ))}
            {agents && agents.length === 0 && (
              <option value="" disabled>
                暂无可用 Agent，请先在 AI 模块创建
              </option>
            )}
          </select>
          <p className="text-xs text-text-secondary mt-1">
            工作流执行时会调用此 Agent 完成节点任务
          </p>
          {selectedAgentId && (
            <p className="text-xs text-blue-500 mt-1">
              当前已选 Agent ID: {selectedAgentId}
            </p>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        <h4 className="text-sm font-semibold text-text-primary mb-3">数据流转配置</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-secondary mb-1 flex items-center gap-1">
              <span className="text-blue-500">←</span>
              输入键名
            </label>
            <input
              type="text"
              value={(selectedNode.data?.inputKey as string) || ''}
              onChange={(e) => onUpdateInputKey(selectedNode.id, e.target.value)}
              placeholder="例如: input, message"
              className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
            />
            <p className="text-xs text-text-secondary mt-1">从上一节点接收的数据键</p>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1 flex items-center gap-1">
              <span className="text-green-500">→</span>
              输出键名
            </label>
            <input
              type="text"
              value={(selectedNode.data?.outputKey as string) || ''}
              onChange={(e) => onUpdateOutputKey(selectedNode.id, e.target.value)}
              placeholder="例如: result, output"
              className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
            />
            <p className="text-xs text-text-secondary mt-1">传递给下一节点的数据键</p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        <label className="block text-sm text-text-secondary mb-2">自定义Prompt</label>
        <textarea
          value={(selectedNode.data?.prompt as string) || ''}
          onChange={(e) => onUpdatePrompt(selectedNode.id, e.target.value)}
          placeholder="覆盖Agent的系统提示词（可选）"
          rows={4}
          className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none font-mono text-sm"
        />
      </div>

      <div className="pt-2 border-t border-border">
        <div className="text-xs text-text-secondary space-y-1">
          <p>• ID: {String(selectedNode.id)}</p>
          <p>• Agent ID: {String(selectedNode.data?.agentId || '-')}</p>
          <p>
            • 位置: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})
          </p>
        </div>
      </div>
    </>
  );
}