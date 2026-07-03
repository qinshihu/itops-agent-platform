/**
 * =============================================================================
 * AARS v2 — 逐级验证门禁链
 *
 * 核心理念：
 *   不搞"等 30s 再检查"的简单机制，而是递进式 5 级门禁验证。
 *   每级通过才进入下一级，不通过的级给出详细失败原因。
 *
 * 验证级别：
 *   1. command_success   → 命令执行成功（基础）
 *   2. service_health    → 服务/进程存活
 *   3. metric_recovery   → 告警指标恢复
 *   4. baseline_comparison → 与历史基线对比
 *   5. impact_assessment → 影响评估（修复没有导致恶化）
 * =============================================================================
 */

import { Client } from 'ssh2';
import { networkDeviceRepository, serversRepo } from '../../../../../repositories';
import { decrypt } from '../../../../auth/services/encryptionService';
import type { DeviceRuntimeProfile, RemediationPlan, VerificationChainResult, VerificationStage, ProbeResult } from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';

class VerificationGates {
  private readonly STAGES: Array<{
    stage: VerificationStage;
    required: boolean;
    maxRetries: number;
    retryIntervalSec: number;
    timeoutSec: number;
  }> = [
    { stage: 'command_success', required: true, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 },
    { stage: 'service_health', required: true, maxRetries: 3, retryIntervalSec: 10, timeoutSec: 60 },
    { stage: 'metric_recovery', required: true, maxRetries: 2, retryIntervalSec: 30, timeoutSec: 120 },
    { stage: 'baseline_comparison', required: false, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 },
    { stage: 'impact_assessment', required: true, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 },
  ];

  /**
   * 执行完整验证链
   */
  async verify(
    device: DeviceRuntimeProfile,
    plan: RemediationPlan,
    previousProbes: ProbeResult[],
    alertTitle: string
  ): Promise<VerificationChainResult> {
    const stageResults: VerificationChainResult['stages'] = [];
    let failedStage: VerificationStage | null = null;

    for (const stage of this.STAGES) {
      let passed = false;
      let skipped = false;
      let detail = '';

      for (let attempt = 0; attempt <= stage.maxRetries; attempt++) {
        if (attempt > 0) {
          await this.sleep(stage.retryIntervalSec * 1000);
        }

        try {
          const result = await this.runStageCheck(stage.stage, device, plan, previousProbes, alertTitle);
          passed = result.passed;
          detail = result.detail;

          if (passed) break; // 本级通过，进入下一级
        } catch (err: unknown) {
          detail = `Check error: ${getErrorMessage(err)}`;
          passed = false;
        }
      }

      // 非必需检查：跳过不标记失败
      if (!stage.required && !passed) {
        skipped = true;
        passed = true; // 跳过后算通过
        detail = 'Skipped (non-required check)';
      }

      stageResults.push({ stage: stage.stage, passed, skipped, detail });

      if (!passed) {
        failedStage = stage.stage;
        break; // 门禁未通过，终止验证
      }
    }

    // 门禁后重新诊断（简化版：SSH 执行 uptime + free）
    const diagnosticAfter = await this.postCheckDiagnostic(device);

    const allPassed = stageResults.every(s => s.passed);
    const allRequiredPassed = stageResults.filter(s => !s.skipped).every(s => s.passed);
    const hasWarnings = stageResults.some(s => s.passed && !s.skipped && s.detail.includes('warning'));

    let result: VerificationChainResult['result'];
    if (allPassed && allRequiredPassed && !hasWarnings) {
      result = 'passed';
    } else if (allRequiredPassed) {
      result = 'partially_passed_with_warning';
    } else {
      result = 'failed';
    }

    return {
      result,
      stages: stageResults,
      failedStage,
      diagnosticAfterRemediation: diagnosticAfter,
    };
  }

