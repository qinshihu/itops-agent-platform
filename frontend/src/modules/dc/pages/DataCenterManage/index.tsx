/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button, Modal, Form, Input, Select, Tag, Space, Popconfirm, Card, Tabs, InputNumber, Badge, Table } from 'antd';
import {
  Plus, Edit, Trash2, Server, Monitor, Wifi, LayoutGrid, CuboidIcon as Cube,
  Search, Download, Upload, Database, Clock, AlertTriangle, Thermometer,
  HardDrive, Cpu, MemoryStick, ToggleLeft, HardDrive as Hdd, ArrowUpDown,
} from 'lucide-react';
import useDataCenter from './useDataCenter';
import { deviceTypeColors, actionColors } from './types';
import type { Room } from './types';
import OverviewTab from './OverviewTab';
import DevicesTab from './DevicesTab';
import SlotsPanel from './SlotsPanel';

export default function DataCenterManage() {
  const dc = useDataCenter();

  // ===== 打开添加机房的 Modal 快捷方式 =====
  const handleAddRoom = () => {
    dc.setEditingRoom(null);
    dc.roomForm.resetFields();
    dc.setRoomModalOpen(true);
  };

  // ===== 列定义 =====
  const filteredRooms = dc.rooms.filter((r: Room) =>
    !dc.roomSearch ||
    r.name?.toLowerCase().includes(dc.roomSearch.toLowerCase()) ||
    r.label?.toLowerCase().includes(dc.roomSearch.toLowerCase())
  );

  const filteredRacks = dc.racks.filter((r: any) =>
    (!dc.rackSearch || r.name?.toLowerCase().includes(dc.rackSearch.toLowerCase())) &&
    (!dc.rackStatusFilter || r.status === dc.rackStatusFilter)
  );

  const roomColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '标签', dataIndex: 'label', key: 'label', render: (v: string) => <Tag>{v}</Tag> },
    { title: '尺寸', key: 'size', render: (_: any, r: any) => `${r.width_m || 20}m × ${r.depth_m || 15}m` },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
    {
      title: '操作', key: 'action', render: (_: any, rec: any) => (
        <Space>
          <Button type="link" size="small" icon={<Edit size={14} />}
            onClick={() => { dc.setEditingRoom(rec); dc.roomForm.setFieldsValue(rec); dc.setRoomModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => dc.deleteRoom(rec.id)}>
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  const rackColumns = [
    {
      title: '编号', dataIndex: 'name', key: 'name', render: (v: string, r: any) => (
        <Space>
          <span>{v}</span>
          {r.status === 'warning' && <Tag color="orange" style={{ fontSize: 10 }}>⚠️</Tag>}
        </Space>
      )
    },
    { title: '机房', dataIndex: 'room_name', key: 'room_name' },
    { title: '排号', dataIndex: 'row_number', key: 'row_number' },
    { title: 'U位', dataIndex: 'total_u', key: 'total_u' },
    {
      title: '已用', key: 'used_u', render: (_: any, r: any) => {
        const pct = r.total_u > 0 ? Math.round(((r.used_u || 0) / r.total_u) * 100) : 0;
        const barColor = pct > 85 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-700 rounded-full">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs">{r.used_u || 0}/{r.total_u || 42}</span>
          </div>
        );
      }
    },
    { title: '设备数', dataIndex: 'device_count', key: 'device_count' },
    {
      title: '告警', key: 'alerts', render: (_: any, r: any) => {
        const ac = dc.rackAlertMap[r.id] || 0;
        return ac > 0 ? <Badge count={ac} size="small"><span className="text-red-400">🚨</span></Badge> : <span className="text-text-tertiary">-</span>;
      }
    },
    {
      title: '操作', key: 'action', render: (_: any, rec: any) => (
        <Space>
          <Button type="link" size="small" icon={<LayoutGrid size={14} />}
            onClick={() => { dc.setActiveTab('slots'); setTimeout(() => dc.selectRack(rec), 100); }}>U位</Button>
          <Button type="link" size="small" icon={<Edit size={14} />}
            onClick={() => { dc.setEditingRack(rec); dc.rackForm.setFieldsValue(rec); dc.setRackModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => dc.deleteRack(rec.id)}>
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  const lifecycleColumns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => (
        <Tag color={actionColors[v] || 'default'}>
          {v === 'mounted' ? '上架' : v === 'unmounted' ? '下架' : v === 'moved' ? '迁移' : v === 'maintenance' ? '维护' : v}
        </Tag>
      )
    },
    { title: '设备类型', dataIndex: 'device_type', key: 'device_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '来源位置', dataIndex: 'from_location', key: 'from_location', render: (v: string) => v !== 'N/A' ? v : '-' },
    { title: '目标位置', dataIndex: 'to_location', key: 'to_location', render: (v: string) => v !== 'N/A' ? v : '-' },
    { title: '操作人', dataIndex: 'performed_by', key: 'performed_by' },
    { title: '备注', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '-' },
  ];

  const pduColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={deviceTypeColors[v] || 'default'}>{v === 'pdu' ? 'PDU' : v === 'ups' ? 'UPS' : v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => {
      const c = v === 'active' ? 'green' : v === 'warning' ? 'orange' : v === 'error' ? 'red' : 'default';
      return <Tag color={c}>{v === 'active' ? '正常运行' : v === 'warning' ? '告警' : v === 'error' ? '故障' : v}</Tag>;
    }},
    { title: '所在机柜', dataIndex: 'rack_name', key: 'rack_name', render: (v: string) => v || '未分配' },
    { title: '额定功率(W)', dataIndex: 'power_capacity_w', key: 'power_capacity_w', render: (v: number) => v ? `${v}W` : '-' },
    { title: '当前负载(W)', dataIndex: 'current_load_w', key: 'current_load_w', render: (v: number) => v != null ? `${v}W` : '-' },
    { title: '输入电压(V)', dataIndex: 'input_voltage', key: 'input_voltage', render: (v: number) => v ? `${v}V` : '-' },
    { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address', render: (v: string) => v || '-' },
    {
      title: '操作', key: 'action', render: (_: any, rec: any) => (
        <Space>
          <Button type="link" size="small" icon={<Edit size={14} />}
            onClick={() => { dc.setEditingPdu(rec); dc.pduForm.setFieldsValue(rec); dc.setPduModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => dc.deletePdu(rec.id)}>
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  // ===== Tab 项配置 =====
  const tabItems = [
    {
      key: 'overview',
      label: <span><Monitor size={14} className="inline mr-1" />总览</span>,
      children: (
        <OverviewTab
          overview={dc.overview}
          rooms={dc.rooms}
          racks={dc.racks}
          rackAlertMap={dc.rackAlertMap}
          onAddRoom={handleAddRoom}
          onSelectRack={dc.selectRack}
        />
      ),
    },
    {
      key: 'devices',
      label: <span><Server size={14} className="inline mr-1" />设备分布</span>,
      children: (
        <DevicesTab
          groups={dc.deviceGroups}
          loading={dc.deviceGroupLoading}
          search={dc.deviceSearch}
          onSearchChange={dc.setDeviceSearch}
        />
      ),
    },
    {
      key: 'rooms',
      label: <span><Database size={14} className="inline mr-1" />机房</span>,
      children: (
        <div>
          <Input
            prefix={<Search size={14} className="text-text-tertiary" />}
            placeholder="搜索机房名称/标签..."
            className="mb-4 max-w-xs"
            value={dc.roomSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => dc.setRoomSearch(e.target.value)}
            allowClear
          />
          <Table columns={roomColumns} dataSource={filteredRooms.map((r: any) => ({ ...r, key: r.id }))} loading={dc.loading} pagination={false} />
        </div>
      ),
    },
    {
      key: 'racks',
      label: <span><LayoutGrid size={14} className="inline mr-1" />机柜</span>,
      children: (
        <div>
          <Space className="mb-4">
            <Input
              prefix={<Search size={14} className="text-text-tertiary" />}
              placeholder="搜索机柜编号..."
              value={dc.rackSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => dc.setRackSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={dc.rackStatusFilter || undefined}
              onChange={(v: string) => dc.setRackStatusFilter(v || '')}
            >
              <Select.Option value="normal">正常</Select.Option>
              <Select.Option value="warning">警告</Select.Option>
              <Select.Option value="critical">严重</Select.Option>
            </Select>
          </Space>
          <Table columns={rackColumns} dataSource={filteredRacks.map((r: any) => {
            const room = dc.rooms.find(rm => rm.id === r.room_id);
            return { ...r, key: r.id, room_name: room?.name || room?.label || r.room_id };
          })} loading={dc.loading} pagination={false} scroll={{ x: 900 }} />
        </div>
      ),
    },
    {
      key: 'slots',
      label: <span><Cube size={14} className="inline mr-1" />U位</span>,
      children: (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <Card title="机柜列表" size="small"
              extra={<Input prefix={<Search size={12} />} placeholder="搜索..." size="small" style={{ width: 120 }} />}
            >
              <div className="space-y-1 max-h-[650px] overflow-y-auto">
                {dc.racks.map(r => {
                  const room = dc.rooms.find(rm => rm.id === r.room_id);
                  const ac = dc.rackAlertMap[r.id] || 0;
                  return (
                    <div key={r.id}
                      className={`px-3 py-2 rounded cursor-pointer text-sm flex items-center gap-2 transition-colors
                        ${dc.selectedRack?.id === r.id ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-gray-800 text-text-secondary border border-transparent'}`}
                      onClick={() => dc.selectRack(r)}>
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
            <SlotsPanel rack={dc.selectedRack} slots={dc.slots} onSelectSlot={dc.showDeviceActions} />
          </div>
        </div>
      ),
    },
    {
      key: 'lifecycle',
      label: <span><Clock size={14} className="inline mr-1" />生命周期</span>,
      children: (
        <div>
          <Space className="mb-4">
            <Select
              placeholder="动作筛选"
              allowClear
              style={{ width: 130 }}
              value={dc.lifecycleFilter || undefined}
              onChange={(v: string) => dc.setLifecycleFilter(v || '')}
            >
              <Select.Option value="mounted">上架</Select.Option>
              <Select.Option value="unmounted">下架</Select.Option>
              <Select.Option value="moved">迁移</Select.Option>
              <Select.Option value="maintenance">维护</Select.Option>
            </Select>
            <Button icon={<Search size={14} />} onClick={dc.loadLifecycles}>刷新</Button>
          </Space>
          <Table columns={lifecycleColumns} dataSource={dc.lifecycles.map((l: any) => ({ ...l, key: l.id }))}
            pagination={{ pageSize: 50 }} scroll={{ x: 800 }} loading={dc.lifecyclesLoading} />
        </div>
      ),
    },
    {
      key: 'pdus',
      label: <span><ToggleLeft size={14} className="inline mr-1" />PDU/UPS</span>,
      children: (
        <Table columns={pduColumns} dataSource={dc.pdus.map((p: any) => ({ ...p, key: p.id }))}
          pagination={false} scroll={{ x: 1000 }} loading={dc.pdusLoading} />
      ),
    },
    {
      key: 'export',
      label: <span><Upload size={14} className="inline mr-1" />导入/导出</span>,
      children: (
        <div>
          <div className="mb-4 text-sm text-text-secondary">
            导出数据中心完整布局数据为 JSON 格式，包含机房、机柜、U位、生命周期和供电设备信息。
          </div>

          {/* 导出区域 */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Download size={18} className="text-blue-400" />
              <span className="text-sm font-medium text-text-primary">导出数据</span>
            </div>
            {dc.exportData ? (
              <>
                <p className="text-xs text-text-tertiary mb-3">
                  包含 {dc.exportData.summary?.rooms || 0} 个机房, {dc.exportData.summary?.racks || 0} 个机柜, {dc.exportData.summary?.devices || 0} 个设备
                </p>
                <div className="flex gap-2">
                  <Button icon={<Download size={14} />} onClick={dc.handleExportDownload}>下载 JSON 文件</Button>
                  <Button icon={<HardDrive size={14} />} onClick={dc.handleExportCopy}>复制到剪贴板</Button>
                </div>
              </>
            ) : (
              <Button icon={<Download size={14} />} onClick={dc.loadExport}>加载导出数据</Button>
            )}
          </div>

          {/* 导入区域 */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Upload size={18} className="text-green-400" />
              <span className="text-sm font-medium text-text-primary">导入数据</span>
            </div>
            <Button icon={<Upload size={14} />} onClick={() => dc.setImportModalOpen(true)}>打开导入窗口</Button>
          </div>
        </div>
      ),
    },
  ];

  // ===== 操作按钮（在 Tabs 右侧） =====
  const extraButtons: Record<string, React.ReactNode> = {
    overview: (
      <Button type="primary" size="small" icon={<Plus size={14} />} onClick={handleAddRoom}>
        添加机房
      </Button>
    ),
    rooms: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setEditingRoom(null); dc.roomForm.resetFields(); dc.setRoomModalOpen(true); }}>
        添加机房
      </Button>
    ),
    racks: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setEditingRack(null); dc.rackForm.resetFields(); dc.setRackModalOpen(true); }}>
        添加机柜
      </Button>
    ),
    pdus: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setEditingPdu(null); dc.pduForm.resetFields(); dc.setPduModalOpen(true); }}>
        添加PDU/UPS
      </Button>
    ),
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Server size={20} className="text-blue-400" />
          数据中心管理
        </h2>
        <div className="flex gap-2">
          {extraButtons[dc.activeTab]}
        </div>
      </div>

      <Tabs activeKey={dc.activeTab} onChange={dc.onTabChange} items={tabItems} className="dc-tabs" />

      {/* ==================== MODALS ==================== */}

      {/* 机房 Modal */}
      <Modal
        title={dc.editingRoom ? '编辑机房' : '添加机房'}
        open={dc.roomModalOpen}
        onOk={dc.saveRoom}
        onCancel={() => { dc.setRoomModalOpen(false); dc.setEditingRoom(null); dc.roomForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={dc.roomForm} layout="vertical" size="small">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入机房名称' }]}>
            <Input placeholder="如：A栋-2层" />
          </Form.Item>
          <Form.Item name="label" label="标签">
            <Input placeholder="可选别名" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="width_m" label="宽度(m)"><InputNumber min={1} step={1} /></Form.Item>
            <Form.Item name="depth_m" label="深度(m)"><InputNumber min={1} step={1} /></Form.Item>
            <Form.Item name="sort_order" label="排序"><InputNumber min={0} step={1} /></Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 机柜 Modal */}
      <Modal
        title={dc.editingRack ? '编辑机柜' : '添加机柜'}
        open={dc.rackModalOpen}
        onOk={dc.saveRack}
        onCancel={() => { dc.setRackModalOpen(false); dc.setEditingRack(null); dc.rackForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={dc.rackForm} layout="vertical" size="small">
          <Form.Item name="name" label="机柜编号" rules={[{ required: true, message: '请输入机柜编号' }]}>
            <Input placeholder="如：A01" />
          </Form.Item>
          <Form.Item name="room_id" label="所属机房" rules={[{ required: true, message: '请选择机房' }]}>
            <Select placeholder="选择机房...">
              {dc.rooms.map(r => (
                <Select.Option key={r.id} value={r.id}>{r.name || r.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="row_number" label="排号">
            <InputNumber min={1} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="total_u" label="U位数" rules={[{ required: true, message: '请输入U位数' }]}>
            <InputNumber min={1} max={100} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} step={1} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配 U 位 Modal */}
      <Modal
        title={`分配设备 - ${dc.selectedRack?.name || ''}`}
        open={dc.slotModalOpen}
        onOk={dc.assignSlot}
        onCancel={() => { dc.setSlotModalOpen(false); dc.slotForm.resetFields(); }}
        okText="分配"
        cancelText="取消"
        afterOpenChange={(open) => { if (open) dc.fetchAvailDevices(); }}
      >
        <Form form={dc.slotForm} layout="vertical" size="small">
          <Form.Item name="device_id" label="选择设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select placeholder="选择要分配到该机柜的设备..." showSearch filterOption={(input, option) =>
              (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
            }>
              {dc.availDevices.map((d: any) => (
                <Select.Option key={d.id} value={d.id}
                  label={`${d.name || d.device_name || '未命名'} (${d.device_type || '?'})`}>
                  <div className="flex justify-between">
                    <span>{d.name || d.device_name || '未命名'}</span>
                    <Tag color={deviceTypeColors[d.device_type] || 'default'} className="text-[10px]">
                      {d.device_type}
                    </Tag>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="start_u" label="起始U位" rules={[{ required: true, message: '请输入起始U位' }]}>
            <InputNumber min={1} max={dc.selectedRack?.total_u || 42} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="end_u" label="结束U位" rules={[{ required: true, message: '请输入结束U位' }]}>
            <InputNumber min={1} max={dc.selectedRack?.total_u || 42} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="position_face" label="朝向" initialValue="front">
            <Select>
              <Select.Option value="front">正面</Select.Option>
              <Select.Option value="rear">背面</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 设备操作 Modal（下架/移位） */}
      <Modal
        title="设备操作"
        open={dc.deviceActionModal}
        onCancel={() => { dc.setDeviceActionModal(false); dc.setSelectedSlot(null); }}
        footer={[
          <Button key="move" icon={<ArrowUpDown size={14} />} onClick={() => {
            dc.setDeviceActionModal(false);
            dc.moveForm.resetFields();
            dc.moveForm.setFieldsValue({
              rack_id: dc.selectedSlot?.rack_id,
              start_u: dc.selectedSlot?.start_u,
              end_u: dc.selectedSlot?.end_u,
              position_face: dc.selectedSlot?.position_face || 'front',
            });
            dc.setMoveModalOpen(true);
          }}>
            移位
          </Button>,
          <Popconfirm key="remove" title="确认下架该设备?" onConfirm={dc.confirmRemoveSlot}>
            <Button danger icon={<Trash2 size={14} />}>下架</Button>
          </Popconfirm>,
          <Button key="cancel" onClick={() => { dc.setDeviceActionModal(false); dc.setSelectedSlot(null); }}>取消</Button>,
        ]}
      >
        {dc.selectedSlot && (
          <div className="text-sm space-y-2">
            <p><span className="text-text-secondary">设备:</span> {dc.selectedSlot.device_name || '(未命名)'}</p>
            <p><span className="text-text-secondary">类型:</span> {dc.selectedSlot.device_type}</p>
            <p><span className="text-text-secondary">U位:</span> U{dc.selectedSlot.start_u}-U{dc.selectedSlot.end_u}</p>
            {dc.selectedSlot.ip_address && (
              <p><span className="text-text-secondary">IP:</span> {dc.selectedSlot.ip_address}</p>
            )}
          </div>
        )}
      </Modal>

      {/* 移位 Modal */}
      <Modal
        title="设备移位"
        open={dc.moveModalOpen}
        onOk={dc.handleMove}
        onCancel={() => { dc.setMoveModalOpen(false); dc.moveForm.resetFields(); dc.setSelectedSlot(null); }}
        okText="确认移位"
        cancelText="取消"
      >
        <Form form={dc.moveForm} layout="vertical" size="small">
          <Form.Item name="rack_id" label="目标机柜" rules={[{ required: true, message: '请选择机柜' }]}>
            <Select placeholder="选择目标机柜..." showSearch filterOption={(input, option) =>
              (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
            }>
              {dc.racks.map(r => (
                <Select.Option key={r.id} value={r.id}
                  label={`${r.room_label || r.room_name || ''} - ${r.name}`}>
                  {r.room_label || r.room_name || ''} - {r.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="start_u" label="起始U位" rules={[{ required: true, message: '请输入起始U位' }]}>
            <InputNumber min={1} max={100} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="end_u" label="结束U位" rules={[{ required: true, message: '请输入结束U位' }]}>
            <InputNumber min={1} max={100} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="position_face" label="朝向" initialValue="front">
            <Select><Select.Option value="front">正面</Select.Option><Select.Option value="rear">背面</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* PDU Modal */}
      <Modal
        title={dc.editingPdu ? '编辑PDU/UPS' : '添加PDU/UPS'}
        open={dc.pduModalOpen}
        onOk={dc.savePdu}
        onCancel={() => { dc.setPduModalOpen(false); dc.setEditingPdu(null); dc.pduForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Form form={dc.pduForm} layout="vertical" size="small">
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select><Select.Option value="pdu">PDU</Select.Option><Select.Option value="ups">UPS</Select.Option></Select>
            </Form.Item>
          </Space>
          <Form.Item name="rack_id" label="所在机柜">
            <Select placeholder="选择机柜（可选）..." allowClear>
              {dc.racks.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select><Select.Option value="active">正常运行</Select.Option><Select.Option value="warning">告警</Select.Option><Select.Option value="error">故障</Select.Option></Select>
          </Form.Item>
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="power_capacity_w" label="额定功率(W)"><InputNumber min={0} step={100} className="w-full" /></Form.Item>
            <Form.Item name="current_load_w" label="当前负载(W)"><InputNumber min={0} step={10} className="w-full" /></Form.Item>
            <Form.Item name="input_voltage" label="输入电压(V)"><InputNumber min={0} step={10} className="w-full" /></Form.Item>
          </Space>
          <Form.Item name="output_sockets" label="输出插座数"><InputNumber min={0} step={1} className="w-full" /></Form.Item>
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="model" label="型号"><Input /></Form.Item>
            <Form.Item name="ip_address" label="IP地址"><Input /></Form.Item>
            <Form.Item name="snmp_community" label="SNMP社区"><Input /></Form.Item>
          </Space>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 导入 Modal */}
      <Modal
        title="导入数据中心数据"
        open={dc.importModalOpen}
        onOk={dc.handleImport}
        onCancel={() => { dc.setImportModalOpen(false); dc.setImportText(''); }}
        okText="导入"
        cancelText="取消"
        confirmLoading={dc.importLoading}
        width={700}
      >
        <div className="mb-2 text-xs text-text-tertiary">
          粘贴 JSON 数据。格式与导出数据一致，可包含 rooms, racks, slots, pdus 等字段。
        </div>
        <Input.TextArea
          rows={12}
          value={dc.importText}
          onChange={(e) => dc.setImportText(e.target.value)}
          placeholder='{"rooms": [...], "racks": [...], "slots": [...], "pdus": [...]}'
          className="font-mono text-xs"
        />
      </Modal>
    </div>
  );
}
