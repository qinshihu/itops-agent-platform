/**
 * WorkflowProviders Provider Meta 数据（2026-07-21 拆分）
 *
 * 把原 WorkflowProviders.tsx L195-357 的 getProviderMeta 函数抽出
 * 内含 8 个 provider 的 description / scenarios / example.input / example.output
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */

export interface ProviderMetaEntry {
  description: string;
  scenarios: string[];
  example: { input: string; output: string };
}

const META: Record<string, ProviderMetaEntry> = {
  'send-notification': {
    description:
      '通过指定渠道发送通知消息，支持邮件、企业微信、钉钉、Webhook 等多种渠道。可用于工作流执行结果通知、告警推送、审批提醒等场景。',
    scenarios: [
      '工作流执行完成后发送结果通知',
      '告警触发时推送消息到值班群',
      '审批节点通知相关处理人',
    ],
    example: {
      input: JSON.stringify(
        {
          message: '工作流执行成功',
          channel: 'wechat',
          targets: ['user1', 'user2'],
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          message: '通知已发送: 工作流执行成功',
          channel: 'wechat',
          sentCount: 2,
        },
        null,
        2,
      ),
    },
  },
  'ssh-exec': {
    description:
      '在指定服务器上执行 SSH 命令，返回执行结果包括 stdout、stderr 和执行耗时。支持设置超时时间，避免命令挂起。',
    scenarios: [
      '远程执行服务器运维命令',
      '批量执行脚本收集服务器信息',
      '服务重启、日志清理等日常运维',
    ],
    example: {
      input: JSON.stringify(
        {
          serverId: 'server-001',
          command: 'df -h /',
          timeout: 30000,
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          stdout:
            'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        40G   15G   23G  40% /',
          stderr: '',
          duration: 520,
        },
        null,
        2,
      ),
    },
  },
  'docker-operation': {
    description:
      '对 Docker 容器执行操作，包括启动、停止、重启、删除和查看日志。通过 SSH 连接到目标服务器执行 docker 命令。',
    scenarios: [
      '容器批量重启解决僵死状态',
      '容器日志导出排查问题',
      '蓝绿发布切换版本',
    ],
    example: {
      input: JSON.stringify(
        {
          serverId: 'server-001',
          containerId: 'app-api',
          operation: 'restart',
          tailLines: 200,
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          stdout: 'app-api\nRestarted successfully',
          stderr: '',
          duration: 2400,
        },
        null,
        2,
      ),
    },
  },
  'http-request': {
    description:
      '调用外部 HTTP/HTTPS API，支持 GET、POST、PUT、DELETE 等方法，支持自定义 headers / body / 鉴权。可用于集成第三方系统、Webhook 触发等。',
    scenarios: [
      '调用第三方服务 API 完成业务集成',
      '通过 Webhook 触发外部系统联动',
      '查询外部系统数据作为工作流输入',
    ],
    example: {
      input: JSON.stringify(
        {
          url: 'https://api.example.com/v1/alerts',
          method: 'POST',
          headers: { Authorization: 'Bearer xxx' },
          body: { severity: 'critical', message: '系统异常' },
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          status: 200,
          response: { alertId: 'A-12345', status: 'queued' },
          duration: 320,
        },
        null,
        2,
      ),
    },
  },
  'sql-query': {
    description:
      '对指定数据库（MySQL/PostgreSQL/SQL Server）执行 SQL 查询或更新语句，支持参数化查询防止注入。',
    scenarios: [
      '自动化数据清理',
      '生成报表数据快照',
      '数据库指标采集',
    ],
    example: {
      input: JSON.stringify(
        {
          dbType: 'mysql',
          connectionId: 'mysql-main',
          sql: 'SELECT COUNT(*) AS active FROM users WHERE last_login > DATE_SUB(NOW(), INTERVAL 7 DAY)',
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          rows: [{ active: 1234 }],
          duration: 85,
        },
        null,
        2,
      ),
    },
  },
  'k8s-operation': {
    description:
      '对 Kubernetes 集群执行操作，包括 Pod 重启、Deployment 扩缩容、日志查询等。',
    scenarios: [
      'Deployment 滚动更新',
      '故障 Pod 自动重启',
      '节点弹性伸缩',
    ],
    example: {
      input: JSON.stringify(
        {
          cluster: 'prod-east-1',
          namespace: 'default',
          deployment: 'api-gateway',
          operation: 'restart',
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          message: 'Deployment api-gateway restarted',
          duration: 1800,
        },
        null,
        2,
      ),
    },
  },
  'script-execution': {
    description: '在工作流中执行预定义的 Python/JavaScript/Bash 脚本节点。',
    scenarios: [
      '自定义数据处理',
      '业务规则计算',
      '复杂数据转换',
    ],
    example: {
      input: JSON.stringify(
        {
          scriptId: 'data-enrich-001',
          context: { userId: 'U-12345' },
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          output: { enriched: true, fields: ['email', 'department'] },
          duration: 120,
        },
        null,
        2,
      ),
    },
  },
  'approval': {
    description:
      '在关键决策点发起人工审批，支持单审、多人审、会签、票决等多种模式。',
    scenarios: [
      '生产变更人工确认',
      '高危操作双人复核',
      '紧急事件升级审批',
    ],
    example: {
      input: JSON.stringify(
        {
          title: '生产数据库变更审批',
          applicant: 'user-001',
          timeout: 7200,
        },
        null,
        2,
      ),
      output: JSON.stringify(
        {
          success: true,
          approvalId: 'AP-20260721-001',
          approvers: ['ops-lead', 'dba'],
          mode: 'concurrent',
        },
        null,
        2,
      ),
    },
  },
};

/** 获取 provider 的元数据（description / scenarios / example） */
export function getProviderMeta(id: string): ProviderMetaEntry {
  return (
    META[id] || {
      description: '工作流动作提供者，可在工作流中调用执行。',
      scenarios: ['在工作流中作为执行节点使用', '通过参数配置实现不同的执行逻辑'],
      example: {
        input: '{}',
        output: '{}',
      },
    }
  );
}
