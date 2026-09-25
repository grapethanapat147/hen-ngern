"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Transaction } from "@/domain/types";
import type { EditableDraft } from "@/lib/drafts";
import { DraftSheet } from "../drafts/DraftSheet";
import { ToastRegion, type ToastData } from "./Toast";

// App-wide UI: the draft review sheet and the toast. Book data lives in the store (src/lib/book.ts).

export interface DraftRequest {
  drafts: EditableDraft[];
  source: Transaction["source"];
  onSaved?: () => void;
}

interface UiApi {
  openDrafts: (req: DraftRequest) => void;
  toast: (t: Omit<ToastData, "id">) => void;
}

const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const api = useContext(UiContext);
  if (!api) throw new Error("useUi outside UiProvider");
  return api;
}

const TOAST_MS = 5_000;

export function UiProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DraftRequest | null>(null);
  const [toastData, setToastData] = useState<ToastData | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!toastData) return;
    const timer = window.setTimeout(() => setToastData(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toastData]);

  const toast = useCallback((t: Omit<ToastData, "id">) => {
    seq.current += 1;
    setToastData({ ...t, id: seq.current });
  }, []);

  const api = useMemo<UiApi>(() => ({ openDrafts: setRequest, toast }), [toast]);

  return (
    <UiContext.Provider value={api}>
      {children}
      <DraftSheet request={request} onClose={() => setRequest(null)} />
      <ToastRegion toast={toastData} onDismiss={() => setToastData(null)} />
    </UiContext.Provider>
  );
}
