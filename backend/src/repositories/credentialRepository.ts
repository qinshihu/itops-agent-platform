import db from '../models/database';

export interface CredentialRecord {
  id: number;
  provider: string;
  encrypted_value: string;
  key_version: number;
  created_at: string;
  updated_at: string;
}

export const credentialRepository = {
  getByProvider(provider: string): CredentialRecord | undefined {
    return db.prepare('SELECT * FROM credentials WHERE provider = ?').get(provider) as CredentialRecord | undefined;
  },

  upsert(provider: string, encryptedValue: string, keyVersion: number): void {
    const existing = db.prepare('SELECT provider FROM credentials WHERE provider = ?').get(provider);
    if (existing) {
      db.prepare(`
        UPDATE credentials SET encrypted_value = ?, key_version = ?, updated_at = datetime('now','localtime')
        WHERE provider = ?
      `).run(encryptedValue, keyVersion, provider);
    } else {
      db.prepare(`
        INSERT INTO credentials (provider, encrypted_value, key_version) VALUES (?, ?, ?)
      `).run(provider, encryptedValue, keyVersion);
    }
  },

  deleteByProvider(provider: string): void {
    db.prepare('DELETE FROM credentials WHERE provider = ?').run(provider);
  },

  listAll(): CredentialRecord[] {
    return db.prepare('SELECT * FROM credentials ORDER BY provider ASC').all() as CredentialRecord[];
  },

  listByKeyVersion(version: number): Array<{ provider: string; encrypted_value: string }> {
    return db.prepare('SELECT provider, encrypted_value FROM credentials WHERE key_version = ? OR key_version IS NULL')
      .all(version) as Array<{ provider: string; encrypted_value: string }>;
  },

  updateRotation(provider: string, encryptedValue: string, keyVersion: number): void {
    db.prepare("UPDATE credentials SET encrypted_value = ?, key_version = ?, updated_at = datetime('now','localtime') WHERE provider = ?")
      .run(encryptedValue, keyVersion, provider);
  },

  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM credentials').get() as { count: number };
    return row.count;
  },
};
