/**
 * Network Subnet 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. CIDR → IP 范围计算（ipToInt / intToIp / cidrToRange）
 *   2. 子网 CRUD
 *   3. IP 地址管理（list / update / batch / stats）
 *   4. 创建子网后自动生成 IP 池
 */
import { randomUUID } from 'crypto';
import { networkSubnetRepository } from '../../../repositories';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getErrorMessage } from '../../../utils/errorHelpers';

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int: number): string {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

function cidrToRange(cidr: string): { network: number; broadcast: number; total: number } {
  const [ip, prefix] = cidr.split('/');
  const ipInt = ipToInt(ip);
  const mask = ~((1 << (32 - parseInt(prefix, 10))) - 1) >>> 0;
  const network = ipInt & mask;
  const broadcast = network | ~mask >>> 0;
  const total = (1 << (32 - parseInt(prefix, 10))) - 2;
  return { network, broadcast, total: Math.max(0, total) };
}

export const networkSubnetCrudService = {
  // ── 子网 CRUD ──

  listSubnets() {
    return networkSubnetRepository.subnets.list();
  },

  getSubnetById(id: string) {
    return networkSubnetRepository.subnets.getById(id);
  },

  /**
   * 创建子网（自动生成 IP 池）
   * 返回 { success, data, error }
   */
  createSubnet(input: {
    name: string;
    cidr: string;
    gateway?: string;
    vlan_id?: string | number;
    network_type?: string;
    location?: string;
    description?: string;
    status?: string;
  }): { success: true; data: { id: string } } | { success: false; error: string } {
    if (!input.name || !input.cidr) {
      return { success: false, error: '名称和CIDR不能为空' };
    }

    const { total } = cidrToRange(input.cidr);
    const id = randomUUID();

    networkSubnetRepository.subnets.create({
      id,
      name: input.name,
      cidr: input.cidr,
      gateway: input.gateway || null,
      vlan_id: input.vlan_id ? Number(input.vlan_id) : null,
      network_type: input.network_type || 'lan',
      location: input.location || null,
      description: input.description || null,
      status: input.status || 'active',
      total_ips: total,
    });

    // 自动生成 IP 池
    if (total > 0 && total <= 65536) {
      const { network } = cidrToRange(input.cidr);
      const ips: string[] = [];
      for (let i = 1; i <= total; i++) {
        ips.push(intToIp(network + i));
      }
      try {
        networkSubnetRepository.ips.bulkInsertAvailable(id, ips);
      } catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
        // 静默：IP 池生成失败不影响子网创建
      }
    }

    return { success: true, data: { id } };
  },

  updateSubnet(id: string, input: {
    name?: string;
    gateway?: string;
    vlan_id?: string;
    network_type?: string;
    location?: string;
    description?: string;
    status?: string;
  }) {
    networkSubnetRepository.subnets.update(id, {
      name: input.name || null,
      gateway: input.gateway !== undefined ? input.gateway : null,
      vlan_id: input.vlan_id !== undefined ? Number(input.vlan_id) : null,
      network_type: input.network_type || null,
      location: input.location !== undefined ? input.location : undefined,
      description: input.description !== undefined ? input.description : undefined,
      status: input.status || null,
    });
  },

  deleteSubnet(id: string) {
    networkSubnetRepository.subnets.delete(id);
  },

  // ── IP 管理 ──

  listSubnetIps(subnetId: string, query: { status?: string; search?: string; page?: string; pageSize?: string }) {
    const pageNum = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const size = Math.min(500, Math.max(10, parseInt(query.pageSize ?? '100', 10) || 100));
    const offset = (pageNum - 1) * size;
    const filters = {
      subnetId,
      status: query.status && query.status !== 'all' ? query.status : undefined,
      search: query.search || undefined,
      limit: size,
      offset,
    };
    return {
      ips: networkSubnetRepository.ips.list(filters),
      total: networkSubnetRepository.ips.count(filters),
      stats: networkSubnetRepository.ips.statsByStatus(subnetId),
      page: pageNum,
      pageSize: size,
    };
  },

  updateIp(ipId: string, subnetId: string, input: { status?: string; device_name?: string; mac_address?: string; description?: string }) {
    networkSubnetRepository.ips.update(ipId, subnetId, {
      status: input.status || null,
      device_name: input.device_name !== undefined ? input.device_name : undefined,
      mac_address: input.mac_address !== undefined ? input.mac_address : undefined,
      description: input.description !== undefined ? input.description : undefined,
    });
  },

  batchUpdateIps(ipIds: string[], subnetId: string, input: { status?: string; device_name?: string; description?: string }) {
    if (!ipIds || !Array.isArray(ipIds) || ipIds.length === 0) {
      return { success: false as const, error: '请选择IP地址' };
    }
    networkSubnetRepository.ips.batchUpdate(ipIds, subnetId, {
      status: input.status ?? 'available',
      device_name: input.device_name || null,
      description: input.description || null,
    });
    return { success: true as const, count: ipIds.length };
  },
};
