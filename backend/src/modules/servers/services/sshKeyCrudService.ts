/**
 * SSH Key 路由层 CRUD 抽象（v3 报告 P1-5 第二批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中处理：
 *   1. SSH 私钥格式校验（extractKeyType / validatePrivateKey / extractFingerprint）
 *   2. 加密（调用 auth.encryptionService）
 *   3. 唯一性校验（name 重复）
 *   4. 删除前置检查（使用计数）
 */
import { randomUUID, createHash } from 'crypto';
import { serverRepository } from '../../../repositories';
import { encrypt } from '../../auth/services/encryptionService';

function extractKeyType(privateKey: string): string {
  if (privateKey.includes('BEGIN OPENSSH PRIVATE KEY')) return 'openssh';
  if (privateKey.includes('BEGIN RSA PRIVATE KEY')) return 'rsa';
  if (privateKey.includes('BEGIN EC PRIVATE KEY')) return 'ec';
  if (privateKey.includes('BEGIN DSA PRIVATE KEY')) return 'dsa';
  if (privateKey.includes('BEGIN PRIVATE KEY')) return 'pkcs8';
  return 'unknown';
}

function validatePrivateKey(privateKey: string): boolean {
  const trimmed = privateKey.trim();
  return trimmed.includes('BEGIN') && trimmed.includes('PRIVATE KEY') && trimmed.includes('END');
}

function extractFingerprint(privateKey: string): string {
  try {
    const hash = createHash('sha256').update(privateKey).digest('hex');
    return `SHA256:${hash.slice(0, 43)}`;
  } catch {
    return '';
  }
}

export const sshKeyCrudService = {
  // ── 查询 ──

  listKeys() {
    return serverRepository.sshKeys.list();
  },

  getKeyById(id: string) {
    return serverRepository.sshKeys.getById(id);
  },

  getKeyUsage(id: string) {
    const servers = serverRepository.sshKeys.listServersByKey(id);
    return { count: servers.length, servers };
  },

  // ── 创建 ──

  createKey(input: {
    name: string;
    auth_type: 'key' | 'password';
    username?: string | null;
    password?: string | null;
    private_key?: string | null;
    description?: string | null;
  }): { success: true; data: { id: string } } | { success: false; error: string; status: 400 | 409 } {
    if (serverRepository.sshKeys.findByName(input.name)) {
      return { success: false, error: 'SSH key name already exists', status: 409 };
    }

    const id = randomUUID();

    if (input.auth_type === 'key') {
      if (!input.private_key || !validatePrivateKey(input.private_key)) {
        return { success: false, error: '无效的 SSH 私钥格式，请确保粘贴的内容包含完整的私钥文本（从 BEGIN 到 END）', status: 400 };
      }
      const keyType = extractKeyType(input.private_key);
      const fingerprint = extractFingerprint(input.private_key);
      const encryptedKey = encrypt(input.private_key);

      serverRepository.sshKeys.createKey({
        id,
        name: input.name,
        key_type: keyType,
        fingerprint,
        private_key: encryptedKey,
        description: input.description ?? null,
      });
    } else {
      if (!input.password) {
        return { success: false, error: '密码不能为空', status: 400 };
      }
      const encryptedPassword = encrypt(input.password);
      serverRepository.sshKeys.createPassword({
        id,
        name: input.name,
        username: input.username ?? null,
        password: encryptedPassword,
        description: input.description ?? null,
      });
    }

    return { success: true, data: { id } };
  },

  // ── 更新 ──

  updateKey(id: string, input: {
    name?: string;
    auth_type?: 'key' | 'password';
    username?: string | null;
    password?: string | null;
    private_key?: string | null;
    description?: string | null;
  }): { success: true } | { success: false; error: string; status: 400 | 404 | 409 } {
    const key = serverRepository.sshKeys.getById(id);
    if (!key) return { success: false, error: 'SSH key not found', status: 404 };

    if (input.name) {
      const existing = serverRepository.sshKeys.findByNameExcludeId(input.name, id);
      if (existing) {
        return { success: false, error: 'SSH key name already exists', status: 409 };
      }
    }

    let encryptedKey: string | undefined;
    let newKeyType: string | undefined;
    let newFingerprint: string | undefined;
    let encryptedPassword: string | undefined;

    const finalAuthType = input.auth_type ?? key.auth_type;

    if (finalAuthType === 'key' && input.private_key && typeof input.private_key === 'string' && input.private_key) {
      if (!validatePrivateKey(input.private_key)) {
        return { success: false, error: '无效的 SSH 私钥格式，请确保粘贴的内容包含完整的私钥文本（从 BEGIN 到 END）', status: 400 };
      }
      encryptedKey = encrypt(input.private_key);
      newKeyType = extractKeyType(input.private_key);
      newFingerprint = extractFingerprint(input.private_key);
    }

    if (finalAuthType === 'password' && input.password && typeof input.password === 'string' && input.password) {
      encryptedPassword = encrypt(input.password);
    }

    serverRepository.sshKeys.update(id, {
      name: input.name,
      auth_type: input.auth_type,
      key_type: newKeyType,
      fingerprint: newFingerprint,
      username: input.username,
      password: encryptedPassword,
      private_key: encryptedKey,
      description: input.description,
    });
    return { success: true };
  },

  // ── 删除 ──

  deleteKey(id: string): { success: true } | { success: false; error: string; status: 404 | 409 } {
    if (!serverRepository.sshKeys.existsById(id)) {
      return { success: false, error: 'SSH key not found', status: 404 };
    }
    const usageCount = serverRepository.sshKeys.countUsage(id);
    if (usageCount > 0) {
      return {
        success: false,
        error: `该密钥正在被 ${usageCount} 台服务器使用，无法删除。请先解除关联后再删除。`,
        status: 409,
      };
    }
    serverRepository.sshKeys.delete(id);
    return { success: true };
  },
};
