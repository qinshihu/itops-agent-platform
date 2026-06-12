import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { callDoubaoAPI } from './llmService';
import EnhancedRAGService from './enhancedRAGService';

interface AgentDB {
  id: string;
  name: string;
  role?: string;
  description?: string;
  system_prompt?: string;
  temperature?: number;
  enabled?: number;
}

interface AgentCollaborationContext {
  taskId: string;
  currentAgentId: string;
  currentAgentName: string;
  conversationHistory: CollaborationMessage[];
  context: Record<string, unknown>;
  startTime: number;
  delegationChain: string[];
}

interface CollaborationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  name?: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class MultiAgentOrchestrator {
  private context: AgentCollaborationContext;
  private maxRounds: number = 10;
  private maxThinkingTime: number = 5 * 60 * 1000;
  private maxConversationHistory: number = 50;
  private trimTargetSize: number = 30;

  constructor(taskId: string, initialContext: Record<string, unknown> = {}) {
    this.context = {
      taskId,
      currentAgentId: '',
      currentAgentName: '',
      conversationHistory: [],
      context: initialContext,
      startTime: Date.now(),
      delegationChain: []
    };
  }

  /**
   * 智能路由：决定由哪个Agent处理当前任务
   */
  async routeToBestAgent(
    userQuery: string,
    availableAgents: AgentDB[]
  ): Promise<string> {
    if (availableAgents.length === 0) {
      throw new Error('No agents available');
    }

    if (availableAgents.length === 1) {
      return availableAgents[0].id;
    }

    const agentDescriptions = availableAgents.map(agent => 
      `${agent.name} (${agent.id}): ${agent.role || agent.description || '通用Agent'}`
    ).join('\n');

    const routingPrompt = `你是一个智能任务分发器，需要将用户请求分发给最适合的Agent处理。

可用的Agent列表:
${agentDescriptions}

用户请求: ${userQuery}

请选择最适合处理此请求的Agent，只返回Agent的ID，不要其他内容。`;

    try {
      const result = await callDoubaoAPI(
        routingPrompt,
        '你是一个智能的Agent选择助手，擅长将任务分配给最适合的专家。',
        'Agent Router',
        0.3
      );

      const matchedAgent = availableAgents.find(agent => 
        result.includes(agent.id) || result.includes(agent.name)
      );

      if (matchedAgent) {
        return matchedAgent.id;
      }

      return availableAgents.find((a) => a.enabled)?.id || availableAgents[0].id;
    } catch {
      logger.warn('🔄 [Agent Router] LLM routing failed, falling back to rule-based routing');
      return this.ruleBasedRouting(userQuery, availableAgents);
    }
  }

  /**
   * 基于规则的Agent路由降级方案
   */
  private ruleBasedRouting(userQuery: string, availableAgents: AgentDB[]): string {
    const queryLower = userQuery.toLowerCase();
    
    const ruleMappings: Array<{ keywords: string[]; agentRole: string }> = [
      { keywords: ['告警', 'alert', '故障', '问题'], agentRole: '告警' },
      { keywords: ['诊断', '排查', '根因', '故障'], agentRole: '诊断' },
      { keywords: ['日志', 'log', '分析'], agentRole: '日志' },
      { keywords: ['巡检', '检查', '健康'], agentRole: '巡检' },
      { keywords: ['变更', '部署', '执行'], agentRole: '变更' },
      { keywords: ['文档', '报告', '生成'], agentRole: '文档' },
      { keywords: ['合规', '安全', '基线'], agentRole: '合规' },
      { keywords: ['服务器', '命令', '执行'], agentRole: '命令执行' },
      { keywords: ['知识库', '推荐', '相关'], agentRole: '知识' }
    ];

    for (const rule of ruleMappings) {
      if (rule.keywords.some(k => queryLower.includes(k))) {
        const matchedAgent = availableAgents.find(a => 
          (a.role && a.role.toLowerCase().includes(rule.agentRole)) ||
          (a.name && a.name.toLowerCase().includes(rule.agentRole)) ||
          (a.description && a.description.toLowerCase().includes(rule.agentRole))
        );
        if (matchedAgent) {
          logger.info(`✅ [Rule Router] Matched agent: ${matchedAgent.name} for query`);
          return matchedAgent.id;
        }
      }
    }

    logger.info('📋 [Rule Router] No rule match, using first available agent');
    return availableAgents.find((a) => a.enabled)?.id || availableAgents[0].id;
  }

