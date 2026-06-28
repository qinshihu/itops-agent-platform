import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Progress } from 'antd';
import { Plus, Edit, Trash2, Search, RefreshCw, HardDrive } from 'lucide-react';
import api from '../../../lib/api';

interface Volume {
  id: string;
  name: string;
  driver: string;
  mount_point: string;
  size_gb: number;
  used_gb: number;
  status: string;
  host: string;
  type: string;
  tags?: string | string[];
}

const statusColors: Record<string, string> = {
  available: 'green', 'in-use': 'blue', error: 'red',
};

const usagePercent = (v: Volume): number => {
  if (!v.size_gb || !v.used_gb) return 0;
  return Math.round((v.used_gb / v.size_gb) * 100);
};

export default function Volumes() {
  const [data, setData] = useState<Volume[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Volume | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/volumes', { params: { page, pageSize, search } });
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
        await api.put(`/api/volumes/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/api/volumes', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/volumes/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const handleSync = async () => {
    try {
      const res = await api.post('/api/volumes/sync', { serverId: 'mock-1' });
      message.success(`同步完成: ${res.data.data?.synced || 0} 个卷`);
      fetchData();
    } catch { message.error('同步失败'); }
  };

  const openEdit = (record: any) => {
    setEditing(record);
    const vals = { ...record, tags: typeof record.tags === 'string' ? JSON.parse(record.tags || '[]') : (record.tags || []) };
    form.setFieldsValue(vals);
    setModalOpen(true);
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '驱动', dataIndex: 'driver', key: 'driver', render: (d: string) => <Tag>{d}</Tag> },
    { title: '挂载点', dataIndex: 'mount_point', key: 'mount_point', ellipsis: true },
    { title: '使用率', key: 'usage', width: 180, render: (_: unknown, r: Volume) => (
      <div className="flex items-center gap-2">
        <Progress percent={usagePercent(r)} size="small" className="flex-1" strokeColor={usagePercent(r) > 80 ? '#ff4d4f' : usagePercent(r) > 60 ? '#faad14' : '#52c41a'} />
        <span className="text-xs text-text-tertiary">{r.used_gb || 0}/{r.size_gb || 0} GB</span>
      </div>
    )},
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
    { title: '主机', dataIndex: 'host', key: 'host' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '操作', key: 'action', width: 120, render: (_: unknown, record: Volume) => (
      <Space>
        <Button type="link" size="small" icon={<Edit size={14} />} onClick={() => openEdit(record)}>编辑</Button>
        <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Input placeholder="搜索卷名/驱动..." prefix={<Search size={14} className="text-gray-400" />} className="w-64" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Button icon={<RefreshCw size={14} />} onClick={fetchData}>刷新</Button>
        <Button icon={<RefreshCw size={14} />} onClick={handleSync}>同步卷</Button>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建卷</Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); } }}
      />

      <Modal title={editing ? '编辑存储卷' : '新建存储卷'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="driver" label="驱动"><Input /></Form.Item>
            <Form.Item name="type" label="类型"><Select>
              <Select.Option value="docker">Docker</Select.Option>
              <Select.Option value="nfs">NFS</Select.Option>
              <Select.Option value="local">本地</Select.Option>
              <Select.Option value="ceph">Ceph</Select.Option>
            </Select></Form.Item>
          </div>
          <Form.Item name="mount_point" label="挂载点"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="size_gb" label="总容量 (GB)"><Input type="number" /></Form.Item>
            <Form.Item name="used_gb" label="已用 (GB)"><Input type="number" /></Form.Item>
          </div>
          <Form.Item name="host" label="主机"><Input /></Form.Item>
          <Form.Item name="tags" label="标签"><Select mode="tags" placeholder="输入标签后回车" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
