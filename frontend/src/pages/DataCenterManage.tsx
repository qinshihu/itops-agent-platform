/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Card, Row, Col, Statistic, Tabs, InputNumber, Tooltip, Badge, Empty, Spin } from 'antd';
import {
  Plus, Edit, Trash2, Server, Monitor, Wifi, LayoutGrid, CuboidIcon as Cube,
  Search, Download, Upload, Database, Clock, AlertTriangle, Thermometer,
  HardDrive, Cpu, MemoryStick, ToggleLeft, HardDrive as Hdd, ArrowUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const deviceTypeColors: Record<string, string> = {
  server: 'blue',
  network_device: 'purple',
  vm_host: 'cyan',
  pdu: 'orange',
  ups: 'gold',
  other: 'default',
};

const actionColors: Record<string, string> = {
  mounted: 'green',
  unmounted: 'red',
  moved: 'blue',
  maintenance: 'orange',
};

export default function DataCenterManage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [rooms, setRooms] = useState<any[]>([]);
  const [racks, setRacks] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedRack, setSelectedRack] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [rackModalOpen, setRackModalOpen] = useState(false);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editingRack, setEditingRack] = useState<any>(null);
  const [roomForm] = Form.useForm();
  const [rackForm] = Form.useForm();
  const [slotForm] = Form.useForm();
  const [availDevices, setAvailDevices] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);

  // Lifecycle state
  const [lifecycles, setLifecycles] = useState<any[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState('');

  // PDU state
  const [pdus, setPdus] = useState<any[]>([]);
  const [pduModalOpen, setPduModalOpen] = useState(false);
  const [editingPdu, setEditingPdu] = useState<any>(null);
  const [pduForm] = Form.useForm();

  // Export state
  const [exportData, setExportData] = useState<any>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Device action state (下架/移位)
  const [deviceActionModal, setDeviceActionModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveForm] = Form.useForm();

  // Search filters
  const [roomSearch, setRoomSearch] = useState('');
  const [rackSearch, setRackSearch] = useState('');
  const [rackStatusFilter, setRackStatusFilter] = useState('');

  // Overview rack alert counts
  const [rackAlertMap, setRackAlertMap] = useState<Record<string, number>>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rRes, rackRes, ovRes] = await Promise.all([
        api.get('/api/dc/rooms'),
        api.get('/api/dc/racks'),
        api.get('/api/dc/overview'),
      ]);
      const newRooms = rRes.data.data || [];
      const newRacks = rackRes.data.data || [];
      const newOverview = ovRes.data.data || null;
      setRooms(newRooms);
      setRacks(newRacks);
      setOverview(newOverview);

      // Build rack alert map from overview
      if (newOverview?.rackData) {
        const map: Record<string, number> = {};
        for (const rack of newOverview.rackData) {
          map[rack.id] = rack.alert_count || 0;
        }
        setRackAlertMap(map);
      }
    } catch { message.error('加载数据中心数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // URL 参数跳转（从 data-room 或其它页面跳转过来）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const rackId = params.get('rack');
    if (tab) setActiveTab(tab);
    if (rackId && rackId !== selectedRack?.id && racks.length > 0) {
      const rack = racks.find((r: any) => r.id === rackId);
      if (rack) {
        setActiveTab('slots');
        selectRack(rack);
      }
    }
  }, [racks]);

  const navigate = useNavigate();

  // ===== 设备分布 =====
  const [deviceGroups, setDeviceGroups] = useState<any[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceGroupLoading, setDeviceGroupLoading] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  const loadDeviceGroups = useCallback(async () => {
    setDeviceGroupLoading(true);
    try {
      const res = await api.get('/api/dc/devices');
      setDeviceGroups(res.data.data?.groups || []);
    } catch { setDeviceGroups([]); }
    finally { setDeviceGroupLoading(false); }
  }, []);

  // ===== Lifecycle =====
  const [lifecyclesLoading, setLifecyclesLoading] = useState(false);
  const loadLifecycles = async () => {
    setLifecyclesLoading(true);
    try {
      const params: any = { limit: 500 };
      if (lifecycleFilter) params.action = lifecycleFilter;
      const res = await api.get('/api/dc/lifecycle', { params });
      setLifecycles(res.data.data || []);
    } catch { message.error('加载生命周期记录失败'); }
    finally { setLifecyclesLoading(false); }
  };

  // ===== PDUs =====
  const [pdusLoading, setPdusLoading] = useState(false);
  const loadPdus = async () => {
    setPdusLoading(true);
    try {
      const res = await api.get('/api/dc/pdus');
      setPdus(res.data.data || []);
    } catch { message.error('加载PDU/UPS数据失败'); }
    finally { setPdusLoading(false); }
  };

  // ===== Export =====
  const loadExport = async () => {
    try {
      const res = await api.get('/api/dc/export');
      setExportData(res.data.data || null);
    } catch { message.error('加载导出数据失败'); }
  };

  // Tab change handler
  const onTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'lifecycle') loadLifecycles();
    if (key === 'pdus') loadPdus();
    if (key === 'export') loadExport();
    if (key === 'devices') loadDeviceGroups();
  };

  // ===== 设备导航 =====
  const navigateToDevice = (device: any) => {
    const routeMap: Record<string, string> = {
      server: '/servers',
      network_device: '/network-devices',
      vm_host: '/virtual-machines',
    };
    navigate(routeMap[device.device_type] || '/dc-manage');
  };

  // ===== 设备分布渲染 =====
  const renderDeviceDistributionTab = () => {
    const filtered = deviceGroups.map((room: any) => ({
      ...room,
      racks: Object.fromEntries(
        Object.entries(room.racks).filter(([, rack]: any) =>
          !deviceSearch ||
          rack.rack_name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
          rack.devices.some((d: any) =>
            d.device_name?.toLowerCase().includes(deviceSearch.toLowerCase())
          )
        )
      ),
    })).filter((r: any) => Object.keys(r.racks).length > 0);

    return (
      <Spin spinning={deviceGroupLoading}>
        <div className="mb-4">
          <Input
            prefix={<Search size={14} className="text-text-tertiary" />}
            placeholder="搜索设备名称或机柜编号..."
            value={deviceSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeviceSearch(e.target.value)}
            allowClear
            className="max-w-sm"
          />
        </div>
        {filtered.length === 0 ? (
          <Empty description="暂无设备数据，请先在 U位 中分配设备到机柜" />
        ) : (
          <div className="space-y-6">
            {filtered.map((room: any) => (
              <Card key={room.room_id} size="small" title={
                <span className="text-sm font-semibold">{room.room_name}</span>
              } className="border border-gray-700">
                {Object.values(room.racks).map((rack: any) => (
                  <div key={rack.rack_id} className="mb-3 last:mb-0">
                    <div className="text-xs font-semibold text-text-secondary mb-1">{rack.rack_name}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {rack.devices.map((dev: any) => {
                        const typeLabel: Record<string, string> = {
                          server: '服务器', network_device: '网络设备', vm_host: '虚拟机',
                        };
                        const typeColor: Record<string, string> = {
                          server: 'blue', network_device: 'purple', vm_host: 'cyan',
                        };
                        return (
                          <div key={dev.slot_id}
                            className="flex items-center gap-2 px-3 py-2 rounded border border-gray-700/50 hover:border-cyan-500/40 bg-gray-800/30 cursor-pointer transition-colors"
                            onClick={() => navigateToDevice(dev)}
                          >
                            <div>
                              <div className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                                <Tag color={typeColor[dev.device_type]} className="text-[10px] leading-none m-0">
                                  {typeLabel[dev.device_type] || dev.device_type}
                                </Tag>
                                {dev.device_name || '(未命名)'}
                              </div>
                              <div className="text-[10px] text-text-tertiary mt-0.5">
                                U{dev.start_u}-U{dev.end_u}
                                {dev.ip_address ? ` · ${dev.ip_address}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </Spin>
    );
  };

  // ===== 批次导入 =====
  const handleImport = async () => {
    setImportLoading(true);
    try {
      const parsed = JSON.parse(importText);
      await api.post('/api/dc/import', parsed);
      message.success('导入成功');
      setImportModalOpen(false);
      setImportText('');
      loadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '导入失败，请检查JSON格式');
    } finally { setImportLoading(false); }
  };

  const handleExportDownload = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dc-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCopy = () => {
    if (!exportData) return;
    navigator.clipboard?.writeText(JSON.stringify(exportData, null, 2)).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败')
    );
  };

  // ===== 选择机柜查看U位 =====
  const selectRack = async (rack: any) => {
    setSelectedRack(rack);
    try {
      const res = await api.get(`/api/dc/slots/${rack.id}`);
      setSlots(res.data.data || []);
    } catch { message.error('加载U位信息失败'); }
  };

  // ===== 加载可分配设备 =====
  const loadAvailDevices = async (type: string) => {
    try {
      const res = await api.get('/api/dc/available-devices', { params: { type } });
      setAvailDevices(res.data.data || []);
    } catch {}
  };

  // ===== 机房 CRUD =====
  const saveRoom = async () => {
    const vals = await roomForm.validateFields();
    try {
      if (editingRoom) {
        await api.put(`/api/dc/rooms/${editingRoom.id}`, vals);
        message.success('更新成功');
      } else {
        await api.post('/api/dc/rooms', vals);
        message.success('创建成功');
      }
      setRoomModalOpen(false);
      setEditingRoom(null);
      roomForm.resetFields();
      loadAll();
    } catch { message.error('操作失败'); }
  };
  const deleteRoom = async (id: string) => {
    try { await api.delete(`/api/dc/rooms/${id}`); message.success('删除成功'); loadAll(); } catch { message.error('删除失败'); }
  };

  // ===== 机柜 CRUD =====
  const saveRack = async () => {
    const vals = await rackForm.validateFields();
    try {
      if (editingRack) { await api.put(`/api/dc/racks/${editingRack.id}`, vals); }
      else { await api.post('/api/dc/racks', vals); }
      setRackModalOpen(false);
      setEditingRack(null);
      rackForm.resetFields();
      loadAll();
    } catch { message.error('操作失败'); }
  };
  const deleteRack = async (id: string) => {
    try { await api.delete(`/api/dc/racks/${id}`); message.success('删除成功'); loadAll(); } catch { message.error('删除失败'); }
  };

  // ===== 分配U位 =====
  const assignSlot = async () => {
    const vals = await slotForm.validateFields();
    try {
      await api.post('/api/dc/slots', { ...vals, lifecycle_notes: '手动分配' });
      setSlotModalOpen(false);
      slotForm.resetFields();
      if (selectedRack) selectRack(selectedRack);
      loadAll();
      message.success('设备已添加到机柜');
    } catch (e: any) {
      message.error(e?.response?.data?.message || '分配失败');
    }
  };
  const removeSlot = async (id: string) => {
    try {
      await api.delete(`/api/dc/slots/${id}`);
      message.success('设备已从机柜移除');
      if (selectedRack) selectRack(selectedRack);
      loadAll();
    } catch { message.error('移除失败'); }
  };

  // 显示设备操作弹窗
  const showDeviceActions = (slot: any) => {
    setSelectedSlot(slot);
    setDeviceActionModal(true);
  };

  // 打开移位弹窗
  const openMoveModal = () => {
    setDeviceActionModal(false);
    moveForm.resetFields();
    moveForm.setFieldsValue({
      rack_id: selectedSlot?.rack_id,
      start_u: selectedSlot?.start_u,
      end_u: selectedSlot?.end_u,
      position_face: selectedSlot?.position_face || 'front',
    });
    setMoveModalOpen(true);
  };

  // 执行移位
  const handleMove = async () => {
    const vals = await moveForm.validateFields();
    try {
      await api.put(`/api/dc/slots/${selectedSlot.id}`, vals);
      message.success('设备移位成功');
      setMoveModalOpen(false);
      setSelectedSlot(null);
      if (selectedRack) selectRack(selectedRack);
      loadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '移位失败');
    }
  };

  // 确认下架
  const confirmRemoveSlot = async () => {
    if (!selectedSlot) return;
    await removeSlot(selectedSlot.id);
    setDeviceActionModal(false);
    setSelectedSlot(null);
  };

  // ===== PDU CRUD =====
  const savePdu = async () => {
    const vals = await pduForm.validateFields();
    try {
      if (editingPdu) {
        await api.put(`/api/dc/pdus/${editingPdu.id}`, vals);
        message.success('更新成功');
      } else {
        await api.post('/api/dc/pdus', vals);
        message.success('创建成功');
      }
      setPduModalOpen(false);
      setEditingPdu(null);
      pduForm.resetFields();
      loadPdus();
    } catch { message.error('操作失败'); }
  };
  const deletePdu = async (id: string) => {
    try { await api.delete(`/api/dc/pdus/${id}`); message.success('删除成功'); loadPdus(); } catch { message.error('删除失败'); }
  };

  // ===== 渲染U位图 =====
  const renderSlotMap = () => {
    if (!selectedRack) return <div className="text-text-tertiary text-center py-12">← 选择一个机柜查看U位详情</div>;
    const totalU = selectedRack.total_u || 42;
    const usedU = slots.reduce((s, sl) => s + (sl.end_u - sl.start_u + 1), 0);
    const utilPercent = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;
    const rows: React.ReactNode[] = [];

    for (let u = totalU; u >= 1; u--) {
      const slot = slots.find(s => u >= s.start_u && u <= s.end_u);
      if (slot) {
        if (u === slot.end_u) {
          const height = slot.end_u - slot.start_u + 1;
          const statusColor = slot.device_status === 'online' || slot.server_status === 'online'
            ? 'bg-green-500/20 border-green-500/40' :
            slot.device_status === 'warning' || slot.server_status === 'warning'
              ? 'bg-yellow-500/20 border-yellow-500/40' :
            slot.device_status === 'critical' || slot.server_status === 'critical'
              ? 'bg-red-500/20 border-red-500/40' :
            'bg-blue-500/20 border-blue-500/40';
          const statusDot = slot.device_status === 'online' || slot.server_status === 'online' ? '🟢' :
            slot.device_status === 'warning' || slot.server_status === 'warning' ? '🟡' :
            slot.device_status === 'critical' || slot.server_status === 'critical' ? '🔴' : '⚪';

          rows.push(
            <div key={u}
              className={`flex items-center border-l-2 ${statusColor} px-3 py-1 text-xs cursor-pointer hover:brightness-125 transition-all device-slot`}
              style={{ height: `${Math.max(height * 28, 28)}px` }}
              onClick={() => showDeviceActions(slot)}
            >
              <span className="w-8 text-text-tertiary shrink-0">U{slot.start_u}{slot.end_u > slot.start_u ? `-${slot.end_u}` : ''}</span>
              <span className="mr-1 text-[10px]">{statusDot}</span>
              <Tag color={deviceTypeColors[slot.device_type] || 'default'} className="shrink-0 mx-1 text-[10px]" style={{ lineHeight: '16px', fontSize: 10 }}>{slot.device_type === 'server' ? '🖥' : '🌐'}</Tag>
              <span className="text-text-primary truncate flex-1 text-[11px]">{slot.device_name || slot.device_id}</span>
              {slot.cpu_usage !== null && (
                <div className="w-12 h-2 bg-gray-700 rounded-sm mr-1 overflow-hidden">
                  <div className={`h-full rounded-sm ${slot.cpu_usage > 80 ? 'bg-red-500' : slot.cpu_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${slot.cpu_usage}%` }} />
                </div>
              )}
              {slot.memory_usage !== null && (
                <div className="w-12 h-2 bg-gray-700 rounded-sm mr-1 overflow-hidden">
                  <div className={`h-full rounded-sm ${slot.memory_usage > 80 ? 'bg-red-500' : slot.memory_usage > 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    style={{ width: `${slot.memory_usage}%` }} />
                </div>
              )}
            </div>
          );
        }
      } else {
        rows.push(
          <div key={u} className="flex items-center border-l border-gray-800 px-3 py-[3px] text-xs text-text-tertiary">
            <span className="w-8 shrink-0">U{u}</span>
            <span className="text-text-secondary">— 空位 —</span>
          </div>
        );
      }
    }

    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-800 text-sm font-medium text-text-secondary flex items-center gap-2">
          <Cube size={14} />
          {selectedRack.name} ({selectedRack.room_name || selectedRack.room_label || '?'}) — {totalU}U
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span>已占用: <strong className="text-blue-400">{usedU}U</strong> ({utilPercent}%)</span>
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${utilPercent > 85 ? 'bg-red-500' : utilPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${utilPercent}%` }} />
            </div>
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '700px' }}>
          {rows}
        </div>
      </div>
    );
  };

  // ===== 概览页：机柜热力图 =====
  const renderOverviewTab = () => {
    if (!overview) return <Spin />;

    // 空库状态：显示引导页
    if (overview.isEmpty) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-6">
            <Server size={40} className="text-text-tertiary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">暂无数据中心资产</h3>
          <p className="text-sm text-text-secondary mb-6 text-center max-w-md">
            当前数据库中没有机房、机柜或设备数据。请手动添加真实资产开始使用。
          </p>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditingRoom(null); roomForm.resetFields(); setRoomModalOpen(true); setActiveTab('rooms'); }}>
            手动添加机房
          </Button>
        </div>
      );
    }

    const { summary, rackData } = overview;
    const roomsGrouped: Record<string, any[]> = {};
    (rackData || []).forEach((r: any) => {
      const roomKey = r.room_id || 'unknown';
      if (!roomsGrouped[roomKey]) roomsGrouped[roomKey] = [];
      roomsGrouped[roomKey].push(r);
    });

    return (
      <div>
        {/* Summary cards */}
        <Row gutter={[12, 12]} className="mb-6">
          <Col span={3}><Card size="small"><Statistic title="机房" value={summary?.totalRooms || 0} prefix={<Monitor size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="机柜" value={summary?.totalRacks || 0} prefix={<LayoutGrid size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="设备" value={summary?.totalDevices || 0} prefix={<Server size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="在线" value={summary?.onlineDevices || 0} valueStyle={{ color: '#52c41a' }} prefix={<Wifi size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="告警" value={summary?.alertDevices || 0} valueStyle={{ color: '#ff4d4f' }} prefix={<AlertTriangle size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="PUE" value={summary?.pue?.toFixed(2) || '-'} prefix={<Database size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="温度" value={summary?.avgTemp ? `${summary.avgTemp.toFixed(1)}°C` : '-'} prefix={<Thermometer size={14} />} /></Card></Col>
          <Col span={3}><Card size="small"><Statistic title="湿度" value={summary?.avgHumidity ? `${summary.avgHumidity.toFixed(0)}%` : '-'} prefix={<Hdd size={14} />} /></Card></Col>
        </Row>

        {/* 功耗 PUE 行 */}
        <Row gutter={[12, 12]} className="mb-6">
          <Col span={6}><Card size="small"><Statistic title="总功耗" value={summary?.totalPower ? `${summary.totalPower.toFixed(1)} kW` : '-'} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="IT 功耗" value={summary?.itPower ? `${summary.itPower.toFixed(1)} kW` : '-'} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="制冷功耗" value={summary?.coolingPower ? `${summary.coolingPower.toFixed(1)} kW` : '-'} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="临界设备" value={summary?.criticalDevices || 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>

        {overview.isPartialMock && (
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-400 flex items-center gap-2">
            <Database size={16} />
            当前为<span className="font-semibold">真实+虚拟混合</span>模式。有 <strong>{overview.summary?.totalRacks || 0}</strong> 个机柜（含虚拟补齐），可继续添加真实设备。
          </div>
        )}

        {/* 机柜热力图 */}
        <Tabs
          className="dc-tabs"
          items={overview.rooms?.length > 0 ? overview.rooms.map((room: any) => ({
            key: room.id,
            label: <span className="dc-tab-label">{room.name || room.label}</span>,
            children: (
              <div className="grid grid-cols-4 gap-3">
                {(rackData || [])
                  .filter((r: any) => r.room_id === room.id)
                  .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
                  .map((rack: any) => {
                    const usedU = rack.used_u || 0;
                    const totalU = rack.total_u || 42;
                    const pct = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;
                    const alertCount = rackAlertMap[rack.id] || 0;
                    const colorClass = alertCount > 0 ? 'from-red-500/20 to-red-500/5 border-red-500/30' :
                      pct > 85 ? 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30' :
                      pct > 0 ? 'from-green-500/20 to-green-500/5 border-green-500/20' :
                      'from-gray-500/10 to-gray-500/5 border-gray-700';
                    const statusIcon = alertCount > 0 ? '🔴' : pct > 85 ? '🟡' : pct > 0 ? '🟢' : '⚪';

                    return (
                      <Tooltip key={rack.id} title={
                        <div className="text-xs">
                          <div>机柜 {rack.name} | 排{rack.row_number}</div>
                          <div>占用: {usedU}/{totalU}U ({pct}%)</div>
                          <div>设备: {rack.device_count}台</div>
                          {alertCount > 0 && <div className="text-red-400">告警: {alertCount}条</div>}
                        </div>
                      }>
                        <div className={`bg-gradient-to-br ${colorClass} border rounded-lg p-3 cursor-pointer hover:scale-[1.02] transition-all`}
                          onClick={() => { setActiveTab('slots'); setTimeout(() => selectRack(rack), 100); }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-text-primary">{rack.name}</span>
                            <span className="text-xs">{statusIcon}</span>
                          </div>
                          <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${
                              alertCount > 0 ? 'bg-red-500' : pct > 85 ? 'bg-yellow-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                            }`} style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-text-tertiary">
                            <span>{usedU}/{totalU}U</span>
                            <span>{rack.device_count}设备</span>
                          </div>
                          {alertCount > 0 && (
                            <div className="mt-1 text-xs text-red-400">⚠ {alertCount}告警</div>
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
              </div>
            ),
          })) : [
            { key: 'empty', label: '暂无数据', children: <Empty description="暂无数据" /> }
          ]}
        />
      </div>
    );
  };

  // ===== Tables =====
  const filteredRooms = rooms.filter(r =>
    !roomSearch || r.name?.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.label?.toLowerCase().includes(roomSearch.toLowerCase())
  );
  const filteredRacks = racks.filter(r =>
    (!rackSearch || r.name?.toLowerCase().includes(rackSearch.toLowerCase())) &&
    (!rackStatusFilter || r.status === rackStatusFilter)
  );

  const roomColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '标签', dataIndex: 'label', key: 'label', render: (v: string) => <Tag>{v}</Tag> },
    { title: '尺寸', key: 'size', render: (_: any, r: any) => `${r.width_m || 20}m × ${r.depth_m || 15}m` },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
    { title: '操作', key: 'action', render: (_: any, rec: any) => (
      <Space>
        <Button type="link" size="small" icon={<Edit size={14} />}
          onClick={() => { setEditingRoom(rec); roomForm.setFieldsValue(rec); setRoomModalOpen(true); }}>编辑</Button>
        <Popconfirm title="确定删除?" onConfirm={() => deleteRoom(rec.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const rackColumns = [
    { title: '编号', dataIndex: 'name', key: 'name', render: (v: string, r: any) => (
      <Space>
        <span>{v}</span>
        {r.status === 'warning' && <Tag color="orange" style={{ fontSize: 10 }}>⚠</Tag>}
      </Space>
    )},
    { title: '机房', dataIndex: 'room_name', key: 'room_name' },
    { title: '排号', dataIndex: 'row_number', key: 'row_number' },
    { title: 'U位', dataIndex: 'total_u', key: 'total_u' },
    { title: '已用', key: 'used_u', render: (_: any, r: any) => {
      const pct = r.total_u > 0 ? Math.round(((r.used_u || 0) / r.total_u) * 100) : 0;
      const barColor = pct > 85 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';
      return <div className="flex items-center gap-2"><div className="w-16 h-2 bg-gray-700 rounded-full"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} /></div><span className="text-xs">{r.used_u || 0}/{r.total_u || 42}</span></div>;
    }},
    { title: '设备数', dataIndex: 'device_count', key: 'device_count' },
    { title: '告警', key: 'alerts', render: (_: any, r: any) => {
      const ac = rackAlertMap[r.id] || 0;
      return ac > 0 ? <Badge count={ac} size="small"><span className="text-red-400">⚠</span></Badge> : <span className="text-text-tertiary">-</span>;
    }},
    { title: '操作', key: 'action', render: (_: any, rec: any) => (
      <Space>
        <Button type="link" size="small" icon={<LayoutGrid size={14} />}
          onClick={() => { setActiveTab('slots'); setTimeout(() => selectRack(rec), 100); }}>U位</Button>
        <Button type="link" size="small" icon={<Edit size={14} />}
          onClick={() => { setEditingRack(rec); rackForm.setFieldsValue(rec); setRackModalOpen(true); }}>编辑</Button>
        <Popconfirm title="确定删除?" onConfirm={() => deleteRack(rec.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const lifecycleColumns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color={actionColors[v] || 'default'}>{v === 'mounted' ? '上架' : v === 'unmounted' ? '下架' : v === 'moved' ? '迁移' : v === 'maintenance' ? '维护' : v}</Tag> },
    { title: '设备类型', dataIndex: 'device_type', key: 'device_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '来源位置', dataIndex: 'from_location', key: 'from_location', render: (v: string) => v !== 'N/A' ? v : '-' },
    { title: '目标位置', dataIndex: 'to_location', key: 'to_location', render: (v: string) => v !== 'N/A' ? v : '-' },
    { title: '操作者', dataIndex: 'performed_by', key: 'performed_by' },
    { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true },
  ];

  const pduColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === 'ups' ? 'gold' : v === 'pdu' ? 'orange' : 'default'}>{v.toUpperCase()}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'normal' ? 'green' : v === 'warning' ? 'orange' : 'red'}>{v}</Tag> },
    { title: '机柜', dataIndex: 'rack_name', key: 'rack_name', render: (v: string) => v || '-' },
    { title: '容量(W)', dataIndex: 'power_capacity_w', key: 'power_capacity_w', render: (v: number) => v ? `${v}W` : '-' },
    { title: '当前负载(W)', dataIndex: 'current_load_w', key: 'current_load_w', render: (v: number) => v ? `${v}W` : '-' },
    { title: '负载率', key: 'load', render: (_: any, r: any) => {
      if (!r.power_capacity_w || !r.current_load_w) return '-';
      const pct = Math.round((r.current_load_w / r.power_capacity_w) * 100);
      return <div className="flex items-center gap-2"><div className="w-16 h-2 bg-gray-700 rounded-full"><div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div><span className="text-xs">{pct}%</span></div>;
    }},
    { title: 'IP', dataIndex: 'ip_address', key: 'ip_address', render: (v: string) => v || '-' },
    { title: '操作', key: 'action', render: (_: any, rec: any) => (
      <Space>
        <Button type="link" size="small" icon={<Edit size={14} />}
          onClick={() => { setEditingPdu(rec); pduForm.setFieldsValue(rec); setPduModalOpen(true); }}>编辑</Button>
        <Popconfirm title="确定删除?" onConfirm={() => deletePdu(rec.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div className="p-6">
      <style>{`
        .dc-tabs .ant-tabs-tab { padding: 8px 12px !important; }
        .dc-tabs .ant-tabs-tab-btn { color: #9ca3af !important; }
        .dc-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #e5e7eb !important; font-weight: 700 !important; }
        .dc-tabs .ant-tabs-ink-bar { background: #60a5fa !important; height: 3px !important; border-radius: 2px !important; }
        .dc-tabs .ant-tabs-tab:hover .ant-tabs-tab-btn { color: #d1d5db !important; }
        .dc-tab-label { display: flex; align-items: center; gap: 4px; }
      `}</style>
      <div className="flex items-center justify-between mb-4">
        <Tabs activeKey={activeTab} onChange={onTabChange}
          className="font-semibold text-sm dc-tabs"
          items={[
            { key: 'overview', label: <span className="dc-tab-label">📊 总览</span> },
            { key: 'devices', label: <span className="dc-tab-label">🖥️ 设备分布</span> },
            { key: 'rooms', label: <span className="dc-tab-label">🏠 机房</span> },
            { key: 'racks', label: <span className="dc-tab-label">🗄️ 机柜</span> },
            { key: 'slots', label: <span className="dc-tab-label">📦 U位</span> },
            { key: 'lifecycle', label: <span className="dc-tab-label">🔄 生命周期</span> },
            { key: 'pdus', label: <span className="dc-tab-label">🔌 供电</span> },
            { key: 'export', label: <span className="dc-tab-label">📤 导出/导入</span> },
          ]}
        />
        <Space>
          {activeTab === 'rooms' && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { setEditingRoom(null); roomForm.resetFields(); setRoomModalOpen(true); }}>新建机房</Button>
          )}
          {activeTab === 'racks' && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { setEditingRack(null); rackForm.resetFields(); setRackModalOpen(true); }}>新建机柜</Button>
          )}
          {activeTab === 'slots' && selectedRack && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { slotForm.resetFields(); slotForm.setFieldsValue({ rack_id: selectedRack.id }); loadAvailDevices('server'); setSlotModalOpen(true); }}>添加设备</Button>
          )}
          {activeTab === 'pdus' && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { setEditingPdu(null); pduForm.resetFields(); setPduModalOpen(true); }}>新建供电设备</Button>
          )}
          {activeTab === 'export' && (
            <Space>
              <Button icon={<Download size={14} />} onClick={handleExportDownload} disabled={!exportData}>下载JSON</Button>
              <Button icon={<Upload size={14} />} onClick={() => setImportModalOpen(true)}>导入</Button>
            </Space>
          )}
        </Space>
      </div>

      {/* ===== Overview Tab ===== */}
      {activeTab === 'overview' && renderOverviewTab()}

      {/* ===== Devices Tab ===== */}
      {activeTab === 'devices' && renderDeviceDistributionTab()}

      {/* ===== Rooms Tab ===== */}
      {activeTab === 'rooms' && (
        <div>
          <Input
            prefix={<Search size={14} className="text-text-tertiary" />}
            placeholder="搜索机房名称/标签..."
            className="mb-4 max-w-xs"
            value={roomSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomSearch(e.target.value)}
            allowClear
          />
          <Table columns={roomColumns} dataSource={filteredRooms.map(r => ({ ...r, key: r.id }))} loading={loading} pagination={false} />
        </div>
      )}

      {/* ===== Racks Tab ===== */}
      {activeTab === 'racks' && (
        <div>
          <Space className="mb-4">
            <Input
              prefix={<Search size={14} className="text-text-tertiary" />}
              placeholder="搜索机柜编号..."
              value={rackSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRackSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={rackStatusFilter || undefined}
              onChange={(v: string) => setRackStatusFilter(v || '')}
            >
              <Select.Option value="normal">正常</Select.Option>
              <Select.Option value="warning">警告</Select.Option>
              <Select.Option value="critical">严重</Select.Option>
            </Select>
          </Space>
          <Table columns={rackColumns} dataSource={filteredRacks.map((r, i) => {
            const room = rooms.find(rm => rm.id === r.room_id);
            return { ...r, key: r.id, room_name: room?.name || room?.label || r.room_id };
          })} loading={loading} pagination={false} scroll={{ x: 900 }} />
        </div>
      )}

      {/* ===== Slots Tab ===== */}
      {activeTab === 'slots' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <Card title="机柜列表" size="small"
              extra={
                <Input
                  prefix={<Search size={12} className="text-text-tertiary" />}
                  placeholder="搜索..."
                  size="small"
                  style={{ width: 120 }}
                />
              }
            >
              <div className="space-y-1 max-h-[650px] overflow-y-auto">
                {racks.map(r => {
                  const room = rooms.find(rm => rm.id === r.room_id);
                  const ac = rackAlertMap[r.id] || 0;
                  return (
                    <div key={r.id}
                      className={`px-3 py-2 rounded cursor-pointer text-sm flex items-center gap-2 transition-colors
                        ${selectedRack?.id === r.id ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-gray-800 text-text-secondary border border-transparent'}`}
                      onClick={() => selectRack(r)}>
                      <LayoutGrid size={14} />
                      <span>{r.name}</span>
                      {ac > 0 && <Tag color="red" className="ml-auto text-[10px]">{ac}</Tag>}
                      <Tag className="ml-auto text-xs">{room?.label || room?.name || '-'}</Tag>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div className="col-span-2">
            {renderSlotMap()}
          </div>
        </div>
      )}

      {/* ===== Lifecycle Tab ===== */}
      {activeTab === 'lifecycle' && (
        <div>
          <Space className="mb-4">
            <Select
              placeholder="动作筛选"
              allowClear
              style={{ width: 130 }}
              value={lifecycleFilter || undefined}
              onChange={(v: string) => setLifecycleFilter(v || '')}
            >
              <Select.Option value="mounted">上架</Select.Option>
              <Select.Option value="unmounted">下架</Select.Option>
              <Select.Option value="moved">迁移</Select.Option>
              <Select.Option value="maintenance">维护</Select.Option>
            </Select>
            <Button icon={<Search size={14} />} onClick={loadLifecycles}>刷新</Button>
          </Space>
          <Table columns={lifecycleColumns} dataSource={lifecycles.map((l: any) => ({ ...l, key: l.id }))}
            pagination={{ pageSize: 50 }} scroll={{ x: 800 }} loading={lifecyclesLoading} />
        </div>
      )}

      {/* ===== PDUs Tab ===== */}
      {activeTab === 'pdus' && (
        <Table columns={pduColumns} dataSource={pdus.map((p: any) => ({ ...p, key: p.id }))}
          pagination={false} scroll={{ x: 1000 }} loading={pdusLoading} />
      )}

      {/* ===== Export Tab ===== */}
      {activeTab === 'export' && (
        <div>
          <div className="mb-4 text-sm text-text-secondary">
            导出数据中心完整布局数据为 JSON 格式，包含机房、机柜、U位、生命周期和供电设备信息。
          </div>
          {exportData ? (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-primary">
                  包含 {exportData.summary?.rooms || 0} 个机房, {exportData.summary?.racks || 0} 个机柜,
                  {exportData.summary?.slots || 0} 个U位, {exportData.summary?.lifecycles || 0} 条记录,
                  {exportData.summary?.pdus || 0} 个供电设备
                </span>
                <Space>
                  <Button size="small" icon={<Download size={14} />} onClick={handleExportDownload}>下载JSON</Button>
                  <Button size="small" onClick={handleExportCopy}>复制JSON</Button>
                </Space>
              </div>
              <pre className="text-xs text-text-secondary max-h-96 overflow-auto bg-gray-950 rounded p-3 border border-gray-800">
                {JSON.stringify(exportData, null, 2).slice(0, 5000)}
                {JSON.stringify(exportData, null, 2).length > 5000 && '\n... (截断)'}
              </pre>
            </div>
          ) : (
            <Spin />
          )}
        </div>
      )}

      {/* ===== Modals ===== */}

      {/* 机房 Modal */}
      <Modal title={editingRoom ? '编辑机房' : '新建机房'} open={roomModalOpen} onOk={saveRoom} onCancel={() => { setRoomModalOpen(false); setEditingRoom(null); }}>
        <Form form={roomForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="label" label="显示标签（如A区）"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="width_m" label="宽度(米)"><InputNumber min={5} className="w-full" /></Form.Item>
            <Form.Item name="depth_m" label="进深(米)"><InputNumber min={5} className="w-full" /></Form.Item>
          </div>
          <Form.Item name="sort_order" label="排序"><InputNumber min={0} className="w-full" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 机柜 Modal */}
      <Modal title={editingRack ? '编辑机柜' : '新建机柜'} open={rackModalOpen} onOk={saveRack} onCancel={() => { setRackModalOpen(false); setEditingRack(null); }}>
        <Form form={rackForm} layout="vertical">
          <Form.Item name="room_id" label="所属机房" rules={[{ required: true }]}>
            <Select>
              {rooms.map(r => <Select.Option key={r.id} value={r.id}>{r.name} ({r.label || '-'})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="机柜编号" rules={[{ required: true }]}><Input placeholder="A-01" /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="row_number" label="排号"><InputNumber min={1} className="w-full" /></Form.Item>
            <Form.Item name="total_u" label="总U数"><InputNumber min={12} max={60} className="w-full" /></Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="position_x" label="3D坐标X"><InputNumber className="w-full" /></Form.Item>
            <Form.Item name="position_z" label="3D坐标Z"><InputNumber className="w-full" /></Form.Item>
          </div>
          <Form.Item name="sort_order" label="排序"><InputNumber min={0} className="w-full" /></Form.Item>
        </Form>
      </Modal>

      {/* 分配U位 Modal */}
      <Modal title="添加设备到机柜" open={slotModalOpen} onOk={assignSlot} onCancel={() => setSlotModalOpen(false)} width={500}>
        <Form form={slotForm} layout="vertical" initialValues={{ rack_id: selectedRack?.id, position_face: 'front' }}>
          <Form.Item name="rack_id" hidden><Input /></Form.Item>
          <Form.Item label="机柜"><strong className="text-blue-400">{selectedRack?.name}</strong></Form.Item>
          <Form.Item name="device_type" label="设备类型" rules={[{ required: true }]}>
            <Select onChange={(v: string) => loadAvailDevices(v)}>
              <Select.Option value="server">服务器</Select.Option>
              <Select.Option value="network_device">网络设备</Select.Option>
              <Select.Option value="virtual_machine">虚拟机</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="device_id" label="选择设备" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="搜索设备...">
              {availDevices.map((d: any) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name} ({d.ip_address || '-'})
                  {d.status && <Tag className="ml-2" color={d.status === 'online' ? 'green' : 'default'}>{d.status}</Tag>}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="start_u" label="起始U位" rules={[{ required: true }]}><InputNumber min={1} max={selectedRack?.total_u || 42} className="w-full" /></Form.Item>
            <Form.Item name="end_u" label="结束U位" rules={[{ required: true }]}><InputNumber min={1} max={selectedRack?.total_u || 42} className="w-full" /></Form.Item>
          </div>
          <Form.Item name="position_face" label="朝向">
            <Select>
              <Select.Option value="front">前面板</Select.Option>
              <Select.Option value="back">后面板</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* PDU Modal */}
      <Modal title={editingPdu ? '编辑供电设备' : '新建供电设备'} open={pduModalOpen} onOk={savePdu} onCancel={() => { setPduModalOpen(false); setEditingPdu(null); }} width={500}>
        <Form form={pduForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="pdu">PDU (配电单元)</Select.Option>
                <Select.Option value="ups">UPS (不间断电源)</Select.Option>
                <Select.Option value="ac">空调</Select.Option>
                <Select.Option value="other">其他</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select>
                <Select.Option value="normal">正常</Select.Option>
                <Select.Option value="warning">警告</Select.Option>
                <Select.Option value="critical">严重</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="rack_id" label="所属机柜">
            <Select allowClear placeholder="可选">
              {racks.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="power_capacity_w" label="额定容量(W)"><InputNumber className="w-full" min={0} /></Form.Item>
            <Form.Item name="current_load_w" label="当前负载(W)"><InputNumber className="w-full" min={0} /></Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="input_voltage" label="输入电压(V)"><InputNumber className="w-full" /></Form.Item>
            <Form.Item name="output_sockets" label="插座数量"><InputNumber className="w-full" min={1} /></Form.Item>
          </div>
          <Form.Item name="model" label="型号"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="ip_address" label="IP地址"><Input /></Form.Item>
            <Form.Item name="snmp_community" label="SNMP社区"><Input /></Form.Item>
          </div>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 导入 Modal */}
      <Modal title="导入数据中心数据" open={importModalOpen} onOk={handleImport} onCancel={() => { setImportModalOpen(false); setImportText(''); }}
        confirmLoading={importLoading} width={600}>
        <div className="mb-2 text-sm text-text-secondary">粘贴从导出功能获得的JSON数据：</div>
        <Input.TextArea rows={12} value={importText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportText(e.target.value)}
          placeholder='{"rooms": [...], "racks": [...], "slots": [...], "pdus": [...]}' className="font-mono text-xs" />
      </Modal>

      {/* 设备操作弹窗 */}
      <Modal title={selectedSlot ? (
        <div className="flex items-center gap-2">
          {selectedSlot.device_name || selectedSlot.device_id}
          <Tag color={deviceTypeColors[selectedSlot.device_type] || 'default'} className="text-[10px]">
            {selectedSlot.device_type === 'server' ? '服务器' : selectedSlot.device_type === 'network_device' ? '网络设备' : selectedSlot.device_type}
          </Tag>
        </div>
      ) : '设备操作'}
        open={deviceActionModal}
        onCancel={() => { setDeviceActionModal(false); setSelectedSlot(null); }}
        footer={null}
        width={360}
      >
        {selectedSlot && (
          <div className="space-y-3">
            <div className="text-xs text-text-secondary bg-gray-800/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span>当前位置</span><span className="text-text-primary">{selectedRack?.name || '-'} U{selectedSlot.start_u}-U{selectedSlot.end_u}</span></div>
              <div className="flex justify-between"><span>朝向</span><span className="text-text-primary">{selectedSlot.position_face === 'front' ? '前面板' : '后面板'}</span></div>
              <div className="flex justify-between"><span>状态</span>
                <Tag color={selectedSlot.device_status === 'online' ? 'green' : selectedSlot.device_status === 'warning' ? 'orange' : selectedSlot.device_status === 'critical' ? 'red' : 'default'}>{selectedSlot.device_status || selectedSlot.server_status || '未知'}</Tag>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button icon={<Trash2 size={14} />} danger block
                onClick={confirmRemoveSlot}
                className="h-14 flex-col gap-1"
              >
                <div className="text-xs">下架</div>
                <div className="text-[10px] font-normal opacity-60">从机柜移除</div>
              </Button>
              <Button icon={<ArrowUpDown size={14} />} block
                onClick={openMoveModal}
                className="h-14 flex-col gap-1"
              >
                <div className="text-xs">移位</div>
                <div className="text-[10px] font-normal opacity-60">更换位置/机柜</div>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 移位弹窗 */}
      <Modal title="设备移位" open={moveModalOpen} onOk={handleMove} onCancel={() => { setMoveModalOpen(false); setSelectedSlot(null); }} width={450}>
        <Form form={moveForm} layout="vertical">
          <Form.Item name="rack_id" label="目标机柜" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="选择机柜...">
              {racks.map(r => {
                const room = rooms.find(rm => rm.id === r.room_id);
                return (
                  <Select.Option key={r.id} value={r.id}>
                    {r.name} ({room?.label || room?.name || '-'})
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="start_u" label="起始U位" rules={[{ required: true }]}>
              <InputNumber min={1} max={42} className="w-full" />
            </Form.Item>
            <Form.Item name="end_u" label="结束U位" rules={[{ required: true }]}>
              <InputNumber min={1} max={42} className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="position_face" label="朝向">
            <Select>
              <Select.Option value="front">前面板</Select.Option>
              <Select.Option value="back">后面板</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
