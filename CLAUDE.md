# รู้เงิน (roongern) — Project instructions for Claude Code

## What this is

สมุดเงินส่วนตัวภาษาไทย: จดรายรับ รายจ่าย และบิลซ้ำด้วยประโยคเดียว แยกเงินจริงออกจากสิ่งที่คาดว่าจะเกิด ไม่เชื่อมธนาคาร
Current milestone: **v0 — local-first, no LLM, no backend** (see `docs/04-build-plan.md`)

## Read before coding

1. `docs/00-decision-review.md` — why things are the way they are, decisions D1–D16
2. `docs/02-domain-rules.md` — data model + calculation rules + Golden Cases (**source of truth for numbers**)
3. `docs/03-parser-spec.md` — Thai sentence parser rules + test cases
4. `docs/01-product-brief.md` — screens, states, copy, visual tokens
5. `docs/05-acceptance.md` — what "done" means

Files in `docs/reference/` are background only. Where they conflict with `docs/00–05`, the numbered docs win.

## Locked — ask Grape before changing

- No bank connection, no full card numbers/CVV/expiry (last 4 digits only)
- Drafts are always reviewed and confirmed by the user before saving
- `Transaction` (actual) and `RecurringRule` (expected) are separate; occurrences are computed, never stored
- Money is integer minor units (`amountMinor`); FX rate is locked on each transaction at confirm time
- Transfers never count as income or expense
- No LLM / AI API calls, no auth, no Supabase, no image upload in v0
- Product name รู้เงิน and the locked Thai copy in `docs/01-product-brief.md` §7
- Sample data is always labelled `ตัวอย่าง ไม่ใช่ยอดจริง`; never present made-up income as real
- Do not copy Billbau's look, colors, card visuals, logo or copy

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS v4
- Client-side state; persistence via a `Repository` interface backed by `localStorage` (key `roongern.v0`) so it can be swapped for Supabase later
- zod for schema validation at the storage boundary
- Vitest for unit tests (`src/domain/**`), Playwright for e2e
- Fonts via `next/font/google`: Be Vietnam Pro + Noto Sans Thai
- shadcn/ui is allowed for primitives (Sheet, Dialog, Toast) — restyle to our tokens
- Package manager: use what the repo already uses; if starting fresh, use `bun` (fallback `pnpm`)

## Structure

```
src/
  domain/          # pure TS, no React: money, dates, cycle, recurrence, totals, matching, parser
    parser/
    __tests__/     # Golden Cases G1–G12 and parser cases P1–P18
  data/            # repository, zod schemas, migrations, sample seed
  app/             # routes: / (ภาพรวม), /transactions, /recurring, /calendar, /settings
  components/
  lib/
e2e/               # Playwright specs mapped to docs/05-acceptance.md
```

## Rules for working here

- **Domain first:** write/extend tests in `src/domain/__tests__` before UI that depends on them. Every Golden Case must pass.
- Never use `new Date("YYYY-MM-DD")` — parse local dates manually. All domain functions take `today` as a parameter.
- Never use floats for money math. Round per transaction (half away from zero), then sum.
- No `alert()` / `confirm()` / `prompt()` — confirmations are in-page.
- Mobile-first: test at 390px and 1280px. No page-level horizontal scroll.
- Thai UI text only in the UI; code, identifiers, commits in English.
- Keep commits small and scoped to one phase task. Conventional commit prefixes (`feat:`, `fix:`, `test:`, `chore:`).
- When unsure between two interpretations, pick the one that keeps actual vs expected clearly separated, note it in `docs/decision-log.md`, and continue.

## Commands (fill in after scaffold)

```
dev:        <pm> dev
test:       <pm> test          # vitest
e2e:        <pm> test:e2e      # playwright
typecheck:  <pm> typecheck
lint:       <pm> lint
```

## Definition of done (per phase)

- typecheck, lint, unit tests pass
- The phase's acceptance items in `docs/05-acceptance.md` pass (e2e where listed)
- Report: what was built, what was tested (and how), what was not done, any decision taken — separate these clearly
- Never claim something is deployed or tested if it was not
