import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

interface ToastContextType {
  toast: ToastApi;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION_MS = 4500;

const TOAST_CONFIG = {
  success: {
    borderLeft: 'border-l-emerald-500',
    iconBg:
      'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    progressBar: 'bg-emerald-500',
    icon: CheckCircle2,
    defaultTitle: 'Success',
  },
  error: {
    borderLeft: 'border-l-rose-500',
    iconBg:
      'bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/30 text-rose-600 dark:text-rose-400',
    progressBar: 'bg-rose-500',
    icon: AlertCircle,
    defaultTitle: 'Error',
  },
  warning: {
    borderLeft: 'border-l-amber-500',
    iconBg:
      'bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
    progressBar: 'bg-amber-500',
    icon: AlertTriangle,
    defaultTitle: 'Warning',
  },
  info: {
    borderLeft: 'border-l-blue-500',
    iconBg:
      'bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
    progressBar: 'bg-blue-500',
    icon: Info,
    defaultTitle: 'Information',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      timers.current.set(
        id,
        window.setTimeout(() => removeToast(id), TOAST_DURATION_MS)
      );
    },
    [removeToast]
  );

  // Clear pending timers on unmount
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  // Stable identity so consumers can list it as an effect dependency
  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, title) => addToast('success', message, title),
      error: (message, title) => addToast('error', message, title),
      info: (message, title) => addToast('info', message, title),
      warning: (message, title) => addToast('warning', message, title),
    }),
    [addToast]
  );

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed top-5 right-0 sm:right-5 z-[10000] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const config = TOAST_CONFIG[t.type] || TOAST_CONFIG.info;
          const Icon = config.icon;

          return (
            <div
              key={t.id}
              role={t.type === 'error' || t.type === 'warning' ? 'alert' : 'status'}
              className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/15 dark:shadow-black/70 backdrop-blur-xl transition-all duration-300 animate-slideInRight border-l-4 ${config.borderLeft}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${config.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-0.5">
                  {t.title || config.defaultTitle}
                </h4>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition -mr-1 -mt-1"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                <div className={`h-full ${config.progressBar} animate-toastProgress`} />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
