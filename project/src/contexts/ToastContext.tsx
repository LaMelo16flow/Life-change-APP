import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  leaving?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_STYLES: Record<ToastType, { icon: typeof CheckCircle2; iconWrap: string; accent: string; ring: string }> = {
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-100 text-emerald-600',
    accent: 'bg-emerald-500',
    ring: 'ring-emerald-100',
  },
  error: {
    icon: AlertCircle,
    iconWrap: 'bg-red-100 text-red-600',
    accent: 'bg-red-500',
    ring: 'ring-red-100',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-100 text-amber-600',
    accent: 'bg-amber-500',
    ring: 'ring-amber-100',
  },
  info: {
    icon: Info,
    iconWrap: 'bg-blue-100 text-blue-600',
    accent: 'bg-blue-500',
    ring: 'ring-blue-100',
  },
};

const TOAST_TITLES: Record<ToastType, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Notice',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 180);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error', 5000), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none">
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type];
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-xl bg-white shadow-lg ring-1 ${style.ring} border border-slate-100 ${
                toast.leaving ? 'animate-toast-out' : 'animate-toast-in'
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} />
              <div className="flex items-start gap-3 p-4 pl-5 w-full">
                <div className={`flex-shrink-0 p-1.5 rounded-full ${style.iconWrap}`}>
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                    {TOAST_TITLES[toast.type]}
                  </p>
                  <p className="text-sm font-medium text-slate-800 leading-snug break-words">
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-md p-1 transition-colors"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {toast.duration > 0 && !toast.leaving && (
                <span
                  className={`absolute bottom-0 left-0 h-0.5 w-full ${style.accent} opacity-40 animate-toast-shrink`}
                  style={{ animationDuration: `${toast.duration}ms` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
