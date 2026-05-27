import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Download, Clock, Trash2, Edit2, Eye, X } from 'lucide-react';
import api from '../lib/api';
import { ImportExport } from '../components/ImportExport';
import MarkdownOutput from '../components/MarkdownOutput';

export default function Reports() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'templates' | 'reports' | 'scheduled'>('reports');
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [showViewReportModal, setShowViewReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    type: 'incident' as 'incident' | 'inspection' | 'change',
    content: '',
    variables: [] as string[]
  });

  const { data: templates } = useQuery({
    queryKey: ['reportTemplates'],
    queryFn: async () => {
      const res = await api.get('/api/reports/templates');
      return res.data.data || [];
    }
  });

  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await api.get('/api/reports');
      return res.data.data || [];
    }
  });

  const { data: scheduledReports } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: async () => {
      const res = await api.get('/api/reports/scheduled/all');
      return res.data.data || [];
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const res = await api.post('/api/reports/templates', template);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportTemplates'] });
      setShowCreateTemplateModal(false);
      setTemplateForm({
        name: '',
        description: '',
        type: 'incident',
        content: '',
        variables: []
      });
    }
  });

  const generateReportMutation = useMutation({
    mutationFn: async ({ templateId, variables }: { templateId: string; variables: Record<string, string> }) => {
      const res = await api.post('/api/reports/generate', { templateId, variables, format: 'markdown' });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowGenerateReportModal(false);
      setFormData({});
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/reports/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportTemplates'] });
    }
  });

  const handleGenerateReport = (templateId: string) => {
    const template = templates?.find((t: any) => t.id === templateId);
    if (template) {
      const initialData: Record<string, string> = {};
      template.variables?.forEach((v: string) => {
        initialData[v] = '';
      });
      setFormData(initialData);
      setSelectedTemplateId(templateId);
      setShowGenerateReportModal(true);
    }
  };

  const handleSubmitGenerate = () => {
    generateReportMutation.mutate({
      templateId: selectedTemplateId,
      variables: formData
    });
  };

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setShowViewReportModal(true);
  };

  const handleDownloadReport = async (reportId: string, format: 'markdown' | 'pdf' | 'word' = 'pdf') => {
    try {
      const response = await api.get(`/api/reports/${reportId}/export?format=${format}`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.${format === 'markdown' ? 'md' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const typeLabels: Record<string, string> = {
    incident: '故障报告',
    inspection: '巡检报告',
    change: '变更记录'
  };

  const typeColors: Record<string, string> = {
    incident: 'text-red-400 bg-red-900/30',
    inspection: 'text-blue-400 bg-blue-900/30',
    change: 'text-green-400 bg-green-900/30'
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
          {(['templates', 'reports', 'scheduled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'templates' ? '报告模板' : tab === 'reports' ? '已生成报告' : '定时报告'}
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="grid gap-4">
            {templates?.map((template: any) => (
              <div key={template.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs rounded ${typeColors[template.type] || 'text-text-secondary bg-background'}`}>
                        {typeLabels[template.type] || template.type}
                      </span>
                      {template.is_preset && (
                        <span className="px-2 py-1 text-xs bg-purple-900/30 text-purple-400 rounded">
                          预设
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">{template.name}</h3>
                    <p className="text-text-secondary text-sm mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {template.variables?.map((v: string, i: number) => (
                        <span key={i} className="px-2 py-1 text-xs bg-background text-text-secondary rounded">
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
                        <button className="text-text-secondary hover:text-text-primary p-2" title="编辑">
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
            {reports?.map((report: any) => (
              <div key={report.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs rounded ${typeColors[report.type] || 'text-text-secondary bg-background'}`}>
                        {typeLabels[report.type] || report.type}
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
            {scheduledReports?.map((report: any) => (
              <div key={report.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        report.enabled ? 'text-green-400 bg-green-900/30' : 'text-text-secondary bg-background'
                      }`}>
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
                        <span>
                          最后生成: {new Date(report.last_generated).toLocaleString()}
                        </span>
                      )}
                      <span>
                        接收人: {report.recipients?.join(', ') || '无'}
                      </span>
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

        {showCreateTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-text-primary mb-4">创建报告模板</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-primary mb-1">模板名称</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                      placeholder="输入模板名称"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-primary mb-1">描述</label>
                    <input
                      type="text"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                      placeholder="输入模板描述"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-primary mb-1">报告类型</label>
                    <select
                      value={templateForm.type}
                      onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                    >
                      <option value="incident">故障报告</option>
                      <option value="inspection">巡检报告</option>
                      <option value="change">变更记录</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-text-primary mb-1">
                      模板内容 (使用 {'{{variable}}'} 定义变量)
                    </label>
                    <textarea
                      value={templateForm.content}
                      onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg p-2 text-text-primary font-mono text-sm"
                      rows={10}
                      placeholder="输入模板内容..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-primary mb-1">
                      变量列表 (每行一个)
                    </label>
                    <textarea
                      value={templateForm.variables?.join('\n') || ''}
                      onChange={(e) => setTemplateForm({
                        ...templateForm,
                        variables: e.target.value.split('\n').filter(v => v.trim())
                      })}
                      className="w-full bg-background border border-border rounded-lg p-2 text-text-primary font-mono text-sm"
                      rows={4}
                      placeholder="variable1&#10;variable2&#10;..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateTemplateModal(false)}
                    className="flex-1 bg-background hover:bg-surface text-text-primary py-2 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => createTemplateMutation.mutate(templateForm)}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg"
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGenerateReportModal && selectedTemplateId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-text-primary mb-4">生成报告</h2>
                <div className="space-y-4">
                  {Object.keys(formData).map(key => (
                    <div key={key}>
                      <label className="block text-sm text-text-primary mb-1">{key}</label>
                      <input
                        type="text"
                        value={formData[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                        placeholder={`请输入 ${key}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowGenerateReportModal(false)}
                    className="flex-1 bg-background hover:bg-surface text-text-primary py-2 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitGenerate}
                    disabled={generateReportMutation.isPending}
                    className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2 rounded-lg"
                  >
                    {generateReportMutation.isPending ? '生成中...' : '生成'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showViewReportModal && selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-xl font-bold text-text-primary">{selectedReport.name}</h2>
                <button
                  onClick={() => setShowViewReportModal(false)}
                  className="p-2 hover:bg-background rounded-lg text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${typeColors[selectedReport.type] || 'text-text-secondary bg-background'}`}>
                    {typeLabels[selectedReport.type] || selectedReport.type}
                  </span>
                  <span className="text-text-secondary text-sm">
                    创建时间: {new Date(selectedReport.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="prose prose-invert max-w-none">
                  <MarkdownOutput content={selectedReport.content || '无内容'} />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-3">
                <button
                  onClick={() => setShowViewReportModal(false)}
                  className="px-4 py-2 bg-background hover:bg-surface text-text-primary rounded-lg"
                >
                  关闭
                </button>
                <button
                  onClick={() => handleDownloadReport(selectedReport.id, 'markdown')}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg"
                >
                  下载
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
