import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import crypto from 'crypto';
import { requireRole } from '../middleware/auth';
import { vmManagementService } from '../services/vmManagement';

const router = Router();

function getDefaultPlatformId(): string {
  const platforms = vmManagementService.listPlatformConfigs();
  const active = platforms.find(p => p.status === 'active');
  if (!active) throw new Error('没有可用的虚拟化平台');
  return active.id;
}

function getPlatformId(req: Request): string {
  return (req.body.platformId || req.query.platformId as string) || getDefaultPlatformId();
}

function getUserId(req: Request): string | undefined {
  return (req as any).user?.id;
}

function getUsername(req: Request): string | undefined {
  return (req as any).user?.username;
}

// ==================== 平台管理 ====================

// GET /platforms
router.get('/platforms', (req: Request, res: Response) => {
  try {
    const platforms = vmManagementService.listPlatformConfigs();
    res.json({ success: true, data: platforms });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /platforms
router.post('/platforms', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, hypervisorType, host, port, username, password, config, status, tags } = req.body;
    if (!name || !hypervisorType || !host) {
      return res.status(400).json({ success: false, message: 'name、hypervisorType、host 为必填项' });
    }
    const platform = await vmManagementService.addPlatform({
      name,
      hypervisorType,
      host,
      port: port || null,
      username: username || null,
      encryptedPassword: password || '',
      config: config || {},
      status: status || 'active',
      tags: tags || [],
    });
    return res.json({ success: true, data: platform });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /platforms/:id
router.delete('/platforms/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await vmManagementService.deletePlatform(req.params.id);
    res.json({ success: true, message: '平台已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /platforms/:id/test
router.post('/platforms/:id/test', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await vmManagementService.testPlatformConnection(req.params.id);
    res.json({ success: result.success, data: result, message: result.message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== VM 列表与统计 ====================

// GET /stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // 聚合所有平台的 VM 统计
    const platforms = vmManagementService.listPlatformConfigs();
    const platformStats: any[] = [];

    for (const p of platforms) {
      try {
        const vms = await vmManagementService.listVMs(p.id);
        platformStats.push({
          platformId: p.id,
          platformName: p.name,
          total: vms.length,
          running: vms.filter((v: any) => v.powerState === 'poweredOn').length,
          stopped: vms.filter((v: any) => v.powerState === 'poweredOff').length,
          suspended: vms.filter((v: any) => v.powerState === 'suspended').length,
        });
      } catch {
        platformStats.push({
          platformId: p.id,
          platformName: p.name,
          error: '无法获取统计数据',
        });
      }
    }

    const totalVMs = platformStats.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalRunning = platformStats.reduce((sum, s) => sum + (s.running || 0), 0);

    // 后备：从 SQLite 获取
    const sqliteTotal = (db.prepare('SELECT COUNT(*) as count FROM virtual_machines').get() as any)?.count || 0;
    const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM virtual_machines GROUP BY status').all();

    res.json({
      success: true,
      data: {
        platforms: platformStats,
        summary: { totalVMs, totalRunning },
        sqliteFallback: { total: sqliteTotal, byStatus },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;
    const status = req.query.status as string || '';
    const hypervisor = req.query.hypervisor as string || '';
    const search = req.query.search as string || '';
    const platformId = req.query.platformId as string || req.body.platformId;

    // 优先从 Hypervisor API 获取
    if (platformId) {
      try {
        const vms = await vmManagementService.listVMs(platformId);
        let filtered = vms;

        if (status) {
          filtered = filtered.filter((v: any) => {
            if (status === 'running') return v.powerState === 'poweredOn';
            if (status === 'stopped') return v.powerState === 'poweredOff';
            if (status === 'suspended') return v.powerState === 'suspended';
            return true;
          });
        }
        if (hypervisor) {
          filtered = filtered.filter((v: any) => v.hypervisorType === hypervisor);
        }
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter((v: any) =>
            v.name?.toLowerCase().includes(s) ||
            v.hostName?.toLowerCase().includes(s) ||
            v.ipAddress?.toLowerCase().includes(s)
          );
        }

        const total = filtered.length;
        const paged = filtered.slice(offset, offset + pageSize);

        return res.json({ success: true, data: paged, total, source: 'hypervisor' });
      } catch {
        // 失败时回退到 SQLite
      }
    }

    // 后备：SQLite 查询
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (hypervisor) { where += ' AND hypervisor = ?'; params.push(hypervisor); }
    if (search) { where += ' AND (name LIKE ? OR host LIKE ? OR ip_address LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM virtual_machines ${where}`).get(...params) as any)?.count || 0;
    const data = db.prepare(`SELECT * FROM virtual_machines ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    res.json({ success: true, data, total, source: 'sqlite' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== VM CRUD ====================

// GET /:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const platformId = req.query.platformId as string || req.body.platformId;
    if (platformId) {
      try {
        const vm = await vmManagementService.getVM(platformId, req.params.id);
        if (vm) {
          return res.json({ success: true, data: vm, source: 'hypervisor' });
        }
      } catch {
        // 回退 SQLite
      }
    }

    const item = db.prepare('SELECT * FROM virtual_machines WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: '未找到' });
    res.json({ success: true, data: item, source: 'sqlite' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /
router.post('/', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { name, host, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, agent_id, server_id, tags, notes } = req.body;
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    // 尝试通过 Hypervisor API 创建
    try {
      const vm = await vmManagementService.createVM(platformId, {
        platformId,
        name: name || '',
        config: {
          name: name || 'unnamed-vm',
          memoryMB: memory_mb || 2048,
          numCPUs: cpu_cores || 2,
          disks: disk_gb ? [{ id: crypto.randomUUID(), name: 'Hard disk 1', sizeGB: disk_gb, type: 'thin' as const }] : [],
          networkInterfaces: [],
        },
        powerOn: false,
      }, userId, username);
      if (vm) {
        return res.json({ success: true, data: vm, source: 'hypervisor' });
      }
    } catch {
      // 回退 SQLite
    }

    // 后备：SQLite 插入
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO virtual_machines (id, name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, agent_id, server_id, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name || '', host || '', 'stopped', os || '', cpu_cores || 0, memory_mb || 0, disk_gb || 0, ip_address || '', hypervisor || '', agent_id || '', server_id || '', JSON.stringify(tags || []), notes || '');
    res.json({ success: true, data: { id }, source: 'sqlite' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /:id
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, tags, notes } = req.body;
    db.prepare(`
      UPDATE virtual_machines SET name=?, host=?, status=?, os=?, cpu_cores=?, memory_mb=?, disk_gb=?, ip_address=?, hypervisor=?, tags=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?
    `).run(name || '', host || '', status || '', os || '', cpu_cores || 0, memory_mb || 0, disk_gb || 0, ip_address || '', hypervisor || '', JSON.stringify(tags || []), notes || '', req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /:id
router.delete('/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    // 尝试通过 Hypervisor API 删除
    try {
      await vmManagementService.deleteVM(platformId, req.params.id, userId, username);
    } catch {
      // 继续删除 SQLite 记录
    }

    // 删除 SQLite 记录
    db.prepare('DELETE FROM virtual_machines WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '虚拟机已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 电源操作 ====================

// POST /:id/start
router.post('/:id/start', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    await vmManagementService.powerOnVM(platformId, req.params.id, userId, username);

    // 同步更新 SQLite 状态
    db.prepare("UPDATE virtual_machines SET status='running', updated_at=datetime('now','localtime') WHERE id=?").run(req.params.id);

    res.json({ success: true, message: '虚拟机已开机' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /:id/stop
router.post('/:id/stop', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    await vmManagementService.powerOffVM(platformId, req.params.id, userId, username);

    db.prepare("UPDATE virtual_machines SET status='stopped', updated_at=datetime('now','localtime') WHERE id=?").run(req.params.id);

    res.json({ success: true, message: '虚拟机已关机' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /:id/restart
router.post('/:id/restart', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    await vmManagementService.restartVM(platformId, req.params.id, userId, username);

    db.prepare("UPDATE virtual_machines SET status='running', updated_at=datetime('now','localtime') WHERE id=?").run(req.params.id);

    res.json({ success: true, message: '虚拟机已重启' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 同步 ====================

// POST /sync
router.post('/sync', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);

    const vms = await vmManagementService.listVMs(platformId);
    const upsert = db.prepare(`
      INSERT INTO virtual_machines (id, name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, host = excluded.host, status = excluded.status,
        os = excluded.os, cpu_cores = excluded.cpu_cores, memory_mb = excluded.memory_mb,
        disk_gb = excluded.disk_gb, ip_address = excluded.ip_address,
        hypervisor = excluded.hypervisor, updated_at = datetime('now','localtime')
    `);

    let synced = 0;
    for (const vm of vms) {
      const totalDiskGB = (vm.disks || []).reduce((sum: number, d: any) => sum + (d.sizeGB || 0), 0);
      const status = vm.powerState === 'poweredOn' ? 'running'
        : vm.powerState === 'suspended' ? 'suspended'
        : 'stopped';

      upsert.run(
        vm.id, vm.name, vm.hostName || '',
        status, vm.guestOs || '', vm.numCPUs || 0, vm.memoryMB || 0,
        totalDiskGB, vm.ipAddress || '', vm.hypervisorType || '',
      );
      synced++;
    }

    res.json({ success: true, data: { synced, platformId, total: vms.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 快照管理 ====================

// GET /:id/snapshots
router.get('/:id/snapshots', async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const snapshots = await vmManagementService.listSnapshots(platformId, req.params.id);
    res.json({ success: true, data: snapshots });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /:id/snapshots
router.post('/:id/snapshots', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);
    const { name, description, memory } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: '快照名称为必填项' });
    }

    const snapshot = await vmManagementService.createSnapshot(platformId, {
      vmId: req.params.id,
      name,
      description: description || '',
      includeMemory: memory || false,
    }, userId, username);

    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /:id/snapshots/:snapshotId/restore
router.post('/:id/snapshots/:snapshotId/restore', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    await vmManagementService.restoreSnapshot(platformId, {
      vmId: req.params.id,
      snapshotId: req.params.snapshotId,
    }, userId, username);

    res.json({ success: true, message: '快照已恢复' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /:id/snapshots/:snapshotId
router.delete('/:id/snapshots/:snapshotId', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);

    await vmManagementService.deleteSnapshot(platformId, req.params.snapshotId, req.params.id, userId, username);

    res.json({ success: true, message: '快照已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 性能统计 ====================

// GET /:id/stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const stats = await vmManagementService.getVMStats(platformId, req.params.id);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 模板 ====================

// GET /:id/templates
router.get('/:id/templates', async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const templates = await vmManagementService.listTemplates(platformId);
    res.json({ success: true, data: templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 克隆 ====================

// POST /:id/clone
router.post('/:id/clone', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const platformId = getPlatformId(req);
    const userId = getUserId(req);
    const username = getUsername(req);
    const { name, powerOn } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: '克隆名称为必填项' });
    }

    const cloned = await vmManagementService.cloneVM(platformId, {
      platformId,
      vmId: req.params.id,
      name,
      powerOn: powerOn || false,
    }, userId, username);

    // 同步到 SQLite
    const totalDiskGB = (cloned.disks || []).reduce((sum: number, d: any) => sum + (d.sizeGB || 0), 0);
    db.prepare(`
      INSERT OR REPLACE INTO virtual_machines (id, name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      cloned.id, cloned.name, cloned.hostName || '',
      cloned.powerState === 'poweredOn' ? 'running' : 'stopped',
      cloned.guestOs || '', cloned.numCPUs || 0, cloned.memoryMB || 0,
      totalDiskGB, cloned.ipAddress || '', cloned.hypervisorType || '',
    );

    res.json({ success: true, data: cloned });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
