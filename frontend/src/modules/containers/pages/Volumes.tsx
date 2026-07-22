import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Progress, Empty } from 'antd';
import { Plus, Edit, Trash2, Search, RefreshCw, HardDrive, Database } from 'lucide-react';
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

const statusLabel: Record<string, string> = {
  available: '可用', 'in-use': '使用中', error: '错误',
};

const typeColor: Record<string, string> = {
  docker: 'blue', nfs: 'cyan', local: 'green', ceph: 'purple',
};
const typeLabel: Record<string, string> = {
  docker: 'Docker', nfs: 'NFS', local: '本地', ceph: 'Ceph',
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
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Volume | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/volumes', { params: { page, pageSize, search } });
      setData(data?.rows || []);
      setTotal(data?.total || 0);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, search]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/volumes/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/volumes', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/volumes/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const handleSync = async () => {
    try {
      const { data } = await api.post('/volumes/sync', { type: 'docker' });
      message.success(`同步完成: ${data?.synced || 0} 个卷`);
      fetchData();
    } catch { message.error('同步失败'); }
  };

  const openEdit = (record: Volume) => {
    setEditing(record);
    const vals = { ...record, tags: typeof record.tags === 'string' ? JSON.parse(record.tags || '[]') : (record.tags || []) };
    form.setFieldsValue(vals);
    setModalOpen(true);
  };

  // ── 派生：过滤 + 统计 ──
  const filteredData = useMemo(() => {
    if (typeFilter === 'all') return data;
    return data.filter(v => v.type === typeFilter);
  }, [data, typeFilter]);

  const stats = useMemo(() => {
    let totalSize = 0;
    let inUse = 0;
    let highUsage = 0;
    for (const v of data) {
      totalSize += v.size_gb || 0;
      if (v.status === 'in-use') inUse++;
      const p = usagePercent(v);
      if (p >= 80) highUsage++;
    }
    return { total: data.length, totalSize, inUse, highUsage };
  }, [data]);

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <span className="font-medium text-text-primary">{n}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (t: string) => <Tag color={typeColor[t] || 'default'} className="m-0">{typeLabel[t] || t}</Tag>,
    },
    {
      title: '驱动',
      dataIndex: 'driver',
      key: 'driver',
      width: 110,
      render: (d: string) => <Tag className="m-0">{d || 'local'}</Tag>,
    },
    {
      title: '挂载点',
      dataIndex: 'mount_point',
      key: 'mount_point',
      ellipsis: true,
    },
    {
      title: '使用率',
      key: 'usage',
      width: 200,
      render: (_: unknown, r: Volume) => {
        const p = usagePercent(r);
        return (
          <div className="flex items-center gap-2">
            <Progress
              percent={p}
              size="small"
              className="flex-1 min-w-[80px]"
              strokeColor={p > 80 ? '#ef4444' : p > 60 ? '#f59e0b' : '#10b981'}
            />
            <span className="text-xs text-text-secondary tabular-nums whitespace-nowrap">
              {r.used_gb || 0}/{r.size_gb || 0} GB
            </span>
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={statusColors[s] || 'default'} className="m-0">{statusLabel[s] || s}</Tag>,
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      width: 140,
      render: (h: string) => <span className="text-text-secondary">{h || '—'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center' as const,
      render: (_: unknown, record: Volume) => (
        <div className="flex items-center justify-center gap-1">
          <Button type="link" size="small" icon={<Edit size={14} />} onClick={() => openEdit(record)}>编辑</Button>
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

  return (
    <div className="p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">存储卷管理</h1>
          <p className="text-sm text-text-secondary mt-1">
            管理 Docker / NFS / 本地 / Ceph 存储卷 —— 同步、新建、删除、容量监控
          </p>
        </div>
      </div>

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">卷总数</div>
            <div className="text-xl font-semibold text-text-primary">{stats.total}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">总容量 (GB)</div>
            <div className="text-xl font-semibold text-text-primary tabular-nums">{stats.totalSize}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">使用中</div>
            <div className="text-xl font-semibold text-text-primary">{stats.inUse}</div>
          </div>
        </div>
        <div className={`rounded-xl p-4 flex items-center gap-3 transition-all border ${
          stats.highUsage > 0
            ? 'bg-red-500/5 border-red-500/30'
            : 'bg-surface border-border/60 hover:border-primary/40 hover:shadow-sm'
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            stats.highUsage > 0
              ? 'bg-red-500/15 text-red-500'
              : 'bg-slate-500/10 text-slate-500'
          }`}>
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">高使用率 (≥80%)</div>
            <div className={`text-xl font-semibold ${
              stats.highUsage > 0
                ? 'text-red-500'
                : 'text-text-primary'
            }`}>{stats.highUsage}</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索卷名 / 驱动..."
            prefix={<Search size={14} className="text-text-secondary" />}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={typeFilter}
            onChange={(v) => setTypeFilter(v)}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'docker', label: 'Docker' },
              { value: 'nfs', label: 'NFS' },
              { value: 'local', label: '本地' },
              { value: 'ceph', label: 'Ceph' },
            ]}
          />

          <div className="flex items-center gap-2 ml-auto">
            <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>刷新</Button>
            <Button icon={<RefreshCw size={14} />} onClick={handleSync}>同步卷</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建卷</Button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <Table<Volume>
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 个卷`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{
            emptyText: (
              <Empty
                description={search ? `未找到含 "${search}" 的卷` : '暂无存储卷'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </div>

      <Modal
        title={editing ? '编辑存储卷' : '新建存储卷'}
        open={modalOpen}
        onOk={handleSave}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        width={560}
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如: app-data" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="driver" label="驱动">
              <Input placeholder="local / nfs ..." />
            </Form.Item>
            <Form.Item name="type" label="类型" initialValue="docker">
              <Select
                options={[
                  { value: 'docker', label: 'Docker' },
                  { value: 'nfs', label: 'NFS' },
                  { value: 'local', label: '本地' },
                  { value: 'ceph', label: 'Ceph' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="mount_point" label="挂载点">
            <Input placeholder="/var/lib/..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="size_gb" label="总容量 (GB)">
              <Input type="number" min={0} placeholder="100" />
            </Form.Item>
            <Form.Item name="used_gb" label="已用 (GB)">
              <Input type="number" min={0} placeholder="0" />
            </Form.Item>
          </div>
          <Form.Item name="host" label="主机">
            <Input placeholder="server-1" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
