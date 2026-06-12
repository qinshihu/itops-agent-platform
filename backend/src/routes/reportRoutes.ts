import { Router, Request, Response } from 'express';
import db from '../models/database';
import { reportService } from '../services/reportService';

const router = Router();

router.get('/templates', (_req: Request, res: Response) => {
  try {
    const templates = reportService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/templates/:id', (req: Request, res: Response) => {
  try {
    const template = reportService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/templates', (req: Request, res: Response) => {
  try {
    const { name, description, type, content, variables } = req.body;
    const template = reportService.createTemplate({
      name,
      description,
      type,
      content,
      variables,
      is_preset: false
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/templates/:id', (req: Request, res: Response) => {
  try {
    const { name, description, content, variables } = req.body;
    const template = reportService.updateTemplate(req.params.id, {
      name,
      description,
      content,
      variables
    });
    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/templates/:id', (req: Request, res: Response) => {
  try {
    const deleted = reportService.deleteTemplate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '模板不存在或为预设模板不可删除' });
    }
    res.json({ success: true, message: '模板已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const reports = reportService.getReports(limit);
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/analytics', (_req: Request, res: Response) => {
  try {
    const alertTrends = db.prepare(`
      SELECT DATE(created_at) as date, severity, COUNT(*) as count
      FROM alerts
      WHERE created_at >= DATE('now', '-7 days', 'localtime')
      GROUP BY DATE(created_at), severity
      ORDER BY date
    `).all();

    const analysisStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM alert_auto_analysis
    `).get() || { total: 0, completed: 0, failed: 0 };

    const remediationStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'rolled_back' THEN 1 ELSE 0 END) as rolled_back
      FROM remediation_executions
      WHERE created_at >= DATE('now', '-30 days', 'localtime')
    `).get() || { total: 0, success_count: 0, failed_count: 0, rolled_back: 0 };

    const topDiagnoses = db.prepare(`
      SELECT summary, COUNT(*) as count
      FROM alert_auto_analysis
      WHERE summary IS NOT NULL AND summary != ''
      GROUP BY summary
      ORDER BY count DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: { alertTrends, analysisStats, remediationStats, topDiagnoses }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'pdf' | 'word' | 'markdown') || 'markdown';
    const exported = await reportService.exportReport(req.params.id, format);
    const report = reportService.getReport(req.params.id);
    
    const fileExtension = format === 'pdf' ? 'pdf' : format === 'word' ? 'doc' : 'md';
    res.setHeader('Content-Type', exported.type);
    // 清理文件名中的非法字符（HTTP 头不允许中文/特殊符号）
    // Content-Disposition filename 仅允许可打印 ASCII，过滤非 ASCII 和特殊字符
    let safeName = 'report';
    if (report?.name) {
      // 只保留字母、数字、点、连字符、下划线、空格
      const cleaned = report.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim().slice(0, 80);
      safeName = cleaned || 'report';
    }
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${fileExtension}"`);
    res.send(exported.content);
  } catch (error: any) {
    const errMsg = typeof error === 'object' && error !== null
      ? (error.message || String(error))
      : String(error);
    res.status(500).json({ success: false, error: errMsg });
  }
});

router.get('/scheduled/all', (_req: Request, res: Response) => {
  try {
    const reports = reportService.getScheduledReports();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const report = reportService.getReport(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/generate', (req: Request, res: Response) => {
  try {
    const { templateId, variables, format } = req.body;
    const report = reportService.generateReport(templateId, variables, format);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/scheduled/:id', (req: Request, res: Response) => {
  try {
    const report = reportService.getScheduledReport(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: '定时报告不存在' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/scheduled', (req: Request, res: Response) => {
  try {
    const { name, template_id, cron_expression, enabled, recipients, format } = req.body;
    const report = reportService.createScheduledReport({
      name,
      template_id,
      cron_expression,
      enabled: enabled !== undefined ? enabled : true,
      recipients,
      format: format || 'markdown'
    });
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/scheduled/:id', (req: Request, res: Response) => {
  try {
    const { name, template_id, cron_expression, enabled, recipients, format } = req.body;
    const report = reportService.updateScheduledReport(req.params.id, {
      name,
      template_id,
      cron_expression,
      enabled,
      recipients,
      format
    });
    if (!report) {
      return res.status(404).json({ success: false, error: '定时报告不存在' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/scheduled/:id', (req: Request, res: Response) => {
  try {
    const deleted = reportService.deleteScheduledReport(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '定时报告不存在' });
    }
    res.json({ success: true, message: '定时报告已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ── 融合分析数据（供报告使用） ──

export default router;
