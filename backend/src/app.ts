import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeDatabase, setIOInstance, db } from './models/database';
import { setupWebSocket } from './websocket/handler';
import agentRoutes from './routes/agentRoutes';
import workflowRoutes from './routes/workflowRoutes';
import taskRoutes from './routes/taskRoutes';
import alertRoutes from './routes/alertRoutes';
import knowledgeRoutes from './routes/knowledgeRoutes';
import reportRoutes from './routes/reportRoutes';
import settingsRoutes from './routes/settingsRoutes';
import serverRoutes from './routes/serverRoutes';
import serverCommandRoutes from './routes/serverCommandRoutes';
import scriptRoutes from './routes/scriptRoutes';
import auditRoutes from './routes/auditRoutes';
import notificationRoutes from './routes/notificationRoutes';
import webhookRoutes from './routes/webhookRoutes';
import userRoutes from './routes/userRoutes';
import scheduledTaskRoutes from './routes/scheduledTaskRoutes';
import alertMappingRoutes from './routes/alertMappingRoutes';
import notificationConfigRoutes from './routes/notificationConfigRoutes';
import authRoutes from './routes/authRoutes';
import copilotRoutes from './routes/copilotRoutes';
import alertNoiseRoutes from './routes/alertNoiseRoutes';
import rootCauseAnalysisRoutes from './routes/rootCauseAnalysisRoutes';
import multiAgentRoutes from './routes/multiAgentRoutes';
import serverGroupRoutes from './routes/serverGroupRoutes';
import serverManagementRoutes from './routes/serverManagementRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import remediationPolicyRoutes from './routes/remediationPolicyRoutes';
import remediationExecutionRoutes from './routes/remediationExecutionRoutes';
import remediationAuditRoutes from './routes/remediationAuditRoutes';
import backupRoutes from './routes/backupRoutes';
import databaseRoutes from './routes/databaseRoutes';
import knowledgeQAnythingRoutes from './routes/knowledgeQAnythingRoutes';
import vncRoutes from './routes/vncRoutes';
import networkDeviceRoutes from './routes/networkDeviceRoutes';
import networkAdvancedRoutes from './routes/networkAdvancedRoutes';
import snmpRoutes from './routes/snmpRoutes';
import sshKeyRoutes from './routes/sshKeyRoutes';
import topologyRoutes from './routes/topologyRoutes';
import changeRoutes from './routes/changeRoutes';
import aiModelRoutes from './routes/aiModelRoutes';
import { schedulerService } from './services/schedulerService';
import { reportService } from './services/reportService';
import { copilotService } from './services/copilotService';
import { rootCauseAnalysisService } from './services/rootCauseAnalysisService';
import { notificationService } from './services/notificationService';
import { remediationService } from './services/remediationService';
import { vncProxyService } from './services/vncProxyService';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authenticateToken, requirePasswordChange } from './middleware/auth';
import { rateLimiter, webhookIpFilter } from './middleware/rateLimiter';
import { traceMiddleware } from './middleware/trace';
import { env } from './utils/env';
import { logger } from './utils/logger';
import { initTokenBlacklist } from './services/tokenBlacklist';
import { startCircuitBreakerCleanup } from './services/llmService';
import { credentialService } from './services/credentialService';
import { healthService } from './services/healthService';
import { backupService } from './services/backupService';
import { selfMonitorService } from './services/selfMonitorService';
import { snmpPollingService } from './services/snmpPollingService';
import { alertAutoAnalyzer } from './services/alertAutoAnalyzer';
import { alertCorrelationService } from './services/alertCorrelationService';
import { setServerInstances } from './services/restartService';
import { queueService } from './services/queueService';
import importExportRouter from './routes/importExportRoutes';
import alertAutoRouter from './routes/alertAutoRoutes';
import linkageRouter from './routes/linkageRoutes';
import networkDiscoveryRouter from './routes/networkDiscoveryRoutes';
import alertCorrelationRouter from './routes/alertCorrelationRoutes';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e6, // 1MB max message size to prevent memory exhaustion
  pingTimeout: 60000,
  pingInterval: 25000
});

