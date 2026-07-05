// backend/src/repositories/types/auth.ts
// 来源: v001 + v007 + v008

/** 用户表 — v001 users, v008 改 id 为 TEXT */
export interface User {
  id: string;
  username: string;
  password: string;
  email: string | null;
  role: string;
  enabled: number;
  password_must_change: number;
  failed_login_attempts: number;
  locked_until: string | null;
  last_failed_login: string | null;
  created_at: string;
  updated_at: string;
}

/** Token 黑名单 — v001 token_blacklist */
export interface TokenBlacklistEntry {
  id: string;
  token: string;
  user_id: string | null;
  reason: string | null;
  expires_at: string;
  created_at: string;
}

/** 加密密钥 — v001 encryption_keys */
export interface EncryptionKey {
  id: string;
  key_type: string;
  key_value: string;
  created_at: string;
  active: number;
}

/** 凭证存储 — v007 credentials */
export interface Credential {
  provider: string;
  encrypted_value: string;
  key_version: number;
  created_at: string;
  updated_at: string;
}
