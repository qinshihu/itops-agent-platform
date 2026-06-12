/**
 * 内置运维剧本 (Playbooks) — ITOps Agent Platform
 *
 * 提供开箱即用的常见运维场景自动化方案。
 * 适用中小企业：没有专职运维架构师也能快速处理常见故障。
 *
 * 结构：
 * - detect: 检测条件（如何判断该剧本适用）
 * - diagnose: 诊断步骤（需要执行哪些命令/检查）
 * - action: 处置步骤（自动执行的操作序列）
 * - escalateToHuman: 自动尝试失败后的升级策略
 */

import { logger } from '../utils/logger';

// ================ 类型定义 ================

export interface PlaybookStep {
  type: 'command' | 'script' | 'agent' | 'message' | 'condition';
  label: string;
  // command: 在指定服务器上执行的 shell 命令
  command?: string;
  // scriptId: 引用预定义脚本
  scriptId?: string;
  // agentId: 引用 AI Agent
  agentId?: string;
  // condition: 条件检查
  condition?: string;
  // message: 需要人工介入时发送的消息
  message?: string;
  // timeout: 步骤超时秒数
  timeout?: number;
  // allowFailure: 是否允许此步骤失败后继续
  allowFailure?: boolean;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'system' | 'network' | 'service' | 'security' | 'storage';
  tags: string[];
  detect: {
    type: 'metric' | 'log' | 'webhook' | 'manual';
    condition: string;        // 检测条件描述
    triggerExpression?: string; // 可执行的检测表达式
  };
  diagnose: PlaybookStep[];
  action: PlaybookStep[];
  escalateToHuman: number;    // N 次自动失败后通知人工
  cooldownMs: number;         // 同类型告警冷却时间
  enabled: boolean;
  isPreset: boolean;
  stats?: {
    executedCount: number;
    successCount: number;
    lastExecutedAt?: string;
  };
}

// ================ 内置剧本 ================

