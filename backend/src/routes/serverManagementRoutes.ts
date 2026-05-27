import { Router } from 'express';
import { serverInfoCollector } from '../services/serverInfoCollector';
import { serverImportService } from '../services/serverImportService';

const router = Router();

router.post('/:id/collect-info', async (req, res) => {
  try {
    const result = await serverInfoCollector.collectServerInfo(req.params.id);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/collect-all', async (_req, res) => {
  try {
    const result = await serverInfoCollector.collectAllServers();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/collect-metrics', async (req, res) => {
  try {
    const result = await serverInfoCollector.collectServerMetrics(req.params.id);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/collect-all-metrics', async (_req, res) => {
  try {
    const result = await serverInfoCollector.collectAllServerMetrics();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { servers, test_connection } = req.body as {
      servers: Array<{
        name: string;
        hostname: string;
        port?: number;
        username: string;
        password?: string;
        private_key?: string;
        use_ssh_key?: number;
        description?: string;
        tags?: string[];
        group_id?: string;
      }>;
      test_connection?: boolean;
    };

    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      res.status(400).json({ success: false, error: '请提供服务器列表数据' });
      return;
    }

    const validation = serverImportService.validateServers(servers);
    if (!validation.valid) {
      res.status(400).json({ success: false, error: '数据验证失败', details: validation.errors });
      return;
    }

    const result = await serverImportService.importServers(servers, test_connection !== false);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.get('/import-template', (_req, res) => {
  const template = {
    columns: ['name', 'hostname', 'port', 'username', 'password', 'use_ssh_key', 'description', 'tags'],
    example: [
      {
        name: 'Web服务器-01',
        hostname: '192.168.1.10',
        port: 22,
        username: 'root',
        password: 'password123',
        use_ssh_key: 0,
        description: '生产环境Web服务器',
        tags: 'production,web'
      }
    ]
  };
  res.json({ success: true, data: template });
});

export default router;
