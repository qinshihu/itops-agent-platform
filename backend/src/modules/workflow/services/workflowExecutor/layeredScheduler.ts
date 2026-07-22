/**
 * layeredScheduler — DAG 分层调度器（v5 真正并行）
 *
 * 设计目的：
 *   v4 之前的 executeFromIndex 是串行 for 循环，parallel/loop 节点只是"语义占位"。
 *   v5 引入分层调度：把 nodes 按 edges 依赖关系分成多层，每层内的节点互不依赖，可并发执行。
 *
 * 调度策略：
 *   1. topologicalLayers()  —— Kahn 算法变体，同时计算每个节点的"层号"
 *   2. executeLayer()       —— 单层内 Promise.all 真正并发（受 maxConcurrency 控制）
 *   3. loop/parallel 节点由 handler 内部触发"下游分支并发"（保留这种自定义控制能力）
 *
 * 兼容性：
 *   - 现有 executeFromIndex 的 handler 返回值（'continue'/'paused'/'completed'）完全保留
 *   - 现有审批/暂停/恢复机制完全保留
 *   - 节点 handler 不需要修改
 */

import type { WorkflowNode, WorkflowEdge } from '../../../../types';

export type NodeLayerMap = Map<string, number>;

/**
 * 计算每个节点所在的"层号"。
 * - start 节点在第 0 层
 * - 其他节点 = max(所有上游节点层号) + 1
 *
 * @returns layers: NodeLayerMap (节点 id → 层号)，maxLayer: 最大层号
 */
export function topologicalLayers(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { layers: NodeLayerMap; maxLayer: number } {
  const layers: NodeLayerMap = new Map();

  // 1. 初始化入度
  const inDegree = new Map<string, number>();
  const upstreamMap = new Map<string, string[]>();
  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    upstreamMap.set(n.id, []);
  });

  edges.forEach((e) => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    upstreamMap.get(e.target)?.push(e.source);
  });

  // 2. 找到所有入度为 0 的节点（start 节点）作为第 0 层
  const currentLayer: string[] = [];
  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0) {
      layers.set(n.id, 0);
      currentLayer.push(n.id);
    }
  });

  // 3. BFS 推导：处理过的节点出度，入度减 1；新入度 0 的进入下一层
  let maxLayer = 0;
  const downstreamMap = new Map<string, string[]>();
  nodes.forEach((n) => downstreamMap.set(n.id, []));
  edges.forEach((e) => downstreamMap.get(e.source)?.push(e.target));

  let workingLayer = currentLayer;
  let layerIdx = 0;
  while (workingLayer.length > 0) {
    const nextLayer: string[] = [];
    for (const nodeId of workingLayer) {
      const downstream = downstreamMap.get(nodeId) || [];
      for (const targetId of downstream) {
        const remaining = (inDegree.get(targetId) || 0) - 1;
        inDegree.set(targetId, remaining);
        if (remaining === 0) {
          // 节点的所有上游都已分配层号 → 当前节点层号 = max(上游层号) + 1
          const upstreams = upstreamMap.get(targetId) || [];
          const maxUpstreamLayer = upstreams.reduce(
            (acc, uid) => Math.max(acc, layers.get(uid) ?? 0),
            0,
          );
          const targetLayer = maxUpstreamLayer + 1;
          layers.set(targetId, targetLayer);
          nextLayer.push(targetId);
          maxLayer = Math.max(maxLayer, targetLayer);
        }
      }
    }
    layerIdx += 1;
    workingLayer = nextLayer;
  }

  return { layers, maxLayer };
}

/**
 * 把 executionOrder（扁平列表）转换为分层列表
 */
export function groupByLayer(
  executionOrder: string[],
  layerMap: NodeLayerMap
): string[][] {
  const grouped: string[][] = [];
  for (const nodeId of executionOrder) {
    const layerIdx = layerMap.get(nodeId) ?? 0;
    if (!grouped[layerIdx]) grouped[layerIdx] = [];
    grouped[layerIdx].push(nodeId);
  }
  return grouped.filter((g) => g && g.length > 0);
}

/**
 * 简易并发执行器：限制 Promise.all 的并发数（避免一次性开太多）
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        // 单个失败不阻塞其他任务
        results[idx] = e as T;
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}