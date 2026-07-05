/**
 * SNMP OID 解析与 MIB 处理工具函数
 * 从 snmpService.ts 提取的纯工具函数
 */

export function getIfIndex(oid: string): number | null {
  // OID 以 .1.3.6.1.2.1.2.2.1.X. 结尾，后面是 index
  const match = oid.match(/\.(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatMac(raw: string): string {
  if (!raw || raw === '') return '';
  // 十六进制字符串转为 MAC 格式
  const hex = raw.replace(/^0x/i, '');
  const parts: string[] = [];
  for (let i = 0; i < hex.length && i < 12; i += 2) {
    parts.push(hex.substring(i, i + 2));
  }
  return parts.join(':').toUpperCase();
}

export function typeToString(type?: number): string {
  const types: Record<number, string> = {
    0x00: 'Boolean',
    0x01: 'Integer',
    0x02: 'BitString',
    0x03: 'OctetString',
    0x04: 'Null',
    0x05: 'OID',
    0x06: 'ObjectDescr',
    0x07: 'External',
    0x08: 'Real',
    0x09: 'Enumerated',
    0x0A: 'UInt32',
    0x0B: 'IpAddress',
    0x0C: 'Counter32',
    0x0D: 'Gauge32',
    0x0E: 'TimeTicks',
    0x0F: 'Opaque',
    0x10: 'NetAddr',
    0x11: 'Counter64',
    0x12: 'UInt64',
  };
  return type !== undefined ? types[type] || 'Unknown' : 'Unknown';
}