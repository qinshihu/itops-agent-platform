import { Button, Modal, Form, Input, Select, Tag, Space, Popconfirm, Table, InputNumber } from 'antd';
import { Edit, Trash2, Database as _Database, Cpu as _Cpu, ToggleLeft as _ToggleLeft, Wifi as _Wifi, ArrowUpDown as _ArrowUpDown } from 'lucide-react';
import type useDataCenter from './useDataCenter';
import type { Manufacturer, DeviceTypeInfo, PowerPanel, PowerFeed, Cable } from './types';

type DC = ReturnType<typeof useDataCenter>;

interface _Props {
  dc: DC;
}

export function ManufacturersTab({ dc }: { dc: DC }) {
  return (
    <>
      <Table
        columns={[
          { title: '名称', dataIndex: 'name', key: 'name' },
          { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
          { title: '型号数量', dataIndex: 'type_count', key: 'type_count' },
          {
            title: '操作', key: 'action', render: (_: unknown, rec: Manufacturer) => (
              <Space>
                <Button type="link" size="small" icon={<Edit size={14} />}
                  onClick={() => { dc.setEditingMf(rec); dc.mfForm.setFieldsValue(rec); dc.setMfModalOpen(true); }}>编辑</Button>
                <Popconfirm title="确定删除?" onConfirm={() => dc.deleteManufacturer(rec.id)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          },
        ]}
        dataSource={dc.manufacturers.map((m: Manufacturer) => ({ ...m, key: m.id }))}
        loading={dc.mfLoading}
        pagination={false}
      />

      <Modal
        title={dc.editingMf ? '编辑制造商' : '添加制造商'}
        open={dc.mfModalOpen}
        onOk={dc.saveManufacturer}
        onCancel={() => { dc.setMfModalOpen(false); dc.setEditingMf(null); dc.mfForm.resetFields(); }}
        okText="保存" cancelText="取消"
      >
        <Form form={dc.mfForm} layout="vertical" size="small">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入制造商名称' }]}>
            <Input placeholder="如：华为、思科、戴尔" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function DeviceTypesTab({ dc }: { dc: DC }) {
  return (
    <>
      <Table
        columns={[
          { title: '型号', dataIndex: 'model', key: 'model' },
          { title: '制造商', dataIndex: 'manufacturer_name', key: 'manufacturer_name' },
          { title: '类型', dataIndex: 'device_type', key: 'device_type', render: (v: string) => <Tag>{v}</Tag> },
          { title: '高度(U)', dataIndex: 'u_height', key: 'u_height' },
          { title: '实例数', dataIndex: 'instance_count', key: 'instance_count' },
          {
            title: '操作', key: 'action', render: (_: unknown, rec: DeviceTypeInfo) => (
              <Space>
                <Button type="link" size="small" icon={<Edit size={14} />}
                  onClick={() => { dc.setEditingDt(rec); dc.dtForm.setFieldsValue(rec); dc.setDtModalOpen(true); }}>编辑</Button>
                <Popconfirm title="确定删除?" onConfirm={() => dc.deleteDeviceType(rec.id)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          },
        ]}
        dataSource={dc.deviceTypes.map((t: DeviceTypeInfo) => ({ ...t, key: t.id }))}
        loading={dc.dtLoading}
        pagination={false}
      />

      <Modal
        title={dc.editingDt ? '编辑设备型号' : '添加设备型号'}
        open={dc.dtModalOpen}
        onOk={dc.saveDeviceType}
        onCancel={() => { dc.setDtModalOpen(false); dc.setEditingDt(null); dc.dtForm.resetFields(); }}
        okText="保存" cancelText="取消"
      >
        <Form form={dc.dtForm} layout="vertical" size="small">
          <Form.Item name="model" label="型号名称" rules={[{ required: true, message: '请输入型号' }]}>
            <Input placeholder="如：USG6320、S5720-36C-EI" />
          </Form.Item>
          <Form.Item name="manufacturer_id" label="制造商" rules={[{ required: true, message: '请选择制造商' }]}>
            <Select placeholder="选择制造商...">
              {dc.manufacturers.map((m: Manufacturer) => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="device_type" label="设备类型" rules={[{ required: true }]}>
            <Select placeholder="选择类型...">
              <Select.Option value="server">服务器</Select.Option>
              <Select.Option value="network_device">网络设备</Select.Option>
              <Select.Option value="storage">存储设备</Select.Option>
              <Select.Option value="pdu">PDU</Select.Option>
              <Select.Option value="ups">UPS</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="u_height" label="U位高度" rules={[{ required: true }]}>
            <InputNumber min={1} max={48} step={1} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function PowerPanelsTab({ dc }: { dc: DC }) {
  return (
    <>
      <Table
        columns={[
          { title: '名称', dataIndex: 'name', key: 'name' },
          { title: '机房', dataIndex: 'room_name', key: 'room_name' },
          { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
          { title: '相位', dataIndex: 'phase', key: 'phase' },
          { title: '电压(V)', dataIndex: 'voltage', key: 'voltage' },
          { title: '馈线数', dataIndex: 'feed_count', key: 'feed_count' },
          {
            title: '操作', key: 'action', render: (_: unknown, rec: PowerPanel) => (
              <Space>
                <Button type="link" size="small" icon={<Edit size={14} />}
                  onClick={() => { dc.setEditingPp(rec); dc.ppForm.setFieldsValue(rec); dc.setPpModalOpen(true); }}>编辑</Button>
                <Popconfirm title="确定删除?" onConfirm={() => dc.deletePowerPanel(rec.id)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          },
        ]}
        dataSource={dc.powerPanels.map((p: PowerPanel) => ({ ...p, key: p.id }))}
        loading={dc.ppLoading}
        pagination={false}
      />

      <Modal
        title={dc.editingPp ? '编辑配电柜' : '添加配电柜'}
        open={dc.ppModalOpen}
        onOk={dc.savePowerPanel}
        onCancel={() => { dc.setPpModalOpen(false); dc.setEditingPp(null); dc.ppForm.resetFields(); }}
        okText="保存" cancelText="取消"
      >
        <Form form={dc.ppForm} layout="vertical" size="small">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：A栋-2F-配电柜-01" />
          </Form.Item>
          <Form.Item name="room_id" label="所属机房">
            <Select placeholder="选择机房（可选）..." allowClear>
              {dc.rooms.map(r => <Select.Option key={r.id} value={r.id}>{r.name || r.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select placeholder="选择类型...">
              <Select.Option value="main">主配电柜</Select.Option>
              <Select.Option value="distribution">分配电柜</Select.Option>
              <Select.Option value="row">列头柜</Select.Option>
            </Select>
          </Form.Item>
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="phase" label="相位"><Select><Select.Option value="single">单相</Select.Option><Select.Option value="three">三相</Select.Option></Select></Form.Item>
            <Form.Item name="voltage" label="电压(V)"><InputNumber min={0} step={10} className="w-full" /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

export function PowerFeedsTab({ dc }: { dc: DC }) {
  return (
    <>
      <Table
        columns={[
          { title: '名称', dataIndex: 'name', key: 'name' },
          { title: '配电柜', dataIndex: 'panel_name', key: 'panel_name' },
          { title: '机柜', dataIndex: 'rack_name', key: 'rack_name', render: (v: string) => v || '未分配' },
          { title: '相位', dataIndex: 'phase', key: 'phase' },
          { title: '电压(V)', dataIndex: 'voltage', key: 'voltage' },
          { title: '电流(A)', dataIndex: 'amperage', key: 'amperage' },
          { title: '功率(W)', dataIndex: 'max_power', key: 'max_power', render: (v: number) => v ? `${v}W` : '-' },
          {
            title: '操作', key: 'action', render: (_: unknown, rec: PowerFeed) => (
              <Space>
                <Button type="link" size="small" icon={<Edit size={14} />}
                  onClick={() => { dc.setEditingPf(rec); dc.pfForm.setFieldsValue(rec); dc.setPfModalOpen(true); }}>编辑</Button>
                <Popconfirm title="确定删除?" onConfirm={() => dc.deletePowerFeed(rec.id)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          },
        ]}
        dataSource={dc.powerFeeds.map((f: PowerFeed) => ({ ...f, key: f.id }))}
        loading={dc.pfLoading}
        pagination={false}
      />

      <Modal
        title={dc.editingPf ? '编辑供电线路' : '添加供电线路'}
        open={dc.pfModalOpen}
        onOk={dc.savePowerFeed}
        onCancel={() => { dc.setPfModalOpen(false); dc.setEditingPf(null); dc.pfForm.resetFields(); }}
        okText="保存" cancelText="取消"
      >
        <Form form={dc.pfForm} layout="vertical" size="small">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：A-01供电线路" />
          </Form.Item>
          <Form.Item name="power_panel_id" label="配电柜" rules={[{ required: true, message: '请选择配电柜' }]}>
            <Select placeholder="选择配电柜...">
              {dc.powerPanels.map((p: PowerPanel) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="rack_id" label="目标机柜">
            <Select placeholder="选择机柜（可选）..." allowClear>
              {dc.racks.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="phase" label="相位"><Select><Select.Option value="single">单相</Select.Option><Select.Option value="three">三相</Select.Option></Select></Form.Item>
            <Form.Item name="voltage" label="电压(V)"><InputNumber min={0} step={10} className="w-full" /></Form.Item>
            <Form.Item name="amperage" label="电流(A)"><InputNumber min={0} step={1} className="w-full" /></Form.Item>
          </Space>
          <Form.Item name="max_power" label="最大功率(W)"><InputNumber min={0} step={100} className="w-full" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function CablesTab({ dc }: { dc: DC }) {
  return (
    <>
      <Table
        columns={[
          { title: '标签', dataIndex: 'label', key: 'label' },
          { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => {
            const c = v === 'connected' ? 'green' : v === 'planned' ? 'blue' : 'default';
            return <Tag color={c}>{v}</Tag>;
          }},
          { title: 'A端设备', dataIndex: 'a_device_name', key: 'a_device_name' },
          { title: 'B端设备', dataIndex: 'b_device_name', key: 'b_device_name' },
          { title: '长度(m)', dataIndex: 'length_m', key: 'length_m', render: (v: number) => v ? `${v}m` : '-' },
          {
            title: '操作', key: 'action', render: (_: unknown, rec: Cable) => (
              <Space>
                <Button type="link" size="small" icon={<Edit size={14} />}
                  onClick={() => { dc.setEditingCable(rec); dc.cableForm.setFieldsValue(rec); dc.setCableModalOpen(true); }}>编辑</Button>
                <Popconfirm title="确定删除?" onConfirm={() => dc.deleteCable(rec.id)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          },
        ]}
        dataSource={dc.cables.map((c: Cable) => ({ ...c, key: c.id }))}
        loading={dc.cableLoading}
        pagination={false}
      />

      <Modal
        title={dc.editingCable ? '编辑线缆' : '添加线缆'}
        open={dc.cableModalOpen}
        onOk={dc.saveCable}
        onCancel={() => { dc.setCableModalOpen(false); dc.setEditingCable(null); dc.cableForm.resetFields(); }}
        okText="保存" cancelText="取消"
      >
        <Form form={dc.cableForm} layout="vertical" size="small">
          <Form.Item name="label" label="标签" rules={[{ required: true, message: '请输入标签' }]}>
            <Input placeholder="如：A01-U12→B03-U05" />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select placeholder="选择类型...">
              <Select.Option value="power">电源线</Select.Option>
              <Select.Option value="network">网线</Select.Option>
              <Select.Option value="fiber">光纤</Select.Option>
              <Select.Option value="console">串口线</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="planned">
            <Select>
              <Select.Option value="planned">规划中</Select.Option>
              <Select.Option value="connected">已连接</Select.Option>
              <Select.Option value="disconnected">已断开</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="a_device_id" label="A端设备ID">
            <Input placeholder="设备ID（可选）" />
          </Form.Item>
          <Form.Item name="b_device_id" label="B端设备ID">
            <Input placeholder="设备ID（可选）" />
          </Form.Item>
          <Form.Item name="length_m" label="长度(m)"><InputNumber min={0} step={0.5} className="w-full" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}