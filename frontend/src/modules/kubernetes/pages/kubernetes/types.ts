// ==================== 类型定义 ====================
export interface K8sContext {
  id: string;
  name: string;
  server?: string;
  cluster?: string;
  created_at?: string;
}

export interface Namespace {
  name: string;
  status: string;
}

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  ip: string;
  node: string;
  creationTimestamp: string;
}

export interface PodDetail {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  conditions: Array<{ type: string; status: string; reason?: string; message?: string }>;
  containers: Array<{ name: string; image: string; ports: string[]; resources: Record<string, string> }>;
}

export interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  image: string;
  creationTimestamp: string;
}

export interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string;
  ports: string;
}

export interface NodeInfo {
  name: string;
  status: string;
  cpuAllocated: number;
  cpuTotal: number;
  memoryAllocated: number;
  memoryTotal: number;
  podsCount: number;
  podsMax: number;
  kubeletVersion: string;
}

// ==================== 状态着色 ====================
export const podStatusColors: Record<string, string> = {
  Running: 'text-green-400 bg-green-500/15', Pending: 'text-yellow-400 bg-yellow-500/15',
  Failed: 'text-red-400 bg-red-500/15', Succeeded: 'text-blue-400 bg-blue-500/15',
  Unknown: 'text-text-tertiary bg-surface', Terminating: 'text-purple-400 bg-purple-500/15',
  CrashLoopBackOff: 'text-red-400 bg-red-500/15', ContainerCreating: 'text-cyan-400 bg-cyan-500/15',
};

export const serviceTypeColors: Record<string, string> = {
  ClusterIP: 'text-blue-400 bg-blue-500/15', NodePort: 'text-green-400 bg-green-500/15',
  LoadBalancer: 'text-purple-400 bg-purple-500/15', ExternalName: 'text-cyan-400 bg-cyan-500/15',
};

export const nodeStatusColors: Record<string, string> = {
  Ready: 'text-green-400 bg-green-500/15', NotReady: 'text-red-400 bg-red-500/15',
  Unknown: 'text-yellow-400 bg-yellow-500/15',
};

export function formatAge(ts: string): string {
  if (!ts) return '-';
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}