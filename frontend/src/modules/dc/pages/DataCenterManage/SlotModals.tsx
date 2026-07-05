import { Button, Modal, Form, Input as _Input, Select, Tag, Popconfirm, InputNumber } from 'antd';
import { ArrowUpDown, Trash2 } from 'lucide-react';
import type useDataCenter from './useDataCenter';
import { deviceTypeColors } from './types';
import type { DeviceSummary } from './types';

type DC = ReturnType<typeof useDataCenter>;

interface Props {
  dc: DC;
}

export default function SlotModals({ dc }: Props) {
  return (
    <>
      {/* 分配 U 位 Modal */}
      <Modal
        title={`分配设备 - ${dc.selectedRack?.name || ''}`}
        open={dc.slotModalOpen}
        onOk={dc.assignSlot}
        onCancel={() => { dc.setSlotModalOpen(false); dc.slotForm.resetFields(); }}
        okText="分配"
        cancelText="取消"
        afterOpenChange={(open) => { if (open) dc.fetchAvailDevices(); }}
      >
        <Form form={dc.slotForm} layout="vertical" size="small">
          <Form.Item name="device_id" label="选择设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select placeholder="选择要分配到该机柜的设备..." showSearch filterOption={(input, option) =>
              (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
            }>
              {dc.availDevices.map((d: DeviceSummary) => (
                <Select.Option key={d.id} value={d.id}
                  label={`${d.name || d.device_name || '未命名'} (${d.device_type || '?'})`}>
                  <div className="flex justify-between">
                    <span>{d.name || d.device_name || '未命名'}</span>
                    <Tag color={deviceTypeColors[d.device_type || ''] || 'default'} className="text-[10px]">
                      {d.device_type}
                    </Tag>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="start_u" label="起始U位" rules={[{ required: true, message: '请输入起始U位' }]}>
            <InputNumber min={1} max={dc.selectedRack?.total_u || 42} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="end_u" label="结束U位" rules={[{ required: true, message: '请输入结束U位' }]}>
            <InputNumber min={1} max={dc.selectedRack?.total_u || 42} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="position_face" label="朝向" initialValue="front">
            <Select>
              <Select.Option value="front">正面</Select.Option>
              <Select.Option value="rear">背面</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 设备操作 Modal（下架/移位） */}
      <Modal
        title="设备操作"
        open={dc.deviceActionModal}
        onCancel={() => { dc.setDeviceActionModal(false); dc.setSelectedSlot(null); }}
        footer={[
          <Button key="move" icon={<ArrowUpDown size={14} />} onClick={() => {
            dc.setDeviceActionModal(false);
            dc.moveForm.resetFields();
            dc.moveForm.setFieldsValue({
              rack_id: dc.selectedSlot?.rack_id,
              start_u: dc.selectedSlot?.start_u,
              end_u: dc.selectedSlot?.end_u,
              position_face: dc.selectedSlot?.position_face || 'front',
            });
            dc.setMoveModalOpen(true);
          }}>
            移位
          </Button>,
          <Popconfirm key="remove" title="确认下架该设备?" onConfirm={dc.confirmRemoveSlot}>
            <Button danger icon={<Trash2 size={14} />}>下架</Button>
          </Popconfirm>,
          <Button key="cancel" onClick={() => { dc.setDeviceActionModal(false); dc.setSelectedSlot(null); }}>取消</Button>,
        ]}
      >
        {dc.selectedSlot && (
          <div className="text-sm space-y-2">
            <p><span className="text-text-secondary">设备:</span> {dc.selectedSlot.device_name || '(未命名)'}</p>
            <p><span className="text-text-secondary">类型:</span> {dc.selectedSlot.device_type}</p>
            <p><span className="text-text-secondary">U位:</span> U{dc.selectedSlot.start_u}-U{dc.selectedSlot.end_u}</p>
            {dc.selectedSlot.ip_address && (
              <p><span className="text-text-secondary">IP:</span> {dc.selectedSlot.ip_address}</p>
            )}
          </div>
        )}
      </Modal>

      {/* 移位 Modal */}
      <Modal
        title="设备移位"
        open={dc.moveModalOpen}
        onOk={dc.handleMove}
        onCancel={() => { dc.setMoveModalOpen(false); dc.moveForm.resetFields(); dc.setSelectedSlot(null); }}
        okText="确认移位"
        cancelText="取消"
      >
        <Form form={dc.moveForm} layout="vertical" size="small">
          <Form.Item name="rack_id" label="目标机柜" rules={[{ required: true, message: '请选择机柜' }]}>
            <Select placeholder="选择目标机柜..." showSearch filterOption={(input, option) =>
              (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
            }>
              {dc.racks.map(r => (
                <Select.Option key={r.id} value={r.id}
                  label={`${r.room_label || r.room_name || ''} - ${r.name}`}>
                  {r.room_label || r.room_name || ''} - {r.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="start_u" label="起始U位" rules={[{ required: true, message: '请输入起始U位' }]}>
            <InputNumber min={1} max={100} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="end_u" label="结束U位" rules={[{ required: true, message: '请输入结束U位' }]}>
            <InputNumber min={1} max={100} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="position_face" label="朝向" initialValue="front">
            <Select><Select.Option value="front">正面</Select.Option><Select.Option value="rear">背面</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}