/**
 * AddDeviceModal 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 AddDeviceModal.tsx 579 行（workspace 略小 git HEAD 583）包含：
 *   - 4 interface
 *   - 5 useState + formData aggregate
 *   - 1 useEffect
 *   - 2 useQuery（**含 baseline `data` typo bug 修复**）
 *   - 3 handler
 *   - 主 modal：header + tabs + 5 sections + result banner + footer
 *
 * 拆分后行为：9 个子模块按职责分离 + 主入口仅编排 ~70 行
 *   - types.ts                       — 5 interface + createDefaultFormData (75)
 *   - constants.ts                   — vendors + roles + tabs + TAB_ICONS (30)
 *   - useAddDeviceModal.ts           — 5 state + 1 effect + 2 query + 3 handler (180)
 *   - BasicInfoSection.tsx           — name/ip/vendor/role/location (115)
 *   - SshConfigSection.tsx           — SSH 凭证 + user/pass/enable (130)
 *   - SnmpConfigSection.tsx          — SNMP 凭证 + port + 测试 (90)
 *   - TestResultBanner.tsx           — 成功/失败反馈 banner (30)
 *   - DeviceTabBar.tsx               — SSH/SNMP tab 切换 (45)
 *   - ModalFooter.tsx                — SSH 测试 / 取消 / 确认 (50)
 *   - index.ts                       — barrel (25)
 *
 * 桶兼容：原 `import AddDeviceModal from '.../components/AddDeviceModal'` 仍可用（含 NetworkDevices.tsx + split-components.test.ts 动态测试）
 * 🐛 Baseline bug 修复：拆分同时修复 L105 `queryFn: () => api.get('/ssh-keys').then(res => data)` 中 `data` 未定义 → `.then(r => r.data)`
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */

import { X } from 'lucide-react';
import { useAddDeviceModal } from './add-device-modal/useAddDeviceModal';
import { BasicInfoSection } from './add-device-modal/BasicInfoSection';
import { SshConfigSection } from './add-device-modal/SshConfigSection';
import { SnmpConfigSection } from './add-device-modal/SnmpConfigSection';
import { TestResultBanner } from './add-device-modal/TestResultBanner';
import { DeviceTabBar } from './add-device-modal/DeviceTabBar';
import { ModalFooter } from './add-device-modal/ModalFooter';
import type { AddDeviceModalProps } from './add-device-modal/types';

export default function AddDeviceModal({ device, onClose, onSuccess }: AddDeviceModalProps) {
  const data = useAddDeviceModal(device, onSuccess);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface rounded-t-xl z-10">
          <h3 className="text-base font-medium text-text-primary">
            {data.isEditing ? '编辑设备' : '添加网络设备'}
          </h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void data.handleSubmit(e)} className="p-6 space-y-4">
          <BasicInfoSection form={data.formData} setForm={data.setFormData} />

          <DeviceTabBar
            activeTab={data.activeTab}
            onChange={(k) => {
              data.setActiveTab(k);
            }}
          />

          {data.activeTab === 'ssh' && (
            <SshConfigSection
              form={data.formData}
              setForm={data.setFormData}
              isEditing={data.isEditing}
              useCredential={data.useCredential}
              setUseCredential={data.setUseCredential}
              credentials={data.credentials}
            />
          )}

          {data.activeTab === 'snmp' && (
            <SnmpConfigSection
              form={data.formData}
              setForm={data.setFormData}
              snmpCredentials={data.snmpCredentials}
              isTesting={data.testingConnection}
              onSnmpTest={() => void data.handleSnmpTest()}
            />
          )}

          <TestResultBanner testResult={data.testResult} />

          <ModalFooter
            isSshTab={data.activeTab === 'ssh'}
            isSubmitting={data.isSubmitting}
            isTesting={data.testingConnection}
            onTestConnection={() => void data.handleTestConnection()}
            onClose={onClose}
          />
        </form>
      </div>
    </div>
  );
}
