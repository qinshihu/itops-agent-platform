import db from '../models/database';

export const backupRepository = {
  list(filters: { backupType?: string; limit?: number } = {}): unknown[] {
    let query = 'SELECT * FROM backups WHERE 1=1';
    const params: unknown[] = [];
    if (filters.backupType) { query += ' AND backup_type = ?'; params.push(filters.backupType); }
    query += ' ORDER BY created_at DESC';
    query += ` LIMIT ${filters.limit || 20}`;
    return db.prepare(query).all(...params);
  },
};