import { Router, Request, Response } from 'express';
import { topologyService } from '../services/topologyService';

const router = Router();

router.get('/global', (_req: Request, res: Response) => {
  try {
    const topology = topologyService.getGlobalTopology();
    res.json({ success: true, data: topology });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/server/:id', (req: Request, res: Response) => {
  try {
    const topology = topologyService.getServerTopology(req.params.id);
    res.json({ success: true, data: topology });
  } catch (error) {
    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/dependency', (_req: Request, res: Response) => {
  try {
    const deps = topologyService.getAllDependencies();
    res.json({ success: true, data: deps });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/dependency', (req: Request, res: Response) => {
  try {
    const { source_server_id, target_server_id, dependency_type, protocol, port, metadata } = req.body;

    if (!source_server_id || !target_server_id || !dependency_type) {
      return res.status(400).json({ success: false, error: 'source_server_id, target_server_id, and dependency_type are required' });
    }

    const edge = topologyService.addDependency({
      source_server_id,
      target_server_id,
      dependency_type,
      protocol,
      port,
      metadata,
    });

    res.status(201).json({ success: true, data: edge });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/dependency/:id', (req: Request, res: Response) => {
  try {
    const deleted = topologyService.deleteDependency(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Dependency not found' });
    }
    res.json({ success: true, message: 'Dependency deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/discover/:id', async (req: Request, res: Response) => {
  try {
    const dependencies = await topologyService.discoverDependencies(req.params.id);
    res.json({ success: true, data: dependencies });
  } catch (error) {
    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/affected/:alertId', (req: Request, res: Response) => {
  try {
    const affected = topologyService.getAffectedServices(req.params.alertId);
    res.json({ success: true, data: affected });
  } catch (error) {
    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
