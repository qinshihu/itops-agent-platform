/**
 * 服务注册中心（组装层 / Composition Root）
 * 
 * 位于 src/ 根级别，不在 core/ 中
 * 原因：它负责组装所有模块，按照架构约束规则，
 * 组装层可以依赖所有模块，而 core/ 不能依赖 modules/
 * 
 * 参照 ongrid 的 cmd/ 层（assembly layer）模式
 */

import { container } from './core/serviceContainer';
import { logger } from './utils/logger';
import type { Server as SocketIOServer } from 'socket.io';
import { alertRepository, agentExecutionRepository, dcRepository, settingsRepository, serverRepository, agentRepository, networkDeviceRepository, workflowRepository, knowledgeRepository, userRepository, remediationPolicyRepository, remediationAuditRepository, virtualMachineRepository, dbConnectionRepository, infraRepository, analyticsRepository, snmpRepository, networkSubnetRepository } from './repositories';

// 服务导入
import { initAlertService } from './modules/alerts/services/alertService';
import { reportService } from './modules/infra/services/reportService';
import { copilotService } from './modules/ai/services/agents/copilotService';
import { rootCauseAnalysisService } from './modules/ai/services/rca/rootCauseAnalysisService';
import { schedulerService } from './modules/workflow/services/schedulerService';
import { notificationService } from './modules/notification/services/notificationService';
import { remediationService } from './modules/auto/services/remediationService';
import { backupService } from './modules/backup/services';
import { credentialService } from './modules/auth/services/credentialService';
import { queueService } from './modules/workflow/services/queueService';
import { selfMonitorService } from './modules/monitor/services/selfMonitorService';
import { snmpPollingService } from './modules/network/services/snmpPollingService';
import { alertAutoAnalyzer } from './modules/alerts/services/alertAutoAnalyzer';
import { alertCorrelationService } from './modules/alerts/services/alertCorrelationService';
import { alertAutoResponseService } from './modules/alerts/services/alertAutoResponse/alertAutoResponseService';
import { alertProcessor } from './modules/alerts/services/AlertProcessor';
import { knowledgeEngine } from './modules/ai/services/KnowledgeEngine';
import { dockerService } from './modules/containers/services/dockerService';
import { configTemplateService } from './modules/config-management/services/configTemplateService';
import { kubernetesService } from './modules/kubernetes/services/kubernetesService';
import { autoScaleService } from './modules/auto/services/autoScaleService';
import { vmSnapshotSchedulerService } from './modules/containers/services/vmSnapshotSchedulerService';
import { multiHostDockerService } from './modules/containers/services/multiHostDockerService';
import { initTokenBlacklist } from './modules/auth/services/tokenBlacklist';
import { migrateEncryptionKeys } from './modules/auth/services/encryptionService';
import { startCircuitBreakerCleanup } from './modules/ai/services/llm/llmService';
import { startDCStatusPush, stopDCStatusPush } from './modules/dc/services/dcStatusService';
import { initializeProviders } from './modules/ai/services/providers';
import { registerAllPlatformTools } from './modules/mcp/services';
import { initializeMultiAgentSystem } from './modules/ai/services/multiAgent';

/**
 * 注册所有服务到容器
 */
