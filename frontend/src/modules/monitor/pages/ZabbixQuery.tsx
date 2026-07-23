/**
 * Zabbix 主动查询页面
 *
 * 提供对 Zabbix API 的主动查询能力：
 *   - Hosts / Items / Triggers / Problems / History / 测试连接
 *
 * 请求统一走全局 api 实例（lib/api），后端封装在 /api/v1/monitor/zabbix/*。
 * 响应格式：{ success, data: { result: any[] }, error }。
 */

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Activity,
  Server,
  ListChecks,
  AlertTriangle,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import { message } from 'antd';
import api from '../../../lib/api';
import { getAxiosErrorMessage } from '../../../lib/errorHandler';
import { ResultsTable } from './zabbix/ResultsTable';
import {
  buildPayload,
  HOST_COLUMNS,
  ITEM_COLUMNS,
  TRIGGER_COLUMNS,
  PROBLEM_COLUMNS,
  HISTORY_COLUMNS,
} from './zabbix/types';
import type {
  ConnectionConfig,
  TabKey,
  ZabbixResponse,
  ZabbixHost,
  ZabbixItem,
  ZabbixTrigger,
  ZabbixProblem,
  ZabbixHistoryRow,
} from './zabbix/types';

// ==================== 常量 ====================

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'hosts', label: 'Hosts', icon: Server },
  { key: 'items', label: 'Items', icon: ListChecks },
  { key: 'triggers', label: 'Triggers', icon: AlertCircle },
  { key: 'problems', label: 'Problems', icon: AlertTriangle },
  { key: 'history', label: 'History', icon: Database },
  { key: 'test', label: '测试', icon: Activity },
];

async function callZabbix<T>(endpoint: string, payload: Record<string, unknown>): Promise<T[]> {
  // axios 拦截器已解包 → data 本身就是后端 data 字段（ZabbixResponse）
  const { data } = await api.post(endpoint, payload);
  const body = data as ZabbixResponse<T>;
  if (!body) {
    throw new Error('Zabbix 请求失败：响应为空');
  }
  if (body.error) {
    throw new Error(body.error);
  }
  return body.result ?? [];
}

// ==================== 主组件 ====================

export default function ZabbixQuery() {
  const [cfg, setCfg] = useState<ConnectionConfig>({
    url: '',
    username: '',
    password: '',
    apiToken: '',
    authMode: 'password',
    timeoutMs: 15000,
  });
  const [tab, setTab] = useState<TabKey>('hosts');
  const [loading, setLoading] = useState(false);
  const [hosts, setHosts] = useState<ZabbixHost[]>([]);
  const [items, setItems] = useState<ZabbixItem[]>([]);
  const [triggers, setTriggers] = useState<ZabbixTrigger[]>([]);
  const [problems, setProblems] = useState<ZabbixProblem[]>([]);
  const [history, setHistory] = useState<ZabbixHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedHostId, setSelectedHostId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [timeFrom, setTimeFrom] = useState<string>('');
  const [timeTill, setTimeTill] = useState<string>('');
  const [historyLimit, setHistoryLimit] = useState<number>(100);

  const canQuery = useMemo(() => cfg.url.trim().length > 0, [cfg.url]);

  const handleTest = async () => {
    if (!canQuery) {
      message.warning('请填写 Zabbix URL');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await callZabbix<unknown>('/monitor/zabbix/test', buildPayload(cfg));
      message.success('连接成功');
    } catch (err) {
      const msg = getAxiosErrorMessage(err, '连接失败');
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const runQuery = async () => {
    if (!canQuery) {
      message.warning('请填写 Zabbix URL');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = buildPayload(cfg);
      switch (tab) {
        case 'hosts':
          setHosts(await callZabbix<ZabbixHost>('/monitor/zabbix/hosts', payload));
          break;
        case 'items': {
          if (!selectedHostId) {
            message.warning('请选择 Host');
            setLoading(false);
            return;
          }
          setItems(
            await callZabbix<ZabbixItem>('/monitor/zabbix/items', {
              ...payload,
              hostIds: [selectedHostId],
            }),
          );
          break;
        }
        case 'triggers':
          setTriggers(await callZabbix<ZabbixTrigger>('/monitor/zabbix/triggers', payload));
          break;
        case 'problems':
          setProblems(await callZabbix<ZabbixProblem>('/monitor/zabbix/problems', payload));
          break;
        case 'history': {
          if (!selectedItemId) {
            message.warning('请选择 Item');
            setLoading(false);
            return;
          }
          setHistory(
            await callZabbix<ZabbixHistoryRow>('/monitor/zabbix/history', {
              ...payload,
              itemIds: [selectedItemId],
              timeFrom: timeFrom || undefined,
              timeTill: timeTill || undefined,
              limit: historyLimit,
            }),
          );
          break;
        }
        default:
          break;
      }
    } catch (err) {
      const msg = getAxiosErrorMessage(err, '查询失败');
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6 bg-background text-text-primary">
      <div className="flex items-center gap-3">
        <Activity size={26} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Zabbix 主动查询</h1>
          <p className="text-sm text-text-tertiary">直接对接 Zabbix JSON-RPC API，无需安装 Agent</p>
        </div>
      </div>

      <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <Plug size={16} /> 连接配置
          </h3>
          <button
            type="button"
            onClick={handleTest}
            disabled={!canQuery || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            测试连接
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs text-text-secondary mb-1">Zabbix API URL</label>
            <input
              type="text"
              placeholder="http://zabbix.example.com/api_jsonrpc.php"
              value={cfg.url}
              onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">超时 (ms)</label>
            <input
              type="number"
              min={1000}
              value={cfg.timeoutMs}
              onChange={(e) => setCfg({ ...cfg, timeoutMs: Number(e.target.value) || 15000 })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setCfg({ ...cfg, authMode: 'password' })}
            className={clsx(
              'px-3 py-1 rounded-md border',
              cfg.authMode === 'password'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-border text-text-secondary',
            )}
          >
            用户名密码
          </button>
          <button
            type="button"
            onClick={() => setCfg({ ...cfg, authMode: 'token' })}
            className={clsx(
              'px-3 py-1 rounded-md border',
              cfg.authMode === 'token'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-border text-text-secondary',
            )}
          >
            API Token
          </button>
        </div>

        {cfg.authMode === 'password' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Username</label>
              <input
                type="text"
                value={cfg.username}
                onChange={(e) => setCfg({ ...cfg, username: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Password</label>
              <input
                type="password"
                value={cfg.password}
                onChange={(e) => setCfg({ ...cfg, password: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-text-secondary mb-1">API Token</label>
            <input
              type="text"
              value={cfg.apiToken}
              onChange={(e) => setCfg({ ...cfg, apiToken: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary/50"
            />
          </div>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition',
                  active
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'border-border text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'items' && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">选择 Host</label>
            <select
              value={selectedHostId}
              onChange={(e) => setSelectedHostId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary"
            >
              <option value="">-- 请先获取 Hosts --</option>
              {hosts.map((h) => (
                <option key={h.hostid} value={h.hostid}>
                  {h.host} ({h.name})
                </option>
              ))}
            </select>
          </div>
        )}

        {tab === 'history' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">选择 Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary"
              >
                <option value="">-- 请先获取 Items --</option>
                {items.map((it) => (
                  <option key={it.itemid} value={it.itemid}>
                    {it.name} ({it.key_})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">timeFrom (Unix)</label>
              <input
                type="text"
                placeholder="0 = 不限"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">timeTill (Unix)</label>
              <input
                type="text"
                placeholder="留空 = 当前"
                value={timeTill}
                onChange={(e) => setTimeTill(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Limit</label>
              <input
                type="number"
                min={1}
                value={historyLimit}
                onChange={(e) => setHistoryLimit(Number(e.target.value) || 100)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={runQuery}
          disabled={!canQuery || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          执行查询
        </button>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        {error && (
          <div className="mb-3 flex items-center gap-2 text-status-failed text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {tab === 'hosts' && (
          <ResultsTable<ZabbixHost> rows={hosts} loading={loading} columns={HOST_COLUMNS} />
        )}
        {tab === 'items' && (
          <ResultsTable<ZabbixItem> rows={items} loading={loading} columns={ITEM_COLUMNS} />
        )}
        {tab === 'triggers' && (
          <ResultsTable<ZabbixTrigger>
            rows={triggers}
            loading={loading}
            columns={TRIGGER_COLUMNS}
          />
        )}
        {tab === 'problems' && (
          <ResultsTable<ZabbixProblem>
            rows={problems}
            loading={loading}
            columns={PROBLEM_COLUMNS}
          />
        )}
        {tab === 'history' && (
          <ResultsTable<ZabbixHistoryRow>
            rows={history}
            loading={loading}
            columns={HISTORY_COLUMNS}
          />
        )}
        {tab === 'test' && !loading && (
          <div className="text-text-secondary text-sm py-4">
            点击上方「测试连接」按钮验证 Zabbix 配置。
          </div>
        )}
      </section>
    </div>
  );
}
