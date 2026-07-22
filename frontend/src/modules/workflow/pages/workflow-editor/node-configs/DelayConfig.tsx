/**
 * DelayConfig — 等待/延时节点配置面板
 *
 * 节点类型：delay
 * 用法：暂停执行一段时间（固定时长）或等待某条件满足
 *
 * 配置项：
 * - durationMs：等待时长（毫秒）
 * - waitCondition：可选的条件表达式（满足则提前继续）
 */

import type { Node } from '@xyflow/react';
import { Timer } from 'lucide-react';

interface DelayConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

interface DelayNodeData {
  durationMs?: number;
  waitCondition?: string;
  description?: string;
  allowFailure?: boolean;
}

export function DelayConfig({ selectedNode, onUpdate }: DelayConfigProps) {
  const config = (selectedNode.data || {}) as DelayNodeData;

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Timer className="w-4 h-4 text-amber-500" />
        延时/等待配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">等待时长（毫秒）</label>
          <input
            type="number"
            value={config.durationMs || 5000}
            onChange={(e) => onUpdate(selectedNode.id, { durationMs: parseInt(e.target.value) || 5000 })}
            min={100}
            step={1000}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">
            默认 5000ms = 5秒
          </p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">提前唤醒条件（可选）</label>
          <textarea
            value={config.waitCondition || ''}
            onChange={(e) => onUpdate(selectedNode.id, { waitCondition: e.target.value })}
            placeholder="例: {{server_ready}} == true"
            rows={2}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none font-mono text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">
            每 1s 轮询，条件为 true 时提前继续
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
            允许超时失败时跳过（不影响后续节点）
          </label>
        </div>
      </div>
    </div>
  );
}