/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Tag, Space, message, Popconfirm } from 'antd';
import { Search, RefreshCw, Trash2, Download } from 'lucide-react';
import api from '../../../lib/api';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Images() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [pullOpen, setPullOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/images', { params: { page, pageSize, search } });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, search]);

  const handleSync = async () => {
    try {
      const res = await api.post('/api/images/sync', { serverId: 'mock-1' });
      message.success(`同步完成: ${res.data.data?.synced || 0} 个镜像`);
      fetchData();
    } catch { message.error('同步失败'); }
  };

  const handlePull = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/api/images/pull', values);
      message.success('拉取请求已提交');
      setPullOpen(false);
      form.resetFields();
      fetchData();
    } catch { message.error('拉取失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/images/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '标签', dataIndex: 'tag', key: 'tag', render: (t: string) => <Tag>{t}</Tag> },
    { title: '大小', dataIndex: 'size_bytes', key: 'size', render: (s: number) => formatSize(s || 0) },
    { title: '主机', dataIndex: 'host', key: 'host' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    { title: '操作', key: 'action', width: 100, render: (_: any, record: any) => (
      <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
        <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
      </Popconfirm>
    )},
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Input placeholder="搜索镜像..." prefix={<Search size={14} className="text-gray-400" />} className="w-64" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Button icon={<RefreshCw size={14} />} onClick={fetchData}>刷新</Button>
        <Button icon={<RefreshCw size={14} />} onClick={handleSync}>同步镜像</Button>
        <Button type="primary" icon={<Download size={14} />} onClick={() => { form.resetFields(); setPullOpen(true); }}>拉取镜像</Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); } }}
      />

      <Modal title="拉取镜像" open={pullOpen} onOk={handlePull} onCancel={() => setPullOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="镜像名称" rules={[{ required: true }]}><Input placeholder="例如: nginx" /></Form.Item>
          <Form.Item name="tag" label="标签"><Input placeholder="latest" /></Form.Item>
          <Form.Item name="serverId" label="目标主机"><Input placeholder="server-1" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
