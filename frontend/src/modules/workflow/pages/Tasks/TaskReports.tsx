import { FileCheck, FileText } from 'lucide-react';
import type { Report, TaskDisplay } from '../types';

interface TaskReportsProps {
  task: TaskDisplay;
  reports: Report[] | undefined;
  onShowReport: (report: Report) => void;
  onDownloadReport: (reportId: string, format?: 'markdown') => Promise<void>;
}

/**
 * 相关报告 tab 内容组件（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中 L531-588 的报告 tab 抽离
 */
export function TaskReports({ task, reports, onShowReport, onDownloadReport }: TaskReportsProps) {
  let relatedReports: Report[] = [];

  if (task.report_id) {
    const exactReport = reports?.find(report => report.id === task.report_id);
    if (exactReport) relatedReports = [exactReport];
  }

  if (relatedReports.length === 0) {
    relatedReports = reports?.filter(report =>
      report.name?.includes(task.name) ||
      report.content?.includes(task.id) ||
      report.task_id === task.id
    ) || [];
  }

  if (relatedReports.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="mb-4">暂无相关报告</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {relatedReports.map(report => (
        <div
          key={report.id}
          className="bg-surface border border-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer"
          onClick={() => onShowReport(report)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="w-4 h-4 text-primary" />
                <h4 className="font-medium text-text-primary">{report.name}</h4>
              </div>
              <p className="text-sm text-text-secondary">
                创建时间: {new Date(report.created_at).toLocaleString()}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                {report.format?.toUpperCase() || 'MARKDOWN'} 格式
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDownloadReport(report.id, 'markdown'); }}
              className="text-primary hover:text-primary/80 p-2"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}