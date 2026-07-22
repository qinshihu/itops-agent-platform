/**
 * AddDeviceModal 数据 hook（2026-07-21 拆分）
 *
 * 把原 AddDeviceModal.tsx L67-243 的 state + query + effect + handlers 抽出
 * 包含：
 * - 5 useState（isSubmitting / testingConnection / testResult / useCredential / activeTab）
 * - 1 formData aggregate (factory createDefaultFormData)
 * - 1 useEffect（auto snmp enable）
 * - 2 useQuery（snmp-credentials + ssh-keys（**修复**了 baseline 的 `data` typo bug））
 * - 3 handler（handleSubmit / handleTestConnection / handleSnmpTest）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 *
 * 🐛 Baseline bug 修复：原 L105 `queryFn: () => api.get('/ssh-keys').then(res => data)`
 *    — `data` 是未定义变量（应为 `r.data`）
 *    — 拆分时必须改：`.then(r => r.data)` 返回数组
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import { useToast } from '@/contexts/ToastContext';
import { logger } from '@/lib/logger';
import {
  type AddDeviceFormData,
  type Credential,
  type NetworkDevice,
  type SnmpCredential,
  type TabKey,
  type TestResult,
  createDefaultFormData,
} from './types';

export interface UseAddDeviceModalResult {
  // state
  isEditing: boolean;
  isSubmitting: boolean;
  testingConnection: boolean;
  testResult: TestResult | null;
  useCredential: boolean;
  activeTab: TabKey;
  setActiveTab: (k: TabKey) => void;
  formData: AddDeviceFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddDeviceFormData>>;
  setUseCredential: (b: boolean) => void;

  // queries
  snmpCredentials: SnmpCredential[];
  credentials: Credential[];

  // handlers
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleTestConnection: () => Promise<void>;
  handleSnmpTest: () => Promise<void>;
  getCredentialHost: (credId: string) => string;

  setIsSubmitting: (b: boolean) => void;
}

export function useAddDeviceModal(
  device?: NetworkDevice | null,
  onSuccessCallback?: () => void,
): UseAddDeviceModalResult {
  const toast = useToast();
  const isEditing = !!device;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [useCredential, setUseCredential] = useState(!!device?.ssh_key_id);
  const [activeTab, setActiveTab] = useState<TabKey>('ssh');
  const [formData, setFormData] = useState<AddDeviceFormData>(() => createDefaultFormData(device));

  // 获取 SNMP 凭证
  const { data: snmpCredentialsData = [] } = useQuery({
    queryKey: ['snmp-credentials'],
    queryFn: () =>
      api.get('/snmp/credentials').then((r) => {
        const body = r.data as { data?: SnmpCredential[] };
        return body.data || [];
      }),
  });

  // 获取 SSH 凭证（**修复**：原 L105 `queryFn: () => api.get('/ssh-keys').then(res => data)` 中 `data` 未定义）
  const { data: credentialsData = [] } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: () =>
      api.get('/ssh-keys').then((r) => (Array.isArray(r.data) ? (r.data as Credential[]) : [])),
  });

  const snmpCredentials: SnmpCredential[] = snmpCredentialsData;
  const credentials: Credential[] = credentialsData;

  const getCredentialHost = useCallback(
    (credId: string): string => {
      const cred = snmpCredentials.find((c) => c.id === credId);
      return cred?.host || '';
    },
    [snmpCredentials],
  );

  // useEffect：snmp 凭证 host === 设备 ip 时自动勾选 snmp_enabled
  useEffect(() => {
    if (formData.snmp_credential_id) {
      const credHost = getCredentialHost(formData.snmp_credential_id);
      if (credHost && credHost === formData.ip_address) {
        setFormData((prev) => ({ ...prev, snmp_enabled: 1 }));
      }
    }
  }, [formData.snmp_credential_id, formData.ip_address, getCredentialHost]);

  // ── Handlers ──
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.ip_address) {
        toast.error('请填写设备名称和 IP 地址');
        return;
      }

      // SSH 认证非必填——设备可作为纯 SNMP 设备保存，以后可再补充 SSH
      if (useCredential && !formData.ssh_key_id) {
        toast.warning('未选择 SSH 凭证，保存后将无法通过 SSH 连接');
      } else if (!useCredential && formData.username && !formData.password && !isEditing) {
        toast.warning('SSH 密码为空，可在编辑时补充');
      }

      setIsSubmitting(true);
      try {
        const payload: Record<string, unknown> = { ...formData };

        if (isEditing) {
          if (!formData.password) delete payload.password;
          if (!formData.enable_password) delete payload.enable_password;
        }

        if (isEditing && device?.id) {
          await api.put(`/network-devices/${device.id}`, payload);
          toast.success('设备更新成功');
        } else {
          await api.post('/network-devices', payload);
          toast.success('设备添加成功');
        }
        // 仅在提交成功时调用 onSuccess
        onSuccessCallback?.();
      } catch (error: unknown) {
        logger.error('Save device error:', error);
        logger.error(
          'Error response:',
          (error as { response?: { data?: unknown } }).response?.data,
        );
        toast.error(getAxiosErrorMessage(error, '操作失败'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, useCredential, isEditing, device, toast, onSuccessCallback],
  );

  const handleTestConnection = useCallback(async () => {
    if (!formData.ip_address) {
      toast.error('请先填写 IP 地址');
      return;
    }

    let testUsername = formData.username;
    const testPassword = formData.password;

    if (useCredential && formData.ssh_key_id) {
      const selectedCred = credentials.find((c) => c.id === formData.ssh_key_id);
      if (selectedCred?.auth_type === 'password') {
        testUsername = selectedCred.username || '';
        toast.info('使用凭证测试连接需要保存后执行');
        return;
      }
    }

    if (!testUsername || !testPassword) {
      toast.error('请先填写用户名和密码');
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    try {
      const response = await api.post('/network-devices/test-connection', {
        ip_address: formData.ip_address,
        ssh_port: formData.ssh_port,
        username: testUsername,
        password: testPassword,
      });

      const body = response.data as { success: boolean; error?: string; message?: string };
      setTestResult({
        success: !!body.success,
        message: body.error || body.message || '',
      });
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: getAxiosErrorMessage(error, '连接测试失败'),
      });
    } finally {
      setTestingConnection(false);
    }
  }, [formData, useCredential, credentials, toast]);

  const handleSnmpTest = useCallback(async () => {
    if (!formData.snmp_credential_id) {
      toast.error('请先选择 SNMP 凭证');
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const response = await api.post(`/snmp/credentials/${formData.snmp_credential_id}/test`, {
        host: formData.ip_address,
      });
      const body = response.data as { code?: number; message?: string };
      setTestResult({
        success: body.code === 0,
        message: body.message || (body.code === 0 ? 'SNMP 连接成功' : 'SNMP 连接失败'),
      });
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: getAxiosErrorMessage(error, 'SNMP 测试失败'),
      });
    } finally {
      setTestingConnection(false);
    }
  }, [formData.snmp_credential_id, formData.ip_address, toast]);

  return {
    isEditing,
    isSubmitting,
    testingConnection,
    testResult,
    useCredential,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    setUseCredential,

    snmpCredentials,
    credentials,

    handleSubmit,
    handleTestConnection,
    handleSnmpTest,
    getCredentialHost,

    setIsSubmitting,
  };
}
