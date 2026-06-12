import { scheduleJob, Job } from 'node-schedule';
import { randomUUID } from 'crypto';
import db, { performMaintenance } from '../models/database';
import { logger } from '../utils/logger';
import { executeWorkflow } from './workflowExecutor';
import { WorkflowParsed, WorkflowNode, WorkflowEdge } from '../types';
import { serverInfoCollector } from './serverInfoCollector';

interface ScheduledTaskRecord {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  workflow_id: string;
  enabled: number;
}

class SchedulerService {
  private jobs: Map<string, Job> = new Map();
  private initialized: boolean = false;
  private runningWorkflows: Set<string> = new Set();
  private runningTasks: Set<string> = new Set();

  constructor() {
    // 延迟初始化，等待数据库准备好
  }

  init() {
    if (this.initialized) return;
    
    try {
      // 从数据库加载所有启用的定时任务
      const tasks = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1').all() as ScheduledTaskRecord[];
      
      tasks.forEach(task => {
        this.scheduleTask(task);
      });
      
      // 启动数据库定期维护任务
      this.initDatabaseMaintenance();
      
      // 启动服务器性能指标定期采集任务（每5分钟）
      this.initMetricsCollection();
      
      this.initialized = true;
      logger.info(`✅ Scheduler initialized with ${tasks.length} tasks`);
    } catch (e) {
      logger.info("⚠️  Could not initialize scheduler:", (e as Error).message);
    }
  }

  /**
   * 初始化数据库定期维护
   */
  private initDatabaseMaintenance() {
    // 每天凌晨3点执行数据库维护
    const maintenanceJob = scheduleJob('0 3 * * *', async () => {
      logger.info('🔧 Starting scheduled database maintenance...');
      
      try {
        // 先分析统计信息
        performMaintenance('analyze');
        
        // 检查完整性
        performMaintenance('integrity_check');
        
        // 每周日凌晨3点执行VACUUM（释放空间）
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 0) { // 周日
          performMaintenance('vacuum');
          logger.info('✅ Weekly VACUUM completed');
        }
        
        logger.info('✅ Scheduled database maintenance completed');
      } catch (error) {
        logger.error('❌ Scheduled database maintenance failed', error as Error);
      }
    });
    
