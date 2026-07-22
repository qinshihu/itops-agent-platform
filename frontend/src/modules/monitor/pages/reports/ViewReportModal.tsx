import { X, Download } from 'lucide-react';
import MarkdownOutput from '../../../../shared/components/MarkdownOutput';
import type { GeneratedReport } from '../../api';

interface ViewReportModalProps {
  report: GeneratedReport | null;
  typeLabels: Record<string, string>;
  typeColors: Record<string, string>;
  onClose: () => void;
  onDownload: (reportId: string, format: 'markdown' | 'pdf' | 'word') => void;
}

export function ViewReportModal({ report, typeLabels, typeColors, onClose, onDownload }: ViewReportModalProps) {
  if (!report) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">{report.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background rounded-lg text-text-secondary hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded ${typeColors[report.type] || 'text-text-secondary bg-background'}`}>
              {typeLabels[report.type] || report.type}
            </span>
            <span className="text-text-secondary text-sm">
              创建时间: {new Date(report.created_at).toLocaleString()}
            </span>
          </div>
          <div className="prose prose-invert max-w-none">
            <MarkdownOutput content={report.content || '无内容'} />
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-background hover:bg-surface text-text-primary rounded-lg"
          >
            关闭
          </button>
          <button
            onClick={() => onDownload(report.id, 'markdown')}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>
      </div>
    </div>
  );
}
