import { useState, useEffect, useRef, useCallback } from 'react';
import { Table, Button, Tag, Card, Statistic, Row, Col, Drawer, Descriptions, Progress, message, Switch, Space, Tooltip } from 'antd';
import { Play, Square, Eye, Activity, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';
import io, { Socket } from 'socket.io-client';

interface ContainerStats {
  containerId: string;
  name: string;
  cpuPercent: string;
  memory: { usage: number; limit: number; percent: string };
  network?: { rx_bytes: number; tx_bytes: number };
  pids: number;
  timestamp: string;
}

interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  host?: string;
  container_id?: string;
}

interface ClusterSnapshot {
  totalContainers: number;
  runningContainers: number;
  totalCpuPercent: string;
  totalMemoryUsage: number;
  totalMemoryLimit: number;
  totalMemoryPercent: string;
}

const statusColors: Record<string, string> = {
  running: 'green', stopped: 'red', paused: 'orange', exited: 'default', restarting: 'blue',
};

export default function ContainerMonitor() {
  const [data, setData] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [clusterStats, setClusterStats] = useState<ClusterSnapshot>({
    totalContainers: 0, runningContainers: 0, totalCpuPercent: '0',
    totalMemoryUsage: 0, totalMemoryLimit: 0, totalMemoryPercent: '0',
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<Container | null>(null);
  const [detailInspect, setDetailInspect] = useState<any>(null);
  const [monitoredIds, setMonitoredIds] = useState<Set<string>>(new Set());
  const [containerStatsMap, setContainerStatsMap] = useState<Map<string, ContainerStats>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.io
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('container:stats', (stats: ContainerStats) => {
      setContainerStatsMap(prev => new Map(prev).set(stats.containerId, stats));
    });

    return () => { socket.disconnect(); };
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [containerRes, snapRes] = await Promise.all([
        api.get('/api/containers'),
        api.get('/api/docker-monitor/cluster-snapshot'),
      ]);
      setData(containerRes.data.data || []);
      setClusterStats(snapRes.data.data || {
        totalContainers: 0, runningContainers: 0, totalCpuPercent: '0',
        totalMemoryUsage: 0, totalMemoryLimit: 0, totalMemoryPercent: '0',
      });
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Toggle monitoring
  const toggleMonitor = async (containerId: string, start: boolean) => {
    try {
      await api.post(`/api/docker-monitor/${start ? 'start' : 'stop'}/${containerId}`);
      if (start) {
        socketRef.current?.emit('container:subscribe', { containerId });
        setMonitoredIds(prev => new Set(prev).add(containerId));
      } else {
        socketRef.current?.emit('container:unsubscribe', { containerId });
        setMonitoredIds(prev => { const next = new Set(prev); next.delete(containerId); return next; });
      }
      message.success(start ? '已开始监控' : '已停止监控');
    } catch {
      message.error('操作失败');
    }
  };

  // View detail
  const viewDetail = async (item: Container) => {
    setDetailItem(item);
    setDetailInspect(null);
    setDetailVisible(true);
    try {
      const res = await api.get(`/api/containers/${item.id}`);
      setDetailInspect(res.data.data || res.data);
    } catch {
      // inspect may not be available
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatNetworkBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const columns = [
    {
      title: '容器名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Container) => (
        <Tooltip title={record.container_id}>
          <span className="font-medium">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '镜像',
      dataIndex: 'image',
      key: 'image',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'CPU',
      key: 'cpu',
      width: 180,
      render: (_: any, record: Container) => {
        const stats = containerStatsMap.get(record.id);
        const cpu = parseFloat(stats?.cpuPercent || '0');
        return (
          <Progress
            percent={Math.min(cpu, 100)}
            size="small"
            format={(p) => `${(p || 0).toFixed(1)}%`}
            status={cpu > 90 ? 'exception' : cpu > 70 ? 'active' : 'normal'}
          />
        );
      },
    },
    {
      title: '内存',
      key: 'memory',
      width: 200,
      render: (_: any, record: Container) => {
        const stats = containerStatsMap.get(record.id);
        const mem = stats?.memory;
        const percent = parseFloat(mem?.percent || '0');
        return (
          <Progress
            percent={Math.min(percent, 100)}
            size="small"
            format={() => {
              if (!mem) return '-';
              return `${formatBytes(mem.usage)} / ${formatBytes(mem.limit)} (${percent.toFixed(1)}%)`;
            }}
            status={percent > 90 ? 'exception' : percent > 70 ? 'active' : 'normal'}
          />
        );
      },
    },
    {
      title: '网络 I/O',
      key: 'network',
      width: 160,
      render: (_: any, record: Container) => {
        const stats = containerStatsMap.get(record.id);
        const net = stats?.network;
        if (!net) return <span className="text-gray-400">-</span>;
        return (
          <span className="text-xs">
            <span className="text-blue-400">↓ {formatNetworkBytes(net.rx_bytes)}</span>
            {' / '}
            <span className="text-green-400">↑ {formatNetworkBytes(net.tx_bytes)}</span>
          </span>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: any, record: Container) => {
        const isMonitoring = monitoredIds.has(record.id);
        return (
          <Space size="small">
            {isMonitoring ? (
              <Button
                size="small"
                danger
                icon={<Square className="w-3 h-3" />}
                onClick={() => toggleMonitor(record.id, false)}
              >
                停止监控
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                ghost
                icon={<Play className="w-3 h-3" />}
                onClick={() => toggleMonitor(record.id, true)}
                disabled={record.status !== 'running'}
              >
                开始监控
              </Button>
            )}
            <Button
              size="small"
              icon={<Eye className="w-3 h-3" />}
              onClick={() => viewDetail(record)}
            >
              详情
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">容器实时监控</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">实时监控容器运行状态、CPU、内存与网络资源</p>
        </div>
        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Cluster Overview Cards */}
      <Row gutter={16} className="mb-6">
        <Col xs={12} sm={6} lg={4}>
          <Card hoverable>
            <Statistic title="容器总数" value={clusterStats.totalContainers} prefix={<Activity className="w-4 h-4 text-blue-500" />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card hoverable>
            <Statistic title="运行中" value={clusterStats.runningContainers} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card hoverable>
            <Statistic
              title="总 CPU 使用率"
              value={parseFloat(clusterStats.totalCpuPercent)}
              suffix="%"
              precision={1}
              valueStyle={{ color: parseFloat(clusterStats.totalCpuPercent) > 90 ? '#ff4d4f' : parseFloat(clusterStats.totalCpuPercent) > 70 ? '#faad14' : '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card hoverable>
            <Statistic
              title="总内存使用"
              value={clusterStats.totalMemoryUsage}
              formatter={(val) => {
                const v = Number(val);
                return formatBytes(v);
              }}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card hoverable>
            <Statistic
              title="总内存限制"
              value={clusterStats.totalMemoryLimit}
              formatter={(val) => {
                const v = Number(val);
                return formatBytes(v);
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card hoverable>
            <Statistic
              title="总内存使用率"
              value={parseFloat(clusterStats.totalMemoryPercent)}
              suffix="%"
              precision={1}
              valueStyle={{ color: parseFloat(clusterStats.totalMemoryPercent) > 90 ? '#ff4d4f' : parseFloat(clusterStats.totalMemoryPercent) > 70 ? '#faad14' : '#3b82f6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Container Table */}
      <Card title="容器列表" className="shadow-sm">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `共 ${total} 个容器` }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title="容器详情"
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setDetailInspect(null); }}
        width={640}
        destroyOnClose
      >
        {detailItem && (
          <div className="space-y-4">
            <Descriptions title="基本信息" column={2} bordered size="small">
              <Descriptions.Item label="容器名">{detailItem.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[detailItem.status] || 'default'}>{detailItem.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="镜像" span={2}>{detailItem.image}</Descriptions.Item>
              <Descriptions.Item label="容器ID" span={2}>
                <code className="text-xs">{detailItem.container_id}</code>
              </Descriptions.Item>
              {detailItem.host && (
                <Descriptions.Item label="宿主机">{detailItem.host}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Real-time stats */}
            {containerStatsMap.has(detailItem.id) && (
              <Descriptions title="实时统计" column={2} bordered size="small">
                <Descriptions.Item label="CPU 使用率">
                  {containerStatsMap.get(detailItem.id)?.cpuPercent}%
                </Descriptions.Item>
                <Descriptions.Item label="PID 数">
                  {containerStatsMap.get(detailItem.id)?.pids}
                </Descriptions.Item>
                <Descriptions.Item label="内存使用">
                  {(() => {
                    const m = containerStatsMap.get(detailItem.id)?.memory;
                    return m ? `${formatBytes(m.usage)} / ${formatBytes(m.limit)}` : '-';
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="内存使用率">
                  {containerStatsMap.get(detailItem.id)?.memory?.percent}%
                </Descriptions.Item>
                <Descriptions.Item label="网络接收">
                  {formatNetworkBytes(containerStatsMap.get(detailItem.id)?.network?.rx_bytes || 0)}
                </Descriptions.Item>
                <Descriptions.Item label="网络发送">
                  {formatNetworkBytes(containerStatsMap.get(detailItem.id)?.network?.tx_bytes || 0)}
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* Inspect data */}
            {detailInspect && (
              <Descriptions title="详细检查 (Inspect)" column={1} bordered size="small">
                {Object.entries(detailInspect).slice(0, 20).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {typeof value === 'object' ? (
                      <pre className="text-xs max-h-40 overflow-auto bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      String(value)
                    )}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
