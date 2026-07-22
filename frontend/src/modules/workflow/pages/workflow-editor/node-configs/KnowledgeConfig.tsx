import type { Node } from '@xyflow/react';
import { BookOpen } from 'lucide-react';
import type { KnowledgeNodeData } from '../types';

interface KnowledgeConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

export function KnowledgeConfig({ selectedNode, onUpdate }: KnowledgeConfigProps) {
  const data = (selectedNode.data as KnowledgeNodeData) || {};

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-emerald-500" />
        知识沉淀配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">知识类别</label>
          <input
            type="text"
            value={data.category ?? '故障处理'}
            onChange={(e) => onUpdate(selectedNode.id, { category: e.target.value })}
            placeholder="例如：故障处理 / 运维经验 / Runbook"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">默认"故障处理"</p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">知识标题模板</label>
          <input
            type="text"
            value={data.titleTemplate ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { titleTemplate: e.target.value })}
            placeholder="例如：[${'$'}{alert.severity}] ${'$'}{alert.title}"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">支持 ${'$'}{'{变量}'} 注入，留空则使用默认</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.deduplicate !== false}
            onChange={(e) => onUpdate(selectedNode.id, { deduplicate: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>启用相似度去重</span>
        </label>

        <div>
          <label className="block text-sm text-text-secondary mb-1">相似度阈值（0~1）</label>
          <input
            type="number"
            value={data.similarityThreshold ?? 0.7}
            onChange={(e) =>
              onUpdate(selectedNode.id, { similarityThreshold: parseFloat(e.target.value) || 0 })
            }
            min={0}
            max={1}
            step={0.05}
            disabled={data.deduplicate === false}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm disabled:opacity-50"
          />
          <p className="text-xs text-text-secondary mt-1">默认 0.7，越高越严格</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>允许沉淀失败（仅记录，不阻塞工作流）</span>
        </label>
      </div>
    </div>
  );
}

export default KnowledgeConfig;