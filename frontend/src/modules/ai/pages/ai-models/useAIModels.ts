import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import aiApi from '../../api';
import { getAxiosErrorMessage } from '../../../../lib/errorHandler';
import { useToast } from '../../../../contexts/ToastContext';
import type { AIModel, AIModelFormData, UpdateModelPayload } from './types';

const EMPTY_FORM: AIModelFormData = {
  name: '',
  provider_type: 'volcengine',
  model_id: '',
  api_key: '',
  api_base: '',
  tags: '',
};

export function useAIModels() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [draggedModel, setDraggedModel] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [addStep, setAddStep] = useState<'select' | 'form'>('select');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [formData, setFormData] = useState<AIModelFormData>(EMPTY_FORM);

  const { data: modelsData } = useQuery({
    queryKey: ['aiModels'],
    queryFn: () => aiApi.listModels(),
  });

  const createModelMutation = useMutation({
    mutationFn: (data: AIModelFormData) =>
      aiApi.createModel({
        name: data.name,
        provider_type: data.provider_type,
        model_id: data.model_id,
        api_key: data.api_key || null,
        api_base: data.api_base || null,
        use_global_config: false,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
      setShowAddModal(false);
      resetForm();
      setAddStep('select');
    }
  });

  const updateModelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateModelPayload }) =>
      aiApi.updateModel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
      setEditingModel(null);
      resetForm();
      setAddStep('select');
      toast.success('模型更新成功');
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '更新模型失败'));
    }
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
      toast.success('模型删除成功');
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '删除模型失败'));
    }
  });

  const toggleModelMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      aiApi.toggleModel(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
      toast.success('已更新启用状态');
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '更新启用状态失败'));
    }
  });

  const setDefaultModelMutation = useMutation({
    mutationFn: (id: string) => aiApi.setDefaultModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
      toast.success('已设为默认模型');
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '设置默认模型失败'));
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (modelIds: string[]) => aiApi.reorderModels(modelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, '排序失败'));
    }
  });

  const testModelMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingModel(id);
      return await aiApi.testModel(id);
    },
    onSuccess: (data, id) => {
      setTestingModel(null);
      // aiApi.testModel 返回完整 axios 响应（含 success / data 字段）
      const payload = data as { success?: boolean; data?: { message?: string } };
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: !!payload?.success,
          message: payload?.data?.message || ''
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
    },
    onError: (_err, id) => {
      setTestingModel(null);
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: false,
          message: '测试失败'
        }
      }));
    }
  });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingModel(null);
    setAddStep('select');
    resetForm();
    setShowProviderDropdown(false);
  };

  const openAddModal = () => {
    resetForm();
    setEditingModel(null);
    setAddStep('select');
    setShowProviderDropdown(false);
    setShowAddModal(true);
  };

  const openEditModal = (model: AIModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      provider_type: model.provider_type,
      model_id: model.model_id,
      api_key: model.api_key || '',
      api_base: model.api_base || '',
      tags: model.tags ? model.tags.join(', ') : ''
    });
    setAddStep('form');
    setShowProviderDropdown(false);
    setShowAddModal(true);
  };

  const handleProviderSelect = (providerValue: string, defaultBase: string, defaultModels: string[], label: string) => {
    setFormData({
      ...formData,
      provider_type: providerValue as AIModelFormData['provider_type'],
      api_base: defaultBase,
      model_id: defaultModels[0] || '',
      name: label
    });
    setAddStep('form');
    setShowProviderDropdown(false);
  };

  const handleDrop = (targetModelId: string) => {
    if (!draggedModel || draggedModel === targetModelId) return;

    const models = modelsData || [];
    const newOrder = [...models];
    const dragIndex = newOrder.findIndex(m => m.id === draggedModel);
    const dropIndex = newOrder.findIndex(m => m.id === targetModelId);

    if (dragIndex === -1 || dropIndex === -1) return;

    const [dragged] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, dragged);

    const modelIds = newOrder.map(m => m.id);
    reorderMutation.mutate(modelIds);
    setDraggedModel(null);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.model_id) {
      message.error('请填写模型名称和模型 ID');
      return;
    }

    if (editingModel) {
      // P2-8: 「留空 = 不修改」语义
      // 仅当 api_key 是非空字符串时提交（避免覆盖原 key）
      const apiKeyToSend = formData.api_key && formData.api_key.trim() !== ''
        ? formData.api_key
        : null;  // 后端会判定 null = 不更新
      updateModelMutation.mutate({
        id: editingModel.id,
        data: {
          name: formData.name,
          provider_type: formData.provider_type,
          model_id: formData.model_id,
          api_key: apiKeyToSend,
          api_base: formData.api_base || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : []
        }
      });
    } else {
      createModelMutation.mutate(formData);
    }
  };

  return {
    // state
    showAddModal,
    editingModel,
    draggedModel,
    testingModel,
    testResults,
    addStep,
    showProviderDropdown,
    formData,
    setFormData,
    // data
    modelsData,
    // mutations
    testModelMutation,
    toggleModelMutation,
    setDefaultModelMutation,
    deleteModelMutation,
    createModelMutation,
    updateModelMutation,
    // handlers
    setShowProviderDropdown,
    setDraggedModel,
    handleDragStart: setDraggedModel,
    handleDragOver: (e: React.DragEvent) => e.preventDefault(),
    handleDrop,
    handleProviderSelect,
    handleSubmit,
    openAddModal,
    openEditModal,
    closeModal,
    setAddStep,
    setEditingModel,
    resetForm,
  };
}