setServerInstances(httpServer, io);

app.use(helmet());
app.use(traceMiddleware);
app.use(morgan('combined'));
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

import { initAlertService } from './services/alertService';

async function initializeApp() {
  await initializeDatabase();
  
  // 初始化各个服务
  initAlertService();
  reportService.init();
  copilotService.init();
  rootCauseAnalysisService.init();
  schedulerService.init();
  notificationService.init();
  remediationService.init();
  backupService.init();
  // Initialize credential service (encrypted storage for API keys)
  credentialService.init();
  
  // Migrate existing plaintext API keys from settings table to encrypted credentials
  try {
    const migrationResult = credentialService.migrateFromSettings();
    if (migrationResult.migrated > 0) {
      logger.warn(`⚠️ Migrated ${migrationResult.migrated} API keys from plaintext settings to encrypted credentials`);
      logger.warn('⚠️ Old plaintext keys remain in settings table for backwards compatibility');
      logger.warn('⚠️ It is recommended to remove them via admin/cleanup-settings endpoint once migration is verified');
    }
  } catch (migrationError) {
    logger.warn('Credential migration encountered errors (non-fatal)', migrationError as Error);
  }

  // Initialize queue service (async task execution)
  queueService.init();
  
  // Initialize self-monitor service (periodic health checks)
  selfMonitorService.init();
  
  // Initialize SNMP polling service (periodic device inspection)
  snmpPollingService.start();
  
  // Initialize alert auto-analyzer (AI-powered alert diagnosis)
  alertAutoAnalyzer.start();
  
  // Initialize alert correlation service
  alertCorrelationService.start();
  
  initTokenBlacklist();
  startCircuitBreakerCleanup();
  
  logger.info('✅ Application initialization complete');
}

setupWebSocket(io);
setIOInstance(io);
vncProxyService.initialize(io);

// 公开路由 - 添加速率限制但不需要认证
app.use('/api/auth', rateLimiter, authRoutes);

// Webhook 路由不需要认证（外部系统推送告警）
app.use('/api/webhooks', webhookIpFilter, rateLimiter, webhookRoutes);

// 健康检查 - 不需要认证
app.get('/health', async (_req, res) => {
  const health = await healthService.checkHealth();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req, res) => {
  const health = await healthService.checkHealth();
  const isReady = health.status === 'healthy' || health.status === 'degraded';
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    status: health.status,
    checks: health.checks
  });
});

// 以下所有路由都需要认证
app.use(authenticateToken);

// 注意: /api/auth 路由已在公开路由中注册（line 118），此处不重复注册
// 已认证的用户通过公开路由的 authRoutes 访问

// 健康检查接口（已认证）- 无需强制改密码检查
app.get('/api/health/summary', (_req, res) => {
  const summary = healthService.getHealthSummary();
  res.json({ success: true, data: summary });
});
app.get('/api/health/history', (_req, res) => {
  const history = healthService.getHealthHistory();
  res.json({ success: true, data: history });
});
app.get('/api/health/monitor', async (_req, res) => {
  const report = selfMonitorService.getLastReport();
  if (!report) {
    res.json({ success: false, message: 'No monitor report yet, service still initializing' });
    return;
  }
  res.json({ success: true, data: report });
});
app.get('/api/health/monitor/alerts', (_req, res) => {
  const alerts = selfMonitorService.getAlertHistory();
  res.json({ success: true, data: alerts });
});

// 以下所有路由需要检查是否已修改初始密码
app.use(requirePasswordChange);

