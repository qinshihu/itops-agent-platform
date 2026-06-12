import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { snmpService, SnmpVersion } from '../services/snmpService';
import { snmpTrapService } from '../services/snmpTrapService';
import { encrypt, decrypt } from '../services/encryptionService';
import { SYSTEM_OIDS, IF_MIB_OIDS, VENDOR_OIDS } from '../services/snmpOidRegistry';

const router = Router();

// ================================================================
// SNMP 凭证管理
// ================================================================

// 获取设备 SNMP 凭证列表
// 确保 snmp_credentials 表有 host 列
function ensureCredHostColumn() {
  try {
    const cols = db.prepare("PRAGMA table_info('snmp_credentials')").all() as { name: string }[];
    if (!cols.find(c => c.name === 'host')) {
      db.exec("ALTER TABLE snmp_credentials ADD COLUMN host TEXT");
    }
  } catch { /* 表可能还不存在 */ }
}

router.get('/credentials', (req: Request, res: Response) => {
  try {
    ensureCredHostColumn();
    const deviceId = req.query.deviceId as string | undefined;
    let rows: any[];
    if (deviceId) {
      rows = db.prepare(`
        SELECT c.id, c.device_id, c.name, c.snmp_version, c.snmp_port,
               c.snmp_user, c.snmp_auth_protocol, c.snmp_priv_protocol,
               c.created_at, c.updated_at, COALESCE(c.host, nd.ip_address) AS host
        FROM snmp_credentials c
        LEFT JOIN network_devices nd ON c.device_id = nd.id
        WHERE c.device_id = ?
        ORDER BY c.snmp_version DESC
      `).all(deviceId);
    } else {
      rows = db.prepare(`
        SELECT c.id, c.device_id, c.name, c.snmp_version, c.snmp_port,
               c.snmp_user, c.snmp_auth_protocol, c.snmp_priv_protocol,
               c.created_at, c.updated_at, COALESCE(c.host, nd.ip_address) AS host
        FROM snmp_credentials c
        LEFT JOIN network_devices nd ON c.device_id = nd.id
        ORDER BY c.device_id
      `).all();
    }
    res.json({ code: 0, data: rows });
  } catch (error: any) {
    logger.error('Failed to fetch SNMP credentials:', error);
    res.status(500).json({ code: -1, message: error.message || '获取 SNMP 凭证失败' });
  }
});

// 保存 SNMP 凭证
router.post('/credentials', (req: Request, res: Response) => {
  try {
    const { device_id, name, community, snmp_version = 'v2c', snmp_port = 161,
      snmp_user, snmp_auth_protocol, snmp_auth_key, snmp_priv_protocol, snmp_priv_key,
      host } = req.body;

    ensureCredHostColumn();
    const id = randomUUID();

    db.prepare(`
      INSERT INTO snmp_credentials (id, device_id, name, community, snmp_version, snmp_port,
        snmp_user, snmp_auth_protocol, snmp_auth_key, snmp_priv_protocol, snmp_priv_key, host)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      device_id || null,
      name || 'default',
      community ? encrypt(community) : null,
      snmp_version,
      snmp_port || 161,
      snmp_user || null,
      snmp_auth_protocol || null,
      snmp_auth_key ? encrypt(snmp_auth_key) : null,
      snmp_priv_protocol || null,
      snmp_priv_key ? encrypt(snmp_priv_key) : null,
      host || null,
    );

    res.json({ code: 0, data: { id } });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 删除 SNMP 凭证
router.delete('/credentials/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM snmp_credentials WHERE id = ?').run(req.params.id);
    res.json({ code: 0 });
  } catch (error: any) {
    logger.error('Failed to delete SNMP credential:', error);
    res.status(500).json({ code: -1, message: error.message || '删除 SNMP 凭证失败' });
  }
});

// 更新 SNMP 凭证
router.put('/credentials/:id', (req: Request, res: Response) => {
  try {
    const { name, community, snmp_version, snmp_port,
      snmp_user, snmp_auth_protocol, snmp_auth_key, snmp_priv_protocol, snmp_priv_key,
      host } = req.body;

    db.prepare(`
      UPDATE snmp_credentials SET
        name = COALESCE(?, name),
        community = COALESCE(?, community),
        snmp_version = COALESCE(?, snmp_version),
        snmp_port = COALESCE(?, snmp_port),
        snmp_user = COALESCE(?, snmp_user),
        snmp_auth_protocol = COALESCE(?, snmp_auth_protocol),
        snmp_auth_key = COALESCE(?, snmp_auth_key),
        snmp_priv_protocol = COALESCE(?, snmp_priv_protocol),
        snmp_priv_key = COALESCE(?, snmp_priv_key),
        host = COALESCE(?, host),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      name || null,
      community ? encrypt(community) : null,
      snmp_version || null,
      snmp_port || null,
      snmp_user || null,
      snmp_auth_protocol || null,
      snmp_auth_key ? encrypt(snmp_auth_key) : null,
      snmp_priv_protocol || null,
      snmp_priv_key ? encrypt(snmp_priv_key) : null,
      host || null,
      req.params.id,
    );

    res.json({ code: 0 });
  } catch (error: any) {
    logger.error('Failed to update SNMP credential:', error);
    res.status(500).json({ code: -1, message: error.message || '更新 SNMP 凭证失败' });
  }
});

