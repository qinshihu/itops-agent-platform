import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Activity, AlertTriangle, Wrench, Calendar } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import AnimatedBarChart from './AnimatedBarChart';
import AnimatedLineChart from './AnimatedLineChart';

interface TrendData {
  days: number;
  daily_inspections: Array<{
    day: string;
    total_inspections: number;
    success_count: number;
    failed_count: number;
    partial_count: number;
    avg_duration_ms: number;
  }>;
  alert_trends: Array<{
    day: string;
    total_alerts: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
  }>;
  remediation_trends: Array<{
    day: string;
    total_executions: number;
    success_count: number;
    failed_count: number;
  }>;
}

interface TrendSummary {
  days: number;
  inspection_count: number;
  inspection_success_rate: number;
  inspection_failed: number;
  alert_count: number;
  alert_critical_count: number;
  avg_alerts_per_day: number;
}

interface TrendChartsProps {
  deviceId?: string;
}

export default function TrendCharts({ deviceId }: TrendChartsProps) {
  const [days, setDays] = useState(7);

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['trends-inspection', days, deviceId],
    queryFn: () => api.get('/api/trends/inspection-history', {
      params: { days, deviceId: deviceId || undefined }
    }).then(r => r.data.data as TrendData),
  });

  const { data: summary } = useQuery({
    queryKey: ['trends-summary', days],
    queryFn: () => api.get('/api/trends/summary', {
      params: { days }
    }).then(r => r.data.data as TrendSummary),
  });

  return (
    <div className="space-y-6">
      {/* 时间范围选择 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="font-medium text-text-primary">历史趋势</h3>
        </div>
        <div className="flex gap-1 bg-background rounded-lg p-0.5 border border-border">
          {[7, 14, 30].map(d => (
            <button key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                days === d ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              近{d}天
            </button>
          ))}
        </div>
      </div>

      {/* 概览卡片 */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div className="bg-surface rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <Activity className="w-3.5 h-3.5" />
              巡检总数
            </div>
            <p className="text-lg font-bold text-text-primary">{summary.inspection_count}</p>
          </div>
          <div className="bg-surface rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              成功率
            </div>
            <p className={clsx('text-lg font-bold', summary.inspection_success_rate > 90 ? 'text-status-success' : 'text-status-failed')}>
              {summary.inspection_success_rate}%
            </p>
          </div>
          <div className="bg-surface rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              告警总数
            </div>
            <p className="text-lg font-bold text-yellow-400">{summary.alert_count}</p>
          </div>
          <div className="bg-surface rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              严重告警
            </div>
            <p className="text-lg font-bold text-status-failed">{summary.alert_critical_count}</p>
          </div>
          <div className="bg-surface rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <Calendar className="w-3.5 h-3.5" />
              日均告警
            </div>
            <p className="text-lg font-bold text-text-primary">{summary.avg_alerts_per_day}</p>
          </div>
        </div>
      )}

      {trendLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : trendData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 巡检趋势 */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="text-sm font-medium text-text-primary mb-3">每日巡检结果</h4>
            <AnimatedBarChart
              data={trendData.daily_inspections.map(d => ({
                label: d.day.slice(5),
                value: d.total_inspections,
                color: '#3b82f6'
              }))}
              height={200}
            />
            <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 成功
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 失败
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> 部分成功
              </span>
            </div>
          </div>

          {/* 告警趋势 */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="text-sm font-medium text-text-primary mb-3">每日告警趋势</h4>
            <AnimatedBarChart
              data={trendData.alert_trends.map(d => ({
                label: d.day.slice(5),
                value: d.total_alerts,
                color: '#ef4444'
              }))}
              height={200}
            />
            <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 严重
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> 高
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> 中
              </span>
            </div>
          </div>

          {/* 巡检成功率 */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="text-sm font-medium text-text-primary mb-3">巡检成功率</h4>
            <AnimatedLineChart
              data={trendData.daily_inspections.map(d => ({
                timestamp: new Date(d.day).getTime(),
                value: d.total_inspections > 0
                  ? Math.round((d.success_count / d.total_inspections) * 100)
                  : 0,
              }))}
              color="#22c55e"
              height={200}
            />
            <p className="text-xs text-text-secondary mt-2">成功率 %</p>
          </div>

          {/* 修复执行趋势 */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="text-sm font-medium text-text-primary mb-3">自动修复执行</h4>
            <AnimatedBarChart
              data={trendData.remediation_trends.map(d => ({
                label: d.day.slice(5),
                value: d.total_executions,
                color: '#a855f7'
              }))}
              height={200}
            />
            <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 成功
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 失败
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
          <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">暂无趋势数据</p>
          <p className="text-xs mt-1">运行巡检后，趋势数据将在此展示</p>
        </div>
      )}
    </div>
  );
}
