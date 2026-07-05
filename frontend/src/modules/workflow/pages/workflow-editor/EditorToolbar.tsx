import { ArrowLeft, Save, Play, Download, Upload, Undo, Redo, AlertCircle } from 'lucide-react';

interface EditorToolbarProps {
  isNew: boolean;
  showExecute: boolean;
  name: string;
  description: string;
  isTemplate: boolean;
  validationErrors: string[];
  historyIndex: number;
  historyLength: number;
  saving: boolean;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTemplateChange: (checked: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onImport: React.ChangeEventHandler<HTMLInputElement>;
  onExport: () => void;
  onExecute: () => void;
  onSave: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function EditorToolbar({
  isNew,
  showExecute,
  name,
  description,
  isTemplate,
  validationErrors,
  historyIndex,
  historyLength,
  saving,
  onBack,
  onNameChange,
  onDescriptionChange,
  onTemplateChange,
  onUndo,
  onRedo,
  onImport,
  onExport,
  onExecute,
  onSave,
  fileInputRef,
}: EditorToolbarProps) {
  return (
    <div className="border-b border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <div>
            <h1 className="text-xl font-bold">
              {isNew ? '新建工作流' : '编辑工作流'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="撤销"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={historyIndex >= historyLength - 1}
            className="p-2 rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="重做"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-2" />

          <input
            type="file"
            ref={fileInputRef}
            onChange={onImport}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background transition-colors"
            title="导入工作流"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">导入</span>
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background transition-colors"
            title="导出工作流"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">导出</span>
          </button>

          <div className="w-px h-6 bg-border mx-2" />

          {showExecute && (
            <button
              onClick={onExecute}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              立即执行
            </button>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">工作流名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="例如：服务器CPU告警自动排查"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">工作流描述</label>
          <input
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="描述这个工作流的用途"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => onTemplateChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-text-secondary">设为模板</span>
          </label>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">发现问题</span>
          </div>
          <ul className="text-sm text-red-500 space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}