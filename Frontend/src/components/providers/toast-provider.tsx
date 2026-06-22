"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { setToastListener } from "@/lib/toast-bus";

export type ToastVariant = "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastRecord extends ToastInput {
  id: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = crypto.randomUUID();
      const record: ToastRecord = {
        id,
        title: toast.title,
        description: toast.description,
        variant: toast.variant ?? "success",
        durationMs: toast.durationMs ?? DEFAULT_DURATION_MS,
      };

      setToasts((current) => [...current, record]);

      const timer = setTimeout(() => {
        dismissToast(id);
      }, record.durationMs);

      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const showSuccess = useCallback(
    (title: string, description?: string) => {
      showToast({ title, description, variant: "success" });
    },
    [showToast],
  );

  const showError = useCallback(
    (title: string, description?: string) => {
      showToast({ title, description, variant: "error" });
    },
    [showToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    setToastListener(showToast);
    return () => setToastListener(null);
  }, [showToast]);

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, dismissToast }),
    [showToast, showSuccess, showError, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const isSuccess = toast.variant === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card p-4 shadow-lg ring-1 ring-foreground/10",
        isSuccess
          ? "border-emerald-500/30"
          : "border-destructive/30",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          isSuccess ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
