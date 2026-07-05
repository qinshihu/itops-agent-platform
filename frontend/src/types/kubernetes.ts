// frontend/src/types/kubernetes.ts
// 与后端 backend/src/repositories/types/kubernetes.ts 对应

export interface K8sContext {
  id: string;
  name: string;
  cluster_url: string | null;
  namespace: string;
  auth_type: string;
  status: string;
  node_count: number;
  pod_count: number;
  created_at: string;
  updated_at: string;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  node: string;
  restarts: number;
  age: string;
  [key: string]: unknown;
}

export interface K8sNode {
  name: string;
  status: string;
  roles: string;
  version: string;
  osImage: string;
  [key: string]: unknown;
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: number;
  available: number;
  ready: number;
  [key: string]: unknown;
}
