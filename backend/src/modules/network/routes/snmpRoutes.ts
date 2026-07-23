/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import type { SnmpVersion } from '../services/snmpService';
import { snmpService } from '../services/snmpService';
import { snmpTrapService } from '../services/snmpTrapService';
import { decrypt } from '../../auth/services/encryptionService';
import { SYSTEM_OIDS, IF_MIB_OIDS } from '../services/snmpOidRegistry';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { snmpCrudService } from '../services/snmpCrudService';

const router = Router();

// ================================================================
// 响应格式：snmpRoutes 统一改为 {success, data, message} 格式
// （2026-07-23 修复：之前用 {code, data, message} 没有 success 字段，
//  前端 axios 拦截器（lib/api.ts:57）不解包，导致 r.data 是整个对象而非业务 data；
//  统一改用 success 格式后，前端拦截器正确解包）
// ================================================================

// ================================================================
// SNMP 凭证管理
// ================================================================

router.get('/credentials', (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const rows = snmpCrudService.listCredentials(deviceId);
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    logger.error('Failed to fetch SNMP credentials:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) || '获取 SNMP 凭证失败' });
  }
});

router.post('/credentials', (req: Request, res: Response) => {
  try {
    const { id } = snmpCrudService.createCredential(req.body);
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.delete('/credentials/:id', (req: Request, res: Response) => {
  try {
    snmpCrudService.deleteCredential(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete SNMP credential:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) || '删除 SNMP 凭证失败' });
  }
});

router.put('/credentials/:id', (req: Request, res: Response) => {
  try {
    snmpCrudService.updateCredential(req.params.id, req.body);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to update SNMP credential:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) || '更新 SNMP 凭证失败' });
  }
});

// ================================================================
// SNMP 操作
// ================================================================

router.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const ok = await snmpService.testConnection(host, port, version as SnmpVersion, community);
    res.json({ success: ok, data: { reachable: ok }, message: ok ? '连接成功' : '连接失败' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/credentials/:id/test', async (req: Request, res: Response) => {
  try {
    const row = snmpCrudService.getCredentialByIdWithHost(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: '凭证不存在' });
    }
    const host = (row as any).host || req.body.host;
    if (!host) {
      return res.status(400).json({ success: false, message: '无法确定设备 IP，请直接使用表单测试' });
    }
    const community = (row as any).community ? decrypt((row as any).community) : 'public';
    const ok = await snmpService.testConnection(host, (row as any).snmp_port || 161, (row as any).snmp_version as SnmpVersion, community);
    res.json({ success: ok, data: { reachable: ok }, message: ok ? '连接成功' : '连接失败' });
  } catch (error: unknown) {
    logger.error('Failed to test credential via ID:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/get', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public', oid = SYSTEM_OIDS.sysName } = req.body;
    const result = await snmpService.get(host, port, version as SnmpVersion, community, undefined, undefined, undefined, undefined, undefined, oid);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/walk', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public', oid = IF_MIB_OIDS.ifTable } = req.body;
    const results = await snmpService.walk(host, port, version as SnmpVersion, community, oid);
    res.json({ success: true, data: results });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/system-info', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const info = await snmpService.getSystemInfo(host, port, version as SnmpVersion, community);
    res.json({ success: true, data: info });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/interfaces', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const ifs = await snmpService.getInterfaces(host, port, version as SnmpVersion, community);
    res.json({ success: true, data: ifs });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.get('/health/:deviceId', async (req: Request, res: Response) => {
  try {
    const health = await snmpService.healthCheck(req.params.deviceId);
    if (!health) {
      return res.status(404).json({ success: false, message: 'No SNMP credential or device not found' });
    }
    res.json({ success: true, data: health });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/health-batch', async (req: Request, res: Response) => {
  try {
    const { deviceIds } = req.body as { deviceIds: string[] };
    if (!deviceIds || !Array.isArray(deviceIds)) {
      return res.status(400).json({ success: false, message: 'deviceIds array required' });
    }
    const results: Record<string, unknown> = {};
    for (const id of deviceIds) {
      results[id] = await snmpService.healthCheck(id).catch((err) => {
        logger.warn(`SNMP health check failed for ${id}:`, err);
        return null;
      });
    }
    res.json({ success: true, data: results });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { subnet, community = 'public', version = 'v2c', port = 161 } = req.body;
    const devices = await snmpService.discoverDevices(subnet, community, version as SnmpVersion, port);
    res.json({ success: true, data: devices });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// ================================================================
// SNMP Trap 管理
// ================================================================

router.get('/traps', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sourceIp = req.query.sourceIp as string | undefined;
    const traps = snmpTrapService.getTrapHistory(limit, sourceIp);
    res.json({ success: true, data: traps });
  } catch (error: unknown) {
    logger.error('Failed to fetch SNMP traps:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) || '获取 SNMP Trap 记录失败' });
  }
});

router.post('/traps/test', (_req: Request, res: Response) => {
  try {
    const { id } = snmpCrudService.insertTestTrap();
    res.json({ success: true, data: { id }, message: '测试 Trap 已生成' });
  } catch (error: unknown) {
    logger.error('Failed to create test trap:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) || '生成测试 Trap 失败' });
  }
});

router.post('/trap/start', (req: Request, res: Response) => {
  const { port = 162, address = '0.0.0.0' } = req.body;
  snmpTrapService.start(port, address);
  res.json({ success: true });
});

router.post('/trap/stop', (_req: Request, res: Response) => {
  snmpTrapService.stop();
  res.json({ success: true });
});

// ================================================================
// 使用设备 ID 执行 SNMP（复用已有 SNMP 凭证）
// ================================================================

router.get('/device/:deviceId/system-info', async (req: Request, res: Response) => {
  try {
    const device = snmpCrudService.getNetworkDeviceBasic(req.params.deviceId);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    const cred = snmpService.getCredential((device as any).id) || snmpService.getDefaultCredential();
    if (!cred) return res.status(400).json({ success: false, message: 'No SNMP credential configured' });

    const info = await snmpService.getSystemInfo((device as any).ip_address, (cred as any).snmp_port, (cred as any).snmp_version, (cred as any).community || 'public');
    res.json({ success: true, data: info });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.get('/device/:deviceId/interfaces', async (req: Request, res: Response) => {
  try {
    const device = snmpCrudService.getNetworkDeviceBasic(req.params.deviceId);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    const cred = snmpService.getCredential((device as any).id) || snmpService.getDefaultCredential();
    if (!cred) return res.status(400).json({ success: false, message: 'No SNMP credential configured' });

    const ifs = await snmpService.getInterfaces((device as any).ip_address, (cred as any).snmp_port, (cred as any).snmp_version, (cred as any).community || 'public');
    res.json({ success: true, data: ifs });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// ================================================================
// SNMP 指标端点（用于客户端监控/图表）
// ================================================================

router.post('/poll-interfaces', async (req: Request, res: Response) => {
  try {
    const { host, port = 161, version = 'v2c', community = 'public' } = req.body;
    const ifs = await snmpService.getInterfaces(host, port, version as SnmpVersion, community);

    const metrics = ifs
      .filter((i) => i.operStatus === 'up' && i.speed > 0)
      .map((i) => ({
        index: i.index,
        name: i.name,
        operStatus: i.operStatus,
        speed: i.speed,
        inOctets: i.inOctets,
        outOctets: i.outOctets,
        inErrors: i.inErrors,
        outErrors: i.outErrors,
      }));

    res.json({ success: true, data: metrics });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;