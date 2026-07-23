import type { Request, Response } from 'express';
import { Router } from 'express';
import { kubernetesService } from '../services/kubernetesService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { logger } from '../../../utils/logger';

const router = Router();

// ── 集群管理 ──

// 列出所有已连接集群
router.get('/contexts', async (_req: Request, res: Response) => {
  try {
    const data = kubernetesService.listContexts();
    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// 导入 kubeconfig（添加集群）
router.post('/contexts', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    if (!config) return res.status(400).json({ success: false, message: '请提供 kubeconfig 内容' });
    const ctx = await kubernetesService.addContext(config);
    res.json({ success: true, data: ctx });
  } catch (err: unknown) {
    logger.error('Failed to add k8s context:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// 测试 kubeconfig 连接
router.post(
  '/contexts/test',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const { config } = req.body;
      if (!config)
        return res.status(400).json({ success: false, message: '请提供 kubeconfig 内容' });
      const result = await kubernetesService.testContext(config);
      res.json({ success: true, data: result });
    } catch (err: unknown) {
      logger.error('Failed to test k8s context:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// 删除集群
router.delete(
  '/contexts/:id',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await kubernetesService.deleteContext(req.params.id);
      res.json({ success: true });
    } catch (err: unknown) {
      logger.error('Failed to delete k8s context:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// ── 核心资源 ──

// 2026-07-23 修复：所有读端点加 requireRole + logger.error（之前 viewer 可读但无 RBAC）
router.get(
  '/namespaces',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const data = await kubernetesService.listNamespaces(req.query.context as string | undefined);
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to list namespaces:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.get(
  '/pods',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const ns = (req.query.namespace as string) || 'default';
      const data = await kubernetesService.listPods(ns, req.query.context as string | undefined);
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to list pods:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.get(
  '/deployments',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const ns = (req.query.namespace as string) || 'default';
      const data = await kubernetesService.listDeployments(
        ns,
        req.query.context as string | undefined,
      );
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to list deployments:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.get(
  '/services',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const ns = (req.query.namespace as string) || 'default';
      const data = await kubernetesService.listServices(
        ns,
        req.query.context as string | undefined,
      );
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to list services:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.get(
  '/nodes',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const data = await kubernetesService.listNodes(req.query.context as string | undefined);
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to list nodes:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.get(
  '/pods/:namespace/:name',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const data = await kubernetesService.getPod(
        req.params.namespace,
        req.params.name,
        req.query.context as string | undefined,
      );
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to get pod:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.get(
  '/pods/:namespace/:name/logs',
  requireRole('admin', 'operator', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const tail = parseInt(req.query.tail as string) || 100;
      const data = await kubernetesService.getPodLogs(
        req.params.namespace,
        req.params.name,
        tail,
        req.query.context as string | undefined,
      );
      res.json({ success: true, data });
    } catch (err: unknown) {
      logger.error('Failed to get pod logs:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.delete(
  '/pods/:namespace/:name',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      await kubernetesService.deletePod(
        req.params.namespace,
        req.params.name,
        req.query.context as string | undefined,
      );
      res.json({ success: true, message: 'Pod 已删除' });
    } catch (err: unknown) {
      logger.error('Failed to delete pod:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.put(
  '/deployments/:namespace/:name/scale',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isAvailable())
        return res
          .status(503)
          .json({ success: false, message: 'K8s 不可用，请先导入 kubeconfig 配置' });
      const { replicas } = req.body;
      if (replicas === null || replicas === undefined)
        return res.status(400).json({ success: false, message: '需要副本数' });
      await kubernetesService.scaleDeployment(
        req.params.namespace,
        req.params.name,
        replicas,
        req.query.context as string | undefined,
      );
      res.json({ success: true, message: `已扩缩容到 ${replicas} 副本` });
    } catch (err: unknown) {
      logger.error('Failed to scale deployment:', err);
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

export default router;
