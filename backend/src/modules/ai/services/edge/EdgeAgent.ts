import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import type {
  EdgeAgentConfig,
  HostInfo,
  HostLoad,
  HostMetricPoint,
  ProcessListResponse,
  CollectorOutput,
  HeartbeatRequest,
  SkillExecutionResponse,
  PluginHealth,
  PromSample,
  SkillParams
} from './types';
import { EdgeAgentStatus } from './types';

// 系统指标收集器
interface Collector {
  collectAll(): Promise<CollectorOutput[]>;
  getHostInfo(): Promise<HostInfo>;
  getHostLoad(): Promise<HostLoad>;
  getProcessList(topN: number, sortBy: string): Promise<ProcessListResponse>;
}

// Skill 执行器
interface SkillExecutor {
  name: string;
  execute(params: SkillParams): Promise<SkillExecutionResponse>;
}

/**
 * 边缘代理核心类
 * 
 * 注意：这个类设计为在边缘节点（Edge Node）上运行的客户端代码。
 * 当前放在后端项目中是为了方便开发和演示。
 * 
 * ⚠️ 重要：实际部署时，这部分代码应该打包成独立的可执行程序，
 * 部署到需要监控的目标主机上，而不是和服务端一起运行。
 */
export class EdgeAgent extends EventEmitter {
  private config: EdgeAgentConfig;
  private status: EdgeAgentStatus = EdgeAgentStatus.OFFLINE;
  private agentId: string;
  private registered = false;
  // 注意：这里不使用直接的 WebSocket，而是预留接口
  // 实际客户端应该使用 socket.io-client 或其他库
  private collector: Collector | null = null;
  private skillExecutors: Map<string, SkillExecutor> = new Map();
  private pluginHealthFn: (() => PluginHealth[]) | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  // 缓冲区
  private metricsBuffer: PromSample[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  // 模拟的连接状态（演示用）
  private connected = false;

  constructor(config: EdgeAgentConfig) {
    super();
    this.config = {
      ...config,
      heartbeatInterval: config.heartbeatInterval || 30000,
      metricsInterval: config.metricsInterval || 10000,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      agentVersion: config.agentVersion || '1.0.0'
    };
    this.agentId = config.agentId || randomUUID();
  }

  /**
   * 设置收集器
   */
  setCollector(collector: Collector): void {
    this.collector = collector;
  }

  /**
   * 设置插件健康检查函数
   */
  setPluginHealthFn(fn: () => PluginHealth[]): void {
    this.pluginHealthFn = fn;
  }

  /**
   * 注册 Skill 执行器
   */
  registerSkillExecutor(executor: SkillExecutor): void {
    this.skillExecutors.set(executor.name, executor);
    logger.info(`[EdgeAgent] Registered skill: ${executor.name}`);
  }

  /**
   * 启动边缘代理（模拟实现，用于演示）
   */
  async start(): Promise<void> {
    logger.info(`[EdgeAgent] Starting edge agent: ${this.config.agentName}`);
    this.status = EdgeAgentStatus.CONNECTING;

    try {
      // 1. 模拟连接（实际应该连接服务端）
      await this.simulateConnect();

      // 2. 注册 Agent（模拟实现）
      await this.simulateRegister();

      // 3. 启动心跳（模拟）
      this.startHeartbeat();

      // 4. 启动指标收集
      this.startMetricsCollection();

      this.status = EdgeAgentStatus.ONLINE;
      this.connected = true;
      logger.info(`[EdgeAgent] Edge agent started successfully: ${this.agentId}`);

      this.emit('connected', { agentId: this.agentId });
    } catch (error) {
      this.status = EdgeAgentStatus.ERROR;
      logger.error('[EdgeAgent] Failed to start edge agent', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 模拟连接（临时实现，实际应该使用真实的 WebSocket 客户端）
   */
  private async simulateConnect(): Promise<void> {
    logger.info('[EdgeAgent] Simulating connection to server...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.info('[EdgeAgent] Simulated connection established');
  }

  /**
   * 模拟注册
   */
  private async simulateRegister(): Promise<void> {
    logger.info('[EdgeAgent] Simulating agent registration...');
    await new Promise(resolve => setTimeout(resolve, 500));
    this.registered = true;
    logger.info('[EdgeAgent] Simulated registration complete');
  }

  /**
   * 停止边缘代理
   */
  async stop(): Promise<void> {
    logger.info(`[EdgeAgent] Stopping edge agent: ${this.agentId}`);

    this.stopHeartbeat();
    this.stopMetricsCollection();

    this.status = EdgeAgentStatus.OFFLINE;
    this.registered = false;
    this.connected = false;
    this.emit('disconnected');
    logger.info('[EdgeAgent] Edge agent stopped');
  }

  /**
   * 启动心跳（模拟发送）
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // 立即发送一次
    this.sendHeartbeat();
  }

  /**
   * 发送心跳（模拟）
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.registered) {
      return;
    }

    try {
      const plugins: PluginHealth[] = this.pluginHealthFn ? this.pluginHealthFn() : [];
      const request: HeartbeatRequest = {
        agentId: this.agentId,
        timestamp: Date.now(),
        status: this.status,
        plugins
      };

      logger.debug(`[EdgeAgent] Simulated heartbeat: ${JSON.stringify(request)}`);
      // 实际场景下，这里应该发送到服务端
    } catch (error) {
      logger.warn('[EdgeAgent] Failed to send heartbeat', error);
    }
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    this.metricsTimer = setInterval(() => {
      this.collectAndPushMetrics();
    }, this.config.metricsInterval);

    // 立即收集一次
    this.collectAndPushMetrics();
  }

  /**
   * 停止指标收集
   */
  private stopMetricsCollection(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  /**
   * 收集并推送指标
   */
  private async collectAndPushMetrics(): Promise<void> {
    if (!this.collector || !this.registered) {
      return;
    }

    try {
      const outputs = await this.collector.collectAll();

      for (const output of outputs) {
        // 推送指标
        if (output.samples && output.samples.length > 0) {
          await this.pushMetrics(output.samples);
        }

        // 推送主机指标
        if (output.hostPoint) {
          await this.pushHostMetric(output.hostPoint);
        }
      }
    } catch (error) {
      logger.warn('[EdgeAgent] Failed to collect metrics', error);
    }
  }

  /**
   * 推送指标
   */
  private async pushMetrics(samples: PromSample[]): Promise<void> {
    // 将指标加入缓冲区
    this.metricsBuffer.push(...samples);

    // 缓冲区满了，发送（模拟）
    if (this.metricsBuffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flushMetricsBuffer();
    }
  }

  /**
   * 刷新指标缓冲区
   */
  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const samples = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      logger.debug(`[EdgeAgent] Simulated pushing ${samples.length} metrics samples`);
      // 实际场景下应该发送到服务端
    } catch (error) {
      // 推送失败，将指标放回缓冲区
      logger.warn('[EdgeAgent] Failed to push metrics', error);
      this.metricsBuffer.unshift(...samples);
    }
  }

  /**
   * 推送主机指标（模拟）
   */
  private async pushHostMetric(point: HostMetricPoint): Promise<void> {
    try {
      logger.debug(`[EdgeAgent] Simulated pushing host metric: CPU ${point.cpuUsage}%, Memory ${point.memoryUsage}%`);
      // 实际场景下应该发送到服务端
    } catch (error) {
      logger.warn('[EdgeAgent] Failed to push host metric', error);
    }
  }

  /**
   * 执行 Skill（内部调用，模拟服务端远程调用）
   */
  async executeSkill(skillName: string, params: SkillParams): Promise<SkillExecutionResponse> {
    const executor = this.skillExecutors.get(skillName);
    if (!executor) {
      return {
        success: false,
        output: '',
        error: `Unknown skill: ${skillName}`
      };
    }

    try {
      return await executor.execute(params);
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取 Agent 状态
   */
  getStatus(): EdgeAgentStatus {
    return this.status;
  }

  /**
   * 获取 Agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * 获取 Agent 是否连接
   */
  isConnected(): boolean {
    return this.connected;
  }
}
