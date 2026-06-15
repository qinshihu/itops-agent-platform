import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export async function isDbskiterInstalled(): Promise<boolean> {
  for (const command of ['python -m dbskiter --version', 'python3 -m dbskiter --version']) {
    try {
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch {
      // try next command
    }
  }

  return false;
}

export async function checkDbskiterAvailability(): Promise<void> {
  if (await isDbskiterInstalled()) {
    logger.info('dbskiter 已安装');
    return;
  }

  logger.warn('dbskiter 未安装，数据库运维 Agent 将不可用。请在镜像或本地环境中预先安装 dbskiter。');
}

export type DbskiterOperation =
  | 'audit'
  | 'diagnose'
  | 'inspector'
  | 'lock'
  | 'monitor'
  | 'scheduler'
  | 'security'
  | 'sql';

export interface DbskiterConnection {
  dialect: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface DbskiterOptions {
  operation: DbskiterOperation;
  subCommand?: string;
  extraArgs?: string[];
  timeout?: number;
  connection: DbskiterConnection;
}

export interface DbskiterResult {
  success: boolean;
  stdout: string;
  stderr: string;
  data?: unknown;
  duration: number;
  error?: string;
}

function buildDbskiterCommand(options: DbskiterOptions): string[] {
  const args: string[] = [
    '--json',
    '--output-mode',
    'ai',
    '--ai-depth',
    'detail',
    options.operation,
  ];

  if (options.subCommand) {
    args.push(options.subCommand);
  }

  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  return args;
}

function buildDbskiterEnv(connection: DbskiterConnection): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONIOENCODING: 'utf8',
    NO_COLOR: '1',
    DB_DIALECT: connection.dialect,
    DB_HOST: connection.host,
    DB_PORT: String(connection.port),
    DB_USER: connection.user,
    DB_PASSWORD: connection.password,
    DB_NAME: connection.database,
  };
}

async function getPythonCommand(): Promise<string> {
  for (const command of ['python', 'python3']) {
    try {
      await execAsync(`${command} --version`, { timeout: 5000 });
      return command;
    } catch {
      // try next command
    }
  }

  return 'python';
}

