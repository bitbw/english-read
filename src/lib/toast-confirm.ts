export const TOAST_CONFIRM_EVENT = "english-read:confirm-action";

export type ToastConfirmOptions = {
  message: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

export function toastConfirmAction(options: ToastConfirmOptions): void {
  window.dispatchEvent(new CustomEvent<ToastConfirmOptions>(TOAST_CONFIRM_EVENT, {
    detail: options,
  }));
}
