import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { alertRepository } from '../../../repositories';
import { workflowRepository } from '../../../repositories';
import { validateBody, validateParams } from '../../../middleware/validation';
import { alertMappingSchemas } from '../../../shared/schemas/apiValidation';

const router = Router();

function normalizeNullableCondition(value: unknown): string | null {
  if (typeof value !== 'string') return (value === null || value === undefined) ? null : String(value);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const mappings = alertRepository.workflowMappings.list();
    res.json({ success: true, data: mappings });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert workflow mappings' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mapping = alertRepository.workflowMappings.getById(id);

    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }

    res.json({ success: true, data: mapping });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert workflow mapping' });
  }
});

router.post('/', validateBody(alertMappingSchemas.createMapping), (req: Request, res: Response) => {
  try {
    const { alert_source, alert_severity, alert_title_pattern, workflow_id, enabled = 1 } = req.body;

    if (!workflowRepository.workflows.existsById(workflow_id)) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const id = randomUUID();

    alertRepository.workflowMappings.create({
      id,
      alert_source: normalizeNullableCondition(alert_source),
      alert_severity: normalizeNullableCondition(alert_severity),
      alert_title_pattern: normalizeNullableCondition(alert_title_pattern),
      workflow_id,
      enabled: enabled ? 1 : 0,
    });

    res.status(201).json({ success: true, data: { id, alert_source, alert_severity, alert_title_pattern, workflow_id, enabled } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create alert workflow mapping' });
  }
});

router.put('/:id', validateParams(alertMappingSchemas.mappingId), validateBody(alertMappingSchemas.updateMapping), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { alert_source, alert_severity, alert_title_pattern, workflow_id, enabled } = req.body;

    const mapping = alertRepository.workflowMappings.getById(id);
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }

    if (workflow_id) {
      if (!workflowRepository.workflows.existsById(workflow_id)) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
    }

    const updates: Parameters<typeof alertRepository.workflowMappings.update>[1] = {};

    if (alert_source !== undefined) updates.alert_source = normalizeNullableCondition(alert_source);
    if (alert_severity !== undefined) updates.alert_severity = normalizeNullableCondition(alert_severity);
    if (alert_title_pattern !== undefined) updates.alert_title_pattern = normalizeNullableCondition(alert_title_pattern);
    if (workflow_id) updates.workflow_id = workflow_id;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;

    if (Object.keys(updates).length > 0) {
      alertRepository.workflowMappings.update(id, updates);
    }

    res.json({ success: true, message: 'Alert workflow mapping updated' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update alert workflow mapping' });
  }
});

router.delete('/:id', validateParams(alertMappingSchemas.mappingId), (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const changes = alertRepository.workflowMappings.delete(id);

    if (changes === 0) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }

    res.json({ success: true, message: 'Alert workflow mapping deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete alert workflow mapping' });
  }
});

export default router;
