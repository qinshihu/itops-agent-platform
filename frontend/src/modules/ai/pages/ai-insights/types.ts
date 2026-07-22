/**
 * AI Insights 页面共享类型
 */

/** 后端返回的根因分析记录 */
export interface RcaRecord {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  root_cause?: string;
  created_at: string;
  [key: string]: unknown;
}

/** 后端返回的知识库条目 */
export interface KnowledgeEntry {
  id: string;
  title: string;
  category?: string;
  created_at: string;
  [key: string]: unknown;
}

/** 严重程度分布条目 */
export interface SeverityBucket {
  level: string;
  count: number;
  color: string;
}

/** 顶部统计卡片 */
export interface StatsCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendPositive?: boolean;
}