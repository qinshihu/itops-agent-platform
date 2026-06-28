import { useEffect, useState, useCallback, useMemo } from 'react';
import useDataRoom from './useDataRoom';
import Scene from './Scene';
import DashboardOverlay from './DashboardOverlay';
import BottomStatsBar from './BottomStatsBar';
import AlertPanel from './AlertPanel';
import SlotDetailPanel from './SlotDetailPanel';
import LoadingScreen from './LoadingScreen';
import api from '../../../../lib/api';
import type { CableData } from './types';

export default function DataRoom3D() {
  const {
    loading,
    racks,
    overview,
    isReal,
    alerts,
    alertsList,
    selectedRack,
    rackSlots,
    rackSlotsMap,
    slotDetailOpen,
    startTime,
    fetchRackSlots,
    setSelectedRack,
    setSlotDetailOpen,
  } = useDataRoom();

  // 线缆拓扑数据
  const [cables, setCables] = useState<CableData[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/dc/cables/scene')
      .then(res => {
        if (cancelled) return;
        setCables((res.data?.data || []) as CableData[]);
      })
      .catch(() => { if (!cancelled) setCables([]); });
    return () => { cancelled = true; };
  }, []);

  // 时钟
  const [timeStr, setTimeStr] = useState('');
  const [uptime, setUptime] = useState('已运行: 0天0小时0分');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const wd = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
      setTimeStr(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 周${wd} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const d = Math.floor(elapsed / 86400);
      const h = Math.floor((elapsed % 86400) / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      setUptime(`已运行: ${d}天${h}小时${m}分`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // === Hover 状态 ===
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);

  // === 搜索 ===
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRacks = useMemo(() => {
    if (!searchQuery.trim()) return racks;
    const q = searchQuery.toLowerCase();
    return racks.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.roomName.toLowerCase().includes(q) ||
        r.roomLabel.toLowerCase().includes(q)
    );
  }, [racks, searchQuery]);

  // 搜索到的机柜置顶高亮（通过 selectedRackId 传递给 Scene）
  const searchHighlightId = useMemo(() => {
    if (!searchQuery.trim() || filteredRacks.length !== 1) return null;
    return filteredRacks[0].id;
  }, [searchQuery, filteredRacks]);

  // 点击机柜 → 加载槽位详情并弹窗
  const handleRackClick = useCallback(
    async (rackId: string) => {
      const rack = racks.find((r) => r.id === rackId);
      if (!rack) return;
      setSelectedRack(rack);
      await fetchRackSlots(rackId);
      setSlotDetailOpen(true);
    },
    [racks, fetchRackSlots, setSelectedRack, setSlotDetailOpen]
  );

  if (loading) return <LoadingScreen />;

  // 热力图数据: 基于机柜利用率 (usedU / totalU) 归一化到 0~1
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of racks) {
      if (r.totalU > 0) {
        map[r.id] = Math.min(1, Math.max(0, r.usedU / r.totalU));
      }
    }
    return map;
  }, [racks]);

  return (
    <div className="relative w-full h-full bg-[#0d1825] overflow-hidden">
      {/* Three.js 3D 场景 */}
      <Scene
        racks={filteredRacks}
        rackSlotsMap={rackSlotsMap}
        onRackClick={handleRackClick}
        selectedRackId={selectedRack?.id || searchHighlightId}
        hoveredRackId={hoveredRackId}
        searchQuery={searchQuery}
        heatmapData={heatmapData}
        heatmapMode="utilization"
        onHoverChange={setHoveredRackId}
        cables={cables}
      />

      {/* 搜索框 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜索机柜名称/机房..."
          className="w-[260px] px-3 py-1.5 text-xs bg-[#0a1420]/85 backdrop-blur-md
                     border border-cyan-500/20 rounded-lg text-cyan-300
                     placeholder:text-slate-500 outline-none
                     focus:border-cyan-400/50 transition-colors"
        />
      </div>

      {/* 数据源标识 + 时间 */}
      <DashboardOverlay
        overview={overview}
        timeStr={timeStr}
        uptime={uptime}
        isReal={isReal}
      />

      {/* 告警面板 */}
      <AlertPanel alerts={alerts} />

      {/* 机柜详情弹窗 */}
      {slotDetailOpen && selectedRack && (
        <SlotDetailPanel
          rack={selectedRack}
          slots={rackSlots}
          onClose={() => {
            setSlotDetailOpen(false);
            setSelectedRack(null);
          }}
        />
      )}

      {/* 底部指标条 */}
      <BottomStatsBar overview={overview} />
    </div>
  );
}
