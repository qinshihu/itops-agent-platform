import { normalizeSeverityLabel } from '../../../utils/alertSeverity';

// ---- 告警源 Payload 类型 ----

/** 通用 Webhook 请求体，涵盖 Prometheus / Grafana / Zabbix / Aliyun / Tencent 等告警源的所有已知字段 */
interface WebhookBody {
  // 通用 / 顶层
  alerts?: unknown[];
  status?: string;
  receiver?: unknown;
  signature?: string;
  Signature?: string;
  // Prometheus 专属
  version?: string;
  groupKey?: string;
  // Grafana 专属
  state?: string;
  ruleName?: string;
  ruleUID?: string;
  message?: string;
  evalMatches?: unknown[];
  imageUrl?: string;
  folder?: string;
  orgId?: string;
  // Zabbix 专属
  TRIGGER?: WebhookBody;
  HOST?: WebhookBody;
  EVENT?: WebhookBody;
  ITEM?: WebhookBody;
  event?: WebhookBody;
  eventid?: string;
  triggerid?: string;
  host?: string;
  host_ip?: string;
  trigger?: string;
  severity?: string | number;
  item?: string | WebhookBody;
  value?: string;
  clock?: string;
  // Aliyun 专属
  product?: string;
  Product?: string;
  productName?: string;
  name?: string;
  alertName?: string;
  expression?: string;
  triggerExpression?: string;
  level?: string;
  alertLevel?: string;
  instanceId?: string;
  resourceId?: string;
  dimensions?: unknown;
  resourceDimensions?: unknown;
  description?: string;
  content?: string;
  alertId?: string;
  ruleId?: string;
  // Tencent 专属
  alarmName?: string;
  alarmType?: string;
  policyName?: string;
  policyId?: string;
  alarmContent?: string;
  detail?: string;
  // Prometheus / Grafana 共用（单个 alert 子对象）
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  // 通用兜底
  [key: string]: unknown;
}

export interface NormalizedAlert {
  external_id?: string;
  source: string;
  severity: string;
  raw_severity?: string;
  title: string;
  content: string;
  metadata: WebhookBody;
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

export function adaptPrometheus(payload: unknown): AlertAdapterResult {
  const errors: string[] = [];
  const alerts: NormalizedAlert[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload');
    return { alerts, errors };
  }

  const body = payload as WebhookBody;
  const rawAlerts = Array.isArray(body.alerts) ? body.alerts : [];

  for (const raw of rawAlerts) {
    try {
      const alert = raw as WebhookBody;
      const labels = (alert.labels || {}) as Record<string, string>;
      const annotations = (alert.annotations || {}) as Record<string, string>;
      const status = (alert.status as string) || 'firing';

      alerts.push({
        external_id: `${labels.alertname || 'unknown'}-${labels.instance || ''}-${status}`,
        source: 'prometheus',
        severity: normalizeSeverityLabel(labels.severity || 'medium'),
        raw_severity: labels.severity || 'medium',
        title: annotations.summary || labels.alertname || 'Prometheus Alert',
        content: annotations.description || annotations.message || JSON.stringify(alert),
        metadata: {
          prometheus_version: body.version,
          group_key: body.groupKey,
          receiver: body.receiver,
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

  const body = payload as WebhookBody;

  try {
    const triggerObj = body.TRIGGER;
    const hostObj = body.HOST;
    const eventObj = body.event;
    const itemObj = body.ITEM;

    const trigger = (triggerObj?.NAME as string) || (body.trigger as string) || (eventObj?.name as string);
    if (!trigger) {
      errors.push('Missing trigger name');
      return { alerts, errors };
    }

    const host = (hostObj?.NAME as string) || (body.host as string) || ((eventObj?.host as unknown as WebhookBody)?.name as string) || 'Unknown';
    const hostIp = (hostObj?.IP as string) || (body.host_ip as string) || '';
    const rawSeverity = (triggerObj?.SEVERITY as string) || (triggerObj?.PRIORITY as string | number) || (body.severity as string | number) || ((eventObj?.severity as string));
    const severity = normalizeSeverityLabel(rawSeverity);
    const eventId = body.EVENT?.ID || (eventObj?.id as string) || (body.eventid as string);
    const triggerId = (triggerObj?.ID as string) || (body.triggerid as string);
    const item = (itemObj?.NAME as string) || (body.item as string) || '';
    const itemValue = (itemObj?.VALUE as string) || ((body.item as WebhookBody)?.value as string) || (body.value as string) || '';
    const eventTime = (body.EVENT?.TIME as string) || (eventObj?.clock as string) || (body.clock as string);
    const eventDate = (body.EVENT?.DATE as string) || (eventObj?.date as string);

    const eventValue = body.EVENT?.VALUE || (eventObj?.value as string) || (body.value as string);
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
      raw_severity: (rawSeverity === null || rawSeverity === undefined) ? undefined : String(rawSeverity),
      title: `[${severity.toUpperCase()}] ${trigger}`,
      content,
      metadata: {
        raw_severity: (rawSeverity === null || rawSeverity === undefined) ? null : String(rawSeverity),
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

  const body = payload as WebhookBody;
  const rawAlerts = Array.isArray(body.alerts) ? body.alerts : [body];

  for (const raw of rawAlerts) {
    try {
      const alert = raw as WebhookBody;
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
        severity: normalizeSeverityLabel(rawSeverity),
        raw_severity: (rawSeverity === null || rawSeverity === undefined) ? undefined : String(rawSeverity),
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

  const body = payload as WebhookBody;

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
      severity: normalizeSeverityLabel(level),
      raw_severity: (level === null || level === undefined) ? undefined : String(level),
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

  const body = payload as WebhookBody;

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
      severity: normalizeSeverityLabel(level),
      raw_severity: (level === null || level === undefined) ? undefined : String(level),
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
  const body = payload as WebhookBody;

  if (body.alerts && Array.isArray(body.alerts)) {
    const firstAlert = body.alerts[0];
    if (firstAlert && typeof firstAlert === 'object') {
      const alert = firstAlert as WebhookBody;
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
