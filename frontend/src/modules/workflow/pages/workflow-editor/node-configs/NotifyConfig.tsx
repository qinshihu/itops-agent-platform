/**
 * NotifyConfig — 通知节点配置面板
 *
 * 节点类型：notify
 * 用法：发送即时通知（飞书/钉钉/企微/Email/Webhook）
 *
 * 配置项：
 * - channel / message / recipients / severity
 */

import type { Node } from '@xyflow/react';
import { Bell } from 'lucide-react';

interface NotifyConfigProps {
  selectedNode: Node;
  onUpdate: (nodeId: string, partial: Record<string, unknown>) => void;
}

interface NotifyNodeData {
  channel?: 'wechat' | 'dingtalk' | 'feishu' | 'email' | 'webhook';
  message?: string;
  title?: string;
  recipients?: string;
  severity?: 'info' | 'warning' | 'critical';
  description?: string;
  allowFailure?: boolean;
}

const CHANNEL_LABELS: Record<string, string> = {
  wechat: '企业微信',
  dingtalk: '钉钉',
  feishu: '飞书',
  email: '邮件',
  webhook: 'Webhook',
};

export function NotifyConfig({ selectedNode, onUpdate }: NotifyConfigProps) {
  const config = (selectedNode.data || {}) as NotifyNodeData;

  return (
    <div className="pt-3 border-t border-border">
      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Bell className="w-4 h-4 text-orange-500" />
        通知配置
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-text-secondary mb-1">通知渠道</label>
          <select
            value={config.channel || 'wechat'}
            onChange={(e) => onUpdate(selectedNode.id, { channel: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            {Object.entries(CHANNEL_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">严重级别</label>
          <select
            value={config.severity || 'info'}
            onChange={(e) => onUpdate(selectedNode.id, { severity: e.target.value })}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          >
            <option value="info">Info（信息）</option>
            <option value="warning">Warning（警告）</option>
            <option value="critical">Critical（紧急）</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">标题</label>
          <input
            type="text"
            value={config.title || ''}
            onChange={(e) => onUpdate(selectedNode.id, { title: e.target.value })}
            placeholder="工作流通知：{{workflow_name}}"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">消息内容</label>
          <textarea
            value={config.message || ''}
            onChange={(e) => onUpdate(selectedNode.id, { message: e.target.value })}
            placeholder="支持 {{variable}} 变量替换，可使用 markdown"
            rows={4}
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">接收人（可选）</label>
          <input
            type="text"
            value={config.recipients || ''}
            onChange={(e) => onUpdate(selectedNode.id, { recipients: e.target.value })}
            placeholder="多个用逗号分隔，留空使用默认"
            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            checked={!!config.allowFailure}
            onChange={(e) => onUpdate(selectedNode.id, { allowFailure: e.target.checked })}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <label className="text-sm text-text-secondary">
            通知发送失败时不影响主流程
          </label>
        </div>
      </div>
    </div>
  );
}