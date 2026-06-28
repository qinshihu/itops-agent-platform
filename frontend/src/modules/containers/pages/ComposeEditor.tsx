/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Tag, Space, message, Drawer, Form, Input, Popconfirm, Select } from 'antd';
import { Plus, Edit, Trash2, Search, RefreshCw, Play, Square, RotateCcw, Eye, FileText } from 'lucide-react';
import api from '../../../lib/api';

const statusColors: Record<string, string> = {
  running: 'green', stopped: 'red', error: 'orange', deploying: 'blue',
};

interface ComposeProject {
  id: string;
  name: string;
  description?: string;
  yaml_content?: string;
  status: string;
  service_count?: number;
  running_count?: number;
  updated_at?: string;
}

interface ComposeService {
  name: string;
  command?: string;
  state?: string;
  ports?: string;
  status?: string;
}

export default function ComposeEditor() {
  const [data, setData] = useState<ComposeProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComposeProject | null>(null);
  const [form] = Form.useForm();
  const [servicesDrawer, setServicesDrawer] = useState(false);
  const [servicesData, setServicesData] = useState<ComposeService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<ComposeProject | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/compose', { params: { page, pageSize, search } });
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
        await api.put(`/api/compose/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/api/compose', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/compose/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const handleAction = async (id: string, action: string) => {
    try { await api.post(`/api/compose/${id}/${action}`); message.success('操作成功'); fetchData(); } catch { message.error('操作失败'); }
  };

  const handleValidate = async () => {
    const yaml = form.getFieldValue('yaml_content');
    if (!yaml) { message.warning('请输入 YAML 内容'); return; }
    setValidating(true);
    try {
      const res = await api.post('/api/compose/validate', { yaml_content: yaml });
      if (res.data.valid) {
        message.success('YAML 语法验证通过');
      } else {
        message.error(res.data.error || 'YAML 语法错误');
      }
    } catch { message.error('验证请求失败'); }
    finally { setValidating(false); }
  };

  const showServices = async (record: ComposeProject) => {
    setCurrentProject(record);
    setServicesDrawer(true);
    setServicesLoading(true);
    try {
      const res = await api.get(`/api/compose/${record.id}/services`);
      setServicesData(res.data.data || []);
    } catch { message.error('获取服务列表失败'); setServicesData([]); }
    finally { setServicesLoading(false); }
  };

  const showLogs = async (record: ComposeProject) => {
    setCurrentProject(record);
    setLogModalOpen(true);
    setLogsLoading(true);
    try {
      const res = await api.get(`/api/compose/${record.id}/logs`, { params: { tail: 100 } });
      setLogs(typeof res.data.data === 'string' ? res.data.data : JSON.stringify(res.data.data, null, 2));
    } catch { message.error('获取日志失败'); setLogs(''); }
    finally { setLogsLoading(false); }
  };

  const openEdit = (record: ComposeProject) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const columns = [
    { title: '项目名', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
    { title: '服务数', dataIndex: 'service_count', key: 'service_count' },
    { title: '运行数', dataIndex: 'running_count', key: 'running_count', render: (v: number) => <Tag color={v > 0 ? 'green' : 'default'}>{v ?? 0}</Tag> },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
    { title: '操作', key: 'action', width: 320, render: (_: any, record: ComposeProject) => (
      <Space>
        <Button type="link" size="small" icon={<Play size={14} />} style={{ color: '#52c41a' }} onClick={() => handleAction(record.id, 'up')}>启动</Button>
        <Button type="link" size="small" danger icon={<Square size={14} />} onClick={() => handleAction(record.id, 'down')}>停止</Button>
        <Button type="link" size="small" icon={<RotateCcw size={14} />} onClick={() => handleAction(record.id, 'restart')}>重启</Button>
        <Button type="link" size="small" icon={<Edit size={14} />} onClick={() => openEdit(record)}>编辑</Button>
        <Button type="link" size="small" icon={<Eye size={14} />} onClick={() => showServices(record)}>服务</Button>
        <Button type="link" size="small" icon={<FileText size={14} />} onClick={() => showLogs(record)}>日志</Button>
        <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const serviceColumns = [
    { title: '服务名', dataIndex: 'name', key: 'name' },
    { title: '命令', dataIndex: 'command', key: 'command', ellipsis: true },
    { title: '状态', dataIndex: 'state', key: 'state', render: (s: string) => <Tag color={s === 'running' ? 'green' : s === 'exited' ? 'red' : 'default'}>{s}</Tag> },
    { title: '端口', dataIndex: 'ports', key: 'ports' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Input placeholder="搜索项目名..." prefix={<Search size={14} className="text-gray-400" />} className="w-64" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Button icon={<RefreshCw size={14} />} onClick={fetchData}>刷新</Button>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建项目</Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); } }}
      />

      <Modal title={editing ? '编辑项目' : '新建项目'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="YAML 编排" required>
            <div className="flex flex-col gap-2">
              <Form.Item name="yaml_content" noStyle rules={[{ required: true, message: '请输入 YAML 内容' }]}>
                <Input.TextArea
                  rows={14}
                  placeholder="version: '3.8'\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - '80:80'"
                  style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace', background: '#1e293b', color: '#e2e8f0' }}
                />
              </Form.Item>
              <Button onClick={handleValidate} loading={validating} size="small" style={{ alignSelf: 'flex-start' }}>语法验证</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={`服务列表 - ${currentProject?.name || ''}`} open={servicesDrawer} onClose={() => setServicesDrawer(false)} width={600}>
        <Table columns={serviceColumns} dataSource={servicesData} rowKey="name" loading={servicesLoading} pagination={false} size="small" />
      </Drawer>

      <Modal title={`日志 - ${currentProject?.name || ''}`} open={logModalOpen} onCancel={() => setLogModalOpen(false)} footer={null} width={800}>
        <pre style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: 12, background: '#0f172a', color: '#22d3ee', padding: 16, borderRadius: 8, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
          {logsLoading ? '加载中...' : (logs || '暂无日志')}
        </pre>
      </Modal>
    </div>
  );
}
