import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../../lib/api';
import { useSocketIO } from '../../../../lib/useSocketIO';
import type { DCStatusPayload } from '../../../../lib/useSocketIO';
import type { Rack3D, SlotInfo, OverviewData, AlertItem } from './types';

interface UseDataRoomReturn {
  loading: boolean;
  racks: Rack3D[];
  overview: OverviewData | null;
  isReal: boolean;
  alerts: AlertItem[];
  alertsList: AlertItem[];
  selectedRack: Rack3D | null;
  rackSlots: SlotInfo[];
  rackSlotsMap: Record<string, SlotInfo[]>;
  slotDetailOpen: boolean;
  startTime: number;
  fetchRackSlots: (rackId: string) => Promise<void>;
  setSelectedRack: (rack: Rack3D | null) => void;
  setSlotDetailOpen: (open: boolean) => void;
}

export default function useDataRoom(): UseDataRoomReturn {
  const [racks, setRacks] = useState<Rack3D[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReal, setIsReal] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
  const [selectedRack, setSelectedRack] = useState<Rack3D | null>(null);
  const [rackSlots, setRackSlots] = useState<SlotInfo[]>([]);
  const [rackSlotsMap, setRackSlotsMap] = useState<Record<string, SlotInfo[]>>({});
  const [slotDetailOpen, setSlotDetailOpen] = useState(false);
  const startTime = useRef(Date.now());

  /** 加载概览 + 机柜 + 槽位数据 */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [ovRes, rackRes, slotsRes] = await Promise.all([
          api.get('/api/dc/overview'),
          api.get('/api/dc/racks'),
          api.get('/api/dc/batch-slots').catch(() => ({ data: { data: [] } })),
        ]);

        if (cancelled) return;

        const ov = ovRes.data.data as OverviewData;
        setOverview(ov);
        setIsReal(true);

        // 按机柜分组 U 位
        const slotsByRack: Record<string, SlotInfo[]> = {};
        for (const s of (slotsRes.data.data || []) as any[]) {
          if (!slotsByRack[s.rack_id]) slotsByRack[s.rack_id] = [];
          slotsByRack[s.rack_id].push({
            id: s.slot_id,
            startU: s.start_u,
            endU: s.end_u,
            deviceName: s.device_name || s.device_id,
            deviceType: s.device_type,
            deviceStatus: s.device_status || 'unknown',
            cpuUsage: null,
            memUsage: null,
            diskUsage: null,
          });
        }
        setRackSlotsMap(slotsByRack);

        // 处理机柜列表
        const rawRacks = (rackRes.data.data || []) as any[];
        if (rawRacks.length > 0) {
          setRacks(rawRacks.map((r: any) => ({
            id: r.id,
            name: r.name,
            roomName: '',
            roomLabel: '',
            row: r.row_number || 1,
            totalU: r.total_u || 42,
            usedU: r.used_u || 0,
            deviceCount: r.device_count || 0,
            alertCount: 0,
            deviceStatus: 'normal',
            sceneX: r.position_x || 0,
            sceneZ: r.position_z || 0,
          })));
        } else if (ov.rackData) {
          setRacks(ov.rackData.map((r: any, i: number) => ({
            id: r.id || `mock-${i}`,
            name: r.name,
            roomName: r.room_name || '',
            roomLabel: r.room_label || '',
            row: r.row_number || 1,
            totalU: r.total_u || 42,
            usedU: r.used_u || 0,
            deviceCount: r.device_count || 0,
            alertCount: r.alert_count || 0,
            deviceStatus: (r.alert_count || 0) > 0 ? 'warning' : 'normal',
            sceneX: r.position_x || 0,
            sceneZ: r.position_z || 0,
          })));
        } else {
          setRacks([]);
        }
      } catch (err) {
        console.error('加载数据中心数据失败:', err);
        setRacks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  /** 加载告警数据 */
  useEffect(() => {
    let cancelled = false;

    api.get('/api/alerts', { params: { limit: 50, status: 'open' } })
      .then(res => {
        if (cancelled) return;
        const items = (res.data.data || []) as any[];
        setAlerts(items);
        setAlertsList(items);
      })
      .catch(() => {
        if (!cancelled) {
          setAlerts([]);
          setAlertsList([]);
        }
      });

    return () => { cancelled = true; };
  }, []);

  /** WebSocket 实时推送订阅 */
  const { on } = useSocketIO();
  useEffect(() => {
    const unsub = on<DCStatusPayload>('dc:status', (payload) => {
      // 更新机柜利用率
      if (payload.rackUtil?.length > 0) {
        setRacks(prev => prev.map(r => {
          const update = payload.rackUtil.find((u: any) => u.id === r.id);
          if (update) {
            return { ...r, usedU: update.used_u, deviceCount: update.device_count };
          }
          return r;
        }));
      }
      // 更新概览摘要
      if (payload.summary) {
        setOverview(prev => prev ? { ...prev, summary: { ...prev.summary, ...payload.summary } } : prev);
      }
    });
    return () => unsub();
  }, [on]);

  /** 加载选中机柜的 U 位详情 */
  const fetchRackSlots = useCallback(async (rackId: string) => {
    try {
      const res = await api.get(`/api/dc/slots/${rackId}`);
      const data = (res.data.data || []) as any[];
      setRackSlots(data.map((s: any) => ({
        id: s.slot_id || s.id,
        startU: s.start_u,
        endU: s.end_u,
        deviceName: s.device_name || s.device_id,
        deviceType: s.device_type,
        deviceStatus: s.device_status || s.server_status || 'unknown',
        cpuUsage: s.cpu_usage ?? null,
        memUsage: s.memory_usage ?? null,
        diskUsage: s.disk_usage ?? null,
      })));
    } catch (err) {
      console.error('加载机柜 U 位失败:', err);
      setRackSlots([]);
    }
  }, []);

  return {
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
    startTime: startTime.current,
    fetchRackSlots,
    setSelectedRack,
    setSlotDetailOpen,
  };
}
