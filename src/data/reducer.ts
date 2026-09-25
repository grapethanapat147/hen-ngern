import type { Account, AppState, RecurringRule, Settings, Transaction } from "@/domain/types";
import { emptyState } from "./empty";

// Pure state transitions. Deletes are soft (deletedAt) so "เลิกทำ" can restore them.

export type BookAction =
  | { type: "replace"; state: AppState }
  | { type: "start_own_book" }
  | { type: "add_transactions"; transactions: Transaction[] }
  | { type: "update_transaction"; transaction: Transaction; nowIso: string }
  | { type: "delete_transaction"; id: string; nowIso: string }
  | { type: "restore_transaction"; id: string; nowIso: string }
  | { type: "add_rule"; rule: RecurringRule }
  | { type: "update_rule"; rule: RecurringRule; nowIso: string }
  | { type: "delete_rule"; id: string; nowIso: string }
  | { type: "restore_rule"; id: string; nowIso: string }
  | { type: "skip_occurrence"; ruleId: string; date: string; nowIso: string }
  | { type: "unskip_occurrence"; ruleId: string; date: string; nowIso: string }
  /** Several changes saved as one step (one undo). */
  | { type: "batch"; actions: BookAction[] }
  | { type: "update_settings"; settings: Partial<Settings> }
  | { type: "upsert_account"; account: Account };

const patch = <T extends { id: string }>(items: T[], id: string, fn: (item: T) => T): T[] =>
  items.map((item) => (item.id === id ? fn(item) : item));

function withoutDeletedAt<T extends { deletedAt?: string; updatedAt: string }>(item: T, nowIso: string): T {
  const copy = { ...item, updatedAt: nowIso };
  delete copy.deletedAt;
  return copy;
}

export function bookReducer(state: AppState, action: BookAction): AppState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "start_own_book":
      return emptyState();
    case "add_transactions":
      return { ...state, transactions: [...state.transactions, ...action.transactions] };
    case "update_transaction":
      return {
        ...state,
        transactions: patch(state.transactions, action.transaction.id, () => ({ ...action.transaction, updatedAt: action.nowIso })),
      };
    case "delete_transaction":
      return {
        ...state,
        transactions: patch(state.transactions, action.id, (t) => ({ ...t, deletedAt: action.nowIso, updatedAt: action.nowIso })),
      };
    case "restore_transaction":
      return { ...state, transactions: patch(state.transactions, action.id, (t) => withoutDeletedAt(t, action.nowIso)) };
    case "add_rule":
      return { ...state, rules: [...state.rules, action.rule] };
    case "update_rule":
      // Saved transactions keep their own amounts; only future occurrences change.
      return { ...state, rules: patch(state.rules, action.rule.id, () => ({ ...action.rule, updatedAt: action.nowIso })) };
    case "delete_rule":
      return { ...state, rules: patch(state.rules, action.id, (r) => ({ ...r, deletedAt: action.nowIso, updatedAt: action.nowIso })) };
    case "restore_rule":
      return { ...state, rules: patch(state.rules, action.id, (r) => withoutDeletedAt(r, action.nowIso)) };
    case "skip_occurrence":
      return {
        ...state,
        rules: patch(state.rules, action.ruleId, (r) => ({
          ...r,
          skippedDates: [...new Set([...(r.skippedDates ?? []), action.date])].sort(),
          updatedAt: action.nowIso,
        })),
      };
    case "unskip_occurrence":
      return {
        ...state,
        rules: patch(state.rules, action.ruleId, (r) => ({
          ...r,
          skippedDates: (r.skippedDates ?? []).filter((d) => d !== action.date),
          updatedAt: action.nowIso,
        })),
      };
    case "batch":
      return action.actions.reduce(bookReducer, state);
    case "update_settings":
      return {
        ...state,
        settings: { ...state.settings, ...action.settings, fx: { ...state.settings.fx, ...action.settings.fx } },
      };
    case "upsert_account": {
      const exists = state.accounts.some((a) => a.id === action.account.id);
      return {
        ...state,
        accounts: exists ? patch(state.accounts, action.account.id, () => action.account) : [...state.accounts, action.account],
      };
    }
  }
}
