import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../utils/logger';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

/**
 * 检查 dbskiter 是否已安装
 *
 * 功能描述：尝试 python 和 python3 两种方式检测 dbskiter 安装状态
 *
 * 返回说明：
 * - [boolean] true 表示已安装，false 表示未安装
 */
export async function isDbskiterInstalled(): Promise<boolean> {
    const commands = ['python -m dbskiter --version', 'python3 -m dbskiter --version'];
    for (const cmd of commands) {
        try {
            await execAsync(cmd, { timeout: 5000 });
            return true;
        } catch {
            // 继续尝试下一个命令
        }
    }
    return false;
}

/**
 * 检测 dbskiter 是否可用
 *
 * 功能描述：启动时只检测 dbskiter，不在运行期自动安装依赖。
 * Docker 部署应在镜像构建阶段安装，本地开发请手动运行 pip install dbskiter。
 */
export async function checkDbskiterAvailability(): Promise<void> {
    if (await isDbskiterInstalled()) {
        logger.info('✅ dbskiter 已安装');
        return;
    }

    logger.warn('⚠️ dbskiter 未安装，数据库运维 Agent 将不可用。请在部署镜像或本地环境中预先安装 dbskiter。');
}

/** dbskiter 支持的运维操作类型（对应顶级命令） */
export type DbskiterOperation =
    | 'audit'      // SQL 审核
    | 'diagnose'   // 诊断
    | 'inspector'  // 巡检
    | 'lock'       // 锁分析
    | 'monitor'    // 监控
    | 'scheduler'  // 调度
    | 'security'   // 安全
    | 'sql';       // SQL 执行

/** dbskiter 数据库连接参数 */
export interface DbskiterConnection {
    /** 数据库类型 (mysql, postgresql, oracle, sqlite) */
    dialect: string;
    /** 数据库主机 */
    host: string;
    /** 数据库端口 */
    port: number;
    /** 用户名 */
    user: string;
    /** 密码 */
    password: string;
    /** 数据库名称 */
    database: string;
}

/** dbskiter 子命令参数 */
export interface DbskiterOptions {
    /** 运维操作类型（顶级命令） */
    operation: DbskiterOperation;
    /** 子命令，如 'health'、'report'、'audit'、'analyze' */
    subCommand?: string;
    /** 额外参数，如 SQL 语句、表名等 */
    extraArgs?: string[];
    /** 超时时间（毫秒），默认 60 秒 */
    timeout?: number;
    /** 数据库连接信息（必填） */
    connection: DbskiterConnection;
}

/** dbskiter 执行结果 */
export interface DbskiterResult {
    success: boolean;
    stdout: string;
    stderr: string;
    data?: unknown;
    duration: number;
    error?: string;
}

/**
 * 构建 dbskiter CLI 命令参数数组
 *
 * 参数说明：
 * - options: [DbskiterOptions] 命令配置对象
 *
 * 返回说明：
 * - [string[]] 可直接传入 execFile 的参数数组
 */
function buildDbskiterCommand(options: DbskiterOptions): string[] {
    const args: string[] = [];
    const c = options.connection;

    // 连接参数（全局参数）——dbskiter 不支持 "--key=value" 格式，必须用空格分隔
    args.push('--dialect', c.dialect);
    args.push('--host', c.host);
    args.push('--port', String(c.port));
    args.push('--user', c.user);
    args.push('--password', c.password);
    args.push('--database', c.database);

    // 输出格式参数
    args.push('--json');              // 输出 JSON
    args.push('--quiet');             // 静默模式
    args.push('--log-level', 'ERROR');   // 只输出错误日志
    args.push('--output-mode', 'ai');    // AI 友好格式，便于平台解析
    args.push('--ai-depth', 'detail');   // 详细输出

    // 主命令
    args.push(options.operation);

    // 子命令（如 diagnose report、monitor health）
    if (options.subCommand) {
        args.push(options.subCommand);
    }

    // 额外参数
    if (options.extraArgs && options.extraArgs.length > 0) {
        args.push(...options.extraArgs);
    }

    return args;
}

/**
 * 获取可用的 Python 命令（python 或 python3）
 *
 * 返回说明：
 * - [string] 'python' 或 'python3'，都不可用时返回 'python'
 */
