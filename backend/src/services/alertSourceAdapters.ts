import { logger } from '../utils/logger';

export interface NormalizedAlert {
  external_id?: string;
  source: string;
  severity: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  status: 'firing' | 'resolved';
  host?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  starts_at?: string;
  ends_at?: string;
}

export interface AlertAdapterResult {
  alerts: NormalizedAlert[];
  errors: string[];
}

function normalizeSeverity(level: string | number): string {
  if (typeof level === 'number') {
    if (level >= 5) return 'critical';
    if (level >= 4) return 'high';
    if (level >= 3) return 'medium';
    if (level >= 2) return 'low';
    return 'info';
  }
  const map: Record<string, string> = {
    critical: 'critical',
    critical_severity: 'critical',
    disaster: 'critical',
    high: 'high',
    error: 'high',
    warning: 'medium',
    warn: 'medium',
    average: 'medium',
    information: 'low',
    info: 'low',
    low: 'low',
    not_classified: 'info',
  };
  return map[level.toLowerCase()] || 'medium';
}

export function adaptPrometheus(payload: unknown): AlertAdapterResult {
  const errors: string[] = [];
  const alerts: NormalizedAlert[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload');
    return { alerts, errors };
  }

  const body = payload as { alerts?: unknown[]; status?: string; version?: string; groupKey?: string };
  const rawAlerts = Array.isArray(body.alerts) ? body.alerts : [];

  for (const raw of rawAlerts) {
    try {
      const alert = raw as Record<string, unknown>;
      const labels = (alert.labels || {}) as Record<string, string>;
      const annotations = (alert.annotations || {}) as Record<string, string>;
      const status = (alert.status as string) || 'firing';

      alerts.push({
        external_id: `${labels.alertname || 'unknown'}-${labels.instance || ''}-${status}`,
        source: 'prometheus',
        severity: normalizeSeverity(labels.severity || 'medium'),
        title: annotations.summary || labels.alertname || 'Prometheus Alert',
        content: annotations.description || annotations.message || JSON.stringify(alert),
        metadata: {
          prometheus_version: body.version,
          group_key: body.groupKey,
          receiver: (body as Record<string, unknown>).receiver,
          labels,
          annotations,
          starts_at: alert.startsAt,
          ends_at: alert.endsAt,
          generator_url: labels.generatorURL,
        },
        status: status === 'resolved' ? 'resolved' : 'firing',
        host: labels.instance || labels.node || labels.host,
        labels,
        annotations,
        starts_at: alert.startsAt as string | undefined,
        ends_at: alert.endsAt as string | undefined,
      });
    } catch (e) {
      errors.push(`Failed to parse Prometheus alert: ${(e as Error).message}`);
    }
  }

  return { alerts, errors };
}

