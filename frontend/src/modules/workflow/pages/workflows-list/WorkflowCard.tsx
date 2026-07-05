/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  GitBranch, Play, Clock, Edit, Copy, Trash2,
  Server, Shield, Database, Globe, Cpu, ArrowRight,
  Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Workflow } from './types';

interface WorkflowCardProps {
  workflow: Workflow;
  isExecuting: boolean;
  onExecute: (workflow: Workflow) => void;
  onEdit: (workflow: Workflow) => void;
  onDuplicate: (workflow: Workflow) => void;
  onDelete: (workflowId: string) => void;
}

const getWorkflowStyle = (workflow: Workflow) => {
  const serverNames = ['服务器', '巡检', '合规'];
  const securityNames = ['安全', '漏洞'];
  const dataNames = ['数据', '备份', '恢复'];
  const networkNames = ['网络', 'DNS'];
  const systemNames = ['系统', '性能', '监控'];

  const name = workflow.name.toLowerCase();

  if (serverNames.some(n => name.includes(n))) {
    return { icon: Server, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
  }
  if (securityNames.some(n => name.includes(n))) {
    return { icon: Shield, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  }
  if (dataNames.some(n => name.includes(n))) {
    return { icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  }
  if (networkNames.some(n => name.includes(n))) {
    return { icon: Globe, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
  }
  if (systemNames.some(n => name.includes(n))) {
    return { icon: Cpu, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  }

  if (workflow.is_template === 1) {
    return { icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
  }

  return { icon: GitBranch, color: 'text-text-secondary', bg: 'bg-text-secondary/10', border: 'border-text-secondary/30' };
};

export default function WorkflowCard({
  workflow,
  isExecuting,
  onExecute,
  onEdit,
  onDuplicate,
  onDelete,
}: WorkflowCardProps) {
  const style = getWorkflowStyle(workflow);
  const Icon = style.icon;

  return (
    <div
      className="bg-surface rounded-2xl border border-border hover:border-primary/30 transition-all group relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${style.bg}`} />

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${style.bg} group-hover:scale-110 transition-transform`}>
              <Icon className={`w-6 h-6 ${style.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-text-primary truncate">{workflow.name}</h3>
                {workflow.is_template === 1 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 text-primary text-xs rounded-full border border-primary/20">
                    <Sparkles className="w-3 h-3" />
                    模板
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-text-secondary" />
                <span className="text-xs text-text-secondary">
                  {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDuplicate(workflow)}
                  className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                  title="复制"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(workflow.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-text-secondary mb-4 line-clamp-2 min-h-[40px]">
          {workflow.description || '暂无描述'}
        </p>

        <div className="bg-gradient-to-br from-background/80 to-background/40 rounded-xl p-5 mb-4 border border-border/60">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              执行流程
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                {workflow.nodes?.length || 0} 节点
              </span>
              <span className="text-xs text-text-tertiary">|</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-500 rounded-md text-xs font-medium">
                {workflow.edges?.length || 0} 连接
              </span>
            </div>
          </div>

          <div className="min-h-[60px]">
            {workflow.nodes && workflow.nodes.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {(() => {
                  const nodeMap = new Map((workflow.nodes || []).map(node => [node.id, node]));
                  const edgeMap = new Map<string, string[]>();

                  (workflow.edges || []).forEach(edge => {
                    const targets = edgeMap.get(edge.source) || [];
                    targets.push(edge.target);
                    edgeMap.set(edge.source, targets);
                  });

                  const targetIds = new Set((workflow.edges || []).map(e => e.target));
                  const startNodes = (workflow.nodes || []).filter(n => !targetIds.has(n.id));

                  if (startNodes.length === 1) {
                    const orderedNodes: any[] = [];
                    let currentId: string | null = startNodes[0].id;
                    const visited = new Set<string>();

                    while (currentId && !visited.has(currentId) && orderedNodes.length < 5) {
                      visited.add(currentId);
                      const node = nodeMap.get(currentId);
                      if (node) orderedNodes.push(node);
                      const nextTargets = edgeMap.get(currentId) || [];
                      currentId = nextTargets.length > 0 ? nextTargets[0] : null;
                    }

                    return orderedNodes.map((node, index) => (
                      <div key={node.id} className="flex items-center shrink-0">
                        <div className="px-4 py-2.5 bg-gradient-to-r from-surface to-background rounded-lg border-2 border-primary/20 hover:border-primary/50 transition-all shadow-sm flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-text-primary truncate max-w-28">
                            {node.data?.label || '节点'}
                          </span>
                        </div>
                        {index < orderedNodes.length - 1 && (
                          <div className="flex items-center px-1">
                            <div className="w-6 h-px bg-gradient-to-r from-primary/50 to-primary/30" />
                            <ArrowRight className="w-3 h-3 text-primary/60 mx-0.5" />
                            <div className="w-6 h-px bg-gradient-to-l from-primary/50 to-primary/30" />
                          </div>
                        )}
                      </div>
                    ));
                  }

                  return (workflow.nodes || []).slice(0, 4).map((node, index) => (
                    <div key={node.id} className="flex items-center shrink-0">
                      <div className="px-4 py-2.5 bg-gradient-to-r from-surface to-background rounded-lg border-2 border-border/70 hover:border-primary/40 transition-all shadow-sm flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate max-w-24">
                          {node.data?.label || '节点'}
                        </span>
                      </div>
                      {index < Math.min((workflow.nodes || []).length, 4) - 1 && (
                        <ArrowRight className="w-4 h-4 text-text-tertiary mx-1" />
                      )}
                    </div>
                  ));
                })()}

                {workflow.nodes && workflow.nodes.length > 4 && (
                  <div className="shrink-0 ml-1 px-3 py-2 bg-gradient-to-r from-primary/5 to-purple-500/5 text-primary rounded-lg border border-primary/20 flex items-center gap-1.5">
                    <span className="text-sm font-medium">+{workflow.nodes.length - 4}</span>
                    <span className="text-xs text-text-secondary">更多</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-16 text-text-tertiary text-sm italic border-2 border-dashed border-border/50 rounded-lg">
                暂无节点，点击编辑添加
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onExecute(workflow)}
            disabled={isExecuting || (workflow.nodes?.length || 0) === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl hover:from-primary/90 hover:to-purple-600/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/25"
          >
            <Play className="w-4 h-4" />
            {isExecuting ? '执行中...' : '立即执行'}
          </button>
          <button
            onClick={() => onEdit(workflow)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-border text-text-primary rounded-xl hover:bg-background/80 hover:border-primary/30 transition-all"
          >
            <Edit className="w-4 h-4" />
            编辑
          </button>
        </div>
      </div>
    </div>
  );
}