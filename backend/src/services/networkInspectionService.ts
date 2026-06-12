import { Client } from 'ssh2';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { createVendorAdapter, VendorType, InspectionType, CommandTemplate } from './vendorAdapter';
import { getParser, ParsedResult } from './networkResultParser';
import { decrypt } from './encryptionService';
import { networkCommandGenerator } from './networkCommandGenerator';

export interface DeviceInfo {
  id: string;
  name: string;
  ip_address: string;
  vendor: VendorType;
  ssh_port: number;
  username: string;
  password: string;
  enable_password?: string;
}

export interface InspectionResult {
  inspectionId: string;
  deviceId: string;
  inspectionType: 'standard' | 'custom' | 'full';
  status: 'success' | 'partial' | 'failed';
  results: ParsedResult[];
  commandsExecuted: number;
  commandsFailed: number;
  durationMs: number;
  summary: string;
}

export interface CustomInspectionRequest {
  deviceId: string;
  description: string;
  inspectionType: InspectionType[];
}

class NetworkInspectionService {
  async inspectDevice(
    deviceId: string,
    inspectionType: 'standard' | 'custom' | 'full' = 'standard',
    customTypes?: InspectionType[],
    customDescription?: string
  ): Promise<InspectionResult> {
    const startTime = Date.now();
    const inspectionId = randomUUID();

    const device = db.prepare(
      'SELECT id, name, ip_address, vendor, ssh_port, username, password, enable_password FROM network_devices WHERE id = ?'
    ).get(deviceId) as DeviceInfo | undefined;

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const decryptedDevice = {
      ...device,
      password: decrypt(device.password),
      enable_password: device.enable_password ? decrypt(device.enable_password) : undefined
    };

    db.prepare(
      'INSERT INTO network_inspection_history (id, device_id, inspection_type, status) VALUES (?, ?, ?, ?)'
    ).run(inspectionId, deviceId, inspectionType, 'running');

    try {
      const results: ParsedResult[] = [];
      let commandsExecuted = 0;
      let commandsFailed = 0;

      if (inspectionType === 'standard' || inspectionType === 'full') {
        const standardResults = await this.executeStandardInspection(decryptedDevice);
        results.push(...standardResults);
        commandsExecuted += standardResults.length;
        commandsFailed += standardResults.filter(r => r.status === 'error').length;
      }

      if ((inspectionType === 'custom' || inspectionType === 'full') && customTypes && customTypes.length > 0) {
        const customResults = await this.executeCustomInspection(decryptedDevice, customTypes);
        results.push(...customResults);
        commandsExecuted += customResults.length;
        commandsFailed += customResults.filter(r => r.status === 'error').length;
      }

      if (inspectionType === 'custom' && customDescription) {
        const customResults = await this.executeCustomDescriptionInspection(decryptedDevice, customDescription);
        results.push(...customResults);
        commandsExecuted += customResults.length;
        commandsFailed += customResults.filter(r => r.status === 'error').length;
      }

      const durationMs = Date.now() - startTime;
      const status = commandsFailed === 0 ? 'success' : commandsFailed < commandsExecuted / 2 ? 'partial' : 'failed';
      const summary = this.generateSummary(results);

      db.prepare(
        'UPDATE network_inspection_history SET status = ?, commands_executed = ?, commands_failed = ?, results = ?, summary = ?, duration_ms = ? WHERE id = ?'
      ).run(
        status,
        commandsExecuted,
        commandsFailed,
        JSON.stringify(results),
        summary,
        durationMs,
        inspectionId
      );

      db.prepare(
        'UPDATE network_devices SET last_inspection_at = datetime(\'now\',\'localtime\'), last_inspection_result = ? WHERE id = ?'
      ).run(summary, deviceId);

      return {
        inspectionId,
        deviceId,
        inspectionType,
        status,
        results,
        commandsExecuted,
        commandsFailed,
        durationMs,
        summary
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      db.prepare(
        'UPDATE network_inspection_history SET status = ?, summary = ?, duration_ms = ? WHERE id = ?'
      ).run('failed', errorMessage, durationMs, inspectionId);

      logger.error(`Inspection failed for device ${deviceId}: ${errorMessage}`);

      return {
        inspectionId,
        deviceId,
        inspectionType,
        status: 'failed',
        results: [],
        commandsExecuted: 0,
        commandsFailed: 0,
        durationMs,
        summary: errorMessage
      };
    }
  }

  async batchInspect(deviceIds: string[], inspectionType: 'standard' | 'custom' | 'full' = 'standard', customTypes?: InspectionType[], customDescription?: string): Promise<InspectionResult[]> {
    const results: InspectionResult[] = [];

    for (const deviceId of deviceIds) {
      try {
        const result = await this.inspectDevice(deviceId, inspectionType, customTypes, customDescription);
        results.push(result);
      } catch (error) {
        logger.error(`Batch inspection failed for device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * 通过一个持续的 SSH Shell 会话执行巡检
   *
   * 为什么不用 exec()？
   *   conn.exec() 每次启动独立进程，screen-length 不继承、分页交互不稳定
   *   华为 VRP 在 exec 模式下分页处理不可靠 → 卡死 → 超时
   *
   * 用 shell() 的好处：
   *   1. 一个持续会话，screen-length 设置对所有后续命令生效
   *   2. 分页符交互稳定（和手敲命令完全一样）
   *   3. 可以通过检测 shell 提示符确定命令输出何时结束
   */
  private async executeStandardInspection(device: DeviceInfo): Promise<ParsedResult[]> {
    const adapter = createVendorAdapter(device.vendor);
    const commands = adapter.getCommands();
    const results: ParsedResult[] = [];

    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);

      // 打开一个持久 Shell 会话，通过它发送所有命令
      const shellOutput = await this.runCommandsViaShell(conn, device, commands.map(c => c.command));
      // shellOutput 是按命令顺序拼接的字符串，需要按正则拆分

      // 按命令拆分输出 — 每个命令输出以 <command>\r\n 开头，到下一个 <prompt> 结束
      for (const cmd of commands) {
        const cmdEscaped = cmd.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 从当前命令执行完后的位置提取输出
        const cmdOutput = this.extractCommandOutput(shellOutput, cmd.command);

        if (cmdOutput) {
          const parser = getParser(device.vendor, cmd.type);
          const parsed = parser(cmdOutput);
          results.push(parsed);
        } else {
          logger.warn(`无法从 shell 输出中提取命令: ${cmd.command}`);
          results.push({
            type: cmd.type,
            success: false,
            status: 'error',
            details: `${cmd.name}: 无法解析命令输出`,
            rawOutput: '',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      logger.error(`Standard inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // 全部失败
      for (const cmd of commands) {
        results.push({
          type: cmd.type,
          success: false,
          status: 'error',
          details: `命令执行失败: ${cmd.command} - ${error instanceof Error ? error.message.substring(0, 100) : 'Unknown'}`,
          rawOutput: '',
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      if (conn) {
        this.disconnect(conn);
      }
    }

    return results;
  }

  private async executeCustomInspection(device: DeviceInfo, types: InspectionType[]): Promise<ParsedResult[]> {
    const adapter = createVendorAdapter(device.vendor);
    const commands = adapter.getCommands(types);
    const results: ParsedResult[] = [];

    if (commands.length === 0) return results;

    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);
      const shellOutput = await this.runCommandsViaShell(conn, device, commands.map(c => c.command));

      for (const cmd of commands) {
        const cmdOutput = this.extractCommandOutput(shellOutput, cmd.command);
        if (cmdOutput) {
          const parser = getParser(device.vendor, cmd.type);
          const parsed = parser(cmdOutput);
          results.push(parsed);
        } else {
          results.push({
            type: cmd.type,
            success: false,
            status: 'error',
            details: `${cmd.name}: 无法解析命令输出`,
            rawOutput: '', timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      for (const cmd of commands) {
        results.push({
          type: cmd.type, success: false, status: 'error',
          details: `命令执行失败: ${cmd.command}`,
          rawOutput: '', timestamp: new Date().toISOString()
        });
      }
    } finally {
      if (conn) this.disconnect(conn);
    }

    return results;
  }

  private async executeCustomDescriptionInspection(device: DeviceInfo, description: string): Promise<ParsedResult[]> {
    const adapter = createVendorAdapter(device.vendor);
    const generatedCommands = await networkCommandGenerator.generateCommands(device.vendor, description);
    const results: ParsedResult[] = [];

    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);

      if (generatedCommands.length > 0) {
        const shellOutput = await this.runCommandsViaShell(conn, device, generatedCommands.map(c => c.command));

        for (const cmd of generatedCommands) {
          const cmdOutput = this.extractCommandOutput(shellOutput, cmd.command);
          if (cmdOutput) {
            const parser = getParser(device.vendor, 'version');
            const parsed = parser(cmdOutput);
            parsed.details = cmd.purpose;
            results.push(parsed);
          } else {
            results.push({
              type: 'version', success: false, status: 'error',
              details: `AI生成命令执行失败: ${cmd.command} (${cmd.purpose})`,
              rawOutput: '', timestamp: new Date().toISOString()
            });
          }
        }
      }

      if (generatedCommands.length === 0) {
        logger.warn('No commands generated for custom description, using fallback');
        const fallbackCommands = adapter.getCommands().slice(0, 3);
        const fallbackShellOutput = await this.runCommandsViaShell(conn, device, fallbackCommands.map(c => c.command));
        for (const cmd of fallbackCommands) {
          const cmdOutput = this.extractCommandOutput(fallbackShellOutput, cmd.command);
          if (cmdOutput) {
            results.push(getParser(device.vendor, cmd.type)(cmdOutput));
          }
        }
      }
    } finally {
      if (conn) this.disconnect(conn);
    }

    return results;
  }

  private async executeCommand(device: DeviceInfo, command: string): Promise<string> {
    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);
      const output = await this.runCommandsViaShell(conn, device, [command]);
      return this.extractCommandOutput(output, command) || output;
    } finally {
      if (conn) this.disconnect(conn);
    }
  }

  // ================================================================
  // Shell 会话核心
  // ================================================================

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
  private runCommandsViaShell(conn: Client, device: DeviceInfo, commands: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const SHELL_TIMEOUT = 180000; // 整个 shell 会话最长 3 分钟
      let stdin: any = null;
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

        stdin = stream;
        let cmdQueue = [...commands];   // 待发送的命令队列
        let currentCmd = '';            // 当前正在执行的命令
        let cmdIndex = 0;               // 命令索引
        let paginationCount = 0;        // 分页按空格计数
        let initPhase = true;           // 初始化阶段（先发 screen-length）
        let initSent = false;
        let angularBracketCount = 0;    // 尖括号计数，用于判断是否收到提示符

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

        stream.on('data', (data: Buffer) => {
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
          // 初始化阶段：等待提示符确认 screen-length 已执行完成
          // 命令执行阶段：检测到提示符说明当前命令已输出完毕

          // shell 提示符特征：行尾是 <...> 或 [...] 格式
          const hasPrompt = /[<\u3008][A-Za-z0-9_-]+[>\u3009]\s*(?:$|$)/m.test(chunk) ||
                            /^[<\u3008][A-Za-z0-9_-]+[>\u3009]/m.test(
                              chunk.split('\n').filter(l => l.trim()).slice(-1)[0] || ''
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
                // 发送下一条
                if (cmdQueue.length > 0) {
                  trySendNextCommand();
                } else if (cmdQueue.length === 0) {
                  // 全部发完，退出
                  stream.write('quit\n');
                  // 但先不 resolve，等退出完成收到的数据
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
        }).stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          if (/(Password|Passwd)[\s]*:/.test(chunk) && device.enable_password) {
            try { stream.write(device.enable_password + '\n'); } catch { /* ignore */ }
          }
          stdout += '[stderr] ' + chunk;
        }).on('close', () => {
          logger.debug(`🔚 Shell 会话关闭，收到 ${(stdout.length / 1024).toFixed(1)}KB 输出`);
          safeResolve(stdout);
        }).on('error', (err) => {
          safeReject(new Error(`Shell 流错误: ${err.message}`));
        });
      });
    });
  }

