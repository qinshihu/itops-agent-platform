import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { networkSubnetRepository } from '../../../repositories';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// IP地址计算工具
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
  const total = (1 << (32 - parseInt(prefix, 10))) - 2; // 除去网络地址和广播地址
  return { network, broadcast, total: Math.max(0, total) };
}

// ==================== 子网 CRUD ====================

// 获取所有子网
router.get('/', (_req: Request, res: Response) => {
  try {
    const subnets = networkSubnetRepository.subnets.list();
    res.json({ success: true, data: subnets });
  } catch {
    res.status(500).json({ success: false, error: '获取子网列表失败' });
  }
});

// 获取单个子网
router.get('/:id', (req: Request, res: Response) => {
  try {
    const subnet = networkSubnetRepository.subnets.getById(req.params.id);
    if (!subnet) return res.status(404).json({ success: false, error: '子网不存在' });
    res.json({ success: true, data: subnet });
  } catch {
    res.status(500).json({ success: false, error: '获取子网失败' });
  }
});

// 创建子网
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, cidr, gateway, vlan_id, network_type, location, description, status } = req.body;
    if (!name || !cidr) return res.status(400).json({ success: false, error: '名称和CIDR不能为空' });

    const { total } = cidrToRange(cidr);
    const id = randomUUID();

    networkSubnetRepository.subnets.create({
      id, name, cidr,
      gateway: gateway || null,
      vlan_id: vlan_id || null,
      network_type: network_type || 'lan',
      location: location || null,
      description: description || null,
      status: status || 'active',
      total_ips: total,
    });

    // 自动生成 IP 地址池
    if (total > 0 && total <= 65536) {
      const { network } = cidrToRange(cidr);
      const ips: string[] = [];
      for (let i = 1; i <= total; i++) {
        ips.push(intToIp(network + i));
      }
      networkSubnetRepository.ips.bulkInsertAvailable(id, ips);
    }

    res.json({ success: true, data: { id } });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(e) || '创建子网失败' });
  }
});

// 更新子网
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, gateway, vlan_id, network_type, location, description, status } = req.body;
    networkSubnetRepository.subnets.update(req.params.id, {
      name: name || null,
      gateway: gateway !== undefined ? gateway : null,
      vlan_id: vlan_id !== undefined ? vlan_id : null,
      network_type: network_type || null,
      location: location !== undefined ? location : null,
      description: description !== undefined ? description : null,
      status: status || null,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '更新子网失败' });
  }
});

// 删除子网
router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    networkSubnetRepository.subnets.delete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '删除子网失败' });
  }
});

// ==================== IP 地址管理 ====================

// 获取子网下所有 IP
router.get('/:id/ips', (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', pageSize = '100' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(500, Math.max(10, parseInt(pageSize, 10) || 100));
    const offset = (pageNum - 1) * size;

    const filters = {
      subnetId: req.params.id,
      status: status && status !== 'all' ? status : undefined,
      search: search || undefined,
      limit: size,
      offset,
    };

    const ips = networkSubnetRepository.ips.list(filters);
    const total = networkSubnetRepository.ips.count(filters);
    const stats = networkSubnetRepository.ips.statsByStatus(req.params.id);

    res.json({
      success: true,
      data: { ips, stats, total, page: pageNum, pageSize: size },
    });
  } catch {
    res.status(500).json({ success: false, error: '获取IP列表失败' });
  }
});

// 更新单个 IP
router.put('/:id/ips/:ipId', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { status, device_name, mac_address, description } = req.body;
    networkSubnetRepository.ips.update(req.params.ipId, req.params.id, {
      status: status || null,
      device_name: device_name !== undefined ? device_name : null,
      mac_address: mac_address !== undefined ? mac_address : null,
      description: description !== undefined ? description : null,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '更新IP失败' });
  }
});

// 批量分配/释放 IP
router.post('/:id/ips/batch', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { ip_ids, status, device_name, description } = req.body;
    if (!ip_ids || !Array.isArray(ip_ids) || ip_ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择IP地址' });
    }

    networkSubnetRepository.ips.batchUpdate(ip_ids, req.params.id, {
      status,
      device_name: device_name || null,
      description: description || null,
    });

    res.json({ success: true, data: { count: ip_ids.length } });
  } catch {
    res.status(500).json({ success: false, error: '批量操作失败' });
  }
});

export default router;
