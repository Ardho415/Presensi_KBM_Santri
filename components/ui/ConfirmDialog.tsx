"use client";

import { Button } from "@/components/ui/Basics";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  variant = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "primary" | "danger" | "gold";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-bold text-gray-800">{title}</h3>
        {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Batal
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
