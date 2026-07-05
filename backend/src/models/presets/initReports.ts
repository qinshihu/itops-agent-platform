import db from '../database';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export function initializePresetReportTemplates() {
  const presetTemplates = [
    {
      id: randomUUID(),
      name: '工作流执行报告',
      description: '工作流执行完成后自动生成的执行报告',
      type: 'template',
      content: '# 工作流执行报告\n\n## 基本信息\n- **工作流名称**: {{workflow_name}}\n- **执行任务ID**: {{task_id}}\n- **执行状态**: {{execution_status}}\n- **开始时间**: {{start_time}}\n- **结束时间**: {{end_time}}\n\n## 执行顺序\n{{execution_order}}\n\n## 节点执行详情\n{{node_details}}\n\n## 执行总结\n{{execution_summary}}\n\n{{error_section}}\n\n---\n报告生成时间: {{generated_time}}',
      variables: JSON.stringify(['workflow_name', 'task_id', 'execution_status', 'start_time', 'end_time', 'execution_order', 'node_details', 'execution_summary', 'error_section', 'generated_time']),
      is_preset: 1
    },
    {
      id: randomUUID(),
      name: '系统巡检报告',
      description: '服务器系统巡检的详细报告',
      type: 'template',
      content: '# 系统巡检报告\n\n## 巡检时间\n{{inspection_time}}\n\n## 目标服务器\n{{server_list}}\n\n## 巡检结果摘要\n- **检查项目总数**: {{total_checks}}\n- **通过项目**: {{passed_checks}}\n- **失败项目**: {{failed_checks}}\n- **总体状态**: {{overall_status}}\n\n## 详细检查结果\n{{detailed_results}}\n\n## 建议措施\n{{recommendations}}\n\n---\n报告生成时间: {{generated_time}}',
      variables: JSON.stringify(['inspection_time', 'server_list', 'total_checks', 'passed_checks', 'failed_checks', 'overall_status', 'detailed_results', 'recommendations', 'generated_time']),
      is_preset: 1
    }
  ];

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO reports (id, name, type, content, variables, is_preset)
    VALUES (?, ?, 'template', ?, ?, ?)
  `);

  presetTemplates.forEach(template => {
    insertTemplate.run(template.id, template.name, template.content, template.variables, template.is_preset);
  });

  logger.info(`✅ 成功创建 ${presetTemplates.length} 个预设报告模板`);
}
