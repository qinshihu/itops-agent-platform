/**
 * AI 模块前端路由定义
 */
import { lazy } from 'react';

const Agents = lazy(() => import('./pages/Agents'));
const AgentToolsPage = lazy(() => import('./pages/agents/AgentToolsPage'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const RootCauseAnalysis = lazy(() => import('./pages/RootCauseAnalysis'));
const RCADetail = lazy(() => import('./pages/RCADetail'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const AiRemediations = lazy(() => import('./pages/AiRemediations'));

export const aiRoutes = [
  { path: 'agents', element: Agents },
  { path: 'agents/tools', element: AgentToolsPage },  // v4 修复：指向独立工具管理页
  { path: 'knowledge', element: Knowledge },
  { path: 'root-cause-analysis', element: RootCauseAnalysis },
  // v2 改造：原 ai-root-cause（v1 AIRootCause.tsx）已合并到 RootCauseAnalysis
  // 保留旧路径指向同一页面，避免侧边栏 / 书签 404
  { path: 'ai-root-cause', element: RootCauseAnalysis },
  { path: 'ai-root-cause/:id', element: RCADetail },
  { path: 'ai-insights', element: AIInsights },
  // AI 模型管理已合并到 系统设置 -> AI 模型（/settings 页面的 models tab）
  { path: 'ai-remediations', element: AiRemediations },
];
