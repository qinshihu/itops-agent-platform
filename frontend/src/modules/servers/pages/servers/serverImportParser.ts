/**
 * 服务器导入相关的纯函数工具
 *
 * 解析用户输入的多行 JSON 服务器配置，转换为后端可接受的格式。
 */

export interface ServerImportItem {
  name: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key: number;
  description: string;
  tags: string[];
  group_id?: string;
}

/**
 * 解析结果：成功项 + 失败项（带行号与错误原因）
 *
 * 2026-07-06 修复：原实现静默跳过无效行（catch {}），用户不知道哪些行错了。
 * 改为抛出包含每行错误详情的 ParseImportError，由调用方决定如何展示给用户。
 */
export class ParseImportError extends Error {
  constructor(public lineNumber: number, public rawLine: string, public cause: unknown) {
    super(`第 ${lineNumber} 行解析失败: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ParseImportError';
  }
}

export interface ParseImportResult {
  valid: ServerImportItem[];
  errors: Array<{ lineNumber: number; rawLine: string; reason: string }>;
}

/**
 * 解析多行 JSON 输入，每行一个服务器配置
 *
 * @returns 解析结果（含 valid 与 errors，分别让用户看到成功/失败明细）
 */
export function parseServerImportInput(rawInput: string): ServerImportItem[] {
  const { valid } = parseServerImportInputDetailed(rawInput);
  return valid;
}

/**
 * 解析多行 JSON 并返回详细结果（含无效行信息）
 *
 * 新接口 - 调用方可将 errors 展示给用户，避免静默吞错
 */
export function parseServerImportInputDetailed(rawInput: string): ParseImportResult {
  if (!rawInput.trim()) return { valid: [], errors: [] };

  const lines = rawInput.split('\n').filter(Boolean);
  const valid: ServerImportItem[] = [];
  const errors: Array<{ lineNumber: number; rawLine: string; reason: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    try {
      const item = JSON.parse(line);
      valid.push({
        name: item.name,
        hostname: item.hostname,
        port: item.port || 22,
        username: item.username,
        password: item.password,
        private_key: item.private_key,
        use_ssh_key: item.use_ssh_key || 0,
        description: item.description || '',
        tags: item.tags ? String(item.tags).split(',').map((t: string) => t.trim()) : [],
        group_id: item.group_id || undefined,
      });
    } catch (cause) {
      errors.push({
        lineNumber,
        rawLine: line,
        reason: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return { valid, errors };
}