import { FileCheck, FileText, XIcon } from 'lucide-react';
import MarkdownOutput from '../../../shared/components/MarkdownOutput';
import type { Report } from './types';

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
  onDownload: (reportId: string, format: 'markdown') => void;
}

export function ReportDetailModal({ report, onClose, onDownload }: ReportDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-primary" />
            {report.name}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-2"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <MarkdownOutput content={report.content} />
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={() => onDownload(report.id, 'markdown')}
            className="px-4 py-2 bg-surface hover:bg-background text-text-primary rounded-lg flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            下载 Markdown
          </button>
        </div>
      </div>
    </div>
  );
}