// 受保护的路由 - 也应用速率限制
app.use('/api/copilot', rateLimiter, copilotRoutes);
app.use('/api/agents', rateLimiter, agentRoutes);
app.use('/api/workflows', rateLimiter, workflowRoutes);
app.use('/api/tasks', rateLimiter, taskRoutes);
app.use('/api/alerts', rateLimiter, alertRoutes);
app.use('/api/knowledge', rateLimiter, knowledgeRoutes);
app.use('/api/reports', rateLimiter, reportRoutes);
app.use('/api/settings', rateLimiter, settingsRoutes);
app.use('/api/servers', rateLimiter, serverRoutes);
app.use('/api/server-commands', rateLimiter, serverCommandRoutes);
app.use('/api/server-groups', rateLimiter, serverGroupRoutes);
app.use('/api/server-management', rateLimiter, serverManagementRoutes);
app.use('/api/scripts', rateLimiter, scriptRoutes);
app.use('/api/audit', rateLimiter, auditRoutes);
app.use('/api/notifications', rateLimiter, notificationRoutes);
app.use('/api/users', rateLimiter, userRoutes);
app.use('/api/scheduled-tasks', rateLimiter, scheduledTaskRoutes);
app.use('/api/alert-mappings', rateLimiter, alertMappingRoutes);
app.use('/api/notification-config', rateLimiter, notificationConfigRoutes);
app.use('/api/alert-noise', rateLimiter, alertNoiseRoutes);
app.use('/api/root-cause-analysis', rateLimiter, rootCauseAnalysisRoutes);
app.use('/api/multi-agent', rateLimiter, multiAgentRoutes);
app.use('/api/dashboard', rateLimiter, dashboardRoutes);
app.use('/api/remediation-policies', rateLimiter, remediationPolicyRoutes);
app.use('/api/remediation-executions', rateLimiter, remediationExecutionRoutes);
app.use('/api/remediation-audits', rateLimiter, remediationAuditRoutes);
app.use('/api/backups', rateLimiter, backupRoutes);
app.use('/api/database', rateLimiter, databaseRoutes);
app.use('/api/knowledge/qanything', rateLimiter, knowledgeQAnythingRoutes);
app.use('/api/import-export', rateLimiter, importExportRouter);
app.use('/api/vnc', rateLimiter, vncRoutes);
app.use('/api/network-devices', rateLimiter, networkDeviceRoutes);
app.use('/api/network-advanced', rateLimiter, networkAdvancedRoutes);
app.use('/api/snmp', rateLimiter, snmpRoutes);
app.use('/api/ssh-keys', rateLimiter, sshKeyRoutes);
app.use('/api/topology', rateLimiter, topologyRoutes);
app.use('/api/changes', rateLimiter, changeRoutes);
app.use('/api/ai-models', rateLimiter, aiModelRoutes);
app.use('/api', rateLimiter, alertAutoRouter);
app.use('/api', rateLimiter, linkageRouter);
app.use('/api', rateLimiter, networkDiscoveryRouter);
app.use('/api', rateLimiter, alertCorrelationRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = env.PORT;
const HOST = process.env.HOST || '0.0.0.0';

// 等待数据库初始化完成后再启动 HTTP 服务器，避免竞态
async function startServer() {
  await initializeApp();
  
  httpServer.listen(PORT, HOST, () => {
    logger.info(`🚀 ITOps Agent Platform Backend running on ${HOST}:${PORT}`);
    logger.info(`📡 WebSocket server ready`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  });
}

startServer().catch(error => {
  logger.error('❌ Failed to start server', error);
  process.exit(1);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    await Promise.all([
      new Promise<void>((resolve) => httpServer.close(() => {
        logger.info('HTTP server closed');
        resolve();
      })),
      new Promise<void>((resolve) => io.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      }))
    ]);

    schedulerService.shutdown();
    logger.info('Scheduler service stopped');

    backupService.stopAutoBackup();
    logger.info('Backup service stopped');

    await queueService.shutdown();
    logger.info('Queue service stopped');

    selfMonitorService.shutdown();
    logger.info('Self-monitor service stopped');

    alertCorrelationService.stop();
    logger.info('Alert correlation service stopped');

    db.close();
    logger.info('Database connection closed');

    logger.shutdown();
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

export { app, io };
