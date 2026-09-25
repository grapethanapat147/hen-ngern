"use client";

export interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Live region is always mounted so screen readers announce new toasts. */
export function ToastRegion({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 nav:bottom-6"
    >
      {toast && (
        <div className="pointer-events-auto flex min-h-11 items-center gap-3 rounded-full bg-navy py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="min-h-9 rounded-full bg-white/15 px-3 font-medium hover:bg-white/25"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
