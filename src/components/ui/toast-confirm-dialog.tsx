"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TOAST_CONFIRM_EVENT,
  type ToastConfirmOptions,
} from "@/lib/toast-confirm";

export function ToastConfirmDialog() {
  const t = useTranslations("dialog");
  const [confirmation, setConfirmation] = useState<ToastConfirmOptions | null>(null);

  useEffect(() => {
    const onConfirmRequest = (event: Event) => {
      setConfirmation((event as CustomEvent<ToastConfirmOptions>).detail);
    };
    window.addEventListener(TOAST_CONFIRM_EVENT, onConfirmRequest);
    return () => window.removeEventListener(TOAST_CONFIRM_EVENT, onConfirmRequest);
  }, []);

  function close() {
    setConfirmation(null);
  }

  return (
    <Dialog open={confirmation !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmation?.message}</DialogTitle>
          {confirmation?.description ? (
            <DialogDescription>{confirmation.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={close}>{t("cancel")}</Button>
          <Button
            variant="destructive"
            onClick={() => {
              const current = confirmation;
              close();
              if (current) void Promise.resolve(current.onConfirm());
            }}
          >
            {confirmation?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
