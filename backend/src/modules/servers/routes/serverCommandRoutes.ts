/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { executeCommand, testConnection, runComplianceCheck, complianceChecks } from '../services/sshService';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { validateBody, validateParams } from '../../../middleware/validation';
import { commonSchemas, serverCommandSchemas } from '../../../shared/schemas/apiValidation';
import { createAuditLog } from '../../audit/services/auditService';

const router = Router();

router.post('/:id/test', requireRole('admin', 'operator'), validateParams(commonSchemas.idParam), async (req: Request, res: Response) => {
  try {
    const result = await testConnection(req.params.id);
    res.json({ success: result.success, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

router.post('/:id/exec', requireRole('admin', 'operator'), validateParams(commonSchemas.idParam), validateBody(serverCommandSchemas.execCommand), async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const { command, timeout } = req.body;
    const userId = req.user?.id || 'unknown';

    // 通过 auditService 记录命令审计（避免 routes 直访 auditLogRepository）
    createAuditLog({
      user_id: userId,
      action: 'command-execute',
      resource_type: 'server',
      resource_id: req.params.id,
      details: { command, isSafe: true, warnings: [] } as any,
    });

    const result = await executeCommand(req.params.id, command, {
      timeout,
      executedBy: userId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to execute command' });
  }
});

router.get('/compliance/checks', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: complianceChecks.map((check) => ({
      name: check.name,
      command: check.command,
    })),
  });
});

router.post('/:id/compliance', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const saveResults = req.body.saveResults !== false;
    const useAI = req.body.useAI !== false;
    const concurrency = req.body.concurrency || 5;

    const results = await runComplianceCheck(req.params.id, {
      saveResults,
      useAI,
      concurrency,
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Compliance check error:', error);
    res.status(500).json({ success: false, error: 'Failed to run compliance check' });
  }
});

export default router;
