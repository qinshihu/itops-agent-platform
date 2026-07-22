/**
 * Import-export 模块 API 服务层
 *
 * 从原 frontend infra/ 抽离（2026-07-08 增量-12 P1-6 frontend 同步）。
 */

import api from '@/lib/api';

// ── 类型定义 ──

export type ImportExportResourceType = 'servers' | 'alerts' | 'audit-logs' | 'reports';

export interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

export interface ExportOptions {
  format: 'csv' | 'json';
}

export interface ExportResponse {
  blob: Blob;
  filename: string;
}

export const resourceLabels: Record<ImportExportResourceType, string> = {
  servers: '服务器',
  alerts: '告警',
  'audit-logs': '审计日志',
  reports: '报表',
};

// ── API 对象 ──

export const importExportApi = {
  /** 导出资源到 CSV/JSON */
  async exportResource(
    resourceType: ImportExportResourceType,
    options: ExportOptions
  ): Promise<ExportResponse> {
    const response = await api.get(`/import-export/${resourceType}/export`, {
      params: { format: options.format },
      responseType: 'blob',
    });

    const contentDisposition = response.headers['content-disposition'];
    let filename = `${resourceType}-export.${options.format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match) filename = match[1];
    }

    return { blob: new Blob([response.data]), filename };
  },

  /** 导入 CSV 到资源 */
  async importResource(
    resourceType: ImportExportResourceType,
    csvContent: string
  ): Promise<ImportResult> {
    const { data } = await api.post(`/import-export/${resourceType}/import`, {
      content: csvContent,
    });
    return data;
  },

  /** 下载导出文件（辅助方法） */
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default importExportApi;
