import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { requireRole } from '../middleware/auth';

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
    const subnets = db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM network_ips WHERE subnet_id = s.id AND status != 'available') as used_ips
      FROM network_subnets s ORDER BY s.created_at DESC
    `).all();
    res.json({ success: true, data: subnets });
  } catch {
    res.status(500).json({ success: false, error: '获取子网列表失败' });
  }
});

// 获取单个子网
router.get('/:id', (req: Request, res: Response) => {
  try {
    const subnet = db.prepare('SELECT * FROM network_subnets WHERE id = ?').get(req.params.id);
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

    db.prepare(`
      INSERT INTO network_subnets (id, name, cidr, gateway, vlan_id, network_type, location, description, status, total_ips)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, cidr, gateway || null, vlan_id || null, network_type || 'lan', location || null, description || null, status || 'active', total);

    // 自动生成 IP 地址池
    if (total > 0 && total <= 65536) {
      const { network } = cidrToRange(cidr);
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO network_ips (id, subnet_id, ip_address, status)
        VALUES (?, ?, ?, 'available')
      `);
      const insertMany = db.transaction(() => {
        for (let i = 1; i <= total; i++) {
          const ip = intToIp(network + i);
          insertStmt.run(randomUUID(), id, ip);
        }
      });
      insertMany();
    }

    res.json({ success: true, data: { id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || '创建子网失败' });
  }
});

// 更新子网
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, gateway, vlan_id, network_type, location, description, status } = req.body;
    db.prepare(`
      UPDATE network_subnets
      SET name = COALESCE(?, name), gateway = COALESCE(?, gateway), vlan_id = COALESCE(?, vlan_id),
          network_type = COALESCE(?, network_type), location = COALESCE(?, location),
          description = COALESCE(?, description), status = COALESCE(?, status),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(name || null, gateway !== undefined ? gateway : null, vlan_id !== undefined ? vlan_id : null,
      network_type || null, location !== undefined ? location : null, description !== undefined ? description : null,
      status || null, req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '更新子网失败' });
  }
});

// 删除子网
router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM network_subnets WHERE id = ?').run(req.params.id);
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

    let sql = 'SELECT * FROM network_ips WHERE subnet_id = ?';
    const params: (string | number)[] = [req.params.id];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (ip_address LIKE ? OR device_name LIKE ? OR mac_address LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countSql).get(...params) as { total: number };

    sql += ' ORDER BY ip_address ASC LIMIT ? OFFSET ?';
    params.push(size, offset);

    const ips = db.prepare(sql).all(...params);

    // 统计
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count FROM network_ips WHERE subnet_id = ?
      GROUP BY status
    `).all(req.params.id) as Array<{ status: string; count: number }>;

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
    db.prepare(`
      UPDATE network_ips
      SET status = COALESCE(?, status), device_name = COALESCE(?, device_name),
          mac_address = COALESCE(?, mac_address), description = COALESCE(?, description),
          updated_at = datetime('now','localtime')
      WHERE id = ? AND subnet_id = ?
    `).run(status || null, device_name !== undefined ? device_name : null,
      mac_address !== undefined ? mac_address : null, description !== undefined ? description : null,
      req.params.ipId, req.params.id);
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

    const stmt = db.prepare(`
      UPDATE network_ips
      SET status = ?, device_name = ?, description = COALESCE(?, description),
          updated_at = datetime('now','localtime')
      WHERE id = ? AND subnet_id = ?
    `);

    const batchUpdate = db.transaction(() => {
      for (const ipId of ip_ids) {
        stmt.run(status, device_name || null, description || null, ipId, req.params.id);
      }
    });
    batchUpdate();

    res.json({ success: true, data: { count: ip_ids.length } });
  } catch {
    res.status(500).json({ success: false, error: '批量操作失败' });
  }
});

export default router;
