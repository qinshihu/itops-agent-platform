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
      let results: ParsedResult[] = [];
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
        'UPDATE network_devices SET last_inspection_at = CURRENT_TIMESTAMP, last_inspection_result = ? WHERE id = ?'
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

  private async executeStandardInspection(device: DeviceInfo): Promise<ParsedResult[]> {
    const adapter = createVendorAdapter(device.vendor);
    const commands = adapter.getCommands();
    const results: ParsedResult[] = [];

    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);

      for (const cmd of commands) {
        try {
          const output = await this.sendCommand(conn, cmd.command, device.enable_password);
          const parser = getParser(device.vendor, cmd.type);
          const parsed = parser(output);
          results.push(parsed);
        } catch (error) {
          logger.warn(`Command failed: ${cmd.command} - ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.push({
            type: cmd.type,
            success: false,
            status: 'error',
            details: `命令执行失败: ${cmd.command}`,
            rawOutput: '',
            timestamp: new Date().toISOString()
          });
        }
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

    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);

      for (const cmd of commands) {
        try {
          const output = await this.sendCommand(conn, cmd.command, device.enable_password);
          const parser = getParser(device.vendor, cmd.type);
          const parsed = parser(output);
          results.push(parsed);
        } catch (error) {
          logger.warn(`Custom command failed: ${cmd.command} - ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.push({
            type: cmd.type,
            success: false,
            status: 'error',
            details: `自定义命令执行失败: ${cmd.command}`,
            rawOutput: '',
            timestamp: new Date().toISOString()
          });
        }
      }
    } finally {
      if (conn) {
        this.disconnect(conn);
      }
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

      for (const cmd of generatedCommands) {
        try {
          const output = await this.sendCommand(conn, cmd.command, device.enable_password);
          const parser = getParser(device.vendor, 'version');
          const parsed = parser(output);
          parsed.details = cmd.purpose;
          results.push(parsed);
        } catch (error) {
          logger.warn(`AI generated command failed: ${cmd.command} - ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.push({
            type: 'version',
            success: false,
            status: 'error',
            details: `AI生成命令执行失败: ${cmd.command} (${cmd.purpose})`,
            rawOutput: '',
            timestamp: new Date().toISOString()
          });
        }
      }

      if (generatedCommands.length === 0) {
        logger.warn('No commands generated for custom description, using fallback');
        const fallbackCommands = adapter.getCommands().slice(0, 3);
        for (const cmd of fallbackCommands) {
          try {
            const output = await this.sendCommand(conn, cmd.command, device.enable_password);
            const parser = getParser(device.vendor, cmd.type);
            results.push(parser(output));
          } catch (error) {
            logger.warn(`Fallback command failed: ${cmd.command}`);
          }
        }
      }
    } finally {
      if (conn) {
        this.disconnect(conn);
      }
    }

    return results;
  }

  private async executeCommand(device: DeviceInfo, command: string): Promise<string> {
    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);
      return await this.sendCommand(conn, command, device.enable_password);
    } finally {
      if (conn) {
        this.disconnect(conn);
      }
    }
  }

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
          try { conn.end(); } catch {}
          reject(error);
        }
      };

      connectTimeout = setTimeout(() => {
        safeReject(new Error('SSH connection timeout (10s)'));
      }, 10000);

      conn.on('ready', () => {
        logger.debug(`SSH connected to ${device.name} (${device.ip_address})`);
        safeResolve(conn);
      }).on('error', (err) => {
        safeReject(new Error(`SSH connection error: ${err.message}`));
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

  private sendCommand(conn: Client, command: string, enablePassword?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let commandTimeout: NodeJS.Timeout | null = null;
      let isResolved = false;
      let stdout = '';
      let stderr = '';

      const safeResolve = (output: string) => {
        if (!isResolved) {
          isResolved = true;
          if (commandTimeout) clearTimeout(commandTimeout);
          resolve(output);
        }
      };

      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          if (commandTimeout) clearTimeout(commandTimeout);
          reject(error);
        }
      };

      commandTimeout = setTimeout(() => {
        safeReject(new Error('Command timeout (30s)'));
      }, 30000);

      conn.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          safeReject(new Error(`Command execution error: ${err.message}`));
          return;
        }

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        }).stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        }).on('close', () => {
          if (stderr.includes('Password:') && enablePassword) {
            stream.write(enablePassword + '\n');
          }
          safeResolve(stdout);
        }).on('error', (err) => {
          safeReject(new Error(`Stream error: ${err.message}`));
        });
      });
    });
  }

  private disconnect(conn: Client): void {
    try {
      conn.end();
    } catch {}
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
