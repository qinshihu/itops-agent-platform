/**
 * Modal 底部操作栏 widget（2026-07-21 拆分）
 *
 * 从原 AddDeviceModal.tsx L543-573 抽出
 * 包含：SSH 测试按钮 + 取消按钮 + 确认按钮
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */
import { Loader2 } from 'lucide-react';

export interface ModalFooterProps {
  isSshTab: boolean;
  isSubmitting: boolean;
  isTesting: boolean;
  onTestConnection: () => void;
  onClose: () => void;
}

export function ModalFooter({
  isSshTab,
  isSubmitting,
  isTesting,
  onTestConnection,
  onClose,
}: ModalFooterProps) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border">
      <div>
        {isSshTab && (
          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '测试 SSH 连接'
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            '确定'
          )}
        </button>
      </div>
    </div>
  );
}
