import { Router, Request, Response, NextFunction } from 'express';
import { executeCommand, testConnection, runComplianceCheck, complianceChecks } from '../services/sshService';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';
import { checkCommandSafety } from '../middleware/commandFilter';

const router = Router();

function logCommandAudit(
  userId: string,
  serverId: string,
  command: string,
  isSafe: boolean,
  warnings: string[]
) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      randomUUID(),
      userId,
      'command-execute',
      'server',
      serverId,
      JSON.stringify({ command, isSafe, warnings })
    );
  } catch (error) {
    logger.error('Failed to log command audit:', error);
  }
}

router.post('/:id/test', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const result = await testConnection(req.params.id);
    res.json({ success: result.success, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

router.post('/:id/exec', requireRole('admin', 'operator'), (req: Request, res: Response, next: NextFunction) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }

  const userRole = (req as Request & { user?: { role?: string } }).user?.role || 'viewer';
  const safetyCheck = checkCommandSafety(command, userRole);

  if (!safetyCheck.allowed) {
    return res.status(403).json({ success: false, error: safetyCheck.reason, policy: safetyCheck.policy });
  }

  (req as Request & { commandWarnings?: string[] }).commandWarnings = safetyCheck.severity === 'warning' ? [safetyCheck.reason || ''] : undefined;
  next();
}, async (req: Request & { user?: { id: string }; commandWarnings?: string[] }, res: Response) => {
  try {
    const { command, timeout } = req.body;

    const userId = req.user?.id || 'unknown';

    logCommandAudit(userId, req.params.id, command, true, []);

    const result = await executeCommand(req.params.id, command, {
      timeout,
      executedBy: userId
    });

    res.json({
      success: true,
      data: result,
      warnings: req.commandWarnings
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to execute command' });
  }
});

router.get('/compliance/checks', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: complianceChecks.map(check => ({
      name: check.name,
      command: check.command
    }))
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
      concurrency 
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({ success: false, error: 'Failed to run compliance check' });
  }
});

export default router;
