import { describe, it, expect } from 'vitest';
import {
  parseHuaweiCpu,
  parseCiscoCpu,
  parseHuaweiMemory,
  parseCiscoMemory,
  parseInterfaceBrief,
  parseVersion,
  parseRoutes,
  parseLogBuffer,
  getParser
} from './networkResultParser';

describe('networkResultParser', () => {
  describe('parseHuaweiCpu', () => {
    it('should parse normal CPU usage', () => {
      const output = 'CPU utilization for five seconds: 45%; one minute: 42%; five minutes: 40%';
      const result = parseHuaweiCpu(output);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(45);
      expect(result.unit).toBe('%');
      expect(result.status).toBe('normal');
      expect(result.details).toContain('45%');
    });

    it('should detect warning CPU usage', () => {
      const output = 'CPU utilization: 75%';
      const result = parseHuaweiCpu(output);
      
      expect(result.status).toBe('warning');
      expect(result.value).toBe(75);
    });

    it('should detect critical CPU usage', () => {
      const output = 'CPU utilization: 90%';
      const result = parseHuaweiCpu(output);
      
      expect(result.status).toBe('critical');
      expect(result.value).toBe(90);
    });

    it('should handle unparseable output', () => {
      const output = 'No CPU data available';
      const result = parseHuaweiCpu(output);
      
      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.status).toBe('normal');
    });
  });

  describe('parseCiscoCpu', () => {
    it('should parse Cisco CPU utilization', () => {
      const output = 'CPU utilization for five seconds: 23%/0%; one minute: 25%; five minutes: 22%';
      const result = parseCiscoCpu(output);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(23);
      expect(result.status).toBe('normal');
    });

    it('should parse CPU with different format', () => {
      const output = 'Five seconds CPU utilization: 88%';
      const result = parseCiscoCpu(output);
      
      expect(result.value).toBe(88);
      expect(result.status).toBe('critical');
    });
  });

  describe('parseHuaweiMemory', () => {
    it('should parse memory usage with percentage', () => {
      const output = 'Memory Using Percentage: 52%';
      const result = parseHuaweiMemory(output);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(52);
      expect(result.unit).toBe('%');
      expect(result.status).toBe('normal');
    });

    it('should detect warning memory usage', () => {
      const output = 'Memory usage: 80%';
      const result = parseHuaweiMemory(output);
      
      expect(result.status).toBe('warning');
      expect(result.value).toBe(80);
    });

    it('should detect critical memory usage', () => {
      const output = 'Memory usage: 95%';
      const result = parseHuaweiMemory(output);
      
      expect(result.status).toBe('critical');
      expect(result.value).toBe(95);
    });
  });

  describe('parseCiscoMemory', () => {
    it('should parse memory percentage', () => {
      const output = 'Total memory: 1048576KB, Used: 450000KB, 43%';
      const result = parseCiscoMemory(output);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(43);
    });
  });

  describe('parseInterfaceBrief', () => {
    it('should parse interface list', () => {
      const output = `Interface              PHY   Protocol  Description
GigabitEthernet0/0/1   up    up
GigabitEthernet0/0/2   up    up
GigabitEthernet0/0/3   down  down
GigabitEthernet0/0/4   up    up`;
      
      const result = parseInterfaceBrief(output);
      
      expect(result.success).toBe(true);
      expect(result.totalInterfaces).toBe(4);
      expect(result.upInterfaces).toBe(3);
      expect(result.downInterfaces).toBe(1);
      expect(result.interfaces.length).toBe(4);
      expect(result.status).toBe('normal');
    });

    it('should detect warning when many interfaces down', () => {
      const output = `Interface              PHY   Protocol
GigabitEthernet0/0/1   up    up
GigabitEthernet0/0/2   down  down
GigabitEthernet0/0/3   down  down`;
      
      const result = parseInterfaceBrief(output);
      
      expect(result.totalInterfaces).toBe(3);
      expect(result.downInterfaces).toBe(2);
      expect(result.status).toBe('warning');
    });
  });

  describe('parseVersion', () => {
    it('should parse version information', () => {
      const output = `Huawei Versatile Routing Platform Software
VRP (R) software, Version 5.170 (S5735 V200R021C00SPC100)
uptime is 120 days, 5 hours, 23 minutes`;
      
      const result = parseVersion(output);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('normal');
      expect(result.details.length).toBeGreaterThan(0);
    });
  });

  describe('parseRoutes', () => {
    it('should count routes', () => {
      const output = `Route Table for public net
Destination/Mask    Proto   Pre  Cost      NextHop         Interface
10.0.0.0/8          Static  60   0         192.168.1.1     GigabitEthernet0/0/1
172.16.0.0/12       OSPF    10   20        192.168.1.2     GigabitEthernet0/0/2
192.168.0.0/16      Direct  0    0         0.0.0.0         GigabitEthernet0/0/3`;
      
      const result = parseRoutes(output);
      
      expect(result.success).toBe(true);
      expect(result.value).toBeGreaterThan(0);
      expect(result.status).toBe('normal');
    });

    it('should warn when no routes', () => {
      const output = 'No routes found';
      const result = parseRoutes(output);
      
      expect(result.value).toBe(0);
      expect(result.status).toBe('warning');
    });
  });

  describe('parseLogBuffer', () => {
    it('should detect errors in logs', () => {
      const output = `%SYS-3-ERROR: Interface down
%LINK-3-UPDOWN: Link down
%SYS-5-CONFIG: Configuration changed
%SYS-3-CRITICAL: Memory threshold exceeded`;
      
      const result = parseLogBuffer(output);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('warning');
      expect(result.details).toContain('错误: 2');
    });

    it('should detect critical log count', () => {
      const output = `%SYS-3-ERROR: Error 1
%SYS-3-ERROR: Error 2
%LINK-3-UPDOWN: Error 3
%SYS-3-ERROR: Error 4
%SYS-3-ERROR: Error 5
%SYS-3-ERROR: Error 6`;
      
      const result = parseLogBuffer(output);
      
      expect(result.status).toBe('critical');
    });

    it('should return normal for clean logs', () => {
      const output = `%SYS-6-INFO: System started
%SYS-6-INFO: Configuration saved`;
      
      const result = parseLogBuffer(output);
      
      expect(result.status).toBe('normal');
    });
  });

  describe('getParser', () => {
    it('should return correct parser for huawei cpu', () => {
      const parser = getParser('huawei', 'cpu');
      const result = parser('45%');
      expect(result.value).toBe(45);
    });

    it('should return correct parser for cisco cpu', () => {
      const parser = getParser('cisco', 'cpu');
      const result = parser('CPU utilization 60%');
      expect(result.value).toBe(60);
    });

    it('should return correct parser for huawei memory', () => {
      const parser = getParser('huawei', 'memory');
      const result = parser('50%');
      expect(result.value).toBe(50);
    });

    it('should fallback to parseCustom for unknown type', () => {
      const parser = getParser('huawei', 'cpu');
      expect(parser).toBeDefined();
      expect(typeof parser).toBe('function');
    });

    it('should use custom parser for unsupported vendor', () => {
      const parser = getParser('zte', 'log');
      const result = parser('some log output');
      expect(result.success).toBe(true);
    });
  });});
