import db from '../models/database';

export const chatSessionRepository = {
  listWithMessageCount(filters: { status?: string; limit?: number } = {}): unknown[] {
    let query = `
      SELECT cs.id, cs.title, cs.status, cs.model_name, cs.created_at,
        COUNT(cm.id) as message_count
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.id = cm.session_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.status) { query += ' AND cs.status = ?'; params.push(filters.status); }
    query += ' GROUP BY cs.id ORDER BY cs.created_at DESC';
    query += ` LIMIT ${filters.limit || 10}`;
    return db.prepare(query).all(...params);
  },
};