export function registerAllServices(): void {
  // === MCP 工具注册（最先执行，供后续服务使用） ===
  registerAllPlatformTools();

  // === 无依赖的基础服务 ===

  // 加密密钥迁移（v1→v2，best-effort，失败不阻塞）
  container.register('encryptionMigration', () => {
    migrateEncryptionKeys();
    return { name: 'encryptionMigration' };
  }, []);

  container.register('credentialService', () => {
    credentialService.init();
    return credentialService;
  }, [], {
    shutdown: () => { /* noop */ }
  });

  container.register('tokenBlacklist', () => {
    initTokenBlacklist();
    return { name: 'tokenBlacklist' };
  }, []);

  container.register('providers', () => {
    initializeProviders();
    return { name: 'providers' };
  }, []);

  // === Repository 层（阶段 5B：注册到 DI 容器，测试时可替换为 mock）===
  // Repository 无服务层依赖（直接访问 db），dependencies = []
  container.register('alertRepository', () => alertRepository, []);
  container.register('agentExecutionRepository', () => agentExecutionRepository, []);
  container.register('dcRepository', () => dcRepository, []);
  container.register('settingsRepository', () => settingsRepository, []);
  container.register('serverRepository', () => serverRepository, []);
  container.register('agentRepository', () => agentRepository, []);
  container.register('networkDeviceRepository', () => networkDeviceRepository, []);
  container.register('workflowRepository', () => workflowRepository, []);
  container.register('knowledgeRepository', () => knowledgeRepository, []);
  container.register('userRepository', () => userRepository, []);
  container.register('remediationPolicyRepository', () => remediationPolicyRepository, []);
  container.register('remediationAuditRepository', () => remediationAuditRepository, []);
  container.register('virtualMachineRepository', () => virtualMachineRepository, []);
  container.register('dbConnectionRepository', () => dbConnectionRepository, []);
  container.register('infraRepository', () => infraRepository, []);
  container.register('analyticsRepository', () => analyticsRepository, []);
  container.register('snmpRepository', () => snmpRepository, []);
  container.register('networkSubnetRepository', () => networkSubnetRepository, []);

  // === 核心业务服务 ===

  container.register('alertService', () => {
    initAlertService();
    return { name: 'alertService' };
  }, ['rootCauseAnalysisService', 'credentialService']);

  container.register('reportService', () => {
    reportService.init();
    return reportService;
  }, [], {
    shutdown: () => { /* noop */ }
  });

  container.register('copilotService', () => {
    copilotService.init();
    return copilotService;
  }, []);

  container.register('rootCauseAnalysisService', () => {
    rootCauseAnalysisService.init();
    return rootCauseAnalysisService;
  }, []);

  container.register('multiAgentSystem', () => {
    initializeMultiAgentSystem();
    return { name: 'multiAgentSystem' };
  }, []);

  container.register('schedulerService', () => {
    schedulerService.init();
    return schedulerService;
  }, [], {
    shutdown: () => schedulerService.shutdown()
  });

  container.register('notificationService', () => {
    notificationService.init();
    return notificationService;
  }, ['credentialService']);

  container.register('remediationService', () => {
    remediationService.init();
    return remediationService;
  }, ['notificationService', 'rootCauseAnalysisService']);

  container.register('backupService', () => {
    backupService.init();
    return backupService;
  }, [], {
    shutdown: () => backupService.stopAutoBackup()
  });

  // === 异步任务服务 ===

  container.register('queueService', () => {
    queueService.init();
    return queueService;
  }, [], {
    shutdown: async () => { await queueService.shutdown(); }
  });

  container.register('selfMonitorService', () => {
    selfMonitorService.init();
    return selfMonitorService;
  }, [], {
    shutdown: () => selfMonitorService.shutdown()
  });

  // === 监控与轮询服务 ===

  container.register('snmpPollingService', () => {
    snmpPollingService.start();
    return snmpPollingService;
  }, [], {
    shutdown: () => { /* stop handled elsewhere */ }
  });

  container.register('alertAutoAnalyzer', () => {
    alertAutoAnalyzer.start();
    return alertAutoAnalyzer;
  }, ['remediationService'], {
    shutdown: () => { /* stop handled elsewhere */ }
  });

  container.register('alertCorrelationService', () => {
    alertCorrelationService.start();
    return alertCorrelationService;
  }, [], {
    shutdown: () => alertCorrelationService.stop()
  });

  container.register('alertAutoResponseService', () => {
    alertAutoResponseService.start();
    return alertAutoResponseService;
  }, ['notificationService']);

  container.register('alertProcessor', () => {
    alertProcessor.init();
    return alertProcessor;
  }, ['alertAutoResponseService', 'remediationService', 'knowledgeEngine']);

  container.register('knowledgeEngine', () => {
    knowledgeEngine.init();
    return knowledgeEngine;
  }, []);

  // === 容器与虚拟化服务 ===

  container.register('dockerService', () => {
    dockerService.init().catch((err: Error) => {
      logger.warn('Docker service initialization failed (non-fatal)', err);
    });
    return dockerService;
  }, []);

  container.register('configTemplateService', () => {
    configTemplateService.init();
    return configTemplateService;
  }, []);

  // P0-P3: 启动运行时加载器（schema 已下沉到 migration v044-v050）
  container.register('containerVMRuntime', () => {
    kubernetesService.initialize();
    autoScaleService.initialize();
    vmSnapshotSchedulerService.initialize();
    multiHostDockerService.initialize();
    return { name: 'containerVMRuntime' };
  }, []);

  // === 基础设施 ===

  container.register('circuitBreaker', () => {
    startCircuitBreakerCleanup();
    return { name: 'circuitBreaker' };
  }, []);

  container.register('dcStatusPush', (ctx) => {
    const io = ctx.tryGet<SocketIOServer>('io');
    if (io) {
      startDCStatusPush(io, 5000);
    } else {
      logger.warn('[serviceRegistry] Socket.io instance not registered, dcStatusPush will not start');
    }
    return { name: 'dcStatusPush' };
  }, [], {
    shutdown: () => stopDCStatusPush()
  });
}

/**
 * 便捷函数：初始化所有服务
 */
export async function initAllServices(): Promise<void> {
  registerAllServices();
  await container.initAll();
}

/**
 * 便捷函数：关闭所有服务
 */
export async function shutdownAllServices(): Promise<void> {
  await container.shutdownAll();
}
