import type { Node } from '@xyflow/react';
import { Plus, Trash2, Zap } from 'lucide-react';
import type { DecisionAction, DecisionNodeData, DecisionRuleConfig } from '../types';

interface DecisionConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

const ACTION_OPTIONS: { value: DecisionAction; label: string }[] = [
  { value: 'auto_execute', label: '自动执行' },
  { value: 'request_approval', label: '请求审批' },
  { value: 'escalate_to_human', label: '升级人工' },
  { value: 'block', label: '阻断' },
];

export function DecisionConfig({ selectedNode, onUpdate }: DecisionConfigProps) {
  const data = (selectedNode.data ?? {}) as Partial<DecisionNodeData>;
  const rules: DecisionRuleConfig[] = data.rules ?? [];

  const addRule = () => {
    const next: DecisionRuleConfig[] = [
      ...rules,
      { condition: 'risk_score < 0.35', action: 'auto_execute', description: '' },
    ];
    onUpdate(selectedNode.id, { rules: next });
  };

  const updateRule = (index: number, partial: Partial<DecisionRuleConfig>) => {
    const next = rules.map((r, i) => (i === index ? { ...r, ...partial } : r));
    onUpdate(selectedNode.id, { rules: next });
  };

  const removeRule = (index: number) => {
    onUpdate(selectedNode.id, { rules: rules.filter((_, i) => i !== index) });
  };

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-indigo-500" />
        决策规则配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">风险评估来源节点 ID</label>
          <input
            type="text"
            value={data.riskSourceNodeId ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { riskSourceNodeId: e.target.value })}
            placeholder="留空则从上一节点读取"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm text-text-secondary">决策规则（按顺序匹配）</label>
            <button
              type="button"
              onClick={addRule}
              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加规则
            </button>
          </div>
          {rules.length === 0 ? (
            <p className="text-xs text-text-secondary py-3 text-center border border-dashed border-border rounded">
              暂无规则，点击右上角"添加规则"
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div key={idx} className="border border-border rounded p-2 space-y-1.5 bg-background/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary">规则 #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="p-0.5 text-red-500 hover:bg-red-500/10 rounded"
                      title="删除规则"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rule.condition}
                    onChange={(e) => updateRule(idx, { condition: e.target.value })}
                    placeholder="例如: risk_score < 0.35"
                    className="w-full px-2 py-1.5 rounded bg-background border border-border focus:border-primary focus:outline-none text-xs"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={rule.action}
                      onChange={(e) => updateRule(idx, { action: e.target.value as DecisionAction })}
                      className="w-full px-2 py-1.5 rounded bg-background border border-border focus:border-primary focus:outline-none text-xs"
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={rule.description ?? ''}
                      onChange={(e) => updateRule(idx, { description: e.target.value })}
                      placeholder="说明（可选）"
                      className="w-full px-2 py-1.5 rounded bg-background border border-border focus:border-primary focus:outline-none text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-text-secondary mt-1">支持 risk_score / risk_level 等变量</p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">默认动作（无规则命中时）</label>
          <select
            value={data.defaultAction ?? 'request_approval'}
            onChange={(e) => onUpdate(selectedNode.id, { defaultAction: e.target.value as DecisionAction })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>允许决策失败（仅记录，不阻塞工作流）</span>
        </label>
      </div>
    </div>
  );
}

export default DecisionConfig;