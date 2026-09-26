import { z } from "zod";
import { isLocalDate } from "@/domain/dates";
import type { AppState } from "@/domain/types";

// Validation at the storage boundary (docs/02-domain-rules.md §2). Anything that fails here is treated as unreadable.

const localDate = z.string().refine(isLocalDate, "invalid LocalDate");
const currency = z.enum(["THB", "USD", "EUR"]);
const scope = z.enum(["personal", "work"]);
const minor = z.number().int().positive();
const rate = z.number().positive().finite();

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["credit_card", "bank", "wallet", "cash", "promptpay"]),
  // Last 4 digits only — never a full card number.
  last4: z.string().regex(/^\d{4}$/).optional(),
  color: z.string().optional(),
  hidden: z.boolean().optional(),
});

export const transactionSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["income", "expense", "transfer", "refund"]),
    name: z.string().min(1),
    amountMinor: minor,
    currency,
    fxRateToThb: rate,
    date: localDate,
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
    scope,
    recurringRuleId: z.string().optional(),
    occurrenceDate: localDate.optional(),
    refundOfId: z.string().optional(),
    note: z.string().optional(),
    source: z.enum(["manual", "sentence", "sample", "import"]),
    status: z.literal("confirmed"),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().optional(),
    correctedFields: z.array(z.string()).optional(),
  })
  .refine((t) => t.kind !== "transfer" || (t.fromAccountId && t.toAccountId), "transfer needs from and to accounts")
  .refine((t) => t.currency !== "THB" || t.fxRateToThb === 1, "THB rate must be 1")
  .refine((t) => !t.recurringRuleId === !t.occurrenceDate, "rule link needs both rule id and occurrence date");

export const ruleSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["income", "expense"]),
    name: z.string().min(1),
    amountMinor: minor,
    currency,
    cadence: z.enum(["week", "month", "year"]),
    startsOn: localDate,
    endsOn: localDate.optional(),
    maxOccurrences: z.number().int().positive().optional(),
    trialEndsOn: localDate.optional(),
    skippedDates: z.array(localDate).optional(),
    categoryId: z.string().min(1),
    accountId: z.string().optional(),
    scope,
    note: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().optional(),
    correctedFields: z.array(z.string()).optional(),
    supersededBy: z.string().optional(),
  })
  .refine((r) => !r.trialEndsOn || r.trialEndsOn <= r.startsOn, "trial must end on or before the first charge");

export const settingsSchema = z.object({
  cycleStartDay: z.number().int().min(1).max(28),
  fx: z.object({ USD: z.number().nonnegative(), EUR: z.number().nonnegative() }),
  sideIncomeGoalMinor: z.number().int().nonnegative(),
  workScopeEnabled: z.boolean(),
});

export const appStateSchema = z.object({
  schemaVersion: z.literal(1),
  isSample: z.boolean(),
  settings: settingsSchema,
  accounts: z.array(accountSchema),
  transactions: z.array(transactionSchema),
  rules: z.array(ruleSchema),
});

// Compile-time check that the schema and the domain types stay in sync.
type Parsed = z.infer<typeof appStateSchema>;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _schemaMatchesTypes: Same<Parsed, AppState> = true;
void _schemaMatchesTypes;
