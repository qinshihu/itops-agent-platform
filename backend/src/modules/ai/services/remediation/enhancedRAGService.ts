import { randomUUID } from 'crypto';
import db from '../../../models/database';
import { localRuleEngine } from './localRuleEngine.ts';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  item: KnowledgeItem;
  score: number;
  highlight: string;
}

class EnhancedRAGService {
  private stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'
  ]);

  /**
   * 智能检索：结合关键词匹配和语义相关度
   */
  async search(
    query: string,
    options: {
      category?: string;
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      category,
      limit = 10,
      minScore = 0.1
    } = options;

    let sql = 'SELECT * FROM knowledge_base WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY usage_count DESC, created_at DESC LIMIT 50';

    const knowledgeItems = db.prepare(sql).all(...params) as Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      tags: string;
      usage_count: number;
      created_at: string;
      updated_at: string;
    }>;
    
    if (knowledgeItems.length === 0) {
      return [];
    }

    const totalDocs = (db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number }).count;

    const scoredResults = knowledgeItems.map(item => {
      const score = this.calculateRelevanceScore(query, item, totalDocs);
      const highlight = this.generateHighlight(query, item);
      
      return {
        item: this.transformItem(item),
        score,
        highlight
      };
    }).filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredResults;
  }

  /**
   * 计算相关度分数
   */
  private calculateRelevanceScore(query: string, item: {
    title: string;
    content: string;
    category: string;
    usage_count: number;
    created_at: string;
  }, totalDocs: number): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const fullText = `${item.title} ${item.content} ${item.category}`.toLowerCase();
    
    // 1. TF-IDF 相似度（核心评分，权重 0.4）
    const tfidfScore = this.calculateTfIdf(query, fullText, totalDocs);
    score += tfidfScore * 0.4;

    // 2. 精确匹配分数（权重 0.3）
    if (fullText.includes(queryLower)) {
      score += 0.3;
    }

    // 3. 标题匹配加分（标题中出现关键词权重更高）
    const titleLower = item.title.toLowerCase();
    const titleKeywords = this.extractKeywords(query).filter(kw =>
      titleLower.includes(kw.toLowerCase())
    );
    if (titleKeywords.length > 0) {
      score += (titleKeywords.length / this.extractKeywords(query).length) * 0.2;
    }

    // 4. 使用频率权重（权重 0.05）
    score += Math.min((item.usage_count || 0) * 0.01, 0.05);

    // 5. 时间衰减因子（权重 0.05）
    const itemDate = new Date(item.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.max(0, 1 - daysDiff / 365);
    score += timeDecay * 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * 计算 TF-IDF 相似度
   * 使用余弦相似度变体：TF(query_terms, document) / ||TF|| * IDF 权重
   */
  private calculateTfIdf(query: string, document: string, totalDocs: number): number {
    const queryTerms = this.extractKeywords(query);
    if (queryTerms.length === 0) return 0;

    const docTerms = this.extractKeywords(document);
    const docLength = Math.max(docTerms.length, 1);

    const idfMap = new Map<string, number>();
    for (const term of queryTerms) {
      const docFreq = docTerms.filter(t => t === term.toLowerCase()).length;
      const idf = Math.log(totalDocs / (docFreq + 1)) + 1;
      idfMap.set(term, idf);
    }

    // 计算查询向量和文档向量的余弦相似度
    let dotProduct = 0;
    let queryNorm = 0;
    let docNorm = 0;

    for (const [term, idf] of idfMap.entries()) {
      const tf = docTerms.filter(t => t === term.toLowerCase()).length / docLength;
      const weightedTf = tf * idf;
      dotProduct += idf * weightedTf;
      queryNorm += idf * idf;
      docNorm += weightedTf * weightedTf;
    }

    const denominator = Math.sqrt(queryNorm) * Math.sqrt(docNorm);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text.split(/[\s,.!?，。！？]+/)
      .filter(word => 
        word.length > 1 && 
        !this.stopWords.has(word.toLowerCase())
      );
  }

  /**
   * 生成高亮片段
   */
  private generateHighlight(query: string, item: { content: string }): string {
    const content = item.content || '';
    const keywords = this.extractKeywords(query);
    
    if (keywords.length === 0) {
      return content.substring(0, 200) + (content.length > 200 ? '...' : '');
    }

    // 找到第一个关键词的位置
    let bestPosition = -1;

    for (const keyword of keywords) {
      const position = content.toLowerCase().indexOf(keyword.toLowerCase());
      if (position >= 0 && (bestPosition === -1 || position < bestPosition)) {
        bestPosition = position;
      }
    }

    if (bestPosition === -1) {
      return content.substring(0, 200) + (content.length > 200 ? '...' : '');
    }

    // 截取关键词前后的内容
    const start = Math.max(0, bestPosition - 80);
    const end = Math.min(content.length, bestPosition + 120);
    let highlight = content.substring(start, end);

    if (start > 0) highlight = '...' + highlight;
    if (end < content.length) highlight += '...';

    return highlight;
  }

  /**
   * 转换知识库项目格式
   */
  private transformItem(item: {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string;
    usage_count: number;
    created_at: string;
    updated_at: string;
  }): KnowledgeItem {
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category || '未分类',
      tags: item.tags ? JSON.parse(item.tags) : [],
      usageCount: item.usage_count || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
  }

  /**
   * 增强知识注入：将相关知识格式化为LLM友好的提示
   */
  async injectKnowledge(
    query: string,
    options: {
      category?: string;
      maxItems?: number;
      minScore?: number;
    } = {}
  ): Promise<{ hasKnowledge: boolean; prompt: string }> {
    const searchResults = await this.search(query, {
      category: options.category,
      limit: options.maxItems || 5,
      minScore: options.minScore || 0.2
    });

    if (searchResults.length === 0) {
      const ruleRecommendations = localRuleEngine.recommendKnowledge('', query);
      if (ruleRecommendations.length > 0) {
        let rulePrompt = `📚 本地规则引擎推荐的相关知识：\n\n`;
        ruleRecommendations.forEach((rec, index) => {
          rulePrompt += `【推荐 ${index + 1}】${rec.title} (相关度: ${Math.round(rec.relevance * 100)}%)\n`;
          rulePrompt += `${rec.summary}\n\n`;
        });
        rulePrompt += `请注意：以上推荐基于本地规则库，建议结合实际情况进行判断。`;
        return { hasKnowledge: true, prompt: rulePrompt };
      }
      return { hasKnowledge: false, prompt: '' };
    }

    for (const result of searchResults) {
      try {
        db.prepare(`
          UPDATE knowledge_base 
          SET usage_count = usage_count + 1, 
              updated_at = datetime('now','localtime') 
          WHERE id = ?
        `).run(result.item.id);
      } catch (error) {
        console.error('Failed to update usage count:', error);
      }
    }

    let knowledgePrompt = `📚 以下是从知识库中检索到的相关信息（相关度排序）：\n\n`;
    
    searchResults.forEach((result, index) => {
      knowledgePrompt += `【资料 ${index + 1}】${result.item.title} (相关度: ${Math.round(result.score * 100)}%)\n`;
      knowledgePrompt += `${result.highlight}\n\n`;
    });

    knowledgePrompt += `请根据以上信息和你的专业知识回答问题。如果信息不足以回答问题，请说明。`;

    return { hasKnowledge: true, prompt: knowledgePrompt };
  }

  /**
   * 获取相似知识推荐
   */
  async getSimilarKnowledge(
    knowledgeId: string,
    limit: number = 5
  ): Promise<KnowledgeItem[]> {
    const sourceItem = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(knowledgeId) as {
      id: string;
      title: string;
      content: string;
      category: string;
    } | undefined;
    
    if (!sourceItem) {
      return [];
    }

    const searchQuery = `${sourceItem.title} ${sourceItem.category}`;
    const results = await this.search(searchQuery, { limit: limit + 1 });
    
    // 移除源项目自身
    return results
      .filter(r => r.item.id !== knowledgeId)
      .slice(0, limit)
      .map(r => r.item);
  }

  /**
   * 添加知识并自动提取标签
   */
  async addKnowledge(
    title: string,
    content: string,
    category: string = '未分类',
    tags: string[] = []
  ): Promise<string> {
    const id = randomUUID();
    
    // 自动提取标签
    const autoTags = tags.length > 0 
      ? tags 
      : this.extractKeywords(`${title} ${content}`).slice(0, 10);

    db.prepare(`
      INSERT INTO knowledge_base (id, title, content, category, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(id, title, content, category, JSON.stringify(autoTags));

    return id;
  }

  /**
   * 批量导入知识
   */
  async batchImport(items: Array<{
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }>): Promise<{ imported: number; failed: number }> {
    let imported = 0;
    let failed = 0;

    db.transaction(() => {
      for (const item of items) {
        try {
          this.addKnowledge(
            item.title,
            item.content,
            item.category || '未分类',
            item.tags || []
          );
          imported++;
        } catch (error) {
          console.error('Failed to import knowledge item:', error);
          failed++;
        }
      }
    })();

    return { imported, failed };
  }

  /**
   * 获取知识统计
   */
  getStatistics() {
    const totalItems = (db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number }).count;
    const categoryStats = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM knowledge_base 
      GROUP BY category
      ORDER BY count DESC
    `).all() as Array<{ category: string; count: number }>;
    
    const topItems = db.prepare(`
      SELECT * FROM knowledge_base 
      ORDER BY usage_count DESC, created_at DESC 
      LIMIT 10
    `).all() as Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      tags: string;
      usage_count: number;
      created_at: string;
      updated_at: string;
    }>;

    return {
      totalItems,
      categoryStats,
      topItems: topItems.map(item => this.transformItem(item))
    };
  }
}

export default EnhancedRAGService;
