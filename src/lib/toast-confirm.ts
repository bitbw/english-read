import { toast } from "sonner";

type ToastConfirmOptions = {
  message: string;
  description?: string;
  /** 主操作按钮文案，默认「确认删除」 */
  confirmLabel?: string;
  /** 毫秒，默认 12s；关闭或划掉即视为取消 */
  duration?: number;
  onConfirm: () => void | Promise<void>;
};

/**
 * 用 Sonner toast 展示二次确认：仅当用户点击主操作按钮时执行 onConfirm。
 */
export function toastConfirmAction({
  message,
  description,
  confirmLabel = "确认删除",
  duration = 12_000,
  onConfirm,
}: ToastConfirmOptions): string | number {
  const id = toast(message, {
    description,
    duration,
    closeButton: true,
    action: {
      label: confirmLabel,
      onClick: () => {
        toast.dismiss(id);
        void Promise.resolve(onConfirm());
      },
    },
  });
  return id;
}
