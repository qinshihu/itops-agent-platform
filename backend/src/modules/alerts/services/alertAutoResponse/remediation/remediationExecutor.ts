/**
 * =============================================================================
 * AARS v2 — 修复执行器
 *
 * 职责：
 *   1. 接收修复计划和授权决策（auto / approve）
 *   2. SSH 执行修复命令（含超时保护）
 *   3. 执行后触发验证门禁链
 *   4. 如果验证失败且配置了回滚，执行回滚
 *   5. 自动执行后通知降噪系统
 * =============================================================================
 */

import { Client } from 'ssh2';
import { alertRepository, networkDeviceRepository, serversRepo, settingsRepository } from '../../../../../repositories';
import { decrypt } from '../../../../auth/services/encryptionService';
import { logger } from '../../../../../utils/logger';
import { verificationGates } from './verificationGates';
import { knowledgeFeedbackLoop } from '../adaptive/knowledgeFeedbackLoop';
import type {
  DeviceRuntimeProfile, RemediationPlan, RemediationCommand,
  ProbeResult, VerificationChainResult,
} from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';

export interface ExecutionResult {
  success: boolean;
  executedCommands: Array<{ command: string; success: boolean; output: string }>;
  verificationResult: VerificationChainResult;
  durationMs: number;
  error?: string;
  rolledBack: boolean;
  rollbackResult?: string;
  diagnosticAfter: string;
}

class RemediationExecutor {
  /**
   * 执行修复方案
   *
   * @param plan 修复方案
   * @param device 设备画像
   * @param probeResults 之前的探针结果（用于验证对比）
   * @param alertId 告警 ID
   * @param alertTitle 告警标题
   */
  async execute(
    plan: RemediationPlan,
    device: DeviceRuntimeProfile,
    probeResults: ProbeResult[],
    alertId: string,
    alertTitle: string
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const executedCommands: ExecutionResult['executedCommands'] = [];

    logger.info(
      `[RemediationExecutor] Executing ${plan.commands.length} commands on ${device.hostname} ` +
      `autoApproved=${!plan.requiresApproval}`
    );

    // Step 1: 逐条执行修复命令
    for (const cmd of plan.commands) {
      try {
        const output = await this.executeCommand(
          device,
          cmd,
        );
        executedCommands.push({
          command: cmd.command,
          success: output.success,
          output: output.output,
        });
        if (!output.success && !cmd.allowFailure) {
          throw new Error(`Command failed: ${cmd.command} - ${output.output}`);
        }
      } catch (err: unknown) {
        executedCommands.push({
          command: cmd.command,
          success: false,
          output: getErrorMessage(err),
        });

        // 不允许失败的命令 → 触发回滚
        if (!cmd.allowFailure) {
          logger.error(`[RemediationExecutor] Fatal command failure: ${getErrorMessage(err)}`);

          // 执行回滚
          const rollbackResult = await this.executeRollback(plan, device);

          return {
            success: false,
            executedCommands,
            verificationResult: {
              result: 'failed',
              stages: [{ stage: 'command_success', passed: false, skipped: false, detail: getErrorMessage(err) }],
              failedStage: 'command_success',
              diagnosticAfterRemediation: '',
            },
            durationMs: Date.now() - start,
            error: getErrorMessage(err),
            rolledBack: true,
            rollbackResult,
            diagnosticAfter: '',
          };
        }
      }
    }

    // Step 2: 验证门禁链
    const verificationResult = await verificationGates.verify(
      device,
      plan,
      probeResults,
      alertTitle
    );

    // Step 3: 验证未通过 → 回滚
    let rolledBack = false;
    let rollbackResult: string | undefined;
    if (verificationResult.result === 'failed' && plan.rollbackCommands.length > 0) {
      rollbackResult = await this.executeRollback(plan, device);
      rolledBack = true;
    }

    // Step 4: 反馈闭环
    try {
      await knowledgeFeedbackLoop.feedback({
        alertId,
        alertTitle,
        alertSource: 'aars',
        alertSeverity: 'medium',
        device,
        probesUsed: probeResults,
        rootCause: plan.summary,
        remediationPlan: plan,
        verificationResult,
        overallSuccess: verificationResult.result === 'passed',
        executionCommands: executedCommands.map(e => e.command),
        durationMs: Date.now() - start,
      });
    } catch (err: unknown) {
      logger.warn(`[RemediationExecutor] Feedback loop error: ${getErrorMessage(err)}`);
    }

    // Step 5: 成功 → 标记告警已解决 + 通知降噪
    if (verificationResult.result === 'passed' || verificationResult.result === 'partially_passed_with_warning') {
      this.markAlertResolved(alertId, plan.summary);
      this.notifyNoiseReduction(alertId, alertTitle);
    }

    return {
      success: verificationResult.result !== 'failed',
      executedCommands,
      verificationResult,
      durationMs: Date.now() - start,
      rolledBack,
      rollbackResult,
      diagnosticAfter: verificationResult.diagnosticAfterRemediation,
    };
  }

