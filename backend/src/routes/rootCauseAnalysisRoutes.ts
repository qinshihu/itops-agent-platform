import express from 'express';
import { rootCauseAnalysisService } from '../services/rootCauseAnalysisService';

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
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 创建新的根因分析
router.post('/', (req, res) => {
  try {
    const { alert_id, title, description } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: '标题是必填的' });
    }
    const rca = rootCauseAnalysisService.create({ alert_id, title, description });
    res.json({ success: true, data: rca });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// ★ 以下特殊路由必须在 /:id 之前注册，避免被 catch-all 匹配 ★

// 获取RCA统计信息
router.get('/stats', (_req, res) => {
  try {
    const stats = rootCauseAnalysisService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
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
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 手动触发自动根因分析
router.post('/auto-analyze/:alertId', async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
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
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 更新根因分析
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updatedRca = rootCauseAnalysisService.update(id, req.body);
    if (!updatedRca) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    res.json({ success: true, data: updatedRca });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 执行根因分析
router.post('/:id/analyze', async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// 删除根因分析
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = rootCauseAnalysisService.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '根因分析不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
