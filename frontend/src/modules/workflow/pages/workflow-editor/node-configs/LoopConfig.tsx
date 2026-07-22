/**
 * LoopConfig — 循环节点配置面板
 *
 * 节点类型：loop
 * 用法：对一个数组中的每个元素执行下游节点（直到最大次数限制）
 *
 * 配置项：
 * - sourceKey：要遍历的数组在 context 中的键名
 * - maxIterations：最大循环次数（防失控）
 * - currentItemKey：当前元素注入到 context 的键名
 */

import type { Node } from '@xyflow/react';
import { Repeat } from 'lucide-react';

interface LoopConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

interface LoopNodeData {
  sourceKey?: string;
  maxIterations?: number;
  currentItemKey?: string;
  currentIndexKey?: string;
  description?: string;
  allowFailure?: boolean;
}

export function LoopConfig({ selectedNode, onUpdate }: LoopConfigProps) {
  const config = (selectedNode.data || {}) as LoopNodeData;

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Repeat className="w-4 h-4 text-purple-500" />
        循环配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">数组来源键</label>
          <input
            type="text"
            value={config.sourceKey || ''}
            onChange={(e) => onUpdate(selectedNode.id, { sourceKey: e.target.value })}
            placeholder="例如: items, servers, alerts"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">
            从执行 context 中读取数组，遍历每个元素
          </p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">最大循环次数</label>
          <input
            type="number"
            value={config.maxIterations || 100}
            onChange={(e) => onUpdate(selectedNode.id, { maxIterations: parseInt(e.target.value) || 100 })}
            min={1}
            max={10000}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">
            防止数组过大导致失控
          </p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">当前元素键名</label>
          <input
            type="text"
            value={config.currentItemKey || 'item'}
            onChange={(e) => onUpdate(selectedNode.id, { currentItemKey: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">当前索引键名</label>
          <input
            type="text"
            value={config.currentIndexKey || 'index'}
            onChange={(e) => onUpdate(selectedNode.id, { currentIndexKey: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            checked={!!config.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <label className="text-sm text-text-secondary">
            单次循环失败时继续（不中断整体循环）
          </label>
        </div>
      </div>
    </div>
  );
}