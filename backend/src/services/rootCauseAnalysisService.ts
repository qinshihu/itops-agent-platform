import db from '../models/database';
import { randomUUID } from 'crypto';
import { generateCompletion } from './llmService';
import { localRuleEngine } from './localRuleEngine';
import { logger } from '../utils/logger';
import type { Statement } from 'better-sqlite3';
import { topologyService } from './topologyService';
import { changeService } from './changeService';
import EnhancedRAGService from './enhancedRAGService';
import { RCA_PROMPT } from '../prompts/rcaPrompt';

const ragService = new EnhancedRAGService();

type StatementNoParams = Statement<[]>;

interface RootCauseAnalysis {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string; // JSON array
  timeline?: string; // JSON array
  evidence?: string; // JSON array
  recommendations?: string; // JSON array
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface CreateRCAInput {
  alert_id?: string;
  title: string;
  description?: string;
}

interface UpdateRCAInput {
  title?: string;
  description?: string;
  status?: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string[];
  timeline?: Array<{ time: string; event: string }>;
  evidence?: string[];
  recommendations?: string[];
}

class RootCauseAnalysisService {
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
      console.error("⚠️  Could not initialize RootCauseAnalysisService statements");
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

  async analyzeByAlert(alertId: string, alertTitle: string, alertContent: string): Promise<RootCauseAnalysis | undefined> {
    const rca = this.create({
      alert_id: alertId,
      title: `自动根因分析: ${alertTitle}`,
      description: alertContent
    });

    return this.analyze(rca.id);
  }

  async analyze(id: string): Promise<RootCauseAnalysis | undefined> {
    if (!this.getRCAById) this.initializeStatements();
    const existing = this.getRCAById!.get(id) as RootCauseAnalysis;
    if (!existing) {
      return undefined;
    }

    this.update(id, { status: 'analyzing' });

    try {
      let analysisResult;

      try {
        analysisResult = await this.performLLMAnalysis(existing);
      } catch (llmError) {
        logger.info(`🔄 [RCA] LLM analysis failed, falling back to local rule engine: ${(llmError as Error).message}`);
        try {
          analysisResult = this.performRuleEngineAnalysis(existing);
        } catch (ruleError) {
          logger.warn(`⚠️ [RCA] Rule engine also failed: ${(ruleError as Error).message}, using default fallback`);
          analysisResult = this.generateFallbackAnalysis(existing);
        }
      }

      return this.update(id, analysisResult);
    } catch (error) {
      this.update(id, { status: 'failed' });
      throw error;
    }
  }

  private performRuleEngineAnalysis(rca: RootCauseAnalysis): UpdateRCAInput {
    let alertInfo = { title: rca.title, content: rca.description || '' };

    if (rca.alert_id) {
      const alert = db.prepare('SELECT title, content FROM alerts WHERE id = ?').get(rca.alert_id) as {
        title: string;
        content: string;
      } | undefined;
      if (alert) {
        alertInfo = alert;
      }
    }

    const ruleResult = localRuleEngine.analyzeByRules(alertInfo.title, alertInfo.content);

    const timeline = ruleResult.timeline.map(t => ({ time: t.time, event: t.event }));

    return {
      status: 'completed',
      root_cause: ruleResult.rootCause,
      symptoms: ruleResult.symptoms,
      timeline,
      evidence: ruleResult.evidence,
      recommendations: ruleResult.recommendations
    };
  }

  private generateFallbackAnalysis(rca: RootCauseAnalysis): UpdateRCAInput {
    const fallbackSymptoms = [
      '需要进一步系统检查',
      '建议查看相关日志',
      '需要人工介入分析'
    ];

    const fallbackTimeline = [
      { time: new Date().toISOString().replace('T', ' ').substring(0, 19), event: '开始根因分析' },
      { time: new Date().toISOString().replace('T', ' ').substring(0, 19), event: '分析完成，需要人工验证' }
    ];

    const fallbackEvidence = [
      '需要人工收集更多证据',
      '建议查看系统日志和应用日志'
    ];

    const fallbackRecommendations = [
      '人工检查系统状态',
      '查看相关日志文件',
      '配置合适的LLM API以获得更好的分析结果'
    ];

    return {
      status: 'completed',
      root_cause: `需要人工调查 ${rca.title} 的详细原因。建议检查系统日志、监控指标和相关配置。`,
      symptoms: fallbackSymptoms,
      timeline: fallbackTimeline,
      evidence: fallbackEvidence,
      recommendations: fallbackRecommendations
    };
  }