    this.jobs.set('db-maintenance', maintenanceJob);
    logger.info('✅ Database maintenance scheduled: daily at 3:00 AM');
  }

  /**
   * 初始化服务器性能指标定期采集任务（每 5 分钟）
   */
  private initMetricsCollection() {
    const metricsJob = scheduleJob('*/5 * * * *', async () => {
      logger.info('📊 Starting scheduled server metrics collection...');
      
      try {
        const result = await serverInfoCollector.collectAllServerMetrics();
        logger.info(`✅ Scheduled metrics collection completed: ${result.success} success, ${result.failed} failed`);
        if (result.failed > 0) {
          logger.warn(`️ Failed metrics collection: ${JSON.stringify(result.errors)}`);
        }
      } catch (error) {
        logger.error('❌ Scheduled metrics collection failed', error as Error);
      }
    });
    
    this.jobs.set('metrics-collection', metricsJob);
    logger.info('✅ Server metrics collection scheduled: every 5 minutes');
  }

  scheduleTask(task: ScheduledTaskRecord) {
    // 先取消已存在的任务
    this.cancelTask(task.id);

    try {
      const job = scheduleJob(task.schedule, async () => {
        logger.info(`⏰ Executing scheduled task: ${task.name} (${task.id})`);
        
        if (this.runningTasks.has(task.id)) {
          logger.warn(`⚠️ Task ${task.id} is already running, skipping execution`);
          return;
        }

        let executionStatus: 'success' | 'failed' | 'timeout' = 'success';
        
        try {
          this.runningTasks.add(task.id);
          if (task.workflow_id) {
            await this.executeWorkflow(task);
          }
          
          executionStatus = 'success';
        } catch (error) {
          executionStatus = 'failed';
          logger.error(`❌ Scheduled task ${task.name} execution failed:`, error);
        } finally {
          this.runningTasks.delete(task.id);
          // 记录执行结果
          db.prepare(`
            UPDATE scheduled_tasks 
            SET last_run = datetime('now','localtime'), last_status = ? 
            WHERE id = ?
          `).run(executionStatus, task.id);

          // 记录审计日志
          db.prepare(`
            INSERT INTO audit_logs (id, action, resource_type, resource_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
          `).run(
            randomUUID(),
            'execute_scheduled_task',
            'scheduled_task',
            task.id,
            JSON.stringify({
              task_name: task.name,
              workflow_id: task.workflow_id,
              executed_at: new Date().toISOString(),
              status: executionStatus
            })
          );
        }
      });

      this.jobs.set(task.id, job);
      
      // 计算下次执行时间
      const nextRun = job.nextInvocation();
      if (nextRun) {
        db.prepare(`
          UPDATE scheduled_tasks 
          SET next_run = ? 
          WHERE id = ?
        `).run(nextRun.toISOString(), task.id);
      }

    } catch (error: unknown) {
      logger.error(`❌ Failed to schedule task ${task.name}:`, error);
    }
  }

  async executeWorkflow(task: ScheduledTaskRecord) {
    try {
      const workflowId = task.workflow_id;
      
      // 防止同一工作流并发执行
      if (this.runningWorkflows.has(workflowId)) {
        logger.warn(`⚠️ Workflow ${workflowId} is already running, skipping execution`);
        throw new Error(`Workflow ${workflowId} is already running`);
      }
      
      this.runningWorkflows.add(workflowId);

      // 获取工作流信息
      const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as {
        id: string;
        name: string;
        description: string;
        nodes: string;
        edges: string;
        agent_configs: string;
        is_template: number;
        created_at: string;
        updated_at: string;
      } | undefined;
      
      if (!workflow) {
        const error = new Error(`Workflow ${workflowId} not found for scheduled task ${task.name}`);
        logger.error(error.message);
        throw error;
      }

      // 创建任务执行记录
      const taskId = randomUUID();
      db.prepare(`
        INSERT INTO tasks (id, workflow_id, name, status, created_at)
        VALUES (?, ?, ?, 'pending', datetime('now','localtime'))
      `).run(taskId, workflowId, `定时执行: ${workflow.name}`);

      logger.info(`✅ Created task ${taskId} for workflow ${workflow.name}`);
      
      // 解析工作流数据
      const parsedWorkflow: WorkflowParsed = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        nodes: typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) as WorkflowNode[] : workflow.nodes,
        edges: typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) as WorkflowEdge[] : workflow.edges,
        agent_configs: workflow.agent_configs ? (typeof workflow.agent_configs === 'string' ? JSON.parse(workflow.agent_configs) as Record<string, unknown> : workflow.agent_configs) : {},
        is_template: workflow.is_template,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      };
      
      // 真正执行工作流
      await executeWorkflow(taskId, parsedWorkflow);
      
    } catch (error: unknown) {
      logger.error(`❌ Error executing scheduled workflow:`, error);
      throw error;
    } finally {
      this.runningWorkflows.delete(task.workflow_id);
    }
  }

  cancelTask(taskId: string) {
    const job = this.jobs.get(taskId);
    if (job) {
      job.cancel();
      this.jobs.delete(taskId);
      logger.info(`⏹️ Cancelled scheduled task: ${taskId}`);
    }
  }

  updateTask(task: ScheduledTaskRecord) {
    if (task.enabled) {
      this.scheduleTask(task);
    } else {
      this.cancelTask(task.id);
    }
  }

  deleteTask(taskId: string) {
    this.cancelTask(taskId);
  }

  getNextExecution(taskId: string): Date | null {
    const job = this.jobs.get(taskId);
    if (!job) return null;
    const nextInvocation = job.nextInvocation();
    return nextInvocation as Date | null;
  }

  getRunningTasks(): string[] {
    return Array.from(this.jobs.keys());
  }

  shutdown() {
    this.jobs.forEach((job, taskId) => {
      job.cancel();
      logger.info(`⏹️ Shutdown task: ${taskId}`);
    });
    this.jobs.clear();
    this.initialized = false;
    logger.info('✅ Scheduler shutdown complete');
  }
}

export const schedulerService = new SchedulerService();
