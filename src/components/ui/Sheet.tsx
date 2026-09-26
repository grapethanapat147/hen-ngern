"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "../icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Native <dialog> as a bottom sheet (mobile) / side panel (≥900px).
 * showModal() gives focus trapping and inert background; Esc closes; the browser returns focus on close.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col nav:h-dvh nav:max-h-dvh">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-paper"
              aria-label="ปิด"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
