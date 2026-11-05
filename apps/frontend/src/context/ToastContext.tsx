import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, message, title };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((message: string, title?: string) => {
    showToast('success', message, title || 'Success');
  }, [showToast]);

  const error = useCallback((message: string, title?: string) => {
    showToast('error', message, title || 'Action Error');
  }, [showToast]);

  const info = useCallback((message: string, title?: string) => {
    showToast('info', message, title || 'Notice');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}

      {/* Floating Toast Container */}
      <div
        className="toast-container"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100% - 32px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          const borderColor = isSuccess
            ? 'rgba(16, 185, 129, 0.45)'
            : isError
            ? 'rgba(244, 63, 94, 0.45)'
            : 'rgba(56, 189, 248, 0.45)';

          const iconColor = isSuccess
            ? 'var(--accent-emerald, #10b981)'
            : isError
            ? 'var(--accent-rose, #f43f5e)'
            : 'var(--accent-cyan, #06b6d4)';

          return (
            <div
              key={t.id}
              className="toast-card"
              style={{
                pointerEvents: 'auto',
                backgroundColor: '#ffffff',
                backdropFilter: 'blur(12px)',
                border: `1.5px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.15), 0 2px 8px rgba(6, 148, 148, 0.1)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'slideInToast 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ color: iconColor, flexShrink: 0, marginTop: '2px' }}>
                {isSuccess && <CheckCircle size={20} />}
                {isError && <AlertCircle size={20} />}
                {!isSuccess && !isError && <Info size={20} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <div style={{ fontWeight: '800', fontSize: '13.5px', marginBottom: '2px', color: iconColor }}>
                    {t.title}
                  </div>
                )}
                <div style={{ fontSize: '13px', lineHeight: '1.45', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                  {t.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