// ================================================================
// SNMP 操作
// ================================================================

// 测试 SNMP 连通性
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public',
      user, authProtocol, authKey, privProtocol, privKey } = req.body;

    const ok = await snmpService.testConnection(host, port, version as SnmpVersion, community);
    res.json({ code: ok ? 0 : -1, data: { reachable: ok } });
  } catch (error: any) {
    res.json({ code: -1, message: error.message });
  }
});

// 测试已存储的 SNMP 凭证连通性（用凭证 ID）
router.post('/credentials/:id/test', async (req: Request, res: Response) => {
  try {
    const row = db.prepare(`
      SELECT c.*, nd.ip_address AS host
      FROM snmp_credentials c
      LEFT JOIN network_devices nd ON c.device_id = nd.id
      WHERE c.id = ?
    `).get(req.params.id) as any;

    if (!row) {
      res.status(404).json({ code: -1, message: '凭证不存在' });
      return;
    }

    const host = row.host || req.body.host;
    if (!host) {
      res.status(400).json({ code: -1, message: '无法确定设备 IP，请直接使用表单测试' });
      return;
    }

    const community = row.community ? decrypt(row.community) : 'public';
    const ok = await snmpService.testConnection(host, row.snmp_port || 161, row.snmp_version as SnmpVersion, community);
    res.json({ code: ok ? 0 : -1, data: { reachable: ok } });
  } catch (error: any) {
    logger.error('Failed to test credential via ID:', error);
    res.json({ code: -1, message: error.message });
  }
});

// SNMP GET
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public', oid = SYSTEM_OIDS.sysName } = req.body;
    const result = await snmpService.get(host, port, version as SnmpVersion, community, undefined, undefined, undefined, undefined, undefined, oid);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// SNMP WALK
