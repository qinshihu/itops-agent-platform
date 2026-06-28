import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tabs, Row, Col, Tag, Button, Spin, Empty, Statistic } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { AlertCircle, Zap, DollarSign, TrendingDown, TrendingUp, Package, Cpu } from 'lucide-react';
import api from '../../../lib/api';

// ==================== 类型定义 ====================
interface ContainerCost {
  name: string;
  host: string;
  cpuCores: number;
  memoryMB: number;
  hourlyRate: number;
  dailyEstimate: number;
  monthlyEstimate: number;
}

interface VMCost {
  name: string;
  platform: string;
  cpuCores: number;
  memoryGB: number;
  diskGB: number;
  hourlyRate: number;
  monthlyEstimate: number;
}

interface Recommendation {
  id: string;
  type: 'idle' | 'downsize' | 'reserved';
  title: string;
  description: string;
  monthlySavings: number;
  resource: string;
}

interface CostSummary {
  containerMonthly: number;
  vmMonthly: number;
  totalMonthly: number;
  idleWaste: number;
}

// ==================== 费率常量 ====================
const RATE_CONTAINER_CPU = 0.05;    // ¥/核/小时
const RATE_CONTAINER_MEM = 0.005;   // ¥/MB/小时
const RATE_VM_CPU = 0.10;           // ¥/核/小时
const RATE_VM_MEM = 0.01;           // ¥/MB/小时
const RATE_VM_DISK = 0.0002;        // ¥/GB/小时

// ==================== 图标映射 ====================
const recommendationIcons: Record<string, React.ReactNode> = {
  idle: <AlertCircle size={28} className="text-orange-400" />,
  downsize: <Zap size={28} className="text-blue-400" />,
  reserved: <DollarSign size={28} className="text-green-400" />,
};

const recommendationColors: Record<string, string> = {
  idle: 'border-orange-500/30 bg-orange-500/5',
  downsize: 'border-blue-500/30 bg-blue-500/5',
  reserved: 'border-green-500/30 bg-green-500/5',
};

