import { randomUUID } from 'crypto';
import { auditLogRepository } from '../../../repositories';

export const createAuditLog = (data: {
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}): string | null => {
  try {
    const id = randomUUID();

    auditLogRepository.insert({
      id,
      user_id: data.user_id || null,
      action: data.action,
      resource_type: data.resource_type,
      resource_id: data.resource_id || null,
      details: data.details ? JSON.stringify(data.details) : null,
      ip_address: data.ip_address || null
    });

    return id;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return null;
  }
};