  private async performLLMAnalysis(rca: RootCauseAnalysis): Promise<UpdateRCAInput> {
    // 获取告警信息（如果有关联告警）
    let alertInfo = '';
    if (rca.alert_id) {
      const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(rca.alert_id) as {
        title: string;
        content: string;
        severity: string;
        source: string;
      } | undefined;
      if (alert) {
        alertInfo = `
告警标题: ${alert.title}
告警内容: ${alert.content}
告警级别: ${alert.severity}
告警来源: ${alert.source}
`;
      }
    }

    const prompt = `作为专业的IT运维根因分析专家，请对以下告警进行深入的根因分析。

分析主题: ${rca.title}
${rca.description ? `问题描述: ${rca.description}` : ''}
${alertInfo}

请按照以下结构输出分析结果（JSON格式）:
{
  "root_cause": "详细的根因描述",
  "symptoms": ["症状1", "症状2", "症状3"],
  "timeline": [
    {"time": "时间", "event": "事件描述"}
  ],
  "evidence": ["证据1", "证据2"],
  "recommendations": ["建议1", "建议2", "建议3"]
}

要求：
1. root_cause: 深入分析根本原因
2. symptoms: 列出观察到的症状
3. timeline: 构建故障发生的时间线
4. evidence: 分析过程中收集的证据
5. recommendations: 提供具体的修复和预防建议`;

    try {
      const response = await generateCompletion(prompt);
      
      // 解析LLM响应
      let analysisData;
      try {
        const jsonBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
        let jsonStr: string | null = null;
        if (jsonBlockMatch) {
          jsonStr = jsonBlockMatch[1];
        } else {
          const lastBrace = response.lastIndexOf('}');
          const firstBrace = response.lastIndexOf('{', lastBrace);
          if (firstBrace !== -1 && lastBrace !== -1) {
            jsonStr = response.substring(firstBrace, lastBrace + 1);
          }
        }
        if (jsonStr) {
          analysisData = JSON.parse(jsonStr);
        } else {
          throw new Error('无法解析LLM响应');
        }
      } catch {
        analysisData = {
          root_cause: response.substring(0, 500),
          symptoms: ['系统异常'],
          timeline: [],
          evidence: [],
          recommendations: ['进一步调查']
        };
      }

      return {
        status: 'completed',
        root_cause: analysisData.root_cause,
        symptoms: analysisData.symptoms,
        timeline: analysisData.timeline,
        evidence: analysisData.evidence,
        recommendations: analysisData.recommendations
      };
    } catch (error) {
      throw new Error('LLM分析失败: ' + (error as Error).message);
    }
  }

