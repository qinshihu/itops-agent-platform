import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { Card, Statistic, Row, Col, Table, Tag, Space, Typography, Descriptions, Badge as _Badge, Spin, Input, Select, Tooltip } from 'antd';
import {
  ApiOutlined, ToolOutlined, SafetyOutlined, CloudServerOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined,
  SearchOutlined, PlayCircleOutlined as _PlayCircleOutlined,
} from '@ant-design/icons';
import { fetchHealth, fetchManifest, fetchExternalStatus, callTool as _callTool } from '../api';
import type { McpHealth, McpTool, ExternalServer, ToolCallResult as _ToolCallResult } from '../api';

const { Title, Text, Paragraph: _Paragraph } = Typography;

const riskColorMap: Record<string, string> = {
  readonly: 'green',
  low: 'blue',
  medium: 'orange',
  high: 'red',
  destructive: '#ff4d4f',
};

const stateIconMap: Record<string, React.ReactNode> = {
  connected: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  connecting: <SyncOutlined spin style={{ color: '#1890ff' }} />,
  reconnecting: <SyncOutlined spin style={{ color: '#faad14' }} />,
  disconnected: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
};

const domainLabels: Record<string, string> = {
  alert_handling: '告警处理',
  server_operation: '服务器操作',
  network_inspection: '网络巡检',
  system_inspection: '系统巡检',
  change_execution: '变更执行',
  database_operation: '数据库操作',
  document_generation: '文档生成',
  compliance_check: '合规检查',
};