export function adaptZabbix(payload: unknown): AlertAdapterResult {
  const errors: string[] = [];
  const alerts: NormalizedAlert[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload');
    return { alerts, errors };
  }

  const body = payload as Record<string, unknown>;

  try {
    const triggerObj = body.TRIGGER as Record<string, unknown> | undefined;
    const hostObj = body.HOST as Record<string, unknown> | undefined;
    const eventObj = body.event as Record<string, unknown> | undefined;
    const itemObj = body.ITEM as Record<string, unknown> | undefined;

    const trigger = (triggerObj?.NAME as string) || (body.trigger as string) || (eventObj?.name as string);
    if (!trigger) {
      errors.push('Missing trigger name');
      return { alerts, errors };
    }

    const host = (hostObj?.NAME as string) || (body.host as string) || ((eventObj?.host as Record<string, unknown>)?.name as string) || 'Unknown';
    const hostIp = (hostObj?.IP as string) || (body.host_ip as string) || '';
    const rawSeverity = (triggerObj?.SEVERITY as string) || (triggerObj?.PRIORITY as string | number) || (body.severity as string | number) || ((eventObj?.severity as string));
    const severity = normalizeSeverity(rawSeverity);
    const eventId = (body.EVENT as Record<string, unknown>)?.ID || (eventObj?.id as string) || (body.eventid as string);
    const triggerId = (triggerObj?.ID as string) || (body.triggerid as string);
    const item = (itemObj?.NAME as string) || (body.item as string) || '';
    const itemValue = (itemObj?.VALUE as string) || ((body.item as Record<string, unknown>)?.value as string) || (body.value as string) || '';
    const eventTime = ((body.EVENT as Record<string, unknown>)?.TIME as string) || (eventObj?.clock as string) || (body.clock as string);
    const eventDate = ((body.EVENT as Record<string, unknown>)?.DATE as string) || (eventObj?.date as string);

    const eventValue = (body.EVENT as Record<string, unknown>)?.VALUE || (eventObj?.value as string) || (body.value as string);
    const isResolved = eventValue === '0';
    const content = [
      `Host: ${host}`,
      hostIp ? `IP: ${hostIp}` : '',
      `Trigger: ${trigger}`,
      item ? `Item: ${item}` : '',
      itemValue ? `Value: ${itemValue}` : '',
      eventDate && eventTime ? `Time: ${eventDate} ${eventTime}` : '',
      `Severity: ${severity}`,
    ].filter(Boolean).join('\n');

    alerts.push({
      external_id: eventId ? `zabbix-${eventId}` : undefined,
      source: 'zabbix',
      severity,
      title: `[${severity.toUpperCase()}] ${trigger}`,
      content,
      metadata: {
        zabbix_host: host,
        zabbix_host_ip: hostIp,
        zabbix_trigger_id: triggerId,
        zabbix_event_id: eventId,
        zabbix_item: item,
        zabbix_value: itemValue,
        zabbix_event_time: eventTime,
        raw: body,
      },
      status: isResolved ? 'resolved' : 'firing',
      host,
    });
  } catch (e) {
    errors.push(`Failed to parse Zabbix alert: ${(e as Error).message}`);
  }

  return { alerts, errors };
}

export function adaptGrafana(payload: unknown): AlertAdapterResult {
  const errors: string[] = [];
  const alerts: NormalizedAlert[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload');
    return { alerts, errors };
  }

  const body = payload as Record<string, unknown>;
  const rawAlerts = Array.isArray(body.alerts) ? body.alerts : [body];

  for (const raw of rawAlerts) {
    try {
      const alert = raw as Record<string, unknown>;
      const status = (alert.state || alert.status) as string;
      const isResolved = status === 'Normal' || status === 'OK' || status === 'Resolved';

      const labels = (alert.labels || {}) as Record<string, string>;
      const annotations = (alert.annotations || {}) as Record<string, string>;
      const title = (alert.ruleName || alert.title || annotations.title || 'Grafana Alert') as string;
      const content = (alert.message || annotations.description || annotations.summary || JSON.stringify(alert)) as string;
      const rawSeverity = (labels.severity || (alert.severity as string) || labels.level || 'medium') as string | number;

      alerts.push({
        external_id: alert.ruleUID ? `grafana-${alert.ruleUID}` : undefined,
        source: 'grafana',
        severity: normalizeSeverity(rawSeverity),
        title,
        content,
        metadata: {
          grafana_rule_uid: alert.ruleUID,
          grafana_rule_name: alert.ruleName,
          grafana_folder: alert.folder,
          grafana_org_id: alert.orgId,
          grafana_state: status,
          labels,
          annotations,
          eval_matches: alert.evalMatches,
          image_url: alert.imageUrl,
        },
        status: isResolved ? 'resolved' : 'firing',
        host: labels.instance || labels.host || labels.server,
        labels,
        annotations,
      });
    } catch (e) {
      errors.push(`Failed to parse Grafana alert: ${(e as Error).message}`);
    }
  }

  return { alerts, errors };
}

