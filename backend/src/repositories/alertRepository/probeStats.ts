import db from '../../models/database';

export interface ProbeExecutionStatsRecord {
  probe_id: string;
  total_uses: number;
  successful_diagnoses: number;
  total_duration_ms: number;
  last_used_at: string;
  device_id: string;
  alert_type: string;
}

export const probeStatsRepo = {
  ensureTable(): void {
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS probe_execution_stats (
        probe_id TEXT PRIMARY KEY,
        total_uses INTEGER DEFAULT 0,
        successful_diagnoses INTEGER DEFAULT 0,
        total_duration_ms INTEGER DEFAULT 0,
        last_used_at TEXT,
        device_id TEXT,
        alert_type TEXT
      )`);
    } catch { /* ignore */ }
  },

  listAll(): Array<{ probe_id: string; total_uses: number; successful_diagnoses: number }> {
    return db.prepare('SELECT probe_id, total_uses, successful_diagnoses FROM probe_execution_stats')
      .all() as Array<{ probe_id: string; total_uses: number; successful_diagnoses: number }>;
  },

  recordResult(probeId: string, success: boolean, durationMs: number, deviceId?: string, alertType?: string): void {
    db.prepare(`
      INSERT INTO probe_execution_stats (probe_id, total_uses, successful_diagnoses, total_duration_ms, last_used_at, device_id, alert_type)
      VALUES (?, ?, ?, ?, datetime('now','localtime'), ?, ?)
      ON CONFLICT(probe_id) DO UPDATE SET
        total_uses = total_uses + ?,
        successful_diagnoses = successful_diagnoses + ?,
        total_duration_ms = total_duration_ms + ?,
        last_used_at = datetime('now','localtime'),
        device_id = COALESCE(excluded.device_id, device_id),
        alert_type = COALESCE(excluded.alert_type, alert_type)
    `).run(
      probeId, 1, success ? 1 : 0, durationMs, deviceId || null, alertType || null,
      1, success ? 1 : 0, durationMs
    );
  },
};
