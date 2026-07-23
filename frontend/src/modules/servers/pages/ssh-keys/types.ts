/**
 * SSHKeys 类型定义（2026-07-21 拆分）
 *
 * 把原 SSHKeys.tsx L14-18, L25-32 的 interface 抽出
 * 包含：UsageServer (API 返回)、SSHKeyFormData (表单状态)
 * 注：SSHKey 类型仍从 '../api' 导入（API 契约）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

export interface UsageServer {
  id: string;
  name: string;
  hostname: string;
}

export type AuthType = 'key' | 'password';

// 2026-07-23：原来从 '../api' 导入 SshKey；api.ts 已删除，本地定义一次
export interface SshKey {
  id: string;
  name: string;
  auth_type: AuthType;
  key_type?: string; // ssh-rsa / ssh-ed25519 / ecdsa-sha2-nistp256 ...
  username?: string;
  password?: string;
  private_key?: string;
  public_key?: string;
  fingerprint?: string;
  description?: string;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SSHKeyFormData {
  name: string;
  auth_type: AuthType;
  username: string;
  password: string;
  private_key: string;
  description: string;
}

export const DEFAULT_FORM_DATA: SSHKeyFormData = {
  name: '',
  auth_type: 'key',
  username: '',
  password: '',
  private_key: '',
  description: '',
};
