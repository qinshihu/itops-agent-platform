import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X } from 'lucide-react';
import api from '../lib/api';

interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

interface ImportExportProps {
  resourceType: 'servers' | 'alerts' | 'audit-logs' | 'reports';
  onImportSuccess?: () => void;
}

const resourceLabels: Record<string, string> = {
  servers: '服务器',
  alerts: '告警',
  'audit-logs': '审计日志',
  reports: '报表'
};

export function ImportExport({ resourceType, onImportSuccess }: ImportExportProps) {
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const endpointMap: Record<string, string> = {
        servers: '/import-export/servers/export',
        alerts: '/import-export/alerts/export',
        'audit-logs': '/import-export/audit-logs/export',
        reports: '/import-export/reports/export'
      };

      const endpoint = endpointMap[resourceType];
      if (!endpoint) {
        throw new Error('不支持的导出类型');
      }

      const response = await api.get(endpoint, {
        params: { format: exportFormat },
        responseType: 'blob'
      });

      const contentDisposition = response.headers['content-disposition'];
      let filename = `${resourceType}-export.${exportFormat}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('仅支持CSV格式文件');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      
      const response = await api.post('/import-export/servers/import', {
        csvContent: text
      });

      setImportResult(response.data.data);
      
      if (response.data.data.imported > 0 && onImportSuccess) {
        onImportSuccess();
      }
    } catch (error: any) {
      if (error.response?.data?.data) {
        setImportResult(error.response.data.data);
      } else {
        alert('导入失败: ' + (error.response?.data?.message || '未知错误'));
      }
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImport(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleImport(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/import-export/template/servers', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'servers-import-template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载模板失败:', error);
    }
  };

  const showImportButton = resourceType === 'servers';
  const showExportButton = ['servers', 'alerts', 'audit-logs', 'reports'].includes(resourceType);

  if (!showImportButton && !showExportButton) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {showImportButton && (
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Upload size={14} />
            导入{resourceLabels[resourceType]}
          </button>
        )}

        {showExportButton && (
          <div className="flex items-center gap-1">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? '导出中...' : '导出'}
            </button>
          </div>
        )}
      </div>

      {showImport && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">批量导入{resourceLabels[resourceType]}</h4>
            <button
              onClick={() => setShowImport(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-1">拖拽CSV文件到此处，或</p>
            <label className="inline-block cursor-pointer text-sm text-blue-600 hover:text-blue-700">
              选择文件
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleDownloadTemplate}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              下载导入模板
            </button>
          </div>

          {importing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              正在导入...
            </div>
          )}

          {importResult && (
            <div className="mt-3 space-y-2">
              <div className={`flex items-center gap-2 p-2 rounded text-sm ${
                importResult.imported > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {importResult.imported > 0 ? (
                  <CheckCircle size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
                成功导入 {importResult.imported} 条，失败 {importResult.failed} 条
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-2">
                  {importResult.errors.slice(0, 10).map((error, idx) => (
                    <p key={idx} className="text-xs text-red-600 mb-1">{error}</p>
                  ))}
                  {importResult.errors.length > 10 && (
                    <p className="text-xs text-gray-500">... 还有 {importResult.errors.length - 10} 条错误</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
