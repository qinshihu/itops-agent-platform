import { logger } from '../../../../utils/logger';
import { knowledgeRepository, tasksRepo } from '../../../../repositories';
import type { WorkflowNode, WorkflowEdge, TaskLogEntry } from '../../../../types';

function calculateTextSimilarity(text1: string, text2: string): number {
  const set1 = new Set(text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const set2 = new Set(text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

export function isDuplicateKnowledgeBase(content: string, similarityThreshold = 0.7): string | null {
  try {
    const existing = knowledgeRepository.findIdContentByCategory('故障处理', 50);
    const targetError = content.toLowerCase();

    for (const entry of existing) {
      const similarity = calculateTextSimilarity(targetError, (entry.content || '').toLowerCase());
      if (similarity >= similarityThreshold) {
        return entry.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });

  edges.forEach(edge => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  });

  const nodeMap = new Map(nodes.map(node => [node.id, node]));

  const getNodePosition = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return { x: node?.position?.x || 0, y: node?.position?.y || 0 };
  };

  const queue: string[] = [];
  const startNodes = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort((a, b) => {
      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      return posA.x - posB.x;
    });

  queue.push(...startNodes);

  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    neighbors.sort((a, b) => {
      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      return posA.x - posB.x;
    });

    neighbors.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    });
  }

  const nodeIds = nodes.map(n => n.id);
  const unsortedNodes = nodeIds.filter(id => !result.includes(id));

  if (unsortedNodes.length > 0) {
    logger.warn(`⚠️ 工作流存在循环依赖，以下节点处于环中: ${unsortedNodes.join(', ')}`);
    return [];
  }

  return result;
}

export function addTaskLog(taskId: string, log: TaskLogEntry) {
  tasksRepo.appendTaskLog(taskId, log);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
