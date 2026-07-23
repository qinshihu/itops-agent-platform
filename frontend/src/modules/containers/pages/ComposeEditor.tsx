/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Tag, message, Drawer, Form, Input, Popconfirm, Empty } from 'antd';
import { Plus, Edit, Trash2, Search, RefreshCw, Play, Square, RotateCcw, Eye, FileText, Boxes } from 'lucide-react';
import api from '../../../lib/api';
import { containersApi } from '../api';

const statusColors: Record<string, string> = {
  running: 'green', stopped: 'red', error: 'orange', deploying: 'blue', partial: 'gold',
};
const statusLabel: Record<string, string> = {
  running: '运行中', stopped: '已停止', error: '错误', deploying: '部署中', partial: '部分运行',
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
      const result = await containersApi.listCompose({ page, pageSize, search });
      // 后端返回 { success, data: { items, total } }；axios 拦截器已解包
      // containersApi.listCompose 直接 return data 自身（service 包装）
      setData(result?.items || result?.data || []);
      setTotal(result?.total || result?.data?.total || 0);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, search]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/compose/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/compose', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/compose/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const handleAction = async (id: string, action: string, label: string) => {
    try {
      await api.post(`/compose/${id}/${action}`);
      message.success(`${label} 成功`);
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleValidate = async () => {
    const yaml = form.getFieldValue('yaml_content');
    if (!yaml) { message.warning('请输入 YAML 内容'); return; }
    setValidating(true);
    try {
      const { data } = await api.post('/compose/validate', { content: yaml });
      if (data.valid) {
        message.success('YAML 语法验证通过');
      } else {
        message.error(data.error || 'YAML 语法错误');
      }
    } catch { message.error('验证请求失败'); }
    finally { setValidating(false); }
  };

  const showServices = async (record: ComposeProject) => {
    setCurrentProject(record);
    setServicesDrawer(true);
    setServicesLoading(true);
    try {
      const result = await containersApi.listComposeServices(record.id);
      setServicesData(result || []);
    } catch { message.error('获取服务列表失败'); setServicesData([]); }
    finally { setServicesLoading(false); }
  };

  const showLogs = async (record: ComposeProject) => {
    setCurrentProject(record);
    setLogModalOpen(true);
    setLogsLoading(true);
    try {
      const result = await containersApi.getComposeLogs(record.id, { tail: 100 });
      setLogs(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } catch { message.error('获取日志失败'); setLogs(''); }
    finally { setLogsLoading(false); }
  };

  const openEdit = (record: ComposeProject) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  // ── 派生 ──
  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return data;
    return data.filter(p => p.status === statusFilter);
  }, [data, statusFilter]);

  const stats = useMemo(() => {
    let totalServices = 0;
    let totalRunning = 0;
    let runningProjects = 0;
    let errorProjects = 0;
    for (const p of data) {
      totalServices += p.service_count || 0;
      totalRunning += p.running_count || 0;
      if (p.status === 'running') runningProjects++;
      if (p.status === 'error') errorProjects++;
    }
    return { projects: data.length, totalServices, totalRunning, runningProjects, errorProjects };
  }, [data]);

  const columns = [
    {
      title: '项目名',
      dataIndex: 'name',
      key: 'name',
      render: (n: string, r: ComposeProject) => (
        <div>
          <div className="font-medium text-text-primary">{n}</div>
          {r.description && (
            <div className="text-xs text-text-secondary mt-0.5">{r.description}</div>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => <Tag color={statusColors[s] || 'default'} className="m-0">{statusLabel[s] || s}</Tag>,
    },
    {
      title: '服务数',
      dataIndex: 'service_count',
      key: 'service_count',
      width: 100,
      render: (v: number) => (
        <span className="text-text-secondary tabular-nums">{v ?? 0}</span>
      ),
    },
    {
      title: '运行数',
      dataIndex: 'running_count',
      key: 'running_count',
      width: 100,
      render: (v: number, r: ComposeProject) => {
        const total = r.service_count || 0;
        const running = v || 0;
        const allUp = total > 0 && running === total;
        return (
          <div className="flex items-center gap-2">
            <Tag color={allUp ? 'green' : running > 0 ? 'blue' : 'default'} className="m-0">{running}</Tag>
            <span className="text-xs text-text-secondary">/ {total}</span>
          </div>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (t?: string) => (
        <span className="text-xs text-text-secondary tabular-nums">{t || '—'}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 360,
      render: (_: unknown, record: ComposeProject) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button type="link" size="small" icon={<Play size={14} />} style={{ color: '#10b981' }} onClick={() => handleAction(record.id, 'up', '启动')}>启动</Button>
          <Button type="link" size="small" icon={<Square size={14} />} onClick={() => handleAction(record.id, 'down', '停止')}>停止</Button>
          <Button type="link" size="small" icon={<RotateCcw size={14} />} onClick={() => handleAction(record.id, 'restart', '重启')}>重启</Button>
          <Button type="link" size="small" icon={<Edit size={14} />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<Eye size={14} />} onClick={() => showServices(record)}>服务</Button>
          <Button type="link" size="small" icon={<FileText size={14} />} onClick={() => showLogs(record)}>日志</Button>
          <Popconfirm
            title="确定删除?"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const serviceColumns = [
    { title: '服务名', dataIndex: 'name', key: 'name' },
    { title: '命令', dataIndex: 'command', key: 'command', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      render: (s: string) => <Tag color={s === 'running' ? 'green' : s === 'exited' ? 'red' : 'default'}>{s}</Tag>,
    },
    { title: '端口', dataIndex: 'ports', key: 'ports' },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Compose 编排</h1>
          <p className="text-sm text-text-secondary mt-1">
            管理 Docker Compose 项目 —— 启动、停止、重启、查看服务与日志
          </p>
        </div>
      </div>

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">项目总数</div>
            <div className="text-xl font-semibold text-text-primary">{stats.projects}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">运行中项目</div>
            <div className="text-xl font-semibold text-text-primary">{stats.runningProjects}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">服务运行 / 总数</div>
            <div className="text-xl font-semibold text-text-primary tabular-nums">
              {stats.totalRunning}<span className="text-sm text-text-secondary font-normal"> / {stats.totalServices}</span>
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 flex items-center gap-3 transition-all border ${
          stats.errorProjects > 0
            ? 'bg-red-500/5 border-red-500/30'
            : 'bg-surface border-border/60 hover:border-primary/40 hover:shadow-sm'
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            stats.errorProjects > 0
              ? 'bg-red-500/15 text-red-500'
              : 'bg-slate-500/10 text-slate-500'
          }`}>
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">异常项目</div>
            <div className={`text-xl font-semibold ${
              stats.errorProjects > 0
                ? 'text-red-500'
                : 'text-text-primary'
            }`}>{stats.errorProjects}</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索项目名..."
            prefix={<Search size={14} className="text-text-secondary" />}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            allowClear
            style={{ width: 240 }}
          />

          <div className="flex items-center gap-2 ml-auto">
            <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>刷新</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建项目</Button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <Table<ComposeProject>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 个项目`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{
            emptyText: (
              <Empty
                description={search ? `未找到含 "${search}" 的项目` : '暂无 Compose 项目'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </div>

      <Modal
        title={editing ? '编辑项目' : '新建项目'}
        open={modalOpen}
        onOk={handleSave}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        width={720}
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名' }]}>
            <Input placeholder="例如: web-stack" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选的项目描述" />
          </Form.Item>
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

      <Drawer
        title={`服务列表 - ${currentProject?.name || ''}`}
        open={servicesDrawer}
        onClose={() => setServicesDrawer(false)}
        width={600}
      >
        <Table
          columns={serviceColumns}
          dataSource={servicesData}
          rowKey="name"
          loading={servicesLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="暂无服务" /> }}
        />
      </Drawer>

      <Modal
        title={`日志 - ${currentProject?.name || ''}`}
        open={logModalOpen}
        onCancel={() => setLogModalOpen(false)}
        footer={null}
        width={800}
      >
        <pre
          className="font-mono text-xs bg-slate-900 text-cyan-400 p-4 rounded-lg max-h-[500px] overflow-auto whitespace-pre-wrap break-all m-0"
          style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
        >
          {logsLoading ? '加载中...' : (logs || '暂无日志')}
        </pre>
      </Modal>
    </div>
  );
}
