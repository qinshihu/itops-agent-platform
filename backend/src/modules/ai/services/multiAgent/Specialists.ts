import { logger } from '../../../../utils/logger';
import { executeAgentNode } from '../agents/agentExecutor';
import { SpecialistBase } from './SpecialistBase';
import type {
  TaskContext,
  ExecutionResult
} from './types';
import {
  SpecialistDomain
} from './types';

/**
 * 告警处理 Specialist
 */
export class AlertHandlingSpecialist extends SpecialistBase {
  constructor() {
    super(
      '告警处理专家',
      SpecialistDomain.ALERT_HANDLING,
      {
        domain: SpecialistDomain.ALERT_HANDLING,
        skills: ['告警', 'alert', '故障', '问题', '处理', 'severity', 'critical'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的告警处理专家。你的任务是分析告警信息，评估严重程度，并提供处理建议。
请提供：
1. 告警摘要
2. 严重程度评估
3. 可能的原因
4. 处理建议
5. 后续步骤`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 故障诊断 Specialist
 */
export class FaultDiagnosisSpecialist extends SpecialistBase {
  constructor() {
    super(
      '故障诊断专家',
      SpecialistDomain.FAULT_DIAGNOSIS,
      {
        domain: SpecialistDomain.FAULT_DIAGNOSIS,
        skills: ['故障', '诊断', 'root cause', '排查', '原因', '问题'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的故障诊断专家。你的任务是分析系统故障症状，识别可能的根因，并提供详细的排查步骤和解决方案。
请提供：
1. 症状分析
2. 可能的原因
3. 排查步骤
4. 建议的解决方案`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 日志分析 Specialist
 */
export class LogAnalysisSpecialist extends SpecialistBase {
  constructor() {
    super(
      '日志分析专家',
      SpecialistDomain.LOG_ANALYSIS,
      {
        domain: SpecialistDomain.LOG_ANALYSIS,
        skills: ['日志', 'log', '日志分析', 'error', '异常', '日志查询'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的日志分析专家。你的任务是分析系统和应用日志，识别错误模式、异常事件和性能问题。
请提供：
1. 日志摘要
2. 发现的问题
3. 错误模式
4. 建议的后续分析步骤`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 系统巡检 Specialist
 */
export class SystemInspectionSpecialist extends SpecialistBase {
  constructor() {
    super(
      '系统巡检专家',
      SpecialistDomain.SYSTEM_INSPECTION,
      {
        domain: SpecialistDomain.SYSTEM_INSPECTION,
        skills: ['巡检', '检查', '健康', '健康检查', 'system', 'inspection', '健康状态'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的系统巡检专家。你的任务是分析系统各项指标，评估整体健康状态，并提供优化建议。
请提供：
1. 资源使用情况
2. 服务状态
3. 发现的问题
4. 优化建议`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      // 尝试使用原有的 Agent 执行
      const response = await executeAgentNode('auto-inspection-agent', context.input, context.metadata);

      return this.buildResult(true, response, {
        duration: Date.now() - startTime,
        confidence: 0.9,
        metadata: { taskId: context.taskId }
      });
    } catch (error) {
      return this.buildResult(false, '', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }
}

/**
 * 变更执行 Specialist
 */
export class ChangeExecutionSpecialist extends SpecialistBase {
  constructor() {
    super(
      '变更执行专家',
      SpecialistDomain.CHANGE_EXECUTION,
      {
        domain: SpecialistDomain.CHANGE_EXECUTION,
        skills: ['变更', '执行', '操作', 'deploy', 'change', '操作执行'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的变更执行专家。你的任务是执行系统变更操作，并验证操作结果。
请提供：
1. 操作摘要
2. 执行结果
3. 验证结果
4. 回滚方案（如果需要）`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 文档生成 Specialist
 */
export class DocumentGenerationSpecialist extends SpecialistBase {
  constructor() {
    super(
      '文档生成专家',
      SpecialistDomain.DOCUMENT_GENERATION,
      {
        domain: SpecialistDomain.DOCUMENT_GENERATION,
        skills: ['文档', '报告', '生成', 'summary', '总结', '文档生成'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的文档生成专家。你的任务是根据任务执行结果，生成结构化的运维报告。
请使用 Markdown 格式，包含：
1. 执行摘要
2. 详细结果
3. 发现的问题
4. 建议措施`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 合规检查 Specialist
 */
export class ComplianceCheckSpecialist extends SpecialistBase {
  constructor() {
    super(
      '合规检查专家',
      SpecialistDomain.COMPLIANCE_CHECK,
      {
        domain: SpecialistDomain.COMPLIANCE_CHECK,
        skills: ['合规', '安全', '基线', 'compliance', 'security', '合规检查'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的合规检查专家。你的任务是验证系统配置是否符合安全基线和合规要求。
请提供：
1. 检查范围
2. 合规情况
3. 不符合项
4. 修复建议`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 服务器操作 Specialist
 */
export class ServerOperationSpecialist extends SpecialistBase {
  constructor() {
    super(
      '服务器操作专家',
      SpecialistDomain.SERVER_OPERATION,
      {
        domain: SpecialistDomain.SERVER_OPERATION,
        skills: ['服务器', 'server', '命令', 'ssh', '执行', '操作'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的服务器操作专家。你的任务是在目标服务器上执行命令，并分析结果。`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      const response = await executeAgentNode('server-command-agent', context.input, context.metadata);

      return this.buildResult(true, response, {
        duration: Date.now() - startTime,
        confidence: 0.9,
        metadata: { taskId: context.taskId }
      });
    } catch (error) {
      return this.buildResult(false, '', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }
}

/**
 * 命令生成 Specialist
 */
export class CommandGenerationSpecialist extends SpecialistBase {
  constructor() {
    super(
      '命令生成专家',
      SpecialistDomain.COMMAND_GENERATION,
      {
        domain: SpecialistDomain.COMMAND_GENERATION,
        skills: ['命令', '生成', 'command', '脚本', 'shell', '命令生成'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的运维命令生成专家。你的任务是根据用户的自然语言描述和目标服务器信息，生成可以在服务器上直接执行的命令。
请返回 JSON 格式：
{
  "command": "命令内容",
  "explanation": "命令解释和注意事项"
}`,
      0.3
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 网络巡检 Specialist
 */
export class NetworkInspectionSpecialist extends SpecialistBase {
  constructor() {
    super(
      '网络巡检专家',
      SpecialistDomain.NETWORK_INSPECTION,
      {
        domain: SpecialistDomain.NETWORK_INSPECTION,
        skills: ['网络', 'network', '交换机', '路由器', '网络巡检', '网络设备'],
        confidenceThreshold: 0.4
      },
      `你是一个专业的网络设备巡检专家。你的任务是对路由器、交换机、防火墙等网络设备执行健康检查和诊断。
请提供：
1. 巡检结果
2. 状态评估
3. 问题发现
4. 处理建议`,
      0.7
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.executeWithLLM(context);
  }
}

/**
 * 数据库运维 Specialist
 */
export class DatabaseOperationSpecialist extends SpecialistBase {
  constructor() {
    super(
      '数据库运维专家',
      SpecialistDomain.DATABASE_OPERATION,
      {
        domain: SpecialistDomain.DATABASE_OPERATION,
        skills: ['数据库', 'database', 'db', 'sql', 'mysql', 'postgres', '数据库运维'],
        confidenceThreshold: 0.4
      },
      `你是一个数据库运维专家，负责调用工具执行数据库诊断、监控、安全审计和锁分析。
请提供专业的数据库运维建议。`,
      0.3
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      const response = await executeAgentNode('database-admin-agent', context.input, context.metadata);

      return this.buildResult(true, response, {
        duration: Date.now() - startTime,
        confidence: 0.9,
        metadata: { taskId: context.taskId }
      });
    } catch (error) {
      return this.buildResult(false, '', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }
}

/**
 * 注册所有 Specialist
 */
export function registerAllSpecialists(registry: any): void {
  const specialists = [
    new AlertHandlingSpecialist(),
    new FaultDiagnosisSpecialist(),
    new LogAnalysisSpecialist(),
    new SystemInspectionSpecialist(),
    new ChangeExecutionSpecialist(),
    new DocumentGenerationSpecialist(),
    new ComplianceCheckSpecialist(),
    new ServerOperationSpecialist(),
    new CommandGenerationSpecialist(),
    new NetworkInspectionSpecialist(),
    new DatabaseOperationSpecialist()
  ];

  registry.registerMany(specialists);
  logger.info(`✅ 已注册 ${specialists.length} 个 Specialist`);
}
