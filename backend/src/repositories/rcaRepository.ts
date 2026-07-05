import db from '../models/database';
import { randomUUID } from 'crypto';

export interface RootCauseAnalysis {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string;
  timeline?: string;
  evidence?: string;
  recommendations?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateRCAInput {
  alert_id?: string;
  title: string;
  description?: string;
}

export interface UpdateRCAInput {
  title?: string;
  description?: string;
  status?: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string[];
  timeline?: Array<{ time: string; event: string }>;
  evidence?: string[];
  recommendations?: string[];
}

export const rcaRepository = {
  create(input: CreateRCAInput): RootCauseAnalysis {
    const id = randomUUID();
    const status = 'pending' as const;

    db.prepare(`
      INSERT INTO root_cause_analyses (id, alert_id, title, description, status, symptoms, timeline, evidence, recommendations, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      id,
      input.alert_id || null,
      input.title,
      input.description || null,
      status,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([])
    );

    return db.prepare('SELECT * FROM root_cause_analyses WHERE id = ?').get(id) as RootCauseAnalysis;
  },

  update(id: string, input: UpdateRCAInput): RootCauseAnalysis | undefined {
    const existing = db.prepare('SELECT * FROM root_cause_analyses WHERE id = ?').get(id) as RootCauseAnalysis | undefined;
    if (!existing) return undefined;

    db.prepare(`
      UPDATE root_cause_analyses
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          root_cause = COALESCE(?, root_cause),
          symptoms = COALESCE(?, symptoms),
          timeline = COALESCE(?, timeline),
          evidence = COALESCE(?, evidence),
          recommendations = COALESCE(?, recommendations),
          updated_at = datetime('now','localtime'),
          completed_at = CASE WHEN ? = 'completed' THEN datetime('now','localtime') ELSE completed_at END
      WHERE id = ?
    `).run(
      input.title ?? null,
      input.description ?? null,
      input.status ?? null,
      input.root_cause ?? null,
      input.symptoms ? JSON.stringify(input.symptoms) : null,
      input.timeline ? JSON.stringify(input.timeline) : null,
      input.evidence ? JSON.stringify(input.evidence) : null,
      input.recommendations ? JSON.stringify(input.recommendations) : null,
      input.status ?? null,
      id
    );

    return db.prepare('SELECT * FROM root_cause_analyses WHERE id = ?').get(id) as RootCauseAnalysis;
  },

  list(): RootCauseAnalysis[] {
    try {
      return db.prepare('SELECT * FROM root_cause_analyses ORDER BY created_at DESC').all() as RootCauseAnalysis[];
    } catch {
      return [];
    }
  },

  getById(id: string): RootCauseAnalysis | undefined {
    return db.prepare('SELECT * FROM root_cause_analyses WHERE id = ?').get(id) as RootCauseAnalysis | undefined;
  },

  getByAlertId(alertId: string): RootCauseAnalysis | undefined {
    return db.prepare('SELECT * FROM root_cause_analyses WHERE alert_id = ?').get(alertId) as RootCauseAnalysis | undefined;
  },

  deleteById(id: string): boolean {
    const result = db.prepare('DELETE FROM root_cause_analyses WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getStats(): {
    todayCount: number;
    avgConfidence: number;
    autoRemediations: number;
    falsePositives: number;
    totalCompleted: number;
  } {
    let todayCount = 0;
    let totalCompleted = 0;
    let autoRemediations = 0;
    let falsePositives = 0;

    try {
      const todayResult = db.prepare(
        "SELECT COUNT(*) as count FROM root_cause_analyses WHERE created_at >= DATE('now', 'localtime')"
      ).get() as { count: number };
      todayCount = todayResult.count;
    } catch { /* 表可能不存在 */ }

    try {
      const totalResult = db.prepare(
        "SELECT COUNT(*) as count FROM root_cause_analyses WHERE status = 'completed'"
      ).get() as { count: number };
      totalCompleted = totalResult.count;
    } catch { /* ignore */ }

    try {
      const autoRemediationResult = db.prepare(
        "SELECT COUNT(*) as count FROM root_cause_analyses WHERE status = 'completed' AND recommendations LIKE '%自动%'"
      ).get() as { count: number };
      autoRemediations = autoRemediationResult.count;
    } catch { /* ignore */ }

    try {
      const falsePositiveResult = db.prepare(
        "SELECT COUNT(*) as count FROM root_cause_analyses WHERE status = 'completed' AND root_cause LIKE '%误报%'"
      ).get() as { count: number };
      falsePositives = falsePositiveResult.count;
    } catch { /* ignore */ }

    return {
      todayCount,
      avgConfidence: 0,
      autoRemediations,
      falsePositives,
      totalCompleted,
    };
  },
};