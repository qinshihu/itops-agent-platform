import { Button, Input, Tag, Card, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Server, Monitor, Wifi, LayoutGrid, CuboidIcon as Cube,
  Search, Upload, Database, Clock, Cpu, ToggleLeft, ArrowUpDown,
} from 'lucide-react';
import useDataCenter from './useDataCenter';
import { useNetboxResources } from './useNetboxResources';
import OverviewTab from './OverviewTab';
import DevicesTab from './DevicesTab';
import SlotsPanel from './SlotsPanel';
import RoomManagement from './RoomManagement';
import RackManagement from './RackManagement';
import PDUManagement from './PDUManagement';
import LifecycleTab from './LifecycleTab';
import ExportImportTab from './ExportImportTab';
import SlotModals from './SlotModals';
import { ManufacturersTab, DeviceTypesTab, PowerPanelsTab, PowerFeedsTab, CablesTab } from './NetboxTabs';

export default function DataCenterManage() {
  const dc = useDataCenter();
  const nb = useNetboxResources(dc.rooms, dc.racks);
  const navigate = useNavigate();

  const handleAddRoom = () => {
    dc.setEditingRoom(null);
    dc.roomForm.resetFields();
    dc.setRoomModalOpen(true);
  };

  // ===== Tab 项配置 =====
  const tabItems = [
    {
      key: 'overview',
      label: <span><Monitor size={14} className="inline mr-1" />总览</span>,
      children: (
        <OverviewTab
          overview={dc.overview}
          rooms={dc.rooms}
          racks={dc.racks}
          rackAlertMap={dc.rackAlertMap}
          onAddRoom={handleAddRoom}
          onSelectRack={dc.selectRack}
        />
      ),
    },
    {
      key: 'devices',
      label: <span><Server size={14} className="inline mr-1" />设备分布</span>,
      children: (
        <DevicesTab
          groups={dc.deviceGroups}
          loading={dc.deviceGroupLoading}
          search={dc.deviceSearch}
          onSearchChange={dc.setDeviceSearch}
        />
      ),
    },
    {
      key: 'rooms',
      label: <span><Database size={14} className="inline mr-1" />机房</span>,
      children: <RoomManagement dc={dc} />,
    },
    {
      key: 'racks',
      label: <span><LayoutGrid size={14} className="inline mr-1" />机柜</span>,
      children: <RackManagement dc={dc} />,
    },
    {
      key: 'slots',
      label: <span><Cube size={14} className="inline mr-1" />U位</span>,
      children: (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <Card title="机柜列表" size="small"
              extra={<Input prefix={<Search size={12} />} placeholder="搜索..." size="small" style={{ width: 120 }} />}
            >
              <div className="space-y-1 max-h-[650px] overflow-y-auto">
                {dc.racks.map(r => {
                  const room = dc.rooms.find(rm => rm.id === r.room_id);
                  const ac = dc.rackAlertMap[r.id] || 0;
                  return (
                    <div key={r.id}
                      className={`px-3 py-2 rounded cursor-pointer text-sm flex items-center gap-2 transition-colors
                        ${dc.selectedRack?.id === r.id ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-gray-800 text-text-secondary border border-transparent'}`}
                      onClick={() => dc.selectRack(r)}>
                      <LayoutGrid size={14} />
                      <span>{r.name}</span>
                      {ac > 0 && <Tag color="red" className="ml-auto text-[10px]">{ac}</Tag>}
                      <Tag className="ml-auto text-xs">{room?.label || room?.name || '-'}</Tag>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div className="col-span-2">
            <SlotsPanel rack={dc.selectedRack} slots={dc.slots} onSelectSlot={dc.showDeviceActions} onAddDevice={() => { dc.setSlotModalOpen(true); }} />
          </div>
        </div>
      ),
    },
    {
      key: 'lifecycle',
      label: <span><Clock size={14} className="inline mr-1" />生命周期</span>,
      children: <LifecycleTab dc={dc} />,
    },
    {
      key: 'pdus',
      label: <span><ToggleLeft size={14} className="inline mr-1" />PDU/UPS</span>,
      children: <PDUManagement dc={dc} />,
    },
    {
      key: 'export',
      label: <span><Upload size={14} className="inline mr-1" />导入/导出</span>,
      children: <ExportImportTab dc={dc} />,
    },
    {
      key: 'manufacturers',
      label: <span><Database size={14} className="inline mr-1" />制造商</span>,
      children: <ManufacturersTab dc={nb} />,
    },
    {
      key: 'deviceTypes',
      label: <span><Cpu size={14} className="inline mr-1" />设备型号</span>,
      children: <DeviceTypesTab dc={nb} />,
    },
    {
      key: 'powerPanels',
      label: <span><ToggleLeft size={14} className="inline mr-1" />配电柜</span>,
      children: <PowerPanelsTab dc={nb} />,
    },
    {
      key: 'powerFeeds',
      label: <span><Wifi size={14} className="inline mr-1" />供电线路</span>,
      children: <PowerFeedsTab dc={nb} />,
    },
    {
      key: 'cables',
      label: <span><ArrowUpDown size={14} className="inline mr-1" />线缆管理</span>,
      children: <CablesTab dc={nb} />,
    },
  ];

  // ===== 操作按钮（在 Tabs 右侧） =====
  const extraButtons: Record<string, React.ReactNode> = {
    overview: (
      <Button type="primary" size="small" icon={<Plus size={14} />} onClick={handleAddRoom}>
        添加机房
      </Button>
    ),
    rooms: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setEditingRoom(null); dc.roomForm.resetFields(); dc.setRoomModalOpen(true); }}>
        添加机房
      </Button>
    ),
    racks: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setEditingRack(null); dc.rackForm.resetFields(); dc.setRackModalOpen(true); }}>
        添加机柜
      </Button>
    ),
    pdus: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setEditingPdu(null); dc.pduForm.resetFields(); dc.setPduModalOpen(true); }}>
        添加PDU/UPS
      </Button>
    ),
    manufacturers: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { nb.setEditingMfg(null); nb.mfgForm.resetFields(); nb.setMfgModalOpen(true); }}>
        添加制造商
      </Button>
    ),
    deviceTypes: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { nb.setEditingDt(null); nb.dtForm.resetFields(); nb.setDtModalOpen(true); }}>
        添加型号
      </Button>
    ),
    powerPanels: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { nb.setEditingPp(null); nb.ppForm.resetFields(); nb.setPpModalOpen(true); }}>
        添加配电柜
      </Button>
    ),
    powerFeeds: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { nb.setEditingPf(null); nb.pfForm.resetFields(); nb.setPfModalOpen(true); }}>
        添加供电线路
      </Button>
    ),
    cables: (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { nb.setEditingCable(null); nb.cableForm.resetFields(); nb.setCableModalOpen(true); }}>
        添加线缆
      </Button>
    ),
    devices: (
      <Button type="primary" size="small" icon={<Server size={14} />}
        onClick={() => navigate('/servers')}>
        管理服务器/设备
      </Button>
    ),
    slots: dc.selectedRack ? (
      <Button type="primary" size="small" icon={<Plus size={14} />}
        onClick={() => { dc.setSlotModalOpen(true); }}>
        分配设备
      </Button>
    ) : null,
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Server size={20} className="text-blue-400" />
          数据中心管理
        </h2>
        <div className="flex gap-2">
          {extraButtons[dc.activeTab]}
        </div>
      </div>

      <Tabs activeKey={dc.activeTab} onChange={dc.onTabChange} items={tabItems} className="dc-tabs" />

      <SlotModals dc={dc} />
    </div>
  );
}