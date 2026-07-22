/**
 * AlertProviders Provider Guides + 工具（2026-07-21 拆分）
 *
 * 把原 AlertProviders.tsx L34-106 的：
 * - PROVIDER_GUIDES 常量（prometheus / zabbix / grafana / webhook）
 * - getFormFields 函数
 * 全部抽出
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { AlertProvider, FormField } from './types';

export interface ProviderGuide {
  title: string;
  steps: string[];
  webhookFormat?: string;
  note?: string;
}

export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  prometheus: {
    title: 'Prometheus Alertmanager 接入指南',
    steps: [
      '1. 在 Alertmanager 配置文件中添加 webhook receiver：',
      '2. 将下方 Webhook 地址填入 url 字段',
      '3. 重启 Alertmanager 使配置生效',
      '4. 告警触发后会自动推送到此地址，系统自动创建告警记录',
    ],
    webhookFormat: 'alertmanager',
    note: '⚠️ 本系统会自动解析 Alertmanager 的 JSON 格式告警，提取 labels 和 annotations 中的关键字段。',
  },
  zabbix: {
    title: 'Zabbix Webhook 接入指南',
    steps: [
      '1. 在 Zabbix 管理后台 → 报警媒介类型 → 创建 Webhook 类型',
      '2. 将下方 Webhook 地址填入 URL 字段',
      '3. 参数中配置 {ALERT.SUBJECT}、{ALERT.MESSAGE} 等宏',
      '4. 在动作(Actions)中关联此报警媒介',
    ],
    note: '⚠️ Zabbix 告警推送使用 JSON 格式，系统会自动解析 subject 和 message 字段。',
  },
  grafana: {
    title: 'Grafana Alerting 接入指南',
    steps: [
      '1. 在 Grafana → Alerting → Contact points → 新建 Webhook',
      '2. 将下方 Webhook 地址填入 URL 字段',
      '3. 在 Notification policies 中关联此 contact point',
      '4. 告警触发后 Grafana 会自动 POST JSON 到此地址',
    ],
    note: '⚠️ 本系统自动解析 Grafana 告警格式，包括告警名称、状态、标签和值。',
  },
  webhook: {
    title: '通用 Webhook 接入指南',
    steps: [
      '1. 将下方 Webhook 地址配置到任意支持 Webhook 的系统',
      '2. POST JSON 格式数据到该地址',
      '3. 支持字段：title(标题)、severity(严重度)、content(内容)、source(来源)',
    ],
    webhookFormat: 'generic',
    note: '💡 通用格式，适用于自定义系统或第三方工具。最小 JSON 示例：{"title":"告警标题","severity":"warning","content":"告警详情"}',
  },
};

/** 从 provider schema 提取表单字段 */
export function getFormFields(provider: AlertProvider): FormField[] {
  if (!provider?.configSchema?.properties) return [];
  const required = provider.configSchema.required || [];
  return Object.entries(provider.configSchema.properties).map(([key, prop]) => ({
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    type: prop.type,
    description: prop.description || '',
    required: required.includes(key),
    default: prop.default,
    enum: prop.enum,
  }));
}
