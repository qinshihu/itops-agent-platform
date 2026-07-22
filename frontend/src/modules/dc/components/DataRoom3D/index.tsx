import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Scene from './Scene';
import type { ViewMode } from './Scene';
import DashboardOverlay from './DashboardOverlay';
import SlotDetailPanel from './SlotDetailPanel';
import useDataRoom from './useDataRoom';

export default function DataRoom3D() {
  const navigate = useNavigate();
  const {
    loading,
    racks,
    overview,
    isReal,
    alerts,
    selectedRack,
    rackSlots,
    slotDetailOpen,
    startTime,
    fetchRackSlots,
    setSelectedRack,
    setSlotDetailOpen,
  } = useDataRoom();

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      setTimeStr(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 星期${days[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const uptime = useMemo(() => {
    const totalSec = Math.floor((Date.now() - startTime) / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${days}天${hours}小时${mins}分`;
  }, [startTime, timeStr]);

  // 按视图模式过滤机柜（注意：Scene 内部按数组顺序算 col/row，过滤后位置会重排，因此 zoneA/zoneB 不再做区域过滤，由相机视角区分区域）
  const filteredRacks = useMemo(() => {
    let result = racks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.roomName?.toLowerCase().includes(q));
    }
    return result;
  }, [racks, searchQuery]);

  const handleRackClick = useCallback((rackId: string) => {
    const rack = racks.find(r => r.id === rackId);
    if (rack) {
      setSelectedRack(rack);
      setSlotDetailOpen(true);
      fetchRackSlots(rackId);
    }
  }, [racks, setSelectedRack, setSlotDetailOpen, fetchRackSlots]);

  const handleHoverChange = useCallback((rackId: string | null) => {
    setHoveredRackId(rackId);
  }, []);

  const handleNavigateDC = useCallback(() => {
    navigate('/dc-manage');
  }, [navigate]);

  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    racks.forEach(r => { map[r.id] = r.alertCount > 0 ? 1 : r.usedU / r.totalU; });
    return map;
  }, [racks]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a1520]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-2 border-t-[#00f5ff] border-r-[#00f5ff] rounded-full animate-spin" />
            <div className="absolute inset-2 border-2 border-b-[#00ff88] border-l-[#00ff88] rounded-full animate-spin-reverse" />
            <div className="absolute inset-4 flex items-center justify-center">
              <span className="text-2xl text-[#00f5ff]">◆</span>
            </div>
          </div>
          <span className="text-sm text-[#5a7a94] tracking-[4px]">系统加载中</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#0a1520] overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 20% 50%, rgba(0,80,150,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(123,97,255,0.05) 0%, transparent 60%)',
      }}>
      <div className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,245,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.015) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(135deg, #142030 0%, #1a2a3a 50%, #142030 100%)',
          border: '1px solid rgba(0,245,255,0.15)',
          borderRadius: '14px',
          overflow: 'hidden',
          margin: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,212,255,0.03)',
        }}>
        <Scene
          racks={filteredRacks}
          onRackClick={handleRackClick}
          selectedRackId={selectedRack?.id || null}
          hoveredRackId={hoveredRackId}
          onHoverChange={handleHoverChange}
          heatmapData={heatmapData}
          viewMode={viewMode}
        />
      </div>

      <DashboardOverlay
        overview={overview}
        racks={racks}
        alerts={alerts}
        timeStr={timeStr}
        uptime={uptime}
        isReal={isReal}
        searchQuery={searchQuery}
        viewMode={viewMode}
        onSearchChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onNavigateDC={handleNavigateDC}
      />

      {slotDetailOpen && selectedRack && (
        <SlotDetailPanel
          rack={selectedRack}
          slots={rackSlots}
          onClose={() => { setSlotDetailOpen(false); setSelectedRack(null); }}
        />
      )}

      <style>{`
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse { animation: spin-reverse 2s linear infinite; }
      `}</style>
    </div>
  );
}
