import db from '../models/database';

export interface CopilotConversationRow {
  id: string;
  user_id: string;
  messages: string;
  created_at: string;
  updated_at: string;
}

export const copilotConversationRepository = {
  listAll(): CopilotConversationRow[] {
    return db.prepare('SELECT * FROM copilot_conversations').all() as CopilotConversationRow[];
  },

  save(id: string, userId: string, messages: string, createdAt: string, updatedAt: string): void {
    db.prepare(`
      INSERT OR REPLACE INTO copilot_conversations 
      (id, user_id, messages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, messages, createdAt, updatedAt);
  },

  deleteById(id: string): void {
    db.prepare('DELETE FROM copilot_conversations WHERE id = ?').run(id);
  },
};