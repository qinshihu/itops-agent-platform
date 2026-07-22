/**
 * Zabbix 主动查询路由
 *
 * 提供对 Zabbix JSON-RPC API 的封装查询：
 *   POST /api/v1/monitor/zabbix/test      - 测试连接（login + host.get 探测 + logout）
 *   POST /api/v1/monitor/zabbix/hosts     - host.get
 *   POST /api/v1/monitor/zabbix/items     - item.get
 *   POST /api/v1/monitor/zabbix/history   - history.get
 *   POST /api/v1/monitor/zabbix/triggers  - trigger.get
 *   POST /api/v1/monitor/zabbix/problems  - problem.get
 *
 * 所有路由走 zabbixSchemas Zod 校验，handler 仅做参数透传到 zabbixService。
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { zabbixService } from '../services/zabbixService';
import { validateBody } from '../../../middleware/validation';
import { zabbixSchemas } from '../../../shared/schemas/apiValidation';

const router = Router();

/**
 * POST /test — 测试 Zabbix 连接（认证 + 权限探测）。
 */
router.post('/test', validateBody(zabbixSchemas.test), async (req: Request, res: Response) => {
  const result = await zabbixService.testConnection(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error, data: result.data });
  }
  res.json({ success: true, data: result.data });
});

/**
 * POST /hosts — host.get
 */
router.post('/hosts', validateBody(zabbixSchemas.hosts), async (req: Request, res: Response) => {
  const auth = req.body.apiToken as string | undefined;
  if (!auth) {
    return res.status(400).json({ success: false, error: '需要提供 apiToken（或由 Provider 内部登录）' });
  }
  const result = await zabbixService.getHosts(auth, req.body.filter, {
    url: req.body.url,
    apiToken: auth,
    timeoutMs: req.body.timeoutMs,
  });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result.data });
});

/**
 * POST /items — item.get
 */
router.post('/items', validateBody(zabbixSchemas.items), async (req: Request, res: Response) => {
  const auth = req.body.apiToken as string | undefined;
  if (!auth) {
    return res.status(400).json({ success: false, error: '需要提供 apiToken' });
  }
  const result = await zabbixService.getItems(auth, req.body.hostIds, {
    url: req.body.url,
    apiToken: auth,
    timeoutMs: req.body.timeoutMs,
    itemIds: req.body.itemIds,
    output: req.body.output,
    filter: req.body.filter,
  });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result.data });
});

/**
 * POST /history — history.get
 */
router.post('/history', validateBody(zabbixSchemas.history), async (req: Request, res: Response) => {
  const auth = req.body.apiToken as string | undefined;
  if (!auth) {
    return res.status(400).json({ success: false, error: '需要提供 apiToken' });
  }
  const result = await zabbixService.getHistory(
    auth,
    req.body.itemIds,
    req.body.timeFrom,
    req.body.timeTill,
    {
      url: req.body.url,
      apiToken: auth,
      timeoutMs: req.body.timeoutMs,
      history: req.body.history,
      limit: req.body.limit,
    }
  );
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result.data });
});

/**
 * POST /triggers — trigger.get
 */
router.post('/triggers', validateBody(zabbixSchemas.triggers), async (req: Request, res: Response) => {
  const auth = req.body.apiToken as string | undefined;
  if (!auth) {
    return res.status(400).json({ success: false, error: '需要提供 apiToken' });
  }
  const result = await zabbixService.getTriggers(auth, {
    url: req.body.url,
    apiToken: auth,
    timeoutMs: req.body.timeoutMs,
    triggerIds: req.body.triggerIds,
    hostIds: req.body.hostIds,
    output: req.body.output,
    filter: req.body.filter,
    onlyActive: req.body.onlyActive,
  });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result.data });
});

/**
 * POST /problems — problem.get
 */
router.post('/problems', validateBody(zabbixSchemas.problems), async (req: Request, res: Response) => {
  const auth = req.body.apiToken as string | undefined;
  if (!auth) {
    return res.status(400).json({ success: false, error: '需要提供 apiToken' });
  }
  const result = await zabbixService.getProblems(auth, {
    url: req.body.url,
    apiToken: auth,
    timeoutMs: req.body.timeoutMs,
    hostIds: req.body.hostIds,
    severity: req.body.severity,
    recent: req.body.recent,
    limit: req.body.limit,
  });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result.data });
});

export default router;