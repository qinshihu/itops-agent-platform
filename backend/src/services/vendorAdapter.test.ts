import { describe, it, expect } from 'vitest';
import { createVendorAdapter, STANDARD_INSPECTION_TYPES, VendorType } from './vendorAdapter';

describe('vendorAdapter', () => {
  describe('createVendorAdapter', () => {
    it('should create Huawei adapter', () => {
      const adapter = createVendorAdapter('huawei');
      expect(adapter.vendor).toBe('huawei');
      expect(adapter.supportsEnablePassword()).toBe(true);
    });

    it('should create Cisco adapter', () => {
      const adapter = createVendorAdapter('cisco');
      expect(adapter.vendor).toBe('cisco');
      expect(adapter.supportsEnablePassword()).toBe(true);
    });

    it('should create H3C adapter', () => {
      const adapter = createVendorAdapter('h3c');
      expect(adapter.vendor).toBe('h3c');
    });

    it('should create Ruijie adapter', () => {
      const adapter = createVendorAdapter('ruijie');
      expect(adapter.vendor).toBe('ruijie');
    });

    it('should create ZTE adapter', () => {
      const adapter = createVendorAdapter('zte');
      expect(adapter.vendor).toBe('zte');
    });

    it('should fallback to Huawei for unknown vendor', () => {
      const adapter = createVendorAdapter('unknown' as VendorType);
      expect(adapter.vendor).toBe('huawei');
    });
  });

  describe('getCommands', () => {
    it('should return all commands when no types specified', () => {
      const adapter = createVendorAdapter('huawei');
      const commands = adapter.getCommands();
      expect(commands.length).toBe(STANDARD_INSPECTION_TYPES.length);
    });

    it('should return specific commands when types specified', () => {
      const adapter = createVendorAdapter('huawei');
      const commands = adapter.getCommands(['cpu', 'memory']);
      expect(commands.length).toBe(2);
      expect(commands[0].type).toBe('cpu');
      expect(commands[1].type).toBe('memory');
    });

    it('should have correct CPU command for Huawei', () => {
      const adapter = createVendorAdapter('huawei');
      const cmd = adapter.getCommand('cpu');
      expect(cmd).toBeDefined();
      expect(cmd!.command).toBe('display cpu-usage');
    });

    it('should have correct CPU command for Cisco', () => {
      const adapter = createVendorAdapter('cisco');
      const cmd = adapter.getCommand('cpu');
      expect(cmd).toBeDefined();
      expect(cmd!.command).toContain('show processes cpu');
    });

    it('should have correct memory command for Huawei', () => {
      const adapter = createVendorAdapter('huawei');
      const cmd = adapter.getCommand('memory');
      expect(cmd).toBeDefined();
      expect(cmd!.command).toBe('display memory');
    });

    it('should have correct interface command for Cisco', () => {
      const adapter = createVendorAdapter('cisco');
      const cmd = adapter.getCommand('interface');
      expect(cmd).toBeDefined();
      expect(cmd!.command).toBe('show ip interface brief');
    });
  });

  describe('command templates', () => {
    const vendors: VendorType[] = ['huawei', 'cisco', 'h3c', 'ruijie', 'zte'];

    it('should have command for each inspection type', () => {
      for (const vendor of vendors) {
        const adapter = createVendorAdapter(vendor);
        for (const type of STANDARD_INSPECTION_TYPES) {
          const cmd = adapter.getCommand(type);
          expect(cmd).toBeDefined();
          expect(cmd!.type).toBe(type);
          expect(cmd!.command.length).toBeGreaterThan(0);
          expect(cmd!.name.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have thresholds for CPU commands', () => {
      for (const vendor of vendors) {
        const adapter = createVendorAdapter(vendor);
        const cmd = adapter.getCommand('cpu');
        expect(cmd!.thresholds).toBeDefined();
        expect(cmd!.thresholds!.warning).toBeGreaterThan(0);
        expect(cmd!.thresholds!.critical).toBeGreaterThan(cmd!.thresholds!.warning);
      }
    });

    it('should have thresholds for memory commands', () => {
      for (const vendor of vendors) {
        const adapter = createVendorAdapter(vendor);
        const cmd = adapter.getCommand('memory');
        expect(cmd!.thresholds).toBeDefined();
        expect(cmd!.thresholds!.warning).toBeGreaterThan(0);
        expect(cmd!.thresholds!.critical).toBeGreaterThan(cmd!.thresholds!.warning);
      }
    });
  });

  describe('STANDARD_INSPECTION_TYPES', () => {
    it('should contain all standard inspection types', () => {
      const expectedTypes = [
        'cpu', 'memory', 'interface', 'version', 'routes', 'log',
        'environment', 'power', 'fan', 'stp', 'vlan', 'arp', 'mac'
      ];
      
      expect(STANDARD_INSPECTION_TYPES).toHaveLength(expectedTypes.length);
      for (const type of expectedTypes) {
        expect(STANDARD_INSPECTION_TYPES).toContain(type);
      }
    });
  });
});
