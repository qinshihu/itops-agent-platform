import type { Request, Response } from 'express';
import { Router } from 'express';
import { validateBody } from '../../../middleware/validation';
import { prometheusSchemas } from '../../../shared/schemas/apiValidation';
import {
  prometheusService,
  type PrometheusClientOptions,
  type PrometheusQueryResult,
  type PrometheusSeriesResult,
} from '../services/prometheusService';
import { logger } from '../../../utils/logger';

function pickClientOptions(body: Record<string, unknown>): PrometheusClientOptions {
  const url = typeof body.url === 'string' ? body.url : '';
  const opts: PrometheusClientOptions = { url };
  if (body.basicAuth && typeof body.basicAuth === 'object') {
    const ba = body.basicAuth as { username?: string; password?: string };
    if (ba.username) {
      opts.basicAuth = {
        username: ba.username,
        password: typeof ba.password === 'string' ? ba.password : '',
      };
    }
  }
  if (typeof body.bearerToken === 'string' && body.bearerToken.length > 0) {
    opts.bearerToken = body.bearerToken;
  }
  if (typeof body.timeoutMs === 'number' && body.timeoutMs > 0) {
    opts.timeoutMs = body.timeoutMs;
  }
  return opts;
}

const router = Router();

// POST /api/v1/monitor/prometheus/query
router.post(
  '/query',
  validateBody(prometheusSchemas.query),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { promql: string; time?: string };
      const opts = pickClientOptions(req.body);
      const result = await prometheusService.query(body.promql, {
        ...opts,
        ...(body.time ? { time: body.time } : {}),
      });
      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error });
      }
      const data = (result.data ?? { resultType: 'vector', result: [] }) as PrometheusQueryResult;
      return res.json({ success: true, data });
    } catch (err) {
      logger.error('Prometheus query failed:', err);
      return res.status(500).json({ success: false, error: 'Prometheus 查询失败' });
    }
  },
);

// POST /api/v1/monitor/prometheus/query-range
router.post(
  '/query-range',
  validateBody(prometheusSchemas.queryRange),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        promql: string;
        start: string | number;
        end: string | number;
        step: string | number;
      };
      const opts = pickClientOptions(req.body);
      const result = await prometheusService.queryRange(
        body.promql,
        body.start,
        body.end,
        body.step,
        opts,
      );
      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error });
      }
      const data = (result.data ?? { resultType: 'matrix', result: [] }) as PrometheusQueryResult;
      return res.json({ success: true, data });
    } catch (err) {
      logger.error('Prometheus query_range failed:', err);
      return res.status(500).json({ success: false, error: 'Prometheus 范围查询失败' });
    }
  },
);

// POST /api/v1/monitor/prometheus/series
router.post(
  '/series',
  validateBody(prometheusSchemas.series),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        match: string[];
        start?: string;
        end?: string;
      };
      const opts = pickClientOptions(req.body);
      const result = await prometheusService.getSeries(body.match, {
        ...opts,
        ...(body.start ? { start: body.start } : {}),
        ...(body.end ? { end: body.end } : {}),
      });
      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error });
      }
      const data = (result.data ?? []) as PrometheusSeriesResult;
      return res.json({ success: true, data });
    } catch (err) {
      logger.error('Prometheus series failed:', err);
      return res.status(500).json({ success: false, error: 'Prometheus series 查询失败' });
    }
  },
);

// POST /api/v1/monitor/prometheus/test
router.post(
  '/test',
  validateBody(prometheusSchemas.base),
  async (req: Request, res: Response) => {
    try {
      const opts = pickClientOptions(req.body);
      const result = await prometheusService.checkConnection(opts);
      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: result.error,
          data: result.data,
        });
      }
      return res.json({ success: true, data: result.data });
    } catch (err) {
      logger.error('Prometheus connection test failed:', err);
      return res.status(500).json({ success: false, error: 'Prometheus 连接测试失败' });
    }
  },
);

export default router;
