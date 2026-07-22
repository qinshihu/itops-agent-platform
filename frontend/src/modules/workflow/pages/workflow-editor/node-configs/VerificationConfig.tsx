import type { Node } from '@xyflow/react';
import { ShieldCheck } from 'lucide-react';
import type { VerificationGate, VerificationNodeData } from '../types';

interface VerificationConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

const ALL_GATES: { value: VerificationGate; label: string; description: string }[] = [
  { value: 'command_success', label: '命令成功', description: '执行命令返回码为 0' },
  { value: 'service_health', label: '服务健康', description: '目标服务存活/可用' },
  { value: 'metric_recovery', label: '指标恢复', description: '关键监控指标回到阈值内' },
  { value: 'baseline_comparison', label: '基线对比', description: '与历史基线对比无异常' },
  { value: 'impact_assessment', label: '影响评估', description: '业务影响评估通过' },
];

export function VerificationConfig({ selectedNode, onUpdate }: VerificationConfigProps) {
  const data = (selectedNode.data as VerificationNodeData) || {};
  const gates: VerificationGate[] = data.gates ?? ALL_GATES.map((g) => g.value);

  const toggleGate = (gate: VerificationGate, checked: boolean) => {
    const next = checked ? Array.from(new Set([...gates, gate])) : gates.filter((g) => g !== gate);
    onUpdate(selectedNode.id, { gates: next });
  };

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-cyan-500" />
        验证门禁配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-2">验证门禁（多选）</label>
          <div className="space-y-1.5">
            {ALL_GATES.map((g) => (
              <label key={g.value} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={gates.includes(g.value)}
                  onChange={(e) => toggleGate(g.value, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="flex-1">
                  <span className="text-text-primary">{g.label}</span>
                  <span className="block text-xs text-text-secondary">{g.description}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-1">默认全部启用，按勾选顺序逐级执行</p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">目标服务器 ID（可选）</label>
          <input
            type="text"
            value={data.serverId ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { serverId: e.target.value })}
            placeholder="可留空，使用上下文的 server_id"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">整体超时（毫秒）</label>
          <input
            type="number"
            value={data.timeout ?? 300000}
            onChange={(e) => onUpdate(selectedNode.id, { timeout: parseInt(e.target.value) || 300000 })}
            min={1000}
            step={1000}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">默认 300000（5 分钟）</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>允许验证失败（仅记录，不阻塞工作流）</span>
        </label>
      </div>
    </div>
  );
}

export default VerificationConfig;