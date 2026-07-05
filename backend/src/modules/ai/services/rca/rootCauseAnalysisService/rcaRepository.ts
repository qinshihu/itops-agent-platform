// eslint-disable-next-line no-restricted-imports
import db from '../../../../../models/database';
import { randomUUID } from 'crypto';
import { logger } from '../../../../../utils/logger';
import type { Statement } from 'better-sqlite3';
import type { RootCauseAnalysis, CreateRCAInput, UpdateRCAInput, StatementNoParams } from './rcaTypes';

class RcaRepository {
  private createRCAs: Statement<[string, string | null, string, string | null, string, string, string, string, string]> | null = null;
  private updateRCAs: Statement<[string | undefined, string | undefined, string | undefined, string | undefined, string | undefined, string | undefined, string | undefined, string | undefined, string | undefined, string]> | null = null;
  private getRCAs: StatementNoParams | null = null;
  private getRCAById: Statement<[string]> | null = null;
  private getByAlertId: Statement<[string]> | null = null;
  private deleteRCA: Statement<[string]> | null = null;

  constructor() {
    // 延迟初始化，等待数据库准备好
  }

  init() {
    try {
      this.initializeStatements();
    } catch {
      logger.error("⚠️  RootCauseAnalysisService initialization failed");
    }
  }

  private initializeStatements() {
    try {
      this.createRCAs = db.prepare(`
        INSERT INTO root_cause_analyses (id, alert_id, title, description, status, symptoms, timeline, evidence, recommendations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
      `);

      this.updateRCAs = db.prepare(`
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
      `);

      const getRCABase = 'SELECT * FROM root_cause_analyses';

      this.getRCAs = db.prepare(`${getRCABase} ORDER BY created_at DESC`);

      this.getRCAById = db.prepare(`${getRCABase} WHERE id = ?`);

      this.getByAlertId = db.prepare(`${getRCABase} WHERE alert_id = ?`);

      this.deleteRCA = db.prepare('DELETE FROM root_cause_analyses WHERE id = ?');
    } catch {
      logger.error("⚠️  Could not initialize RootCauseAnalysisService statements");
    }
  }

  create(input: CreateRCAInput): RootCauseAnalysis {
    const id = randomUUID();
    const status = 'pending' as const;

    if (!this.createRCAs) this.initializeStatements();
    this.createRCAs!.run(
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

    if (!this.getRCAById) this.initializeStatements();
    return this.getRCAById!.get(id) as RootCauseAnalysis;
  }

  update(id: string, input: UpdateRCAInput): RootCauseAnalysis | undefined {
    if (!this.getRCAById) this.initializeStatements();
    const existing = this.getRCAById!.get(id);
    if (!existing) {
      return undefined;
    }

    if (!this.updateRCAs) this.initializeStatements();
    this.updateRCAs!.run(
      input.title,
      input.description,
      input.status,
      input.root_cause,
      input.symptoms ? JSON.stringify(input.symptoms) : undefined,
      input.timeline ? JSON.stringify(input.timeline) : undefined,
      input.evidence ? JSON.stringify(input.evidence) : undefined,
      input.recommendations ? JSON.stringify(input.recommendations) : undefined,
      input.status,
      id
    );

    return this.getRCAById!.get(id) as RootCauseAnalysis;
  }

  list(): RootCauseAnalysis[] {
    try {
      if (!this.getRCAs) this.initializeStatements();
      return this.getRCAs!.all() as RootCauseAnalysis[];
    } catch {
      return [];
    }
  }

  get(id: string): RootCauseAnalysis | undefined {
    if (!this.getRCAById) this.initializeStatements();
    return this.getRCAById!.get(id) as RootCauseAnalysis | undefined;
  }

  getByAlert(alertId: string): RootCauseAnalysis | undefined {
    if (!this.getByAlertId) this.initializeStatements();
    return this.getByAlertId!.get(alertId) as RootCauseAnalysis | undefined;
  }

  delete(id: string): boolean {
    if (!this.deleteRCA) this.initializeStatements();
    const result = this.deleteRCA!.run(id);
    return result.changes > 0;
  }

  getStats(): {
    todayCount: number;
    avgConfidence: number;
    autoRemediations: number;
    falsePositives: number;
    totalCompleted: number;
  } {
    const _today = new Date().toISOString().split('T')[0];

    let todayCount = 0;
    let totalCompleted = 0;
    const avgConfidence = 0;
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

    // confidence 列不存在于 root_cause_analyses 表，跳过
    // 如果需要精度统计，后续迁移添加该列

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
      avgConfidence,
      autoRemediations,
      falsePositives,
      totalCompleted
    };
  }
}

export const rcaRepository = new RcaRepository();