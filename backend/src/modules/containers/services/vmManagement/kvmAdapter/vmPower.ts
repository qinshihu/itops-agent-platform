import { logger } from '../../../../../utils/logger';
import type { KvmSshClient } from './sshClient';

export async function powerOnVM(client: KvmSshClient, vmId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`🔌 启动 KVM 虚拟机: ${vmId}`);

  try {
    await client.execSSH(`virsh start "${vmId}"`);
    logger.info(`✅ KVM 虚拟机 ${vmId} 已启动`);
  } catch (error) {
    logger.error(`❌ 启动 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function powerOffVM(client: KvmSshClient, vmId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`🔌 关闭 KVM 虚拟机: ${vmId}`);

  try {
    const { stdout: state } = await client.execSSH(`virsh domstate "${vmId}"`);
    if (state.trim().toLowerCase() !== 'running') {
      logger.info(`KVM 虚拟机 ${vmId} 未运行，无需关机`);
      return;
    }

    try {
      await client.execSSH(`virsh shutdown "${vmId}"`);
      await client.waitForState(vmId, 'shut off', 60000);
    } catch {
      logger.warn(`⚠️ KVM 虚拟机 ${vmId} 优雅关机失败，执行强制关闭`);
      await client.execSSH(`virsh destroy "${vmId}"`);
    }

    logger.info(`✅ KVM 虚拟机 ${vmId} 已关闭`);
  } catch (error) {
    logger.error(`❌ 关闭 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function restartVM(client: KvmSshClient, vmId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`🔄 重启 KVM 虚拟机: ${vmId}`);

  try {
    const { stdout: state } = await client.execSSH(`virsh domstate "${vmId}"`);

    if (state.trim().toLowerCase() === 'running') {
      await client.execSSH(`virsh reboot "${vmId}"`);
      await client.waitForState(vmId, 'running', 60000);
    } else {
      await client.execSSH(`virsh start "${vmId}"`);
    }

    logger.info(`✅ KVM 虚拟机 ${vmId} 已重启`);
  } catch (error) {
    logger.error(`❌ 重启 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function suspendVM(client: KvmSshClient, vmId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`⏸️ 挂起 KVM 虚拟机: ${vmId}`);

  try {
    await client.execSSH(`virsh suspend "${vmId}"`);
    logger.info(`✅ KVM 虚拟机 ${vmId} 已挂起`);
  } catch (error) {
    logger.error(`❌ 挂起 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function pauseVM(client: KvmSshClient, vmId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`⏸️ 暂停 KVM 虚拟机: ${vmId}`);

  try {
    await client.execSSH(`virsh suspend "${vmId}"`);
    logger.info(`✅ KVM 虚拟机 ${vmId} 已暂停`);
  } catch (error) {
    logger.error(`❌ 暂停 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function resumeVM(client: KvmSshClient, vmId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`▶️ 恢复 KVM 虚拟机: ${vmId}`);

  try {
    await client.execSSH(`virsh resume "${vmId}"`);
    logger.info(`✅ KVM 虚拟机 ${vmId} 已恢复`);
  } catch (error) {
    logger.error(`❌ 恢复 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}
