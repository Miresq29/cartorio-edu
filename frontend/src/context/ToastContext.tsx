
import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove após 4 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts }}>
      {children}
      {/* Toast Container Inline para simplicidade */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-in slide-in-from-right-full flex items-center gap-3 min-w-[300px] ${
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
              'bg-white border-[#E8D5A3] text-[#1A2744]'
            }`}
          >
            <i className={`fa-solid ${
              toast.type === 'error' ? 'fa-circle-xmark' :
              toast.type === 'success' ? 'fa-circle-check' :
              'fa-circle-info'
            }`}></i>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};
