/**
 * vmManagementService 平台 CRUD 子模块（2026-07-21 拆分）
 *
 * 把主类 6 个 public 平台管理方法抽为模块级纯函数 + context 传参：
 * - addPlatform / updatePlatform / deletePlatform
 * - getPlatformConfig / listPlatformConfigs
 * - testPlatformConnection
 *
 * 主类通过 vmManagementService/platformOps.ts 调用（delegate wrapper），外部 API 不变
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../../utils/logger';
import { vmPlatformRepository } from '../../../../../repositories';
import { credentialService } from '../../../../auth/services/credentialService';
import { createAdapter as lifecycleCreateAdapter } from './lifecycle';
import type { VMAdapter } from '../vmAdapter';
import type { VMPlatformConfig, HypervisorType } from '../../../../../types/vmManagement';

export interface PlatformOpsContext {
  adapters: Map<string, VMAdapter>;
}

/** 添加平台到数据库 + 创建适配器 */
export async function addPlatform(
  ctx: PlatformOpsContext,
  config: Omit<VMPlatformConfig, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<VMPlatformConfig> {
  const id = randomUUID();
  const now = new Date().toISOString();

  let encryptedPassword = '';
  let encryptedPasswordIV = '';

  if (config.encryptedPassword) {
    const { encrypted, iv } = credentialService.encryptCredential(config.encryptedPassword);
    encryptedPassword = encrypted;
    encryptedPasswordIV = iv;
  }

  const platformConfig: VMPlatformConfig = {
    ...config,
    id,
    encryptedPassword,
    encryptedPasswordIV,
    createdAt: now,
    updatedAt: now,
  };

  try {
    vmPlatformRepository.create({
      id,
      name: config.name,
      hypervisor_type: config.hypervisorType,
      host: config.host,
      port: config.port || null,
      username: config.username || null,
      encrypted_password: encryptedPassword || null,
      encrypted_password_iv: encryptedPasswordIV || null,
      config: config.config ? JSON.stringify(config.config) : null,
      status: config.status,
      tags: config.tags ? JSON.stringify(config.tags) : null,
    });

    // 创建适配器
    const adapterConfig: Record<string, unknown> = { ...((config.config as Record<string, unknown>) || {}) };
    adapterConfig.host = config.host;
    adapterConfig.port = config.port;
    adapterConfig.username = config.username;
    if (config.encryptedPassword) {
      adapterConfig.password = config.encryptedPassword;
    }

    lifecycleCreateAdapter(ctx, id, config.hypervisorType, adapterConfig);

    logger.info('✅ 添加虚拟化平台');
    return platformConfig;
  } catch (error) {
    logger.error('❌ 添加虚拟化平台失败:', error);
    throw error;
  }
}

/** 更新平台配置 + 重新创建适配器 */
export async function updatePlatform(
  ctx: PlatformOpsContext,
  platformId: string,
  updates: Partial<VMPlatformConfig>,
): Promise<VMPlatformConfig> {
  const existing = getPlatformConfig(platformId);
  if (!existing) {
    throw new Error('平台配置不存在');
  }

  let encryptedPassword = existing.encryptedPassword;
  let encryptedPasswordIV = existing.encryptedPasswordIV;

  if (updates.encryptedPassword !== undefined) {
    if (updates.encryptedPassword) {
      const { encrypted, iv } = credentialService.encryptCredential(updates.encryptedPassword);
      encryptedPassword = encrypted;
      encryptedPasswordIV = iv;
    } else {
      encryptedPassword = '';
      encryptedPasswordIV = '';
    }
  }

  const now = new Date().toISOString();

  try {
    const fields: Record<string, unknown> = {};
    if (updates.name !== undefined) fields.name = updates.name;
    if (updates.hypervisorType !== undefined) fields.hypervisor_type = updates.hypervisorType;
    if (updates.host !== undefined) fields.host = updates.host;
    if (updates.port !== undefined) fields.port = updates.port || null;
    if (updates.username !== undefined) fields.username = updates.username;
    if (updates.encryptedPassword !== undefined) {
      fields.encrypted_password = encryptedPassword || null;
      fields.encrypted_password_iv = encryptedPasswordIV || null;
    }
    if (updates.config !== undefined) fields.config = updates.config ? JSON.stringify(updates.config) : null;
    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.tags !== undefined) fields.tags = updates.tags ? JSON.stringify(updates.tags) : null;
    vmPlatformRepository.update(platformId, fields);

    // 重新创建适配器
    if (ctx.adapters.has(platformId)) {
      ctx.adapters.delete(platformId);
    }

    const _updatedConfig = { ...existing, ...updates, updatedAt: now };

    const adapterConfig: Record<string, unknown> = { ...((updates.config as Record<string, unknown>) || {}) };
    adapterConfig.host = updates.host || existing.host;
    adapterConfig.port = updates.port || existing.port;
    adapterConfig.username = updates.username !== undefined ? updates.username : existing.username;
    if (updates.encryptedPassword !== undefined) {
      adapterConfig.password = updates.encryptedPassword;
    } else if (existing.encryptedPassword) {
      adapterConfig.password = credentialService.decryptCredential(existing.encryptedPassword, existing.encryptedPasswordIV!);
    }

    lifecycleCreateAdapter(ctx, platformId, updates.hypervisorType || existing.hypervisorType, adapterConfig);

    logger.info('✅ 更新虚拟化平台');
    return getPlatformConfig(platformId)!;
  } catch (error) {
    logger.error('❌ 更新虚拟化平台失败:', error);
    throw error;
  }
}

