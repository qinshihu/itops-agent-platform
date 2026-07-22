/**
 * add-device-modal 子模块 barrel export（2026-07-21 拆分）
 */
export type {
  NetworkDevice,
  Credential,
  SnmpCredential,
  AddDeviceModalProps,
  TabKey,
  DeviceTab,
  TestResult,
  AddDeviceFormData,
} from './types';
export { createDefaultFormData } from './types';
export { vendors, roles, tabs, TAB_ICONS } from './constants';
export { useAddDeviceModal, type UseAddDeviceModalResult } from './useAddDeviceModal';
export { BasicInfoSection, type BasicInfoSectionProps } from './BasicInfoSection';
export { SshConfigSection, type SshConfigSectionProps } from './SshConfigSection';
export { SnmpConfigSection, type SnmpConfigSectionProps } from './SnmpConfigSection';
export { TestResultBanner } from './TestResultBanner';
export { DeviceTabBar, type DeviceTabBarProps } from './DeviceTabBar';
export { ModalFooter, type ModalFooterProps } from './ModalFooter';