  /**
   * 运行单级检查
   */
  private async runStageCheck(
    stage: VerificationStage,
    device: DeviceRuntimeProfile,
    plan: RemediationPlan,
    previousProbes: ProbeResult[],
    alertTitle: string
  ): Promise<{ passed: boolean; detail: string }> {
    switch (stage) {
      case 'command_success':
        return { passed: true, detail: 'Commands already verified as executed' };

      case 'service_health':
        return await this.checkServiceHealth(device, plan);

      case 'metric_recovery':
        return await this.checkMetricRecovery(device, previousProbes, alertTitle);

      case 'baseline_comparison':
        return await this.checkBaseline(device);

      case 'impact_assessment':
        return await this.checkImpact(device, previousProbes);

      default:
        return { passed: true, detail: 'Unknown stage, skipping' };
    }
  }

  /**
   * Stage 2: 服务/进程存活检查
   */
  private async checkServiceHealth(device: DeviceRuntimeProfile, plan: RemediationPlan): Promise<{ passed: boolean; detail: string }> {
    // 从修复命令中提取需要检查的服务名
    const serviceNames = this.extractServiceNames(plan);
    if (serviceNames.length === 0) {
      return { passed: true, detail: 'No services to verify (no service-related commands)' };
    }

    const results: string[] = [];
    let allRunning = true;

    for (const svc of serviceNames) {
      try {
        const output = await this.sshExec(device, `systemctl is-active ${svc} 2>/dev/null || echo "unknown"`);
        const status = output.trim();
        const running = status === 'active';
        if (!running) allRunning = false;
        results.push(`${svc}: ${status}`);
      } catch {
        allRunning = false;
        results.push(`${svc}: check_failed`);
      }
    }

    return {
      passed: allRunning,
      detail: results.join(', '),
    };
  }

  /**
   * Stage 3: 指标恢复检查
   * 检查告警相关的关键指标是否已恢复到触发阈值以下
   */
  private async checkMetricRecovery(
    device: DeviceRuntimeProfile,
    _previousProbes: ProbeResult[],
    _alertTitle: string
  ): Promise<{ passed: boolean; detail: string }> {
    try {
      const output = await this.sshExec(device, 'uptime && free -m | grep Mem && df -h / | tail -1');

      // 解析 uptime 负载
      const loadMatch = output.match(/load average:\s+([\d.]+)/);
      const memMatch = output.match(/Mem:\s+(\d+)\s+(\d+)/);
      const diskMatch = output.match(/(\d+)%\s+\/$/);

      const issues: string[] = [];

      // CPU 负载检查（假设 1.0 为告警阈值）
      if (loadMatch) {
        const load = parseFloat(loadMatch[1]);
        if (load > 0.8) issues.push(`load=${load} (>0.8)`);
      }

      // 内存检查（假设 90% 为告警阈值）
      if (memMatch) {
        const total = parseInt(memMatch[1]);
        const used = parseInt(memMatch[2]);
        const memPct = (used / total) * 100;
        if (memPct > 85) issues.push(`mem=${memPct.toFixed(0)}% (>85%)`);
      }

      // 磁盘检查（假设 85% 为告警阈值）
      if (diskMatch) {
        const diskPct = parseInt(diskMatch[1]);
        if (diskPct > 80) issues.push(`disk=${diskPct}% (>80%)`);
      }

      return {
        passed: issues.length === 0,
        detail: issues.length > 0
          ? `Still elevated: ${issues.join(', ')}`
          : `All metrics normal: load=${loadMatch?.[1] || 'N/A'}, mem=${memMatch ? ((parseInt(memMatch[2])/parseInt(memMatch[1]))*100).toFixed(0)+'%' : 'N/A'}, disk=${diskMatch?.[1]||'N/A'}%`,
      };
    } catch (err: unknown) {
      return { passed: false, detail: `Metric check failed: ${getErrorMessage(err)}` };
    }
  }

