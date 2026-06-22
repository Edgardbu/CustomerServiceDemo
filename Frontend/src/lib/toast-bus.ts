import type { ToastInput } from "@/components/providers/toast-provider";

type ToastListener = (toast: ToastInput) => void;

let toastListener: ToastListener | null = null;

export function setToastListener(listener: ToastListener | null): void {
  toastListener = listener;
}

export function emitToast(toast: ToastInput): void {
  toastListener?.(toast);
}