async function getPythonCommand(): Promise<string> {
    for (const cmd of ['python', 'python3']) {
        try {
            await execAsync(`${cmd} --version`, { timeout: 5000 });
            return cmd;
        } catch {
            // 继续尝试下一个
        }
    }
    return 'python';
}

/**
 * 执行 dbskiter CLI 命令
 *
 * 功能描述：通过子进程调用 python/python3 -m dbskiter，获取 JSON 输出并解析
 *
 * 参数说明：
 * - options: [DbskiterOptions] 命令配置（必须包含 connection）
 *
 * 返回说明：
 * - [DbskiterResult] 包含执行状态、原始输出和解析后的数据
 */
export async function executeDbskiter(options: DbskiterOptions): Promise<DbskiterResult> {
    const args = buildDbskiterCommand(options);
    const timeout = options.timeout || 60000;
    const pythonCmd = await getPythonCommand();

    // 安全日志：隐藏密码
    const safeArgs = args.map((arg, _i) =>
        arg === '--password' ? '--password ' : arg
    );
    logger.info(`🗄️ 执行 dbskiter: ${pythonCmd} -m dbskiter ${safeArgs.join(' ')}`);

    const startTime = Date.now();

    try {
        const { stdout, stderr } = await execFileAsync(pythonCmd, ['-m', 'dbskiter', ...args], {
            timeout,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf8',
                NO_COLOR: '1',
            },
            maxBuffer: 1024 * 1024, // 1MB 输出缓冲
        });

        const duration = Date.now() - startTime;

        // 检测 stderr 是否包含错误
        const hasErrorInStderr = stderr && (
            stderr.includes('ERROR') ||
            stderr.includes('Exception') ||
            stderr.includes('Access denied') ||
            stderr.includes('失败') ||
            stderr.includes('error') ||
            stderr.includes('未提供')
        );

        // 检测 stdout 是否包含错误（dbskiter 可能把错误输出到 stdout）
        const hasErrorInStdout = stdout && (
            stdout.includes('操作失败') ||
            stdout.includes('未提供') ||
            stdout.includes('失败') ||
            stdout.includes('错误') ||
            stdout.includes('无法连接') ||
            stdout.includes('Access denied')
        );

        const hasError = hasErrorInStderr || hasErrorInStdout;

        if (stderr) {
            logger.warn('dbskiter stderr:', { stderr: stderr.substring(0, 500) });
        }

        // 尝试解析 JSON 输出
        let data: unknown = undefined;
        let success = !hasError;

        try {
            // 先尝试直接解析整个 stdout（dbskiter 的 --json 输出是完整的格式化 JSON）
            data = JSON.parse(stdout.trim());
        } catch {
            // 如果失败，尝试提取从第一个 { 或 [ 开始到最后的完整 JSON 块
            const lines = stdout.trim().split('\n');
            const startIdx = lines.findIndex(line => line.trim().startsWith('{') || line.trim().startsWith('['));
            if (startIdx !== -1) {
                const jsonStr = lines.slice(startIdx).join('\n');
                try {
                    data = JSON.parse(jsonStr);
                } catch {
                    data = stdout;
                    success = false;
                }
            } else {
                data = stdout;
                success = false;
            }
        }

        if (hasError) {
            return {
                success: false,
                stdout: stdout.substring(0, 5000),
                stderr: stderr.substring(0, 2000),
                data,
                duration,
                error: (stderr || stdout).substring(0, 500),
            };
        }

        return {
            success,
            stdout: stdout.substring(0, 5000),
            stderr: stderr.substring(0, 2000),
            data,
            duration,
        };
    } catch (error: unknown) {
        const duration = Date.now() - startTime;
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('dbskiter 执行失败:', { error: errMsg, args: safeArgs });

        return {
            success: false,
            stdout: '',
            stderr: errMsg,
            duration,
            error: errMsg,
        };
    }
}

/**
 * 从用户输入中推断数据库运维意图
 *
 * 功能描述：解析自然语言输入，提取 operation、subCommand
 * 覆盖 dbskiter 所有主要子命令，关键词匹配更准确，不再暴力兜底 health。
 *
 * 参数说明：
 * - input: [string] 用户输入，如"检查数据库健康状态"
 * - connection: [DbskiterConnection] 数据库连接信息（上下文传入）
 *
 * 返回说明：
 * - [DbskiterOptions | null] 推断出的命令配置，无法推断时返回 null
 */
