import path from 'path';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import { reportsRepo, reportSchedulesRepo } from '../../../repositories';
import { logger } from '../../../utils/logger';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'incident' | 'inspection' | 'change';
  content: string;
  variables: string[];
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  template_id: string;
  cron_expression: string;
  enabled: boolean;
  recipients: string[];
  format: 'markdown' | 'pdf' | 'word';
  last_generated?: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: 'incident' | 'inspection' | 'change';
  content: string;
  format: 'markdown' | 'pdf' | 'word';
  metadata: Record<string, string | Record<string, string>>;
  created_at: string;
}

interface ReportTemplateDB {
  id: string;
  name: string;
  content: string;
  variables: string;
  is_preset: number;
  created_at: string;
  updated_at: string;
}

interface GeneratedReportDB {
  id: string;
  name: string;
  type: string;
  content: string;
  format: string;
  metadata: string;
  created_at: string;
}

interface ScheduledReportDB {
  id: string;
  name: string;
  template_id: string;
  cron_expression: string;
  enabled: number;
  recipients: string;
  format: string;
  last_generated: string | null;
  created_at: string;
  updated_at: string;
}

class ReportService {
  private presetTemplates: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      name: '故障报告模板',
      description: '标准故障处理报告',
      type: 'incident',
      content: `# 故障处理报告

## 基本信息
- **故障时间**: {{start_time}}
- **恢复时间**: {{end_time}}
- **故障级别**: {{severity}}
- **影响范围**: {{impact}}

## 故障描述
{{description}}

## 问题排查过程
{{troubleshooting}}

## 根因分析
{{root_cause}}

## 解决方案
{{solution}}

## 预防措施
{{prevention}}

## 附件
{{attachments}}

---
报告生成时间: {{generated_time}}
报告人: {{reporter}}`,
      variables: ['start_time', 'end_time', 'severity', 'impact', 'description', 'troubleshooting', 'root_cause', 'solution', 'prevention', 'attachments', 'generated_time', 'reporter'],
      is_preset: true
    },
    {
      name: '系统巡检报告模板',
      description: '定期系统健康检查报告',
      type: 'inspection',
      content: `# 系统巡检报告

## 巡检概览
- **巡检时间**: {{inspection_time}}
- **巡检范围**: {{scope}}
- **巡检人**: {{inspector}}

## 服务器状态
{{server_status}}

## 数据库状态
{{database_status}}

## 网络状态
{{network_status}}

## 应用状态
{{application_status}}

## 发现的问题
{{issues}}

## 改进建议
{{recommendations}}

---
报告生成时间: {{generated_time}}`,
      variables: ['inspection_time', 'scope', 'inspector', 'server_status', 'database_status', 'network_status', 'application_status', 'issues', 'recommendations', 'generated_time'],
      is_preset: true
    },
    {
      name: '变更记录模板',
      description: '系统变更操作记录',
      type: 'change',
      content: `# 变更记录

## 变更信息
- **变更时间**: {{change_time}}
- **变更类型**: {{change_type}}
- **变更人**: {{change_person}}
- **审核人**: {{reviewer}}

## 变更内容
{{content}}

## 变更原因
{{reason}}

## 变更影响
{{impact}}

## 回滚方案
{{rollback}}

## 执行结果
{{result}}

---
报告生成时间: {{generated_time}}`,
      variables: ['change_time', 'change_type', 'change_person', 'reviewer', 'content', 'reason', 'impact', 'rollback', 'result', 'generated_time'],
      is_preset: true
    }
  ];

  constructor() {
  }

  init() {
    try {
      this.initializePresetTemplates();
    } catch {
      logger.error("⚠️  ReportService initialization failed");
    }
  }

  private initializePresetTemplates() {
    try {
      const existingCount = reportsRepo.countPresetTemplates();
      if (existingCount === 0) {
        for (const template of this.presetTemplates) {
          reportsRepo.create({
            id: randomUUID(),
            name: template.name,
            type: 'template',
            content: template.content,
            variables: JSON.stringify(template.variables),
            is_preset: 1,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch {
      logger.error("⚠️  Could not initialize report templates");
    }
  }

  getTemplates(): ReportTemplate[] {
    const templates = reportsRepo.listTemplates() as ReportTemplateDB[];
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: '',
      type: 'inspection' as ReportTemplate['type'],
      content: t.content,
      variables: JSON.parse(t.variables || '[]'),
      is_preset: Boolean(t.is_preset),
      created_at: t.created_at,
      updated_at: t.updated_at
    }));
  }

  getTemplate(id: string): ReportTemplate | null {
    const template = reportsRepo.getTemplateById(id) as ReportTemplateDB | undefined;
    if (!template) return null;
    return {
      id: template.id,
      name: template.name,
      description: '',
      type: 'inspection' as ReportTemplate['type'],
      content: template.content,
      variables: JSON.parse(template.variables || '[]'),
      is_preset: Boolean(template.is_preset),
      created_at: template.created_at,
      updated_at: template.updated_at
    };
  }

  createTemplate(template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>): ReportTemplate {
    const id = randomUUID();
    const now = new Date().toISOString();
    reportsRepo.create({
      id,
      name: template.name,
      type: 'template',
      content: template.content,
      variables: JSON.stringify(template.variables),
      is_preset: template.is_preset ? 1 : 0,
      created_at: now,
    });
    return this.getTemplate(id)!;
  }

  updateTemplate(id: string, template: Partial<Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>>): ReportTemplate | null {
    const existing = this.getTemplate(id);
    if (!existing) return null;

    const updates: Record<string, string> = {};
    if (template.name !== undefined) { updates.name = template.name; }
    if (template.content !== undefined) { updates.content = template.content; }
    if (template.variables !== undefined) { updates.variables = JSON.stringify(template.variables); }

    if (Object.keys(updates).length > 0) {
      reportsRepo.updateTemplate(id, updates);
    }
    return this.getTemplate(id);
  }

  deleteTemplate(id: string): boolean {
    return reportsRepo.deleteTemplate(id) > 0;
  }

  generateReport(templateId: string, variables: Record<string, string>, format: 'markdown' | 'pdf' | 'word' = 'markdown'): GeneratedReport {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error('模板不存在');
    }

    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    reportsRepo.create({
      id,
      name: `${template.name} - ${new Date().toLocaleString()}`,
      type: 'generated',
      content,
      format,
      metadata: JSON.stringify({ templateId, variables }),
      variables: JSON.stringify(variables),
      created_at: now,
    });

    return {
      id,
      name: `${template.name} - ${new Date().toLocaleString()}`,
      type: template.type,
      content,
      format,
      metadata: { templateId, variables },
      created_at: now
    };
  }

  getReports(limit = 20): GeneratedReport[] {
    const reports = reportsRepo.listGenerated(limit) as GeneratedReportDB[];
    
    return reports.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type as GeneratedReport['type'],
      content: r.content,
      format: r.format as GeneratedReport['format'],
      metadata: JSON.parse(r.metadata || '{}'),
      created_at: r.created_at
    }));
  }

  getReport(id: string): GeneratedReport | null {
    const report = reportsRepo.getGeneratedById(id) as GeneratedReportDB | undefined;
    if (!report) return null;
    
    return {
      id: report.id,
      name: report.name,
      type: report.type as GeneratedReport['type'],
      content: report.content,
      format: report.format as GeneratedReport['format'],
      metadata: JSON.parse(report.metadata || '{}'),
      created_at: report.created_at
    };
  }

  getScheduledReports(): ScheduledReport[] {
    const reports = reportSchedulesRepo.list() as ScheduledReportDB[];
    return reports.map(r => ({
      id: r.id,
      name: r.name,
      template_id: r.template_id,
      cron_expression: r.cron_expression,
      recipients: JSON.parse(r.recipients || '[]'),
      format: r.format as ScheduledReport['format'],
      enabled: Boolean(r.enabled),
      last_generated: r.last_generated || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  createScheduledReport(report: Omit<ScheduledReport, 'id' | 'created_at' | 'updated_at'>): ScheduledReport {
    const id = randomUUID();
    const now = new Date().toISOString();
    reportSchedulesRepo.create({
      id,
      name: report.name,
      template_id: report.template_id,
      cron_expression: report.cron_expression,
      enabled: report.enabled ? 1 : 0,
      recipients: JSON.stringify(report.recipients),
      format: report.format,
      created_at: now,
      updated_at: now,
    });
    return this.getScheduledReport(id)!;
  }

  getScheduledReport(id: string): ScheduledReport | null {
    const report = reportSchedulesRepo.getById(id) as ScheduledReportDB | undefined;
    if (!report) return null;
    return {
      id: report.id,
      name: report.name,
      template_id: report.template_id,
      cron_expression: report.cron_expression,
      recipients: JSON.parse(report.recipients || '[]'),
      format: report.format as ScheduledReport['format'],
      enabled: Boolean(report.enabled),
      last_generated: report.last_generated || undefined,
      created_at: report.created_at,
      updated_at: report.updated_at
    };
  }

  updateScheduledReport(id: string, report: Partial<Omit<ScheduledReport, 'id' | 'created_at' | 'updated_at'>>): ScheduledReport | null {
    const existing = this.getScheduledReport(id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    if (report.name !== undefined) { updates.name = report.name; }
    if (report.template_id !== undefined) { updates.template_id = report.template_id; }
    if (report.cron_expression !== undefined) { updates.cron_expression = report.cron_expression; }
    if (report.enabled !== undefined) { updates.enabled = report.enabled ? 1 : 0; }
    if (report.recipients !== undefined) { updates.recipients = JSON.stringify(report.recipients); }
    if (report.format !== undefined) { updates.format = report.format; }

    if (Object.keys(updates).length > 0) {
      reportSchedulesRepo.update(id, updates);
    }
    return this.getScheduledReport(id);
  }

  deleteScheduledReport(id: string): boolean {
    return reportSchedulesRepo.delete(id) > 0;
  }

  async exportReport(reportId: string, format: 'pdf' | 'word' | 'markdown' = 'markdown'): Promise<{ content: string | Buffer, type: string }> {
    const report = this.getReport(reportId);
    if (!report) {
      throw new Error('报告不存在');
    }

    if (format === 'pdf') {
      const pdf = new PDFDocument({ margin: 50, info: { Title: report.name } });

      // 注册中文字体
      const fontPath = path.join(__dirname, '..', '..', 'src', 'assets', 'fonts', 'NotoSansSC-Regular.ttf');
      pdf.registerFont('CJK', fontPath);

      const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdf.on('end', () => {});

      // 标题
      pdf.fontSize(18).font('CJK').text(report.name, { align: 'center' });
      pdf.moveDown(0.5);
      pdf.fontSize(9).font('CJK').fillColor('#666666')
        .text(`生成时间: ${report.created_at || new Date().toLocaleString('zh-CN')}`, { align: 'center' });
      pdf.moveDown(0.3);
      pdf.fillColor('#cccccc').moveTo(50, pdf.y).lineTo(545, pdf.y).stroke();
      pdf.moveDown(0.5);

      // 正文内容 — 分段处理
      pdf.fillColor('#000000').fontSize(11).font('CJK');
      const lines = report.content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          pdf.fontSize(15).font('CJK');
          pdf.text(line.replace(/^# \s*/, ''), { underline: false });
          pdf.fontSize(11).font('CJK');
        } else if (line.startsWith('## ')) {
          pdf.fontSize(13).font('CJK');
          pdf.text(line.replace(/^## \s*/, ''));
          pdf.fontSize(11).font('CJK');
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          pdf.text(line.replace(/^[-*] /, '  • '));
        } else if (line.trim() === '---') {
          pdf.fillColor('#cccccc').moveTo(50, pdf.y).lineTo(545, pdf.y).stroke();
          pdf.fillColor('#000000');
        } else if (line.trim() === '') {
          pdf.moveDown(0.3);
        } else {
          pdf.text(line);
        }
      }

      // PDFDocument 是 Readable stream，需监听 'end' 事件
      const buffer = await new Promise<Buffer>((resolve) => {
        pdf.on('end', () => resolve(Buffer.concat(chunks)));
        pdf.end();
      });

      return { content: buffer, type: 'application/pdf' };
    } else if (format === 'word') {
      // Word 导出：构建 .doc 内容（Word 可打开 HTML 内容）
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${report.name}</title></head><body>
<h1>${report.name}</h1>
<hr>
<pre style="font-family: sans-serif;">${report.content.replace(/\n/g, '<br>')}</pre>
</body></html>`;
      return { content: html, type: 'application/msword' };
    }

    return {
      content: report.content,
      type: 'text/markdown'
    };
  }
}

export const reportService = new ReportService();