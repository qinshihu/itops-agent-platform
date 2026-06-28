import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Search, Loader2, CheckCircle2, AlertCircle, Play, Key, Radio,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';

const VERSIONS = ['v1', 'v2c', 'v3'];
const AUTH_PROTOCOLS = ['MD5', 'SHA'];
const PRIV_PROTOCOLS = ['DES', 'AES'];

interface SnmpCredential {
  id: string;
  name: string;
  host?: string;
  snmp_version: string;
  snmp_port: number;
  community?: string;
  snmp_user?: string;
  snmp_auth_protocol?: string;
  snmp_priv_protocol?: string;
  created_at: string;
  updated_at: string;
}

export default function SnmpCredentials() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ['snmp-credentials'],
    queryFn: () => api.get('/api/snmp/credentials').then(r => r.data.data || []),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', host: '', port: 161, version: 'v2c' as string,
    community: 'public', user: '', authProtocol: '' as string,
    authKey: '', privProtocol: '' as string, privKey: '',
  });
  const [showAuthKey, setShowAuthKey] = useState(false);
  const [showPrivKey, setShowPrivKey] = useState(false);

  const [testResult, setTestResult] = useState<{ host: string; status: 'testing' | 'success' | 'fail'; msg?: string } | null>(null);

  const testConn = useMutation({
    mutationFn: () => api.post('/api/snmp/test', {
      host: form.host, port: form.port, version: form.version, community: form.community,
    }),
    onMutate: () => setTestResult({ host: form.host, status: 'testing' }),
    onSuccess: (res) => {
      if (res.data.code === 0) {
        setTestResult({ host: form.host, status: 'success' });
      } else {
        setTestResult({ host: form.host, status: 'fail', msg: res.data.message || '连接失败' });
      }
    },
    onError: (err: any) => {
      setTestResult({ host: form.host, status: 'fail', msg: err.response?.data?.message || err.message });
    },
  });

  const saveCred = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, community: form.community, snmp_version: form.version,
        snmp_port: form.port, snmp_user: form.user || undefined,
        snmp_auth_protocol: form.authProtocol || undefined, snmp_auth_key: form.authKey || undefined,
        snmp_priv_protocol: form.privProtocol || undefined, snmp_priv_key: form.privKey || undefined,
        host: form.host || undefined,
      };
      return editingId ? api.put(`/api/snmp/credentials/${editingId}`, body) : api.post('/api/snmp/credentials', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snmp-credentials'] });
      setShowForm(false); setEditingId(null); resetForm();
    },
  });

  const deleteCred = useMutation({
    mutationFn: (id: string) => api.delete(`/api/snmp/credentials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['snmp-credentials'] }),
  });

  const [credTestResults, setCredTestResults] = useState<Record<string, { status: 'testing' | 'success' | 'fail'; msg?: string }>>({});

  const testCred = useMutation({
    mutationFn: (cred: SnmpCredential) => api.post(`/api/snmp/credentials/${cred.id}/test`, { host: cred.host || undefined }),
    onMutate: (cred) => setCredTestResults(prev => ({ ...prev, [cred.id]: { status: 'testing' } })),
    onSuccess: (res, cred) => {
      setCredTestResults(prev => ({ ...prev, [cred.id]: res.data?.code === 0 ? { status: 'success' } : { status: 'fail', msg: res.data?.message || '连接失败' } }));
      setTimeout(() => setCredTestResults(prev => { const n = { ...prev }; delete n[cred.id]; return n; }), 3000);
    },
    onError: (err: any, cred) => {
      setCredTestResults(prev => ({ ...prev, [cred.id]: { status: 'fail', msg: err.response?.data?.message || err.message } }));
      setTimeout(() => setCredTestResults(prev => { const n = { ...prev }; delete n[cred.id]; return n; }), 3000);
    },
  });

  const resetForm = () => {
    setForm({ name: '', host: '', port: 161, version: 'v2c', community: 'public', user: '', authProtocol: '', authKey: '', privProtocol: '', privKey: '' });
    setEditingId(null); setTestResult(null);
  };

  const filtered = (credentials as SnmpCredential[]).filter(c => {
    const q = searchQuery.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.host || '').includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="搜索凭证..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
        <button onClick={() => { setShowForm(!showForm); if (!showForm) { setEditingId(null); resetForm(); } }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />新增凭证
        </button>
      </div>

      {showForm && (
        <div className="bg-background rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-medium text-text-primary">{editingId ? '编辑 SNMP 凭证' : '新增 SNMP 凭证'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">凭证名称 *</label>
              <input type="text" placeholder="例如: 核心交换机" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">设备 IP/Host *</label>
              <input type="text" placeholder="192.168.1.1" value={form.host}
                onChange={e => setForm({ ...form, host: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">端口</label>
              <input type="number" min="1" max="65535" value={form.port}
                onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 161 })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">SNMP 版本</label>
              <select value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                {VERSIONS.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
              </select>
            </div>
            {form.version !== 'v3' ? (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Community</label>
                <input type="text" placeholder="public" value={form.community}
                  onChange={e => setForm({ ...form, community: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">用户名</label>
                  <input type="text" placeholder="SNMPv3 用户名" value={form.user}
                    onChange={e => setForm({ ...form, user: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">认证协议</label>
                  <div className="flex gap-2">
                    <select value={form.authProtocol} onChange={e => setForm({ ...form, authProtocol: e.target.value })}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">无</option>
                      {AUTH_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <input type={showAuthKey ? "text" : "password"} placeholder="认证密钥"
                        value={form.authKey}
                        onChange={e => setForm({ ...form, authKey: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary pr-8 focus:outline-none focus:border-primary"
                      />
                      <button type="button" onClick={() => setShowAuthKey(!showAuthKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                      >
                        {showAuthKey ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">加密协议</label>
                  <div className="flex gap-2">
                    <select value={form.privProtocol} onChange={e => setForm({ ...form, privProtocol: e.target.value })}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">无</option>
                      {PRIV_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <input type={showPrivKey ? "text" : "password"} placeholder="加密密钥"
                        value={form.privKey}
                        onChange={e => setForm({ ...form, privKey: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary pr-8 focus:outline-none focus:border-primary"
                      />
                      <button type="button" onClick={() => setShowPrivKey(!showPrivKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                      >
                        {showPrivKey ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => saveCred.mutate()} disabled={!form.name || !form.host}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saveCred.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editingId ? '保存修改' : '创建凭证'}
            </button>
            {form.host && (
              <button onClick={() => testConn.mutate()} disabled={testConn.isPending}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:border-emerald-400/50 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {testConn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-emerald-400" />}
                测试连接
              </button>
            )}
            {testResult && (
              <div className={clsx('flex items-center gap-2 text-sm', testResult.status === 'success' ? 'text-status-success' : 'text-status-failed')}>
                {testResult.status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                  testResult.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testResult.status === 'testing' ? '测试中...' : testResult.status === 'success' ? `连接 ${form.host} 成功` : testResult.msg}
              </div>
            )}
            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
              className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {credsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-border" />
                <div className="flex-1">
                  <div className="h-4 bg-border rounded w-1/3 mb-2" />
                  <div className="h-3 bg-border rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-text-secondary">
            <Radio className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{searchQuery ? '未找到匹配的凭证' : '暂无 SNMP 凭证'}</p>
          </div>
        ) : (
          filtered.map((cred) => (
            <div key={cred.id} className="bg-surface border border-border rounded-xl p-4 group hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{cred.name}</p>
                    <p className="text-xs text-text-tertiary">{cred.host || '-'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="px-2 py-0.5 rounded-full bg-slate-700/50">{cred.snmp_version.toUpperCase()}</span>
                <span>端口 {cred.snmp_port}</span>
                <span className="text-text-tertiary">|</span>
                <span>{cred.community ? `community: ${cred.community}` : `${cred.snmp_user || ''}`}</span>
              </div>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                <button onClick={() => { setEditingId(cred.id); setForm({
                    name: cred.name, host: cred.host || '', port: cred.snmp_port, version: cred.snmp_version,
                    community: cred.community || 'public', user: cred.snmp_user || '',
                    authProtocol: cred.snmp_auth_protocol || '', authKey: '', privProtocol: cred.snmp_priv_protocol || '', privKey: '',
                  }); setShowForm(true); }}
                  className="px-2 py-1 text-xs text-text-tertiary hover:text-blue-400 rounded-md hover:bg-blue-500/10 transition-colors"
                >
                  编辑
                </button>
                <button onClick={() => testCred.mutate(cred)}
                  className="px-2 py-1 text-xs text-text-tertiary hover:text-emerald-400 rounded-md hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                >
                  {credTestResults[cred.id]?.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {credTestResults[cred.id]?.status === 'success' ? '成功' : credTestResults[cred.id]?.status === 'fail' ? '失败' : '测试'}
                </button>
                <button onClick={() => deleteCred.mutate(cred.id)}
                  className="px-2 py-1 text-xs text-text-tertiary hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors ml-auto"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
