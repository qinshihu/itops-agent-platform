import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../../../lib/api';
import type { Room, Rack, Slot, PDU, LifecycleRecord, OverviewData, Manufacturer, DeviceTypeInfo, PowerPanel, PowerFeed, Cable, DeviceSummary, DeviceGroup } from './types';

interface ExportData {
  summary?: { rooms?: number; racks?: number; devices?: number };
  rooms?: unknown[];
  racks?: unknown[];
}

/** 数据中心管理页面的所有状态和 API 操作 */
export default function useDataCenter() {
  const navigate = useNavigate();

  // ===== 核心数据 =====
  const [activeTab, setActiveTab] = useState('overview');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [rackAlertMap, setRackAlertMap] = useState<Record<string, number>>({});

  // ===== 弹窗状态 =====
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [rackModalOpen, setRackModalOpen] = useState(false);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [roomForm] = Form.useForm();
  const [rackForm] = Form.useForm();
  const [slotForm] = Form.useForm();

  // ===== 设备（插槽分配） =====
  const [availDevices, setAvailDevices] = useState<DeviceSummary[]>([]);

  // ===== 生命周期 =====
  const [lifecycles, setLifecycles] = useState<LifecycleRecord[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [lifecyclesLoading, setLifecyclesLoading] = useState(false);

  // ===== PDU =====
  const [pdus, setPdus] = useState<PDU[]>([]);
  const [pduModalOpen, setPduModalOpen] = useState(false);
  const [editingPdu, setEditingPdu] = useState<PDU | null>(null);
  const [pduForm] = Form.useForm();
  const [pdusLoading, setPdusLoading] = useState(false);

  // ===== 导出/导入 =====
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // ===== 设备动作（下架/移位） =====
  const [deviceActionModal, setDeviceActionModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveForm] = Form.useForm();

  // ===== 设备分布 =====
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceGroupLoading, setDeviceGroupLoading] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  // ===== NetBox 资源（制造商/型号/配电柜/馈线/线缆）已抽离到 useNetboxResources =====


  // ===== 搜索过滤器 =====
  const [roomSearch, setRoomSearch] = useState('');
  const [rackSearch, setRackSearch] = useState('');
  const [rackStatusFilter, setRackStatusFilter] = useState('');

  // ===== 初始加载 =====
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, rackRes, ovRes] = await Promise.all([
        api.get('/dc/rooms'),
        api.get('/dc/racks'),
        api.get('/dc/overview'),
      ]);
      const newRooms = (rRes.data?.data ?? rRes.data) || [];
      const newRacks = (rackRes.data?.data ?? rackRes.data) || [];
      const newOverview = (ovRes.data?.data ?? ovRes.data) || null;
      setRooms(newRooms);
      setRacks(newRacks);
      setOverview(newOverview);

      if (newOverview?.rackData) {
        const map: Record<string, number> = {};
        for (const rack of newOverview.rackData) {
          map[rack.id] = rack.alert_count || 0;
        }
        setRackAlertMap(map);
      }
    } catch {
      message.error('加载数据中心数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // URL 参数跳转
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const rackId = params.get('rack');
    if (tab) setActiveTab(tab);
    if (rackId && rackId !== selectedRack?.id && racks.length > 0) {
      const rack = racks.find((r) => r.id === rackId);
      if (rack) {
        setActiveTab('slots');
        selectRack(rack);
      }
    }
  }, [racks]);

  // ===== Tab 切换 =====
  const onTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'lifecycle') loadLifecycles();
    if (key === 'pdus') loadPdus();
    if (key === 'export') loadExport();
    if (key === 'devices') loadDeviceGroups();
    // NetBox Tab 由 useNetboxResources 自行加载

  };

  // ===== 设备导航 =====
  const navigateToDevice = (device: DeviceSummary) => {
    const routeMap: Record<string, string> = {
      server: '/servers',
      network_device: '/network-devices',
      vm_host: '/virtual-machines',
    };
    navigate(routeMap[device.device_type || ''] || '/dc-manage');
  };

  // ===== 加载各 Tab 数据 =====
  const loadDeviceGroups = useCallback(async () => {
    setDeviceGroupLoading(true);
    try {
      const { data } = await api.get('/dc/devices');
      setDeviceGroups(data?.groups || []);
    } catch {
      setDeviceGroups([]);
    } finally {
      setDeviceGroupLoading(false);
    }
  }, []);

  const loadLifecycles = async () => {
    setLifecyclesLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 500 };
      if (lifecycleFilter) params.action = lifecycleFilter;
      const { data } = await api.get('/dc/lifecycle', { params });
      setLifecycles(data || []);
    } catch {
      message.error('加载生命周期记录失败');
    } finally {
      setLifecyclesLoading(false);
    }
  };

  const loadPdus = async () => {
    setPdusLoading(true);
    try {
      const { data } = await api.get('/dc/pdus');
      setPdus(data || []);
    } catch {
      message.error('加载PDU/UPS数据失败');
    } finally {
      setPdusLoading(false);
    }
  };

  const loadExport = async () => {
    try {
      const { data } = await api.get('/dc/export');
      setExportData(data || null);
    } catch {
      message.error('加载导出数据失败');
    }
  };

  // ===== NetBox 功能已抽离到 useNetboxResources =====

  // ===== 选择机柜查看 U 位 =====
  const selectRack = async (rack: Rack) => {
    setSelectedRack(rack);
    try {
      const { data } = await api.get(`/dc/slots/${rack.id}`);
      setSlots(data || []);
    } catch {
      message.error('加载U位数据失败');
      setSlots([]);
    }
  };

  // ===== 机房 CRUD =====
  const saveRoom = async () => {
    try {
      const values = await roomForm.validateFields();
      if (editingRoom) {
        await api.put(`/dc/rooms/${editingRoom.id}`, values);
        message.success('机房更新成功');
      } else {
        await api.post('/dc/rooms', values);
        message.success('机房创建成功');
      }
      setRoomModalOpen(false);
      roomForm.resetFields();
      setEditingRoom(null);
      loadAll();
    } catch {
      if (!roomForm.isFieldsTouched()) return; // 校验失败，antd 会自动提示
    }
  };

  const deleteRoom = async (id: string) => {
    try {
      await api.delete(`/dc/rooms/${id}`);
      message.success('机房已删除');
      loadAll();
    } catch {
      message.error('删除失败，可能有机柜关联');
    }
  };

  // ===== 机柜 CRUD =====
  const saveRack = async () => {
    try {
      const values = await rackForm.validateFields();
      if (editingRack) {
        await api.put(`/dc/racks/${editingRack.id}`, values);
        message.success('机柜更新成功');
      } else {
        await api.post('/dc/racks', values);
        message.success('机柜创建成功');
      }
      setRackModalOpen(false);
      rackForm.resetFields();
      setEditingRack(null);
      loadAll();
    } catch {
      // antd 自动提示校验错误
    }
  };

  const deleteRack = async (id: string) => {
    try {
      await api.delete(`/dc/racks/${id}`);
      message.success('机柜已删除');
      loadAll();
    } catch {
      message.error('删除失败');
    }
  };

  // ===== U 位分配 =====
  const fetchAvailDevices = async () => {
    try {
      const { data } = await api.get('/dc/devices/unallocated');
      setAvailDevices(data || []);
    } catch {
      setAvailDevices([]);
    }
  };

  const assignSlot = async () => {
    try {
      const values = await slotForm.validateFields();
      await api.post('/dc/slots', { ...values, rack_id: selectedRack?.id });
      message.success('设备分配成功');
      setSlotModalOpen(false);
      slotForm.resetFields();
      if (selectedRack) selectRack(selectedRack);
    } catch {
      // antd 自动提示
    }
  };

  const removeSlot = async (slotId: string) => {
    try {
      await api.delete(`/dc/slots/${slotId}`);
      message.success('设备已移除');
      if (selectedRack) selectRack(selectedRack);
    } catch {
      message.error('移除失败');
    }
  };

  // ===== 设备下架弹窗 =====
  const showDeviceActions = (slot: Slot) => {
    setSelectedSlot(slot);
    setDeviceActionModal(true);
  };

  const confirmRemoveSlot = async () => {
    if (!selectedSlot) return;
    await removeSlot(selectedSlot.id);
    setDeviceActionModal(false);
    setSelectedSlot(null);
  };

  // ===== 设备移位 =====
  const openMoveModal = (slot: Slot) => {
    setSelectedSlot(slot);
    moveForm.setFieldsValue({ target_rack_id: '', target_start_u: slot.start_u });
    setMoveModalOpen(true);
  };

  const handleMove = async () => {
    if (!selectedSlot) return;
    try {
      const values = await moveForm.validateFields();
      await api.put(`/dc/slots/${selectedSlot.id}`, values);
      message.success('设备移位成功');
      setMoveModalOpen(false);
      moveForm.resetFields();
      setSelectedSlot(null);
      if (selectedRack) selectRack(selectedRack);
    } catch {
      // antd 自动提示
    }
  };

  // ===== PDU CRUD =====
  const savePdu = async () => {
    try {
      const values = await pduForm.validateFields();
      if (editingPdu) {
        await api.put(`/dc/pdus/${editingPdu.id}`, values);
        message.success('PDU/UPS更新成功');
      } else {
        await api.post('/dc/pdus', values);
        message.success('PDU/UPS创建成功');
      }
      setPduModalOpen(false);
      pduForm.resetFields();
      setEditingPdu(null);
      loadPdus();
    } catch {
      // antd 自动提示
    }
  };

  const deletePdu = async (id: string) => {
    try {
      await api.delete(`/dc/pdus/${id}`);
      message.success('PDU/UPS已删除');
      loadPdus();
    } catch {
      message.error('删除失败');
    }
  };

  // ===== 导入 =====
  const handleImport = async () => {
    setImportLoading(true);
    try {
      await api.post('/dc/import', { data: JSON.parse(importText) });
      message.success('导入成功');
      setImportModalOpen(false);
      setImportText('');
      loadAll();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '导入失败，请检查JSON格式');
    } finally {
      setImportLoading(false);
    }
  };

  // ===== 导出 =====
  const handleExportDownload = async () => {
    try {
      const { data } = await api.get('/dc/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `dc_export_${Date.now()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('下载导出文件失败');
    }
  };

  const handleExportCopy = () => {
    if (exportData) {
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      message.success('已复制到剪贴板');
    }
  };

  return {
    // 状态
    activeTab, setActiveTab,
    rooms, racks, slots, selectedRack,
    loading, overview, rackAlertMap,
    roomModalOpen, setRoomModalOpen,
    rackModalOpen, setRackModalOpen,
    slotModalOpen, setSlotModalOpen,
    editingRoom, setEditingRoom,
    editingRack, setEditingRack,
    roomForm, rackForm, slotForm,
    availDevices,
    lifecycles, lifecycleFilter, setLifecycleFilter, lifecyclesLoading,
    pdus, pduModalOpen, setPduModalOpen,
    editingPdu, setEditingPdu, pduForm, pdusLoading,
    exportData, importModalOpen, setImportModalOpen,
    importText, setImportText, importLoading,
    deviceActionModal, setDeviceActionModal,
    selectedSlot, setSelectedSlot,
    moveModalOpen, setMoveModalOpen, moveForm,
    deviceGroups, deviceSearch, setDeviceSearch,
    deviceGroupLoading, expandedRooms, setExpandedRooms,
    roomSearch, setRoomSearch,
    rackSearch, setRackSearch,
    rackStatusFilter, setRackStatusFilter,
    // NetBox 资源已抽离到 useNetboxResources

    // 操作
    loadAll,
    loadLifecycles, loadPdus, loadExport,
    onTabChange,
    navigateToDevice,
    selectRack,
    saveRoom, deleteRoom,
    saveRack, deleteRack,
    fetchAvailDevices, assignSlot, removeSlot,
    showDeviceActions, confirmRemoveSlot,
    openMoveModal, handleMove,
    savePdu, deletePdu,
    handleImport, handleExportDownload, handleExportCopy,
  };
}
