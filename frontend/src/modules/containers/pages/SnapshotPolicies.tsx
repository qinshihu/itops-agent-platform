/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Tag, Space, message, Form, Input, InputNumber, Switch, Popconfirm, Tooltip, Select } from 'antd';
import { Plus, Edit, Trash2, Search, RefreshCw, HelpCircle } from 'lucide-react';
import api from '../../../lib/api';

interface SnapshotPolicy {
  id: string;
  name: string;
  platform_id?: string;
  vm_id?: string;
  cron_expr?: string;
  retain_count?: number;
  include_memory?: boolean | number;
  enabled?: boolean | number;
  last_run_at?: string;
}

const cronExamples = [
  { label: '每小时执行', value: '0 * * * *' },
  { label: '每天2点', value: '0 2 * * *' },
  { label: '每周日凌晨2点', value: '0 2 * * 0' },
];

export default function SnapshotPolicies() {
  const [data, setData] = useState<SnapshotPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SnapshotPolicy | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/snapshot-policies', { params: { page, pageSize, search } });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, search]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/api/snapshot-policies/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/api/snapshot-policies', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/snapshot-policies/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const openEdit = (record: SnapshotPolicy) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      include_memory: !!record.include_memory,
      enabled: !!record.enabled,
    });
    setModalOpen(true);
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '平台ID', dataIndex: 'platform_id', key: 'platform_id' },
    { title: 'VM ID', dataIndex: 'vm_id', key: 'vm_id' },
    { title: 'Cron表达式', dataIndex: 'cron_expr', key: 'cron_expr', ellipsis: true },
    { title: '保留数', dataIndex: 'retain_count', key: 'retain_count' },
    { title: '内存快照', dataIndex: 'include_memory', key: 'include_memory', render: (v: any) => v ? <Tag color="blue">是</Tag> : <Tag>否</Tag> },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (v: any) => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag> },
    { title: '上次执行', dataIndex: 'last_run_at', key: 'last_run_at' },
    { title: '操作', key: 'action', width: 160, render: (_: any, record: SnapshotPolicy) => (
      <Space>
        <Button type="link" size="small" icon={<Edit size={14} />} onClick={() => openEdit(record)}>编辑</Button>
        <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const cronHelpContent = (
    <div className="space-y-1">
      {cronExamples.map((ex) => (
        <div key={ex.value} className="flex items-center gap-2">
          <Tag color="blue">{ex.value}</Tag>
          <span className="text-xs">{ex.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Input placeholder="搜索名称..." prefix={<Search size={14} className="text-gray-400" />} className="w-64" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Button icon={<RefreshCw size={14} />} onClick={fetchData}>刷新</Button>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建策略</Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); } }}
      />

      <Modal title={editing ? '编辑策略' : '新建策略'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} width={560}>
        <Form form={form} layout="vertical" initialValues={{ retain_count: 7, include_memory: false, enabled: true }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="platform_id" label="平台ID"><Input /></Form.Item>
            <Form.Item name="vm_id" label="VM ID"><Input /></Form.Item>
          </div>
          <Form.Item
            label={
              <span className="flex items-center gap-1">
                Cron 表达式
                <Tooltip title={cronHelpContent}>
                  <HelpCircle size={14} className="text-gray-400 cursor-help" />
                </Tooltip>
              </span>
            }
            name="cron_expr"
          >
            <Input placeholder="0 2 * * *" />
          </Form.Item>
          <Form.Item name="retain_count" label="保留最近 N 个">
            <InputNumber min={1} max={30} className="w-full" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="include_memory" label="包含内存快照" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
