import type { Node } from '@xyflow/react';
import { Undo2 } from 'lucide-react';
import type { RollbackNodeData } from '../types';

interface RollbackConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

export function RollbackConfig({ selectedNode, onUpdate }: RollbackConfigProps) {
  const data = (selectedNode.data as RollbackNodeData) || {};

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Undo2 className="w-4 h-4 text-rose-500" />
        回滚配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">回滚命令来源节点 ID</label>
          <input
            type="text"
            value={data.commandSourceNodeId ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { commandSourceNodeId: e.target.value })}
            placeholder="留空则从上一节点读取"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">从此节点的输出中提取回滚命令</p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">目标服务器 ID</label>
          <input
            type="text"
            value={data.serverId ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { serverId: e.target.value })}
            placeholder="可留空，使用上下文的 server_id"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">命令超时（毫秒）</label>
          <input
            type="number"
            value={data.commandTimeout ?? 30000}
            onChange={(e) =>
              onUpdate(selectedNode.id, { commandTimeout: parseInt(e.target.value) || 30000 })
            }
            min={1000}
            step={1000}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">默认 30000（30 秒）</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.verifyAfterRollback !== false}
            onChange={(e) => onUpdate(selectedNode.id, { verifyAfterRollback: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>回滚后自动验证</span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>允许回滚失败（仅记录，不阻塞工作流）</span>
        </label>
      </div>
    </div>
  );
}

export default RollbackConfig;