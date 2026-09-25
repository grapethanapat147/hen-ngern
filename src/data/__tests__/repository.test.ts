import { describe, expect, it } from "vitest";
import { cycleFor } from "@/domain/cycle";
import { cycleTotals } from "@/domain/totals";
import { listOccurrences } from "@/domain/recurrence";
import { emptyState } from "../empty";
import { LocalStorageRepository, STORAGE_KEY } from "../repository";
import { buildSampleState } from "../sample";
import { BlockedStorage, MemoryStorage } from "./memory-storage";

const TODAY = "2026-10-15";
const NOW = "2026-10-15T03:00:00.000Z";

describe("LocalStorageRepository", () => {
  it("first run has no state", () => {
    expect(new LocalStorageRepository(new MemoryStorage()).load()).toEqual({ state: null, status: "first_run" });
  });

  it("A-D2 (unit) — saved state loads back unchanged", () => {
    const storage = new MemoryStorage();
    const state = buildSampleState(TODAY, NOW);
    new LocalStorageRepository(storage).save(state);
    expect(new LocalStorageRepository(storage).load()).toEqual({ state, status: "ok" });
  });

  it("A-D3 — broken JSON: empty book, raw backed up, original key replaced", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const result = new LocalStorageRepository(storage, () => 1_760_000_000_000).load();
    expect(result.status).toBe("recovered_corrupt");
    expect(result.state).toEqual(emptyState());
    expect(result.backupKey).toBe(`${STORAGE_KEY}.corrupt-1760000000000`);
    expect(storage.getItem(result.backupKey!)).toBe("{not json");
    // The next load is clean — no second backup.
    expect(new LocalStorageRepository(storage).load().status).toBe("ok");
  });

  it("A-D3 — valid JSON with a bad shape is also recovered", () => {
    const storage = new MemoryStorage();
    const bad = { ...emptyState(), transactions: [{ id: "x", amountMinor: 12.5 }] };
    storage.setItem(STORAGE_KEY, JSON.stringify(bad));
    expect(new LocalStorageRepository(storage).load().status).toBe("recovered_corrupt");
  });

  it("data from a newer app version is backed up, not silently dropped", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), schemaVersion: 2 }));
    const result = new LocalStorageRepository(storage, () => 1).load();
    expect(result.status).toBe("recovered_corrupt");
    expect(storage.getItem(`${STORAGE_KEY}.corrupt-1`)).toContain('"schemaVersion":2');
  });

  it("blocked storage falls back to memory", () => {
    const repo = new LocalStorageRepository(new BlockedStorage());
    expect(repo.persistent).toBe(false);
    expect(repo.load().status).toBe("storage_unavailable");
    const state = emptyState();
    expect(repo.save(state)).toBe(true);
    expect(repo.load()).toEqual({ state, status: "storage_unavailable" });
  });

  it("missing storage (SSR / blocked access) falls back to memory", () => {
    expect(new LocalStorageRepository(null).load().status).toBe("storage_unavailable");
  });

  it("save reports failure when the quota is full", () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage);
    storage.failWrites = true;
    expect(repo.save(emptyState())).toBe(false);
  });

  it("reset removes the book", () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage);
    repo.save(emptyState());
    repo.reset();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("A-D4 — export then import keeps every number identical", () => {
    const repo = new LocalStorageRepository(new MemoryStorage());
    const state = buildSampleState(TODAY, NOW);
    const imported = repo.importJson(repo.exportJson(state));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.state).toEqual(state);
    const cycle = cycleFor(TODAY, 1);
    const totals = (s: typeof state) => cycleTotals({ ...s, settings: s.settings, cycle, today: TODAY });
    expect(totals(imported.state)).toEqual(totals(state));
    const occ = (s: typeof state) =>
      listOccurrences(s.rules, cycle.start, cycle.end, { today: TODAY, cycleStartDay: 1, transactions: s.transactions, settings: s.settings });
    expect(occ(imported.state)).toEqual(occ(state));
  });

  it("import rejects garbage without throwing", () => {
    const repo = new LocalStorageRepository(new MemoryStorage());
    expect(repo.importJson("hello")).toEqual({ ok: false, error: "not_json" });
    expect(repo.importJson("[]")).toEqual({ ok: false, error: "not_object" });
    expect(repo.importJson("{}")).toEqual({ ok: false, error: "no_version" });
  });

  it("schema refuses full card numbers", () => {
    const repo = new LocalStorageRepository(new MemoryStorage());
    const state = { ...emptyState(), accounts: [{ id: "a", name: "Visa", type: "credit_card", last4: "4111111111111111" }] };
    expect(repo.importJson(JSON.stringify(state)).ok).toBe(false);
  });
});
