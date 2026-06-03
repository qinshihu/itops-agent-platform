import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Key, Lock, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface NetworkDevice {
  id?: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string;
  os_version?: string;
  ssh_port?: number;
  ssh_key_id?: string;
  username: string;
  password?: string;
  enable_password?: string;
  location?: string;
  role?: string;
}

interface Credential {
  id: string;
  name: string;
  auth_type: 'key' | 'password';
  key_type: string;
  username: string | null;
  description: string | null;
}

interface AddDeviceModalProps {
  device?: NetworkDevice | null;
  onClose: () => void;
  onSuccess: () => void;
}

const vendors = [
  { value: 'huawei', label: '华为 (Huawei)' },
  { value: 'cisco', label: '思科 (Cisco)' },
  { value: 'h3c', label: '华三 (H3C)' },
  { value: 'hikvision', label: '海康 (Hikvision)' },
  { value: 'ruijie', label: '锐捷 (Ruijie)' },
  { value: 'zte', label: '中兴 (ZTE)' }
];

const roles = [
  { value: 'router', label: '路由器' },
  { value: 'switch', label: '交换机' },
  { value: 'firewall', label: '防火墙' },
  { value: 'ap', label: '无线AP' },
  { value: 'other', label: '其他' }
];

export default function AddDeviceModal({ device, onClose, onSuccess }: AddDeviceModalProps) {
  const toast = useToast();
  const [isEditing] = useState(!!device);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [useCredential, setUseCredential] = useState(!!device?.ssh_key_id);

  useEscapeKey({ onEscape: onClose, enabled: !isSubmitting });
  
  const [formData, setFormData] = useState({
    name: device?.name || '',
    ip_address: device?.ip_address || '',
    vendor: device?.vendor || 'huawei',
    model: device?.model || '',
    os_version: device?.os_version || '',
    ssh_port: device?.ssh_port || 22,
    ssh_key_id: device?.ssh_key_id || '',
    username: device?.username || '',
    password: '',
    enable_password: '',
    location: device?.location || '',
    role: device?.role || 'switch'
  });

  // 获取认证凭证列表
  const { data: credentials = [] } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: () => api.get('/api/ssh-keys').then(res => res.data.data)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.ip_address) {
      toast.error('请填写设备名称和 IP 地址');
      return;
    }

    // 如果使用凭证，则不需要手动输入用户名密码
    if (!useCredential && (!formData.username || (!isEditing && !formData.password))) {
      toast.error('请选择认证凭证或手动输入用户名和密码');
      return;
    }

    setIsSubmitting(true);
    try {
      // 编辑模式下，如果密码为空，则不提交 password 和 enable_password 字段，避免覆盖原有密码
      const payload: Record<string, unknown> = { ...formData };

      if (isEditing) {
        if (!formData.password) {
          delete payload.password;
        }
        if (!formData.enable_password) {
          delete payload.enable_password;
        }
      }

      if (isEditing && device?.id) {
        await api.put(`/api/network-devices/${device.id}`, payload);
        toast.success('设备更新成功');
      } else {
        await api.post('/api/network-devices', payload);
        toast.success('设备添加成功');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Save device error:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || error.response?.data?.message || '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.ip_address) {
      toast.error('请先填写 IP 地址');
      return;
    }

    // 如果使用凭证，获取凭证中的认证信息
    let testUsername = formData.username;
    const testPassword = formData.password;
    
    if (useCredential && formData.ssh_key_id) {
      const selectedCred = credentials.find((c: Credential) => c.id === formData.ssh_key_id);
      if (selectedCred && selectedCred.auth_type === 'password') {
        testUsername = selectedCred.username || '';
        // 密码需要后端解密，这里简化处理
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
      const response = await api.post('/api/network-devices/test-connection', {
        ip_address: formData.ip_address,
        ssh_port: formData.ssh_port,
        username: testUsername,
        password: testPassword
      });
      
      setTestResult({
        success: response.data.success,
        message: response.data.error || response.data.message
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || '连接测试失败'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface rounded-t-xl z-10">
          <h3 className="text-base font-medium text-text-primary">
            {isEditing ? '编辑设备' : '添加网络设备'}
          </h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1">
                设备名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                value={formData.ip_address}
                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                placeholder="192.168.1.1"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">SSH 端口</label>
              <input
                type="number"
                value={formData.ssh_port}
                onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) || 22 })}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                厂商 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                {vendors.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">设备角色</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-2">认证方式</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUseCredential(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    useCredential
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border text-text-secondary hover:border-primary/50'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  选择凭证
                </button>
                <button
                  type="button"
                  onClick={() => setUseCredential(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    !useCredential
                      ? 'bg-orange-500/10 border-orange-500 text-orange-500'
                      : 'bg-background border-border text-text-secondary hover:border-orange-500/50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  手动输入
                </button>
              </div>
            </div>

            {useCredential ? (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  认证凭证 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.ssh_key_id}
                  onChange={(e) => setFormData({ ...formData, ssh_key_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  required
                >
                  <option value="">请选择认证凭证</option>
                  {credentials
                    .filter((c: Credential) => c.auth_type === 'password')
                    .map((cred: Credential) => (
                      <option key={cred.id} value={cred.id}>
                        {cred.name} ({cred.username || '无用户名'})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-text-secondary/60">
                  仅显示账号密码类型的凭证
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">用户名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    required={!useCredential}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    密码 {!isEditing && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={isEditing ? '留空则不修改' : '设备登录密码'}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    required={!isEditing && !useCredential}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Enable 密码</label>
              <input
                type="password"
                value={formData.enable_password}
                onChange={(e) => setFormData({ ...formData, enable_password: e.target.value })}
                placeholder="特权模式密码（可选）"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">设备型号</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="例：S5735-L48T4X-A"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1">位置</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="例：机房A-机柜3"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              testResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : '测试连接'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '确定'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
