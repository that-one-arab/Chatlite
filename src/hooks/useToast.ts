import { useState, useCallback } from "preact/hooks";

export interface ToastItem {
  id: string;
  message: string;
  type: "error" | "success" | "info";
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: "error" | "success" | "info" = "error") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const showError = useCallback((message: string) => {
    showToast(message, "error");
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, "success");
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast(message, "info");
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    showError,
    showSuccess,
    showInfo,
    removeToast,
  };
}
