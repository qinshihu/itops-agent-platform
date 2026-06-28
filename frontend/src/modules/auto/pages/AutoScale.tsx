import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tabs, Row, Col, Tag, Button, Modal, Input, Select, InputNumber, Switch, Space, message, Spin, Empty, DatePicker, Statistic } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { TrendingUp, Activity, ArrowUpRight, ArrowDownRight, Server, Zap, Play, Pause } from 'lucide-react';
import api from '../../../lib/api';

// ==================== 类型定义 ====================
interface ScaleRule {
  id: string;
  name: string;
  targetType: 'container' | 'vm';
  targetId: string;
  targetName: string;
  metricType: 'cpu' | 'memory' | 'pod_count';
  threshold: number;
  targetValue: number;
  minInstances: number;
  maxInstances: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  enabled: boolean;
  createdAt?: string;
}

interface ScaleHistory {
  id: string;
  time: string;
  ruleName: string;
  target: string;
  action: 'scale_up' | 'scale_down';
  beforeCount: number;
  afterCount: number;
  metricValue: number;
  result: 'success' | 'failed';
  reason: string;
}

interface ScaleSummary {
  activeRules: number;
  todayScaleUp: number;
  todayScaleDown: number;
  managedInstances: number;
}

// ==================== 主组件 ====================
export default function AutoScale() {
  const [activeTab, setActiveTab] = useState('rules');
  const [loading, setLoading] = useState(false);

  // 规则
  const [rules, setRules] = useState<ScaleRule[]>([]);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<ScaleRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<ScaleRule>>({});

  // 历史
  const [history, setHistory] = useState<ScaleHistory[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [timeRange, setTimeRange] = useState<[string, string] | null>(null);

  // 统计
  const [summary, setSummary] = useState<ScaleSummary>({
    activeRules: 0, todayScaleUp: 0, todayScaleDown: 0, managedInstances: 0,
  });

  // ==================== 数据获取 ====================
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/auto-scale/rules');
      setRules(res.data.data || []);
    } catch { message.error('获取规则列表失败'); }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: historyPage, pageSize: historyPageSize };
      if (timeRange) {
        params.startTime = timeRange[0];
        params.endTime = timeRange[1];
      }
      const res = await api.get('/api/auto-scale/history', { params });
      setHistory(res.data.data || []);
      setHistoryTotal(res.data.total || 0);
    } catch { message.error('获取伸缩历史失败'); }
    finally { setLoading(false); }
  }, [historyPage, historyPageSize, timeRange]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/auto-scale/summary');
      setSummary(res.data.data || { activeRules: 0, todayScaleUp: 0, todayScaleDown: 0, managedInstances: 0 });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRules(); fetchSummary(); }, []);
  useEffect(() => { if (activeTab === 'history') fetchHistory(); }, [activeTab, historyPage, historyPageSize, timeRange]);

  // ==================== 规则表单操作 ====================
  const openCreateModal = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      targetType: 'container',
      targetId: '',
      targetName: '',
      metricType: 'cpu',
      threshold: 80,
      targetValue: 70,
      minInstances: 1,
      maxInstances: 10,
      scaleUpCooldown: 300,
      scaleDownCooldown: 600,
      enabled: true,
    });
    setRuleModalVisible(true);
  };

  const openEditModal = (rule: ScaleRule) => {
    setEditingRule(rule);
    setRuleForm({ ...rule });
    setRuleModalVisible(true);
  };

  const saveRule = async () => {
    if (!ruleForm.name || !ruleForm.threshold) {
      message.warning('请填写必填字段');
      return;
    }
    try {
      if (editingRule) {
        await api.put(`/api/auto-scale/rules/${editingRule.id}`, ruleForm);
        message.success('规则已更新');
      } else {
        await api.post('/api/auto-scale/rules', ruleForm);
        message.success('规则已创建');
      }
      setRuleModalVisible(false);
      fetchRules();
      fetchSummary();
    } catch { message.error('保存失败'); }
  };

  const deleteRule = (rule: ScaleRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除规则 "${rule.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/api/auto-scale/rules/${rule.id}`);
          message.success('规则已删除');
          fetchRules();
          fetchSummary();
        } catch { message.error('删除失败'); }
      },
    });
  };

  const toggleRule = async (rule: ScaleRule, checked: boolean) => {
    try {
      await api.put(`/api/auto-scale/rules/${rule.id}`, { ...rule, enabled: checked });
      message.success(checked ? '规则已启用' : '规则已禁用');
      fetchRules();
    } catch { message.error('操作失败'); }
  };

  // ==================== 表格列 ====================
  const ruleColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '目标类型', dataIndex: 'targetType', key: 'targetType', width: 90,
      render: (t: string) => <Tag color={t === 'container' ? 'blue' : 'purple'}>{t === 'container' ? '容器' : 'VM'}</Tag> },
    { title: '目标标识', dataIndex: 'targetName', key: 'targetName', width: 120, ellipsis: true },
    { title: '指标类型', dataIndex: 'metricType', key: 'metricType', width: 90,
      render: (t: string) => ({ cpu: 'CPU', memory: '内存', pod_count: 'Pod数' }[t] || t) },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold', width: 70,
      render: (v: number) => `${v}%` },
    { title: '目标值', dataIndex: 'targetValue', key: 'targetValue', width: 70,
      render: (v: number) => `${v}%` },
    { title: '最小/最大', key: 'range', width: 100,
      render: (_: unknown, r: ScaleRule) => `${r.minInstances} / ${r.maxInstances}` },
    { title: '冷却时间(s)', key: 'cooldown', width: 110,
      render: (_: unknown, r: ScaleRule) => `${r.scaleUpCooldown}s / ${r.scaleDownCooldown}s` },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', width: 70,
      render: (v: boolean, record: ScaleRule) => (
        <Switch checked={v} size="small" onChange={(checked) => toggleRule(record, checked)} />
      )},
    { title: '操作', key: 'actions', width: 150, render: (_: unknown, record: ScaleRule) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteRule(record)}>删除</Button>
      </Space>
    )},
  ];

  const historyColumns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 170 },
    { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName', ellipsis: true },
    { title: '目标', dataIndex: 'target', key: 'target', width: 140, ellipsis: true },
    { title: '操作', dataIndex: 'action', key: 'action', width: 80,
      render: (a: string) => (
        <Tag color={a === 'scale_up' ? 'green' : 'orange'} icon={a === 'scale_up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}>
          {a === 'scale_up' ? '扩容' : '缩容'}
        </Tag>
      )},
    { title: '变更前', dataIndex: 'beforeCount', key: 'beforeCount', width: 70 },
    { title: '变更后', dataIndex: 'afterCount', key: 'afterCount', width: 70 },
    { title: '触发指标值', dataIndex: 'metricValue', key: 'metricValue', width: 100,
      render: (v: number) => v?.toFixed(1) },
    { title: '结果', dataIndex: 'result', key: 'result', width: 80,
      render: (r: string) => <Tag color={r === 'success' ? 'green' : 'red'}>{r === 'success' ? '成功' : '失败'}</Tag> },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
  ];

  // ==================== 渲染 ====================
  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={28} className="text-purple-400" />
          <h1 className="text-2xl font-bold text-white">自动伸缩</h1>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { activeTab === 'rules' ? fetchRules() : fetchHistory(); }}>
          刷新
        </Button>
      </div>

      {/* 统计卡片行 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">活跃规则数</span>}
              value={summary.activeRules}
              prefix={<Zap size={16} className="text-yellow-400 inline-block mr-1" />}
              valueStyle={{ color: '#facc15', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">今日扩容次数</span>}
              value={summary.todayScaleUp}
              prefix={<ArrowUpRight size={16} className="text-green-400 inline-block mr-1" />}
              valueStyle={{ color: '#34d399', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">今日缩容次数</span>}
              value={summary.todayScaleDown}
              prefix={<ArrowDownRight size={16} className="text-orange-400 inline-block mr-1" />}
              valueStyle={{ color: '#fb923c', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">管理实例总数</span>}
              value={summary.managedInstances}
              prefix={<Server size={16} className="text-blue-400 inline-block mr-1" />}
              valueStyle={{ color: '#60a5fa', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tab 面板 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'rules',
            label: '伸缩规则',
            children: (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                    创建规则
                  </Button>
                </div>
                <Spin spinning={loading}>
                  {rules.length === 0 && !loading ? (
                    <Empty description="暂无伸缩规则" />
                  ) : (
                    <Table
                      dataSource={rules}
                      columns={ruleColumns}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 1200 }}
                      pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条规则` }}
                    />
                  )}
                </Spin>
              </div>
            ),
          },
          {
            key: 'history',
            label: '伸缩历史',
            children: (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">时间范围：</span>
                  <DatePicker.RangePicker
                    showTime
                    onChange={(dates) => {
                      if (dates && dates[0] && dates[1]) {
                        setTimeRange([dates[0].toISOString(), dates[1].toISOString()]);
                      } else {
                        setTimeRange(null);
                      }
                    }}
                  />
                  {timeRange && (
                    <Button size="small" onClick={() => setTimeRange(null)}>清除</Button>
                  )}
                </div>
                <Spin spinning={loading}>
                  {history.length === 0 && !loading ? (
                    <Empty description="暂无伸缩历史" />
                  ) : (
                    <Table
                      dataSource={history}
                      columns={historyColumns}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 1100 }}
                      pagination={{
                        current: historyPage,
                        pageSize: historyPageSize,
                        total: historyTotal,
                        showSizeChanger: true,
                        showTotal: (t) => `共 ${t} 条记录`,
                        onChange: (p, ps) => {
                          setHistoryPage(p);
                          setHistoryPageSize(ps);
                        },
                      }}
                    />
                  )}
                </Spin>
              </div>
            ),
          },
        ]} />
      </Card>

      {/* 创建/编辑规则 Modal */}
      <Modal
        title={editingRule ? '编辑伸缩规则' : '创建伸缩规则'}
        open={ruleModalVisible}
        onOk={saveRule}
        onCancel={() => setRuleModalVisible(false)}
        width={560}
        okText="保存"
        cancelText="取消"
      >
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">名称：</span>
            <Input
              value={ruleForm.name}
              onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
              placeholder="输入规则名称"
              style={{ flex: 1 }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">目标类型：</span>
            <Select
              value={ruleForm.targetType}
              onChange={(v) => setRuleForm({ ...ruleForm, targetType: v, targetId: '', targetName: '' })}
              options={[
                { label: '容器', value: 'container' },
                { label: 'VM', value: 'vm' },
              ]}
              style={{ width: 160 }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">目标名称：</span>
            <Input
              value={ruleForm.targetName}
              onChange={(e) => setRuleForm({ ...ruleForm, targetName: e.target.value })}
              placeholder="输入目标标识或名称"
              style={{ flex: 1 }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">指标类型：</span>
            <Select
              value={ruleForm.metricType}
              onChange={(v) => setRuleForm({ ...ruleForm, metricType: v })}
              options={[
                { label: 'CPU', value: 'cpu' },
                { label: '内存', value: 'memory' },
                { label: 'Pod 数量', value: 'pod_count' },
              ]}
              style={{ width: 160 }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">阈值 (%)：</span>
            <InputNumber
              value={ruleForm.threshold}
              onChange={(v) => setRuleForm({ ...ruleForm, threshold: v || 0 })}
              min={1}
              max={100}
              style={{ width: 120 }}
              addonAfter="%"
            />
            <span className="text-slate-500 text-xs">触发伸缩的指标百分比</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">目标值 (%)：</span>
            <InputNumber
              value={ruleForm.targetValue}
              onChange={(v) => setRuleForm({ ...ruleForm, targetValue: v || 0 })}
              min={1}
              max={100}
              style={{ width: 120 }}
              addonAfter="%"
            />
            <span className="text-slate-500 text-xs">伸缩后的目标值</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">最小实例数：</span>
            <InputNumber
              value={ruleForm.minInstances}
              onChange={(v) => setRuleForm({ ...ruleForm, minInstances: v || 1 })}
              min={1}
              max={100}
              style={{ width: 120 }}
            />
            <span className="text-slate-300 w-16 text-right text-sm">最大：</span>
            <InputNumber
              value={ruleForm.maxInstances}
              onChange={(v) => setRuleForm({ ...ruleForm, maxInstances: v || 1 })}
              min={1}
              max={100}
              style={{ width: 120 }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">扩容冷却(s)：</span>
            <InputNumber
              value={ruleForm.scaleUpCooldown}
              onChange={(v) => setRuleForm({ ...ruleForm, scaleUpCooldown: v || 300 })}
              min={0}
              max={3600}
              style={{ width: 120 }}
              addonAfter="s"
            />
            <span className="text-slate-300 w-16 text-right text-sm">缩容：</span>
            <InputNumber
              value={ruleForm.scaleDownCooldown}
              onChange={(v) => setRuleForm({ ...ruleForm, scaleDownCooldown: v || 600 })}
              min={0}
              max={3600}
              style={{ width: 120 }}
              addonAfter="s"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300 w-24 text-right text-sm">启用：</span>
            <Switch
              checked={ruleForm.enabled}
              onChange={(v) => setRuleForm({ ...ruleForm, enabled: v })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
