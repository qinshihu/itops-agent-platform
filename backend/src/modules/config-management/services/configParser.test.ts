import { describe, expect, it } from 'vitest';
import { ConfigParser } from './configParser';
import type { ConfigTemplate } from '../../../types/configRepair';

function makeTemplate(overrides: Partial<ConfigTemplate> = {}): ConfigTemplate {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    description: '',
    category: 'web',
    service_name: 'nginx',
    template_content: 'worker_processes 1;\nworker_connections 512;',
    variables: [],
    os_type: 'linux',
    target_path: '/etc/nginx/nginx.conf',
    backup_before_apply: true,
    restart_command: '',
    validation_command: '',
    is_system: false,
    parser_type: 'nginx',
    ...overrides,
  };
}

describe('ConfigParser', () => {
  describe('parse', () => {
    it('should parse simple nginx config into keyValue blocks', () => {
      const parser = new ConfigParser(makeTemplate());
      const blocks = parser.parse('worker_processes 1;\nworker_connections 512;');
      const keyValueBlocks = blocks.filter(b => b.type === 'keyValue');
      expect(keyValueBlocks.length).toBe(2);
    });

    it('should produce empty blocks for empty content', () => {
      const parser = new ConfigParser(makeTemplate());
      const blocks = parser.parse('');
      // Empty string produces one empty-type block
      expect(blocks.some(b => b.type === 'empty')).toBe(true);
    });

    it('should skip comments', () => {
      const parser = new ConfigParser(makeTemplate());
      const blocks = parser.parse('# This is a comment\nworker_processes 1;');
      const keyValueBlocks = blocks.filter(b => b.type === 'keyValue');
      expect(keyValueBlocks.length).toBe(1);
      const commentBlocks = blocks.filter(b => b.type === 'comment');
      expect(commentBlocks.length).toBe(1);
    });
  });
});