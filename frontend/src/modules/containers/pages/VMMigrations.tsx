import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Table, Tag, Button, Modal, Input, Select, Form, Progress, Space, message, Empty, Tooltip, Alert } from 'antd';
import { ReloadOutlined, PlusOutlined, StopOutlined, ArrowRightOutlined, CheckCircleTwoTone, CloseCircleTwoTone, ClockCircleTwoTone, MinusCircleTwoTone } from '@ant-design/icons';
import { useToast } from '../../../contexts/ToastContext';
import { vmMigrationApi, type VmMigration, type VmMigrationInput } from '../api';
import { ArrowRightLeft, Clock3, CheckCircle2, XCircle } from 'lucide-react';

/**
 * VM 迁移历史 / 任务管理
 *
 * 展示：
 *   - 4 张统计卡：总数 / 进行中 / 已完成 / 失败
 *   - 工具栏：状态过滤 + 搜索 + 刷新 + 新建迁移
 *   - 表格：状态 + VM + 源/目标主机 + 进度 + 操作
 *   - 详情 Modal：完整字段 + 错误信息
 *
 * 进度条：进行中状态每 3s 轮询拉取最新 progress。
 */
export default function VMMigrations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<VmMigration | null>(null);
  const [form] = Form.useForm<VmMigrationInput & { vmIdText: string }>();

  // ── 查询迁移任务列表 ──
  const { data: migrations = [], isLoading, refetch } = useQuery<VmMigration[]>({
    queryKey: ['vm-migrations', statusFilter, search],
    queryFn: () => vmMigrationApi.listMigrations(),
  });

  // 进行中的任务每 3s 自动轮询（拉取进度）
  useQuery({
    queryKey: ['vm-migrations-active'],
    queryFn: () => vmMigrationApi.listActiveMigrations(),
    refetchInterval: 3000,
  });

  // ── 统计 ──
  const stats = {
    total: migrations.length,
    running: migrations.filter(m => m.status === 'running' || m.status === 'pending').length,
    completed: migrations.filter(m => m.status === 'completed').length,
    failed: migrations.filter(m => m.status === 'failed').length,
  };

  // 过滤
  const filtered = migrations.filter(m => {
    if (statusFilter && m.status !== statusFilter) return false;
    if (search) {
      const kw = search.toLowerCase();
      if (!m.vmName.toLowerCase().includes(kw) && !m.targetHost.toLowerCase().includes(kw) && !m.sourceHost.toLowerCase().includes(kw)) {
        return false;
      }
    }
    return true;
  });

  // ── 启动迁移 ──
  const startMutation = useMutation({
    mutationFn: (input: VmMigrationInput) => vmMigrationApi.startMigration(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-migrations'] });
      toast.success('迁移已启动');
      setCreateModalOpen(false);
      form.resetFields();
    },
    onError: (err: unknown) => toast.error(getErrMsg(err, '启动迁移失败')),
  });

  // ── 取消迁移 ──
  const cancelMutation = useMutation({
    mutationFn: (id: string) => vmMigrationApi.cancelMigration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-migrations'] });
      toast.success('已取消');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err, '取消失败')),
  });

  const handleCreate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      // vmId 形式可以是 "platformId/vmId" 或 "platformId:vmId" → 拆分
      const { vmIdText, ...rest } = values;
      const [platformId, vmId] = vmIdText.includes('/') ? vmIdText.split('/') : vmIdText.split(':');
      if (!platformId || !vmId) {
        toast.warning('VM 标识格式: platformId/vmId 或 platformId:vmId');
        return;
      }
      startMutation.mutate({ platformId, vmId, targetHost: rest.targetHost, reason: rest.reason });
    } catch {
      // 表单校验失败
    }
  }, [form, startMutation, toast]);

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">虚拟机迁移</h1>
        <p className="text-sm text-text-secondary mt-1">
          管理跨 hypervisor 虚拟机迁移任务 —— 进度跟踪、错误重试、批量执行
        </p>
      </div>

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">任务总数</div>
            <div className="text-xl font-semibold text-text-primary">{stats.total}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Clock3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">进行中</div>
            <div className="text-xl font-semibold text-text-primary">{stats.running}</div>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">已完成</div>
            <div className="text-xl font-semibold text-text-primary">{stats.completed}</div>
          </div>
        </div>
        <div className={`rounded-xl p-4 flex items-center gap-3 transition-all border ${
          stats.failed > 0
            ? 'bg-red-500/5 border-red-500/30'
            : 'bg-surface border-border/60 hover:border-primary/40 hover:shadow-sm'
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            stats.failed > 0
              ? 'bg-red-500/15 text-red-500'
              : 'bg-slate-500/10 text-slate-500'
          }`}>
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-secondary">失败</div>
            <div className={`text-xl font-semibold ${
              stats.failed > 0
                ? 'text-red-500'
                : 'text-text-primary'
            }`}>{stats.failed}</div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            placeholder="状态"
            value={statusFilter || undefined}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'pending', label: '等待中' },
              { value: 'running', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '失败' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
          <Input
            placeholder="搜索 VM / 主机"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <div className="ml-auto flex items-center gap-2">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>新建迁移</Button>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={filtered}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无迁移任务" /> }}
          columns={[
            {
              title: '状态', dataIndex: 'status', width: 110,
              render: (s: VmMigration['status']) => <StatusTag status={s} />,
            },
            { title: 'VM 名称', dataIndex: 'vmName', width: 140, ellipsis: true },
            {
              title: '路径', width: 280,
              render: (_: unknown, r: VmMigration) => (
                <Space size={4} wrap>
                  <span>{r.sourceHost}</span>
                  <ArrowRightOutlined style={{ color: '#94a3b8' }} />
                  <span style={{ fontWeight: 500 }}>{r.targetHost}</span>
                </Space>
              ),
            },
            {
              title: '进度', dataIndex: 'progress', width: 200,
              render: (p: number, r: VmMigration) => (
                <Progress
                  percent={p}
                  size="small"
                  status={
                    r.status === 'failed' ? 'exception' :
                    r.status === 'cancelled' ? 'normal' :
                    r.status === 'completed' ? 'success' :
                    'active'
                  }
                />
              ),
            },
            {
              title: '开始时间', dataIndex: 'startedAt', width: 160,
              render: (t?: string) => t ? new Date(t).toLocaleString() : '-',
            },
            {
              title: '操作', width: 140, fixed: 'right',
              render: (_: unknown, r: VmMigration) => (
                <Space size="small">
                  <Button size="small" onClick={() => setDetailTask(r)}>详情</Button>
                  {(r.status === 'running' || r.status === 'pending') && (
                    <Button
                      size="small" danger icon={<StopOutlined />}
                      onClick={() => {
                        Modal.confirm({
                          title: '确认取消迁移？',
                          content: `VM ${r.vmName} 的迁移将被中断`,
                          onOk: () => cancelMutation.mutate(r.id),
                        });
                      }}
                    >
                      取消
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

      {/* 新建迁移 Modal */}
      <Modal
        title="新建虚拟机迁移"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={startMutation.isPending}
        okText="启动迁移"
        cancelText="取消"
        width={560}
      >
        <Alert
          message="迁移会真实调用 hypervisor API，可能导致 VM 短暂停机（取决于存储迁移模式）"
          type="warning"
          showIcon
          className="!mb-4"
        />
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            name="vmIdText" label="VM 标识"
            rules={[{ required: true, message: '请输入 VM 标识' }]}
            extra="格式: platformId/vmId，可从 虚拟机管理 页面获取"
          >
            <Input placeholder="例如: proxmox-cluster-1/vm-100" />
          </Form.Item>
          <Form.Item
            name="targetHost" label="目标主机"
            rules={[{ required: true, message: '请输入目标主机' }]}
          >
            <Input placeholder="例如: esxi-host-2" />
          </Form.Item>
          <Form.Item name="reason" label="迁移原因">
            <Input.TextArea rows={2} placeholder="可选" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Modal */}
      <Modal
        title="迁移任务详情"
        open={!!detailTask}
        onCancel={() => setDetailTask(null)}
        footer={<Button onClick={() => setDetailTask(null)}>关闭</Button>}
        width={640}
      >
        {detailTask && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div><b>任务 ID:</b> <Tooltip title={detailTask.id}><span className="font-mono text-xs">{detailTask.id.slice(0, 8)}…</span></Tooltip></div>
              <div><b>状态:</b> <StatusTag status={detailTask.status} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><b>VM:</b> {detailTask.vmName}</div>
              <div><b>VM ID:</b> <span className="font-mono text-xs">{detailTask.vmId}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><b>平台 ID:</b> <span className="font-mono text-xs">{detailTask.platformId}</span></div>
              <div><b>源主机:</b> {detailTask.sourceHost}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><b>目标主机:</b> {detailTask.targetHost}</div>
              <div><b>进度:</b> {detailTask.progress}%</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><b>开始时间:</b> {detailTask.startedAt ? new Date(detailTask.startedAt).toLocaleString() : '-'}</div>
              <div><b>完成时间:</b> {detailTask.completedAt ? new Date(detailTask.completedAt).toLocaleString() : '-'}</div>
            </div>
            {detailTask.reason && (
              <div><b>迁移原因:</b> {detailTask.reason}</div>
            )}
            {detailTask.errorMessage && (
              <Alert type="error" message="错误信息" description={detailTask.errorMessage} showIcon />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusTag({ status }: { status: VmMigration['status'] }) {
  const cfg: Record<VmMigration['status'], { color: string; text: string; icon: React.ReactNode }> = {
    pending: { color: 'default', text: '等待中', icon: <MinusCircleTwoTone twoToneColor="#94a3b8" /> },
    running: { color: 'processing', text: '进行中', icon: <ClockCircleTwoTone twoToneColor="#1677ff" /> },
    completed: { color: 'success', text: '已完成', icon: <CheckCircleTwoTone twoToneColor="#52c41a" /> },
    failed: { color: 'error', text: '失败', icon: <CloseCircleTwoTone twoToneColor="#ff4d4f" /> },
    cancelled: { color: 'warning', text: '已取消', icon: <StopOutlined style={{ color: '#faad14' }} /> },
  };
  const c = cfg[status];
  return <Tag color={c.color} icon={c.icon as React.ReactElement}>{c.text}</Tag>;
}

function getErrMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { message?: string; error?: string } } }).response;
    if (r?.data?.message) return r.data.message;
    if (r?.data?.error) return r.data.error;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
