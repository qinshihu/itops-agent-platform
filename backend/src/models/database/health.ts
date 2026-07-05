import fs from 'fs';
import { env } from '../../utils/env';
import { logger } from '../../utils/logger';
import { db } from './core';

/**
 * 获取所有表的索引信息
 */
export function getTableIndexes(): Array<{
  tableName: string;
  indexName: string;
  columns: string;
  isUnique: boolean;
  rowCount: number;
}> {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
    
    const indexes: Array<{ tableName: string; indexName: string; columns: string; isUnique: boolean; rowCount: number }> = [];
    
    for (const table of tables) {
      const tableIndexes = db.prepare(`PRAGMA index_list(${table.name})`).all() as Array<{ name: string; unique: number; origin: string }>;
      
      for (const idx of tableIndexes) {
        const columns = db.prepare(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string }>;
        const columnNames = columns.map(c => c.name).join(', ');
        
        const rowCountResult = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
        
        indexes.push({
          tableName: table.name,
          indexName: idx.name,
          columns: columnNames,
          isUnique: idx.unique === 1,
          rowCount: rowCountResult.count
        });
      }
    }
    
    return indexes;
  } catch (error) {
    logger.warn('Failed to get table indexes', { error: (error as Error).message });
    return [];
  }
}

/**
 * 获取慢查询建议
 */
export function getQuerySuggestions(): Array<{
  table: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const suggestions: Array<{ table: string; suggestion: string; priority: 'high' | 'medium' | 'low' }> = [];
  
  try {
    const largeTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>;
    
    for (const table of largeTables) {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number }).count;
      
      if (count > 10000) {
        const indexes = db.prepare(`PRAGMA index_list(${table.name})`).all() as Array<Record<string, unknown>>;
        if (indexes.length < 2) {
          suggestions.push({
            table: table.name,
            suggestion: `表 ${table.name} 有 ${count} 行数据但索引较少，建议添加更多索引`,
            priority: 'high'
          });
        }
      }
      
      if (count > 100000) {
        suggestions.push({
          table: table.name,
          suggestion: `表 ${table.name} 数据量较大 (${count} 行)，考虑定期清理或分区`,
          priority: 'medium'
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to get query suggestions', { error: (error as Error).message });
  }
  
  return suggestions;
}

/**
 * 获取WAL文件大小
 */
function getWalFileSize(): number {
  try {
    const walPath = `${env.DATABASE_PATH}-wal`;
    if (fs.existsSync(walPath)) {
      return fs.statSync(walPath).size;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 获取数据库状态统计信息
 */
export function getDatabaseHealthStatus(): {
  pageCount: number;
  pageSize: number;
  walSize: number;
  cacheSize: number;
  tableCount: number;
  indexCount: number;
  totalSize: string;
  freePages: number;
} {
  try {
    const pageCount = (db.pragma('page_count') as Array<{ page_count: number }>)[0]?.page_count || 0;
    const pageSize = (db.pragma('page_size') as Array<{ page_size: number }>)[0]?.page_size || 0;
    const cacheSize = (db.pragma('cache_size') as Array<{ cache_size: number }>)[0]?.cache_size || 0;
    const freelistCount = (db.pragma('freelist_count') as Array<{ freelist_count: number }>)[0]?.freelist_count || 0;
    
    const tableCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count;
    const indexCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as { count: number }).count;
    
    const walSize = getWalFileSize();
    const totalSize = formatSize(pageCount * pageSize);
    
    return {
      pageCount,
      pageSize,
      walSize,
      cacheSize,
      tableCount,
      indexCount,
      totalSize,
      freePages: freelistCount
    };
  } catch (error) {
    logger.warn('Failed to get database health status', { error: (error as Error).message });
    return {
      pageCount: 0,
      pageSize: 0,
      walSize: 0,
      cacheSize: 0,
      tableCount: 0,
      indexCount: 0,
      totalSize: '0 B',
      freePages: 0
    };
  }
}