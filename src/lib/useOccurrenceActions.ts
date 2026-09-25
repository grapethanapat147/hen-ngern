"use client";

import { formatThaiShort } from "@/domain/dates";
import type { Occurrence } from "@/domain/recurrence";
import { useUi } from "@/components/ui/UiProvider";
import { useBook } from "./book";
import { draftFromOccurrence } from "./drafts";

/** จ่ายแล้ว/ได้รับแล้ว opens a pre-filled draft; ข้ามรอบนี้ skips with undo. */
export function useOccurrenceActions() {
  const { store } = useBook();
  const { openDrafts, toast } = useUi();
  return {
    pay: (o: Occurrence) => openDrafts({ drafts: [draftFromOccurrence(o, `${o.ruleId}-${o.date}`)], source: "manual" }),
    skip: (o: Occurrence) => {
      if (!store) return;
      store.dispatch({ type: "skip_occurrence", ruleId: o.ruleId, date: o.date, nowIso: store.nowIso() });
      toast({
        message: `ข้าม ${o.name} รอบ ${formatThaiShort(o.date)} แล้ว`,
        actionLabel: "เลิกทำ",
        onAction: () => store.dispatch({ type: "unskip_occurrence", ruleId: o.ruleId, date: o.date, nowIso: store.nowIso() }),
      });
    },
  };
}
