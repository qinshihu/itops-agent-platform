import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Download, Clock, Trash2, Edit2, Eye } from 'lucide-react';
import { message } from 'antd';
import { logger } from '@/lib/logger';
import api from '@/lib/api';
import { getAxiosErrorMessage } from '../../../lib/errorHandler';
import {
  monitorApi,
  type GeneratedReport,
  type ReportTemplate,
  type ScheduledReport,
} from '../api';
import { CreateTemplateModal, type CreateTemplateFormState } from './reports/CreateTemplateModal';
import { GenerateReportModal } from './reports/GenerateReportModal';
import { ViewReportModal } from './reports/ViewReportModal';
import { AnalyticsTab } from './reports/AnalyticsTab';

const TYPE_LABELS: Record<string, string> = {
  incident: '故障报告',
  inspection: '巡检报告',
  change: '变更记录',
};

const TYPE_COLORS: Record<string, string> = {
  incident: 'text-red-400 bg-red-900/30',
  inspection: 'text-blue-400 bg-blue-900/30',
  change: 'text-green-400 bg-green-900/30',
};

const TABS = [
  { key: 'templates', label: '报告模板' },
  { key: 'reports', label: '已生成报告' },
  { key: 'scheduled', label: '定时报告' },
  { key: 'analytics', label: '数据分析' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const EMPTY_TEMPLATE_FORM: CreateTemplateFormState = {
  name: '',
  description: '',
  type: 'incident',
  content: '',
  variables: [],
};

export default function Reports() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('reports');
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [showViewReportModal, setShowViewReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [templateForm, setTemplateForm] = useState<CreateTemplateFormState>(EMPTY_TEMPLATE_FORM);

  const { data: templates } = useQuery({
    queryKey: ['reportTemplates'],
    queryFn: async () => {
      try {
        return await monitorApi.listReportTemplates();
      } catch (err: unknown) {
        message.error(`加载报告模板失败：${getAxiosErrorMessage(err, '未知错误')}`);
        return [];
      }
    },
  });

  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      try {
        return await monitorApi.listReports();
      } catch (err: unknown) {
        message.error(`加载报告列表失败：${getAxiosErrorMessage(err, '未知错误')}`);
        return [];
      }
    },
  });

  const { data: analytics } = useQuery<unknown>({
    queryKey: ['reportAnalytics'],
    queryFn: async () => monitorApi.getReportAnalytics(),
    staleTime: 120000,
  });

  const { data: scheduledReports } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: async () => {
      try {
        return await monitorApi.listScheduledReports();
      } catch (err: unknown) {
        message.error(`加载定时报告失败：${getAxiosErrorMessage(err, '未知错误')}`);
        return [];
      }
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: CreateTemplateFormState) =>
      monitorApi.createReportTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportTemplates'] });
      setShowCreateTemplateModal(false);
      setTemplateForm(EMPTY_TEMPLATE_FORM);
    },
    onError: (err: unknown) => {
      message.error(`创建模板失败：${getAxiosErrorMessage(err, '未知错误')}`);
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async ({
      templateId,
      variables,
    }: {
      templateId: string;
      variables: Record<string, string>;
    }) => monitorApi.generateReport({ templateId, variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowGenerateReportModal(false);
      setFormData({});
    },
    onError: (err: unknown) => {
      message.error(`生成报告失败：${getAxiosErrorMessage(err, '未知错误')}`);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => monitorApi.deleteReportTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportTemplates'] });
    },
    onError: (err: unknown) => {
      message.error(`删除模板失败：${getAxiosErrorMessage(err, '未知错误')}`);
    },
  });

  const handleGenerateReport = (templateId: string) => {
    const template = (templates as ReportTemplate[] | undefined)?.find((t) => t.id === templateId);
    if (!template) return;
    const initialData: Record<string, string> = {};
    template.variables?.forEach((v: string) => {
      initialData[v] = '';
    });
    setFormData(initialData);
    setSelectedTemplateId(templateId);
    setShowGenerateReportModal(true);
  };

  const handleSubmitGenerate = () => {
    generateReportMutation.mutate({
      templateId: selectedTemplateId,
      variables: formData,
    });
  };

  const handleViewReport = (report: GeneratedReport) => {
    setSelectedReport(report);
    setShowViewReportModal(true);
  };

  const handleDownloadReport = async (
    reportId: string,
    format: 'markdown' | 'pdf' | 'word' = 'markdown',
  ) => {
    try {
      const response = await api.get(`/reports/${reportId}/export?format=${format}`, {
        responseType: 'blob',
      });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileExtension = format === 'pdf' ? 'pdf' : format === 'word' ? 'doc' : 'md';
      a.download = `report-${reportId}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      const errMsg = getAxiosErrorMessage(error, '下载失败');
      logger.error('Download failed:', error);
      message.error(errMsg);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              报告管理
            </h1>
            <p className="text-text-secondary mt-1">管理报告模板、生成报告和定时报告</p>
          </div>
          {activeTab === 'templates' && (
            <button
              onClick={() => setShowCreateTemplateModal(true)}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              创建模板
            </button>
          )}
        </div>

        <div className="flex gap-2 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="grid gap-4">
            {(templates as ReportTemplate[] | undefined)?.map((template) => (
              <div key={template.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${TYPE_COLORS[template.type] || 'text-text-secondary bg-background'}`}
                      >
                        {TYPE_LABELS[template.type] || template.type}
                      </span>
                      {template.is_preset && (
                        <span className="px-2 py-1 text-xs bg-purple-900/30 text-purple-400 rounded">
                          预设
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      {template.name}
                    </h3>
                    <p className="text-text-secondary text-sm mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {template.variables?.map((v: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-background text-text-secondary rounded"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerateReport(template.id)}
                      className="text-primary hover:text-primary/80 p-2"
                      title="生成报告"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {!template.is_preset && (
                      <>
                        <button
                          className="text-text-secondary hover:text-text-primary p-2"
                          title="编辑"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                          className="text-red-400 hover:text-red-300 p-2"
                          title="删除"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid gap-4">
            {(reports as GeneratedReport[] | undefined)?.map((report) => (
              <div key={report.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${TYPE_COLORS[report.type] || 'text-text-secondary bg-background'}`}
                      >
                        {TYPE_LABELS[report.type] || report.type}
                      </span>
                      <span className="px-2 py-1 text-xs bg-background text-text-secondary rounded">
                        {report.format}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">{report.name}</h3>
                    <p className="text-text-secondary text-sm">
                      创建时间: {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewReport(report)}
                      className="text-blue-400 hover:text-blue-300 p-2"
                      title="查看报告"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownloadReport(report.id, 'markdown')}
                      className="text-primary hover:text-primary/80 p-2"
                      title="下载 Markdown"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownloadReport(report.id, 'pdf')}
                      className="text-red-400 hover:text-red-300 p-2"
                      title="下载 PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="grid gap-4">
            {(scheduledReports as ScheduledReport[] | undefined)?.map((report) => (
              <div key={report.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${report.enabled ? 'text-green-400 bg-green-900/30' : 'text-text-secondary bg-background'}`}
                      >
                        {report.enabled ? '已启用' : '已禁用'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-background text-text-secondary rounded">
                        {report.format}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">{report.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {report.cron_expression}
                      </span>
                      {report.last_generated && (
                        <span>最后生成: {new Date(report.last_generated).toLocaleString()}</span>
                      )}
                      <span>接收人: {report.recipients?.join(', ') || '无'}</span>
                    </div>
                  </div>
                  <button className="text-primary hover:text-primary/80 p-2" title="编辑">
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && <AnalyticsTab analytics={analytics as never} />}

        <CreateTemplateModal
          open={showCreateTemplateModal}
          form={templateForm}
          onChange={setTemplateForm}
          onClose={() => setShowCreateTemplateModal(false)}
          onSubmit={() => createTemplateMutation.mutate(templateForm)}
          submitting={createTemplateMutation.isPending}
        />

        <GenerateReportModal
          open={showGenerateReportModal}
          variables={formData}
          onChange={setFormData}
          onClose={() => setShowGenerateReportModal(false)}
          onSubmit={handleSubmitGenerate}
          submitting={generateReportMutation.isPending}
        />

        <ViewReportModal
          report={showViewReportModal ? selectedReport : null}
          typeLabels={TYPE_LABELS}
          typeColors={TYPE_COLORS}
          onClose={() => {
            setShowViewReportModal(false);
            setSelectedReport(null);
          }}
          onDownload={handleDownloadReport}
        />
      </div>
    </div>
  );
}
