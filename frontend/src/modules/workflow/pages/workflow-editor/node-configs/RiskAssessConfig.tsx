import type { Node } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { RiskAssessNodeData } from '../types';

interface RiskAssessConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

const SEVERITY_OPTIONS = [
  { value: '', label: '未指定（从上下文读取）' },
  { value: 'critical', label: 'critical（严重）' },
  { value: 'high', label: 'high（高）' },
  { value: 'medium', label: 'medium（中）' },
  { value: 'low', label: 'low（低）' },
  { value: 'info', label: 'info（提示）' },
];

export function RiskAssessConfig({ selectedNode, onUpdate }: RiskAssessConfigProps) {
  const data = (selectedNode.data as RiskAssessNodeData) || {};
  const thresholds = data.thresholds || {};

  const updateThreshold = (key: 'auto' | 'approve' | 'manual', value: number) => {
    onUpdate(selectedNode.id, {
      thresholds: { ...thresholds, [key]: value },
    });
  };

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        风险评估配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">修复计划来源节点 ID</label>
          <input
            type="text"
            value={data.planSourceNodeId ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { planSourceNodeId: e.target.value })}
            placeholder="留空则从上一节点读取"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">告警严重程度</label>
          <select
            value={data.alertSeverity ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { alertSeverity: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">告警标题</label>
          <input
            type="text"
            value={data.alertTitle ?? ''}
            onChange={(e) => onUpdate(selectedNode.id, { alertTitle: e.target.value })}
            placeholder="例如：${alert.title}"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
          <p className="text-xs text-text-secondary mt-1">支持 ${'$'}{'{变量}'} 注入</p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-2">风险阈值（0~1）</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-text-secondary mb-1">自动 ≤</label>
              <input
                type="number"
                value={thresholds.auto ?? 0.35}
                onChange={(e) => updateThreshold('auto', parseFloat(e.target.value) || 0)}
                min={0}
                max={1}
                step={0.01}
                className="w-full px-2 py-1.5 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">审批 ≤</label>
              <input
                type="number"
                value={thresholds.approve ?? 0.65}
                onChange={(e) => updateThreshold('approve', parseFloat(e.target.value) || 0)}
                min={0}
                max={1}
                step={0.01}
                className="w-full px-2 py-1.5 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">人工 ≤</label>
              <input
                type="number"
                value={thresholds.manual ?? 0.85}
                onChange={(e) => updateThreshold('manual', parseFloat(e.target.value) || 0)}
                min={0}
                max={1}
                step={0.01}
                className="w-full px-2 py-1.5 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-1">默认 0.35 / 0.65 / 0.85</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>允许评估失败（仅记录，不阻塞工作流）</span>
        </label>
      </div>
    </div>
  );
}

export default RiskAssessConfig;