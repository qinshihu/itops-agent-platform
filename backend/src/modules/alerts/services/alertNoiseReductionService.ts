import { randomUUID, createHash } from 'crypto';
import { logger } from '../../../utils/logger';
import { noiseReductionRepo } from '../../../repositories';
import type { AlertNoiseReductionRecord } from '../../../repositories/alertRepository/types';

interface AlertNoiseRecord {
  id: string;
  alert_fingerprint: string;
  alert_source: string;
  alert_title: string;
  occurrence_count: number;
  first_occurrence: Date;
  last_occurrence: Date;
  is_suppressed: boolean;
  suppression_reason?: string;
  suppression_until?: Date;
}

class AlertNoiseReductionService {
  generateFingerprint(source: string, title: string, _content?: string): string {
    const normalizedTitle = title.toLowerCase().replace(/[\d\s_-]+/g, ' ').trim();
    const normalizedSource = source.toLowerCase();
    const fingerprint = `${normalizedSource}:${normalizedTitle}`;
    return createHash('md5').update(fingerprint).digest('hex');
  }

  async processAlert(
    source: string,
    title: string,
    content?: string,
    severity?: string
  ): Promise<{
    shouldNotify: boolean;
    isDuplicate: boolean;
    suppressionReason?: string;
    occurrenceCount: number;
  }> {
    const fingerprint = this.generateFingerprint(source, title, content);
    const now = new Date();

    const existing = noiseReductionRepo.getByFingerprint(fingerprint);

    if (existing) {
      return this.handleExistingRecord(existing, fingerprint, now, severity);
    }

    return this.handleNewRecord(source, title, fingerprint, now, severity);
  }

  private handleExistingRecord(
    existing: AlertNoiseReductionRecord,
    fingerprint: string,
    now: Date,
    severity?: string
  ): {
    shouldNotify: boolean;
    isDuplicate: boolean;
    suppressionReason?: string;
    occurrenceCount: number;
  } {
    const isSuppressed = existing.is_suppressed &&
      (!existing.suppression_until || new Date(existing.suppression_until) > now);

    const newCount = existing.occurrence_count + 1;
    noiseReductionRepo.updateOccurrence(fingerprint, newCount, now.toISOString());

    const shouldSuppress = this.shouldSuppressAlert(existing, severity);

    if (shouldSuppress && !isSuppressed) {
      noiseReductionRepo.suppress(
        fingerprint,
        '频繁告警自动抑制',
        new Date(now.getTime() + 30 * 60 * 1000).toISOString()
      );
    }

    return {
      shouldNotify: !isSuppressed && !shouldSuppress,
      isDuplicate: true,
      suppressionReason: isSuppressed ? (existing.suppression_reason ?? undefined) : undefined,
      occurrenceCount: newCount
    };
  }

  private handleNewRecord(
    source: string,
    title: string,
    fingerprint: string,
    now: Date,
    severity?: string
  ): {
    shouldNotify: boolean;
    isDuplicate: boolean;
    suppressionReason?: string;
    occurrenceCount: number;
  } {
    const changes = noiseReductionRepo.create({
      id: randomUUID(),
      alert_fingerprint: fingerprint,
      alert_source: source,
      alert_title: title,
      first_occurrence: now.toISOString(),
      last_occurrence: now.toISOString(),
    });

    if (changes === 0) {
      const record = noiseReductionRepo.getByFingerprint(fingerprint);
      if (record) {
        return this.handleExistingRecord(record, fingerprint, now, severity);
      }
    }

    return {
      shouldNotify: true,
      isDuplicate: false,
      occurrenceCount: 1
    };
  }

  private shouldSuppressAlert(record: AlertNoiseReductionRecord, severity?: string): boolean {
    if (severity === 'critical' || severity === 'high') {
      return false;
    }
    return record.occurrence_count >= 5;
  }

  getNoiseReductionStats(): {
    totalAlerts: number;
    suppressedAlerts: number;
    duplicateCount: number;
    noiseReductionRate: number;
  } {
    const stats = noiseReductionRepo.getStats();

    const total = stats.total || 0;
    const suppressed = stats.suppressed || 0;
    const duplicates = stats.duplicates || 0;
    const noiseReductionRate = total > 0
      ? Math.round(((suppressed + duplicates) / (total + duplicates)) * 100)
      : 0;

    return { totalAlerts: total, suppressedAlerts: suppressed, duplicateCount: duplicates, noiseReductionRate };
  }

  getSuppressedAlerts(): AlertNoiseRecord[] {
    const records = noiseReductionRepo.listSuppressed(50);

    return records.map(r => ({
      id: r.id,
      alert_fingerprint: r.alert_fingerprint,
      alert_source: r.alert_source ?? '',
      alert_title: r.alert_title,
      occurrence_count: r.occurrence_count,
      first_occurrence: new Date(r.first_occurrence),
      last_occurrence: new Date(r.last_occurrence),
      is_suppressed: Boolean(r.is_suppressed),
      suppression_until: r.suppression_until ? new Date(r.suppression_until) : undefined
    }));
  }

  unsuppressAlert(fingerprint: string): boolean {
    return noiseReductionRepo.unsuppress(fingerprint) > 0;
  }

  cleanupOldRecords(daysToKeep = 30): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    return noiseReductionRepo.cleanup(cutoffDate.toISOString());
  }

  manuallySuppressAlert(fingerprint: string, reason: string, durationMinutes = 60): boolean {
    const now = new Date();
    const suppressionUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
    return noiseReductionRepo.manuallySuppress(fingerprint, reason, suppressionUntil.toISOString()) > 0;
  }
}

export const alertNoiseReductionService = new AlertNoiseReductionService();

// Auto-cleanup old records every 6 hours
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  const cleaned = alertNoiseReductionService.cleanupOldRecords(30);
  if (cleaned > 0) {
    logger.info(`Auto-cleaned ${cleaned} old alert noise reduction records`);
  }
}, CLEANUP_INTERVAL_MS).unref();
