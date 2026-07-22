import { X } from 'lucide-react';

interface GenerateReportModalProps {
  open: boolean;
  variables: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export function GenerateReportModal({ open, variables, onChange, onClose, onSubmit, submitting }: GenerateReportModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">生成报告</h2>
            <button onClick={onClose} className="p-2 hover:bg-background rounded-lg text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            {Object.keys(variables).length === 0 ? (
              <p className="text-text-secondary text-sm">该模板未定义变量，直接生成即可。</p>
            ) : (
              Object.keys(variables).map((key) => (
                <div key={key}>
                  <label className="block text-sm text-text-primary mb-1">{key}</label>
                  <input
                    type="text"
                    value={variables[key]}
                    onChange={(e) => onChange({ ...variables, [key]: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                    placeholder={`请输入 ${key}`}
                  />
                </div>
              ))
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-background hover:bg-surface text-text-primary py-2 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2 rounded-lg"
            >
              {submitting ? '生成中...' : '生成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
