import { Button, Modal, Form, Input, Select as _Select, Tag, Space, Popconfirm, Table, InputNumber } from 'antd';
import { Edit, Trash2, Search } from 'lucide-react';
import type useDataCenter from './useDataCenter';
import type { Room } from './types';

type DC = ReturnType<typeof useDataCenter>;

interface Props {
  dc: DC;
}

export default function RoomManagement({ dc }: Props) {
  const filteredRooms = dc.rooms.filter((r: Room) =>
    !dc.roomSearch ||
    r.name?.toLowerCase().includes(dc.roomSearch.toLowerCase()) ||
    r.label?.toLowerCase().includes(dc.roomSearch.toLowerCase())
  );

  const roomColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '标签', dataIndex: 'label', key: 'label', render: (v: string) => <Tag>{v}</Tag> },
    { title: '尺寸', key: 'size', render: (_: unknown, r: Room) => `${r.width_m || 20}m × ${r.depth_m || 15}m` },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
    {
      title: '操作', key: 'action', render: (_: unknown, rec: Room) => (
        <Space>
          <Button type="link" size="small" icon={<Edit size={14} />}
            onClick={() => { dc.setEditingRoom(rec); dc.roomForm.setFieldsValue(rec); dc.setRoomModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => dc.deleteRoom(rec.id)}>
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <>
      <div>
        <Input
          prefix={<Search size={14} className="text-text-tertiary" />}
          placeholder="搜索机房名称/标签..."
          className="mb-4 max-w-xs"
          value={dc.roomSearch}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => dc.setRoomSearch(e.target.value)}
          allowClear
        />
        <Table columns={roomColumns} dataSource={filteredRooms.map((r: Room) => ({ ...r, key: r.id }))} loading={dc.loading} pagination={false} />
      </div>

      <Modal
        title={dc.editingRoom ? '编辑机房' : '添加机房'}
        open={dc.roomModalOpen}
        onOk={dc.saveRoom}
        onCancel={() => { dc.setRoomModalOpen(false); dc.setEditingRoom(null); dc.roomForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={dc.roomForm} layout="vertical" size="small">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入机房名称' }]}>
            <Input placeholder="如：A栋-2层" />
          </Form.Item>
          <Form.Item name="label" label="标签">
            <Input placeholder="可选别名" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>
          <Space className="w-full" style={{ display: 'flex' }}>
            <Form.Item name="width_m" label="宽度(m)"><InputNumber min={1} step={1} /></Form.Item>
            <Form.Item name="depth_m" label="深度(m)"><InputNumber min={1} step={1} /></Form.Item>
            <Form.Item name="sort_order" label="排序"><InputNumber min={0} step={1} /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}