  /**
   * 从多命令的 shell 输出中提取单个命令的响应
   *
   * 在 shell 输出中，每个命令及其输出格式为：
   *   <prompt>command
   *   ... output ...
   *   <prompt>
   *
   * 但网络设备的 shell 输出可能包含 echo（命令回显），需要智能提取
   */
  private extractCommandOutput(shellOutput: string, command: string): string {
    // 策略：找到命令文本之后的内容，直到下一个命令/结束
    // 命令可能在 shell 输出中的格式：
    //   <设备名>display cpu-usage\r\n
    //   CPU usage: ...
    //   <设备名>

    const lines = shellOutput.split('\n');

    // 找到命令出现的行号
    let cmdLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      // 命令可能出现在行中（回显后）或单独一行
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

  // ================================================================
  // 连接管理
  // ================================================================

  private connectToDevice(device: DeviceInfo): Promise<Client> {
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
        keepaliveCountMax: 3
      });
    });
  }

  private disconnect(conn: Client): void {
    try { conn.end(); } catch { /* ignore */ }
  }

  private generateSummary(results: ParsedResult[]): string {
    const normal = results.filter(r => r.status === 'normal').length;
    const warning = results.filter(r => r.status === 'warning').length;
    const critical = results.filter(r => r.status === 'critical').length;
    const error = results.filter(r => r.status === 'error').length;

    if (critical > 0) {
      return `发现 ${critical} 个严重问题，${warning} 个警告，需要立即处理`;
    }
    if (warning > 0) {
      return `发现 ${warning} 个警告项，建议关注`;
    }
    if (error > 0) {
      return `${error} 个命令执行失败，请检查设备连接`;
    }
    return `巡检完成，${normal} 项全部正常`;
  }
}

export const networkInspectionService = new NetworkInspectionService();
