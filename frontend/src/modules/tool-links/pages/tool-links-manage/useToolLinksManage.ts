/**
 * 工具链接管理 - Hook
 *
 * 从原 infra/pages/tool-links-manage/useToolLinksManage.ts 抽离（2026-07-08 增量-12）。
 * 改为通过 toolLinksApi 调用。
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toolLinksApi } from '../../api';
import { getAxiosErrorMessage } from '../../../../lib/errorHandler';
import { useToast } from '../../../../contexts/ToastContext';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import type { ToolLink, ToolLinkFormData } from './types';
import { EMPTY_FORM } from './types';

export function useToolLinksManage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ToolLink | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconMode, setIconMode] = useState<'lucide' | 'upload'>('lucide');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<ToolLinkFormData>(EMPTY_FORM);

  useEscapeKey({
    onEscape: () => {
      setIsModalOpen(false);
      setSelectedTool(null);
      setShowIconPicker(false);
    },
    enabled: isModalOpen,
  });
  useEscapeKey({
    onEscape: () => setDeleteConfirm(null),
    enabled: !!deleteConfirm,
  });

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tool-links'],
    queryFn: () => toolLinksApi.listToolLinks(),
  });

  const createMutation = useMutation({
    mutationFn: (data: ToolLinkFormData) => toolLinksApi.createToolLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success('工具链接已添加');
    },
    onError: (err: unknown) => {
      toast.error(getAxiosErrorMessage(err, '添加失败'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ToolLinkFormData> }) =>
      toolLinksApi.updateToolLink(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      closeModal();
      toast.success('工具链接已更新');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || '更新失败');
    },
  });

  const uploadIconMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('icon', file);
      return toolLinksApi.uploadToolLinkIcon(id, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      toast.success('图标已上传');
    },
    onError: (err: unknown) => {
      toast.error(getAxiosErrorMessage(err, '图标上传失败'));
    },
  });

  const deleteIconMutation = useMutation({
    mutationFn: (id: string) => toolLinksApi.deleteToolLinkIcon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      toast.success('图标已重置');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || '重置图标失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => toolLinksApi.deleteToolLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-links'] });
      queryClient.invalidateQueries({ queryKey: ['tool-links', 'categories'] });
      setDeleteConfirm(null);
      toast.success('工具链接已删除');
    },
    onError: () => setDeleteConfirm(null),
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTool(null);
    setShowIconPicker(false);
    setFormData(EMPTY_FORM);
  };

  const openAddModal = () => {
    closeModal();
    setIsModalOpen(true);
  };

  const handleEdit = (tool: ToolLink) => {
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTool) {
      updateMutation.mutate({ id: selectedTool.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const moveOrder = (tool: ToolLink, direction: 'up' | 'down') => {
    if (!tools) return;
    const sorted = [...tools].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const idx = sorted.findIndex((t) => t.id === tool.id);
    if (idx < 0) return;
    const neighbor = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!neighbor) return;
    const temp = tool.sort_order;
    updateMutation.mutate({ id: tool.id, data: { sort_order: neighbor.sort_order } });
    updateMutation.mutate({ id: neighbor.id, data: { sort_order: temp } });
  };

  const filteredTools = Array.isArray(tools)
    ? tools
        .filter((t) => {
          const q = searchQuery.toLowerCase();
          if (!q) return true;
          return (
            t.name.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            t.url.toLowerCase().includes(q)
          );
        })
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    : [];

  return {
    searchQuery,
    setSearchQuery,
    isModalOpen,
    setIsModalOpen,
    selectedTool,
    setSelectedTool,
    deleteConfirm,
    setDeleteConfirm,
    showIconPicker,
    setShowIconPicker,
    iconMode,
    setIconMode,
    uploading,
    setUploading,
    fileInputRef,
    formData,
    setFormData,
    tools,
    isLoading,
    createMutation,
    updateMutation,
    uploadIconMutation,
    deleteIconMutation,
    deleteMutation,
    closeModal,
    openAddModal,
    handleEdit,
    handleSubmit,
    moveOrder,
    filteredTools,
  };
}
