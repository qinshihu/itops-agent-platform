// backend/src/repositories/types/kubernetes.ts
// 来源: v047 (k8s_contexts)

export interface K8sContext {
  id: string;
  name: string;
  cluster_url: string | null;
  namespace: string;
  auth_type: string;
  config: string | null;
  status: string;
  node_count: number;
  pod_count: number;
  created_at: string;
  updated_at: string;
}