/** 删除平台（断开连接 + 删 adapter + 删 DB 行） */
export async function deletePlatform(
  ctx: PlatformOpsContext,
  platformId: string,
): Promise<void> {
  try {
    // 断开连接
    const adapter = ctx.adapters.get(platformId);
    if (adapter) {
      if (adapter.isConnected()) {
        await adapter.disconnect();
      }
      ctx.adapters.delete(platformId);
    }

    vmPlatformRepository.delete(platformId);
    logger.info('🗑️ 删除虚拟化平台');
  } catch (error) {
    logger.error('❌ 删除虚拟化平台失败:', error);
    throw error;
  }
}

/** 获取单个平台配置（数据库行 → VMPlatformConfig） */
export function getPlatformConfig(platformId: string): VMPlatformConfig | null {
  try {
    const row = vmPlatformRepository.getById(platformId);
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      hypervisorType: row.hypervisor_type as HypervisorType,
      host: row.host,
      port: row.port ?? undefined,
      username: row.username ?? undefined,
      encryptedPassword: row.encrypted_password ?? undefined,
      encryptedPasswordIV: row.encrypted_password_iv ?? undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      status: row.status as VMPlatformConfig['status'],
      lastConnected: row.last_connected ?? undefined,
      errorMessage: row.error_message ?? undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('❌ 获取平台配置失败:', error);
    return null;
  }
}

/** 列出所有平台配置 */
export function listPlatformConfigs(): VMPlatformConfig[] {
  try {
    const rows = vmPlatformRepository.list();
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      hypervisorType: row.hypervisor_type as HypervisorType,
      host: row.host,
      port: row.port ?? undefined,
      username: row.username ?? undefined,
      encryptedPassword: row.encrypted_password ?? undefined,
      encryptedPasswordIV: row.encrypted_password_iv ?? undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      status: row.status as VMPlatformConfig['status'],
      lastConnected: row.last_connected ?? undefined,
      errorMessage: row.error_message ?? undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    logger.error('❌ 获取平台配置列表失败:', error);
    return [];
  }
}

/** 测试平台连接，更新平台状态字段 */
export async function testPlatformConnection(
  ctx: PlatformOpsContext,
  platformId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const adapter = ctx.adapters.get(platformId);
    if (!adapter) {
      throw new Error('找不到虚拟化平台');
    }
    const success = await adapter.testConnection();

    if (success) {
      vmPlatformRepository.update(platformId, {
        status: 'active',
        last_connected: new Date().toISOString(),
        error_message: null,
      });
    } else {
      vmPlatformRepository.update(platformId, {
        status: 'error',
        error_message: '连接测试失败',
      });
    }

    return { success };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vmPlatformRepository.update(platformId, { status: 'error', error_message: message });
    return { success: false, message };
  }
}
