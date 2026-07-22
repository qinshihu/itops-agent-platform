import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import api from '../../../../lib/api';
import { useSocketIO } from '../../../../lib/useSocketIO';
import type { DCStatusPayload } from '../../../../lib/useSocketIO';
import type { Rack3D, SlotInfo, OverviewData, AlertItem } from './types';

interface RawSlotItem {
  rack_id: string;
  slot_id: string;
  start_u: number;
  end_u: number;
  device_name?: string;
  device_id?: string;
  device_type?: string;
  device_status?: string;
  server_status?: string;
  cpu_usage?: number | null;
  memory_usage?: number | null;
  disk_usage?: number | null;
}

interface RawRackItem {
  id: string;
  name: string;
  row_number?: number;
  total_u?: number;
  used_u?: number;
  device_count?: number;
  position_x?: number;
  position_z?: number;
}

interface RawAlertItem {
  id: string;
  title: string;
  severity: string;
  source?: string;
  created_at?: string;
}

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
      // 真实接口路径：/dc/slots/batch（不是 /dc/batch-slots）
      try {
        const [ovRes, rackRes, slotsRes] = await Promise.all([
          api.get('/dc/overview').catch((err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const url = (err as { config?: { url?: string } })?.config?.url;
            logger.error(`[useDataRoom] /dc/overview 失败: status=${status} url=${url}`, err);
            throw err;
          }),
          api.get('/dc/racks').catch((err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const url = (err as { config?: { url?: string } })?.config?.url;
            logger.error(`[useDataRoom] /dc/racks 失败: status=${status} url=${url}`, err);
            throw err;
          }),
          api.get('/dc/slots/batch').catch((err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            // batch 失败不影响是否演示模式，仅记 warn
            logger.warn(`[useDataRoom] /dc/slots/batch 失败: status=${status}`);
            return { data: { data: { slots: [], racks: [], rooms: [] } } };
          }),
        ]);

        if (cancelled) return;

        const ov = (ovRes.data?.data ?? ovRes.data) as OverviewData;
        setOverview(ov);
        setIsReal(true);

        // 按机柜分组 U 位（/dc/slots/batch 返回 { slots, racks, rooms }）
        const slotsData = ((slotsRes.data?.data?.slots ?? slotsRes.data?.data ?? []) as RawSlotItem[]);
        const slotsByRack: Record<string, SlotInfo[]> = {};
        for (const s of slotsData) {
          if (!slotsByRack[s.rack_id]) slotsByRack[s.rack_id] = [];
          slotsByRack[s.rack_id].push({
            id: s.slot_id,
            startU: s.start_u,
            endU: s.end_u,
            deviceName: s.device_name || s.device_id || '',
            deviceType: s.device_type || '',
            deviceStatus: s.device_status || 'unknown',
            cpuUsage: null,
            memUsage: null,
            diskUsage: null,
          });
        }
        setRackSlotsMap(slotsByRack);

        // 处理机柜列表
        const rawRacks = ((rackRes.data?.data ?? rackRes.data) || []) as RawRackItem[];
        if (rawRacks.length > 0) {
          setRacks(rawRacks.map((r: RawRackItem) => ({
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
          setRacks(ov.rackData.map((r, i) => ({
            id: r.id || `mock-${i}`,
            name: r.name,
            roomName: r.roomName || '',
            roomLabel: r.roomLabel || '',
            row: r.row || 1,
            totalU: r.totalU || 42,
            usedU: r.usedU || 0,
            deviceCount: r.deviceCount || 0,
            alertCount: r.alertCount || 0,
            deviceStatus: (r.alertCount || 0) > 0 ? 'warning' : 'normal',
            sceneX: r.sceneX || 0,
            sceneZ: r.sceneZ || 0,
          })));
        } else {
          setRacks([]);
        }
      } catch (err) {
        logger.error('加载数据中心数据失败:', err);
        // 演示数据降级
        if (!cancelled) {
          setRacks(getDemoRacks());
          setOverview(getDemoOverview());
          setIsReal(false);
        }
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

    api.get('/alerts', { params: { limit: 50, status: 'open' } })
      .then(res => {
        if (cancelled) return;
        // ⚠️ 修复：原本写 `(data || [])` 是 typo（data 是外层变量），导致告警永远为空
        const items = (res.data?.data ?? res.data ?? []) as RawAlertItem[];
        setAlerts(items);
        setAlertsList(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          logger.warn('加载告警失败:', err);
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
          const update = payload.rackUtil.find((u) => u.id === r.id);
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
      const { data } = await api.get(`/dc/slots/${rackId}`);
      const slots = (data || []) as RawSlotItem[];
      setRackSlots(slots.map((s: RawSlotItem) => ({
        id: s.slot_id,
        startU: s.start_u,
        endU: s.end_u,
        deviceName: s.device_name || s.device_id || '',
        deviceType: s.device_type || '',
        deviceStatus: s.device_status || s.server_status || 'unknown',
        cpuUsage: s.cpu_usage ?? null,
        memUsage: s.memory_usage ?? null,
        diskUsage: s.disk_usage ?? null,
      })));
    } catch (err) {
      logger.error('加载机柜 U 位失败:', err);
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

// ── 演示数据 ──
function getDemoRacks(): Rack3D[] {
  return [
    { id: 'A-01', name: 'A-01', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-02', name: 'A-02', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-03', name: 'A-03', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-04', name: 'A-04', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-05', name: 'A-05', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-06', name: 'A-06', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-07', name: 'A-07', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'A-08', name: 'A-08', roomName: 'A区', roomLabel: 'A', row: 1, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-01', name: 'B-01', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-02', name: 'B-02', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-03', name: 'B-03', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-04', name: 'B-04', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-05', name: 'B-05', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-06', name: 'B-06', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-07', name: 'B-07', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
    { id: 'B-08', name: 'B-08', roomName: 'B区', roomLabel: 'B', row: 2, totalU: 42, usedU: 0, deviceCount: 0, alertCount: 0, deviceStatus: 'normal' },
  ];
}

function getDemoOverview(): OverviewData {
  return {
    summary: {
      totalDevices: 0,
      onlineDevices: 0,
      alertDevices: 0,
      offlineDevices: 0,
      avgTemp: 24.5,
      avgHumidity: 45,
      totalRacks: 16,
    },
    pue: 1.45,
    totalPower: 285600,
    coolingPower: 128300,
    itPower: 157300,
  };
}
