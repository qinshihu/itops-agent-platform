import db from '../database';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export function initializePresetScheduledTasks() {
  const workflows = db.prepare('SELECT id, name FROM workflows WHERE is_template = 1').all() as Array<{ id: string; name: string }>;
  const workflowMap = new Map(workflows.map(w => [w.name, w.id]));
  
  const scheduledTasks = [
    {
      id: randomUUID(),
      name: '每日健康检查',
      description: '每天早上 8 点执行系统健康检查工作流',
      schedule: '0 8 * * *',
      enabled: 1,
      workflowName: '日常健康检查'
    },
    {
      id: randomUUID(),
      name: '每周合规检查',
      description: '每周日凌晨 2 点执行合规检查工作流',
      schedule: '0 2 * * 0',
      enabled: 1,
      workflowName: '合规检查'
    },
    {
      id: randomUUID(),
      name: '日志定期分析',
      description: '每天凌晨 3 点执行日志分析工作流',
      schedule: '0 3 * * *',
      enabled: 1,
      workflowName: '日志分析'
    },
    {
      id: randomUUID(),
      name: '数据库备份',
      description: '每天凌晨 1 点自动执行数据库备份工作流',
      schedule: '0 1 * * *',
      enabled: 1,
      workflowName: '变更执行'
    }
  ];

  const insertScheduledTask = db.prepare(`
    INSERT OR IGNORE INTO scheduled_tasks (id, name, description, schedule, enabled, workflow_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  scheduledTasks.forEach(task => {
    const workflowId = workflowMap.get(task.workflowName) || workflows[0]?.id;
    insertScheduledTask.run(task.id, task.name, task.description, task.schedule, task.enabled, workflowId);
  });

  logger.info(`✅ 成功创建 ${scheduledTasks.length} 个预设定时任务`);
}
