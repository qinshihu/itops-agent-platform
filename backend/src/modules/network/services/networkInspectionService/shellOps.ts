/**
 * networkInspectionService Shell + 连接管理子模块（2026-07-21 拆分）
 *
 * 把主类 5 个 SSH 相关方法抽为模块级纯函数：
 * - connectToDevice（SSH 连接）
 * - disconnect（清理连接）
 * - executeCommand（单条命令执行）
 * - runCommandsViaShell（持续 shell 会话核心）
 * - extractCommandOutput（按命令提取输出）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { Client } from 'ssh2';
import { logger } from '../../../../utils/logger';
import type { DeviceInfo } from '../networkInspectionService';

/** SSH 连接到设备（10 秒超时） */
export function connectToDevice(device: DeviceInfo): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let isResolved = false;
    let connectTimeout: NodeJS.Timeout | null = null;

    const safeResolve = (client: Client) => {
      if (!isResolved) {
        isResolved = true;
        if (connectTimeout) clearTimeout(connectTimeout);
        resolve(client);
      }
    };

    const safeReject = (error: Error) => {
      if (!isResolved) {
        isResolved = true;
        if (connectTimeout) clearTimeout(connectTimeout);
        try { conn.end(); } catch { /* ignore */ }
        reject(error);
      }
    };

    connectTimeout = setTimeout(() => {
      safeReject(new Error('SSH 连接超时(10s)'));
    }, 10000);

    conn.on('ready', () => {
      logger.debug(`SSH connected to ${device.name} (${device.ip_address})`);
      safeResolve(conn);
    }).on('error', (err) => {
      safeReject(new Error(`SSH 连接错误: ${err.message}`));
    });

    conn.connect({
      host: device.ip_address,
      port: device.ssh_port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 10000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
    });
  });
}

/** 关闭 SSH 连接 */
export function disconnect(conn: Client): void {
  try { conn.end(); } catch { /* ignore */ }
}

/**
 * 通过持续 SSH Shell 会话依次发送命令，返回全部输出文本
 *
 * 流程：
 * 1. 打开 shell()
 * 2. 等待第一次 shell 提示符（表明 shell 就绪）
 * 3. 发送 screen-length disable（华为/华三关闭分页）
 * 4. 等待提示符（确认命令执行完成）
 * 5. 依次发送每个 display 命令
 * 6. 在每个命令的输出过程中，遇到 ---- More ---- 发空格翻页
 * 7. 检测到提示符表示当前命令结束，开始下一个
 * 8. 所有命令发送完毕后，发送退出命令
 */
