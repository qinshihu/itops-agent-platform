/**
 * vmManagementService lifecycle 子模块（2026-07-21 拆分）
 *
 * 包含主类 4 个私有方法（变成模块级纯函数 + 显式 context 传参）：
 * - loadPlatformConfigs(db platforms + credential decryption → 创建 adapter)
 * - createAdapter(根据 hypervisorType 实例化 KVM/VMware/Proxmox adapter)
 * - getAdapter(从 Map 取 adapter)
 *
 * 主类通过 vmManagementService/lifecycle.ts 调用，外部 API 不变
 *
 * 拆分原则遵循 architecture.md §3.3.1 + §3.3.1 第 3 条「向后兼容的 import 路径」
 */

import { logger } from '../../../../../utils/logger';
import { vmPlatformRepository } from '../../../../../repositories';
import { credentialService } from '../../../../auth/services/credentialService';
import type { VMAdapter } from '../vmAdapter';
import { VMwareAdapter } from '../vmwareAdapter';
import { KVMAdapter } from '../kvmAdapter';
import { ProxmoxAdapter } from '../proxmoxAdapter';
import type { HypervisorType } from '../../../../../types/vmManagement';

export interface LifecycleContext {
  adapters: Map<string, VMAdapter>;
}

/** 从数据库加载平台配置并创建适配器（init 内部使用） */
export function loadPlatformConfigs(ctx: LifecycleContext): void {
  try {
    const rows = vmPlatformRepository.listByStatus('active');

    for (const row of rows) {
      try {
        const config = (row.config ? JSON.parse(row.config) : {}) as Record<string, unknown>;

        // 解密密码
        let password = '';
        if (row.encrypted_password && row.encrypted_password_iv) {
          try {
            password = credentialService.decryptCredential(row.encrypted_password, row.encrypted_password_iv);
          } catch (_e) {
            logger.warn('⚠️ 无法解密平台密码');
          }
        }

        config.host = row.host;
        config.port = row.port;
        config.username = row.username;
        config.password = password;

        createAdapter(ctx, row.id, row.hypervisor_type as HypervisorType, config);
      } catch (e) {
        logger.error('❌ 加载平台配置失败:', e);
      }
    }

    logger.info('📋 已加载虚拟化平台');
  } catch (error) {
    logger.error('❌ 加载平台配置失败:', error);
  }
}

/** 根据 hypervisorType 实例化对应 adapter 并存入 Map */
export function createAdapter(
  ctx: LifecycleContext,
  platformId: string,
  type: HypervisorType,
  config: any,
): VMAdapter {
  let adapter: VMAdapter;

  switch (type) {
    case 'vmware':
      adapter = new VMwareAdapter(platformId, config);
      break;
    case 'kvm':
      adapter = new KVMAdapter(platformId, config);
      break;
    case 'proxmox':
      adapter = new ProxmoxAdapter(platformId, config);
      break;
    case 'hyperv':
    case 'ovirt':
    case 'cloud':
      throw new Error('暂不支持虚拟化平台类型');
    default:
      throw new Error('未知虚拟化平台类型');
  }

  ctx.adapters.set(platformId, adapter);
  return adapter;
}

/** 从 Map 取 adapter；找不到抛错 */
export function getAdapter(ctx: LifecycleContext, platformId: string): VMAdapter {
  const adapter = ctx.adapters.get(platformId);
  if (!adapter) {
    throw new Error('找不到虚拟化平台');
  }
  return adapter;
}
