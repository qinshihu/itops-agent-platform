import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import clsx from 'clsx';

export interface TopologyNode {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'root_cause' | 'affected';
  ip?: string;
  x?: number;
  y?: number;
}

export interface TopologyEdge {
  source: string;
  target: string;
  protocol?: string;
  status?: 'active' | 'inactive' | 'degraded';
}

interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  width?: number;
  height?: number;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const PADDING = 60;

const statusColors: Record<string, string> = {
  online: '#22c55e',
  offline: '#64748b',
  warning: '#f59e0b',
  error: '#ef4444',
  root_cause: '#ef4444',
  affected: '#f97316',
};

const statusLabels: Record<string, string> = {
  online: '正常',
  offline: '离线',
  warning: '警告',
  error: '异常',
  root_cause: '根因',
  affected: '受影响',
};

export default function TopologyGraph({ nodes, edges, width = 1200, height = 600 }: TopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TopologyNode } | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  const positions = useMemo(() => {
    if (nodes.length === 0) return new Map<string, { x: number; y: number }>();

    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    nodes.forEach(n => {
      adjacency.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    edges.forEach(e => {
      if (adjacency.has(e.source)) {
        adjacency.get(e.source)!.push(e.target);
      }
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    const levels = new Map<string, number>();
    const queue: string[] = [];
    nodes.forEach(n => {
      if (inDegree.get(n.id) === 0) {
        queue.push(n.id);
        levels.set(n.id, 0);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current)!;
      adjacency.get(current)!.forEach(neighbor => {
        const newLevel = Math.max(levels.get(neighbor) || 0, currentLevel + 1);
        levels.set(neighbor, newLevel);
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    const nodesByLevel = new Map<number, string[]>();
    nodes.forEach(n => {
      const level = levels.get(n.id) || 0;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level)!.push(n.id);
    });

    const maxLevel = Math.max(...nodesByLevel.keys());
    const levelHeight = (height - PADDING * 2) / (maxLevel + 1);
    const positions = new Map<string, { x: number; y: number }>();

    nodesByLevel.forEach((nodeIds, level) => {
      const nodeCount = nodeIds.length;
      const spacing = (width - PADDING * 2) / (nodeCount + 1);
      nodeIds.forEach((nodeId, index) => {
        positions.set(nodeId, {
          x: PADDING + spacing * (index + 1),
          y: PADDING + levelHeight * (level + 0.5),
        });
      });
    });

    return positions;
  }, [nodes, edges, width, height]);

  const getNodePosition = useCallback((nodeId: string): { x: number; y: number } => {
    const node = nodeMap.get(nodeId);
    if (node?.x !== undefined && node?.y !== undefined) {
      return { x: node.x, y: node.y };
    }
    return positions.get(nodeId) || { x: width / 2, y: height / 2 };
  }, [nodeMap, positions, width, height]);

  const handleNodeHover = useCallback((e: React.MouseEvent, node: TopologyNode) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      node,
    });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(prev => prev === nodeId ? null : nodeId);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setSelectedNode(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-surface rounded-xl border border-border">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background flex items-center justify-center">
            <svg className="w-8 h-8 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <p className="text-text-secondary">暂无拓扑数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-surface rounded-xl border border-border overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="select-none"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
          <marker
            id="arrowhead-affected"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
          </marker>
          <filter id="node-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1" />
          </filter>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {edges.map((edge, idx) => {
          const sourcePos = getNodePosition(edge.source);
          const targetPos = getNodePosition(edge.target);
          const targetNode = nodeMap.get(edge.target);
          const isRootCausePath = targetNode?.status === 'affected' || targetNode?.status === 'root_cause';

          return (
            <g key={`${edge.source}-${edge.target}-${idx}`}>
              <line
                x1={sourcePos.x}
                y1={sourcePos.y + NODE_HEIGHT / 2}
                x2={targetPos.x}
                y2={targetPos.y - NODE_HEIGHT / 2}
                stroke={isRootCausePath ? '#f97316' : '#cbd5e1'}
                strokeWidth={isRootCausePath ? 3 : 2}
                strokeDasharray={edge.status === 'inactive' ? '5,5' : undefined}
                markerEnd={`url(#arrowhead${isRootCausePath ? '-affected' : selectedNode === edge.source ? '-active' : ''})`}
              />
              {edge.protocol && (
                <text
                  x={(sourcePos.x + targetPos.x) / 2}
                  y={(sourcePos.y + targetPos.y) / 2 - 8}
                  textAnchor="middle"
                  className="text-xs"
                  fill={isRootCausePath ? '#f97316' : '#64748b'}
                >
                  {edge.protocol}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map(node => {
          const pos = getNodePosition(node.id);
          const isSelected = selectedNode === node.id;
          const isHighlighted = selectedNode && edges.some(
            e => (e.source === selectedNode && e.target === node.id) ||
                 (e.target === selectedNode && e.source === node.id)
          );

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(node.id);
              }}
              onMouseEnter={(e) => handleNodeHover(e, node)}
              onMouseLeave={handleNodeLeave}
              className="cursor-pointer"
            >
              <rect
                x={-NODE_WIDTH / 2}
                y={-NODE_HEIGHT / 2}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={12}
                ry={12}
                fill={isSelected ? '#1e293b' : '#ffffff'}
                stroke={statusColors[node.status] || '#94a3b8'}
                strokeWidth={isSelected || isHighlighted ? 3 : 2}
                filter={node.status === 'root_cause' ? 'url(#node-glow)' : 'url(#node-shadow)'}
                className={clsx(
                  'transition-all duration-200',
                  isSelected && 'scale-105'
                )}
              />
              <circle
                cx={-NODE_WIDTH / 2 + 16}
                cy={0}
                r={6}
                fill={statusColors[node.status] || '#94a3b8'}
              />
              <text
                x={8}
                y={-4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14"
                fontWeight="500"
                fill="#0f172a"
              >
                {node.name.length > 12 ? node.name.slice(0, 11) + '...' : node.name}
              </text>
              {node.ip && (
                <text
                  x={8}
                  y={14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill="#64748b"
                >
                  {node.ip}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-surface border border-border rounded-lg shadow-xl p-3 min-w-[180px]">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: statusColors[tooltip.node.status] }}
              />
              <span className="font-medium text-text-primary">{tooltip.node.name}</span>
            </div>
            {tooltip.node.ip && (
              <div className="text-xs text-text-secondary">IP: {tooltip.node.ip}</div>
            )}
            <div className="text-xs text-text-secondary">
              状态: {statusLabels[tooltip.node.status] || tooltip.node.status}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-4 text-xs text-text-secondary bg-surface/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-border">
        {Object.entries(statusLabels).slice(0, 4).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[key] }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
