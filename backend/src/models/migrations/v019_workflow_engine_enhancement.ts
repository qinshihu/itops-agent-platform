/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

const v018WorkflowEngineEnhancement: Migration = {
  id: '20260617000018',
  version: 18,
  name: 'workflow_engine_enhancement',
  description: 'Workflow engine enhancement: execution variables snapshot, parallel branches state, loop iterations tracking, execution logs',
  
  up: async (db: any) => {
    // 1. 扩展 tasks 表，支持工作流引擎增强功能
    db.exec(`
      -- 执行上下文变量快照（JSON 格式，用于审批恢复和调试）
      ALTER TABLE tasks ADD COLUMN execution_variables TEXT;
      
      -- 并行分支执行状态（JSON 格式，记录各分支执行进度）
      ALTER TABLE tasks ADD COLUMN parallel_branches TEXT;
      
      -- 循环迭代记录（JSON 格式，记录每次迭代的输入输出）
      ALTER TABLE tasks ADD COLUMN loop_iterations TEXT;
      
      -- 父任务ID（用于子工作流关联）
      ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;
      
      -- 执行深度（防止无限递归，默认 0）
      ALTER TABLE tasks ADD COLUMN execution_depth INTEGER DEFAULT 0;
      
      -- 创建索引优化查询
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_execution_depth ON tasks(execution_depth);
    `);

    // 2. 创建工作流执行日志表（详细记录每个节点的执行过程）
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        
        -- 循环迭代相关
        iteration_index INTEGER,           -- 循环迭代序号（从 0 开始）
        iteration_total INTEGER,           -- 循环总次数（如果已知）
        
        -- 并行分支相关
        branch_id TEXT,                     -- 并行分支 ID
        branch_total INTEGER,               -- 并行分支总数
        
        -- 变量快照（JSON 格式）
        input_variables TEXT,               -- 输入变量快照
        output_variables TEXT,              -- 输出变量快照
        
        -- 执行状态
        status TEXT NOT NULL,               -- pending / running / success / failed / skipped
        error_message TEXT,                 -- 错误信息
        
        -- 时间戳
        started_at TEXT,
        completed_at TEXT,
        duration_ms INTEGER,                -- 执行耗时（毫秒）
        
        -- 元数据
        metadata TEXT,                      -- 额外元数据（JSON 格式）
        
        -- 外键约束
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 创建索引优化查询
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_task ON workflow_execution_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_node ON workflow_execution_logs(node_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_status ON workflow_execution_logs(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_started ON workflow_execution_logs(started_at DESC);
      
      -- 复合索引：查询某个任务的某个节点的执行历史
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_task_node ON workflow_execution_logs(task_id, node_id);
      
      -- 复合索引：查询某个任务的循环迭代记录
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_task_iteration ON workflow_execution_logs(task_id, iteration_index);
    `);

    // 3. 创建变量传递追踪表（可选，用于可视化变量流转）
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_variable_transfers (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        source_node_id TEXT,                -- 来源节点 ID（null 表示初始变量）
        target_node_id TEXT,                -- 目标节点 ID
        variable_name TEXT NOT NULL,         -- 变量名
        variable_value TEXT,                 -- 变量值（JSON 格式）
        transfer_type TEXT NOT NULL,         -- output_mapping / input_mapping / condition / loop
        created_at TEXT DEFAULT (datetime('now','localtime')),
        
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_variable_transfers_task ON workflow_variable_transfers(task_id);
      CREATE INDEX IF NOT EXISTS idx_variable_transfers_source ON workflow_variable_transfers(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_variable_transfers_target ON workflow_variable_transfers(target_node_id);
    `);
  },
  
  down: async (db: any) => {
    // 删除新增表和字段
    db.exec(`
      -- 删除新增的表
      DROP TABLE IF EXISTS workflow_variable_transfers;
      DROP TABLE IF EXISTS workflow_execution_logs;
      
      -- 删除 tasks 表新增的字段（SQLite 不支持 DROP COLUMN，需要重建表）
      -- 注意：这里简化处理，实际生产环境需要更复杂的表重建逻辑
      -- 如果需要完整回滚，应该：
      -- 1. 创建临时表（不含新字段）
      -- 2. 复制数据到临时表
      -- 3. 删除原表
      -- 4. 重命名临时表为原表名
      
      -- 简化处理：只删除索引，保留字段（避免数据丢失）
      DROP INDEX IF EXISTS idx_tasks_parent_task;
      DROP INDEX IF EXISTS idx_tasks_execution_depth;
    `);
  }
};

export default v018WorkflowEngineEnhancement;
