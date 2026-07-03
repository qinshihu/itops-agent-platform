import db from '../models/database';

export const tokenBlacklistRepository = {
  add(id: string, token: string, userId: string | null, reason: string | null, expiresAt: string): void {
    db.prepare(`
      INSERT OR IGNORE INTO token_blacklist (id, token, user_id, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, token, userId, reason, expiresAt);
  },

  isBlacklisted(token: string): boolean {
    const result = db.prepare(`
      SELECT 1 FROM token_blacklist
      WHERE token = ? AND expires_at > datetime('now','localtime')
    `).get(token);
    return !!result;
  },

  cleanExpired(): number {
    const result = db.prepare(`
      DELETE FROM token_blacklist
      WHERE expires_at < datetime('now','localtime')
    `).run();
    return (result as { changes: number }).changes;
  },

  count(): number {
    const row = db.prepare('SELECT COUNT(*) as c FROM token_blacklist').get() as { c: number };
    return row.c;
  },
};
