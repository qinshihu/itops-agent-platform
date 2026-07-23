/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { copilotService } from '../services/agents/copilotService';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// 辅助函数：转换对话对象为可安全序列化的格式
const serializeConversation = (conversation: any) => {
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    messages: conversation.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
    })),
    created_at: conversation.created_at instanceof Date ? conversation.created_at.toISOString() : conversation.created_at,
    updated_at: conversation.updated_at instanceof Date ? conversation.updated_at.toISOString() : conversation.updated_at
  };
};

router.get('/suggestions', (_req: Request, res: Response) => {
  try {
    const suggestions = copilotService.getQuickSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error: unknown) {
    logger.error('GET /copilot/suggestions failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get suggestions' });
  }
});

router.get('/conversations', (req: Request, res: Response) => {
  try {
    const userId = (req as { user?: { id: string } }).user?.id || 'default';
    const conversations = copilotService.getUserConversations(userId);
    res.json({ success: true, data: conversations.map(serializeConversation) });
  } catch (error: unknown) {
    logger.error('GET /copilot/conversations failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversations' });
  }
});

router.post('/conversations', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const userId = (req as { user?: { id: string } }).user?.id || 'default';
    const conversation = copilotService.createConversation(userId);
    res.status(201).json({ success: true, data: serializeConversation(conversation) });
  } catch (error: unknown) {
    logger.error('POST /copilot/conversations failed:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

router.get('/conversations/:id', (req: Request, res: Response) => {
  try {
    const conversation = copilotService.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: '对话不存在' });
    }
    res.json({ success: true, data: serializeConversation(conversation) });
  } catch (error: unknown) {
    logger.error('GET /copilot/conversations/:id failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversation' });
  }
});

router.delete('/conversations/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const deleted = copilotService.deleteConversation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '对话不存在' });
    }
    res.json({ success: true, message: '对话已删除' });
  } catch (error: unknown) {
    logger.error('DELETE /copilot/conversations/:id failed:', error);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
});

router.post('/chat', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { conversationId, message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: '消息不能为空' });
    }

    const userId = (req as { user?: { id: string } }).user?.id || 'default';
    const response = await copilotService.processNaturalLanguage(
      conversationId,
      message,
      userId
    );

    res.json({ success: true, data: { response } });
  } catch (error: unknown) {
    logger.error('POST /copilot/chat failed:', error);
    res.status(500).json({ success: false, error: 'Failed to process chat' });
  }
});

export default router;