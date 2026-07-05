// backend/src/repositories/types/database.ts
// 来源: v016 + v020

/** 数据库连接 (旧表) — v016 databases */
export interface Database {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  description: string | null;
  tags: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

/** 数据库连接 (新表) — v020 database_connections */
export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database_name: string;
  ssl_enabled: number;
  status: string;
  is_template: number;
  tags: string;
  created_at: string;
  updated_at: string;
}
