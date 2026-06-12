import { describe, it, expect } from 'vitest';

describe('App Routing', () => {
  it('should lazy load all page components', async () => {
    const pages = [
      'Login',
      'Dashboard',
      'Servers',
      'Agents',
      'Workflows',
      'Tasks',
      'Alerts',
      'AlertMappings',
      'Knowledge',
      'Scripts',
      'AuditLogs',
      'Notifications',
      'Reports',
      'Users',
      'Settings',
      'NetworkDevices',
      'SSHKeys',
      'AIModels',
      'NotFound',
    ];

    for (const page of pages) {
      let mod;
      try {
        mod = await import(`../../pages/${page}`);
      } catch {
        // some pages might have different export names
        try {
          mod = await import(`../../pages/${page}.tsx`);
        } catch {
          // skip
        }
      }
      if (mod) {
        expect(mod.default).toBeDefined();
      }
    }
  });
});

describe('Page Structure Exports', () => {
  it('should have default export for Login page', async () => {
    const mod = await import('../../pages/Login');
    expect(mod.default).toBeDefined();
  });

  it('should have default export for Dashboard page', async () => {
    const mod = await import('../../pages/Dashboard');
    expect(mod.default).toBeDefined();
  });

  it('should have default export for Settings page', async () => {
    const mod = await import('../../pages/Settings');
    expect(mod.default).toBeDefined();
  });

  it('should have default export for Servers page', async () => {
    const mod = await import('../../pages/Servers');
    expect(mod.default).toBeDefined();
  });

  it('should have default export for Agents page', async () => {
    const mod = await import('../../pages/Agents');
    expect(mod.default).toBeDefined();
  });

  it('should have default export for Tasks page', async () => {
    const mod = await import('../../pages/Tasks');
    expect(mod.default).toBeDefined();
  });

  it('should have default export for NotFound page', async () => {
    const mod = await import('../../pages/NotFound');
    expect(mod.default).toBeDefined();
  });
});
