/**
 * DbConnections 类型定义（2026-07-21 拆分）
 *
 * 把原 DbConnections.tsx L14-27 的 DbConnection interface + DEFAULT_FORM_DATA + dbTypeColors 抽出
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

export interface DbConnection {
  id: string;
  name: string;
  db_type: 'mysql' | 'postgresql' | 'oracle' | 'sqlite' | string;
  host: string;
  port: number;
  username: string;
  database: string;
  description?: string;
  tags?: string[] | string;
  enabled: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface DbConnectionFormData {
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  description: string;
  tags: string;
  enabled: boolean;
}

export const DEFAULT_DB_CONNECTION_FORM: DbConnectionFormData = {
  name: '',
  db_type: 'mysql',
  host: '',
  port: 3306,
  username: '',
  password: '',
  database: '',
  description: '',
  tags: '',
  enabled: true,
};

/** 数据库类型 → tailwind className (color + bg + border) */
export const DB_TYPE_COLORS: Record<string, string> = {
  mysql: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  postgresql: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  oracle: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sqlite: 'bg-slate-500/20 text-text-secondary border-slate-500/30',
};

export interface DbConnectionPayload {
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
  description?: string;
  tags: string[];
  enabled: boolean;
}
