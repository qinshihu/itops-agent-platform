import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import type {
  RemediationStats,
  PolicyWithStats,
  AlertSourceStats,
  ExecutionTrendItem,
} from './types';

export function useRemediationDashboard() {
  const [trendPeriod, setTrendPeriod] = useState<'24h' | '7d'>('24h');

  const { data: remediationStats, isLoading: isLoadingRemediation } = useQuery({
    queryKey: ['remediation-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/remediation-stats');
      return data as RemediationStats;
    },
    refetchInterval: 30000,
    staleTime: 30000,
  });

  const { data: allPolicies } = useQuery({
    queryKey: ['remediation-policies-all'],
    queryFn: async () => {
      const { data } = await api.get('/remediation-policies', { params: { limit: 100 } });
      return data.policies as Array<{
        id: string;
        name: string;
        enabled: number;
        alert_source: string;
        alert_severity: string;
      }>;
    },
    staleTime: 60000,
  });

  const { data: policiesWithStats, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['remediation-policies-with-stats'],
    queryFn: async () => {
      if (!allPolicies || allPolicies.length === 0) return [];

      const statsPromises = allPolicies.slice(0, 10).map(async (policy) => {
        try {
          const { data } = await api.get(`/remediation-policies/${policy.id}/stats`, {
            params: { days: 7 },
          });
          return {
            id: policy.id,
            name: policy.name,
            enabled: policy.enabled,
            alert_source: policy.alert_source,
            alert_severity: policy.alert_severity,
            stats: data as {
              total_triggers: number;
              success_rate: number;
              avg_duration_ms: number;
            },
          };
        } catch {
          return {
            id: policy.id,
            name: policy.name,
            enabled: policy.enabled,
            alert_source: policy.alert_source,
            alert_severity: policy.alert_severity,
            stats: { total_triggers: 0, success_rate: 0, avg_duration_ms: 0 },
          };
        }
      });

      return (await Promise.all(statsPromises)).filter((p) => p.stats.total_triggers > 0);
    },
    enabled: !!allPolicies && allPolicies.length > 0,
    staleTime: 60000,
  });

  const { data: alertSourceStats, isLoading: isLoadingSources } = useQuery({
    queryKey: ['alert-source-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/alert-source-stats');
      return data.source_stats as AlertSourceStats[];
    },
    staleTime: 60000,
  });

  const { data: executionTrend } = useQuery({
    queryKey: ['remediation-trend', trendPeriod],
    queryFn: async () => {
      const hours = trendPeriod === '24h' ? 24 : 168;
      const { data } = await api.get('/dashboard/task-trends', { params: { hours } });
      return data as ExecutionTrendItem[];
    },
    staleTime: 60000,
  });

  const stats = remediationStats?.today || {
    total: 0,
    success: 0,
    failed: 0,
    rolled_back: 0,
    success_rate: 0,
    avg_duration_ms: 0,
  };

  const sortedPoliciesBySuccessRate = [...(policiesWithStats || [])].sort(
    (a, b) => b.stats.success_rate - a.stats.success_rate
  );

  const maxTriggers = Math.max(
    ...(executionTrend?.map((d) => d.total) || [1]),
    1
  );

  const loading = isLoadingRemediation || isLoadingPolicies || isLoadingSources;

  return {
    trendPeriod,
    setTrendPeriod,
    remediationStats,
    policiesWithStats: (policiesWithStats as PolicyWithStats[] | undefined) || [],
    alertSourceStats,
    executionTrend,
    stats,
    sortedPoliciesBySuccessRate,
    maxTriggers,
    loading,
  };
}
