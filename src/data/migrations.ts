import type { AppState } from "@/domain/types";
import { appStateSchema } from "./schema";

export const CURRENT_SCHEMA_VERSION = 1;

/** Upgrade steps keyed by the version they upgrade *from*. Add `1: (s) => ({ ...s, schemaVersion: 2 })` when v2 exists. */
const MIGRATIONS: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {};

export type ParseResult = { ok: true; state: AppState } | { ok: false; error: string };

/** JSON text → migrated, validated state. Never throws. */
export function parseStoredState(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "not_json" };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, error: "not_object" };
  let state = data as Record<string, unknown>;
  if (typeof state.schemaVersion !== "number") return { ok: false, error: "no_version" };
  let version: number = state.schemaVersion;
  if (version > CURRENT_SCHEMA_VERSION) return { ok: false, error: "newer_version" };
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, error: "no_migration" };
    state = step(state);
    if (typeof state.schemaVersion !== "number" || state.schemaVersion <= version) return { ok: false, error: "bad_migration" };
    version = state.schemaVersion;
  }
  const parsed = appStateSchema.safeParse(state);
  return parsed.success ? { ok: true, state: parsed.data } : { ok: false, error: "invalid_schema" };
}
