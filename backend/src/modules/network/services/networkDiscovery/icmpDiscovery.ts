/**
 * ICMP/Ping 发现工具
 * 从 networkDiscoveryService.ts 提取的 Ping 扫描与 IP 计算工具
 */

const isWindows = process.platform === 'win32';

/**
 * 跨平台 Ping 命令构建（Windows 和 Linux 语法不同）
 */
export function buildPingCommand(ip: string): string {
  if (isWindows) {
    return `ping -n 1 -w 2000 ${ip}`;
  }
  return `ping -c 1 -W 2 ${ip}`;
}

/**
 * 跨平台 Ping 输出检测（中英文兼容）
 */
export function isPingSuccess(stdout: string): boolean {
  // 通用检测：TTL 值（英文/中文输出都包含）
  if (/ttl=/i.test(stdout)) return true;
  // Linux 英文输出
  if (stdout.includes('1 received') || stdout.includes('1 packets received')) return true;
  // Windows 中文输出
  if (stdout.includes('TTL=')) return true;
  // 通用：收到 = 1
  if (stdout.includes('已接收 = 1') || stdout.includes('Received = 1')) return true;
  return false;
}

/**
 * 计算 IP 范围大小
 */
export function calculateIpRange(startIp: string, endIp: string): number {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  return Math.max(0, end - start + 1);
}

/**
 * 生成 IP 列表
 */
export function generateIpList(startIp: string, endIp: string): string[] {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  const ips: string[] = [];
  for (let i = start; i <= end; i++) {
    ips.push(intToIp(i));
  }
  return ips;
}

export function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function intToIp(int: number): string {
  return [(int >>> 24), (int >>> 16) & 0xFF, (int >>> 8) & 0xFF, int & 0xFF].join('.');
}