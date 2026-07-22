/**
 * SchemaTable —— 工具参数 Schema 表格
 * v2.1（2026-07-21）：从 AgentToolsPage.tsx 拆分
 *
 * 展示参数名 / 类型 / 是否必填 / 说明
 */

import { Code2 } from 'lucide-react';
import type { AgentTool } from './types';

interface SchemaTableProps {
  tool: AgentTool;
}

export function SchemaTable({ tool }: SchemaTableProps) {
  const paramEntries = Object.entries(tool.schema.properties || {});

  return (
    <div className="bg-surface rounded-xl border border-border/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <Code2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-text-primary">参数 Schema</span>
        <span className="text-xs text-text-tertiary ml-auto">{paramEntries.length} 个参数</span>
      </div>
      {paramEntries.length === 0 ? (
        <div className="p-8 text-center text-text-tertiary text-sm">该工具不需要参数</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-background/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary font-mono">
                参数名
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">类型</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">必填</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paramEntries.map(([name, prop]) => {
              const isRequired = tool.schema.required?.includes(name);
              const type = (prop as { type?: string }).type || 'unknown';
              const desc = (prop as { description?: string }).description || '-';
              return (
                <tr key={name} className="hover:bg-background/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-background text-text-secondary font-mono">
                      {type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isRequired ? (
                      <span className="text-xs text-orange-400 font-medium">必填</span>
                    ) : (
                      <span className="text-xs text-text-tertiary">可选</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">{desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default SchemaTable;