// ==================== 主组件 ====================
export default function CostAnalysis() {
  const [activeTab, setActiveTab] = useState('containers');
  const [loading, setLoading] = useState(false);

  const [containers, setContainers] = useState<ContainerCost[]>([]);
  const [vms, setVms] = useState<VMCost[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<CostSummary>({
    containerMonthly: 0, vmMonthly: 0, totalMonthly: 0, idleWaste: 0,
  });

  const fetchContainers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/cost-analysis/containers');
      setContainers(res.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchVMs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/cost-analysis/vms');
      setVms(res.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/cost-analysis/recommendations');
      setRecommendations(res.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/cost-analysis/summary');
      setSummary(res.data.data || { containerMonthly: 0, vmMonthly: 0, totalMonthly: 0, idleWaste: 0 });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSummary(); }, []);

  const refreshCurrentTab = () => {
    switch (activeTab) {
      case 'containers': fetchContainers(); break;
      case 'vms': fetchVMs(); break;
      case 'recommendations': fetchRecommendations(); break;
    }
  };

  useEffect(() => { refreshCurrentTab(); }, [activeTab]);

  // ==================== 表格列 ====================
  const containerColumns = [
    { title: '容器名', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '主机', dataIndex: 'host', key: 'host', width: 140 },
    { title: 'CPU (核)', dataIndex: 'cpuCores', key: 'cpuCores', width: 90, render: (v: number) => v?.toFixed(2) },
    { title: '内存 (MB)', dataIndex: 'memoryMB', key: 'memoryMB', width: 100, render: (v: number) => v?.toFixed(0) },
    { title: '每小时费率', dataIndex: 'hourlyRate', key: 'hourlyRate', width: 110,
      render: (v: number) => `¥${(v || 0).toFixed(4)}` },
    { title: '24h 估算', dataIndex: 'dailyEstimate', key: 'dailyEstimate', width: 110,
      render: (v: number) => `¥${(v || 0).toFixed(2)}` },
    { title: '30日估算', dataIndex: 'monthlyEstimate', key: 'monthlyEstimate', width: 110,
      render: (v: number) => (
        <span className="font-medium text-blue-400">¥{(v || 0).toFixed(2)}</span>
      )},
    { title: '操作', key: 'actions', width: 80,
      render: () => <Button size="small" type="link">详情</Button> },
  ];

  const vmColumns = [
    { title: 'VM 名', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 90 },
    { title: 'CPU (核)', dataIndex: 'cpuCores', key: 'cpuCores', width: 90, render: (v: number) => v?.toFixed(2) },
    { title: '内存 (GB)', dataIndex: 'memoryGB', key: 'memoryGB', width: 100, render: (v: number) => v?.toFixed(1) },
    { title: '磁盘 (GB)', dataIndex: 'diskGB', key: 'diskGB', width: 100, render: (v: number) => v?.toFixed(0) },
    { title: '每小时费率', dataIndex: 'hourlyRate', key: 'hourlyRate', width: 110,
      render: (v: number) => `¥${(v || 0).toFixed(4)}` },
    { title: '30日估算', dataIndex: 'monthlyEstimate', key: 'monthlyEstimate', width: 110,
      render: (v: number) => (
        <span className="font-medium text-blue-400">¥{(v || 0).toFixed(2)}</span>
      )},
  ];

  // ==================== 汇总行 ====================
  const containerTotal = containers.reduce((sum, c) => sum + (c.monthlyEstimate || 0), 0);
  const vmTotal = vms.reduce((sum, v) => sum + (v.monthlyEstimate || 0), 0);
  const recommendationsTotalSavings = recommendations.reduce((sum, r) => sum + (r.monthlySavings || 0), 0);

  const containerFooter = () => (
    <div className="flex justify-end pr-4 py-1">
      <span className="text-slate-400 text-sm">容器月度合计：</span>
      <span className="font-bold text-blue-400 ml-2">¥{containerTotal.toFixed(2)}</span>
    </div>
  );

  const vmFooter = () => (
    <div className="flex justify-end pr-4 py-1">
      <span className="text-slate-400 text-sm">VM 月度合计：</span>
      <span className="font-bold text-blue-400 ml-2">¥{vmTotal.toFixed(2)}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign size={28} className="text-green-400" />
          <h1 className="text-2xl font-bold text-white">成本分析</h1>
        </div>
        <Button icon={<ReloadOutlined />} onClick={refreshCurrentTab}>刷新</Button>
      </div>

      {/* 费率说明 */}
      <Card size="small" className="bg-slate-800/50 border-slate-700">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-slate-400">
          <span>容器 CPU：<span className="text-slate-300 font-mono">¥{RATE_CONTAINER_CPU}/核/h</span></span>
          <span>容器内存：<span className="text-slate-300 font-mono">¥{RATE_CONTAINER_MEM}/MB/h</span></span>
          <span>VM CPU：<span className="text-slate-300 font-mono">¥{RATE_VM_CPU}/核/h</span></span>
          <span>VM 内存：<span className="text-slate-300 font-mono">¥{RATE_VM_MEM}/MB/h</span></span>
          <span>VM 磁盘：<span className="text-slate-300 font-mono">¥{RATE_VM_DISK}/GB/h</span></span>
        </div>
      </Card>

      {/* 统计卡片行 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">容器月成本估算</span>}
              value={summary.containerMonthly}
              precision={2}
              prefix={<Package size={16} className="text-blue-400 inline-block mr-1" />}
              suffix="¥"
              valueStyle={{ color: '#60a5fa', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">VM 月成本估算</span>}
              value={summary.vmMonthly}
              precision={2}
              prefix={<Cpu size={16} className="text-purple-400 inline-block mr-1" />}
              suffix="¥"
              valueStyle={{ color: '#a78bfa', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">总月成本</span>}
              value={summary.totalMonthly}
              precision={2}
              prefix={<TrendingUp size={16} className="text-green-400 inline-block mr-1" />}
              suffix="¥"
              valueStyle={{ color: '#34d399', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="bg-slate-800/50 border-slate-700">
            <Statistic
              title={<span className="text-slate-400 text-xs">闲置资源浪费</span>}
              value={summary.idleWaste}
              precision={2}
              prefix={<TrendingDown size={16} className="text-orange-400 inline-block mr-1" />}
              suffix="¥"
              valueStyle={{ color: '#fb923c', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tab 面板 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'containers',
            label: '容器成本',
            children: (
              <Spin spinning={loading}>
                {containers.length === 0 && !loading ? (
                  <Empty description="暂无容器成本数据" />
                ) : (
                  <Table
                    dataSource={containers}
                    columns={containerColumns}
                    rowKey="name"
                    size="small"
                    scroll={{ x: 1000 }}
                    footer={containerFooter}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 个容器` }}
                  />
                )}
              </Spin>
            ),
          },
          {
            key: 'vms',
            label: 'VM 成本',
            children: (
              <Spin spinning={loading}>
                {vms.length === 0 && !loading ? (
                  <Empty description="暂无 VM 成本数据" />
                ) : (
                  <Table
                    dataSource={vms}
                    columns={vmColumns}
                    rowKey="name"
                    size="small"
                    scroll={{ x: 800 }}
                    footer={vmFooter}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 台 VM` }}
                  />
                )}
              </Spin>
            ),
          },
          {
            key: 'recommendations',
            label: '优化建议',
            children: (
              <Spin spinning={loading}>
                <div className="space-y-6">
                  {/* 优化建议列表 */}
                  {recommendations.length === 0 && !loading ? (
                    <Empty description="暂无优化建议" />
                  ) : (
                    <div className="space-y-3">
                      {recommendations.map((rec) => (
                        <Card
                          key={rec.id}
                          size="small"
                          className={`border ${recommendationColors[rec.type] || 'border-slate-700'} bg-slate-800/30`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1">
                              {recommendationIcons[rec.type] || <AlertCircle size={28} className="text-slate-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="text-white font-medium text-sm">{rec.title}</h3>
                                <Tag color="green" className="text-xs">
                                  月省 ¥{rec.monthlySavings?.toFixed(2)}
                                </Tag>
                              </div>
                              <p className="text-slate-400 text-xs mt-1">{rec.description}</p>
                              <div className="mt-2">
                                <Button size="small" type="link" className="p-0 h-auto text-xs">查看详情</Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* 汇总卡片 */}
                  <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <DollarSign size={20} className="text-green-400" />
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">月度潜在节省总额</p>
                          <p className="text-2xl font-bold text-green-400">
                            ¥{recommendationsTotalSavings.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Tag color="green" className="text-xs">
                        共 {recommendations.length} 条优化建议
                      </Tag>
                    </div>
                  </Card>
                </div>
              </Spin>
            ),
          },
        ]} />
      </Card>
    </div>
  );
}
