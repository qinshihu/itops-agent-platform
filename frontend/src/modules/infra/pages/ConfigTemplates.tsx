import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd';
import { Plus, Edit, Trash2, Search, RefreshCw, Eye, FileText } from 'lucide-react';
import api from '../../../lib/api';

interface ConfigTemplate {
  id: string;
  name: string;
  type: string;
  target_type: string;
  version: number;
  tags?: string | string[];
  content: string;
  variables?: string | string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

const typeColors: Record<string, string> = {
  generic: 'default', nginx: 'blue', apache: 'cyan', docker: 'teal', kubernetes: 'purple', database: 'orange', monitoring: 'green', system: 'volcano',
};

export default function ConfigTemplates() {
  const [data, setData] = useState<ConfigTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [editing, setEditing] = useState<ConfigTemplate | null>(null);
  const [form] = Form.useForm();
  const [variables, setVariables] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/config-templates', { params: { page, pageSize, search, type: typeFilter } });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, search, typeFilter]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/api/config-templates/${editing.id}`, { ...values, variables });
        message.success('更新成功');
      } else {
        await api.post('/api/config-templates', { ...values, variables });
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      setVariables([]);
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/config-templates/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const handlePreview = async (id: string) => {
    try {
      const vars: Record<string, string> = {};
      variables.forEach(v => { vars[v] = `{{${v}}}`; });
      const res = await api.post(`/api/config-templates/${id}/render`, { variables: vars });
      setPreviewContent(res.data.data?.rendered || '');
      setPreviewOpen(true);
    } catch { message.error('预览失败'); }
  };

  const openEdit = (record: ConfigTemplate) => {
    setEditing(record);
    const vars = typeof record.variables === 'string' ? JSON.parse(record.variables || '[]') : (record.variables || []);
    setVariables(vars);
    form.setFieldsValue({ ...record, tags: typeof record.tags === 'string' ? JSON.parse(record.tags || '[]') : (record.tags || []) });
    setModalOpen(true);
  };

  const addVariable = () => { setVariables([...variables, '']); };
  const removeVariable = (idx: number) => { setVariables(variables.filter((_, i) => i !== idx)); };
  const updateVariable = (idx: number, val: string) => { const v = [...variables]; v[idx] = val; setVariables(v); };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color={typeColors[t] || 'default'}>{t}</Tag> },
    { title: '目标类型', dataIndex: 'target_type', key: 'target_type' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: (t: string) => {
      const tags = typeof t === 'string' ? JSON.parse(t || '[]') : (t || []);
      return tags.map((tag: string) => <Tag key={tag}>{tag}</Tag>);
    }},
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    { title: '操作', key: 'action', width: 200, render: (_: unknown, record: ConfigTemplate) => (
      <Space>
        <Button type="link" size="small" icon={<Eye size={14} />} onClick={() => handlePreview(record.id)}>预览</Button>
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
        <Input placeholder="搜索模板..." prefix={<Search size={14} className="text-gray-400" />} className="w-64" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Select placeholder="类型筛选" className="w-32" value={typeFilter || undefined} onChange={(v: string) => { setTypeFilter(v || ''); setPage(1); }} allowClear>
          <Select.Option value="generic">通用</Select.Option>
          <Select.Option value="nginx">Nginx</Select.Option>
          <Select.Option value="docker">Docker</Select.Option>
          <Select.Option value="database">数据库</Select.Option>
        </Select>
        <Button icon={<RefreshCw size={14} />} onClick={fetchData}>刷新</Button>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setVariables([]); setModalOpen(true); }}>新建模板</Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); } }}
      />

      <Modal title={editing ? '编辑配置模板' : '新建配置模板'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); setVariables([]); }} width={700}>
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="type" label="类型"><Select>
              <Select.Option value="generic">通用</Select.Option>
              <Select.Option value="nginx">Nginx</Select.Option>
              <Select.Option value="docker">Docker</Select.Option>
              <Select.Option value="database">数据库</Select.Option>
              <Select.Option value="monitoring">监控</Select.Option>
            </Select></Form.Item>
          </div>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="content" label="模板内容"><Input.TextArea rows={8} className="font-mono text-sm" placeholder="使用 {{variable_name}} 作为变量占位符" /></Form.Item>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-tertiary">变量列表</span>
              <Button size="small" icon={<Plus size={12} />} onClick={addVariable}>添加变量</Button>
            </div>
            {variables.map((v, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <Input size="small" placeholder="变量名称" value={v} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariable(i, e.target.value)} className="w-48" />
                <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => removeVariable(i)} />
              </div>
            ))}
          </div>
          <Form.Item name="tags" label="标签"><Select mode="tags" placeholder="输入标签后回车" /></Form.Item>
          {editing && <Button icon={<Eye size={14} />} onClick={() => handlePreview(editing.id)}>预览当前模板</Button>}
        </Form>
      </Modal>

      <Modal title="模板预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={700}>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap">{previewContent}</pre>
      </Modal>
    </div>
  );
}
