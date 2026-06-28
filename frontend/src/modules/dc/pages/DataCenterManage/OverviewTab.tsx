import { Card, Row, Col, Statistic, Spin, Empty } from 'antd';
import { Server, Monitor, Wifi, LayoutGrid, Plus, Thermometer, AlertTriangle, Clock } from 'lucide-react';
import type { OverviewData, Rack } from './types';

interface OverviewTabProps {
  overview: OverviewData | null;
  rooms: any[];
  racks: Rack[];
  rackAlertMap: Record<string, number>;
  onAddRoom: () => void;
  onSelectRack: (rack: Rack) => void;
}

export default function OverviewTab({
  overview, rooms, racks, rackAlertMap,
  onAddRoom, onSelectRack,
}: OverviewTabProps) {
  if (!overview) return <Spin className="flex justify-center py-20" />;

  // 空库状态
  if (overview.isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-6">
          <Server size={40} className="text-text-tertiary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">暂无数据中心资产</h3>
        <p className="text-sm text-text-secondary mb-6 text-center max-w-md">
          当前数据库中没有机房、机柜或设备数据。请手动添加真实资产开始使用。
        </p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors flex items-center gap-1.5"
          onClick={onAddRoom}
        >
          <Plus size={14} /> 手动添加机房
        </button>
      </div>
    );
  }

  const { summary, rackData } = overview;
  const roomsGrouped: Record<string, any[]> = {};
  (rackData || []).forEach((r: any) => {
    const roomKey = r.room_id || 'unknown';
    if (!roomsGrouped[roomKey]) roomsGrouped[roomKey] = [];
    roomsGrouped[roomKey].push(r);
  });

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[12, 12]} className="mb-6">
        <Col span={3}><Card size="small"><Statistic title="机房" value={summary?.totalRooms || 0} prefix={<Monitor size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="机柜" value={summary?.totalRacks || 0} prefix={<LayoutGrid size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="设备" value={summary?.totalDevices || 0} prefix={<Server size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="在线" value={summary?.onlineDevices || 0} valueStyle={{ color: '#52c41a' }} prefix={<Wifi size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="告警" value={summary?.alertDevices || 0} valueStyle={{ color: summary?.alertDevices ? '#ff4d4f' : undefined }} prefix={<AlertTriangle size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="离线" value={summary?.offlineDevices || 0} valueStyle={{ color: '#ff4d4f' }} prefix={<Clock size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="温度" value={summary?.avgTemp ? `${summary.avgTemp.toFixed(1)}°C` : 'N/A'} prefix={<Thermometer size={14} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="湿度" value={summary?.avgHumidity ? `${summary.avgHumidity.toFixed(1)}%` : 'N/A'} prefix={<Thermometer size={14} />} /></Card></Col>
      </Row>

      {/* 机柜热力图 */}
      <Card
        size="small"
        title={<span className="text-sm">机柜热力图 &nbsp;<span className="text-text-tertiary text-xs font-normal">颜色越深利用率越高</span></span>}
        className="mb-6"
      >
        {Object.keys(roomsGrouped).length === 0 ? (
          <Empty description="暂无机柜数据" className="py-8" />
        ) : (
          <div className="space-y-6">
            {Object.entries(roomsGrouped).map(([roomId, roomRacks]) => {
              const roomInfo = rooms.find((r) => r.id === roomId) || rooms.find((r) => r.label === roomId);
              return (
                <div key={roomId}>
                  <h4 className="text-sm font-semibold text-text-primary mb-2">
                    {roomInfo?.label || roomInfo?.name || roomId}
                  </h4>
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5">
                    {roomRacks.map((rack: any) => {
                      const totalU = rack.total_u || 42;
                      const usedU = rack.used_u || 0;
                      const util = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;
                      const alertCount = rackAlertMap[rack.id] || 0;

                      let bg = 'bg-gray-800';
                      if (util > 85) bg = 'bg-red-900/70';
                      else if (util > 70) bg = 'bg-orange-800/60';
                      else if (util > 40) bg = 'bg-yellow-800/40';
                      else if (util > 0) bg = 'bg-green-800/40';

                      return (
                        <div
                          key={rack.id}
                          className={`${bg} border border-gray-700/50 rounded cursor-pointer
                            hover:border-cyan-500/60 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)]
                            transition-all text-center py-1.5 px-1 relative group`}
                          onClick={() => onSelectRack(rack)}
                        >
                          <div className="text-[10px] text-text-secondary truncate" title={rack.name}>
                            {rack.name}
                          </div>
                          <div className="text-xs font-bold font-mono mt-0.5">{util}%</div>
                          <div className="text-[8px] text-text-tertiary">{usedU}/{totalU}U</div>
                          {alertCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-lg">
                              {alertCount}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 图例 */}
      <div className="flex items-center gap-3 text-[10px] text-text-tertiary px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-800 border border-gray-700" /> 空闲</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-800/40 border border-gray-700" /> &lt;40%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-800/40 border border-gray-700" /> 40-70%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-800/60 border border-gray-700" /> 70-85%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/70 border border-gray-700" /> &gt;85%</span>
      </div>
    </div>
  );
}
