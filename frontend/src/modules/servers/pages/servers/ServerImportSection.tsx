import { Upload } from 'lucide-react';
import type { ImportResult } from '../useServerActions';

interface ServerImportSectionProps {
  isOpen: boolean;
  importData: string;
  onImportDataChange: (data: string) => void;
  importResult: ImportResult | null;
  onClose: () => void;
  onImport: () => void;
}

export function ServerImportSection({
  isOpen,
  importData,
  onImportDataChange,
  importResult,
  onClose,
  onImport,
}: ServerImportSectionProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-text-primary mb-4">批量导入服务器</h3>
        <p className="text-sm text-text-secondary mb-4">
          每行一个 JSON 对象，包含以下字段：name, hostname, port, username, password,
          use_ssh_key(0/1), description, tags(逗号分隔)
        </p>
        <div className="mb-4 p-3 bg-background rounded-lg">
          <p className="text-xs text-text-secondary font-mono mb-2">示例:</p>
          <pre className="text-xs text-text-secondary font-mono overflow-x-auto">{`{"name":"Web-01","hostname":"192.168.1.10","port":22,"username":"root","password":"xxx","use_ssh_key":0,"description":"生产服务器","tags":"prod,web"}`}</pre>
        </div>
        <textarea
          value={importData}
          onChange={(e) => onImportDataChange(e.target.value)}
          placeholder="每行一个 JSON 对象..."
          rows={8}
          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary font-mono text-sm"
        />
        {importResult && (
          <div className="mt-4 p-4 bg-background rounded-lg">
            <h4 className="font-medium text-text-primary mb-2">导入结果</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-2xl font-bold text-status-success">
                  {importResult.success}
                </span>
                <p className="text-xs text-text-secondary">成功</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-status-failed">
                  {importResult.failed}
                </span>
                <p className="text-xs text-text-secondary">失败</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-text-secondary">
                  {importResult.skipped}
                </span>
                <p className="text-xs text-text-secondary">跳过(重复)</p>
              </div>
            </div>
            {importResult.details && importResult.details.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                {importResult.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span>
                      {d.name} ({d.hostname})
                    </span>
                    <span
                      className={
                        d.status === 'success'
                          ? 'text-status-success'
                          : d.status === 'duplicate'
                            ? 'text-text-secondary'
                            : 'text-status-failed'
                      }
                    >
                      {d.status === 'success'
                        ? '✓ 成功'
                        : d.status === 'duplicate'
                          ? '跳过'
                          : `✗ ${d.error}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            关闭
          </button>
          <button
            onClick={onImport}
            disabled={!importData}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            导入
          </button>
        </div>
      </div>
    </div>
  );
}