export function adaptAliyun(payload: unknown): AlertAdapterResult {
  const errors: string[] = [];
  const alerts: NormalizedAlert[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload');
    return { alerts, errors };
  }

  const body = payload as Record<string, unknown>;

  try {
    const product = (body.product || body.Product || body.productName) as string || 'Aliyun';
    const name = (body.name || body.alertName || body.ruleName) as string || 'Aliyun Alert';
    const expression = (body.expression || body.triggerExpression) as string || '';
    const state = (body.state || body.status) as string || '';
    const level = (body.level || body.alertLevel) as string || 'medium';
    const instanceId = (body.instanceId || body.resourceId) as string || '';
    const dimensions = body.dimensions || body.resourceDimensions || {};
    const description = (body.description || body.content || body.message) as string || '';

    const isResolved = state === 'OK' || state === 'normal' || state === 'resolved';

    const contentParts = [
      `Product: ${product}`,
      `Rule: ${name}`,
      expression ? `Expression: ${expression}` : '',
      instanceId ? `Instance: ${instanceId}` : '',
      `State: ${state}`,
      description,
    ].filter(Boolean).join('\n');

    alerts.push({
      external_id: body.alertId || body.ruleId ? `aliyun-${body.alertId || body.ruleId}` : undefined,
      source: 'aliyun',
      severity: normalizeSeverity(level),
      title: `[${product}] ${name}`,
      content: contentParts,
      metadata: {
        aliyun_product: product,
        aliyun_instance_id: instanceId,
        aliyun_expression: expression,
        aliyun_state: state,
        aliyun_dimensions: dimensions,
        raw: body,
      },
      status: isResolved ? 'resolved' : 'firing',
      host: instanceId,
    });
  } catch (e) {
    errors.push(`Failed to parse Aliyun alert: ${(e as Error).message}`);
  }

  return { alerts, errors };
}

export function adaptTencentCloud(payload: unknown): AlertAdapterResult {
  const errors: string[] = [];
  const alerts: NormalizedAlert[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload');
    return { alerts, errors };
  }

  const body = payload as Record<string, unknown>;

  try {
    const alarmName = (body.alarmName || body.policyName || body.ruleName) as string || 'Tencent Cloud Alert';
    const alarmType = (body.alarmType || body.productName) as string || 'Tencent Cloud';
    const level = (body.level || body.severity || body.alarmLevel) as string || 'medium';
    const resourceId = (body.resourceId || body.instanceId) as string || '';
    const alarmContent = (body.alarmContent || body.content || body.message || body.detail) as string || '';
    const status = (body.status || body.state) as string || '';
    const policyId = (body.policyId || body.ruleId) as string || '';

    const isResolved = status === 'OK' || status === 'normal' || status === 'resolved';

    const contentParts = [
      `Type: ${alarmType}`,
      `Policy: ${alarmName}`,
      `Policy ID: ${policyId}`,
      resourceId ? `Resource: ${resourceId}` : '',
      `Level: ${level}`,
      alarmContent,
    ].filter(Boolean).join('\n');

    alerts.push({
      external_id: policyId ? `tencent-${policyId}` : undefined,
      source: 'tencent',
      severity: normalizeSeverity(level),
      title: `[${alarmType}] ${alarmName}`,
      content: contentParts,
      metadata: {
        tencent_type: alarmType,
        tencent_resource_id: resourceId,
        tencent_policy_id: policyId,
        tencent_status: status,
        raw: body,
      },
      status: isResolved ? 'resolved' : 'firing',
      host: resourceId,
    });
  } catch (e) {
    errors.push(`Failed to parse Tencent Cloud alert: ${(e as Error).message}`);
  }

  return { alerts, errors };
}

export function detectSourceType(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'unknown';
  const body = payload as Record<string, unknown>;

  if (body.alerts && Array.isArray(body.alerts)) {
    const firstAlert = body.alerts[0];
    if (firstAlert && typeof firstAlert === 'object') {
      const alert = firstAlert as Record<string, unknown>;
      if (alert.labels || alert.annotations || alert.startsAt) return 'prometheus';
      if (alert.state || alert.ruleName || alert.ruleUID) return 'grafana';
    }
  }

  if (body.TRIGGER || body.HOST || body.eventid || body.event || body.triggerid) return 'zabbix';
  if (body.product || body.productName || body.alertLevel || body.dimensions) return 'aliyun';
  if (body.alarmName || body.alarmType || body.policyName) return 'tencent';
  if (body.signature || body.Signature) return 'aliyun';

  return 'generic';
}
