import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, AlertTriangle, Shield, Clock, CheckCircle, XCircle, Loader2, Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';

interface AiRemediation {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  task_id: string | null;
  workflow_id: string | null;
  diagnosis: string;
  remediation_commands: string[];
  risk_level: 'low' | 'medium' | 'high';
  status: 'pending' | 'waiting_approval' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  execution_result?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export default function AiRemediations() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: remediations, isLoading } = useQuery({
    queryKey: ['ai-remediations'],
    queryFn: async () => {
      const res = await api.get('/api/ai-remediations?limit=50');
      return res.data.data as AiRemediation[];
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; color: string; label: string }> = {
      pending: { icon: Clock, color: 'bg-gray-500/10 text-gray-500 border-gray-500/30', label: '待处理' },
      waiting_approval: { icon: Shield, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', label: '等待审批' },
      approved: { icon: CheckCircle, color: 'bg-green-500/10 text-green-500 border-green-500/30', label: '已批准' },
      rejected: { icon: XCircle, color: 'bg-red-500/10 text-red-500 border-red-500/30', label: '已拒绝' },
      executing: { icon: Loader2, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', label: '执行中' },
      completed: { icon: CheckCircle, color: 'bg-green-500/10 text-green-500 border-green-500/30', label: '已完成' },
      failed: { icon: XCircle, color: 'bg-red-500/10 text-red-500 border-red-500/30', label: '失败' },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${badge.color}`}>
        <Icon className={`w-3 h-3 ${status === 'executing' ? 'animate-spin' : ''}`} />
        {badge.label}
      </span>
    );
  };

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500/10 text-green-600 border-green-500/30',
      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
      high: 'bg-red-500/10 text-red-600 border-red-500/30',
    };
    const labels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${colors[risk] || colors.medium}`}>
        {labels[risk] || risk}
      </span>
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">AI 修复记录</h1>
            <p className="text-sm text-text-secondary">AI 自动生成的修复方案及执行状态</p>
          </div>
        </div>
        <div className="text-sm text-text-secondary">
          共 {remediations?.length || 0} 条记录
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p>加载中...</p>
        </div>
      ) : !remediations || remediations.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无 AI 修复记录</p>
          <p className="text-xs mt-1">当 AI 分析告警后自动生成修复方案时，会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-3">
          {remediations.map((rem) => (
            <div
              key={rem.id}
              className="bg-surface border border-border rounded-lg overflow-hidden hover:border-blue-500/50 transition-colors"
            >
              {/* Summary Row */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === rem.id ? null : rem.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-text-primary">
                        {rem.device_name} ({rem.device_ip})
                      </h3>
                      {getStatusBadge(rem.status)}
                      {getRiskBadge(rem.risk_level)}
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                      {rem.diagnosis?.split('\n')[0] || 'AI 诊断中...'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <span>修复命令: {rem.remediation_commands?.length || 0} 条</span>
                      <span>创建: {formatTime(rem.created_at)}</span>
                      {rem.task_id && <span>任务: {rem.task_id.slice(0, 8)}...</span>}
                    </div>
                  </div>
                  <div className="text-text-secondary">
                    {expandedId === rem.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === rem.id && (
                <div className="border-t border-border p-4 space-y-4 bg-background/30">
                  {/* Diagnosis */}
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      AI 诊断报告
                    </h4>
                    <pre className="text-xs text-text-secondary bg-background p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {rem.diagnosis || '暂无诊断结果'}
                    </pre>
                  </div>

                  {/* Commands */}
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-blue-500" />
                      修复命令 ({rem.remediation_commands?.length || 0})
                    </h4>
                    <div className="bg-background p-3 rounded-lg space-y-1">
                      {rem.remediation_commands?.map((cmd, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-text-secondary font-mono w-6 shrink-0">{i + 1}.</span>
                          <code className="text-blue-400 font-mono break-all">{cmd}</code>
                        </div>
                      ))}
                      {(!rem.remediation_commands || rem.remediation_commands.length === 0) && (
                        <p className="text-xs text-text-secondary">AI 未提供修复命令</p>
                      )}
                    </div>
                  </div>

                  {/* Execution Result */}
                  {rem.execution_result && (
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-2">执行结果</h4>
                      <pre className="text-xs text-text-secondary bg-background p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {rem.execution_result}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {rem.error_message && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-500 mb-2">错误信息</h4>
                      <pre className="text-xs text-red-400 bg-red-500/5 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {rem.error_message}
                      </pre>
                    </div>
                  )}

                  {/* Links */}
                  <div className="flex items-center gap-4 text-xs">
                    {rem.task_id && (
                      <a
                        href={`/tasks/${rem.task_id}`}
                        className="text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        查看任务详情 →
                      </a>
                    )}
                    {rem.alert_id && (
                      <a
                        href={`/alerts`}
                        className="text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        查看告警 →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
