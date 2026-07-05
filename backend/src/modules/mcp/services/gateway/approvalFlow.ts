/**
 * gateway/approvalFlow.ts — 审批票据 API + 安全审计 + 外部 MCP Server 管理 API
 */

import type { Request, Response } from 'express';
import type { Router } from 'express';
import { securityGate } from '../securityGate';
import { externalServerManager } from '../externalServerManager';

/**
 * 注册审批流程 + 安全审计 + 外部 MCP Server 管理路由
 */
export function registerApprovalFlowRoutes(router: Router): void {
  /**
   * POST /api/v1/mcp/approval/create
   * 创建审批票据（用于需要审批的破坏性操作）
   */
  router.post('/approval/create', (req: Request, res: Response) => {
    try {
      const { toolName, userId, reason, ttlMs } = req.body;
      if (!toolName || !userId || !reason) {
        res.status(400).json({ error: 'toolName, userId, and reason are required' });
        return;
      }
      const ticket = securityGate.createApprovalTicket(
        toolName,
        userId,
        reason,
        ttlMs
      );
      res.json({ ticketId: ticket.ticketId, expiresAt: new Date(ticket.expiresAt).toISOString() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/v1/mcp/approval/approve
   * 审批通过票据
   */
  router.post('/approval/approve', (req: Request, res: Response) => {
    try {
      const { ticketId, approverId } = req.body;
      if (!ticketId || !approverId) {
        res.status(400).json({ error: 'ticketId and approverId are required' });
        return;
      }
      const success = securityGate.approve(ticketId, approverId);
      if (!success) {
        res.status(404).json({ error: 'Ticket not found or expired' });
        return;
      }
      res.json({ approved: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * GET /api/v1/mcp/approval/:ticketId
   * 查询审批票据状态
   */
  router.get('/approval/:ticketId', (req: Request, res: Response) => {
    const ticket = securityGate.getApprovalTicket(req.params.ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({
      ticketId: ticket.ticketId,
      toolName: ticket.toolName,
      userId: ticket.userId,
      reason: ticket.reason,
      approved: ticket.approved,
      approvedBy: ticket.approvedBy,
      createdAt: new Date(ticket.createdAt).toISOString(),
      expiresAt: new Date(ticket.expiresAt).toISOString(),
    });
  });

  /**
   * GET /api/v1/mcp/audit
   * 查询安全审计日志（最近 50 条）
   */
  router.get('/audit', (_req: Request, res: Response) => {
    res.json(securityGate.getAuditLog(50));
  });

  /**
   * GET /api/v1/mcp/security/config
   * 查询安全门配置
   */
  router.get('/security/config', (_req: Request, res: Response) => {
    res.json(securityGate.getConfig());
  });

  // ============================================================
  // 外部 MCP Server 管理 API
  // ============================================================

  /**
   * GET /api/v1/mcp/external/status
   * 查询所有外部 MCP Server 的连接状态
   */
  router.get('/external/status', (_req: Request, res: Response) => {
    res.json(externalServerManager.getStatus());
  });

  /**
   * POST /api/v1/mcp/external/register
   * 注册外部 MCP Server 配置
   */
  router.post('/external/register', (req: Request, res: Response) => {
    try {
      const config = req.body;
      if (!config.id || !config.namespace || !config.transport) {
        res.status(400).json({ error: 'id, namespace, and transport are required' });
        return;
      }
      externalServerManager.register(config);
      res.json({ registered: true, id: config.id });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/v1/mcp/external/start/:id
   * 启动指定外部 MCP Server
   */
  router.post('/external/start/:id', async (req: Request, res: Response) => {
    try {
      await externalServerManager.start(req.params.id);
      res.json({ started: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/v1/mcp/external/start
   * 启动所有已注册的外部 MCP Server
   */
  router.post('/external/start', async (_req: Request, res: Response) => {
    try {
      const results = await externalServerManager.startAll();
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/v1/mcp/external/stop/:id
   * 停止指定外部 MCP Server
   */
  router.post('/external/stop/:id', (req: Request, res: Response) => {
    try {
      externalServerManager.stop(req.params.id);
      res.json({ stopped: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * DELETE /api/v1/mcp/external/:id
   * 注销外部 MCP Server
   */
  router.delete('/external/:id', (req: Request, res: Response) => {
    try {
      externalServerManager.unregister(req.params.id);
      res.json({ unregistered: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}