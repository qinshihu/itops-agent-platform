import { z } from 'zod';
import { type RegisteredTool } from '../types';
import { textResult, jsonResult, READONLY } from './shared';
import { networkDeviceRepository } from '../../../../repositories';

export const networkTools: RegisteredTool[] = [
  {
    name: 'network.device.list',
    title: '查询网络设备列表',
    description: '查询所有网络设备（交换机、路由器、防火墙等），包含型号、固件、端口数、管理 IP。',
    domain: 'network_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      deviceType: z.string().optional().describe('设备类型'),
      vendor: z.string().optional().describe('厂商'),
      status: z.enum(['online', 'offline', 'unknown']).optional().describe('在线状态'),
      limit: z.number().min(1).max(100).default(50).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const devices = networkDeviceRepository.listWithFilters({
          deviceType: args.deviceType,
          vendor: args.vendor,
          status: args.status,
          limit: args.limit || 50,
        });
        return jsonResult(devices, `找到 ${(devices as unknown[])?.length || 0} 台网络设备`);
      } catch (err) {
        return textResult(`查询网络设备失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'network.topology',
    title: '查询网络拓扑',
    description: '查询网络拓扑结构和设备间连接关系。',
    domain: 'network_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      rootDeviceId: z.string().optional().describe('根设备 ID（不传则返回完整拓扑）'),
      depth: z.number().min(1).max(5).default(2).describe('拓扑深度'),
    }),
    handler: async (args) => {
      try {
        const { topologyService } = await import('../../../../modules/network/services/topologyService');
        const topology = await (topologyService as any).getTopology?.(
          args.rootDeviceId,
          args.depth
        );
        return jsonResult(topology || { message: '拓扑数据正在收集中' }, '网络拓扑');
      } catch (err) {
        return textResult(`查询拓扑失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];