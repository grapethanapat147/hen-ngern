import type { RecurringRule, Settings, Transaction } from "../types";
import { DEFAULT_SETTINGS } from "../types";

const STAMP = "2026-09-01T00:00:00.000Z";
let seq = 0;

export const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

/** Build a confirmed transaction; `baht` is a whole-baht (or whole-unit) amount unless `amountMinor` is given. */
export function tx(
  fields: Partial<Transaction> & Pick<Transaction, "kind" | "date"> & { baht?: number },
): Transaction {
  const { baht, ...rest } = fields;
  seq += 1;
  return {
    id: `tx${seq}`,
    name: "รายการ",
    amountMinor: baht !== undefined ? baht * 100 : 0,
    currency: "THB",
    fxRateToThb: 1,
    scope: "personal",
    source: "manual",
    status: "confirmed",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...rest,
  };
}

export function rule(
  fields: Partial<RecurringRule> & Pick<RecurringRule, "startsOn" | "cadence"> & { baht?: number },
): RecurringRule {
  const { baht, ...rest } = fields;
  seq += 1;
  return {
    id: `rule${seq}`,
    kind: "expense",
    name: "บิล",
    amountMinor: baht !== undefined ? baht * 100 : 0,
    currency: "THB",
    categoryId: "other_out",
    scope: "personal",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...rest,
  };
}