export function runCommandsViaShell(conn: Client, device: DeviceInfo, commands: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const SHELL_TIMEOUT = 180000; // 整个 shell 会话最长 3 分钟
    let _stdin: any = null;
    let stdout = '';
    let isResolved = false;
    let shellTimeout: NodeJS.Timeout | null = null;

    const safeResolve = (output: string) => {
      if (!isResolved) {
        isResolved = true;
        if (shellTimeout) clearTimeout(shellTimeout);
        resolve(output);
      }
    };
    const safeReject = (err: Error) => {
      if (!isResolved) {
        isResolved = true;
        if (shellTimeout) clearTimeout(shellTimeout);
        reject(err);
      }
    };

    shellTimeout = setTimeout(() => {
      safeReject(new Error(`Shell 会话超时(${SHELL_TIMEOUT / 1000}s), 已收到 ${(stdout.length / 1024).toFixed(1)}KB`));
    }, SHELL_TIMEOUT);

    conn.shell({ term: 'vt100', cols: 512, rows: 100 }, (err, stream) => {
      if (err) {
        safeReject(new Error(`Shell 创建失败: ${err.message}`));
        return;
      }

      _stdin = stream;
      const cmdQueue = [...commands];   // 待发送的命令队列
      let currentCmd = '';            // 当前正在执行的命令
      let cmdIndex = 0;               // 命令索引
      let paginationCount = 0;        // 分页按空格计数
      let initPhase = true;           // 初始化阶段（先发 screen-length）
      let initSent = false;
      const _angularBracketCount = 0;    // 尖括号计数，用于判断是否收到提示符

      // 准备初始化命令（关闭分页）
      const initCmd = device.vendor === 'huawei'
        ? 'screen-length 0 temporary'
        : device.vendor === 'h3c'
          ? 'screen-length disable'
          : null;

      // 发送关闭分页命令
      if (initCmd) {
        stream.write(initCmd + '\n');
        initSent = true;
        logger.debug(`📟 Shell 发送关闭分页: ${initCmd}`);
      }

      const trySendNextCommand = () => {
        if (cmdQueue.length === 0) {
          // 所有命令已发送完毕，给 shell 一点时间消化最后输出后退出
          stream.write('quit\n');
          return;
        }
        const cmd = cmdQueue.shift()!;
        currentCmd = cmd;
        cmdIndex++;
        logger.debug(`📟 Shell 发送命令(${cmdIndex}/${commands.length}): ${cmd}`);
        stream.write(cmd + '\n');
      };

      // 如果不需要关闭分页，直接发第一个命令
      if (!initSent) {
        trySendNextCommand();
      }

      stream
        .on('data', (data: Buffer) => {
          const chunk = data.toString();

          // ── 调试日志（首次） ──
          if (cmdIndex <= 2 && logger.debug) {
            logger.debug(`[shell chunk #${cmdIndex}] ${chunk.substring(0, 120).replace(/\n/g, '\\n')}`);
          }

          stdout += chunk;

          // ── 处理分页符 ──
          // 华为/H3C 分页：  ---- More ----
          // 检测尾部 300 字节看是否包含 More
          const tail = stdout.slice(-300);
          if (
            /[-=]{2,}\s+(More|more)\s*[-=]{0,}(?:\s*$|[\r\n])/i.test(tail) ||
            /[-=]{2,}\s+(More|more)\s*[-=]{0,}/i.test(chunk)
          ) {
            paginationCount++;
            if (paginationCount > 1000) {
              safeReject(new Error(`Shell 分页次数过多(${paginationCount})，疑似死循环`));
              return;
            }
            stream.write(' ');
            return;
          }

          // ── 检测确认提示 ──
          if (/\[Y\/N\]/i.test(chunk)) {
            stream.write('N\n');
            return;
          }

          // ── 检测 shell 提示符 ──
          // 华为/H3C 提示符：<设备名> 或 [设备名]
          const hasPrompt =
            /[<\u3008][A-Za-z0-9_-]+[>\u3009]\s*(?:$|$)/m.test(chunk) ||
            /^[<\u3008][A-Za-z0-9_-]+[>\u3009]/m.test(
              chunk.split('\n').filter((l) => l.trim()).slice(-1)[0] || '',
            );

          if (hasPrompt) {
            // 如果还在初始化阶段（刚发完 screen-length），开始发第一个命令
            if (initPhase) {
              initPhase = false;
              if (cmdQueue.length > 0) {
                trySendNextCommand();
              }
              return;
            }

            // 正在执行命令，检测到提示符表示当前命令已完成
            if (currentCmd) {
              // 记录命令完成
              logger.debug(`✅ Shell 命令完成(#${cmdIndex}): ${currentCmd.substring(0, 40)}`);

              if (!/^(quit|exit|logout)/i.test(chunk.trim())) {
                if (cmdQueue.length > 0) {
                  trySendNextCommand();
                } else if (cmdQueue.length === 0) {
                  stream.write('quit\n');
                  setTimeout(() => {
                    if (!isResolved) safeResolve(stdout);
                  }, 2000);
                }
              }
            }
            return;
          }

          // ── 检测退出确认 ──
          if (/quit|exit|logout/i.test(chunk) && /\[Y\/N\]/i.test(chunk)) {
            stream.write('Y\n');
            return;
          }
        })
        .stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          if (/(Password|Passwd)[\s]*:/.test(chunk) && device.enable_password) {
            try {
              stream.write(device.enable_password + '\n');
            } catch { /* ignore */ }
          }
          stdout += '[stderr] ' + chunk;
        })
        .on('close', () => {
          logger.debug(`🔚 Shell 会话关闭，收到 ${(stdout.length / 1024).toFixed(1)}KB 输出`);
          safeResolve(stdout);
        })
        .on('error', (err) => {
          safeReject(new Error(`Shell 流错误: ${err.message}`));
        });
    });
  });
}

/**
 * 从多命令的 shell 输出中提取单个命令的响应
 *
 * 网络设备的 shell 输出格式：
 *   <prompt>command
 *   ... output ...
 *   <prompt>
 */
export function extractCommandOutput(shellOutput: string, command: string): string {
  const lines = shellOutput.split('\n');

  // 找到命令出现的行号
  let cmdLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().endsWith(command) || lines[i].trim() === command) {
      cmdLineIdx = i;
      break;
    }
  }

  if (cmdLineIdx === -1) return '';

  // 从命令行的下一行开始收集，直到下一个提示符或命令开始
  const outputLines: string[] = [];
  for (let i = cmdLineIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过空行
    if (!line) continue;

    // 检测到提示符（下一条命令的开始或 shell 结束）
    if (/^[<\u3008][A-Za-z0-9_-]+[>\u3009]/.test(line)) {
      break;
    }

    // 检测到退出/确认
    if (/^(quit|exit|logout|\[Y\/N\])/i.test(line)) {
      break;
    }

    outputLines.push(lines[i]);
  }

  return outputLines.join('\n').trim();
}

/** 单条命令执行（连接 + shell + 提取） */
export async function executeCommand(device: DeviceInfo, command: string): Promise<string> {
  let conn: Client | null = null;

  try {
    conn = await connectToDevice(device);
    const output = await runCommandsViaShell(conn, device, [command]);
    return extractCommandOutput(output, command) || output;
  } finally {
    if (conn) disconnect(conn);
  }
}