  /**
   * 多Agent协作解决问题
   */
  async collaborate(
    initialQuery: string,
    agentIds: string[],
    options: { 
      enableRAG?: boolean;
      enableToolUse?: boolean;
      maxRounds?: number;
    } = {}
  ): Promise<CollaborationMessage[]> {
    const {
      enableRAG = true,
      maxRounds = 5
    } = options;

    this.maxRounds = maxRounds;

    // 获取所有参与的Agent
    const agents = agentIds.map(id => 
      db.prepare('SELECT * FROM agents WHERE id = ?').get(id)
    ).filter(Boolean);

    if (agents.length === 0) {
      throw new Error('No valid agents found');
    }

    // 初始化对话
    this.context.conversationHistory.push({
      role: 'user',
      content: initialQuery,
      timestamp: Date.now()
    });
    this._trimConversationHistory();

    // RAG知识检索
    if (enableRAG) {
      const knowledge = await this.retrieveRelevantKnowledge(initialQuery);
      if (knowledge.length > 0) {
        this.context.conversationHistory.push({
          role: 'system',
          name: 'Knowledge Base',
          content: `以下是从知识库中检索到的相关信息：\n\n${knowledge.map(k => `- ${k.title}\n  ${k.content}`).join('\n\n')}`,
          timestamp: Date.now()
        });
        this._trimConversationHistory();
      }
    }

    // 智能选择主要负责Agent
    const primaryAgentId = await this.routeToBestAgent(initialQuery, agents as AgentDB[]);
    this.context.currentAgentId = primaryAgentId;
    
    const primaryAgent = agents.find(a => (a as AgentDB).id === primaryAgentId);
    this.context.currentAgentName = (primaryAgent as AgentDB)?.name || 'Unknown';

    // 开始协作对话
    let currentRound = 0;
    let shouldContinue = true;

    while (shouldContinue && currentRound < this.maxRounds) {
      currentRound++;

      // 检查是否超时
      if (Date.now() - this.context.startTime > this.maxThinkingTime) {
        this.context.conversationHistory.push({
          role: 'system',
          content: '协作已超时，正在总结结果...',
          timestamp: Date.now()
        });
        this._trimConversationHistory();
        break;
      }

      // 当前Agent处理
      const result = await this.processAgentTurn(agents as AgentDB[]);
      
      if (result.type === 'final') {
        shouldContinue = false;
      } else if (result.type === 'delegate') {
        // 委托给其他Agent，检查循环
        const delegateToAgent = result.delegateTo || '';
        if (this.detectDelegationCycle(delegateToAgent)) {
          this.context.conversationHistory.push({
            role: 'system',
            content: `检测到Agent委托循环 (${this.context.delegationChain.join(' -> ')} -> ${delegateToAgent})，终止委托以避免无限循环`,
            timestamp: Date.now()
          });
          this._trimConversationHistory();
          shouldContinue = false;
        } else {
          this.context.currentAgentId = delegateToAgent;
          const nextAgent = agents.find(a => (a as AgentDB).id === delegateToAgent);
          this.context.currentAgentName = (nextAgent as AgentDB)?.name || 'Unknown';
        }
      }

      // 检查是否需要继续
      shouldContinue = shouldContinue && !this.isTaskComplete();
    }

    // 生成最终总结
    await this.generateFinalSummary();

    return this.context.conversationHistory;
  }

  /**
   * 单个Agent的处理回合
   */
  private async processAgentTurn(
    agents: AgentDB[]
  ): Promise<{ type: 'continue' | 'final' | 'delegate', delegateTo?: string }> {
    const currentAgent = agents.find(a => a.id === this.context.currentAgentId);
    if (!currentAgent) {
      throw new Error('Current agent not found');
    }

    // 构建对话历史
    const conversation = this.formatConversationForAgent(currentAgent);
    
    try {
      // 调用Agent
      const response = await callDoubaoAPI(
        conversation,
        currentAgent.system_prompt || '你是一个专业的IT运维助手。',
        currentAgent.name,
        currentAgent.temperature || 0.7
      );

      // 记录响应
      this.context.conversationHistory.push({
        role: 'assistant',
        name: currentAgent.name,
        content: response,
        timestamp: Date.now()
      });
      this._trimConversationHistory();

      // 解析响应，判断下一步
      return this.parseAgentResponse(response, agents);

    } catch (error) {
      logger.error(`Agent ${currentAgent.name} failed:`, error);
      
      this.context.conversationHistory.push({
        role: 'system',
        content: `Agent ${currentAgent.name} 执行出错: ${(error as Error).message}`,
        timestamp: Date.now()
      });

      return { type: 'continue' };
    }
  }

  /**
   * 从知识库检索相关信息（使用 TF-IDF 增强的 RAG）
   */
  private async retrieveRelevantKnowledge(query: string): Promise<Array<{ score: number; [key: string]: unknown }>> {
    try {
      const ragService = new EnhancedRAGService();
      const searchResults = await ragService.search(query, { limit: 5, minScore: 0.15 });
      
      return searchResults.map(r => ({
        id: r.item.id,
        title: r.item.title,
        content: r.item.content,
        category: r.item.category,
        score: r.score
      }));

    } catch (error) {
      logger.error('Knowledge retrieval failed:', error);
      return [];
    }
  }

