import { todayLocal } from "@/domain/dates";
import type { AppState } from "@/domain/types";
import { bookReducer, type BookAction } from "./reducer";
import type { LoadStatus, Repository } from "./repository";
import { buildSampleState } from "./sample";

// Framework-free store: holds the book, persists every change, notifies subscribers.
// React binds to it with useSyncExternalStore (src/lib/book.ts).

export type Notice = "sample" | "recovered_corrupt" | "storage_unavailable" | "save_failed";

export interface BookSnapshot {
  ready: boolean;
  state: AppState | null;
  loadStatus: LoadStatus | null;
  /** Banners the UI should show. */
  notices: Notice[];
}

export const LOADING_SNAPSHOT: BookSnapshot = { ready: false, state: null, loadStatus: null, notices: [] };

export class BookStore {
  private snapshot: BookSnapshot = LOADING_SNAPSHOT;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly repo: Repository,
    private readonly clock: { today: () => string; nowIso: () => string } = {
      today: () => todayLocal(),
      nowIso: () => new Date().toISOString(),
    },
  ) {}

  /** Read storage once. First run loads the labelled sample book. */
  init(): void {
    if (this.snapshot.ready) return;
    const result = this.repo.load();
    const notices: Notice[] = [];
    let state = result.state;
    if (result.status === "first_run" || (result.status === "storage_unavailable" && state === null)) {
      state = buildSampleState(this.clock.today(), this.clock.nowIso());
      this.repo.save(state);
    }
    if (result.status === "recovered_corrupt") notices.push("recovered_corrupt");
    if (result.status === "storage_unavailable") notices.push("storage_unavailable");
    this.snapshot = { ready: true, state, loadStatus: result.status, notices: withSample(notices, state) };
    this.emit();
  }

  getSnapshot = (): BookSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispatch = (action: BookAction): void => {
    const current = this.snapshot.state;
    if (!current) return;
    const next = bookReducer(current, action);
    if (next === current) return;
    const saved = this.repo.save(next);
    const notices: Notice[] = this.snapshot.notices.filter((n) => n !== "sample" && n !== "save_failed");
    if (!saved) notices.push("save_failed");
    this.snapshot = { ...this.snapshot, state: next, notices: withSample(notices, next) };
    this.emit();
  };

  /** Replace the sample with a sample freshly dated to today (โหลดข้อมูลตัวอย่าง). */
  loadSample(): void {
    this.dispatch({ type: "replace", state: buildSampleState(this.clock.today(), this.clock.nowIso()) });
  }

  /** ล้างข้อมูลในเครื่อง → empty book. */
  clearAll(): void {
    this.repo.reset();
    this.dispatch({ type: "start_own_book" });
  }

  dismiss(notice: Notice): void {
    this.snapshot = { ...this.snapshot, notices: this.snapshot.notices.filter((n) => n !== notice) };
    this.emit();
  }

  exportJson(): string | null {
    return this.snapshot.state ? this.repo.exportJson(this.snapshot.state) : null;
  }

  /** Validate an import without applying it; call `dispatch({type:"replace"})` after the user confirms. */
  previewImport(json: string) {
    return this.repo.importJson(json);
  }

  nowIso(): string {
    return this.clock.nowIso();
  }

  today(): string {
    return this.clock.today();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

function withSample(notices: Notice[], state: AppState | null): Notice[] {
  return state?.isSample ? ["sample", ...notices.filter((n) => n !== "sample")] : notices;
}
