import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../contexts/ToastContext';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import api from '../../../../lib/api';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import type { NetworkDevice, InspectionResultData, SnmpInspectionData, TimelineItem, DeviceTimelineEntry } from './types';

/**
 * 网络设备页面状态管理 Hook
 *
 * 封装网络设备列表、筛选、模态框状态、批量选择、
 * 巡检/连接测试/历史/SNMP 巡检 等业务逻辑。
 */
export function useNetworkDevices() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  // ── 状态 ──
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectionResult, setInspectionResult] = useState<InspectionResultData | null>(null);
  const [snmpInspectionResult, setSnmpInspectionResult] = useState<SnmpInspectionData | null>(null);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectingDevice, setInspectingDevice] = useState<NetworkDevice | null>(null);
  const [inspectionType, setInspectionType] = useState<'standard' | 'custom' | 'full'>('standard');
  const [customDescription, setCustomDescription] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [showHistory, setShowHistory] = useState<NetworkDevice | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [isBatchInspecting, setIsBatchInspecting] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [deleteConfirmDevice, setDeleteConfirmDevice] = useState<NetworkDevice | null>(null);

  // ── ESC 键关闭模态框 ──
  useEscapeKey({ onEscape: () => { setShowInspectionModal(false); setInspectingDevice(null); }, enabled: showInspectionModal });
  useEscapeKey({ onEscape: () => setShowBatchModal(false), enabled: showBatchModal });
  useEscapeKey({ onEscape: () => { setDeleteConfirmDevice(null); }, enabled: !!deleteConfirmDevice });
  useEscapeKey({ onEscape: () => { setInspectionResult(null); setInspectingDevice(null); }, enabled: !!inspectionResult });
  useEscapeKey({ onEscape: () => { setSnmpInspectionResult(null); }, enabled: !!snmpInspectionResult });
  useEscapeKey({ onEscape: () => setShowHistory(null), enabled: !!showHistory });

  // ── 设备列表 ──
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['network-devices'],
    queryFn: () => api.get('/network-devices').then(res => res.data),
  });

  // ── 设备时间轴 ──
  const { data: deviceTimeline = {} as Record<string, DeviceTimelineEntry> } = useQuery({
    queryKey: ['device-timeline'],
    queryFn: async () => {
      const { data } = await api.get('/inspection-center?limit=300');
      const items = (data || []) as TimelineItem[];
      const map: Record<string, DeviceTimelineEntry> = {};
      items.forEach((item: TimelineItem) => {
        if (!item.device_id) return;
        if (!map[item.device_id]) map[item.device_id] = {};
        if (item.source === 'analysis' && !map[item.device_id].lastAnalysis) map[item.device_id].lastAnalysis = item;
        if (item.source === 'inspection' && !map[item.device_id].lastInspection) map[item.device_id].lastInspection = item;
      });
      return map;
    },
    refetchInterval: 60000,
  });

  // ── Mutations ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/network-devices/${id}`),
    onSuccess: () => {
      toast.success('设备删除成功');
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
    },
    onError: () => toast.error('删除设备失败'),
  });

  // ── 操作处理 ──
  const handleDelete = (device: NetworkDevice) => setDeleteConfirmDevice(device);

  const confirmDelete = () => {
    if (deleteConfirmDevice) {
      deleteMutation.mutate(deleteConfirmDevice.id);
      setDeleteConfirmDevice(null);
    }
  };

  const handleEdit = (device: NetworkDevice) => {
    setEditingDevice(device);
    setIsAddModalOpen(true);
  };

  const handleInspect = (device: NetworkDevice, type: 'standard' | 'custom' | 'full' = 'standard') => {
    setInspectingDevice(device);
    setInspectionType(type);
    setCustomDescription('');
    setShowInspectionModal(true);
  };

  const handleSnmpInspect = async (device: NetworkDevice) => {
    try {
      const response = await api.post(`/network-devices/${device.id}/inspect-snmp`);
      const data = response.data.data;
      data._deviceName = device.name;
      setSnmpInspectionResult(data);
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
    } catch (error) {
      const e = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error('SNMP 巡检失败: ' + (e.response?.data?.error || e.message || '未知错误'));
    }
  };

  const handleSnmpTestConnection = async (device: NetworkDevice) => {
    if (!device.snmp_credential_id) {
      toast.error('该设备未关联 SNMP 凭证');
      return;
    }
    try {
      const response = await api.post(`/snmp/credentials/${device.snmp_credential_id}/test`, {
        host: device.ip_address,
      });
      if (response.data.code === 0) {
        toast.success('SNMP 连接成功 ✅');
      } else {
        toast.error('SNMP 连接失败: ' + (response.data.message || ''));
      }
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('SNMP 测试失败: ' + (e.response?.data?.message || e.message || ''));
    }
  };

  const handleTestConnection = async (device: NetworkDevice) => {
    try {
      toast.info(`正在测试 ${device.name} 的连接...`);
      const response = await api.post(`/network-devices/${device.id}/test-connection`);
      const result = response.data;
      if (result.success) {
        toast.success(`连接成功 (${result.data.latency}ms)`);
      } else {
        toast.error(`连接失败: ${result.data.message}`);
      }
    } catch {
      toast.error('测试连接失败');
    }
  };

  const handleHistory = (device: NetworkDevice) => setShowHistory(device);

  const executeInspection = async () => {
    if (!inspectingDevice) return;
    setIsInspecting(true);
    try {
      const response = await api.post(`/network-devices/${inspectingDevice.id}/inspect`, {
        inspectionType,
        customDescription: inspectionType === 'custom' ? customDescription : undefined,
      });
      setInspectionResult(response.data.data);
      toast.success('巡检完成');
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
    } catch (error: unknown) {
      toast.error('巡检失败: ' + getAxiosErrorMessage(error));
    } finally {
      setIsInspecting(false);
    }
  };

  const executeBatchInspection = async () => {
    if (selectedDevices.size === 0) return;
    setIsBatchInspecting(true);
    try {
      const response = await api.post('/network-devices/batch-inspect', {
        deviceIds: Array.from(selectedDevices),
        inspectionType: 'standard',
      });
      toast.success(`批量巡检完成，共 ${response.data.data.length} 台设备`);
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
      setSelectedDevices(new Set());
      setShowBatchModal(false);
    } catch (error) {
      const e = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error('批量巡检失败: ' + (e.response?.data?.error || e.message || '未知错误'));
    } finally {
      setIsBatchInspecting(false);
    }
  };

  // ── 批量选择 ──
  const toggleDeviceSelection = (id: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedDevices(newSelected);
  };

  const clearSelection = () => setSelectedDevices(new Set());

  const setSelectAll = (ids: string[]) => setSelectedDevices(new Set(ids));

  const handleBatchInspect = () => {
    if (selectedDevices.size === 0) {
      toast.error('请至少选择一台设备');
      return;
    }
    setShowBatchModal(true);
  };

  return {
    // 数据
    devices,
    isLoading,
    deviceTimeline,
    selectedDevices,
    // 筛选
    selectedVendor, setSelectedVendor,
    searchQuery, setSearchQuery,
    // 模态框
    isAddModalOpen, setIsAddModalOpen,
    editingDevice, setEditingDevice,
    showInspectionModal, setShowInspectionModal,
    inspectingDevice, setInspectingDevice,
    inspectionType, setInspectionType,
    customDescription, setCustomDescription,
    isInspecting, setIsInspecting,
    inspectionResult, setInspectionResult,
    snmpInspectionResult, setSnmpInspectionResult,
    showBatchModal, setShowBatchModal,
    isBatchInspecting, setIsBatchInspecting,
    showHistory, setShowHistory,
    deleteConfirmDevice, setDeleteConfirmDevice,
    // 操作
    handleDelete, confirmDelete,
    handleEdit,
    handleInspect,
    handleSnmpInspect,
    handleSnmpTestConnection,
    handleTestConnection,
    handleHistory,
    executeInspection,
    executeBatchInspection,
    toggleDeviceSelection, clearSelection, setSelectAll, handleBatchInspect,
    refreshDevices: () => queryClient.invalidateQueries({ queryKey: ['network-devices'] }),
    // 其他
    navigate,
  };
}