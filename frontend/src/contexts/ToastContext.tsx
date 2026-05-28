import { createContext, useContext, useCallback, useState, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const TYPE_CONFIG: Record<ToastType, { gradient: string; icon: string; borderColor: string }> = {
  success: {
    gradient: 'from-green-600/95 to-green-700/95',
    icon: '✓',
    borderColor: 'border-green-500/30'
  },
  error: {
    gradient: 'from-red-600/95 to-red-700/95',
    icon: '✕',
    borderColor: 'border-red-500/30'
  },
  warning: {
    gradient: 'from-yellow-600/95 to-yellow-700/95',
    icon: '⚠',
    borderColor: 'border-yellow-500/30'
  },
  info: {
    gradient: 'from-blue-600/95 to-blue-700/95',
    icon: 'ℹ',
    borderColor: 'border-blue-500/30'
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const cfg = TYPE_CONFIG[t.type];
          return (
            <div
              key={t.id}
              className={`bg-gradient-to-r ${cfg.gradient} backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2.5 pointer-events-auto animate-slide-in-right min-w-[280px] max-w-[420px] border ${cfg.borderColor}`}
              role="alert"
            >
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/20 rounded-lg text-xs font-bold">{cfg.icon}</span>
              <span className="truncate flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 text-lg leading-none transition-opacity"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
