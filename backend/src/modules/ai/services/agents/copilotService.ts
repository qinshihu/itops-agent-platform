import db from '../../../models/database';
import { logger } from '../../../utils/logger';
import { callDoubaoAPI, callOpenAIAPI, callLocalAIAPI, checkLLMAvailability, generateCompletion } from './llmService.ts';
import { randomUUID } from 'crypto';

interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  user_id: string;
  messages: CopilotMessage[];
  created_at: Date;
  updated_at: Date;
}

const COPILOT_SYSTEM_PROMPT = `你是一个专业的 IT 运维助手（ITOps Copilot），帮助运维人员监控系统、处理告警、执行任务。

你的能力范围：
1. **告警管理**：查看告警状态、告警统计、告警处理建议
2. **服务器管理**：服务器状态查询、健康检查、服务器信息
3. **任务管理**：任务执行状态、任务进度、任务历史
4. **系统巡检**：巡检建议、巡检模板使用指导
5. **报告生成**：运维报告生成、报告模板使用
6. **工作流编排**：自动化任务编排、定时任务设置

回答要求：
- 使用中文回答
- 回答要简洁明了，重点突出
- 使用 Markdown 格式组织内容
- 如果用户的问题超出你的能力范围，引导用户前往相应页面操作
- 在回答中可以适当提供相关的运维建议`;

