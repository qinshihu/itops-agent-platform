import { logger } from '../../../../../utils/logger';
import type { ProxmoxApiClient } from './apiClient';

export async function powerOnVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`🔌 启动 Proxmox 虚拟机: ${vmId}`);

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${vmId}/status/start`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid, 60000);
    }
    logger.info(`✅ Proxmox 虚拟机 ${vmId} 已启动`);
  } catch (error) {
    logger.error(`❌ 启动 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function powerOffVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`🔌 关闭 Proxmox 虚拟机: ${vmId}`);

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${vmId}/status/shutdown`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid, 120000);
    }
    logger.info(`✅ Proxmox 虚拟机 ${vmId} 已关闭`);
  } catch (error) {
    logger.error(`❌ 关闭 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function restartVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`🔄 重启 Proxmox 虚拟机: ${vmId}`);

  try {
    const status = await client.apiRequest(
      'GET',
      `/nodes/${client.node}/qemu/${vmId}/status/current`
    );

    if (status.status === 'running') {
      try {
        const result = await client.apiRequest(
          'POST',
          `/nodes/${client.node}/qemu/${vmId}/status/reboot`
        );
        if (result?.upid) {
          await client.waitForTask(result.upid, 60000);
        }
      } catch {
        const result = await client.apiRequest(
          'POST',
          `/nodes/${client.node}/qemu/${vmId}/status/reset`
        );
        if (result?.upid) {
          await client.waitForTask(result.upid, 60000);
        }
      }
    } else {
      await powerOnVM(client, vmId);
    }

    logger.info(`✅ Proxmox 虚拟机 ${vmId} 已重启`);
  } catch (error) {
    logger.error(`❌ 重启 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function suspendVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`⏸️ 挂起 Proxmox 虚拟机: ${vmId}`);

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${vmId}/status/suspend`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }
    logger.info(`✅ Proxmox 虚拟机 ${vmId} 已挂起`);
  } catch (error) {
    logger.error(`❌ 挂起 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function pauseVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`⏸️ 暂停 Proxmox 虚拟机: ${vmId}`);

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${vmId}/status/pause`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }
    logger.info(`✅ Proxmox 虚拟机 ${vmId} 已暂停`);
  } catch (error) {
    logger.error(`❌ 暂停 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

export async function resumeVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`▶️ 恢复 Proxmox 虚拟机: ${vmId}`);

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${vmId}/status/resume`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }
    logger.info(`✅ Proxmox 虚拟机 ${vmId} 已恢复`);
  } catch (error) {
    logger.error(`❌ 恢复 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}