const McpOverview: React.FC = () => {
  const [health, setHealth] = useState<McpHealth | null>(null);
  const [manifest, setManifest] = useState<McpTool[]>([]);
  const [servers, setServers] = useState<ExternalServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toolSearch, setToolSearch] = useState('');
  const [toolDomainFilter, setToolDomainFilter] = useState<string | undefined>();
  const [toolRiskFilter, setToolRiskFilter] = useState<string | undefined>();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [h, m, s] = await Promise.all([
        fetchHealth(),
        fetchManifest(),
        fetchExternalStatus(),
      ]);
      setHealth(h);
      setManifest(m.tools || []);
      setServers(s.servers || []);
    } catch (err) {
      logger.error('加载 MCP 数据失败', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const toolsByDomain = manifest.reduce((acc, t) => {
    const domain = (t.annotations)?.domain || 'other';
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const domains = Array.from(new Set(manifest.map(t => (t.annotations)?.domain).filter((d): d is string => !!d)));

  const filteredTools = manifest.filter(t => {
    if (toolSearch) {
      const s = toolSearch.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s) && !(t.title || '').toLowerCase().includes(s)) return false;
    }
    if (toolDomainFilter && (t.annotations)?.domain !== toolDomainFilter) return false;
    if (toolRiskFilter && t.annotations?.riskLevel !== toolRiskFilter) return false;
    return true;
  });

  const externalConnected = servers.filter((s) => s.state === 'connected').length;
  const externalTools = servers.reduce((sum, s) => sum + s.tools, 0);

  const toolColumns = [
    {
      title: '工具名',
      dataIndex: 'name',
      key: 'name',
      width: 190,
      render: (name: string) => <Text code style={{ fontSize: 12 }}>{name}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (d: string) => <Tooltip title={d}><Text style={{ fontSize: 12 }}>{d}</Text></Tooltip>,
    },
    {
      title: '领域',
      key: 'domain',
      width: 100,
      render: (_: unknown, record: McpTool) => {
        const d = (record.annotations)?.domain;
        return d ? <Tag>{domainLabels[d] || d}</Tag> : '-';
      },
    },
    {
      title: '风险',
      key: 'risk',
      width: 70,
      render: (_: unknown, record: McpTool) => {
        const risk = record.annotations?.riskLevel || 'readonly';
        return <Tag color={riskColorMap[risk]}>{risk}</Tag>;
      },
    },
    {
      title: '只读',
      key: 'readOnly',
      width: 55,
      render: (_: unknown, record: McpTool) =>
        record.annotations?.readOnlyHint ? <Tag color="green">✓</Tag> : <Tag color="orange">✗</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>
        <ApiOutlined /> MCP 服务概览
      </Title>

      {/* 状态卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="MCP 服务状态"
              value={health?.status === 'healthy' ? '运行中' : '异常'}
              prefix={health?.status === 'healthy'
                ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              }
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {health?.protocol} · v{health?.server?.version}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={<><ToolOutlined /> 内置工具</>}
              value={manifest.length}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              分布在 {domains.length} 个领域
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={<><CloudServerOutlined /> 外部工具</>}
              value={externalTools}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {externalConnected}/{servers.length} 台外部服务器已连接
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={<><SafetyOutlined /> 安全模式</>}
              value="只读模式"
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              6 层安全防护已启用
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 服务信息 */}
      <Card title="MCP Server 信息" style={{ marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="服务器名称">{health?.server?.name}</Descriptions.Item>
          <Descriptions.Item label="协议版本">{health?.protocol}</Descriptions.Item>
          <Descriptions.Item label="运行时长">
            <ClockCircleOutlined /> {health?.uptime ? `${Math.floor(health.uptime / 60)} 分钟` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="内置工具">{manifest.length} 个可用</Descriptions.Item>
          <Descriptions.Item label="外部服务器">{servers.length} 台注册</Descriptions.Item>
          <Descriptions.Item label="总工具数">{manifest.length + externalTools}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 工具领域分布 + 外部服务器 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="工具领域分布" size="small">
            <Space wrap>
              {Object.entries(toolsByDomain).map(([domain, count]) => (
                <Tag key={domain} color="blue">{domainLabels[domain] || domain}: {count}</Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="外部 MCP 服务器" size="small">
            {servers.length === 0 ? (
              <Text type="secondary">暂无外部 MCP 服务器连接 — 可在"外部服务器"页面注册 stdio/sse 类型的 MCP Server</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {servers.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {stateIconMap[s.state]} <Text strong>{s.name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>({s.namespace}.*)</Text>
                    </span>
                    <span>
                      <Tag>{s.transport}</Tag>
                      <Tag color={s.state === 'connected' ? 'green' : 'default'}>
                        {s.tools} 个工具
                      </Tag>
                    </span>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* 内置工具列表 */}
      <Card
        title={<><ToolOutlined /> 内置 MCP 工具列表 ({filteredTools.length}/{manifest.length})</>}
        extra={
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索工具..."
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              style={{ width: 200 }}
              size="small"
              allowClear
            />
            <Select
              placeholder="领域筛选"
              value={toolDomainFilter}
              onChange={setToolDomainFilter}
              allowClear
              size="small"
              style={{ width: 130 }}
              options={domains.map(d => ({ label: domainLabels[d] || d, value: d }))}
            />
            <Select
              placeholder="风险筛选"
              value={toolRiskFilter}
              onChange={setToolRiskFilter}
              allowClear
              size="small"
              style={{ width: 100 }}
              options={[
                { label: '只读', value: 'readonly' },
                { label: '低风险', value: 'low' },
                { label: '中风险', value: 'medium' },
                { label: '高风险', value: 'high' },
              ]}
            />
          </Space>
        }
      >
        <Table
          dataSource={filteredTools}
          columns={toolColumns}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `共 ${total} 个工具` }}
        />
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          <Text style={{ fontSize: 12, color: '#52c41a' }}>
            💡 <strong>如何调用 MCP 工具：</strong>MCP 工具通过 JSON-RPC 2.0 协议调用。Agent 在执行任务时会自动选择并调用这些工具。详细测试和调用请前往
            <a href="/mcp/tools" style={{ marginLeft: 4 }}>"工具浏览器"</a> 或
            <a href="/mcp/tester" style={{ marginLeft: 4 }}>"工具调用测试"</a> 页面。
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default McpOverview;
