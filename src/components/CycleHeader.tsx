"use client";

import { IconChevron } from "./icons";

export function CycleHeader({ label, offset, setOffset }: { label: string; offset: number; setOffset: (fn: (o: number) => number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold" aria-live="polite">
          รอบ {label}
        </h1>
        <div className="flex gap-1">
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="รอบก่อนหน้า" className="grid h-11 w-11 place-items-center rounded-full hover:bg-card">
            <IconChevron dir="left" className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="รอบถัดไป" className="grid h-11 w-11 place-items-center rounded-full hover:bg-card">
            <IconChevron className="h-5 w-5" />
          </button>
        </div>
      </div>
      {offset !== 0 && (
        <button type="button" onClick={() => setOffset(() => 0)} className="min-h-11 self-start text-sm text-teal underline">
          กลับไปรอบปัจจุบัน
        </button>
      )}
    </div>
  );
}
