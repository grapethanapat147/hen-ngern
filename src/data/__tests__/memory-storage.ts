/** Minimal in-memory Storage for tests. */
export class MemoryStorage {
  readonly data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Behaves like Safari private mode used to: every write throws. */
export class BlockedStorage extends MemoryStorage {
  override failWrites = true;
}