class CopilotService {
  private conversations: Map<string, Conversation> = new Map();
  private initialized: boolean = false;
  private readonly MAX_CONVERSATIONS = 1000;
  private readonly CONVERSATION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 延迟初始化，等待数据库准备好
  }

  init() {
    if (this.initialized) return;
    this.loadConversations();
    this.initialized = true;
    this.startCleanupTimer();
  }

  private startCleanupTimer() {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredConversations();
    }, 60 * 60 * 1000); // 每小时清理一次
    
    this.cleanupInterval.unref();
  }

  private cleanupExpiredConversations() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [id, conversation] of this.conversations.entries()) {
      const updatedAt = new Date(conversation.updated_at);
      const isExpired = (now.getTime() - updatedAt.getTime()) > this.CONVERSATION_TTL;
      
      if (isExpired) {
        this.conversations.delete(id);
        try {
          db.prepare('DELETE FROM copilot_conversations WHERE id = ?').run(id);
        } catch (error) {
          logger.error('Failed to delete expired conversation from DB:', error);
        }
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired copilot conversations`);
    }
  }

  private enforceConversationLimit() {
    if (this.conversations.size > this.MAX_CONVERSATIONS) {
      const entries = Array.from(this.conversations.entries())
        .sort((a, b) => new Date(b[1].updated_at).getTime() - new Date(a[1].updated_at).getTime());
      
      const toRemove = entries.slice(this.MAX_CONVERSATIONS);
      toRemove.forEach(([id]) => {
        this.conversations.delete(id);
        try {
          db.prepare('DELETE FROM copilot_conversations WHERE id = ?').run(id);
        } catch (error) {
          logger.error('Failed to remove excess conversation from DB:', error);
        }
      });
      
      logger.info(`Enforced conversation limit, removed ${toRemove.length} old conversations`);
    }
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.init();
    }
  }

  private loadConversations() {
    try {
      const saved = db.prepare('SELECT * FROM copilot_conversations').all() as Array<{
        id: string;
        user_id: string;
        messages: string;
        created_at: string;
        updated_at: string;
      }>;
      saved.forEach(c => {
        try {
          this.conversations.set(c.id, {
            id: c.id,
            user_id: c.user_id,
            messages: JSON.parse(c.messages || '[]'),
            created_at: new Date(c.created_at),
            updated_at: new Date(c.updated_at)
          });
        } catch {
          // 忽略解析错误
        }
      });
    } catch {
      logger.info('No existing copilot conversations found');
    }
  }

  private saveConversation(conversation: Conversation) {
    db.prepare(`
      INSERT OR REPLACE INTO copilot_conversations 
      (id, user_id, messages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      conversation.id,
      conversation.user_id,
      JSON.stringify(conversation.messages),
      conversation.created_at.toISOString(),
      conversation.updated_at.toISOString()
    );
  }

  createConversation(userId: string = 'default'): Conversation {
    this.ensureInitialized();
    this.enforceConversationLimit();
    const id = randomUUID();
    const now = new Date();
    const conversation: Conversation = {
      id,
      user_id: userId,
      messages: [],
      created_at: now,
      updated_at: now
    };
    this.conversations.set(id, conversation);
    this.saveConversation(conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | null {
    this.ensureInitialized();
    return this.conversations.get(id) || null;
  }

  getUserConversations(userId: string = 'default'): Conversation[] {
    this.ensureInitialized();
    return Array.from(this.conversations.values())
      .filter(c => c.user_id === userId)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  deleteConversation(id: string): boolean {
    this.ensureInitialized();
    const deleted = this.conversations.delete(id);
    if (deleted) {
      db.prepare('DELETE FROM copilot_conversations WHERE id = ?').run(id);
    }
    return deleted;
  }

  async processNaturalLanguage(
    conversationId: string,
    userInput: string,
    userId: string = 'default'
  ): Promise<string> {
    this.ensureInitialized();
    let conversation = this.getConversation(conversationId);
    if (!conversation) {
      conversation = this.createConversation(userId);
    }

    // 添加用户消息
    conversation.messages.push({
      role: 'user',
      content: userInput,
      timestamp: new Date()
    });

    // 调用 LLM 生成响应
    const response = await this.generateResponse(userInput, conversation.messages);

    // 添加助手消息
    conversation.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });
    conversation.updated_at = new Date();
    this.saveConversation(conversation);

    return response;
  }

  private buildContextForLLM(input: string): string {
    const lowerInput = input.toLowerCase();
    let context = '';

    // 根据用户输入自动注入相关数据到上下文中
    if (lowerInput.includes('告警') || lowerInput.includes('alert')) {
      try {
        const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10').all() as Array<{
          id: string;
          severity: string;
          title: string;
          status: string;
        }>;
        const severityCounts: Record<string, number> = {};
        const statusCounts: Record<string, number> = {};
        alerts.forEach((a) => {
          severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
          statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        });
        context += `当前告警数据：共 ${alerts.length} 条告警，严重程度分布：${JSON.stringify(severityCounts)}，状态分布：${JSON.stringify(statusCounts)}。\n`;
        if (alerts.length > 0) {
          context += `最近告警：${alerts.slice(0, 5).map((a) => `[${a.severity}] ${a.title}`).join('；')}。\n`;
        }
      } catch {
        context += '无法获取告警数据。\n';
      }
    }

    if (lowerInput.includes('服务器') || lowerInput.includes('server')) {
      try {
        const servers = db.prepare('SELECT * FROM servers LIMIT 20').all() as Array<{
          id: string;
          name: string;
          hostname: string;
          port: number;
          enabled: number;
        }>;
        const enabledCount = servers.filter((s) => s.enabled).length;
        context += `服务器数据：共 ${servers.length} 台服务器，${enabledCount} 台已启用。\n`;
        if (servers.length > 0) {
          context += `服务器列表：${servers.slice(0, 8).map((s) => `${s.name} (${s.hostname}:${s.port})[${s.enabled ? '已启用' : '已禁用'}]`).join('；')}。\n`;
        }
      } catch {
        context += '无法获取服务器数据。\n';
      }
    }

    if (lowerInput.includes('任务') || lowerInput.includes('task')) {
      try {
        const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 15').all() as Array<{
          id: string;
          name: string;
          status: string;
        }>;
        const statusCounts: Record<string, number> = {};
        tasks.forEach((t) => {
          statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        });
        context += `任务数据：共 ${tasks.length} 条任务记录，状态分布：${JSON.stringify(statusCounts)}。\n`;
        if (tasks.length > 0) {
          context += `最近任务：${tasks.slice(0, 5).map((t) => `${t.name} (${t.status})`).join('；')}。\n`;
        }
      } catch {
        context += '无法获取任务数据。\n';
      }
    }

    if (lowerInput.includes('巡检') || lowerInput.includes('检查')) {
      context += `系统支持以下巡检：服务器健康检查、磁盘空间检查、服务状态检查、安全合规检查。用户可以使用"工作流"模块创建和执行巡检任务。\n`;
    }

    return context;
  }

  private async generateResponse(input: string, conversationHistory: CopilotMessage[]): Promise<string> {
    try {
      logger.info(`🤖 [Copilot] 开始生成响应，输入长度: ${input.length}`);
      
      // 构建对话历史（最近 10 条）
      const recentMessages = conversationHistory.slice(-10);
      const historyText = recentMessages.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n');

      // 注入相关上下文数据
      const context = this.buildContextForLLM(input);

      const enrichedPrompt = context
        ? `当前系统数据：\n${context}\n用户输入：${input}\n对话历史：\n${historyText}`
        : `用户输入：${input}\n对话历史：\n${historyText}`;

      // 优先使用 AI 模型池的默认模型（已在 generateCompletion 中实现）
      logger.info(`🤖 [Copilot] 调用 generateCompletion 生成响应`);
      const llmResponse = await generateCompletion(enrichedPrompt, COPILOT_SYSTEM_PROMPT, 0.7, undefined, 'copilot');
      
      // 截断超长响应，防止前端渲染问题
      const truncatedResponse = llmResponse.length > 4000 
        ? llmResponse.substring(0, 4000) + '...\n\n（回复过长，已截断）' 
        : llmResponse;
      
      logger.info(`🤖 [Copilot] 响应生成成功，长度: ${truncatedResponse.length}`);
      return truncatedResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`🤖 [Copilot] LLM 调用失败，回退到规则响应: ${errorMessage}`);
      return this.getRuleBasedResponse(input);
    }
  }

  private getRuleBasedResponse(input: string): string {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('告警') || lowerInput.includes('alert')) {
      return this.handleAlertQuery();
    }
    if (lowerInput.includes('服务器') || lowerInput.includes('server')) {
      return this.handleServerQuery();
    }
    if (lowerInput.includes('任务') || lowerInput.includes('task')) {
      return this.handleTaskQuery();
    }
    if (lowerInput.includes('巡检') || lowerInput.includes('检查')) {
      return this.handleCheckQuery();
    }
    if (lowerInput.includes('帮助') || lowerInput.includes('help')) {
      return this.handleHelpQuery();
    }
    return this.handleGeneralQuery(input);
  }

  private handleAlertQuery(): string {
    const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10').all() as Array<{
      id: string;
      severity: string;
      title: string;
      status: string;
    }>;
    const severityCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    alerts.forEach((a) => {
      severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });

    const criticalCount = severityCounts['critical'] || 0;
    const highCount = severityCounts['high'] || 0;
    const newCount = statusCounts['new'] || 0;

    let response = `📊 **当前告警状态概览**\n\n`;
    response += `当前共有 **${alerts.length}** 条告警记录\n`;
    response += `- 🔴 严重告警: **${criticalCount}** 条\n`;
    response += `- 🟠 高级告警: **${highCount}** 条\n`;
    response += `- 📌 待处理告警: **${newCount}** 条\n\n`;

    if (alerts.length > 0) {
      response += `**最近告警**:\n`;
      alerts.slice(0, 5).forEach((a, i) => {
        const emoji = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : '🟡';
        response += `${i + 1}. ${emoji} [${a.severity?.toUpperCase()}] ${a.title}\n`;
      });
      response += `\n👉 建议：前往"告警中心"查看详细信息并处理待解决告警`;
    }

    return response;
  }

  private handleServerQuery(): string {
    const servers = db.prepare('SELECT * FROM servers LIMIT 20').all() as Array<{
      id: string;
      name: string;
      hostname: string;
      port: number;
      enabled: number;
    }>;
    const enabledCount = servers.filter((s) => s.enabled).length;

    let response = `🖥️ **服务器管理概览**\n\n`;
    response += `当前共有 **${servers.length}** 台服务器配置\n`;
    response += `- ✅ 已启用: **${enabledCount}** 台\n`;
    response += `- ❌ 已禁用: **${servers.length - enabledCount}** 台\n\n`;

    if (servers.length > 0) {
      response += `**服务器列表**:\n`;
      servers.slice(0, 8).forEach((s, i) => {
        const status = s.enabled ? '✅' : '❌';
        response += `${i + 1}. ${status} ${s.name} (${s.hostname}:${s.port})\n`;
      });
      response += `\n👉 如需对服务器执行操作，请前往"服务器管理"页面`;
    }

    return response;
  }

  private handleTaskQuery(): string {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 15').all() as Array<{
      id: string;
      name: string;
      status: string;
    }>;
    const statusCounts: Record<string, number> = {};

    tasks.forEach((t) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });

    let response = `📋 **任务执行概览**\n\n`;
    response += `当前共有 **${tasks.length}** 个任务记录\n`;
    response += `- ▶️ 运行中: **${statusCounts['running'] || 0}** 个\n`;
    response += `- ✅ 已完成: **${statusCounts['completed'] || 0}** 个\n`;
    response += `- ❌ 失败: **${statusCounts['failed'] || 0}** 个\n`;
    response += `- ⏳ 待执行: **${statusCounts['pending'] || 0}** 个\n\n`;

    if (tasks.length > 0) {
      response += `**最近任务**:\n`;
      tasks.slice(0, 5).forEach((t, i) => {
        const emoji = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
        response += `${i + 1}. ${emoji} ${t.name} - ${t.status}\n`;
      });
    }

    return response;
  }

  private handleCheckQuery(): string {
    return `🔍 **系统巡检建议**\n\n` +
      `我可以帮您执行以下巡检操作：\n\n` +
      `1. **服务器健康检查** - 检查服务器基本状态\n` +
      `2. **磁盘空间检查** - 检查磁盘使用情况\n` +
      `3. **服务状态检查** - 检查关键服务运行状态\n` +
      `4. **安全合规检查** - 检查系统安全配置\n\n` +
      `👉 您可以：\n` +
      `- 前往"工作流"使用预设的巡检模板\n` +
      `- 创建自定义巡检工作流\n` +
      `- 设置定时巡检任务\n\n` +
      `需要我帮您推荐一个合适的巡检流程吗？`;
  }

  private handleHelpQuery(): string {
    return `👋 **欢迎使用 ITOps Copilot！**\n\n` +
      `我是您的智能运维助手，可以帮您：\n\n` +
      `**查询类：**\n` +
      `- "查看当前告警状态"\n` +
      `- "服务器状态怎么样？"\n` +
      `- "最近执行了哪些任务？"\n\n` +
      `**操作类：**\n` +
      `- "帮我执行系统巡检"\n` +
      `- "检查一下磁盘空间"\n` +
      `- "生成一份运维报告"\n\n` +
      `**系统功能：**\n` +
      `- 告警中心：告警查看与处理\n` +
      `- 工作流：编排自动化任务\n` +
      `- 服务器管理：远程操作服务器\n` +
      `- 报告系统：生成运维报告\n\n` +
      `有什么我可以帮您的吗？`;
  }

  private handleGeneralQuery(input: string): string {
    return `🤔 我理解您想了解：**"${input}"**\n\n` +
      `让我给您一些建议：\n\n` +
      `**您可以尝试：**\n` +
      `1. 查看"告警中心" - 了解当前系统状态\n` +
      `2. 检查"工作流" - 运行自动化任务\n` +
      `3. 使用"服务器管理" - 对服务器执行操作\n` +
      `4. 生成"报告" - 查看运维统计\n\n` +
      `**常见问题：**\n` +
      `- 问：如何处理告警？ 答：前往告警中心，点击告警进行处理\n` +
      `- 问：如何创建自动化流程？ 答：使用工作流编排功能\n` +
      `- 问：如何连接服务器？ 答：在服务器管理中添加服务器配置\n\n` +
      `需要更具体的帮助吗？可以问我"帮助"！`;
  }

  // 获取快速建议
  getQuickSuggestions(): string[] {
    return [
      '查看当前告警状态',
      '服务器状态怎么样',
      '最近执行了哪些任务',
      '帮我生成运维报告',
      '检查系统健康状态',
      '有哪些服务器需要巡检'
    ];
  }
}

export const copilotService = new CopilotService();