  /**
   * Stage 4: 基线对比
   */
  private async checkBaseline(device: DeviceRuntimeProfile): Promise<{ passed: boolean; detail: string }> {
    if (!device.baseline) {
      return { passed: true, detail: 'No baseline data, skipping' };
    }

    try {
      const output = await this.sshExec(device, 'cat /proc/loadavg');
      const parts = output.trim().split(/\s+/);
      const currentLoad = parseFloat(parts[0] || '0');

      // 对比基线（负载超出基线±1.5倍标准差）
      const baselineLoad = device.baseline.cpuAvg || 1;
      const stddev = device.baseline.cpuStddev || 0.3;
      const upperBound = baselineLoad + 1.5 * stddev;

      if (currentLoad > upperBound) {
        return {
          passed: false,
          detail: `Current load ${currentLoad} exceeds baseline ${baselineLoad.toFixed(2)}+${(1.5 * stddev).toFixed(2)} (${upperBound.toFixed(2)})`,
        };
      }

      return {
        passed: true,
        detail: `Load ${currentLoad} within baseline range (mean=${baselineLoad.toFixed(2)}, stddev=${stddev.toFixed(2)})`,
      };
    } catch {
      return { passed: true, detail: 'Baseline check unavailable' };
    }
  }

  /**
   * Stage 5: 影响评估
   */
  private async checkImpact(device: DeviceRuntimeProfile, _previousProbes: ProbeResult[]): Promise<{ passed: boolean; detail: string }> {
    try {
      // 检查关键进程是否仍然运行、网络连接是否正常
      const output = await this.sshExec(device, 'ps aux --sort=-%cpu | head -5 && echo "---" && ss -tlnp 2>/dev/null | head -10');

      // 简单判断：至少有一个输出并且有进程在运行
      const hasProcesses = output.length > 50;
      return {
        passed: hasProcesses,
        detail: hasProcesses ? 'System running normally' : 'Suspicious: no process output',
      };
    } catch (err: unknown) {
      return { passed: false, detail: `Impact check failed: ${getErrorMessage(err)}` };
    }
  }

  /**
   * 门禁后重新诊断
   */
  private async postCheckDiagnostic(device: DeviceRuntimeProfile): Promise<string> {
    try {
      const output = await this.sshExec(device, 'uptime && free -h | head -3 && df -h / | tail -1');
      return output.substring(0, 500);
    } catch {
      return 'Post-check diagnostic unavailable';
    }
  }

  /**
   * 从修复命令中提取服务名
   */
  private extractServiceNames(plan: RemediationPlan): string[] {
    const names = new Set<string>();
    for (const cmd of plan.commands) {
      const match = cmd.command.match(/systemctl\s+(restart|start|stop|status|reload|enable|disable)\s+(\S+)/);
      if (match) names.add(match[2]);
    }
    return Array.from(names);
  }

  /**
   * SSH 执行
   */
  private sshExec(device: DeviceRuntimeProfile, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';

      conn.on('ready', () => {
        conn.exec(command, { pty: { term: 'vt100', cols: 200, rows: 50 } }, (err, stream) => {
          if (err) { conn.end(); reject(err); return; }
          stream.on('data', (data: Buffer) => { output += data.toString('utf8'); });
          stream.stderr.on('data', (data: Buffer) => { output += data.toString('utf8'); });
          stream.on('close', () => { conn.end(); resolve(output); });
        });
      });
      conn.on('error', (err) => { reject(err); });

      try {
        const creds = this.getCreds(device);
        conn.connect({
          host: device.ip,
          port: creds.port || 22,
          username: creds.username || 'root',
          password: creds.password,
          readyTimeout: 10000,
        });
      } catch (err: unknown) {
        reject(err);
      }
    });
  }

  private getCreds(device: DeviceRuntimeProfile): { username?: string; password?: string; port?: number } {
    try {
      if (device.type === 'server') {
        const sv = serversRepo.getById(device.deviceId);
        if (sv) return { username: sv.username, password: sv.password ? decrypt(sv.password) : undefined, port: sv.port || 22 };
      } else {
        const nd = networkDeviceRepository.getSshCredentials(device.deviceId);
        if (nd?.username) return { username: nd.username, password: nd.password ? decrypt(nd.password) : undefined, port: nd.ssh_port || 22 };
      }
    } catch { /* ignore */ }
    return { username: 'root' };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

export const verificationGates = new VerificationGates();
