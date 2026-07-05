/**
 * alertSeverity 工具测试
 *
 * 验证：
 *   - Zabbix 原始级别映射
 *   - 数值级别映射
 *   - Prometheus/Grafana/阿里云/腾讯云级别映射
 *   - null/undefined 默认 medium
 *   - 部分匹配（crit/disaster/fatal → critical）
 *   - 未知级别默认 medium
 */

import { describe, it, expect } from 'vitest';
import { normalizeSeverityLabel } from './alertSeverity';

describe('normalizeSeverityLabel', () => {
  describe('null/undefined', () => {
    it('null 返回 medium', () => {
      expect(normalizeSeverityLabel(null)).toBe('medium');
    });
    it('undefined 返回 medium', () => {
      expect(normalizeSeverityLabel(undefined)).toBe('medium');
    });
  });

  describe('Zabbix 级别', () => {
    it('disaster → critical', () => {
      expect(normalizeSeverityLabel('disaster')).toBe('critical');
    });
    it('high → high', () => {
      expect(normalizeSeverityLabel('high')).toBe('high');
    });
    it('warning → medium', () => {
      expect(normalizeSeverityLabel('warning')).toBe('medium');
    });
    it('information → low', () => {
      expect(normalizeSeverityLabel('information')).toBe('low');
    });
  });

  describe('数值级别', () => {
    it('0 → low, 2 → medium, 3 → high, 4 → critical', () => {
      expect(normalizeSeverityLabel('0')).toBe('low');
      expect(normalizeSeverityLabel('2')).toBe('medium');
      expect(normalizeSeverityLabel('3')).toBe('high');
      expect(normalizeSeverityLabel('4')).toBe('critical');
      expect(normalizeSeverityLabel('5')).toBe('critical');
    });
    it('数字类型也可识别', () => {
      expect(normalizeSeverityLabel(4)).toBe('critical');
    });
  });

  describe('Prometheus/Grafana', () => {
    it('critical → critical, warn → medium, info → low', () => {
      expect(normalizeSeverityLabel('critical')).toBe('critical');
      expect(normalizeSeverityLabel('warn')).toBe('medium');
      expect(normalizeSeverityLabel('info')).toBe('low');
    });
    it('alerting → critical, pending → medium, ok → low', () => {
      expect(normalizeSeverityLabel('alerting')).toBe('critical');
      expect(normalizeSeverityLabel('pending')).toBe('medium');
      expect(normalizeSeverityLabel('ok')).toBe('low');
    });
  });

  describe('部分匹配', () => {
    it('包含 crit → critical', () => {
      expect(normalizeSeverityLabel('crit level')).toBe('critical');
    });
    it('包含 disaster → critical', () => {
      expect(normalizeSeverityLabel('system disaster')).toBe('critical');
    });
    it('包含 major → high', () => {
      expect(normalizeSeverityLabel('major issue')).toBe('high');
    });
    it('包含 minor → low', () => {
      expect(normalizeSeverityLabel('minor glitch')).toBe('low');
    });
  });

  describe('未知级别', () => {
    it('返回默认 medium', () => {
      expect(normalizeSeverityLabel('unknown_level')).toBe('medium');
    });
    it('大小写不敏感', () => {
      expect(normalizeSeverityLabel('CRITICAL')).toBe('critical');
      expect(normalizeSeverityLabel('High')).toBe('high');
    });
  });
});
