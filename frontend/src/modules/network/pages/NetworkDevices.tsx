/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, RefreshCw, CheckCircle2,
  Zap, Wifi, X, Loader2, Network, Search, ClipboardCheck,
  AlertTriangle, CheckSquare, Square
} from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import AddDeviceModal from '../../../modules/infra/components/AddDeviceModal';
import NetworkDeviceCard from '../../../modules/network/components/NetworkDeviceCard';
import InspectionResult from '../../../modules/alerts/components/InspectionResult';
import SnmpInspectionResult from '../../../modules/network/components/SnmpInspectionResult';
import InspectionHistory from '../../../modules/alerts/components/InspectionHistory';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { safeFormatDistance } from '../../../lib/date';

interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string;
  os_version?: string;
  ssh_port: number;
  username: string;
  location?: string;
  role?: string;
  status: string;
  last_inspection_at?: string;
  last_inspection_result?: string;
  created_at: string;
  updated_at: string;
  snmp_enabled?: number;
  snmp_credential_id?: string;
  snmp_credential_name?: string;
}

export default function NetworkDevices() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectionResult, setInspectionResult] = useState<any>(null);
  const [snmpInspectionResult, setSnmpInspectionResult] = useState<any>(null);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectingDevice, setInspectingDevice] = useState<NetworkDevice | null>(null);
  const [inspectionType, setInspectionType] = useState<'standard' | 'custom' | 'full'>('standard');
  const [customDescription, setCustomDescription] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [showHistory, setShowHistory] = useState<NetworkDevice | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [isBatchInspecting, setIsBatchInspecting] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [deleteConfirmDevice, setDeleteConfirmDevice] = useState<NetworkDevice | null>(null);

  // ESC key support for modals
  useEscapeKey({ onEscape: () => { setShowInspectionModal(false); setInspectingDevice(null); }, enabled: showInspectionModal });
  useEscapeKey({ onEscape: () => setShowBatchModal(false), enabled: showBatchModal });
  useEscapeKey({ onEscape: () => { setDeleteConfirmDevice(null); }, enabled: !!deleteConfirmDevice });
  useEscapeKey({ onEscape: () => { setInspectionResult(null); setInspectingDevice(null); }, enabled: !!inspectionResult });
  useEscapeKey({ onEscape: () => { setSnmpInspectionResult(null); }, enabled: !!snmpInspectionResult });
  useEscapeKey({ onEscape: () => setShowHistory(null), enabled: !!showHistory });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['network-devices'],
    queryFn: () => api.get('/api/network-devices').then(res => res.data.data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/network-devices/${id}`),
    onSuccess: () => {
      toast.success('设备删除成功');
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
    },
    onError: () => toast.error('删除设备失败')
  });

  const handleDelete = (device: NetworkDevice) => {
    setDeleteConfirmDevice(device);
  };

  const confirmDelete = () => {
    if (deleteConfirmDevice) {
      deleteMutation.mutate(deleteConfirmDevice.id);
      setDeleteConfirmDevice(null);
    }
  };

  const handleEdit = (device: NetworkDevice) => {
    setEditingDevice(device);
    setIsAddModalOpen(true);
  };

  const handleInspect = (device: NetworkDevice, type: 'standard' | 'custom' | 'full' = 'standard') => {
    setInspectingDevice(device);
    setInspectionType(type);
    setCustomDescription('');
    setShowInspectionModal(true);
  };

  const handleSnmpInspect = async (device: NetworkDevice) => {
    try {
      const response = await api.post(`/api/network-devices/${device.id}/inspect-snmp`);
      const data = response.data.data;
      data._deviceName = device.name;
      setSnmpInspectionResult(data);
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
    } catch (error: any) {
      toast.error('SNMP 巡检失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSnmpTestConnection = async (device: NetworkDevice) => {
    if (!device.snmp_credential_id) {
      toast.error('该设备未关联 SNMP 凭证');
      return;
    }
    try {
      const response = await api.post(`/api/snmp/credentials/${device.snmp_credential_id}/test`, {
        host: device.ip_address
      });
      if (response.data.code === 0) {
        toast.success('SNMP 连接成功 ✅');
      } else {
        toast.error('SNMP 连接失败: ' + (response.data.message || ''));
      }
    } catch (error: any) {
      toast.error('SNMP 测试失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleTestConnection = async (device: NetworkDevice) => {
    try {
      toast.info(`正在测试 ${device.name} 的连接...`);
      const response = await api.post(`/api/network-devices/${device.id}/test-connection`);
      const result = response.data;
      
      if (result.success) {
        toast.success(`连接成功 (${result.data.latency}ms)`);
      } else {
        toast.error(`连接失败: ${result.data.message}`);
      }
    } catch (error: any) {
      toast.error('测试连接失败');
    }
  };

  const handleHistory = (device: NetworkDevice) => {
    setShowHistory(device);
  };

  const executeInspection = async () => {
    if (!inspectingDevice) return;

    setIsInspecting(true);
    try {
      const response = await api.post(`/api/network-devices/${inspectingDevice.id}/inspect`, {
        inspectionType,
        customDescription: inspectionType === 'custom' ? customDescription : undefined
      });

      setInspectionResult(response.data.data);
      toast.success('巡检完成');
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
    } catch (error: any) {
      toast.error('巡检失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsInspecting(false);
    }
  };

  const toggleDeviceSelection = (id: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDevices(newSelected);
  };

  const selectAllDevices = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredDevices.map((d: NetworkDevice) => d.id)));
    }
  };

  const handleBatchInspect = () => {
    if (selectedDevices.size === 0) {
      toast.error('请至少选择一台设备');
      return;
    }
    setShowBatchModal(true);
  };

  const executeBatchInspection = async () => {
    if (selectedDevices.size === 0) return;

    setIsBatchInspecting(true);
    try {
      const response = await api.post('/api/network-devices/batch-inspect', {
        deviceIds: Array.from(selectedDevices),
        inspectionType: 'standard'
      });

      toast.success(`批量巡检完成，共 ${response.data.data.length} 台设备`);
      queryClient.invalidateQueries({ queryKey: ['network-devices'] });
      setSelectedDevices(new Set());
      setShowBatchModal(false);
    } catch (error: any) {
      toast.error('批量巡检失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsBatchInspecting(false);
    }
  };

  const filteredDevices = useMemo(() => {
    let result = selectedVendor === 'all'
      ? devices
      : devices.filter((d: NetworkDevice) => d.vendor === selectedVendor);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((d: NetworkDevice) =>
        d.name.toLowerCase().includes(query) ||
        d.ip_address.toLowerCase().includes(query) ||
        (d.location?.toLowerCase().includes(query)) ||
        (d.model?.toLowerCase().includes(query))
      );
    }

    return result;
  }, [devices, selectedVendor, searchQuery]);

  // 关联数据：各设备的最近巡检/分析/修复概览
  const { data: linkageData = { alerts: [], analyses: [], inspections: [], executions: [] } } = useQuery({
    queryKey: ['device-linkage'],
    queryFn: () => api.get('/api/dashboard/linkage').then(r => r.data.data || {}),
    refetchInterval: 60000,
  });

  // 收集各设备最近活动时间轴
  const { data: deviceTimeline = {} } = useQuery({
    queryKey: ['device-timeline'],
    queryFn: async () => {
      const res = await api.get('/api/inspection-center?limit=300');
      const items = (res.data.data || []) as any[];
      // 按 device_id 分组，取最新一条 per source
      const map: Record<string, { lastAnalysis?: any; lastInspection?: any; lastExecution?: any }> = {};
      items.forEach((item: any) => {
        if (!map[item.device_id]) map[item.device_id] = {};
        if (item.source === 'analysis' && !map[item.device_id].lastAnalysis) map[item.device_id].lastAnalysis = item;
        if (item.source === 'inspection' && !map[item.device_id].lastInspection) map[item.device_id].lastInspection = item;
      });
      return map;
    },
    refetchInterval: 60000,
  });

  const navigate = useNavigate();

  const vendors = ['all', 'huawei', 'cisco', 'h3c', 'ruijie', 'zte'];
  const vendorLabels: Record<string, string> = {
    all: '全部厂商',
    huawei: '华为',
    cisco: '思科',
    h3c: '华三',
    ruijie: '锐捷',
    zte: '中兴'
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">网络设备管理</h1>
        <p className="text-sm text-text-secondary">管理和巡检您的网络设备（路由器/交换机/防火墙）</p>
      </div>

      <div className="bg-surface rounded-xl border border-border mb-6">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-medium text-text-primary">设备列表</h2>
              <div className="flex items-center gap-2">
                {vendors.map(vendor => (
                  <button
                    key={vendor}
                    onClick={() => setSelectedVendor(vendor)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      selectedVendor === vendor
                        ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                        : 'bg-background border border-border text-text-secondary hover:bg-surface hover:text-text-primary'
                    }`}
                  >
                    {vendorLabels[vendor]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['network-devices'] })}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {selectedDevices.size > 0 && (
                <>
                  <span className="text-xs text-primary font-medium">{selectedDevices.size} 台已选</span>
                  <button
                    onClick={handleBatchInspect}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600/90 text-white text-xs font-medium rounded-md hover:bg-green-600 transition-colors"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    批量巡检
                  </button>
                  <button
                    onClick={() => setSelectedDevices(new Set())}
                    className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors"
                  >
                    取消选择
                  </button>
                </>
              )}
              <button
                onClick={() => { setEditingDevice(null); setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                新建设备
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索设备名称、IP地址、位置..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Network className="w-12 h-12 text-text-secondary/40 mb-3" />
            <p className="text-sm text-text-secondary mb-1">
              {searchQuery ? '未找到匹配的设备' : '暂无网络设备'}
            </p>
            <p className="text-xs text-text-secondary/60 mb-4">
              {searchQuery ? '尝试更换搜索条件' : '点击"新建设备"添加第一个网络设备'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => { setEditingDevice(null); setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                新建设备
              </button>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={selectAllDevices}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                {selectedDevices.size === filteredDevices.length ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-text-secondary" />
                )}
                全选 ({selectedDevices.size}/{filteredDevices.length})
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDevices.map((device: NetworkDevice) => (
                <div key={device.id} className="relative">
                  <div className="absolute top-3 left-3 z-10">
                    <button
                      onClick={() => toggleDeviceSelection(device.id)}
                      className="p-1 rounded bg-surface/90 border border-border shadow-sm hover:bg-surface transition-colors"
                    >
                      {selectedDevices.has(device.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-text-secondary/50" />
                      )}
                    </button>
                  </div>
                  <NetworkDeviceCard
                    device={device}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onInspect={handleInspect}
                    onSnmpInspect={handleSnmpInspect}
                    onSnmpTestConnection={handleSnmpTestConnection}
                    onTestConnection={handleTestConnection}
                    onHistory={handleHistory}
                  />
                  {/* 设备状态栏 */}
                  {(deviceTimeline as any)[device.id] && (
                    <div className="flex items-center gap-3 px-4 py-2 mt-0.5 bg-background/40 border border-border/50 rounded-lg">
                      {(deviceTimeline as any)[device.id].lastAnalysis && (
                        <button
                          onClick={() => navigate(`/alert-auto-analysis?deviceId=${device.id}`)}
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          分析:{' '}
                          {(() => {
                            const a = (deviceTimeline as any)[device.id].lastAnalysis; try { const d = new Date(a.created_at); const n = new Date(); const m = Math.floor((n.getTime() - d.getTime()) / 60000); return m < 60 ? `${m}分前` : `${Math.floor(m / 60)}h前`; } catch { return ''; }
                          })()}
                        </button>
                      )}
                      {(deviceTimeline as any)[device.id].lastInspection && (
                        <button
                          onClick={() => navigate(`/inspection-center?deviceId=${device.id}`)}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          巡检:{' '}
                          {(() => {
                            const i = (deviceTimeline as any)[device.id].lastInspection; try { const d = new Date(i.created_at); const n = new Date(); const m = Math.floor((n.getTime() - d.getTime()) / 60000); return m < 60 ? `${m}分前` : `${Math.floor(m / 60)}h前`; } catch { return ''; }
                          })()}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddDeviceModal
          device={editingDevice}
          onClose={() => { setIsAddModalOpen(false); setEditingDevice(null); }}
          onSuccess={() => {
            setIsAddModalOpen(false);
            setEditingDevice(null);
            queryClient.invalidateQueries({ queryKey: ['network-devices'] });
          }}
        />
      )}

      {showInspectionModal && inspectingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-medium text-text-primary">
                巡检 - {inspectingDevice.name}
              </h3>
              <button
                onClick={() => setShowInspectionModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {inspectionType === 'standard' ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">标准巡检将检查以下项目：</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['CPU 使用率', '内存使用率', '接口状态', '版本信息', '路由表', '系统日志', '环境状态', '电源/风扇'].map(item => (
                      <div key={item} className="flex items-center gap-2 text-text-secondary">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : inspectionType === 'custom' ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-text-primary">巡检需求描述</label>
                  <textarea
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="例如：检查 BGP 邻居状态，查看 ACL 配置..."
                    className="w-full h-24 px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-colors"
                  />
                  <p className="text-xs text-text-secondary/60">系统将通过知识库检索相关命令并分析结果</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">全面巡检将执行所有标准巡检项，包括：</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['CPU', '内存', '接口', '版本', '路由', '日志', '环境', '电源', '风扇', 'STP', 'VLAN', 'ARP', 'MAC'].map(item => (
                      <div key={item} className="flex items-center gap-2 text-text-secondary">
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-background/50 rounded-b-xl border-t border-border">
              <button
                onClick={() => setShowInspectionModal(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
              >
                取消
              </button>
              <button
                onClick={executeInspection}
                disabled={isInspecting || (inspectionType === 'custom' && !customDescription.trim())}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isInspecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    巡检中...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    开始巡检
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-medium text-text-primary">
                批量巡检 ({selectedDevices.size} 台设备)
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-300">
                  <p className="font-medium mb-1">确认批量巡检</p>
                  <p>将对 {selectedDevices.size} 台设备执行标准巡检，此操作可能需要较长时间。</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-background/50 rounded-b-xl border-t border-border">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
              >
                取消
              </button>
              <button
                onClick={executeBatchInspection}
                disabled={isBatchInspecting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600/90 text-white text-sm font-medium rounded-md hover:bg-green-600 transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                {isBatchInspecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    巡检中...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    确认巡检
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectionResult && (
        <InspectionResult
          result={inspectionResult}
          deviceName={inspectingDevice?.name || ''}
          onClose={() => setInspectionResult(null)}
        />
      )}

      {snmpInspectionResult && (
        <SnmpInspectionResult
          result={snmpInspectionResult}
          deviceName={snmpInspectionResult._deviceName || ''}
          onClose={() => setSnmpInspectionResult(null)}
        />
      )}

      {showHistory && (
        <InspectionHistory
          deviceId={showHistory.id}
          deviceName={showHistory.name}
          onClose={() => setShowHistory(null)}
        />
      )}

      {deleteConfirmDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-text-primary">确认删除</h3>
                  <p className="text-sm text-text-secondary">此操作不可撤销</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                确定要删除设备 <span className="font-medium text-text-primary">{deleteConfirmDevice.name}</span>（{deleteConfirmDevice.ip_address}）吗？
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmDevice(null)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
