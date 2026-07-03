/**
 * 告警严重级别归一化工具
 * 将各告警源的原始级别统一映射为系统标准级别
 */

const SEVERITY_MAP: Record<string, string> = {
  // Zabbix 原始级别
  'disaster': 'critical',
  'high': 'high',
  'warning': 'medium',
  'average': 'medium',
  'information': 'low',
  'not classified': 'low',
  // 数值级别
  '0': 'low',
  '1': 'low',
  '2': 'medium',
  '3': 'high',
  '4': 'critical',
  '5': 'critical',
  // Prometheus
  'critical': 'critical',
  'error': 'high',
  'warn': 'medium',
  'info': 'low',
  // Grafana
  'alerting': 'critical',
  'pending': 'medium',
  'ok': 'low',
  'nodata': 'medium',
  // 阿里云
  'CRITICAL': 'critical',
  'WARN': 'medium',
  'INFO': 'low',
  // 腾讯云
  'serious': 'critical',
  'important': 'high',
  'remind': 'low',
};

/**
 * 将原始严重级别归一化为系统标准级别
 * @param raw 原始级别字符串
 * @returns 归一化后的级别: critical | high | medium | low
 */
export function normalizeSeverityLabel(raw: string | number | undefined | null): string {
  if (raw === null || raw === undefined) return 'medium';

  const key = String(raw).toLowerCase().trim();
  const mapped = SEVERITY_MAP[key];
  if (mapped) return mapped;

  // 尝试部分匹配
  if (key.includes('crit') || key.includes('disaster') || key.includes('fatal') || key.includes('emerg')) {
    return 'critical';
  }
  if (key.includes('high') || key.includes('major') || key.includes('error') || key.includes('important')) {
    return 'high';
  }
  if (key.includes('low') || key.includes('info') || key.includes('minor') || key.includes('remind')) {
    return 'low';
  }

  // 默认 medium
  return 'medium';
}
