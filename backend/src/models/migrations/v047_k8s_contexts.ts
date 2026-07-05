/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v047 — k8s_contexts 表
 *
 * 从 modules/kubernetes/services/kubernetesService.ensureTables() 下沉而来。
 * Kubernetes 集群上下文持久化表（不含运行时 loadContexts 逻辑，仅 schema）。
 */
const v047K8sContexts: Migration = {
  id: '20250101000047',
  version: 47,
  name: 'k8s_contexts',
  description: 'Kubernetes contexts table (migrated from kubernetesService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS k8s_contexts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cluster_url TEXT,
        namespace TEXT DEFAULT 'default',
        auth_type TEXT DEFAULT 'kubeconfig',
        config TEXT,
        status TEXT DEFAULT 'inactive',
        node_count INTEGER DEFAULT 0,
        pod_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS k8s_contexts`);
  },
};

export default v047K8sContexts;
