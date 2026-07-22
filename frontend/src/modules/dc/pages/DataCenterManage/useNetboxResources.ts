import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import { dcApi } from '../../api';
import type {
  Room,
  Rack,
  Manufacturer,
  DeviceTypeInfo,
  PowerPanel,
  PowerFeed,
  Cable as UiCable,
} from './types';
import type {
  ManufacturerInput,
  DeviceTypeInput,
  PowerPanelInput,
  PowerFeedInput,
  CableInput,
  DeviceType,
  Cable as ApiCable,
} from '../../api';

/**
 * useNetboxResources — NetBox 借鉴资源（制造商/型号/配电柜/馈线/线缆）
 *
 * 从 useDataCenter.ts 抽离（架构规则 §3.1：单文件 < 500 行）。
 * 5 类资源互不相关，统一在一个 hook 中管理。
 *
 * rooms / racks 由 useDataCenter 注入（不在 NetBox 资源范围内，但 PowerPanels/PowerFeeds
 * 弹窗需要机房/机柜下拉选择器）。
 */
export function useNetboxResources(injectedRooms?: Room[], injectedRacks?: Rack[]) {
  // ── 状态 ──
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceTypeInfo[]>([]);
  const [powerPanels, setPowerPanels] = useState<PowerPanel[]>([]);
  const [powerFeeds, setPowerFeeds] = useState<PowerFeed[]>([]);
  const [cables, setCables] = useState<UiCable[]>([]);
  const [loading, setLoading] = useState(false);

  const [mfgForm] = Form.useForm<ManufacturerInput>();
  const [dtForm] = Form.useForm<DeviceTypeInput>();
  const [ppForm] = Form.useForm<PowerPanelInput>();
  const [pfForm] = Form.useForm<PowerFeedInput>();
  const [cableForm] = Form.useForm<CableInput>();

  const [mfgModalOpen, setMfgModalOpen] = useState(false);
  const [dtModalOpen, setDtModalOpen] = useState(false);
  const [ppModalOpen, setPpModalOpen] = useState(false);
  const [pfModalOpen, setPfModalOpen] = useState(false);
  const [cableModalOpen, setCableModalOpen] = useState(false);

  const [editingMfg, setEditingMfg] = useState<Manufacturer | null>(null);
  const [editingDt, setEditingDt] = useState<DeviceTypeInfo | null>(null);
  const [editingPp, setEditingPp] = useState<PowerPanel | null>(null);
  const [editingPf, setEditingPf] = useState<PowerFeed | null>(null);
  const [editingCable, setEditingCable] = useState<UiCable | null>(null);

  // ── 加载 ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, pp, pf, c] = await Promise.all([
        dcApi.listManufacturers(),
        dcApi.listDeviceTypes(),
        dcApi.listPowerPanels(),
        dcApi.listPowerFeeds(),
        dcApi.listCables(),
      ]);
      setManufacturers(m);
      setDeviceTypes(d as unknown as DeviceTypeInfo[]);
      setPowerPanels(pp);
      setPowerFeeds(pf);
      setCables(c as unknown as UiCable[]);
    } catch (err: unknown) {
      message.error((err as Error).message || '加载资源失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Manufacturer CRUD ──
  const saveMfg = useCallback(async () => {
    const values = await mfgForm.validateFields();
    if (editingMfg) {
      await dcApi.updateManufacturer(editingMfg.id, values);
    } else {
      await dcApi.createManufacturer(values);
    }
    message.success('保存成功');
    setMfgModalOpen(false);
    setEditingMfg(null);
    mfgForm.resetFields();
    load();
  }, [mfgForm, editingMfg, load]);

  const deleteMfg = useCallback(async (id: string) => {
    await dcApi.deleteManufacturer(id);
    message.success('已删除');
    load();
  }, [load]);

  // ── DeviceType CRUD ──
  const saveDt = useCallback(async () => {
    const values = await dtForm.validateFields();
    if (editingDt) {
      await dcApi.updateDeviceType(editingDt.id, values);
    } else {
      await dcApi.createDeviceType(values);
    }
    message.success('保存成功');
    setDtModalOpen(false);
    setEditingDt(null);
    dtForm.resetFields();
    load();
  }, [dtForm, editingDt, load]);

  const deleteDt = useCallback(async (id: string) => {
    await dcApi.deleteDeviceType(id);
    message.success('已删除');
    load();
  }, [load]);

  // ── PowerPanel CRUD ──
  const savePp = useCallback(async () => {
    const values = await ppForm.validateFields();
    if (editingPp) {
      await dcApi.updatePowerPanel(editingPp.id, values);
    } else {
      await dcApi.createPowerPanel(values);
    }
    message.success('保存成功');
    setPpModalOpen(false);
    setEditingPp(null);
    ppForm.resetFields();
    load();
  }, [ppForm, editingPp, load]);

  const deletePp = useCallback(async (id: string) => {
    await dcApi.deletePowerPanel(id);
    message.success('已删除');
    load();
  }, [load]);

  // ── PowerFeed CRUD ──
  const savePf = useCallback(async () => {
    const values = await pfForm.validateFields();
    if (editingPf) {
      await dcApi.updatePowerFeed(editingPf.id, values);
    } else {
      await dcApi.createPowerFeed(values);
    }
    message.success('保存成功');
    setPfModalOpen(false);
    setEditingPf(null);
    pfForm.resetFields();
    load();
  }, [pfForm, editingPf, load]);

  const deletePf = useCallback(async (id: string) => {
    await dcApi.deletePowerFeed(id);
    message.success('已删除');
    load();
  }, [load]);

  // ── Cable CRUD ──
  const saveCable = useCallback(async () => {
    const values = await cableForm.validateFields();
    if (editingCable) {
      await dcApi.updateCable(editingCable.id, values);
    } else {
      await dcApi.createCable(values);
    }
    message.success('保存成功');
    setCableModalOpen(false);
    setEditingCable(null);
    cableForm.resetFields();
    load();
  }, [cableForm, editingCable, load]);

  const deleteCable = useCallback(async (id: string) => {
    await dcApi.deleteCable(id);
    message.success('已删除');
    load();
  }, [load]);

  return {
    // 状态
    manufacturers,
    deviceTypes,
    powerPanels,
    powerFeeds,
    cables,
    loading,
    // 注入数据（来自 useDataCenter）
    rooms: injectedRooms ?? [],
    racks: injectedRacks ?? [],
    // Forms
    mfgForm,
    dtForm,
    ppForm,
    pfForm,
    cableForm,
    // Modals
    mfgModalOpen,
    setMfgModalOpen,
    dtModalOpen,
    setDtModalOpen,
    ppModalOpen,
    setPpModalOpen,
    pfModalOpen,
    setPfModalOpen,
    cableModalOpen,
    setCableModalOpen,
    // Editing
    editingMfg,
    setEditingMfg,
    editingDt,
    setEditingDt,
    editingPp,
    setEditingPp,
    editingPf,
    setEditingPf,
    editingCable,
    setEditingCable,
    // 操作
    saveMfg,
    saveDt,
    savePp,
    savePf,
    saveCable,
    deleteMfg,
    deleteDt,
    deletePp,
    deletePf,
    deleteCable,
    reload: load,
  };
}