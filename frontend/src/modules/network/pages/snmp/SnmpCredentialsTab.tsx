import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Network, Plus, Trash2, Play, Loader2, CheckCircle2, AlertCircle,
  Search, Eye, EyeOff, Key, Radio,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../../lib/api';
import type { SnmpCredential, ApiError } from './types';
import { VERSIONS, AUTH_PROTOCOLS, PRIV_PROTOCOLS, INITIAL_FORM, type SnmpCredentialForm } from './types';

interface SnmpCredentialsTabProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}

export function SnmpCredentialsTab({ searchQuery, setSearchQuery }: SnmpCredentialsTabProps) {
  const queryClient = useQueryClient();

  // ── 凭证列表 ──
  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ['snmp-credentials'],
    queryFn: () => api.get('/snmp/credentials').then(r => r.data.data || []),
  });

  // ── 新建/编辑 表单 ──
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SnmpCredentialForm>(INITIAL_FORM);
  const [showAuthKey, setShowAuthKey] = useState(false);
  const [showPrivKey, setShowPrivKey] = useState(false);

  // ── 连接测试 ──
  const [testResult, setTestResult] = useState<{ host: string; status: 'testing' | 'success' | 'fail'; msg?: string } | null>(null);

  const testConn = useMutation({
    mutationFn: () => api.post('/snmp/test', {
      host: form.host,
      port: form.port,
      version: form.version,
      community: form.community,
    }),
    onMutate: () => setTestResult({ host: form.host, status: 'testing' }),
    onSuccess: (res) => {
      if (res.data?.code === 0) {
        setTestResult({ host: form.host, status: 'success' });
      } else {
        setTestResult({ host: form.host, status: 'fail', msg: res.data?.message || '连接失败' });
      }
    },
    onError: (err: ApiError) => {
      setTestResult({ host: form.host, status: 'fail', msg: err.response?.data?.message || err.message });
    },
  });

  const saveCred = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        community: form.community,
        snmp_version: form.version,
        snmp_port: form.port,
        snmp_user: form.user || undefined,
        snmp_auth_protocol: form.authProtocol || undefined,
        snmp_auth_key: form.authKey || undefined,
        snmp_priv_protocol: form.privProtocol || undefined,
        snmp_priv_key: form.privKey || undefined,
        host: form.host || undefined,
      };
      if (editingId) {
        return api.put(`/snmp/credentials/${editingId}`, body);
      }
      return api.post('/snmp/credentials', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snmp-credentials'] });
      setShowForm(false);
      setEditingId(null);
      resetForm();
    },
  });

  const deleteCred = useMutation({
    mutationFn: (id: string) => api.delete(`/snmp/credentials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['snmp-credentials'] }),
  });

  // 凭证列表中的测试按钮（使用存储的凭证信息）
  const [credTestResults, setCredTestResults] = useState<Record<string, { status: 'testing' | 'success' | 'fail'; msg?: string }>>({});

  const testCred = useMutation({
    mutationFn: (cred: SnmpCredential) => api.post(`/snmp/credentials/${cred.id}/test`, { host: cred.host || undefined }),
    onMutate: (cred) => {
      setCredTestResults(prev => ({ ...prev, [cred.id]: { status: 'testing' } }));
    },
    onSuccess: (res, cred) => {
      setCredTestResults(prev => ({
        ...prev,
        [cred.id]: res.data?.code === 0
          ? { status: 'success' }
          : { status: 'fail', msg: res.data?.message || '连接失败' },
      }));
      setTimeout(() => setCredTestResults(prev => { const n = { ...prev }; delete n[cred.id]; return n; }), 3000);
    },
    onError: (err: ApiError, cred: SnmpCredential) => {
      setCredTestResults(prev => ({
        ...prev,
        [cred.id]: { status: 'fail', msg: err.response?.data?.message || err.message },
      }));
      setTimeout(() => setCredTestResults(prev => { const n = { ...prev }; delete n[cred.id]; return n; }), 3000);
    },
  });

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setTestResult(null);
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="搜索凭证..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
        <button onClick={() => { setShowForm(!showForm); if (!showForm) { setEditingId(null); resetForm(); } }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          新增凭证
        </button>
      </div>

      {/* 新增表单 */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-medium text-text-primary">{editingId ? '编辑 SNMP 凭证' : '新增 SNMP 凭证'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">凭证名称 *</label>
              <input type="text" placeholder="例如: 核心交换机"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">设备 IP/Host *</label>
              <input type="text" placeholder="192.168.1.1"
                value={form.host}
                onChange={e => setForm({ ...form, host: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">端口</label>
              <input type="number" min="1" max="65535"
                value={form.port}
                onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 161 })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">SNMP 版本</label>
              <select value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                {VERSIONS.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
              </select>
            </div>
            {form.version !== 'v3' ? (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Community</label>
                <input type="text" placeholder="public"
                  value={form.community}
                  onChange={e => setForm({ ...form, community: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">用户名</label>
                  <input type="text"
                    value={form.user}
                    onChange={e => setForm({ ...form, user: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">认证协议</label>
                  <select value={form.authProtocol}
                    onChange={e => setForm({ ...form, authProtocol: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="">无</option>
                    {AUTH_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">认证密钥</label>
                  <div className="relative">
                    <input type={showAuthKey ? 'text' : 'password'}
                      value={form.authKey}
                      onChange={e => setForm({ ...form, authKey: e.target.value })}
                      className="w-full px-3 py-2 pr-8 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                    />
                    <button type="button" onClick={() => setShowAuthKey(!showAuthKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                    >{showAuthKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">加密协议</label>
                  <select value={form.privProtocol}
                    onChange={e => setForm({ ...form, privProtocol: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="">无</option>
                    {PRIV_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">加密密钥</label>
                  <div className="relative">
                    <input type={showPrivKey ? 'text' : 'password'}
                      value={form.privKey}
                      onChange={e => setForm({ ...form, privKey: e.target.value })}
                      className="w-full px-3 py-2 pr-8 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                    />
                    <button type="button" onClick={() => setShowPrivKey(!showPrivKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                    >{showPrivKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-2">
            {testResult?.host === form.host && testResult.status === 'testing' && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 测试连接中...
              </span>
            )}
            {testResult?.status === 'success' && (
              <span className="flex items-center gap-1.5 text-xs text-status-success">
                <CheckCircle2 className="w-3.5 h-3.5" /> 连接成功
              </span>
            )}
            {testResult?.status === 'fail' && (
              <span className="flex items-center gap-1.5 text-xs text-status-failed">
                <AlertCircle className="w-3.5 h-3.5" /> {testResult.msg}
              </span>
            )}
            <div className="flex-1" />
            {form.host && (
              <button onClick={() => testConn.mutate()} disabled={testConn.isPending}
                className="px-3 py-1.5 text-xs bg-surface border border-border text-text-secondary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {testConn.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                测试连接
              </button>
            )}
            <button onClick={() => { setShowForm(false); resetForm(); }}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >取消</button>
            <button onClick={() => saveCred.mutate()} disabled={!form.name || !form.host || saveCred.isPending}
              className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 text-sm flex items-center gap-1.5"
            >
              {saveCred.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? '更新凭证' : '保存凭证'}
            </button>
          </div>
        </div>
      )}

      {/* 凭证列表 */}
      <div className="space-y-2">
        {credsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Radio className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无 SNMP 凭证</p>
            <p className="text-xs mt-1">点击"新增凭证"添加网络设备的 SNMP 配置</p>
          </div>
        ) : (
          credentials.filter((c: SnmpCredential) =>
            !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.snmp_user || '').toLowerCase().includes(searchQuery.toLowerCase())
          ).map((cred: SnmpCredential) => (
            <div key={cred.id}
              className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">{cred.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span>SNMP {cred.snmp_version.toUpperCase()}</span>
                    <span>端口 {cred.snmp_port}</span>
                    {cred.snmp_user && <span>用户 {cred.snmp_user}</span>}
                    {cred.snmp_auth_protocol && <span>认证 {cred.snmp_auth_protocol}</span>}
                    {cred.host && <span>IP {cred.host}</span>}
                    {cred.snmp_priv_protocol && <span>加密 {cred.snmp_priv_protocol}</span>}
                    <span>创建于 {new Date(cred.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {credTestResults[cred.id]?.status === 'testing' && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                )}
                {credTestResults[cred.id]?.status === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-status-success" />
                )}
                {credTestResults[cred.id]?.status === 'fail' && (
                  <span className="text-xs text-status-failed">{credTestResults[cred.id].msg}</span>
                )}

                <button onClick={() => testCred.mutate(cred)}
                  disabled={testCred.isPending}
                  className="p-2 text-text-tertiary hover:text-primary transition-colors"
                  title="测试连接"
                >
                  <Play className="w-4 h-4" />
                </button>

                <button onClick={() => {
                  setEditingId(cred.id);
                  setForm({
                    name: cred.name,
                    host: cred.host || '',
                    port: cred.snmp_port,
                    version: cred.snmp_version,
                    community: cred.community || 'public',
                    user: cred.snmp_user || '',
                    authProtocol: cred.snmp_auth_protocol || '',
                    authKey: '',
                    privProtocol: cred.snmp_priv_protocol || '',
                    privKey: '',
                  });
                  setShowForm(true);
                }}
                  className="p-2 text-text-tertiary hover:text-emerald-400 transition-colors"
                  title="编辑"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button onClick={() => deleteCred.mutate(cred.id)}
                  className="p-2 text-text-tertiary hover:text-status-failed transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
