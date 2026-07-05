/**
 * =============================================================================
 * AI 修复服务 - 分析步骤：生成验证和回滚 prompt
 * =============================================================================
 */

import type { AiRemediationInput } from './aiRemediationService';

/**
 * 根据修复命令生成验证 prompt
 * 智能推断需要执行的验证命令
 */
export function impl_generateVerificationPrompt(input: AiRemediationInput, commandsText: string): string {
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
export function impl_generateRollbackPrompt(input: AiRemediationInput, commandsText: string): string {
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