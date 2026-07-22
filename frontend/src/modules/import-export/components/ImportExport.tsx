/**
 * 导入导出组件（被其他模块页面引用）
 *
 * 从原 infra/components/ImportExport.tsx 抽离（2026-07-08 增量-12）。
 * 改为通过 importExportApi 调用。
 */

import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X } from 'lucide-react';
import { importExportApi, resourceLabels } from '../api';
import type { ImportExportResourceType, ImportResult } from '../api';
import { useToast } from '@/contexts/ToastContext';
import { getAxiosErrorMessage } from '@/lib/errorHandler';

interface ImportExportProps {
  resourceType: ImportExportResourceType;
  onImportSuccess?: () => void;
}

export function ImportExport({ resourceType, onImportSuccess }: ImportExportProps) {
  const toast = useToast();
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await importExportApi.exportResource(resourceType, { format: exportFormat });
      importExportApi.downloadFile(result.blob, result.filename);
      toast.success(`已导出${resourceLabels[resourceType]}`);
    } catch (err: unknown) {
      toast.error(`导出${resourceLabels[resourceType]}失败：${getAxiosErrorMessage(err, '未知错误')}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.warning('仅支持 CSV 格式文件');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const content = await file.text();
      const result = await importExportApi.importResource(resourceType, content);
      setImportResult(result);
      if (result.imported > 0 && onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: unknown) {
      toast.error(`导入失败：${getAxiosErrorMessage(err, '未知错误')}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowImport(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-border rounded-lg hover:bg-background transition-colors text-sm"
      >
        <Upload className="w-4 h-4" />
        导入
      </button>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-border rounded-lg hover:bg-background transition-colors text-sm disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {exporting ? '导出中...' : '导出'}
      </button>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">导入 {resourceLabels[resourceType]}</h3>
              <button onClick={() => setShowImport(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleImport(file);
              }}
            >
              <Upload className="w-10 h-10 mx-auto text-text-secondary mb-2" />
              <p className="text-sm text-text-primary mb-1">拖拽 CSV 文件到此处</p>
              <p className="text-xs text-text-secondary mb-3">仅支持 .csv 格式</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
                className="hidden"
                id="import-file-input"
              />
              <label
                htmlFor="import-file-input"
                className="inline-block px-3 py-1.5 bg-primary text-white rounded-lg cursor-pointer text-sm"
              >
                选择文件
              </label>
            </div>

            {importing && <p className="text-sm text-text-secondary mt-3">导入中...</p>}

            {importResult && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>成功导入 {importResult.imported} 条</span>
                </div>
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span>失败 {importResult.failed} 条</span>
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="bg-red-500/10 rounded p-2 max-h-32 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-xs text-red-400">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportExport;
