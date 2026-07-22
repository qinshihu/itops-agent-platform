/**
 * ToolLinks 数据 hook（2026-07-21 拆分）
 *
 * 把原 ToolLinks.tsx L121-265 的 state + query + mutation + handlers 抽出：
 * - 5 useState（searchQuery / activeCategory / showManageMode / isModalOpen / selectedTool / deleteConfirm / showIconPicker / formData）
 * - 2 useQuery（categories / allTools）
 * - 3 useMutation（createToolLink / updateToolLink / deleteToolLink）
 * - 7 handlers（closeModal / handleEdit / handleSubmit / handleOpen / handleCopyUrl / getFilteredTools / categoryList / totalCount）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useToast } from '@/contexts/ToastContext';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import { toolLinksApi, type ToolLink } from '../../api';
import { DEFAULT_FORM_DATA, type CategoryGroup, type ToolLinkFormData } from './types';

export function useToolLinksData() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showManageMode, setShowManageMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ToolLink | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<ToolLinkFormData>(DEFAULT_FORM_DATA);

  useEscapeKey({
    onEscape: () => {
      setIsModalOpen(false);
      setSelectedTool(null);
      setShowIconPicker(false);
    },
    enabled: isModalOpen,
  });
  useEscapeKey({ onEscape: () => setDeleteConfirm(null), enabled: !!deleteConfirm });

  // ── Queries ──
  const { data: categories, isLoading } = useQuery({
    queryKey: ['tool-links', 'categories'],
    queryFn: () => toolLinksApi.listToolLinkCategories(),
  });

  const { data: allTools } = useQuery({
    queryKey: ['tool-links'],
    queryFn: () => toolLinksApi.listToolLinks(),
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: ToolLinkFormData) => toolLinksApi.createToolLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success('操作成功');
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '操作失败')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ToolLinkFormData> }) =>
      toolLinksApi.updateToolLink(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success('操作成功');
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '操作失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => toolLinksApi.deleteToolLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      setDeleteConfirm(null);
      toast.success('删除成功');
    },
    onError: () => setDeleteConfirm(null),
  });

  // ── Handlers ──
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTool(null);
    setShowIconPicker(false);
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  const handleEdit = useCallback((tool: ToolLink) => {
    setSelectedTool(tool);
    setFormData({
      name: tool.name,
      url: tool.url,
      icon: tool.icon,
      category: tool.category,
      description: tool.description || '',
      sort_order: tool.sort_order,
      is_external: tool.is_external === 1,
    });
    setIsModalOpen(true);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedTool) {
        updateMutation.mutate({ id: selectedTool.id, data: formData });
      } else {
        createMutation.mutate(formData);
      }
    },
    [selectedTool, formData, createMutation, updateMutation],
  );

  const handleOpen = useCallback(
    (url: string) => window.open(url, '_blank', 'noopener,noreferrer'),
    [],
  );

  const handleCopyUrl = useCallback(
    (e: React.MouseEvent, url: string) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(url).then(() => toast.success('链接已复制'));
    },
    [toast],
  );

  // ── Derived ──
  const categoryList = useMemo<CategoryGroup[]>(() => {
    if (Array.isArray(categories)) {
      return categories as CategoryGroup[];
    } else if (categories && typeof categories === 'object') {
      return Object.entries(categories).map(([category, tools]) => ({
        category,
        tools: tools as ToolLink[],
      }));
    }
    return [];
  }, [categories]);

  const totalCount = useMemo(
    () => allTools?.length || categoryList.reduce((sum, c) => sum + c.tools.length, 0),
    [allTools, categoryList],
  );

  const getFilteredTools = useCallback(
    (categoryTools: ToolLink[]) => {
      if (!searchQuery.trim()) return categoryTools;
      const q = searchQuery.toLowerCase();
      return categoryTools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.url.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      );
    },
    [searchQuery],
  );

  const visibleCategories = useMemo(() => {
    return activeCategory === 'all'
      ? categoryList
      : categoryList.filter((c) => c.category === activeCategory);
  }, [activeCategory, categoryList]);

  return {
    // state
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    showManageMode,
    setShowManageMode,
    isModalOpen,
    setIsModalOpen,
    selectedTool,
    setSelectedTool,
    deleteConfirm,
    setDeleteConfirm,
    showIconPicker,
    setShowIconPicker,
    fileInputRef,
    formData,
    setFormData,
    // queries
    isLoading,
    totalCount,
    categoryList,
    visibleCategories,
    allTools: allTools ?? [],
    // mutations
    createMutation,
    updateMutation,
    deleteMutation,
    // handlers
    closeModal,
    handleEdit,
    handleSubmit,
    handleOpen,
    handleCopyUrl,
    getFilteredTools,
  };
}

export type ToolLinksData = ReturnType<typeof useToolLinksData>;