  async autoAnalyze(alertId: string): Promise<RootCauseAnalysis | undefined> {
    try {
      logger.info(`🔍 [RCA] 开始自动根因分析: alertId=${alertId}`);
      
      const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as {
        id: string;
        title: string;
        content: string;
        severity: string;
        source: string;
        server_id?: string;
        created_at: string;
      } | undefined;

      if (!alert) {
        logger.warn(`⚠️ [RCA] 告警不存在: ${alertId}`);
        return undefined;
      }

      const context = await this.collectContext(alert);
      const analysisResult = await this.analyzeWithLLM(alert, context);

      if (!analysisResult) {
        logger.warn(`⚠️ [RCA] LLM分析返回空结果: ${alertId}`);
        return undefined;
      }

      const rca = this.create({
        alert_id: alertId,
        title: `自动根因分析: ${alert.title}`,
        description: alert.content
      });

      this.update(rca.id, {
        status: 'completed',
        ...analysisResult
      });

      logger.info(`✅ [RCA] 自动根因分析完成: rcaId=${rca.id}`);
      return this.get(rca.id);
    } catch (error) {
      logger.error(`❌ [RCA] 自动根因分析失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private safeInject(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedKey, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  async collectContext(alert: {
    id: string;
    title: string;
    content: string;
    severity: string;
    source: string;
    server_id?: string;
    created_at: string;
  }) {
    const context: Record<string, unknown> = {
      alert: {
        id: alert.id,
        title: alert.title,
        content: alert.content,
        severity: alert.severity,
        source: alert.source,
        triggered_at: alert.created_at
      },
      topology: [],
      recentChanges: [],
      relatedAlerts: [],
      serverStatus: null,
      knowledgeMatches: []
    };

    if (alert.server_id) {
      try {
        const topology = topologyService.getServerTopology(alert.server_id);
        context.topology = topology;
      } catch (error) {
        logger.warn(`⚠️ [RCA] 获取拓扑信息失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      }

      try {
        context.recentChanges = changeService.getRecentByServer(alert.server_id, 24);
      } catch (error) {
        logger.warn(`⚠️ [RCA] 获取变更记录失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      }

      try {
        context.serverStatus = db.prepare('SELECT id, name, hostname, status, os_type FROM servers WHERE id = ?').get(alert.server_id);
      } catch (error) {
        logger.warn(`⚠️ [RCA] 获取服务器状态失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    try {
      const oneHourAgo = new Date(new Date(alert.created_at).getTime() - 3600000).toISOString();
      const rawAlerts = db.prepare(
        'SELECT * FROM alerts WHERE id != ? AND created_at >= ? ORDER BY created_at DESC LIMIT 10'
      ).all(alert.id, oneHourAgo) as Array<Record<string, unknown>>;
      context.relatedAlerts = rawAlerts.map(a => {
        const alertCopy = { ...a };
        if (alertCopy.content && typeof alertCopy.content === 'string') {
          alertCopy.content = alertCopy.content.substring(0, 500);
        }
        return alertCopy;
      });
    } catch (error) {
      logger.warn(`⚠️ [RCA] 获取关联告警失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      const knowledgeResults = await ragService.search(alert.title, { limit: 5, minScore: 0.2 });
      context.knowledgeMatches = knowledgeResults.map(r => ({
        title: r.item.title,
        score: r.score,
        content: r.item.content.substring(0, 500)
      }));
    } catch (error) {
      logger.warn(`⚠️ [RCA] 知识匹配失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return context;
  }

  async analyzeWithLLM(alert: {
    id: string;
    title: string;
    content: string;
    severity: string;
  }, context: Record<string, unknown>): Promise<UpdateRCAInput | null> {
    const replacements: Record<string, string> = {
      '{alert_id}': alert.id,
      '{alert_title}': alert.title,
      '{severity}': alert.severity,
      '{alert_message}': alert.content,
      '{triggered_at}': context.alert ? (context.alert as Record<string, string>).triggered_at || '' : '',
      '{server_name}': context.serverStatus ? (context.serverStatus as Record<string, string>).name || '未知' : '未知',
      '{server_ip}': context.serverStatus ? (context.serverStatus as Record<string, string>).hostname || '未知' : '未知',
      '{server_status}': context.serverStatus ? (context.serverStatus as Record<string, string>).status || '未知' : '未知',
      '{topology_info}': JSON.stringify(context.topology, null, 2).substring(0, 2000),
      '{change_records}': JSON.stringify(context.recentChanges, null, 2).substring(0, 2000),
      '{related_alerts}': JSON.stringify(context.relatedAlerts, null, 2).substring(0, 2000),
      '{knowledge_matches}': JSON.stringify(context.knowledgeMatches, null, 2).substring(0, 2000)
    };

    const prompt = this.safeInject(RCA_PROMPT, replacements);

    try {
      const response = await generateCompletion(prompt);
      
      let analysisData;
      try {
        const jsonBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
        let jsonStr: string | null = null;
        if (jsonBlockMatch) {
          jsonStr = jsonBlockMatch[1];
        } else {
          const lastBrace = response.lastIndexOf('}');
          const firstBrace = response.lastIndexOf('{', lastBrace);
          if (firstBrace !== -1 && lastBrace !== -1) {
            jsonStr = response.substring(firstBrace, lastBrace + 1);
          }
        }
        if (jsonStr) {
          analysisData = JSON.parse(jsonStr);
        } else {
          throw new Error('无法解析LLM响应');
        }
      } catch {
        logger.warn(`⚠️ [RCA] LLM响应解析失败，使用回退分析`);
        analysisData = null;
      }

      if (!analysisData) {
        return this.generateFallbackAnalysis({
          id: '',
          alert_id: alert.id,
          title: alert.title,
          description: alert.content,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as RootCauseAnalysis);
      }

      return {
        status: 'completed',
        root_cause: analysisData.root_cause || '需要进一步调查',
        symptoms: analysisData.symptoms || ['系统异常'],
        timeline: analysisData.timeline || [],
        evidence: analysisData.evidence || [],
        recommendations: analysisData.recommendations || ['进一步调查']
      };
    } catch (error) {
      logger.error(`❌ [RCA] LLM调用失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw error;
    }
  }

  getStats(): {
    todayCount: number;
    avgConfidence: number;
    autoRemediations: number;
    falsePositives: number;
    totalCompleted: number;
  } {
    const today = new Date().toISOString().split('T')[0];
    
    let todayCount = 0;
    let totalCompleted = 0;
    let avgConfidence = 0;
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
    } catch {}

    // confidence 列不存在于 root_cause_analyses 表，跳过
    // 如果需要精度统计，后续迁移添加该列

    try {
      const autoRemediationResult = db.prepare(
        "SELECT COUNT(*) as count FROM root_cause_analyses WHERE status = 'completed' AND recommendations LIKE '%自动%'"
      ).get() as { count: number };
      autoRemediations = autoRemediationResult.count;
    } catch {}

    try {
      const falsePositiveResult = db.prepare(
        "SELECT COUNT(*) as count FROM root_cause_analyses WHERE status = 'completed' AND root_cause LIKE '%误报%'"
      ).get() as { count: number };
      falsePositives = falsePositiveResult.count;
    } catch {}

    return {
      todayCount,
      avgConfidence,
      autoRemediations,
      falsePositives,
      totalCompleted
    };
  }
}

export const rootCauseAnalysisService = new RootCauseAnalysisService();
