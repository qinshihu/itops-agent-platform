import type { NodeTypes } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Save, Shield, AlertCircle, Zap, Undo } from 'lucide-react';
import type { AgentNodeData, ApprovalNodeData, ProviderNodeData, GenericNodeData } from './types';

const defaultNodeStyle = (color: string, selected: boolean) =>
  `px-4 py-3 rounded-lg shadow-md border-2 min-w-[140px] ${selected ? `border-${color}-500 bg-${color}-500/20 ring-2 ring-${color}-500/30` : `border-${color}-500/40 bg-${color}-500/10`} transition-all duration-200`;

export function AgentNode({ data, selected }: { data: AgentNodeData; selected: boolean }) {
  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[200px]
        ${selected ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border bg-surface'}
        transition-all duration-200
      `}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{data.avatar || '🤖'}</span>
        <span className="font-semibold text-text-primary text-sm">{data.label || 'Agent'}</span>
      </div>
      {data.description && (
        <div className="text-xs text-text-secondary mb-2 line-clamp-2">{data.description}</div>
      )}
      <div className="space-y-1 mb-2">
        {data.inputKey && (
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
            ← 输入: {data.inputKey}
          </div>
        )}
        {data.outputKey && (
          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
            → 输出: {data.outputKey}
          </div>
        )}
      </div>
      {data.prompt && (
        <div className="text-xs text-text-secondary bg-background px-2 py-1 rounded border border-border">
          已配置Prompt
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary" />
    </div>
  );
}

export function ApprovalNode({ data, selected }: { data: ApprovalNodeData; selected: boolean }) {
  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[200px]
        ${selected ? 'border-orange-500 bg-orange-500/15 ring-2 ring-orange-500/30' : 'border-orange-500/50 bg-orange-500/10'}
        transition-all duration-200
      `}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500" />
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-6 h-6 text-orange-400" />
        <span className="font-semibold text-text-primary text-sm">{data.label || '审批节点'}</span>
      </div>
      {data.description && (
        <div className="text-xs text-text-secondary mb-2 line-clamp-2">{data.description}</div>
      )}
      {data.approvalConfig && (
        <div className="text-xs text-orange-300 bg-orange-500/15 px-2 py-1 rounded border border-orange-500/30">
          ⏱️ 超时: {data.approvalConfig.timeout || 3600}秒
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500" />
    </div>
  );
}

export function ProviderNode({ data, selected }: { data: ProviderNodeData; selected: boolean }) {
  const typeColors: Record<string, string> = {
    notification: 'border-blue-500 bg-blue-500/10',
    action: 'border-green-500 bg-green-500/10',
    script: 'border-purple-500 bg-purple-500/10',
    alert: 'border-red-500 bg-red-500/10',
  };
  const typeIcons: Record<string, string> = {
    notification: '🔔',
    action: '⚡',
    script: '📜',
    alert: '🚨',
  };
  const tc = typeColors[data.providerType || ''] || 'border-gray-500 bg-gray-500/10';
  const ti = typeIcons[data.providerType || ''] || '🔧';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[200px]
        ${selected ? `ring-2 ring-primary/30 ${tc}` : tc}
        transition-all duration-200
      `}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{ti}</span>
        <span className="font-semibold text-text-primary text-sm">{data.label || 'Provider'}</span>
      </div>
      {data.providerName && (
        <div className="text-xs text-text-secondary mb-1">{data.providerName}</div>
      )}
      {data.method && (
        <div className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30">
          {data.method}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary" />
    </div>
  );
}

export function StartNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('green', selected)} style={{ borderRadius: '9999px' }}>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
      <span className="font-semibold text-sm">{data.label || '开始'}</span>
    </div>
  );
}

export function EndNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('red', selected)} style={{ borderRadius: '9999px' }}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-red-500" />
      <span className="font-semibold text-sm">{data.label || '结束'}</span>
    </div>
  );
}

export function ConditionNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('yellow', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500" />
      <div className="text-sm font-semibold">◇ {data.label || '条件'}</div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-yellow-500" />
    </div>
  );
}

export function VerificationNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('cyan', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-cyan-500" />
      <div className="flex items-center gap-1">
        <Shield className="w-4 h-4 text-cyan-400" />
        <span className="font-semibold text-sm">{data.label || '验证'}</span>
      </div>
      {data.gates ? (
        <div className="text-xs text-cyan-300 mt-1">{(data.gates as unknown as Array<unknown>).length} 级门禁</div>
      ) : null}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500" />
    </div>
  );
}

export function RiskAssessNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('amber', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-500" />
      <div className="flex items-center gap-1">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <span className="font-semibold text-sm">{data.label || '风险评估'}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-amber-500" />
    </div>
  );
}

export function DecisionNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('indigo', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500" />
      <div className="flex items-center gap-1">
        <Zap className="w-4 h-4 text-indigo-400" />
        <span className="font-semibold text-sm">{data.label || '决策'}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500" />
    </div>
  );
}

export function KnowledgeNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('emerald', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500" />
      <div className="flex items-center gap-1">
        <Save className="w-4 h-4 text-emerald-400" />
        <span className="font-semibold text-sm">{data.label || '知识沉淀'}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
}

export function RollbackNode({ data, selected }: { data: GenericNodeData; selected: boolean }) {
  return (
    <div className={defaultNodeStyle('rose', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-rose-500" />
      <div className="flex items-center gap-1">
        <Undo className="w-4 h-4 text-rose-400" />
        <span className="font-semibold text-sm">{data.label || '回滚'}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-rose-500" />
    </div>
  );
}

export function GenericNode({ data, selected, color }: { data: GenericNodeData; selected: boolean; color?: string }) {
  return (
    <div className={defaultNodeStyle(color || 'gray', selected)}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-400" />
      <span className="font-semibold text-sm">{data.label || '节点'}</span>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-gray-400" />
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  approval: ApprovalNode,
  provider: ProviderNode,
  start: StartNode,
  end: EndNode,
  condition: ConditionNode,
  verification: VerificationNode,
  risk_assess: RiskAssessNode,
  decision: DecisionNode,
  knowledge: KnowledgeNode,
  rollback: RollbackNode,
  loop: (props) => <GenericNode {...props} color="violet" />,
  parallel: (props) => <GenericNode {...props} color="teal" />,
  webhook: (props) => <GenericNode {...props} color="sky" />,
  wait: (props) => <GenericNode {...props} color="slate" />,
  variable_set: (props) => <GenericNode {...props} color="lime" />,
};