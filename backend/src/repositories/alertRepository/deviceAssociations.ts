// ── deviceAssociations 子 repository ──

import db from '../../models/database';
import type { AlertDeviceAssociationInput } from './types';

export const deviceAssociationsRepo = {
  /**
   * 查询告警关联的设备
   * 对应：alertDeviceResolver.getDeviceForAlert
   */
  getByAlertId(alertId: string): { device_type: string; device_id: string; match_method: string } | undefined {
    return db.prepare(`
      SELECT ad.device_type, ad.device_id, ad.match_method
      FROM alert_device_associations ad
      WHERE ad.alert_id = ?
    `).get(alertId) as { device_type: string; device_id: string; match_method: string } | undefined;
  },

  /**
   * 保存告警-设备关联（INSERT OR REPLACE，PK 为 alert_id 即 1:1）
   * 对应：alertDeviceResolver.saveAssociation
   */
  save(input: AlertDeviceAssociationInput): void {
    db.prepare(`
      INSERT OR REPLACE INTO alert_device_associations (alert_id, device_type, device_id, match_method, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(input.alert_id, input.device_type, input.device_id, input.match_method, input.confidence);
  },

  /**
   * 记录未匹配设备的告警（INSERT OR IGNORE）
   * 对应：alertDeviceResolver.recordUnmatchedAlert
   */
  recordUnmatched(alertId: string, title: string, hostname?: string): void {
    db.prepare(`
      INSERT OR IGNORE INTO alert_device_match_log (id, alert_title, alert_hostname, match_method, matched)
      VALUES (?, ?, ?, 'auto', 0)
    `).run(alertId, title?.substring(0, 200) || '', hostname?.substring(0, 100) || '');
  },
};