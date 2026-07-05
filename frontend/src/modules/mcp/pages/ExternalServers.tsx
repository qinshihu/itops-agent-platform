import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  Card, Table, Tag, Button, Space, Typography, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm, Descriptions as _Descriptions, Spin as _Spin,
} from 'antd';
import {
  PlusOutlined, CloudServerOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ReloadOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import {
  fetchExternalStatus, registerExternalServer, startExternalServer,
  startAllExternalServers, stopExternalServer, unregisterExternalServer,
  type ExternalServer, type ExternalServerConfig,
} from '../api';

const { Title, Text } = Typography;

const stateIconMap: Record<string, React.ReactNode> = {
  connected: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  connecting: <SyncOutlined spin style={{ color: '#1890ff' }} />,
  reconnecting: <SyncOutlined spin style={{ color: '#faad14' }} />,
  disconnected: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
};

const stateLabelMap: Record<string, string> = {
  connected: '已连接',
  connecting: '连接中',
  reconnecting: '重连中',
  disconnected: '未连接',
  error: '错误',
};

const ExternalServers: React.FC = () => {
  const [servers, setServers] = useState<ExternalServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    setLoading(true);
    try {
      const s = await fetchExternalStatus();
      setServers(s.servers || []);
    } catch (err) {
      logger.error('加载外部服务器失败', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(id: string) {
    try {
      await startExternalServer(id);
      message.success('启动成功');
      loadServers();
    } catch (err: unknown) {
      message.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || '启动失败');
    }
  }

  async function handleStartAll() {
    try {
      const result = await startAllExternalServers();
      const ok = result.results.filter((r) => r.success).length;
      message.success(`${ok}/${result.results.length} 台服务器启动成功`);
      loadServers();
    } catch {
      message.error('启动失败');
    }
  }

  async function handleStop(id: string) {
    try {
      await stopExternalServer(id);
      message.success('已停止');
      loadServers();
    } catch {
      message.error('停止失败');
    }
  }

  async function handleDelete(id: string) {
    try {
      await unregisterExternalServer(id);
      message.success('已注销');
      loadServers();
    } catch {
      message.error('注销失败');
    }
  }

  async function handleAdd() {
    try {
      const values = await form.validateFields();
      setAddLoading(true);
      const config: ExternalServerConfig = {
        id: values.id,
        name: values.name,
        transport: values.transport,
        namespace: values.namespace,
        description: values.description,
        autoReconnect: values.autoReconnect ?? true,
        maxReconnectAttempts: values.maxReconnectAttempts ?? 5,
        reconnectIntervalMs: values.reconnectIntervalMs ?? 3000,
      };
      if (values.transport === 'sse') {
        config.sse = { url: values.sseUrl };
        if (values.authHeader) {
          config.sse.headers = { Authorization: values.authHeader };
        }
      } else {
        config.stdio = {
          command: values.command,
          args: values.args ? values.args.split(' ').filter(Boolean) : [],
        };
      }
      await registerExternalServer(config);
      message.success('注册成功');
      setAddOpen(false);
      form.resetFields();
      loadServers();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('注册失败');
    } finally {
      setAddLoading(false);
    }
  }

  const columns = [
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 80,
      render: (state: string) => (
        <Space>
          {stateIconMap[state]}
          <Text>{stateLabelMap[state]}</Text>
        </Space>
      ),
    },
    { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
    { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      width: 100,
      render: (ns: string) => <Tag>{ns}.*</Tag>,
    },
    {
      title: '传输',
      dataIndex: 'transport',
      key: 'transport',
      width: 70,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: '工具数',
      dataIndex: 'tools',
      key: 'tools',
      width: 70,
      render: (n: number) => <Tag color="blue">{n}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: ExternalServer) => (
        <Space size="small">
          {record.state === 'connected' ? (
            <Popconfirm title="确定停止此服务器?" onConfirm={() => handleStop(record.id)}>
              <Button size="small" icon={<PauseCircleOutlined />}>停止</Button>
            </Popconfirm>
          ) : (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStart(record.id)}>
              启动
            </Button>
          )}
          <Popconfirm title="确定注销此服务器? 其工具将被移除。" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><CloudServerOutlined /> 外部 MCP 服务器</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            注册服务器
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={handleStartAll}>
            启动所有
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadServers}>
            刷新
          </Button>
        </Space>
      </Card>

      <Table
        dataSource={servers}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无外部 MCP 服务器。点击"注册服务器"添加。' }}
      />

      <Modal
        title="注册外部 MCP 服务器"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleAdd}
        confirmLoading={addLoading}
        okText="注册"
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ transport: 'sse', autoReconnect: true, maxReconnectAttempts: 5, reconnectIntervalMs: 3000 }}>
          <Form.Item name="id" label="唯一标识" rules={[{ required: true }]}>
            <Input placeholder="e.g. filesystem, keep, grafana" />
          </Form.Item>
          <Form.Item name="name" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="e.g. Filesystem MCP" />
          </Form.Item>
          <Form.Item name="namespace" label="命名空间" rules={[{ required: true }]}>
            <Input placeholder="e.g. fs, keep, gfn" />
          </Form.Item>
          <Form.Item name="transport" label="传输方式" rules={[{ required: true }]}>
            <Select options={[
              { label: 'SSE (HTTP 远程)', value: 'sse' },
              { label: 'stdio (本地进程)', value: 'stdio' },
            ]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.transport !== cur.transport}>
            {({ getFieldValue }) =>
              getFieldValue('transport') === 'sse' ? (
                <>
                  <Form.Item name="sseUrl" label="SSE 端点 URL" rules={[{ required: true }]}>
                    <Input placeholder="http://localhost:8080/api/mcp/sse" />
                  </Form.Item>
                  <Form.Item name="authHeader" label="授权头 (可选)">
                    <Input placeholder="Bearer YOUR_TOKEN" />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item name="command" label="命令" rules={[{ required: true }]}>
                    <Input placeholder="npx" />
                  </Form.Item>
                  <Form.Item name="args" label="参数 (空格分隔)">
                    <Input placeholder="-y @modelcontextprotocol/server-filesystem /tmp" />
                  </Form.Item>
                </>
              )
            }
          </Form.Item>
          <Form.Item name="autoReconnect" label="自动重连" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="maxReconnectAttempts" label="最大重连次数">
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item name="reconnectIntervalMs" label="重连间隔 (ms)">
            <InputNumber min={1000} max={60000} step={1000} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExternalServers;