/**
 * Zabbix JSON-RPC 客户端
 *
 * 实现 Zabbix JSON-RPC API 2.0 标准方法：
 *   - user.login / user.logout
 *   - host.get / item.get / trigger.get / history.get / problem.get
 *
 * 参考：https://www.zabbix.com/documentation/current/en/manual/api/reference
 *
 * 返回统一格式 `{ success: boolean, data?: T, error?: string }`。
 * 错误来源：网络失败 / JSON-RPC 协议 error / Zabbix 业务错误。
 */

import axios, { type AxiosError } from 'axios';
import { logger } from '../../../utils/logger';

// ============ 基础类型 ============

export interface ZabbixClientOptions {
  /** Zabbix JSON-RPC 端点，例如 http://zabbix-server/api_jsonrpc.php */
  url: string;
  /** 用于 user.login 的用户名（apiToken 模式可省略） */
  username?: string;
  /** 用于 user.login 的密码（apiToken 模式可省略） */
  password?: string;
  /** 已签发的 Zabbix API token；提供后跳过 login，直接用于后续请求 */
  apiToken?: string;
  /** HTTP 请求超时（毫秒），默认 10000 */
  timeoutMs?: number;
}

export interface ZabbixLoginResult {
  auth?: string;
  success: boolean;
  error?: string;
}

export interface ZabbixRpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ZabbixHost {
  hostid: string;
  host: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ZabbixItem {
  itemid: string;
  hostid: string;
  name: string;
  key_: string;
  lastvalue?: string;
  units?: string;
  [key: string]: unknown;
}

export interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority?: string;
  value?: string;
  hosts?: Array<{ hostid: string; host: string }>;
  [key: string]: unknown;
}

export interface ZabbixProblem {
  eventid: string;
  name: string;
  severity: string;
  hostid?: string;
  clock?: string;
  acknowledged?: string;
  tags?: Array<{ tag: string; value: string }>;
  [key: string]: unknown;
}

export interface ZabbixHistoryEntry {
  itemid: string;
  clock: string;
  value: string;
  ns?: string;
}

export interface ZabbixRpcError {
  code: number;
  message: string;
  data?: string;
}

export interface ZabbixRpcEnvelope<T> {
  jsonrpc: '2.0';
  result?: T;
  error?: ZabbixRpcError;
  id: number;
}

// ============ 客户端实现 ============

const DEFAULT_TIMEOUT_MS = 10000;

class ZabbixService {
  /**
   * user.login：使用 username/password 换取 auth token。
   */
  async login(opts: ZabbixClientOptions): Promise<ZabbixLoginResult> {
    if (!opts.username || !opts.password) {
      return { success: false, error: 'login 需要提供 username 和 password' };
    }

    const result = await this.rpcRequest<unknown>(
      'user.login',
      { username: opts.username, password: opts.password },
      { url: opts.url, timeoutMs: opts.timeoutMs }
    );

    if (!result.success || typeof result.data !== 'string') {
      return {
        success: false,
        error: result.error ?? 'login 返回数据格式错误',
      };
    }

    return { auth: result.data, success: true };
  }

  /**
   * user.logout：释放已签发的 auth token。
   */
  async logout(auth: string, opts: ZabbixClientOptions): Promise<ZabbixRpcResult<boolean>> {
    return this.rpcRequest<boolean>('user.logout', [], {
      url: opts.url,
      apiToken: auth,
      timeoutMs: opts.timeoutMs,
    });
  }

  /**
   * host.get：列出或筛选主机。
   */
  async getHosts(
    auth: string,
    filter?: Record<string, string>,
    opts?: ZabbixClientOptions
  ): Promise<ZabbixRpcResult<ZabbixHost[]>> {
    const params: Record<string, unknown> = { output: 'extend' };
    if (filter && Object.keys(filter).length > 0) {
      params.filter = filter;
    }

    return this.rpcRequest<ZabbixHost[]>('host.get', params, {
      url: opts?.url ?? '',
      apiToken: auth,
      timeoutMs: opts?.timeoutMs,
    });
  }

  /**
   * item.get：按 hostids 或 itemids 列出监控项。
   */
  async getItems(
    auth: string,
    hostIds?: Array<string | number>,
    opts?: ZabbixClientOptions & {
      itemIds?: Array<string | number>;
      output?: 'extend' | string[];
      filter?: Record<string, unknown>;
    }
  ): Promise<ZabbixRpcResult<ZabbixItem[]>> {
    const params: Record<string, unknown> = {
      output: opts?.output ?? 'extend',
    };
    if (hostIds && hostIds.length > 0) params.hostids = hostIds;
    if (opts?.itemIds && opts.itemIds.length > 0) params.itemids = opts.itemIds;
    if (opts?.filter && Object.keys(opts.filter).length > 0) params.filter = opts.filter;

    return this.rpcRequest<ZabbixItem[]>('item.get', params, {
      url: opts?.url ?? '',
      apiToken: auth,
      timeoutMs: opts?.timeoutMs,
    });
  }

  /**
   * trigger.get：查询触发器列表（可按 hostids/triggerids/active 过滤）。
   */
  async getTriggers(
    auth: string,
    opts?: ZabbixClientOptions & {
      triggerIds?: Array<string | number>;
      hostIds?: Array<string | number>;
      output?: 'extend' | string[];
      filter?: Record<string, unknown>;
      onlyActive?: boolean;
    }
  ): Promise<ZabbixRpcResult<ZabbixTrigger[]>> {
    const params: Record<string, unknown> = {
      output: opts?.output ?? 'extend',
    };
    if (opts?.triggerIds && opts.triggerIds.length > 0) params.triggerids = opts.triggerIds;
    if (opts?.hostIds && opts.hostIds.length > 0) params.hostids = opts.hostIds;
    if (opts?.filter && Object.keys(opts.filter).length > 0) params.filter = opts.filter;
    if (opts?.onlyActive) params.only_true = 1;

    return this.rpcRequest<ZabbixTrigger[]>('trigger.get', params, {
      url: opts?.url ?? '',
      apiToken: auth,
      timeoutMs: opts?.timeoutMs,
    });
  }

  /**
   * history.get：查询监控项历史数据。
   *
   * @param itemIds 监控项 ID 列表（必填）
   * @param timeFrom 时间起点（Unix 时间戳，可选）
   * @param timeTill 时间终点（Unix 时间戳，可选）
   * @param opts 其他选项：history（取值类型 0/1/2/3/4）、limit 等
   */
  async getHistory(
    auth: string,
    itemIds: Array<string | number>,
    timeFrom?: number,
    timeTill?: number,
    opts?: ZabbixClientOptions & {
      history?: number;
      limit?: number;
    }
  ): Promise<ZabbixRpcResult<ZabbixHistoryEntry[]>> {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { success: false, error: 'history.get 需要至少一个 itemid' };
    }

    const params: Record<string, unknown> = {
      output: 'extend',
      itemids: itemIds,
      history: opts?.history ?? 0,
      sortfield: 'clock',
      sortorder: 'DESC',
    };
    if (typeof timeFrom === 'number') params.time_from = timeFrom;
    if (typeof timeTill === 'number') params.time_till = timeTill;
    if (typeof opts?.limit === 'number') params.limit = opts.limit;

    return this.rpcRequest<ZabbixHistoryEntry[]>('history.get', params, {
      url: opts?.url ?? '',
      apiToken: auth,
      timeoutMs: opts?.timeoutMs,
    });
  }

  /**
   * problem.get：查询当前未恢复的故障。
   */
  async getProblems(
    auth: string,
    opts?: ZabbixClientOptions & {
      hostIds?: Array<string | number>;
      severity?: Array<string | number>;
      recent?: boolean;
      limit?: number;
    }
  ): Promise<ZabbixRpcResult<ZabbixProblem[]>> {
    const params: Record<string, unknown> = {
      output: 'extend',
      recent: opts?.recent ?? false,
      sortfield: ['eventid'],
      sortorder: 'DESC',
    };
    if (opts?.hostIds && opts.hostIds.length > 0) params.hostids = opts.hostIds;
    if (opts?.severity && opts.severity.length > 0) params.severities = opts.severity;
    if (typeof opts?.limit === 'number') params.limit = opts.limit;

    return this.rpcRequest<ZabbixProblem[]>('problem.get', params, {
      url: opts?.url ?? '',
      apiToken: auth,
      timeoutMs: opts?.timeoutMs,
    });
  }

  /**
   * testConnection：登录后立即 logout，用于验证凭证。
   */
  async testConnection(opts: ZabbixClientOptions): Promise<ZabbixRpcResult<{ reachable: boolean; authenticated: boolean }>> {
    if (!opts.url) {
      return { success: false, error: 'url 不能为空' };
    }

    let auth: string | undefined = opts.apiToken;
    if (!auth) {
      const loginResult = await this.login(opts);
      if (!loginResult.success || !loginResult.auth) {
        return {
          success: false,
          error: loginResult.error ?? '认证失败',
          data: { reachable: true, authenticated: false },
        };
      }
      auth = loginResult.auth;
    }

    // 通过 host.get 试探权限（Zabbix 至少要允许读取 host）
    const probe = await this.getHosts(auth, undefined, { url: opts.url, timeoutMs: opts.timeoutMs });
    if (!probe.success) {
      return {
        success: false,
        error: probe.error ?? 'host.get 探测失败',
        data: { reachable: true, authenticated: true },
      };
    }

    // 如果是本次临时签发的 token，登出释放
    if (!opts.apiToken) {
      await this.logout(auth, { url: opts.url, timeoutMs: opts.timeoutMs });
    }

    return {
      success: true,
      data: { reachable: true, authenticated: true },
    };
  }

  // ============ 内部方法 ============

  /**
   * 统一的 JSON-RPC 请求方法。
   * 处理：网络错误、HTTP 4xx/5xx、JSON-RPC 协议 error。
   */
  private async rpcRequest<T>(
    method: string,
    params: unknown,
    opts: { url: string; apiToken?: string; timeoutMs?: number }
  ): Promise<ZabbixRpcResult<T>> {
    if (!opts.url) {
      return { success: false, error: 'Zabbix URL 未配置' };
    }

    const body: Record<string, unknown> = {
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    };
    if (opts.apiToken) body.auth = opts.apiToken;

    try {
      const response = await axios.post<ZabbixRpcEnvelope<T>>(opts.url, body, {
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json-rpc' },
        // axios 默认会把非 2xx 视为异常，但 Zabbix 会把错误放在 200 body 里。
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        const dataStr = typeof response.data === 'string' ? response.data : '';
        return {
          success: false,
          error: `Zabbix HTTP ${response.status}: ${dataStr.slice(0, 200) || '非 JSON 响应'}`,
        };
      }

      const data = response.data;
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Zabbix 响应格式错误：非 JSON 对象' };
      }

      if (data.error) {
        return {
          success: false,
          error: `Zabbix RPC error ${data.error.code}: ${data.error.message}${data.error.data ? ` (${data.error.data})` : ''}`,
        };
      }

      if (!('result' in data)) {
        return { success: false, error: 'Zabbix 响应缺少 result 字段' };
      }

      return { success: true, data: data.result as T };
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.code === 'ECONNABORTED') {
        return { success: false, error: `Zabbix 请求超时（${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms）` };
      }
      logger.error(`Zabbix RPC 调用失败 [${method}]`, axiosErr);
      return {
        success: false,
        error: axiosErr.message ?? `Zabbix 请求失败: ${method}`,
      };
    }
  }
}

export const zabbixService = new ZabbixService();