router.post('/walk', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public', oid = IF_MIB_OIDS.ifTable } = req.body;
    const results = await snmpService.walk(host, port, version as SnmpVersion, community, oid);
    res.json({ code: 0, data: results });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 获取系统信息
router.post('/system-info', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const info = await snmpService.getSystemInfo(host, port, version as SnmpVersion, community);
    res.json({ code: 0, data: info });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 获取接口列表
router.post('/interfaces', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const ifs = await snmpService.getInterfaces(host, port, version as SnmpVersion, community);
    res.json({ code: 0, data: ifs });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 设备健康检查（通过 SNMP）
router.get('/health/:deviceId', async (req: Request, res: Response) => {
  try {
    const health = await snmpService.healthCheck(req.params.deviceId);
    if (!health) {
      return res.status(404).json({ code: -1, message: 'No SNMP credential or device not found' });
    }
    res.json({ code: 0, data: health });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 批量设备健康检查
router.post('/health-batch', async (req: Request, res: Response) => {
  try {
    const { deviceIds } = req.body as { deviceIds: string[] };
    if (!deviceIds || !Array.isArray(deviceIds)) {
      return res.status(400).json({ code: -1, message: 'deviceIds array required' });
    }
    const results: Record<string, any> = {};
    for (const id of deviceIds) {
      results[id] = await snmpService.healthCheck(id).catch(() => null);
    }
    res.json({ code: 0, data: results });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// SNMP 自动发现
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { subnet, community = 'public', version = 'v2c', port = 161 } = req.body;
    const devices = await snmpService.discoverDevices(subnet, community, version as SnmpVersion, port);
    res.json({ code: 0, data: devices });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// ================================================================
// SNMP Trap 管理
// ================================================================

// Trap 历史
router.get('/traps', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sourceIp = req.query.sourceIp as string | undefined;
    const traps = snmpTrapService.getTrapHistory(limit, sourceIp);
    res.json({ code: 0, data: traps });
  } catch (error: any) {
    logger.error('Failed to fetch SNMP traps:', error);
    res.status(500).json({ code: -1, message: error.message || '获取 SNMP Trap 记录失败' });
  }
});

// 生成测试 Trap 记录（用于前端验证展示）
router.post('/traps/test', (_req: Request, res: Response) => {
  try {
    const id = randomUUID();
    const now = new Date().toISOString();
    const varbinds = JSON.stringify([
      { oid: '1.3.6.1.2.1.1.5.0', value: 'iKuai', type: 4 },
      { oid: '1.3.6.1.2.1.1.3.0', value: (Math.floor(Date.now() / 10) % 1000000).toString(), type: 67 },
      { oid: '1.3.6.1.4.1.9.9.43.1.1.1.0', value: 'linkDown', type: 4 },
      { oid: '1.3.6.1.6.3.1.1.4.1.0', value: '1.3.6.1.6.3.1.1.5.3', type: 6 },  // ifDown
    ]);
    db.prepare(`
      INSERT INTO snmp_trap_events (id, source_ip, trap_type, enterprise_oid, agent_address, generic_type, specific_type, varbinds_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      '192.168.60.1',
      'coldStart',
      '1.3.6.1.4.1',
      '192.168.60.1',
      0,
      0,
      varbinds,
      now
    );
    res.json({ code: 0, data: { id }, message: '测试 Trap 已生成' });
  } catch (error: any) {
    logger.error('Failed to create test trap:', error);
    res.status(500).json({ code: -1, message: error.message || '生成测试 Trap 失败' });
  }
});

// 启动 Trap 监听
router.post('/trap/start', (req: Request, res: Response) => {
  const { port = 162, address = '0.0.0.0' } = req.body;
  snmpTrapService.start(port, address);
  res.json({ code: 0 });
});

// 停止 Trap 监听
router.post('/trap/stop', (_req: Request, res: Response) => {
  snmpTrapService.stop();
  res.json({ code: 0 });
});

// ================================================================
// 使用设备 ID 执行 SNMP（复用已有 SNMP 凭证）
// ================================================================

router.get('/device/:deviceId/system-info', async (req: Request, res: Response) => {
  try {
    const device = db.prepare('SELECT id, name, ip_address FROM network_devices WHERE id = ?')
      .get(req.params.deviceId) as any;
    if (!device) return res.status(404).json({ code: -1, message: 'Device not found' });

    const cred = snmpService.getCredential(device.id) || snmpService.getDefaultCredential();
    if (!cred) return res.status(400).json({ code: -1, message: 'No SNMP credential configured' });

    const info = await snmpService.getSystemInfo(device.ip_address, cred.snmp_port, cred.snmp_version, cred.community || 'public');
    res.json({ code: 0, data: info });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

router.get('/device/:deviceId/interfaces', async (req: Request, res: Response) => {
  try {
    const device = db.prepare('SELECT id, name, ip_address FROM network_devices WHERE id = ?')
      .get(req.params.deviceId) as any;
    if (!device) return res.status(404).json({ code: -1, message: 'Device not found' });

    const cred = snmpService.getCredential(device.id) || snmpService.getDefaultCredential();
    if (!cred) return res.status(400).json({ code: -1, message: 'No SNMP credential configured' });

    const ifs = await snmpService.getInterfaces(device.ip_address, cred.snmp_port, cred.snmp_version, cred.community || 'public');
    res.json({ code: 0, data: ifs });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// ================================================================
// SNMP 指标端点（用于客户端监控/图表）
// ================================================================

router.post('/poll-interfaces', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const ifs = await snmpService.getInterfaces(host, port, version as SnmpVersion, community);

    // 精简返回值只保留关键指标
    const metrics = ifs
      .filter(i => i.operStatus === 'up' && i.speed > 0)
      .map(i => ({
        index: i.index,
        name: i.name,
        operStatus: i.operStatus,
        speed: i.speed,
        inOctets: i.inOctets,
        outOctets: i.outOctets,
        inErrors: i.inErrors,
        outErrors: i.outErrors,
      }));

    res.json({ code: 0, data: metrics });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

export default router;
