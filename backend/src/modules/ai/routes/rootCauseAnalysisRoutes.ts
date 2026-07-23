import express from 'express';
import { rootCauseAnalysisService } from '../services/rca/rootCauseAnalysisService';
import { rcaJobManager } from '../services/rca/rcaJobManager';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';

const router = express.Router();

// 获取所有根因分析
router.get('/', (_req, res) => {
  try {
    const rcas = rootCauseAnalysisService.list();
    // 解析JSON字段
    const parsedRcas = rcas.map(rca => ({
      ...rca,
      symptoms: rca.symptoms ? JSON.parse(rca.symptoms) : [],
      timeline: rca.timeline ? JSON.parse(rca.timeline) : [],
      evidence: rca.evidence ? JSON.parse(rca.evidence) : [],
      recommendations: rca.recommendations ? JSON.parse(rca.recommendations) : []
    }));
    res.json({ success: true, data: parsedRcas });
  } catch (error: unknown) {
    logger.error('GET /root-cause-analysis failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to list RCA';
    res.status(500).json({ success: false, message });
  }
});

// 创建新的根因分析
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  try {
    const { alert_id, title, description } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: '标题是必填的' });
    }
    const rca = rootCauseAnalysisService.create({ alert_id, title, description });
    res.json({ success: true, data: rca });
  } catch (error: unknown) {
    logger.error('POST /root-cause-analysis failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create RCA';
    res.status(500).json({ success: false, message });
  }
});

// ★ 以下特殊路由必须在 /:id 之前注册，避免被 catch-all 匹配 ★

// 获取RCA统计信息
router.get('/stats', (_req, res) => {
  try {
    const stats = rootCauseAnalysisService.getStats();
    res.json({ success: true, data: stats });
  } catch (error: unknown) {
    logger.error('GET /root-cause-analysis/stats failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    res.status(500).json({ success: false, message });
  }
});

// 根据告警ID获取根因分析
router.get('/alert/:alertId', (req, res) => {
  try {
    const { alertId } = req.params;
    const rca = rootCauseAnalysisService.getByAlert(alertId);
    if (!rca) {
      return res.status(404).json({ success: false, message: '该告警没有关联的根因分析' });
    }
    // 解析JSON字段
    const parsedRca = {
      ...rca,
      symptoms: rca.symptoms ? JSON.parse(rca.symptoms) : [],
      timeline: rca.timeline ? JSON.parse(rca.timeline) : [],
      evidence: rca.evidence ? JSON.parse(rca.evidence) : [],
      recommendations: rca.recommendations ? JSON.parse(rca.recommendations) : []
    };
    res.json({ success: true, data: parsedRca });
  } catch (error: unknown) {
    logger.error('GET /root-cause-analysis/alert/:alertId failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to get RCA';
    res.status(500).json({ success: false, message });
  }
});

// 手动触发自动根因分析
router.post('/auto-analyze/:alertId', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const rca = await rootCauseAnalysisService.autoAnalyze(alertId);
    if (!rca) {
      return res.status(404).json({ success: false, message: '告警不存在或分析失败' });
    }
    const parsedRca = {
      ...rca,
      symptoms: rca.symptoms ? JSON.parse(rca.symptoms) : [],
      timeline: rca.timeline ? JSON.parse(rca.timeline) : [],
      evidence: rca.evidence ? JSON.parse(rca.evidence) : [],
      recommendations: rca.recommendations ? JSON.parse(rca.recommendations) : []
    };
    res.json({ success: true, data: parsedRca });
  } catch (error: unknown) {
    logger.error('POST /root-cause-analysis/auto-analyze/:alertId failed:', error);
    const message = error instanceof Error ? error.message : 'Auto-analyze failed';
    res.status(500).json({ success: false, message });
  }
});

// ★ 以下为 /:id 动态路由 ★

// 获取单个根因分析
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const rca = rootCauseAnalysisService.get(id);
    if (!rca) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    // 解析JSON字段
    const parsedRca = {
      ...rca,
      symptoms: rca.symptoms ? JSON.parse(rca.symptoms) : [],
      timeline: rca.timeline ? JSON.parse(rca.timeline) : [],
      evidence: rca.evidence ? JSON.parse(rca.evidence) : [],
      recommendations: rca.recommendations ? JSON.parse(rca.recommendations) : []
    };
    res.json({ success: true, data: parsedRca });
  } catch (error: unknown) {
    logger.error('GET /root-cause-analysis/:id failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to get RCA';
    res.status(500).json({ success: false, message });
  }
});

// 更新根因分析
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  try {
    const { id } = req.params;
    const updatedRca = rootCauseAnalysisService.update(id, req.body);
    if (!updatedRca) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    res.json({ success: true, data: updatedRca });
  } catch (error: unknown) {
    logger.error('PUT /root-cause-analysis/:id failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to update RCA';
    res.status(500).json({ success: false, message });
  }
});

// 执行根因分析（v4 新增：异步版本，立即返回 202 + jobId）
router.post('/:id/analyze-async', requireRole('admin', 'operator'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = rootCauseAnalysisService.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    const jobId = rcaJobManager.analyzeAsync(id);
    res.status(202).json({
      success: true,
      data: {
        jobId,
        rcaId: id,
        status: 'pending',
        pollUrl: `/root-cause-analysis/jobs/${jobId}`,
      },
      message: '分析任务已提交，请轮询 /jobs/:jobId 查询结果',
    });
  } catch (error: unknown) {
    logger.error('Failed to start async RCA job:', error);
    const message = error instanceof Error ? error.message : 'Failed to start analyze-async';
    res.status(500).json({ success: false, message });
  }
});

// v4 新增：查询异步任务状态（前端轮询）
router.get('/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = rcaJobManager.getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: '任务不存在或已过期' });
    }
    res.json({ success: true, data: job });
  } catch (error: unknown) {
    logger.error('GET /root-cause-analysis/jobs/:jobId failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to get job';
    res.status(500).json({ success: false, message });
  }
});

// 执行根因分析
router.post('/:id/analyze', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { id } = req.params;
    const analyzedRca = await rootCauseAnalysisService.analyze(id);
    if (!analyzedRca) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    // 解析JSON字段
    const parsedRca = {
      ...analyzedRca,
      symptoms: analyzedRca.symptoms ? JSON.parse(analyzedRca.symptoms) : [],
      timeline: analyzedRca.timeline ? JSON.parse(analyzedRca.timeline) : [],
      evidence: analyzedRca.evidence ? JSON.parse(analyzedRca.evidence) : [],
      recommendations: analyzedRca.recommendations ? JSON.parse(analyzedRca.recommendations) : []
    };
    res.json({ success: true, data: parsedRca });
  } catch (error: unknown) {
    logger.error('POST /root-cause-analysis/:id/analyze failed:', error);
    const message = error instanceof Error ? error.message : 'Analyze failed';
    res.status(500).json({ success: false, message });
  }
});

// 删除根因分析
router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  try {
    const { id } = req.params;
    const deleted = rootCauseAnalysisService.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error: unknown) {
    logger.error('DELETE /root-cause-analysis/:id failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete RCA';
    res.status(500).json({ success: false, message });
  }
});

export default router;