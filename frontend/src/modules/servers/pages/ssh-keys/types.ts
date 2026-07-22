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
