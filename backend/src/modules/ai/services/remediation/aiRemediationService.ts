/**
 * =============================================================================
 * ITOps Agent Platform - AI 修复服务
 * =============================================================================
 *
 * 将 AI 分析结果转化为可执行的修复工作流，并走审批流程
 *
 * 工作流结构：
 *   [审批节点] → [执行修复 Agent 节点] → [验证结果 Agent 节点]
 *
 * 流程：
 *   AI 分析完成 → 提取修复命令 → 生成临时工作流 → 执行工作流
 *   → 遇到审批节点暂停 → 等待人工审批 → 审批通过 → 执行修复命令
 *   → 验证修复结果 → 反馈通知 + 审计日志
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import db from '../../../models/database';
import { logger } from '../../../utils/logger';
import { executeWorkflow } from '../../workflow/services/workflowExecutor.ts';
import { WorkflowNode, WorkflowEdge, WorkflowParsed } from '../../../types';

interface AiRemediationInput {
  alertId: string;
  alertTitle: string;
  alertContent: string;
  alertSeverity: string;
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  deviceType: 'server' | 'network_device';
  diagnosis: string;
  remediationCommands: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface AiRemediationRecord {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  task_id: string | null;
  workflow_id: string | null;
  diagnosis: string;
  remediation_commands: string[];
  risk_level: 'low' | 'medium' | 'high';
  status: 'pending' | 'waiting_approval' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  execution_result?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

class AiRemediationService {
  private initialized = false;

  /** 初始化数据库表 */
  private ensureTable(): void {
    if (this.initialized) return;

    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_remediations (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        device_id TEXT,
        device_name TEXT,
        device_ip TEXT,
        task_id TEXT,
        workflow_id TEXT,
        diagnosis TEXT,
        remediation_commands TEXT,
        risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')),
        status TEXT CHECK(status IN ('pending', 'waiting_approval', 'approved', 'rejected', 'executing', 'completed', 'failed')),
        execution_result TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (alert_id) REFERENCES alerts(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    this.initialized = true;
    logger.info('✅ AI Remediation Service initialized');
  }

  /**
   * 根据 AI 分析结果创建修复工作流并执行
   * 这是断点连接的核心方法
   */
  async createAndExecute(input: AiRemediationInput): Promise<AiRemediationRecord | null> {
    this.ensureTable();

    const id = randomUUID();
    const now = new Date().toISOString();

    const record: AiRemediationRecord = {
      id,
      alert_id: input.alertId,
      device_id: input.deviceId,
      device_name: input.deviceName,
      device_ip: input.deviceIp,
      task_id: null,
      workflow_id: null,
      diagnosis: input.diagnosis,
      remediation_commands: input.remediationCommands,
      risk_level: input.riskLevel,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };

    try {
      // 1. 保存修复记录
      this.saveRecord(record);
      logger.info(`🔧 [AI Remediation] Created record ${id} for alert ${input.alertId}`);

      // 2. 生成修复工作流
      const { workflow, workflowParsed } = this.generateRemediationWorkflow(input, id);

      // 3. 保存工作流到数据库
      const workflowId = this.saveWorkflow(workflow);
      record.workflow_id = workflowId;
      record.workflow_id = workflowId;

      // 4. 创建任务
      const taskId = randomUUID();
      db.prepare(`
        INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
        VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
      `).run(
        taskId,
        workflowId,
        `AI 修复: ${input.alertTitle}`,
        JSON.stringify({
          alert_id: input.alertId,
          device_id: input.deviceId,
          device_ip: input.deviceIp,
          remediation_id: id,
          risk_level: input.riskLevel,
        })
      );
      record.task_id = taskId;

      // 5. 更新记录状态
      record.status = 'waiting_approval';
      this.updateRecord(record);

      // 6. 异步执行工作流（会在审批节点暂停）
      setImmediate(async () => {
        try {
          await executeWorkflow(taskId, workflowParsed, undefined, {
            alert_id: input.alertId,
            device_id: input.deviceId,
            device_ip: input.deviceIp,
            remediation_id: id,
            risk_level: input.riskLevel,
          });
        } catch (err) {
          logger.error(`[AI Remediation] Workflow execution failed:`, err);
          record.status = 'failed';
          record.error_message = err instanceof Error ? err.message : String(err);
          this.updateRecord(record);
        }
      });

      logger.info(`✅ [AI Remediation] Workflow created and executing: taskId=${taskId}, workflowId=${workflowId}`);
      return record;

    } catch (err) {
      logger.error(`[AI Remediation] Failed to create remediation:`, err);
      record.status = 'failed';
      record.error_message = err instanceof Error ? err.message : String(err);
      this.updateRecord(record);
      return record;
    }
  }

  /**
   * 生成修复工作流
   * 结构：[审批节点] → [执行修复 Agent 节点] → [验证结果 Agent 节点]
   *       [回滚节点]（断开连接，验证失败时由 finalizeWorkflow 自动触发）
   */
  private generateRemediationWorkflow(
    input: AiRemediationInput,
    remediationId: string
  ): { workflow: any; workflowParsed: WorkflowParsed } {
    const approvalNodeId = randomUUID();
    const executionNodeId = randomUUID();
    const verificationNodeId = randomUUID();
    const rollbackNodeId = randomUUID();

    // 审批节点配置
    const timeoutSeconds = input.riskLevel === 'high' ? 7200 : input.riskLevel === 'medium' ? 3600 : 1800;

    // 构建修复命令的 prompt
    const commandsText = input.remediationCommands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');
    const executionPrompt = `你是一个运维执行专家。请在设备 ${input.deviceName}(${input.deviceIp}) 上执行以下修复命令：

${commandsText}

执行要求：
1. 按顺序执行每个命令
2. 每个命令执行后检查返回码
3. 如果命令失败，记录错误信息但继续执行后续命令
4. 最后汇总执行结果

告警信息：
- 告警标题: ${input.alertTitle}
- 告警级别: ${input.alertSeverity}
- 风险等级: ${input.riskLevel}

AI 诊断结果：
${input.diagnosis.substring(0, 1000)}

请开始执行修复命令。`;

    // 验证节点 prompt：根据修复命令生成对应的验证逻辑
    const verificationPrompt = this.generateVerificationPrompt(input, commandsText);

    // 回滚节点 prompt：生成修复命令的逆向操作
    const rollbackPrompt = this.generateRollbackPrompt(input, commandsText);

    // 节点定义
    const nodes: WorkflowNode[] = [
      {
        id: approvalNodeId,
        type: 'approval',
        position: { x: 100, y: 200 },
        data: {
          label: `审批修复方案 (${input.riskLevel.toUpperCase()} 风险)`,
          description: `AI 建议对 ${input.deviceName}(${input.deviceIp}) 执行修复操作，共 ${input.remediationCommands.length} 条命令`,
          approvalConfig: {
            description: `修复方案:\n${commandsText}\n\n风险等级: ${input.riskLevel}\n目标设备: ${input.deviceName}(${input.deviceIp})`,
            timeout: timeoutSeconds,
            timeoutAction: 'reject' as const,
            approvers: ['admin'],
          },
        },
      },
      {
        id: executionNodeId,
        type: 'agent',
        position: { x: 400, y: 200 },
        data: {
          label: '执行修复命令',
          agentId: 'server-command-agent',
          avatar: '🔧',
          description: '在目标设备上执行 AI 建议的修复命令',
          prompt: executionPrompt,
          inputKey: 'approval_result',
          outputKey: 'execution_result',
        },
      },
      {
        id: verificationNodeId,
        type: 'agent',
        position: { x: 700, y: 200 },
        data: {
          label: '验证修复结果',
          agentId: 'server-command-agent',
          avatar: '✅',
          description: '验证修复命令是否成功执行，检查系统状态是否恢复正常',
          prompt: verificationPrompt,
          inputKey: 'execution_result',
          outputKey: 'verification_result',
        },
      },
      {
        id: rollbackNodeId,
        type: 'agent',
        position: { x: 700, y: 400 },
        data: {
          label: '自动回滚',
          agentId: 'server-command-agent',
          avatar: '↩️',
          description: '验证失败时自动执行回滚操作，恢复系统到修复前状态',
          prompt: rollbackPrompt,
          inputKey: 'verification_result',
          outputKey: 'rollback_result',
        },
      },
    ];

    // 边定义：审批 → 执行 → 验证
    // 回滚节点断开连接，由 finalizeWorkflow 在验证失败时自动触发
    const edges: WorkflowEdge[] = [
      {
        id: `edge-${approvalNodeId}-${executionNodeId}`,
        source: approvalNodeId,
        target: executionNodeId,
        animated: true,
      },
      {
        id: `edge-${executionNodeId}-${verificationNodeId}`,
        source: executionNodeId,
        target: verificationNodeId,
        animated: true,
      },
    ];

    const workflow = {
      id: randomUUID(),
      name: `AI 修复工作流: ${input.alertTitle}`,
      description: `AI 自动生成的修复工作流，针对告警: ${input.alertTitle}`,
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      agent_configs: JSON.stringify({}),
      is_template: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const workflowParsed: WorkflowParsed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      nodes,
      edges,
      agent_configs: {},
      is_template: 0,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    };

    return { workflow, workflowParsed };
  }

  /**
   * 根据修复命令生成验证 prompt
   * 智能推断需要执行的验证命令
   */
  private generateVerificationPrompt(input: AiRemediationInput, commandsText: string): string {
    // 根据修复命令推断验证逻辑
    const verificationCmds: string[] = [];
    const lowerCmds = input.remediationCommands.map(c => c.toLowerCase());

    // 服务重启类 → 检查服务状态
    if (lowerCmds.some(c => c.includes('systemctl restart') || c.includes('service') || c.includes('restart'))) {
      const services = input.remediationCommands
        .filter(c => /systemctl\s+(restart|start|stop)/i.test(c))
        .map(c => {
          const match = c.match(/systemctl\s+(?:restart|start|stop)\s+(\S+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      for (const svc of [...new Set(services)]) {
        verificationCmds.push(`systemctl status ${svc} --no-pager`);
        verificationCmds.push(`systemctl is-active ${svc}`);
      }
      if (verificationCmds.length === 0) {
        verificationCmds.push('systemctl list-units --failed --no-pager');
      }
    }

    // 磁盘清理类 → 检查磁盘空间
    if (lowerCmds.some(c => c.includes('rm ') || c.includes('clean') || c.includes('du ') || c.includes('disk'))) {
      verificationCmds.push('df -h');
    }

    // 内存相关 → 检查内存
    if (lowerCmds.some(c => c.includes('memory') || c.includes('swap') || c.includes('oom') || c.includes('free'))) {
      verificationCmds.push('free -m');
    }

    // CPU 相关 → 检查负载
    if (lowerCmds.some(c => c.includes('cpu') || c.includes('kill') || c.includes('top') || c.includes('nice'))) {
      verificationCmds.push('uptime');
      verificationCmds.push('top -bn1 | head -5');
    }

    // 网络相关 → 检查网络连通性
    if (lowerCmds.some(c => c.includes('network') || c.includes('iptables') || c.includes('firewall') || c.includes('nginx'))) {
      verificationCmds.push('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null');
    }

    // Docker 相关 → 检查容器状态
    if (lowerCmds.some(c => c.includes('docker'))) {
      verificationCmds.push('docker ps --format "table {{.Names}}\t{{.Status}}"');
    }

    // 如果无法推断，使用通用验证
    if (verificationCmds.length === 0) {
      verificationCmds.push('uptime');
      verificationCmds.push('systemctl list-units --failed --no-pager 2>/dev/null || echo "no systemctl"');
      verificationCmds.push('dmesg -T | tail -10 2>/dev/null || echo "no dmesg"');
    }

    const verificationCmdsText = verificationCmds.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');

    return `你是一个运维验证专家。修复命令已在设备 ${input.deviceName}(${input.deviceIp}) 上执行完毕。
请执行以下验证命令，确认修复是否成功：

${verificationCmdsText}

验证要求：
1. 依次执行上述验证命令
2. 分析每条命令的输出，判断相关指标是否恢复正常
3. 对比修复前的告警信息：${input.alertTitle}
4. 输出验证结论：
   - ✅ 修复成功：指标恢复正常
   - ⚠️ 部分恢复：部分指标改善但仍有异常
   - ❌ 修复失败：指标未改善或恶化

告警原始信息：
- 告警标题: ${input.alertTitle}
- 告警级别: ${input.alertSeverity}
- 执行的修复命令:
${commandsText}

请开始验证。`;
  }

  /**
   * 根据修复命令生成回滚 prompt
   * 智能推断需要执行的回滚命令
   */
  private generateRollbackPrompt(input: AiRemediationInput, commandsText: string): string {
    const rollbackCmds: string[] = [];
    const lowerCmds = input.remediationCommands.map(c => c.toLowerCase());

    // 服务重启类 → 停止服务
    if (lowerCmds.some(c => c.includes('systemctl start') || c.includes('systemctl restart'))) {
      const services = input.remediationCommands
        .filter(c => /systemctl\s+(start|restart)/i.test(c))
        .map(c => {
          const match = c.match(/systemctl\s+(?:start|restart)\s+(\S+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      for (const svc of [...new Set(services)]) {
        rollbackCmds.push(`systemctl stop ${svc}`);
      }
    }

    // 服务停止类 → 启动服务
    if (lowerCmds.some(c => c.includes('systemctl stop'))) {
      const services = input.remediationCommands
        .filter(c => /systemctl\s+stop/i.test(c))
        .map(c => {
          const match = c.match(/systemctl\s+stop\s+(\S+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      for (const svc of [...new Set(services)]) {
        rollbackCmds.push(`systemctl start ${svc}`);
      }
    }

    // 配置备份类 → 恢复配置
    if (lowerCmds.some(c => c.includes('cp') && c.includes('.bak'))) {
      const backups = input.remediationCommands
        .filter(c => /cp\s+\S+\s+\S+\.bak/i.test(c))
        .map(c => {
          const match = c.match(/cp\s+(\S+)\s+(\S+)\.bak/i);
          return match ? { original: match[1], backup: match[2] } : null;
        })
        .filter((bk): bk is { original: string; backup: string } => bk !== null);
      for (const bk of backups) {
        rollbackCmds.push(`cp ${bk.backup}.bak ${bk.original}`);
      }
    }

    // Docker 容器类 → 停止/删除容器
    if (lowerCmds.some(c => c.includes('docker run') || c.includes('docker start'))) {
      const containers = input.remediationCommands
        .filter(c => /docker\s+(run|start)\s+.*?(-n|--name)\s+(\S+)/i.test(c))
        .map(c => {
          const match = c.match(/docker\s+(?:run|start)\s+.*?(?:-n|--name)\s+(\S+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      for (const container of [...new Set(containers)]) {
        rollbackCmds.push(`docker stop ${container}`);
        rollbackCmds.push(`docker rm ${container}`);
      }
    }

    // 防火墙规则类 → 删除规则
    if (lowerCmds.some(c => c.includes('iptables -A') || c.includes('firewall-cmd --add'))) {
      rollbackCmds.push('# 注意：防火墙规则回滚需要手动确认');
      rollbackCmds.push('iptables -L -n --line-numbers');
      rollbackCmds.push('firewall-cmd --list-all');
    }

    // 如果无法推断，提供通用回滚指导
    if (rollbackCmds.length === 0) {
      rollbackCmds.push('# 无法自动推断回滚命令，请执行以下检查：');
      rollbackCmds.push('systemctl list-units --failed --no-pager');
      rollbackCmds.push('dmesg -T | tail -20');
      rollbackCmds.push('journalctl -xe --no-pager | tail -50');
    }

    const rollbackCmdsText = rollbackCmds.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');

    return `你是一个运维回滚专家。修复命令在设备 ${input.deviceName}(${input.deviceIp}) 上执行后验证失败，需要执行回滚操作。

请执行以下回滚命令，恢复系统到修复前状态：

${rollbackCmdsText}

回滚要求：
1. 按顺序执行回滚命令
2. 每个命令执行后检查返回码
3. 如果回滚命令失败，记录错误但继续执行后续回滚
4. 最后汇总回滚结果

原始修复命令（供参考）：
${commandsText}

告警信息：
- 告警标题: ${input.alertTitle}
- 告警级别: ${input.alertSeverity}

请开始执行回滚。`;
  }

  /** 保存工作流到数据库 */
  private saveWorkflow(workflow: any): string {
    db.prepare(`
      INSERT INTO workflows (id, name, description, nodes, edges, agent_configs, is_template, created_at, updated_at)
      VALUES (@id, @name, @description, @nodes, @edges, @agent_configs, @is_template, @created_at, @updated_at)
    `).run(workflow);
    return workflow.id;
  }

  /** 保存修复记录 */
  private saveRecord(record: AiRemediationRecord): void {
    db.prepare(`
      INSERT INTO ai_remediations (
        id, alert_id, device_id, device_name, device_ip, task_id, workflow_id,
        diagnosis, remediation_commands, risk_level, status, execution_result,
        error_message, created_at, updated_at
      ) VALUES (
        @id, @alert_id, @device_id, @device_name, @device_ip, @task_id, @workflow_id,
        @diagnosis, @remediation_commands, @risk_level, @status, @execution_result,
        @error_message, @created_at, @updated_at
      )
    `).run({
      ...record,
      remediation_commands: JSON.stringify(record.remediation_commands),
    });
  }

  /** 更新修复记录 */
  private updateRecord(record: AiRemediationRecord): void {
    db.prepare(`
      UPDATE ai_remediations SET
        task_id = @task_id,
        workflow_id = @workflow_id,
        status = @status,
        execution_result = @execution_result,
        error_message = @error_message,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      ...record,
      remediation_commands: JSON.stringify(record.remediation_commands),
    });
  }

  /** 获取修复记录 */
  getRecord(id: string): AiRemediationRecord | null {
    this.ensureTable();
    const row = db.prepare('SELECT * FROM ai_remediations WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      remediation_commands: JSON.parse(row.remediation_commands || '[]'),
    };
  }

  /** 根据告警 ID 获取修复记录 */
  getByAlertId(alertId: string): AiRemediationRecord | null {
    this.ensureTable();
    const row = db.prepare('SELECT * FROM ai_remediations WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1').get(alertId) as any;
    if (!row) return null;
    return {
      ...row,
      remediation_commands: JSON.parse(row.remediation_commands || '[]'),
    };
  }

  /** 获取所有修复记录 */
  listRecords(limit: number = 50): AiRemediationRecord[] {
    this.ensureTable();
    const rows = db.prepare('SELECT * FROM ai_remediations ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => ({
      ...row,
      remediation_commands: JSON.parse(row.remediation_commands || '[]'),
    }));
  }

  /** 更新修复状态（由工作流执行器调用） */
  updateStatus(remediationId: string, status: AiRemediationRecord['status'], result?: string): void {
    this.ensureTable();
    const record = this.getRecord(remediationId);
    if (!record) return;
    record.status = status;
    if (result) record.execution_result = result;
    record.updated_at = new Date().toISOString();
    this.updateRecord(record);
  }
}

export const aiRemediationService = new AiRemediationService();
