import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
  },
}));

vi.mock('../../../models/database', () => ({ default: mocks.db }));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { configTemplateService } from './configTemplateService';

describe('configTemplateService', () => {
  describe('renderTemplate', () => {
    it('should substitute variables in template', () => {
      mocks.db.prepare.mockImplementation(() => ({
        run: vi.fn(),
        get: vi.fn(() => ({
          id: 'tpl-1',
          template_content: 'server {\n  listen {{port}};\n  server_name {{host}};\n}',
        })),
        all: vi.fn(() => []),
      }));

      const rendered = configTemplateService.renderTemplate('tpl-1', {
        port: '8080',
        host: 'localhost',
      });
      expect(rendered).toContain('listen 8080');
      expect(rendered).toContain('server_name localhost');
    });
  });

  describe('getTemplateVariables', () => {
    it('should return empty array for null variables', () => {
      mocks.db.prepare.mockImplementation(() => ({
        run: vi.fn(),
        get: vi.fn(() => ({
          id: 'tpl-1',
          variables: null,
        })),
        all: vi.fn(() => []),
      }));

      const vars = configTemplateService.getTemplateVariables('tpl-1');
      expect(vars).toEqual([]);
    });
  });
});