export function inferDatabaseOperation(
    input: string,
    connection?: DbskiterConnection
): DbskiterOptions | null {
    const lower = input.toLowerCase();

    // 如果没有连接信息，直接返回 null，让上层处理
    if (!connection) {
        return null;
    }

    // 提取引号中的 SQL 语句（通用）
    const sqlMatch = input.match(/["'](.+)["']/);
    const quotedSql = sqlMatch ? sqlMatch[1] : null;

    // ==================== SQL 执行（最高优先级：包含明确的 SQL 语句）====================
    if (quotedSql) {
        if (lower.includes('执行') || lower.includes('运行') || lower.includes('跑')) {
            return { connection, operation: 'sql', subCommand: 'execute', extraArgs: ['--sql', quotedSql] };
        }
        if (lower.includes('审核') || lower.includes('audit') || lower.includes('规范')) {
            return { connection, operation: 'audit', subCommand: 'analyze', extraArgs: ['--sql', quotedSql] };
        }
        if (lower.includes('诊断') || lower.includes('分析') || lower.includes('优化')) {
            return { connection, operation: 'diagnose', subCommand: 'sql', extraArgs: ['--sql', quotedSql] };
        }
        // 有引号但没有明确意图，默认执行 SQL
        return { connection, operation: 'sql', subCommand: 'execute', extraArgs: ['--sql', quotedSql] };
    }

    // ==================== 慢查询 / 性能瓶颈（用户说"慢/卡/延迟"）====================
    if (
        lower.includes('慢') || lower.includes('卡') || lower.includes('延迟') ||
        lower.includes('卡顿') || lower.includes('hang') || lower.includes('timeout') ||
        lower.includes('超时') || lower.includes('性能差') || lower.includes('慢查询')
    ) {
        return { connection, operation: 'diagnose', subCommand: 'slow-queries' };
    }

    // ==================== 锁 / 死锁 / 阻塞 ====================
    if (
        lower.includes('锁') || lower.includes('死锁') || lower.includes('阻塞') ||
        lower.includes('等待') || lower.includes('lock') || lower.includes('block')
    ) {
        return { connection, operation: 'lock', subCommand: 'analyze' };
    }

    // ==================== 空间 / 容量 / 磁盘 / 存储 ====================
    if (
        lower.includes('空间') || lower.includes('容量') || lower.includes('磁盘') ||
        lower.includes('存储') || lower.includes('大小') || lower.includes('满') ||
        lower.includes('空间不足') || lower.includes('磁盘满') || lower.includes('storage') ||
        lower.includes('disk') || lower.includes('容量预测')
    ) {
        return { connection, operation: 'diagnose', subCommand: 'space' };
    }

    // ==================== 连接数 / 并发 / 连接池 ====================
    if (
        lower.includes('连接') || lower.includes('并发') || lower.includes('连接池') ||
        lower.includes('connection') || lower.includes('pool') || lower.includes('会话') ||
        lower.includes('session')
    ) {
        return { connection, operation: 'diagnose', subCommand: 'connections' };
    }

    // ==================== 表 / Schema / 结构 / 索引 / 元数据 ====================
    if (
        lower.includes('表') || lower.includes('schema') || lower.includes('结构') ||
        lower.includes('索引') || lower.includes('index') || lower.includes('字段') ||
        lower.includes('列') || lower.includes('column') || lower.includes('元数据') ||
        lower.includes('有哪些') || lower.includes('列出') || lower.includes('show')
    ) {
        return { connection, operation: 'diagnose', subCommand: 'report' };
    }

    // ==================== 备份 / 恢复 / 调度 ====================
    if (
        lower.includes('备份') || lower.includes('backup') || lower.includes('恢复') ||
        lower.includes('restore') || lower.includes('dump')
    ) {
        return { connection, operation: 'scheduler', subCommand: 'backup' };
    }
    if (
        lower.includes('任务') || lower.includes('定时') || lower.includes('调度') ||
        lower.includes('cron') || lower.includes('job') || lower.includes('scheduler')
    ) {
        return { connection, operation: 'scheduler', subCommand: 'tasks' };
    }

    // ==================== 监控类：健康 / 状态 / 性能 / 监控 ====================
    if (
        lower.includes('健康') || lower.includes('状态') || lower.includes('性能') ||
        lower.includes('监控') || lower.includes('metrics') || lower.includes('指标')
    ) {
        return { connection, operation: 'monitor', subCommand: 'health' };
    }
    if (lower.includes('异常') || lower.includes('anomalies') || lower.includes('告警')) {
        return { connection, operation: 'monitor', subCommand: 'anomalies' };
    }
    if (lower.includes('容量预测') || lower.includes('capacity') || lower.includes('趋势')) {
        return { connection, operation: 'monitor', subCommand: 'capacity' };
    }

    // ==================== 安全类 ====================
    if (
        lower.includes('安全') || lower.includes('审计') || lower.includes('合规') ||
        lower.includes('audit') || lower.includes('security')
    ) {
        return { connection, operation: 'security', subCommand: 'audit' };
    }
    if (lower.includes('注入') || lower.includes('sql injection') || lower.includes('injection')) {
        return { connection, operation: 'security', subCommand: 'sql-injection' };
    }
    if (lower.includes('敏感数据') || lower.includes('敏感信息') || lower.includes('sensitive') || lower.includes('隐私')) {
        return { connection, operation: 'security', subCommand: 'sensitive-data' };
    }
    if (lower.includes('弱密码') || lower.includes('弱口令') || lower.includes('密码强度') || lower.includes('weak password')) {
        return { connection, operation: 'security', subCommand: 'weak-password' };
    }
    if (
        lower.includes('账号') || lower.includes('权限') || lower.includes('account') ||
        lower.includes('user') || lower.includes('role') || lower.includes('grant')
    ) {
        return { connection, operation: 'security', subCommand: 'account' };
    }

    // ==================== 诊断类：通用诊断 / 巡检 / 检查 / 问题排查 ====================
    if (
        lower.includes('诊断') || lower.includes('巡检') || lower.includes('检查') ||
        lower.includes('排查') || lower.includes('问题') || lower.includes('故障') ||
        lower.includes('bug') || lower.includes('issue') || lower.includes('报错') ||
        lower.includes('错误') || lower.includes('日志') || lower.includes('log') ||
        lower.includes('分析') || lower.includes('查看') || lower.includes('看看')
    ) {
        return { connection, operation: 'diagnose', subCommand: 'report' };
    }

    // ==================== 实时诊断 / 在线诊断 ====================
    if (lower.includes('实时') || lower.includes('在线') || lower.includes('当前') || lower.includes('now')) {
        return { connection, operation: 'diagnose', subCommand: 'realtime' };
    }

    // ==================== 巡检报告（专门生成报告）====================
    if (lower.includes('报告') || lower.includes('report') || lower.includes('生成文档')) {
        return { connection, operation: 'inspector', subCommand: 'report' };
    }

    // 兜底：通用诊断报告（不再无脑 health）
    return { connection, operation: 'diagnose', subCommand: 'report' };
}

/**
 * 将 dbskiter 结果格式化为平台标准的 Markdown 报告
 */
export function formatResultToMarkdown(result: DbskiterResult, operation: string): string {
    if (!result.success) {
        return `## 数据库运维执行失败\n\n**操作**: ${operation}\n**耗时**: ${result.duration}ms\n\n**错误**: \n\`\`\`\n${result.error || result.stderr}\n\`\`\`\n`;
    }

    let md = `## 数据库运维执行结果\n\n`;
    md += `**操作**: ${operation}\n`;
    md += `**耗时**: ${result.duration}ms\n`;
    md += `**状态**: ✅ 成功\n\n`;

    const hasData = result.data && typeof result.data === 'object' && Object.keys(result.data).length > 0;

    if (hasData) {
        md += `**详情**: \n\`\`\`json\n${JSON.stringify(result.data, null, 2).substring(0, 8000)}\n\`\`\`\n`;
    } else if (result.stdout) {
        md += `**输出**: \n\`\`\`\n${result.stdout.substring(0, 8000)}\n\`\`\`\n`;
    } else {
        md += `> ⚠️ 执行成功但未返回任何数据。可能是数据库权限不足或目标数据库无相关数据。\n`;
    }

    return md;
}
