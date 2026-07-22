/**
 * ConditionConfig — 条件分支节点配置面板
 *
 * 节点类型：condition
 * 用法：根据表达式求值结果选择 true/false 分支执行
 *
 * 配置项：
 * - expression：条件表达式（如 {{risk_score}} > 0.6）
 * - defaultBranch：默认分支（true / false）
 */

import type { Node } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

interface ConditionConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

interface ConditionNodeData {
  expression?: string;
  defaultBranch?: 'true' | 'false';
  description?: string;
  allowFailure?: boolean;
}

export function ConditionConfig({ selectedNode, onUpdate }: ConditionConfigProps) {
  const data = (selectedNode.data || {}) as ConditionNodeData;
  const config = data as ConditionNodeData;

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-cyan-500" />
        条件分支配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">条件表达式</label>
          <textarea
            value={config.expression || ''}
            onChange={(e) => onUpdate(selectedNode.id, { expression: e.target.value })}
            placeholder="例: {{risk_score}} > 0.6 或 {{status}} == 'failed'"
            rows={3}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none font-mono text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">
            支持变量替换 {`{{var}}`}，支持 ==/!=/&gt;/&lt; 比较运算符
          </p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">默认分支</label>
          <select
            value={config.defaultBranch || 'false'}
            onChange={(e) => onUpdate(selectedNode.id, { defaultBranch: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            <option value="true">true（条件为真时执行）</option>
            <option value="false">false（条件为假时执行）</option>
          </select>
          <p className="text-xs text-text-secondary mt-1">
            真实条件求值失败的回退分支
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            checked={!!config.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <label className="text-sm text-text-secondary">
            允许条件求值失败时跳过节点（而不是整体失败）
          </label>
        </div>
      </div>
    </div>
  );
}