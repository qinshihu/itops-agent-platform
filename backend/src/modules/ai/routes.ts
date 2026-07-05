import { Router } from 'express';
import agentRoutes from './routes/agentRoutes';
import knowledgeRoutes from './routes/knowledgeRoutes';
import copilotRoutes from './routes/copilotRoutes';
import rootCauseAnalysisRoutes from './routes/rootCauseAnalysisRoutes';
import multiAgentRoutes from './routes/multiAgentRoutes';
import aiModelRoutes from './routes/aiModelRoutes';
import aiRemediationRoutes from './routes/aiRemediationRoutes';
import knowledgeQAnythingRoutes from './routes/knowledgeQAnythingRoutes';
import { mcpGateway } from '../mcp/services';

const router = Router();

router.use('/agents', agentRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/copilot', copilotRoutes);
router.use('/root-cause-analysis', rootCauseAnalysisRoutes);
router.use('/multi-agent', multiAgentRoutes);
router.use('/ai-models', aiModelRoutes);
router.use('/ai-remediations', aiRemediationRoutes);
router.use('/knowledge/qanything', knowledgeQAnythingRoutes);
router.use('/mcp', mcpGateway);

export default router;
