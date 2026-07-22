/**
 * WorkflowProviders 数据 Hook（2026-07-21 拆分）
 *
 * 把原 WorkflowProviders.tsx L73-189 的 state + query + mutation + handlers 抽出
 * 包含：
 * - 6 个 useState（selectedId / activeType / searchQuery / testConfig / testResults / copiedId）
 * - 1 useQuery（providers list）
 * - 1 useMutation（test execution）
 * - 3 useMemo（filteredProviders / selectedProvider / typeCounts）
 * - 4 handler（handleCopy / handleTest / handleClearResult / handleRefresh）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import type { ProviderTestResult, TypeKey, WorkflowProvider } from './types';

export function useProvidersData() {
  const queryClient = useQueryClient();

  // ===== State =====
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TypeKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [testConfig, setTestConfig] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ===== Queries =====
  const { data: providers, isLoading } = useQuery<WorkflowProvider[]>({
    queryKey: ['workflow-providers', activeType],
    queryFn: async () => {
      const params = activeType !== 'all' ? { type: activeType } : undefined;
      const { data } = await api.get('/workflows/providers/list', { params });
      return data as WorkflowProvider[];
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({
      providerId,
      config,
    }: {
      providerId: string;
      config: Record<string, unknown>;
    }) => {
      const { data } = await api.post('/workflows/providers/test', { providerId, config });
      return data;
    },
    onSuccess: (data, variables) => {
      setTestResults((prev) => ({
        ...prev,
        [variables.providerId]: {
          success: true,
          result: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        },
      }));
    },
    onError: (error, variables) => {
      setTestResults((prev) => ({
        ...prev,
        [variables.providerId]: {
          success: false,
          error: (error as Error).message || '测试执行失败',
        },
      }));
    },
  });

  // ===== Memos =====
  const filteredProviders = useMemo(() => {
    if (!providers) return [];
    return providers.filter((p) => {
      const matchType = activeType === 'all' || p.type === activeType;
      const matchSearch =
        !searchQuery ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [providers, activeType, searchQuery]);

  const selectedProvider = useMemo(() => {
    if (!selectedId || !providers) return null;
    return providers.find((p) => p.id === selectedId) || null;
  }, [selectedId, providers]);

  const typeCounts = useMemo(() => {
    if (!providers) return {} as Record<string, number>;
    return providers.reduce(
      (acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [providers]);

  // ===== Handlers =====
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleTest = () => {
    if (!selectedProvider) return;
    const config: Record<string, unknown> = {};
    Object.entries(testConfig).forEach(([key, value]) => {
      if (value === '') return;
      try {
        config[key] = JSON.parse(value);
      } catch {
        config[key] = value;
      }
    });
    const required = selectedProvider.configSchema.required || [];
    const missing = required.filter((r) => config[r] === undefined);
    if (missing.length > 0) {
      setTestResults((prev) => ({
        ...prev,
        [selectedProvider.id]: { success: false, error: `缺少必填参数: ${missing.join(', ')}` },
      }));
      return;
    }
    testMutation.mutate({ providerId: selectedProvider.id, config });
  };

  const handleClearResult = () => {
    if (!selectedProvider) return;
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[selectedProvider.id];
      return next;
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['workflow-providers'] });
  };

  return {
    // state
    selectedId,
    setSelectedId,
    activeType,
    setActiveType,
    searchQuery,
    setSearchQuery,
    testConfig,
    setTestConfig,
    testResults,
    copiedId,
    // queries
    providers,
    isLoading,
    testMutationPending: testMutation.isPending,
    // memos
    filteredProviders,
    selectedProvider,
    typeCounts,
    // handlers
    handleCopy,
    handleTest,
    handleClearResult,
    handleRefresh,
  };
}

export type ProvidersData = ReturnType<typeof useProvidersData>;
