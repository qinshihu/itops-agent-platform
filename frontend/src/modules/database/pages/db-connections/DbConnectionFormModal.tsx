/**
 * DbConnection 创建/编辑表单 modal（2026-07-21 拆分）
 *
 * 从原 DbConnections.tsx L370-551 抽出
 * 包含 10 字段 + 测试连接 + 取消/保存按钮
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { X, RefreshCw, Eye, EyeOff } from 'lucide-react';
import type { DbConnection, DbConnectionFormData } from './types';

export interface DbConnectionFormModalProps {
  isOpen: boolean;
  editingConn: DbConnection | null;
  form: DbConnectionFormData;
  setForm: React.Dispatch<React.SetStateAction<DbConnectionFormData>>;
  showPassword: boolean;
  setShowPassword: (b: boolean) => void;
  isSubmitting: boolean;
  isTesting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTest: () => void;
}

export function DbConnectionFormModal({
  isOpen,
  editingConn,
  form,
  setForm,
  showPassword,
  setShowPassword,
  isSubmitting,
  isTesting,
  onClose,
  onSubmit,
  onTest,
}: DbConnectionFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface backdrop-blur-xl rounded-2xl w-full max-w-lg border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">
            {editingConn ? '编辑数据库连接' : '添加数据库连接'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">连接名称 *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：生产环境MySQL"
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">数据库类型 *</label>
              <select
                value={form.db_type}
                onChange={(e) => setForm({ ...form, db_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="oracle">Oracle</option>
                <option value="sqlite">SQLite</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">端口 *</label>
              <input
                type="number"
                required
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">主机地址 *</label>
              <input
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="127.0.0.1"
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">数据库名 *</label>
              <input
                required
                value={form.database}
                onChange={(e) => setForm({ ...form, database: e.target.value })}
                placeholder="数据库名称"
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">用户名 *</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="root"
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                {editingConn ? '密码（留空不修改）' : '密码 *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingConn}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingConn ? '••••••' : '请输入密码'}
                  className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-all"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="可选，填写连接用途说明"
              rows={2}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">标签（逗号分隔）</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="prod, mysql, business"
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
            />
            <label htmlFor="enabled" className="text-sm text-text-primary">
              启用连接
            </label>
          </div>
        </form>

        <div className="p-6 border-t border-border/30 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all font-medium border border-slate-600/30"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onTest}
            disabled={
              isTesting ||
              !form.host ||
              !form.username ||
              (!form.password && !editingConn) ||
              !form.database
            }
            className="flex-1 px-4 py-2.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isTesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                测试连接
              </>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => onSubmit(e as unknown as React.FormEvent)}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : editingConn ? '保存修改' : '创建连接'}
          </button>
        </div>
      </div>
    </div>
  );
}
