import type { AppState } from "@/domain/types";
import { parseStoredState, type ParseResult } from "./migrations";
import { emptyState } from "./empty";

export const STORAGE_KEY = "henngern.v0";

/**
 * first_run           — nothing stored yet (UI loads sample data)
 * ok                  — stored book loaded
 * recovered_corrupt   — stored data was unreadable; raw kept under `backupKey`, empty book started
 * storage_unavailable — localStorage blocked (private mode); data lives in memory only
 */
export type LoadStatus = "first_run" | "ok" | "recovered_corrupt" | "storage_unavailable";

export interface LoadResult {
  state: AppState | null;
  status: LoadStatus;
  backupKey?: string;
}

/** Persistence boundary — swap for a Supabase-backed implementation later. */
export interface Repository {
  load(): LoadResult;
  save(state: AppState): boolean;
  /** Remove the stored book (ล้างข้อมูลในเครื่อง). */
  reset(): void;
  exportJson(state: AppState): string;
  importJson(json: string): ParseResult;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function probe(storage: StorageLike | null | undefined): StorageLike | null {
  if (!storage) return null;
  try {
    const k = `${STORAGE_KEY}.probe`;
    storage.setItem(k, "1");
    storage.removeItem(k);
    return storage;
  } catch {
    return null;
  }
}

export const exportStateJson = (state: AppState): string => JSON.stringify(state, null, 2);

export class LocalStorageRepository implements Repository {
  private readonly storage: StorageLike | null;
  private memory: AppState | null = null;

  constructor(storage: StorageLike | null | undefined, private readonly now: () => number = Date.now) {
    this.storage = probe(storage);
  }

  get persistent(): boolean {
    return this.storage !== null;
  }

  load(): LoadResult {
    if (!this.storage) return { state: this.memory, status: "storage_unavailable" };
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return { state: null, status: "first_run" };
    const parsed = parseStoredState(raw);
    if (parsed.ok) return { state: parsed.state, status: "ok" };

    // Keep the unreadable data, then start an empty book so the app still opens.
    const backupKey = `${STORAGE_KEY}.corrupt-${this.now()}`;
    let backedUp = true;
    try {
      this.storage.setItem(backupKey, raw);
    } catch {
      backedUp = false;
    }
    const state = emptyState();
    // Only overwrite the original when the backup succeeded — never lose the user's data twice.
    if (backedUp) this.save(state);
    return { state, status: "recovered_corrupt", backupKey: backedUp ? backupKey : undefined };
  }

  save(state: AppState): boolean {
    if (!this.storage) {
      this.memory = state;
      return true;
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.memory = null;
    this.storage?.removeItem(STORAGE_KEY);
  }

  exportJson(state: AppState): string {
    return exportStateJson(state);
  }

  importJson(json: string): ParseResult {
    return parseStoredState(json);
  }
}
