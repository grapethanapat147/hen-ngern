import { DEFAULT_SETTINGS, type AppState } from "@/domain/types";

export const CASH_ACCOUNT_ID = "cash";

/** A fresh book: default settings and one cash account so the parser has a fallback account. */
export function emptyState(): AppState {
  return {
    schemaVersion: 1,
    isSample: false,
    settings: { ...DEFAULT_SETTINGS, fx: { ...DEFAULT_SETTINGS.fx } },
    accounts: [{ id: CASH_ACCOUNT_ID, name: "เงินสด", type: "cash" }],
    transactions: [],
    rules: [],
  };
}