export const BUILTIN_PLAYBOOKS: Playbook[] = [
  // === 系统类 ===
  {
    id: 'disk-full',
    name: '磁盘空间不足自动清理',
    description: '检测磁盘使用率超过 90% 并自动清理常见占用空间',
    severity: 'warning',
    category: 'storage',
    tags: ['disk', 'cleanup', 'auto-recovery'],
    detect: {
      type: 'metric',
      condition: 'disk_usage > 90%',
      triggerExpression: 'df -h / | awk \'NR==2 {print $5}\' | sed \'s/%//\'',
    },
    diagnose: [
      { type: 'command', label: '检查磁盘使用情况', command: 'df -h', timeout: 10 },
      { type: 'command', label: '查找大目录', command: 'du -sh /* 2>/dev/null | sort -rh | head -10', timeout: 30 },
      { type: 'command', label: '检查已删除但仍占用文件', command: 'lsof +L1 2>/dev/null | head -20', timeout: 15 },
    ],
    action: [
      { type: 'command', label: '清理 journalctl 日志', command: 'journalctl --vacuum-size=100M 2>/dev/null || true', timeout: 30, allowFailure: true },
      { type: 'command', label: '清理 Docker 未使用资源', command: 'docker system prune -f --volumes 2>/dev/null || true', timeout: 60, allowFailure: true },
      { type: 'command', label: '清理 apt/yum 缓存', command: 'apt-get clean -y 2>/dev/null || yum clean all 2>/dev/null || true', timeout: 30, allowFailure: true },
      { type: 'command', label: '清理临时文件', command: 'rm -rf /tmp/* 2>/dev/null; find /var/tmp -type f -atime +7 -delete 2>/dev/null || true', timeout: 30, allowFailure: true },
      { type: 'command', label: '验证清理结果', command: 'df -h /', timeout: 10 },
    ],
    escalateToHuman: 3,
    cooldownMs: 3600000,     // 1 小时内不重复
    enabled: true,
    isPreset: true,
  },
  {
    id: 'high-cpu',
    name: 'CPU 负载过高诊断',
    description: 'CPU 负载持续过高时分析主要进程并给出建议',
    severity: 'warning',
    category: 'system',
    tags: ['cpu', 'performance', 'diagnosis'],
    detect: {
      type: 'metric',
      condition: 'cpu_load > 80% for 5 minutes',
      triggerExpression: 'top -bn1 | awk \'NR==1{print $10}\' | sed \'s/,//\'',
    },
    diagnose: [
      { type: 'command', label: '查看 CPU 占用 Top10', command: 'ps aux --sort=-%cpu | head -11', timeout: 10 },
      { type: 'command', label: '查看负载和运行队列', command: 'uptime && cat /proc/loadavg', timeout: 10 },
      { type: 'command', label: '检查 CPU 信息', command: 'lscpu | grep -E "^(CPU|Thread|Core|Socket|Model name)"', timeout: 10 },
      { type: 'command', label: '检查 IO 等待', command: 'iostat -x 1 3 2>/dev/null | tail -20 || vmstat 1 3 | tail -5', timeout: 15, allowFailure: true },
    ],
    action: [
      { type: 'message', label: '生成诊断报告', message: 'CPU 高负载诊断完成，请查看报告详情' },
    ],
    escalateToHuman: 1,
    cooldownMs: 1800000,
    enabled: true,
    isPreset: true,
  },
  {
    id: 'memory-pressure',
    name: '内存压力诊断与清理',
    description: '内存使用率过高时诊断并尝试释放可回收内存',
    severity: 'warning',
    category: 'system',
    tags: ['memory', 'performance'],
    detect: {
      type: 'metric',
      condition: 'memory_usage > 85%',
      triggerExpression: 'free | awk \'/Mem/ {printf "%.0f", $3/$2 * 100}\'',
    },
    diagnose: [
      { type: 'command', label: '查看内存使用详情', command: 'free -h && cat /proc/meminfo | head -15', timeout: 10 },
      { type: 'command', label: '查看内存占用 Top10 进程', command: 'ps aux --sort=-%mem | head -11', timeout: 10 },
      { type: 'command', label: '检查 Swap 使用', command: 'swapon --show 2>/dev/null; free -h | grep -i swap', timeout: 10 },
    ],
    action: [
      { type: 'command', label: '释放 PageCache', command: 'sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true', timeout: 15, allowFailure: true },
      { type: 'command', label: '验证释放结果', command: 'free -h', timeout: 10 },
    ],
    escalateToHuman: 2,
    cooldownMs: 1800000,
    enabled: true,
    isPreset: true,
  },

  // === 服务类 ===
  {
    id: 'nginx-down',
    name: 'Nginx 服务异常自动恢复',
    description: '检测 Nginx 服务不可用时自动尝试重启',
    severity: 'critical',
    category: 'service',
    tags: ['nginx', 'web', 'auto-recovery'],
    detect: {
      type: 'log',
      condition: 'Nginx health check failed',
    },
    diagnose: [
      { type: 'command', label: '检查 Nginx 进程状态', command: 'systemctl status nginx 2>/dev/null || service nginx status 2>/dev/null || ps aux | grep nginx | grep -v grep', timeout: 10 },
      { type: 'command', label: '检查 Nginx 配置语法', command: 'nginx -t 2>&1 || true', timeout: 10 },
      { type: 'command', label: '检查端口占用', command: 'ss -tlnp | grep -E ":80|:443" || netstat -tlnp 2>/dev/null | grep -E ":80|:443"', timeout: 10 },
      { type: 'command', label: '检查系统日志', command: 'journalctl -u nginx --no-pager -n 20 2>/dev/null || dmesg | tail -20', timeout: 15, allowFailure: true },
    ],
    action: [
      { type: 'command', label: '尝试重启 Nginx', command: 'systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null || nginx -s reload 2>/dev/null || true', timeout: 30 },
      { type: 'command', label: '验证恢复', command: 'curl -sf -o /dev/null -w "%{http_code}" http://localhost/ || echo "FAILED"', timeout: 15 },
    ],
    escalateToHuman: 3,
    cooldownMs: 600000,
    enabled: true,
    isPreset: true,
  },
  {
    id: 'mysql-down',
    name: 'MySQL/MariaDB 服务异常自动恢复',
    description: '检测 MySQL 服务不可用时自动尝试重启',
    severity: 'critical',
    category: 'service',
    tags: ['mysql', 'database', 'auto-recovery'],
    detect: {
      type: 'log',
      condition: 'MySQL connection failed',
    },
    diagnose: [
      { type: 'command', label: '检查 MySQL 进程', command: 'systemctl status mysql 2>/dev/null || systemctl status mariadb 2>/dev/null || service mysql status 2>/dev/null', timeout: 10 },
      { type: 'command', label: '检查 MySQL 错误日志', command: 'tail -50 /var/log/mysql/error.log 2>/dev/null || tail -50 /var/log/mariadb/mariadb.log 2>/dev/null || true', timeout: 15, allowFailure: true },
      { type: 'command', label: '检查磁盘和 inode', command: 'df -h /var/lib/mysql 2>/dev/null; df -i /var/lib/mysql 2>/dev/null', timeout: 10 },
    ],
    action: [
      { type: 'command', label: '尝试重启 MySQL', command: 'systemctl restart mysql 2>/dev/null || systemctl restart mariadb 2>/dev/null || service mysql restart 2>/dev/null || true', timeout: 30 },
      { type: 'command', label: '验证连接', command: 'mysqladmin ping 2>/dev/null || echo "FAILED"', timeout: 15, allowFailure: true },
    ],
    escalateToHuman: 3,
    cooldownMs: 600000,
    enabled: true,
    isPreset: true,
  },
  {
    id: 'docker-daemon-down',
    name: 'Docker Daemon 异常自动恢复',
    description: '检测 Docker 服务不可用时自动尝试重启',
    severity: 'critical',
    category: 'service',
    tags: ['docker', 'container', 'auto-recovery'],
    detect: {
      type: 'log',
      condition: 'Docker daemon not responding',
    },
    diagnose: [
      { type: 'command', label: '检查 Docker 进程', command: 'systemctl status docker 2>/dev/null || service docker status 2>/dev/null', timeout: 10 },
      { type: 'command', label: '检查 Docker 日志', command: 'journalctl -u docker --no-pager -n 30 2>/dev/null || true', timeout: 15, allowFailure: true },
    ],
    action: [
      { type: 'command', label: '尝试重启 Docker', command: 'systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || true', timeout: 30 },
      { type: 'command', label: '验证恢复', command: 'docker info >/dev/null 2>&1 && echo "OK" || echo "FAILED"', timeout: 15 },
    ],
    escalateToHuman: 3,
    cooldownMs: 600000,
    enabled: true,
    isPreset: true,
  },

  // === 网络类 ===
  {
    id: 'dns-resolution',
    name: 'DNS 解析异常诊断',
    description: '域名解析失败时诊断 DNS 配置和服务状态',
    severity: 'warning',
    category: 'network',
    tags: ['dns', 'network', 'diagnosis'],
    detect: {
      type: 'log',
      condition: 'DNS resolution failure',
    },
    diagnose: [
      { type: 'command', label: '检查 DNS 配置', command: 'cat /etc/resolv.conf', timeout: 10 },
      { type: 'command', label: '测试 DNS 解析', command: 'nslookup google.com 2>/dev/null || dig google.com 2>/dev/null || host google.com 2>/dev/null || true', timeout: 15 },
      { type: 'command', label: '检查网络连通性', command: 'ping -c 3 -W 5 114.114.114.114 2>/dev/null || ping -c 3 -W 5 8.8.8.8 2>/dev/null || true', timeout: 20, allowFailure: true },
    ],
    action: [
      { type: 'command', label: '刷新 DNS 缓存', command: 'systemctl restart systemd-resolved 2>/dev/null || /etc/init.d/nscd restart 2>/dev/null || true', timeout: 15, allowFailure: true },
    ],
    escalateToHuman: 2,
    cooldownMs: 300000,
    enabled: true,
    isPreset: true,
  },

  // === 安全类 ===
  {
    id: 'failed-ssh-login',
    name: 'SSH 暴力破解检测与防御',
    description: '检测大量 SSH 失败登录并自动封禁来源 IP',
    severity: 'critical',
    category: 'security',
    tags: ['ssh', 'security', 'fail2ban'],
    detect: {
      type: 'log',
      condition: 'SSH failed login attempts > 10 in 5 minutes',
    },
    diagnose: [
      { type: 'command', label: '查看最近失败登录', command: 'lastb | head -20', timeout: 10, allowFailure: true },
      { type: 'command', label: '查看 auth.log 中的失败尝试', command: 'grep "Failed password" /var/log/auth.log 2>/dev/null | tail -20 || grep "Failed password" /var/log/secure 2>/dev/null | tail -20 || true', timeout: 15, allowFailure: true },
    ],
    action: [
      { type: 'command', label: '检查 fail2ban 状态', command: 'fail2ban-client status sshd 2>/dev/null || echo "fail2ban not installed"', timeout: 10, allowFailure: true },
      { type: 'command', label: '添加临时防火墙规则', command: 'iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set --name SSH 2>/dev/null; iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 300 --hitcount 5 -j DROP 2>/dev/null || true', timeout: 15, allowFailure: true },
      { type: 'message', label: '安全告警', message: '检测到 SSH 暴力破解尝试，已启用临时限速，建议安装并配置 fail2ban' },
    ],
    escalateToHuman: 1,
    cooldownMs: 1800000,
    enabled: true,
    isPreset: true,
  },

  // === 证书类 ===
  {
    id: 'cert-expiring',
    name: 'SSL 证书即将过期自动续期',
    description: '检测 SSL 证书剩余有效期并自动续期',
    severity: 'critical',
    category: 'security',
    tags: ['ssl', 'certificate', 'auto-renewal'],
    detect: {
      type: 'log',
      condition: 'SSL certificate expires in < 7 days',
    },
    diagnose: [
      { type: 'command', label: '检查证书到期时间', command: 'openssl x509 -enddate -noout -in /etc/letsencrypt/live/*/fullchain.pem 2>/dev/null || openssl s_client -connect localhost:443 -servername localhost </dev/null 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null || true', timeout: 15, allowFailure: true },
    ],
    action: [
      { type: 'command', label: '尝试自动续期', command: 'certbot renew --non-interactive --quiet 2>/dev/null || true', timeout: 60, allowFailure: true },
      { type: 'command', label: '重启 Web 服务', command: 'systemctl reload nginx 2>/dev/null || systemctl reload apache2 2>/dev/null || nginx -s reload 2>/dev/null || true', timeout: 15, allowFailure: true },
    ],
    escalateToHuman: 2,
    cooldownMs: 86400000,    // 每天检查一次
    enabled: true,
    isPreset: true,
  },
];

export const PLAYBOOK_CATEGORIES: Record<string, string> = {
  system: '系统运维',
  network: '网络管理',
  service: '服务管理',
  security: '安全防护',
  storage: '存储管理',
};

export function getPlaybookById(id: string): Playbook | undefined {
  return BUILTIN_PLAYBOOKS.find(p => p.id === id);
}

export function getPlaybooksByCategory(category: string): Playbook[] {
  return BUILTIN_PLAYBOOKS.filter(p => p.category === category && p.isPreset);
}

export function getPlaybooksByTag(tag: string): Playbook[] {
  return BUILTIN_PLAYBOOKS.filter(p => p.tags.includes(tag));
}

export function getPresetPlaybooks(): Playbook[] {
  return BUILTIN_PLAYBOOKS.filter(p => p.isPreset);
}

logger.info(`📋 Loaded ${BUILTIN_PLAYBOOKS.length} built-in playbooks`);
