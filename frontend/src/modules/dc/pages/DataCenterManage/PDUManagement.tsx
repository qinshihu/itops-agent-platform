import { Button, Modal, Form, Input, Select, Tag, Space, Popconfirm, Table, InputNumber } from 'antd';
import { Edit, Trash2 } from 'lucide-react';
import type useDataCenter from './useDataCenter';
import { deviceTypeColors } from './types';
import type { PDU, Rack } from './types';

type DC = ReturnType<typeof useDataCenter>;

interface Props {
  dc: DC;
}

export default function PDUManagement({ dc }: Props) {
  const pduColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={deviceTypeColors[v] || 'default'}>{v === 'pdu' ? 'PDU' : v === 'ups' ? 'UPS' : v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => {
      const c = v === 'active' ? 'green' : v === 'warning' ? 'orange' : v === 'error' ? 'red' : 'default';
      return <Tag color={c}>{v === 'active' ? '正常运行' : v === 'warning' ? '告警' : v === 'error' ? '故障' : v}</Tag>;
    }},
    { title: '所在机柜', dataIndex: 'rack_name', key: 'rack_name', render: (v: string) => v || '未分配' },
    { title: '额定功率(W)', dataIndex: 'power_capacity_w', key: 'power_capacity_w', render: (v: number) => v ? `${v}W` : '-' },
    { title: '当前负载(W)', dataIndex: 'current_load_w', key: 'current_load_w', render: (v: number) => v !== null && v !== undefined ? `${v}W` : '-' },
    { title: '输入电压(V)', dataIndex: 'input_voltage', key: 'input_voltage', render: (v: number) => v ? `${v}V` : '-' },
    { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address', render: (v: string) => v || '-' },
    {
      title: '操作', key: 'action', render: (_: unknown, rec: PDU) => (
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

  return (
    <>
      <Table columns={pduColumns} dataSource={dc.pdus.map((p: PDU) => ({ ...p, key: p.id }))}
        pagination={false} scroll={{ x: 1000 }} loading={dc.pdusLoading} />

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
              {dc.racks.map((r: Rack) => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
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
    </>
  );
}