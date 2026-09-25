"use client";

import { useState } from "react";
import { confirmDraft } from "@/domain/confirm";
import type { RecurringRule, Transaction } from "@/domain/types";
import { useBook } from "@/lib/book";
import { editableIssues, type EditableDraft } from "@/lib/drafts";
import { Sheet } from "../ui/Sheet";
import { useUi, type DraftRequest } from "../ui/UiProvider";
import { DraftCard } from "./DraftCard";

const newId = () => crypto.randomUUID();

export function DraftSheet({ request, onClose }: { request: DraftRequest | null; onClose: () => void }) {
  // Remount the editor per request so its local draft state starts fresh.
  return (
    <Sheet open={request !== null} onClose={onClose} title="ตรวจข้อมูลก่อนบันทึก">
      {request && <DraftEditor key={request.drafts.map((d) => d.key).join("|")} request={request} onClose={onClose} />}
    </Sheet>
  );
}

function DraftEditor({ request, onClose }: { request: DraftRequest; onClose: () => void }) {
  const { snapshot, store } = useBook();
  const { toast } = useUi();
  const [drafts, setDrafts] = useState<EditableDraft[]>(request.drafts);
  const state = snapshot.state;
  if (!state || !store) return null;

  const issues = drafts.map((d) => editableIssues(d, state.settings));
  const blocked = issues.some((list) => list.length > 0) || drafts.length === 0;
  const issuesId = "draft-issues";

  const save = () => {
    const nowIso = store.nowIso();
    const transactions: Transaction[] = [];
    const rules: RecurringRule[] = [];
    for (const d of drafts) {
      const result = confirmDraft(d, {
        settings: state.settings,
        nowIso,
        newId,
        source: request.source,
        match: d.match ? { ruleId: d.match.ruleId, occurrenceDate: d.match.occurrenceDate } : undefined,
      });
      if (result.type === "transaction") transactions.push(result.transaction);
      else rules.push(result.rule);
    }
    if (transactions.length) store.dispatch({ type: "add_transactions", transactions });
    rules.forEach((rule) => store.dispatch({ type: "add_rule", rule }));
    request.onSaved?.();
    onClose();
    toast({
      message: "บันทึกแล้ว",
      actionLabel: "เลิกทำ",
      onAction: () => {
        const at = store.nowIso();
        transactions.forEach((t) => store.dispatch({ type: "delete_transaction", id: t.id, nowIso: at }));
        rules.forEach((r) => store.dispatch({ type: "delete_rule", id: r.id, nowIso: at }));
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {drafts.map((d, i) => (
        <DraftCard
          key={d.key}
          draft={d}
          index={i}
          total={drafts.length}
          state={state}
          today={store.today()}
          issues={issues[i]}
          onChange={(next) => setDrafts((all) => all.map((x) => (x.key === d.key ? next : x)))}
          onRemove={drafts.length > 1 ? () => setDrafts((all) => all.filter((x) => x.key !== d.key)) : undefined}
        />
      ))}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {blocked && (
          <p id={issuesId} className="text-sm text-coral-ink">
            {drafts.length === 0 ? "ไม่มีร่างให้บันทึก" : `ยังบันทึกไม่ได้: ${[...new Set(issues.flat())].join(" · ")}`}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full border border-line px-4 font-medium hover:bg-paper">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            disabled={blocked}
            aria-describedby={blocked ? issuesId : undefined}
            className="min-h-11 flex-1 rounded-full bg-teal px-4 font-semibold text-white disabled:opacity-40"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
