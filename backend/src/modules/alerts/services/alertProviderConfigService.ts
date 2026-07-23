/**
 * Alert Provider Config 路由层 CRUD 抽象（P1-6 后端补完：修复 /alerts/providers/configs 缺端点）
 *
 * 历史：前端 2026-07-21 拆分后端未跟进，5 个端点全部 404。
 * 方案：探索期内采用 JSON 文件持久化（避免大动作 schema 改动），
 *      数据路径：data/alert-provider-configs.json。
 *      未来若需 SQL 查询，可平滑迁移到 alert_provider_configs 表。
 *
 * 遵守 architecture.md §3.2（routes→service 抽象）+ §1.3（无业务判断）。
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';

export interface AlertProviderConfigRecord {
  id: string;
  provider_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertProviderConfigInput {
  provider_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

const DATA_FILE = path.resolve(
  process.env.DATA_DIR || path.join(__dirname, '../../../../data'),
  'alert-provider-configs.json',
);

function ensureDataFile(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  }
  if (!fs.existsSync(DATA_FILE)) {
    try { fs.writeFileSync(DATA_FILE, '[]', 'utf-8'); } catch { /* ignore */ }
  }
}

function readAll(): AlertProviderConfigRecord[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn('Failed to read alert-provider-configs.json, returning empty list', err);
    return [];
  }
}

function writeAll(records: AlertProviderConfigRecord[]): void {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to write alert-provider-configs.json', err);
    throw new Error('Failed to persist alert provider configs');
  }
}

export const alertProviderConfigService = {
  listConfigs(): AlertProviderConfigRecord[] {
    return readAll();
  },

  getConfigById(id: string): AlertProviderConfigRecord | undefined {
    return readAll().find((c) => c.id === id);
  },

  createConfig(input: AlertProviderConfigInput): AlertProviderConfigRecord {
    const now = new Date().toISOString();
    const record: AlertProviderConfigRecord = {
      id: randomUUID(),
      provider_id: input.provider_id,
      name: input.name,
      config: input.config,
      enabled: input.enabled,
      created_at: now,
      updated_at: now,
    };
    const all = readAll();
    all.push(record);
    writeAll(all);
    return record;
  },

  updateConfig(id: string, input: AlertProviderConfigInput): AlertProviderConfigRecord | undefined {
    const all = readAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    const updated: AlertProviderConfigRecord = {
      ...all[idx],
      provider_id: input.provider_id,
      name: input.name,
      config: input.config,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },

  deleteConfig(id: string): boolean {
    const all = readAll();
    const next = all.filter((c) => c.id !== id);
    if (next.length === all.length) return false;
    writeAll(next);
    return true;
  },
};