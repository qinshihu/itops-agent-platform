import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { AlertService, AlertRule } from './alertService';
import { initializeDatabase } from '../models/database';
import db from '../models/database';

describe('AlertService', () => {
  let alertService: AlertService;

  beforeAll(() => {
    // Initialize the database for tests
    process.env.NODE_ENV = 'test';
    initializeDatabase();
  });

  beforeEach(() => {
    // 清除数据库中的规则，确保每个测试从干净状态开始
    db.prepare("DELETE FROM settings WHERE key = 'alert_rules'").run();
    
    alertService = new AlertService();
    alertService.init();
  });

  describe('initialization', () => {
    it('should initialize with default rules', () => {
      const rules = alertService.getRules();
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should have rules with required fields', () => {
      const rules = alertService.getRules();
      
      rules.forEach(rule => {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.condition).toBeDefined();
        expect(rule.threshold).toBeDefined();
        expect(rule.enabled).toBeDefined();
        expect(rule.channels).toBeDefined();
      });
    });
  });

  describe('rule management', () => {
    it('should add a new rule', () => {
      const newRule: AlertRule = {
        id: 'test-rule-1',
        name: 'Test Rule',
        description: 'Test description',
        severity: 'warning',
        condition: 'test_metric',
        threshold: 50,
        enabled: true,
        channels: ['log'],
        cooldownMs: 60000
      };

      const added = alertService.addRule(newRule);
      expect(added).toEqual(newRule);

      const rules = alertService.getRules();
      expect(rules.some(r => r.id === 'test-rule-1')).toBe(true);
    });

    it('should update an existing rule', () => {
      const newRule: AlertRule = {
        id: 'test-rule-2',
        name: 'Test Rule 2',
        description: 'Test description',
        severity: 'info',
        condition: 'test_metric_2',
        threshold: 75,
        enabled: true,
        channels: ['log'],
        cooldownMs: 30000
      };

      alertService.addRule(newRule);
      
      const updated = alertService.updateRule('test-rule-2', {
        threshold: 80,
        enabled: false
      });

      expect(updated).not.toBeNull();
      expect(updated?.threshold).toBe(80);
      expect(updated?.enabled).toBe(false);
    });

    it('should return null when updating non-existent rule', () => {
      const updated = alertService.updateRule('non-existent', { threshold: 100 });
      expect(updated).toBeNull();
    });

    it('should delete a rule', () => {
      const newRule: AlertRule = {
        id: 'test-rule-3',
        name: 'Test Rule 3',
        description: 'Test description',
        severity: 'critical',
        condition: 'test_metric_3',
        threshold: 90,
        enabled: true,
        channels: ['log'],
        cooldownMs: 120000
      };

      alertService.addRule(newRule);
      
      const deleted = alertService.deleteRule('test-rule-3');
      expect(deleted).toBe(true);

      const rules = alertService.getRules();
      expect(rules.some(r => r.id === 'test-rule-3')).toBe(false);
    });

    it('should return false when deleting non-existent rule', () => {
      const deleted = alertService.deleteRule('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('alert checking', () => {
    it('should trigger alert when threshold exceeded', async () => {
      const testRule: AlertRule = {
        id: 'test-alert-rule',
        name: 'Test Alert Rule',
        description: 'Test alert',
        severity: 'critical',
        condition: 'test_metric',
        threshold: 50,
        enabled: true,
        channels: ['log'],
        cooldownMs: 0
      };

      alertService.addRule(testRule);

      const alerts = await alertService.checkAlerts({
        test_metric: 75
      });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].ruleId).toBe('test-alert-rule');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should not trigger alert when below threshold', async () => {
      const testRule: AlertRule = {
        id: 'test-alert-rule-2',
        name: 'Test Alert Rule 2',
        description: 'Test alert',
        severity: 'warning',
        condition: 'test_metric_2',
        threshold: 80,
        enabled: true,
        channels: ['log'],
        cooldownMs: 0
      };

      alertService.addRule(testRule);

      const alerts = await alertService.checkAlerts({
        test_metric_2: 50
      });

      const ruleAlerts = alerts.filter(a => a.ruleId === 'test-alert-rule-2');
      expect(ruleAlerts.length).toBe(0);
    });

    it('should respect cooldown period', async () => {
      const testRule: AlertRule = {
        id: 'test-cooldown-rule',
        name: 'Test Cooldown Rule',
        description: 'Test cooldown',
        severity: 'warning',
        condition: 'cooldown_metric',
        threshold: 60,
        enabled: true,
        channels: ['log'],
        cooldownMs: 60000
      };

      alertService.addRule(testRule);

      const alerts1 = await alertService.checkAlerts({
        cooldown_metric: 80
      });

      const alerts2 = await alertService.checkAlerts({
        cooldown_metric: 90
      });

      expect(alerts1.length).toBeGreaterThan(0);
      expect(alerts2.filter(a => a.ruleId === 'test-cooldown-rule').length).toBe(0);
    });

    it('should not check disabled rules', async () => {
      const testRule: AlertRule = {
        id: 'test-disabled-rule',
        name: 'Test Disabled Rule',
        description: 'Test disabled',
        severity: 'critical',
        condition: 'disabled_metric',
        threshold: 10,
        enabled: false,
        channels: ['log'],
        cooldownMs: 0
      };

      alertService.addRule(testRule);

      const alerts = await alertService.checkAlerts({
        disabled_metric: 100
      });

      expect(alerts.filter(a => a.ruleId === 'test-disabled-rule').length).toBe(0);
    });
  });

  describe('alert history', () => {
    it('should return alert history', () => {
      const history = alertService.getHistory();
      
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit history results', () => {
      const history = alertService.getHistory(10);
      
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('alert statistics', () => {
    it('should return alert statistics', () => {
      const stats = alertService.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalAlerts).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity).toBeDefined();
      expect(stats.bySeverity.critical).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity.warning).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity.info).toBeGreaterThanOrEqual(0);
      expect(stats.last24Hours).toBeGreaterThanOrEqual(0);
      expect(stats.topRules).toBeDefined();
      expect(Array.isArray(stats.topRules)).toBe(true);
    });
  });

  describe('clear history', () => {
    it('should clear alert history', () => {
      alertService.clearHistory();
      const history = alertService.getHistory();
      
      expect(history.length).toBe(0);
    });
  });
});