  /**
   * 格式化对话历史供Agent使用
   */
  private formatConversationForAgent(currentAgent: AgentDB): string {
    const formatted = this.context.conversationHistory.map(msg => {
      const prefix = msg.name ? `[${msg.name}]` : msg.role;
      return `${prefix}: ${msg.content}`;
    }).join('\n\n');

    return `当前时间: ${new Date().toLocaleString('zh-CN')}

你是 ${currentAgent.name}，你的专业领域是: ${currentAgent.role || 'IT运维'}

对话历史:
${formatted}

请根据对话历史继续处理任务。

【委托协议】如果你认为需要其他专业Agent的帮助，请使用以下格式之一：
1. 结构化格式：\`\`\`json
{"delegate_to": "Agent名称"}
\`\`\`
2. 快捷格式：[DELEGATE:Agent名称]
3. 自然语言格式：需要请/建议/调用 [Agent名称] 协助

【完成标记】如果任务已完成，请在回复中包含"任务完成"或 [DONE]。
`;
  }

  /**
   * 解析Agent响应，决定下一步
   * 支持结构化协议：Agent 可通过 JSON 标记表达委托意图
   */
  private parseAgentResponse(
    response: string,
    agents: AgentDB[]
  ): { type: 'continue' | 'final' | 'delegate', delegateTo?: string } {
    
    // 优先解析结构化委托协议
    // 格式 1: ```json\n{"delegate_to": "Agent名称"}\n```
    const jsonBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1]);
        if (parsed.delegate_to) {
          const targetAgent = agents.find(a => 
            a.name === parsed.delegate_to || a.name.includes(parsed.delegate_to)
          );
          if (targetAgent) {
            return { type: 'delegate', delegateTo: targetAgent.id };
          }
        }
      } catch {
        // JSON 解析失败，降级到文本匹配
      }
    }

    // 格式 2: [DELEGATE:Agent名称]
    const delegateMatch = response.match(/\[DELEGATE:([^\]]+)\]/i);
    if (delegateMatch) {
      const targetName = delegateMatch[1].trim();
      const targetAgent = agents.find(a => 
        a.name === targetName || a.name.includes(targetName)
      );
      if (targetAgent) {
        return { type: 'delegate', delegateTo: targetAgent.id };
      }
    }

    // 检查是否任务完成（支持结构化标记）
    if (response.includes('任务完成') || 
        response.includes('已完成') || 
        response.includes('总结:') ||
        response.includes('[DONE]') ||
        response.includes('[COMPLETE]')) {
      return { type: 'final' };
    }

    // 降级方案：检查响应中是否提到其他 Agent 名称
    for (const agent of agents) {
      if (agent.id !== this.context.currentAgentId) {
        // 需要精确匹配：Agent 名称前后是特定上下文词
        const namePattern = new RegExp(`(?:需要|请|建议|调用|转给|交给|consult|delegate)\\s*${this.escapeRegExp(agent.name)}`, 'i');
        if (namePattern.test(response) || 
            (agent.role && namePattern.test(agent.role))) {
          return { type: 'delegate', delegateTo: agent.id };
        }
      }
    }

    return { type: 'continue' };
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 检测委托循环
   */
  private detectDelegationCycle(targetAgentId: string): boolean {
    if (this.context.delegationChain.includes(targetAgentId)) {
      return true;
    }
    
    this.context.delegationChain.push(targetAgentId);
    return false;
  }

  /**
   * 检查任务是否完成
   */
  private isTaskComplete(): boolean {
    const recentMessages = this.context.conversationHistory.slice(-3);
    return recentMessages.some(msg => 
      msg.content.includes('任务完成') || 
      msg.content.includes('已完成所有步骤') ||
      msg.content.includes('问题已解决')
    );
  }

  /**
   * 生成最终总结
   */
  private async generateFinalSummary(): Promise<void> {
    const conversationText = this.context.conversationHistory.map(msg => 
      `${msg.name || msg.role}: ${msg.content}`
    ).join('\n\n');

    const summaryPrompt = `请对以下多Agent协作过程进行总结，包括：
1. 问题概述
2. 主要发现
3. 解决方案
4. 后续建议

对话历史:
${conversationText}

请提供一个专业、结构化的总结报告。`;

    try {
      const summary = await callDoubaoAPI(
        summaryPrompt,
        '你是一个专业的报告生成助手，擅长总结复杂的技术讨论。',
        'Summary Generator',
        0.5
      );

      this.context.conversationHistory.push({
        role: 'assistant',
        name: '系统总结',
        content: summary,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.warn('🔄 [Summary] LLM summary failed, falling back to rule-based summary');
      this.generateRuleBasedSummary(conversationText);
    }
  }

  /**
   * 基于规则的总结生成降级方案
   */
  private generateRuleBasedSummary(conversationText: string): void {
    const summary = `# 协作总结（规则引擎生成）

## 协作概况
- **任务ID**: ${this.context.taskId}
- **参与Agent**: ${this.context.delegationChain.length > 0 ? this.context.delegationChain.join(' → ') : this.context.currentAgentName}
- **协作轮数**: ${this.context.conversationHistory.length} 轮
- **用时**: ${((Date.now() - this.context.startTime) / 1000).toFixed(1)} 秒

## 对话摘要
${this.context.conversationHistory.slice(0, 5).map(msg => 
`- **${msg.name || msg.role}**: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
).join('\n')}

## 处理结果
基于规则引擎生成的总结。建议：
1. 检查系统日志获取更多信息
2. 确认相关服务状态
3. 如需更深入分析，请配置 LLM API 以获取智能分析结果

---
*此总结由本地规则引擎自动生成*`;

    this.context.conversationHistory.push({
      role: 'assistant',
      name: '系统总结',
      content: summary,
      timestamp: Date.now()
    });
  }

  /**
   * 将Agent协作结果存入知识库
   */
  async saveToKnowledgeBase(title: string, category: string = '协作案例'): Promise<string> {
    const conversationText = this.context.conversationHistory.map(msg => 
      `**${msg.name || msg.role}** (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}\n`
    ).join('\n');

    const id = randomUUID();
    
    db.prepare(`
      INSERT INTO knowledge_base (id, title, category, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
    `).run(id, title, category, conversationText);

    return id;
  }

  private _trimConversationHistory(): void {
    if (this.context.conversationHistory.length > this.maxConversationHistory) {
      const excess = this.context.conversationHistory.length - this.trimTargetSize;
      this.context.conversationHistory.splice(0, excess);
    }
  }

  /**
   * 获取协作上下文
   */
  getContext(): AgentCollaborationContext {
    return { ...this.context };
  }
}

/**
 * Agent间消息传递工具
 */
class AgentMessageBus {
  private messages: Map<string, CollaborationMessage[]> = new Map();
  private messageTTL: number;
  private cleanupInterval: number;
  private lastCleanup: number;
  private periodicCleanupTimer: NodeJS.Timeout;

  constructor(options: { messageTTL?: number; cleanupInterval?: number } = {}) {
    this.messageTTL = options.messageTTL || 30 * 60 * 1000;
    this.cleanupInterval = options.cleanupInterval || 10 * 60 * 1000;
    this.lastCleanup = Date.now();

    this.periodicCleanupTimer = setInterval(() => {
      this.globalCleanup();
    }, 5 * 60 * 1000);

    if (this.periodicCleanupTimer.unref) {
      this.periodicCleanupTimer.unref();
    }
  }

  globalCleanup(): void {
    const now = Date.now();
    const cutoff = now - this.messageTTL;

    for (const [key, msgs] of this.messages.entries()) {
      const validMessages = msgs.filter(msg => msg.timestamp > cutoff);
      if (validMessages.length === 0) {
        this.messages.delete(key);
      } else {
        this.messages.set(key, validMessages);
      }
    }
    this.lastCleanup = now;
  }

  sendMessage(
    fromAgent: string,
    toAgent: string,
    content: string,
    metadata?: Record<string, unknown>
  ) {
    const key = `${fromAgent}:${toAgent}`;
    if (!this.messages.has(key)) {
      this.messages.set(key, []);
    }

    this.messages.get(key)!.push({
      role: 'assistant',
      name: fromAgent,
      content,
      timestamp: Date.now(),
      metadata
    });

    // 定期检查清理过期消息
    this.maybeCleanup();
  }

  getMessages(fromAgent: string, toAgent: string): CollaborationMessage[] {
    return this.messages.get(`${fromAgent}:${toAgent}`) || [];
  }

  /**
   * 清理过期消息
   */
  private cleanup() {
    const now = Date.now();
    const cutoff = now - this.messageTTL;

    for (const [key, msgs] of this.messages.entries()) {
      // 过滤掉过期消息
      const validMessages = msgs.filter(msg => msg.timestamp > cutoff);
      
      if (validMessages.length === 0) {
        // 如果没有有效消息，删除整个键
        this.messages.delete(key);
      } else {
        // 更新为有效消息
        this.messages.set(key, validMessages);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * 检查是否需要执行清理
   */
  private maybeCleanup() {
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }
  }

  /**
   * 手动触发清理
   */
  forceCleanup() {
    this.cleanup();
  }
}

// 导出
export {
  MultiAgentOrchestrator,
  AgentMessageBus,
  CollaborationMessage,
  AgentCollaborationContext
};
