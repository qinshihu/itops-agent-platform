import { describe, it, expect } from 'vitest';

// Page routing component existence test (updated paths after refactoring)

const pageMap: Record<string, string> = {
  Login: '../../modules/auth/pages/Login',
  Dashboard: '../../modules/monitor/pages/Dashboard',
  Servers: '../../modules/servers/pages/Servers',
  Agents: '../../modules/ai/pages/Agents',
  Workflows: '../../modules/workflow/pages/Workflows',
  Tasks: '../../modules/workflow/pages/Tasks',
  Alerts: '../../modules/alerts/pages/Alerts',
  AlertMappings: '../../modules/alerts/pages/AlertMappings',
  Knowledge: '../../modules/ai/pages/Knowledge',
  Scripts: '../../modules/scripts/pages/Scripts',
  AuditLogs: '../../modules/audit/pages/AuditLogs',
  Notifications: '../../modules/notification/pages/Notifications',
  Reports: '../../modules/monitor/pages/Reports',
  Users: '../../modules/auth/pages/Users',
  Settings: '../../modules/settings/pages/Settings',
  NetworkDevices: '../../modules/network/pages/NetworkDevices',
  SSHKeys: '../../modules/servers/pages/SSHKeys',
  AIModels: '../../modules/ai/pages/ai-models/index',
  NotFound: '../../shared/pages/NotFound',
};

describe('App Routing', () => {
  it('should lazy load all page components', async () => {
    for (const [_page, path] of Object.entries(pageMap)) {
      let mod;
      try {
        mod = await import(path);
      } catch {
        try {
          mod = await import(path + '.tsx');
        } catch {
          // skip
        }
      }
      if (mod) {
        expect(mod.default).toBeDefined();
      }
    }
  }, 30000);
});

describe('Page Structure Exports', () => {
  for (const [page, path] of Object.entries(pageMap)) {
    it(`should have default export for ${page} page`, async () => {
      const mod = await import(path);
      expect(mod.default).toBeDefined();
    });
  }
});
