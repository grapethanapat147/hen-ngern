"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBook } from "@/lib/book";
import { BANNERS } from "@/lib/copy";

export function Banners() {
  const { snapshot, store } = useBook();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  if (!snapshot.ready || !store) return null;

  return (
    <div className="flex flex-col gap-2 px-4 empty:hidden">
      {snapshot.notices.includes("sample") && (
        <div data-testid="sample-banner" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-soft px-4 py-2.5">
          <p className="font-semibold">{BANNERS.sample}</p>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={BANNERS.startOwnConfirm}>
              <span className="text-sm">{BANNERS.startOwnConfirm}</span>
              <button
                type="button"
                className="min-h-11 rounded-full bg-teal px-4 text-sm font-semibold text-white"
                onClick={() => {
                  store.dispatch({ type: "start_own_book" });
                  setConfirming(false);
                  router.push("/settings");
                }}
              >
                ยืนยัน
              </button>
              <button type="button" className="min-h-11 rounded-full border border-line bg-card px-4 text-sm" onClick={() => setConfirming(false)}>
                ยกเลิก
              </button>
            </div>
          ) : (
            <button type="button" className="min-h-11 rounded-full bg-teal px-4 text-sm font-semibold text-white" onClick={() => setConfirming(true)}>
              {BANNERS.startOwn}
            </button>
          )}
        </div>
      )}
      {(["recovered_corrupt", "storage_unavailable", "save_failed"] as const)
        .filter((n) => snapshot.notices.includes(n))
        .map((n) => (
          <div key={n} role="alert" className="flex items-center justify-between gap-2 rounded-2xl bg-coral-soft px-4 py-2 text-coral-ink">
            <p className="text-sm font-medium">{BANNERS[n]}</p>
            <button type="button" className="min-h-11 shrink-0 px-2 text-sm underline" onClick={() => store.dismiss(n)}>
              ปิด
            </button>
          </div>
        ))}
    </div>
  );
}