  /**
   * 执行单条命令
   */
  private async executeCommand(
    device: DeviceRuntimeProfile,
    cmd: RemediationCommand
  ): Promise<{ success: boolean; output: string }> {
    try {
      const creds = this.getDeviceCredentials(device);

      const output = await new Promise<string>((resolve, reject) => {
        const conn = new Client();
        let result = '';
        const timer = setTimeout(() => {
          conn.end();
          reject(new Error(`Command timeout after ${cmd.timeoutMs}ms`));
        }, cmd.timeoutMs);

        conn.on('ready', () => {
          conn.exec(cmd.command, { pty: { term: 'vt100', cols: 200, rows: 50 } }, (err, stream) => {
            if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
            stream.on('data', (data: Buffer) => { result += data.toString('utf8'); });
            stream.stderr.on('data', (data: Buffer) => { result += data.toString('utf8'); });
            stream.on('close', (code: number) => {
              clearTimeout(timer);
              conn.end();
              // 只以非零退出码为失败（但"成功"关闭也算成功返回）
              resolve(result || `(exit code: ${code})`);
            });
          });
        });
        conn.on('error', (err) => { clearTimeout(timer); reject(err); });

        conn.connect({
          host: device.ip,
          port: creds.port || 22,
          username: creds.username || 'root',
          password: creds.password,
          readyTimeout: cmd.timeoutMs,
        });
      });

      return { success: true, output: output.substring(0, 2000) };
    } catch (err: unknown) {
      return { success: false, output: `[ERROR] ${getErrorMessage(err)}` };
    }
  }

  /**
   * 执行回滚命令
   */
  private async executeRollback(plan: RemediationPlan, device: DeviceRuntimeProfile): Promise<string> {
    const parts: string[] = [];
    for (const cmd of plan.rollbackCommands) {
      try {
        const { output } = await this.executeCommand(device, cmd);
        parts.push(`Rollback '${cmd.command}': ${output}`);
      } catch (err: unknown) {
        parts.push(`Rollback '${cmd.command}': ERROR - ${getErrorMessage(err)}`);
      }
    }
    const result = parts.join('\n');
    logger.warn(`[RemediationExecutor] Rollback executed on ${device.hostname}: ${result.substring(0, 200)}`);
    return result;
  }

  /**
   * 获取 SSH 凭证
   */
  private getDeviceCredentials(device: DeviceRuntimeProfile): { username?: string; password?: string; port?: number } {
    try {
      if (device.type === 'server') {
        const sv = serversRepo.getById(device.deviceId);
        if (sv) {
          return {
            username: sv.username,
            password: sv.password ? decrypt(sv.password) : undefined,
            port: sv.port || 22,
          };
        }
      } else {
        const nd = networkDeviceRepository.getSshCredentials(device.deviceId);
        if (nd?.username) {
          return {
            username: nd.username,
            password: nd.password ? decrypt(nd.password) : undefined,
            port: nd.ssh_port || 22,
          };
        }
      }
    } catch { /* ignore */ }
    return { username: 'root' };
  }

  /**
   * 标记告警已解决
   */
  private markAlertResolved(alertId: string, summary: string): void {
    try {
      alertRepository.resolve(alertId);
      logger.info(`[RemediationExecutor] Alert ${alertId} marked as resolved: ${summary}`);
    } catch (err: unknown) {
      logger.warn(`Failed to resolve alert ${alertId}: ${getErrorMessage(err)}`);
    }
  }

  /**
   * 通知降噪系统
   */
  private notifyNoiseReduction(alertId: string, alertTitle: string): void {
    try {
      const source = alertRepository.getSourceById(alertId);
      if (!source) return;
      settingsRepository.upsert(
        `self_healed:${source}:${alertTitle.substring(0, 100)}`,
        new Date().toISOString()
      );
    } catch {
      // 可忽略
    }
  }
}

export const remediationExecutor = new RemediationExecutor();