export async function executeDbskiter(options: DbskiterOptions): Promise<DbskiterResult> {
  const args = buildDbskiterCommand(options);
  const pythonCmd = await getPythonCommand();
  const timeout = options.timeout || 60000;
  const startTime = Date.now();

  logger.info(`执行 dbskiter: ${pythonCmd} -m dbskiter ${args.join(' ')}`, {
    dialect: options.connection.dialect,
    host: options.connection.host,
    port: options.connection.port,
    database: options.connection.database,
    user: options.connection.user,
  });

  try {
    const { stdout, stderr } = await execFileAsync(pythonCmd, ['-m', 'dbskiter', ...args], {
      timeout,
      env: buildDbskiterEnv(options.connection),
      maxBuffer: 1024 * 1024,
    });

    const duration = Date.now() - startTime;

    const hasErrorInStderr = Boolean(
      stderr &&
      (
        stderr.includes('ERROR') ||
        stderr.includes('WARNING') ||
        stderr.includes('Exception') ||
        stderr.includes('OperationalError') ||
        stderr.includes('Can\'t connect') ||
        stderr.includes('Access denied') ||
        stderr.includes('无法连接') ||
        stderr.includes('error')
      )
    );

    const hasErrorInStdout = Boolean(
      stdout &&
      (
        stdout.includes('操作失败') ||
        stdout.includes('无法连接') ||
        stdout.includes('错误') ||
        stdout.includes('Access denied')
      )
    );

    if (stderr) {
      logger.warn('dbskiter stderr', { stderr: stderr.substring(0, 1000) });
    }

    let data: unknown;
    let success = !(hasErrorInStderr || hasErrorInStdout);

    try {
      data = JSON.parse(stdout.trim());
    } catch {
      const lines = stdout.trim().split('\n');
      const startIndex = lines.findIndex((line) => line.trim().startsWith('{') || line.trim().startsWith('['));

      if (startIndex >= 0) {
        try {
          data = JSON.parse(lines.slice(startIndex).join('\n'));
        } catch {
          data = stdout;
          success = false;
        }
      } else {
        data = stdout;
        success = false;
      }
    }

    if (!success) {
      return {
        success: false,
        stdout: stdout.substring(0, 5000),
        stderr: stderr.substring(0, 2000),
        data,
        duration,
        error: (stderr || stdout).substring(0, 1000),
      };
    }

    return {
      success: true,
      stdout: stdout.substring(0, 5000),
      stderr: stderr.substring(0, 2000),
      data,
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    logger.error('dbskiter 执行失败', {
      error: message,
      args,
      dialect: options.connection.dialect,
      host: options.connection.host,
      port: options.connection.port,
      database: options.connection.database,
      user: options.connection.user,
    });

    return {
      success: false,
      stdout: '',
      stderr: message,
      duration,
      error: message,
    };
  }
}

export function inferDatabaseOperation(
  input: string,
  connection?: DbskiterConnection
): DbskiterOptions | null {
  if (!connection) {
    return null;
  }

  const lower = input.toLowerCase();
  const sqlMatch = input.match(/["'](.+)["']/);
  const quotedSql = sqlMatch ? sqlMatch[1] : null;

  if (quotedSql) {
    if (lower.includes('执行') || lower.includes('运行') || lower.includes('run')) {
      return { connection, operation: 'sql', subCommand: 'execute', extraArgs: [quotedSql] };
    }

    if (lower.includes('审核') || lower.includes('audit') || lower.includes('规范')) {
      return { connection, operation: 'audit', subCommand: 'sql', extraArgs: [quotedSql] };
    }

    if (lower.includes('诊断') || lower.includes('分析') || lower.includes('优化')) {
      return { connection, operation: 'diagnose', subCommand: 'sql', extraArgs: [quotedSql] };
    }

    return { connection, operation: 'sql', subCommand: 'execute', extraArgs: [quotedSql] };
  }

  if (
    lower.includes('弱密码') ||
    lower.includes('密码强度') ||
    lower.includes('weak password')
  ) {
    return { connection, operation: 'security', subCommand: 'weak-passwords' };
  }

  if (
    lower.includes('用户') ||
    lower.includes('账号') ||
    lower.includes('权限') ||
    lower.includes('account') ||
    lower.includes('user') ||
    lower.includes('role') ||
    lower.includes('grant')
  ) {
    return { connection, operation: 'security', subCommand: 'permissions' };
  }

  if (
    lower.includes('慢查询') ||
    lower.includes('慢') ||
    lower.includes('卡') ||
    lower.includes('延迟') ||
    lower.includes('timeout') ||
    lower.includes('超时') ||
    lower.includes('性能差')
  ) {
    return { connection, operation: 'diagnose', subCommand: 'slow-queries' };
  }

  if (
    lower.includes('锁') ||
    lower.includes('死锁') ||
    lower.includes('阻塞') ||
    lower.includes('lock') ||
    lower.includes('block')
  ) {
    return { connection, operation: 'lock', subCommand: 'analyze' };
  }

  if (
    lower.includes('空间') ||
    lower.includes('容量') ||
    lower.includes('磁盘') ||
    lower.includes('存储') ||
    lower.includes('storage') ||
    lower.includes('disk')
  ) {
    return { connection, operation: 'diagnose', subCommand: 'space' };
  }

  if (
    lower.includes('连接') ||
    lower.includes('连接池') ||
    lower.includes('会话') ||
    lower.includes('connection') ||
    lower.includes('pool') ||
    lower.includes('session')
  ) {
    return { connection, operation: 'diagnose', subCommand: 'connections' };
  }

  if (
    lower.includes('健康') ||
    lower.includes('状态') ||
    lower.includes('监控') ||
    lower.includes('metrics') ||
    lower.includes('指标')
  ) {
    return { connection, operation: 'monitor', subCommand: 'health' };
  }

  if (lower.includes('异常') || lower.includes('anomalies') || lower.includes('告警')) {
    return { connection, operation: 'monitor', subCommand: 'anomalies' };
  }

  if (lower.includes('趋势') || lower.includes('capacity') || lower.includes('容量预测')) {
    return { connection, operation: 'monitor', subCommand: 'capacity' };
  }

  if (
    lower.includes('安全') ||
    lower.includes('审计') ||
    lower.includes('合规') ||
    lower.includes('security') ||
    lower.includes('audit')
  ) {
    return { connection, operation: 'security', subCommand: 'audit' };
  }

  if (lower.includes('注入') || lower.includes('sql injection') || lower.includes('injection')) {
    return { connection, operation: 'security', subCommand: 'sql-injection' };
  }

  if (
    lower.includes('敏感数据') ||
    lower.includes('敏感信息') ||
    lower.includes('sensitive') ||
    lower.includes('隐私')
  ) {
    return { connection, operation: 'security', subCommand: 'sensitive-data' };
  }

  if (
    lower.includes('表') ||
    lower.includes('schema') ||
    lower.includes('结构') ||
    lower.includes('索引') ||
    lower.includes('字段') ||
    lower.includes('列') ||
    lower.includes('column') ||
    lower.includes('show') ||
    lower.includes('列出') ||
    lower.includes('有哪些')
  ) {
    return { connection, operation: 'diagnose', subCommand: 'report' };
  }

  if (lower.includes('备份') || lower.includes('backup') || lower.includes('restore') || lower.includes('dump')) {
    return { connection, operation: 'scheduler', subCommand: 'backup' };
  }

  if (lower.includes('任务') || lower.includes('定时') || lower.includes('调度') || lower.includes('cron')) {
    return { connection, operation: 'scheduler', subCommand: 'tasks' };
  }

  if (
    lower.includes('诊断') ||
    lower.includes('巡检') ||
    lower.includes('检查') ||
    lower.includes('排查') ||
    lower.includes('问题') ||
    lower.includes('故障') ||
    lower.includes('错误') ||
    lower.includes('日志') ||
    lower.includes('分析') ||
    lower.includes('看看')
  ) {
    return { connection, operation: 'diagnose', subCommand: 'report' };
  }

  if (lower.includes('实时') || lower.includes('在线') || lower.includes('当前') || lower.includes('now')) {
    return { connection, operation: 'diagnose', subCommand: 'realtime' };
  }

  if (lower.includes('报告') || lower.includes('report') || lower.includes('生成文档')) {
    return { connection, operation: 'inspector', subCommand: 'report' };
  }

  return { connection, operation: 'diagnose', subCommand: 'report' };
}

export function formatResultToMarkdown(result: DbskiterResult, operation: string): string {
  if (!result.success) {
    return `## 数据库运维执行失败\n\n**操作**: ${operation}\n**耗时**: ${result.duration}ms\n\n**错误**: \n\`\`\`\n${result.error || result.stderr}\n\`\`\`\n`;
  }

  let md = '## 数据库运维执行结果\n\n';
  md += `**操作**: ${operation}\n`;
  md += `**耗时**: ${result.duration}ms\n`;
  md += '**状态**: 成功\n\n';

  const hasData = Boolean(result.data && typeof result.data === 'object' && Object.keys(result.data as Record<string, unknown>).length > 0);

  if (hasData) {
    md += `**详情**: \n\`\`\`json\n${JSON.stringify(result.data, null, 2).substring(0, 8000)}\n\`\`\`\n`;
    return md;
  }

  if (result.stdout) {
    md += `**输出**: \n\`\`\`\n${result.stdout.substring(0, 8000)}\n\`\`\`\n`;
    return md;
  }

  md += '> 执行成功，但未返回可展示的数据。\n';
  return md;
}
