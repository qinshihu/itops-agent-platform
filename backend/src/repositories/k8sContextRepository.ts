import db from '../models/database';
import type { K8sContext } from './types/kubernetes';

export const k8sContextRepository = {
  listActive(): K8sContext[] {
    return db.prepare('SELECT * FROM k8s_contexts WHERE status = ?').all('active') as K8sContext[];
  },

  insert(input: {
    id: string; name: string; cluster_url: string; namespace: string;
    auth_type: string; config: string; created_at: string; updated_at: string;
  }): void {
    db.prepare(`
      INSERT INTO k8s_contexts (id, name, cluster_url, namespace, auth_type, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(input.id, input.name, input.cluster_url, input.namespace, input.auth_type, input.config, input.created_at, input.updated_at);
  },

  updateStatus(id: string, status: string): void {
    db.prepare("UPDATE k8s_contexts SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(status, id);
  },

  updateCounts(id: string, nodeCount: number, podCount: number): void {
    db.prepare("UPDATE k8s_contexts SET node_count = ?, pod_count = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(nodeCount, podCount, id);
  },

  deleteById(id: string): void {
    db.prepare('DELETE FROM k8s_contexts WHERE id = ?').run(id);
  },
};
