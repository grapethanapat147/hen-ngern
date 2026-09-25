import { describe, expect, it } from "vitest";
import { cycleFor } from "@/domain/cycle";
import { cycleTotals } from "@/domain/totals";
import { LocalStorageRepository, STORAGE_KEY } from "../repository";
import { BookStore } from "../store";
import { BlockedStorage, MemoryStorage } from "./memory-storage";

const clock = { today: () => "2026-10-15", nowIso: () => "2026-10-15T03:00:00.000Z" };
const make = (storage = new MemoryStorage()) => {
  const store = new BookStore(new LocalStorageRepository(storage, () => 42), clock);
  store.init();
  return { store, storage };
};

describe("BookStore", () => {
  it("first open loads the labelled sample and persists it", () => {
    const { store, storage } = make();
    const snap = store.getSnapshot();
    expect(snap.ready).toBe(true);
    expect(snap.state?.isSample).toBe(true);
    expect(snap.notices).toEqual(["sample"]);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("เริ่มสมุดของฉัน → empty book, sample banner gone, persisted", () => {
    const { store, storage } = make();
    store.dispatch({ type: "start_own_book" });
    const snap = store.getSnapshot();
    expect(snap.state?.isSample).toBe(false);
    expect(snap.state?.transactions).toEqual([]);
    expect(snap.notices).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).isSample).toBe(false);
  });

  it("A-D3 — corrupt storage shows the banner and an empty book", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "garbage");
    const { store } = make(storage);
    expect(store.getSnapshot().notices).toEqual(["recovered_corrupt"]);
    expect(store.getSnapshot().state?.transactions).toEqual([]);
    expect(storage.getItem(`${STORAGE_KEY}.corrupt-42`)).toBe("garbage");
  });

  it("blocked storage still works in memory and says so", () => {
    const { store } = make(new BlockedStorage());
    expect(store.getSnapshot().notices).toEqual(["sample", "storage_unavailable"]);
    store.dispatch({ type: "start_own_book" });
    expect(store.getSnapshot().notices).toEqual(["storage_unavailable"]);
  });

  it("A-9 (unit) — delete then undo restores the total", () => {
    const { store } = make();
    const cycle = cycleFor("2026-10-15", 1);
    const spent = () => cycleTotals({ ...store.getSnapshot().state!, cycle, today: "2026-10-15" }).actualExpenseMinor;
    const before = spent();
    store.dispatch({ type: "delete_transaction", id: "sample-tx-taxi", nowIso: clock.nowIso() });
    expect(spent()).toBe(before - 22_000);
    store.dispatch({ type: "restore_transaction", id: "sample-tx-taxi", nowIso: clock.nowIso() });
    expect(spent()).toBe(before);
    expect(store.getSnapshot().state!.transactions.find((t) => t.id === "sample-tx-taxi")?.deletedAt).toBeUndefined();
  });

  it("notifies subscribers and reports a failed save", () => {
    const { store, storage } = make();
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));
    storage.failWrites = true;
    store.dispatch({ type: "update_settings", settings: { cycleStartDay: 25 } });
    expect(calls).toBe(1);
    expect(store.getSnapshot().notices).toContain("save_failed");
    expect(store.getSnapshot().state?.settings.cycleStartDay).toBe(25);
    unsubscribe();
  });

  it("changing FX in settings keeps saved transactions' locked rate", () => {
    const { store } = make();
    store.dispatch({ type: "update_settings", settings: { fx: { USD: 34, EUR: 36.4 } } });
    const claude = store.getSnapshot().state!.transactions.find((t) => t.id === "sample-tx-paid-claude");
    expect(claude?.fxRateToThb).toBe(33.25);
  });

  it("skip_occurrence adds the date once", () => {
    const { store } = make();
    const act = { type: "skip_occurrence", ruleId: "sample-rule-netflix", date: "2026-11-09", nowIso: clock.nowIso() } as const;
    store.dispatch(act);
    store.dispatch(act);
    expect(store.getSnapshot().state!.rules.find((r) => r.id === "sample-rule-netflix")?.skippedDates).toEqual(["2026-11-09"]);
  });

  it("clearAll wipes storage and starts an empty book", () => {
    const { store, storage } = make();
    store.clearAll();
    expect(store.getSnapshot().state?.transactions).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).isSample).toBe(false);
  });
});
