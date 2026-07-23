import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Tag, message, Popconfirm, Empty, Tooltip, Select } from 'antd';
import { Search, RefreshCw, Trash2, Download, Cloud, HardDrive, Server, Layers } from 'lucide-react';
import api from '../../../lib/api';

export interface Image {
  id: string;
  name: string;
  tag?: string;
  size_bytes?: number;
  host?: string;
  created_at?: string;
  [key: string]: unknown;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 根据镜像名分发语义色 —— 蓝（系统镜像）、绿（中间件）、紫（数据库）、橙（其他）
function tagColorForImage(name: string, tag?: string): string {
  const n = (name + ' ' + (tag || '')).toLowerCase();
  if (/(nginx|apache|httpd|caddy|traefik|haproxy)/.test(n)) return 'cyan';
  if (/(redis|memcache|etcd)/.test(n)) return 'red';
  if (/(mysql|mariadb|postgres|postgresql|mongo|mongodb|clickhouse|influxdb|elasticsearch)/.test(n)) return 'purple';
  if (/(kafka|rabbitmq|activemq|nats|pulsar|emqx|mqtt)/.test(n)) return 'magenta';
  if (/(node|python|golang|java|openjdk|alpine|debian|ubuntu|centos|busybox)/.test(n)) return 'blue';
  if (/(grafana|prometheus|zipkin|jaeger|skywalking)/.test(n)) return 'gold';
  return 'default';
}

// 主机名常见 chip 颜色
function hostColor(host?: string): string {
  if (!host) return 'default';
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  const palette = ['blue', 'green', 'purple', 'magenta', 'cyan', 'gold', 'geekblue', 'volcano'];
  return palette[h % palette.length];
}

export default function Images() {
  const [data, setData] = useState<Image[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [hostFilter, setHostFilter] = useState<string>('all');
  const [pullOpen, setPullOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      // 后端返回 { success, data: { items, total } }；axios 拦截器已解包 → data = { items, total }
      const { data } = await api.get('/images', { params: { page, pageSize, search } });
      setData(data?.items || []);
      setTotal(data?.total || 0);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, search]);

  const handleSync = async () => {
    try {
      const { data } = await api.post('/images/sync', {});
      const count = Array.isArray(data?.data) ? data.data.length : (data?.synced || 0);
      const target = data?.endpointId ? ` (端点: ${data.endpointId})` : ' (本地 Docker)';
      message.success(`同步完成${target}: ${count} 个镜像`);
      fetchData();
    } catch { message.error('同步失败'); }
  };

  const handlePull = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/images/pull', values);
      message.success('拉取请求已提交');
      setPullOpen(false);
      form.resetFields();
      fetchData();
    } catch { message.error('拉取失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/images/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  // ── 派生：按 host 过滤 + 总览统计 ──
  const hostOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach(d => { if (d.host) set.add(d.host); });
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    if (hostFilter === 'all') return data;
    return data.filter(d => d.host === hostFilter);
  }, [data, hostFilter]);

  const stats = useMemo(() => {
    let totalSize = 0;
    let dbCount = 0;
    let mwCount = 0;
    for (const img of data) {
      totalSize += img.size_bytes || 0;
      const n = (img.name + ' ' + (img.tag || '')).toLowerCase();
      if (/(mysql|mariadb|postgres|postgresql|mongo|mongodb|redis|clickhouse|influxdb|elasticsearch|kafka|rabbitmq)/.test(n)) {
        dbCount++;
      } else if (/(nginx|apache|httpd|caddy|traefik|haproxy|node|python|java|openjdk|grafana|prometheus)/.test(n)) {
        mwCount++;
      }
    }
    return { totalSize, dbCount, mwCount, total: data.length };
  }, [data]);

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Image) => (
        <Tooltip title={record.id}>
          <span className="font-medium text-text-primary">{name || '(unnamed)'}</span>
        </Tooltip>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tag',
      key: 'tag',
      width: 160,
      render: (t: string, record: Image) => (
        <Tag color={tagColorForImage(record.name, t)} className="m-0">
          {t || 'latest'}
        </Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size_bytes',
      key: 'size',
      width: 110,
      render: (s: number) => (
        <span className="text-text-secondary tabular-nums">{formatSize(s || 0)}</span>
      ),
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      width: 140,
      render: (h?: string) =>
        h ? <Tag color={hostColor(h)} className="m-0">{h}</Tag> : <span className="text-text-secondary/60">—</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t?: string) => (
        <span className="text-text-secondary tabular-nums text-xs">{t || '—'}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: Image) => (
        <Popconfirm title="确定删除?" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">镜像管理</h1>
          <p className="text-sm text-text-secondary mt-1">
            管理 Docker 镜像 —— 同步、拉取、删除、本地仓库可视
          </p>
        </div>
      </div>

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">镜像总数</div>
            <div className="text-xl font-semibold text-text-primary">{stats.total}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">占用空间</div>
            <div className="text-xl font-semibold text-text-primary">{formatSize(stats.totalSize)}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">数据库 / 中间件</div>
            <div className="text-xl font-semibold text-text-primary">{stats.dbCount}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">应用镜像</div>
            <div className="text-xl font-semibold text-text-primary">{stats.mwCount}</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索镜像名 / tag..."
            prefix={<Search size={14} className="text-text-secondary" />}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            allowClear
            style={{ width: 240 }}
          />
          {hostOptions.length > 1 && (
            <Select
              value={hostFilter}
              onChange={(v) => setHostFilter(v)}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: '全部主机' },
                ...hostOptions.map(h => ({ value: h, label: h })),
              ]}
            />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>刷新</Button>
            <Button icon={<RefreshCw size={14} />} onClick={handleSync}>同步镜像</Button>
            <Button type="primary" icon={<Download size={14} />} onClick={() => { form.resetFields(); setPullOpen(true); }}>拉取镜像</Button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <Table<Image>
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
            showTotal: (t) => `共 ${t} 个镜像`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{
            emptyText: (
              <Empty
                description={search ? `未找到含 "${search}" 的镜像` : '暂无镜像'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </div>

      <Modal
        title="拉取镜像"
        open={pullOpen}
        onOk={handlePull}
        onCancel={() => setPullOpen(false)}
        okText="开始拉取"
        cancelText="取消"
        width={480}
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item name="name" label="镜像名称" rules={[{ required: true, message: '请输入镜像名' }]}>
            <Input placeholder="例如: nginx" />
          </Form.Item>
          <Form.Item name="tag" label="标签" initialValue="latest">
            <Input placeholder="latest" />
          </Form.Item>
          <Form.Item name="serverId" label="目标主机（可选）">
            <Input placeholder="留空则拉取到所有主机" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
