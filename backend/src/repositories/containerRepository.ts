import db from '../models/database';

export const containerRepository = {
  list(filters: { dockerHostId?: string; status?: string; limit?: number } = {}): unknown[] {
    let query = 'SELECT * FROM containers WHERE 1=1';
    const params: unknown[] = [];
    if (filters.dockerHostId) { query += ' AND docker_host_id = ?'; params.push(filters.dockerHostId); }
    if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
    query += ` LIMIT ${filters.limit || 50}`;
    return db.prepare(query).all(...params);
  },
};