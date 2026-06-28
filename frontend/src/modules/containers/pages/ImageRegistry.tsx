/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Card, Button, Modal, Tag, Space, message, Form, Input, Select, Popconfirm, Row, Col, Table, Typography, Empty } from 'antd';
import { Plus, Trash2, RefreshCw, Wifi, Package, ExternalLink } from 'lucide-react';
import api from '../../../lib/api';

const registryTypeLabels: Record<string, { label: string; color: string }> = {
  harbor: { label: 'Harbor', color: 'blue' },
  dockerhub: { label: 'DockerHub', color: 'volcano' },
  acr: { label: 'ACR', color: 'purple' },
  generic: { label: 'Generic', color: 'default' },
};

interface Registry {
  id: string;
  name: string;
  type: string;
  url?: string;
  username?: string;
  status?: string;
}

interface RegistryImage {
  project?: string;
  repository?: string;
  tag?: string;
  size?: string;
  pushed_at?: string;
  pull_count?: number;
  vulnerabilities?: number;
}

export default function ImageRegistry() {
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Registry | null>(null);
  const [form] = Form.useForm();
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRegistry, setCurrentRegistry] = useState<Registry | null>(null);
  const [images, setImages] = useState<RegistryImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/registries');
      setRegistries(res.data.data || []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/api/registries/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/api/registries', values);
        message.success('添加成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/registries/${id}`); message.success('删除成功'); fetchData(); } catch { message.error('删除失败'); }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      await api.post(`/api/registries/${id}/test`);
      message.success('连接测试成功');
    } catch { message.error('连接测试失败'); }
    finally { setTestingId(null); }
  };

  const openDetail = async (registry: Registry) => {
    setCurrentRegistry(registry);
    setDetailVisible(true);
    setImagesLoading(true);
    try {
      const res = await api.get(`/api/registries/${registry.id}/images`);
      setImages(res.data.data || []);
    } catch { message.error('获取镜像列表失败'); setImages([]); }
    finally { setImagesLoading(false); }
  };

  const imageColumns = [
    { title: '项目', dataIndex: 'project', key: 'project' },
    { title: '仓库', dataIndex: 'repository', key: 'repository', ellipsis: true },
    { title: '标签', dataIndex: 'tag', key: 'tag', render: (t: string) => <Tag>{t}</Tag> },
    { title: '大小', dataIndex: 'size', key: 'size' },
    { title: '推送时间', dataIndex: 'pushed_at', key: 'pushed_at' },
    { title: '拉取次数', dataIndex: 'pull_count', key: 'pull_count' },
    {
      title: '漏洞数', dataIndex: 'vulnerabilities', key: 'vulnerabilities',
      render: (v: number) => {
        if (v === undefined || v === null) return <Tag>未扫描</Tag>;
        if (v === 0) return <Tag color="green">0</Tag>;
        if (v <= 3) return <Tag color="orange">{v}</Tag>;
        return <Tag color="red">{v}</Tag>;
      },
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Button icon={<RefreshCw size={14} />} onClick={fetchData}>刷新</Button>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>添加仓库</Button>
      </div>

      {registries.length === 0 && !loading ? (
        <Empty description="暂无镜像仓库" />
      ) : (
        <Row gutter={[16, 16]}>
          {registries.map((reg) => {
            const typeInfo = registryTypeLabels[reg.type] || { label: reg.type, color: 'default' };
            return (
              <Col key={reg.id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => openDetail(reg)}
                  actions={[
                    <Button type="link" size="small" icon={<Wifi size={14} />} loading={testingId === reg.id} onClick={(e) => { e.stopPropagation(); handleTestConnection(reg.id); }}>测试连接</Button>,
                    <Popconfirm key="del" title="确定删除?" onConfirm={(e) => { e?.stopPropagation(); handleDelete(reg.id); }} onCancel={(e) => { e?.stopPropagation(); }}>
                      <Button type="link" size="small" danger icon={<Trash2 size={14} />} onClick={(e) => e.stopPropagation()}>删除</Button>
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    avatar={<Package size={28} className="text-blue-500" />}
                    title={<span className="text-base">{reg.name}</span>}
                    description={
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex items-center gap-2">
                          <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                          <Tag color={reg.status === 'connected' ? 'green' : 'default'}>{reg.status || 'unknown'}</Tag>
                        </div>
                        {reg.url && (
                          <Typography.Text type="secondary" ellipsis className="text-xs">
                            <ExternalLink size={10} className="inline mr-1" />{reg.url}
                          </Typography.Text>
                        )}
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal title="添加仓库" open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} width={480}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select placeholder="选择仓库类型">
              <Select.Option value="harbor">Harbor</Select.Option>
              <Select.Option value="dockerhub">DockerHub</Select.Option>
              <Select.Option value="acr">ACR</Select.Option>
              <Select.Option value="generic">Generic</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="url" label="URL"><Input placeholder="https://registry.example.com" /></Form.Item>
          <Form.Item name="username" label="用户名"><Input /></Form.Item>
          <Form.Item name="password" label="密码"><Input.Password /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${currentRegistry?.name || ''} - 镜像列表`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
      >
        {currentRegistry && (
          <div className="mb-3 flex items-center gap-2">
            <Tag color={registryTypeLabels[currentRegistry.type]?.color}>{registryTypeLabels[currentRegistry.type]?.label || currentRegistry.type}</Tag>
            {currentRegistry.url && <Typography.Text type="secondary" className="text-sm">{currentRegistry.url}</Typography.Text>}
          </div>
        )}
        <Table columns={imageColumns} dataSource={images} rowKey={(r: RegistryImage) => `${r.project}-${r.repository}-${r.tag}`} loading={imagesLoading} pagination={false} size="small" />
      </Modal>
    </div>
  );
}
