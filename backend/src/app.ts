import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
// eslint-disable-next-line no-restricted-imports -- app entry point, must initialize database
import { initializeDatabase, setIOInstance } from './models/database';
import { healthService } from './modules/monitor/services/healthService';
import { registerAllModules } from './modules/_registry';
import { initAllServices, shutdownAllServices } from './serviceRegistry';
import { container } from './core/serviceContainer';
import { setupWebSocket } from './shared/websocket/handler';
import { vncProxyService } from './modules/network/services/vncProxyService';
import { setupSwagger } from './swagger';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOptions = {
  origin: [
    frontendUrl,
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

let httpServer: http.Server | null = null;
let io: SocketIOServer | null = null;
let isShuttingDown = false;

const initApp = async () => {
  try {
    logger.info('正在初始化数据库...');
    await initializeDatabase();
    logger.info('数据库初始化成功！');

    // 创建 HTTP 服务器 + Socket.io 实例（在服务初始化前完成）
    httpServer = http.createServer(app);
    io = new SocketIOServer(httpServer, {
      cors: corsOptions,
      path: '/socket.io/'
    });
    setIOInstance(io);
    setupWebSocket(io);
    vncProxyService.initialize(io);
    logger.info('Socket.io 初始化成功！');

    // 将 io 实例注册到 DI 容器（dcStatusPush 等服务依赖它）
    container.register('io', () => io, []);

    logger.info('正在初始化所有服务...');
    await initAllServices();
    logger.info('所有服务初始化成功！');

    logger.info('正在注册模块路由...');
    registerAllModules(app);
    logger.info('模块路由注册成功！');

    // 设置 Swagger API 文档
    setupSwagger(app);
    logger.info('Swagger 文档已就绪，访问 /api-docs');

    logger.info('正在启动服务...');
    httpServer.listen(PORT, () => {
      logger.info(`🚀 服务已启动在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

// ============================================================
// Graceful Shutdown
// ============================================================
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`收到 ${signal} 但已在关闭中，忽略`);
    return;
  }
  isShuttingDown = true;

  logger.info(`收到 ${signal}，开始优雅关闭...`);

  // 1. 停止接受新请求
  if (httpServer) {
    logger.info('正在关闭 HTTP 服务器...');
    httpServer.close();
  }

  // 2. 关闭 WebSocket
  if (io) {
    logger.info('正在关闭 Socket.io...');
    io.close();
  }

  // 3. 关闭所有服务（逆序）
  try {
    logger.info('正在关闭所有服务...');
    await shutdownAllServices();
    logger.info('所有服务已关闭');
  } catch (err) {
    logger.error('服务关闭出错:', err as Error);
  }

  // 4. 退出
  logger.info('优雅关闭完成，退出进程');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // 不立即退出，让日志刷新
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason as Error);
});

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

initApp();

export default app;
