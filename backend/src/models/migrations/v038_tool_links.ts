/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * v016: Create tool_links table for configurable ops tool navigation
 *
 * Allows users to configure navigation links to external tools
 * (Zabbix, JumpServer, Prometheus, Grafana, Loki, etc.)
 */
const migration: Migration = {
  version: 16,
  id: '20250612000016',
  name: 'Create tool_links table',
  description: 'Creates tool_links table for configurable operations tool navigation',
  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tool_links (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT DEFAULT 'ExternalLink',
        category TEXT DEFAULT '未分类',
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        is_external INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );
    `);

    // Insert preset tools with realistic internal URLs
    const presets = [
      { name: 'Zabbix', url: 'http://zabbix.ops.local/zabbix', icon: 'Activity', category: '监控系统', description: '企业级 IT 基础设施监控，支持多平台告警与可视化', sort_order: 1 },
      { name: 'Grafana', url: 'http://grafana.ops.local:3000', icon: 'BarChart3', category: '监控系统', description: '统一可观测性仪表盘，聚合 Prometheus/Loki/ClickHouse 数据源', sort_order: 2 },
      { name: 'Prometheus', url: 'http://prometheus.ops.local:9090', icon: 'LineChart', category: '监控系统', description: '云原生监控与告警系统，支持 PromQL 多维查询', sort_order: 3 },
      { name: 'Kibana', url: 'http://kibana.ops.local:5601', icon: 'FileSearch', category: '日志系统', description: 'ELK 日志分析平台前端，支持全文检索与可视化', sort_order: 1 },
      { name: 'JumpServer', url: 'http://jumpserver.ops.local:8080', icon: 'Shield', category: '堡垒机', description: '开源堡垒机 - 账号管理、权限控制、操作审计', sort_order: 1 },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO tool_links (id, name, url, icon, category, description, sort_order, is_external)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require('crypto');
    for (const tool of presets) {
      insertStmt.run(randomUUID(), tool.name, tool.url, tool.icon, tool.category, tool.description, tool.sort_order);
    }
  },
  down: async (db: any) => {
    db.exec('DROP TABLE IF EXISTS tool_links;');
  }
};

export default migration;
