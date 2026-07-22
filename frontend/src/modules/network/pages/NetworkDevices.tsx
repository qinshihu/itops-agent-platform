import { useMemo } from 'react';
import {
  Plus, Trash2, RefreshCw, Loader2, Network, Search, ClipboardCheck,
  CheckSquare, Square, Zap,
} from 'lucide-react';
import AddDeviceModal from '../../../modules/infra/components/AddDeviceModal';
import NetworkDeviceCard from '../../../modules/network/components/NetworkDeviceCard';
import InspectionResult from '../../../modules/alerts/components/InspectionResult';
import SnmpInspectionResult from '../../../modules/network/components/SnmpInspectionResult';
import InspectionHistory from '../../../modules/alerts/components/InspectionHistory';
import { useNetworkDevices } from './network-devices/useNetworkDevices';
import { InspectionModal } from './network-devices/InspectionModal';
import { BatchInspectModal } from './network-devices/BatchInspectModal';
import { VENDORS, type NetworkDevice } from './network-devices/types';

export default function NetworkDevices() {
  const state = useNetworkDevices();

  // ── 派生：过滤后的设备列表 ──
  const filteredDevices = useMemo(() => {
    let result = state.selectedVendor === 'all'
      ? state.devices
      : state.devices.filter((d: NetworkDevice) => d.vendor === state.selectedVendor);

    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      result = result.filter((d: NetworkDevice) =>
        d.name.toLowerCase().includes(query) ||
        d.ip_address.toLowerCase().includes(query) ||
        (d.location?.toLowerCase().includes(query)) ||
        (d.model?.toLowerCase().includes(query))
      );
    }

    return result;
  }, [state.devices, state.selectedVendor, state.searchQuery]);

  // ── 关闭模态框时的辅助函数 ──
  const closeAddModal = () => { state.setIsAddModalOpen(false); state.setEditingDevice(null); };
  const closeInspectionResult = () => { state.setInspectionResult(null); state.setInspectingDevice(null); };
  const closeDeleteConfirm = () => state.setDeleteConfirmDevice(null);
  const closeSnmpResult = () => state.setSnmpInspectionResult(null);
  const closeHistory = () => state.setShowHistory(null);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">网络设备管理</h1>
        <p className="text-sm text-text-secondary">管理和巡检您的网络设备（路由器/交换机/防火墙）</p>
      </div>

      <div className="bg-surface rounded-xl border border-border mb-6">
        {/* 工具栏 */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-medium text-text-primary">设备列表</h2>
              <div className="flex flex-wrap items-center gap-2">
                {VENDORS.map(vendor => (
                  <button
                    key={vendor.value}
                    onClick={() => state.setSelectedVendor(vendor.value)}
                    className={`shrink-0 whitespace-nowrap px-3 py-1 text-xs rounded-md transition-colors ${
                      state.selectedVendor === vendor.value
                        ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                        : 'bg-background border border-border text-text-secondary hover:bg-surface hover:text-text-primary'
                    }`}
                  >
                    {vendor.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={state.refreshDevices}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {state.selectedDevices.size > 0 && (
                <>
                  <span className="text-xs text-primary font-medium">{state.selectedDevices.size} 台已选</span>
                  <button
                    onClick={state.handleBatchInspect}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600/90 text-white text-xs font-medium rounded-md hover:bg-green-600 transition-colors"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />批量巡检
                  </button>
                  <button
                    onClick={state.clearSelection}
                    className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors"
                  >取消选择</button>
                </>
              )}
              <button
                onClick={() => { state.setEditingDevice(null); state.setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />新建设备
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={state.searchQuery}
              onChange={(e) => state.setSearchQuery(e.target.value)}
              placeholder="搜索设备名称、IP地址、位置..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* 列表 / 加载 / 空态 */}
        {state.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Network className="w-12 h-12 text-text-secondary/40 mb-3" />
            <p className="text-sm text-text-secondary mb-1">
              {state.searchQuery ? '未找到匹配的设备' : '暂无网络设备'}
            </p>
            <p className="text-xs text-text-secondary/60 mb-4">
              {state.searchQuery ? '尝试更换搜索条件' : '点击"新建设备"添加第一个网络设备'}
            </p>
            {!state.searchQuery && (
              <button
                onClick={() => { state.setEditingDevice(null); state.setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />新建设备
              </button>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  if (state.selectedDevices.size === filteredDevices.length && filteredDevices.length > 0) {
                    state.clearSelection();
                  } else {
                    state.setSelectAll(filteredDevices.map((d: NetworkDevice) => d.id));
                  }
                }}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
                title="全选 / 全不选"
              >
                {state.selectedDevices.size === filteredDevices.length && filteredDevices.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-text-secondary" />
                )}
                全选 ({state.selectedDevices.size}/{filteredDevices.length})
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDevices.map((device: NetworkDevice) => (
                <div key={device.id} className="relative">
                  <div className="absolute top-3 left-3 z-10">
                    <button
                      onClick={() => state.toggleDeviceSelection(device.id)}
                      className="p-1 rounded bg-surface/90 border border-border shadow-sm hover:bg-surface transition-colors"
                    >
                      {state.selectedDevices.has(device.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-text-secondary/50" />
                      )}
                    </button>
                  </div>
                  <NetworkDeviceCard
                    device={device}
                    onEdit={state.handleEdit}
                    onDelete={state.handleDelete}
                    onInspect={state.handleInspect}
                    onSnmpInspect={state.handleSnmpInspect}
                    onSnmpTestConnection={state.handleSnmpTestConnection}
                    onTestConnection={state.handleTestConnection}
                    onHistory={state.handleHistory}
                  />
                  {state.deviceTimeline[device.id] && (
                    <div className="flex items-center gap-3 px-4 py-2 mt-0.5 bg-background/40 border border-border/50 rounded-lg">
                      {state.deviceTimeline[device.id].lastAnalysis && (
                        <button
                          onClick={() => state.navigate(`/alert-auto-analysis?deviceId=${device.id}`)}
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          分析:{' '}
                          {(() => {
                            const a = state.deviceTimeline[device.id].lastAnalysis!;
                            try {
                              const d = new Date(a.created_at!);
                              const n = new Date();
                              const m = Math.floor((n.getTime() - d.getTime()) / 60000);
                              return m < 60 ? `${m}分前` : `${Math.floor(m / 60)}h前`;
                            } catch { return ''; }
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

      {/* 模态框 */}
      {state.isAddModalOpen && (
        <AddDeviceModal
          device={state.editingDevice}
          onClose={closeAddModal}
          onSuccess={() => { closeAddModal(); /* query invalidation handled in hook */ }}
        />
      )}

      {state.showInspectionModal && state.inspectingDevice && (
        <InspectionModal
          device={state.inspectingDevice}
          inspectionType={state.inspectionType}
          customDescription={state.customDescription}
          setCustomDescription={state.setCustomDescription}
          isInspecting={state.isInspecting}
          onClose={() => state.setShowInspectionModal(false)}
          onStart={state.executeInspection}
        />
      )}

      {state.showBatchModal && (
        <BatchInspectModal
          count={state.selectedDevices.size}
          isInspecting={state.isBatchInspecting}
          onClose={() => state.setShowBatchModal(false)}
          onConfirm={state.executeBatchInspection}
        />
      )}

      {state.inspectionResult && (
        <InspectionResult
          result={state.inspectionResult}
          deviceName={state.inspectingDevice?.name || ''}
          onClose={closeInspectionResult}
        />
      )}

      {state.snmpInspectionResult && (
        <SnmpInspectionResult
          result={state.snmpInspectionResult}
          deviceName={state.snmpInspectionResult._deviceName || ''}
          onClose={closeSnmpResult}
        />
      )}

      {state.showHistory && (
        <InspectionHistory
          deviceId={state.showHistory.id}
          deviceName={state.showHistory.name}
          onClose={closeHistory}
        />
      )}

      {state.deleteConfirmDevice && (
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
                确定要删除设备{' '}
                <span className="font-medium text-text-primary">{state.deleteConfirmDevice.name}</span>
                （{state.deleteConfirmDevice.ip_address}）吗？
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeDeleteConfirm}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
                >取消</button>
                <button
                  onClick={state.confirmDelete}
                  className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
                >确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}