/**
 * 设备基本信息 section（2026-07-21 拆分）
 *
 * 从原 AddDeviceModal.tsx L259-324 抽出
 * 包含：名称 / IP / 厂商 / 设备角色 / 位置
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */
import type { AddDeviceFormData } from './types';
import { roles, vendors } from './constants';

export interface BasicInfoSectionProps {
  form: AddDeviceFormData;
  setForm: React.Dispatch<React.SetStateAction<AddDeviceFormData>>;
}

export function BasicInfoSection({ form, setForm }: BasicInfoSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-sm font-medium text-text-primary mb-1">
          设备名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="例：核心交换机-01"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          IP 地址 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.ip_address}
          onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
          placeholder="192.168.1.1"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">厂商</label>
        <select
          value={form.vendor}
          onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        >
          {vendors.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">设备角色</label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        >
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2">
        <label className="block text-sm font-medium text-text-primary mb-1">位置</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="例：机房A-机柜3"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
      </div>
    </div>
  );
}
