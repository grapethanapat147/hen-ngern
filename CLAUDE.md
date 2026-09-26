# CLAUDE.md — Quiz Loop

## What this is

Quiz Loop (working name) is a live classroom quiz, like Kahoot, for Thai public secondary-school teachers. The difference: every wrong option maps to a misconception. After the game, the teacher sees **จุดที่ควรทบทวน** and plays a **รอบทบทวน** (3 new questions from a bank the teacher pre-approved) in the same class period.

- Type: mass AI product in Grape's personal AI Product Studio. It is not a client solution.
- Status: **TEST**. Discovery runs until Gate 1 (around mid-November 2026). See `docs/00-decision-review.md`.
- Owner and decision-maker: Grape. You are the implementation partner and independent reviewer.

## Read before coding

| Doc | Use it for |
|---|---|
| `docs/00-decision-review.md` | Decision, gates, what changed, and why the build is gated |
| `docs/01-product-brief.md` | Problem, users, VP, loops, MVP scope, AI spec, data model sketch |
| `docs/03-ux-spec-v1.md` | **Locked UX**: flows, review-selection rule, microcopy changes |
| `docs/05-build-plan.md` | Phases, checklists, and pass criteria |
| `docs/reference/chatgpt-ux-handoff-draft.md` | Base wireframes and the full microcopy table (§4–§6). `03` overrides it where they differ |
| `docs/02`, `docs/04`, `docs/reference/grok-market-brief.md` | Context only. You don't need them to build |

If two docs conflict, first write the conflict in `docs/decision-log.md`, then ask Grape. Don't pick one silently.

## Phase gating (hard rule)

- **P0** (setup) can always run.
- **P1–P4** (game engine with no AI) runs only after Grape confirms, in the session, one of the build-early conditions in `docs/00` ("เงื่อนไขที่จะเริ่ม build ก่อน Gate 1"), or after `docs/00` records Gate 1 = pass.
- **P5–P6** (AI layer, eval, pilot readiness) runs only after `docs/00` records **Gate 1 = pass**.
- Stop at the end of each phase and report. Don't roll into the next phase.

## Stack

Next.js App Router · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Framer Motion · Supabase (Auth with Google for teachers, Postgres, Realtime Broadcast/Presence) · zod · Vitest · Playwright · Bun · Vercel AI SDK (P5+ only).

## Non-negotiables

1. **Student privacy**: players are a nickname or a group name only. No PII fields, no student accounts. Never send per-student data to an LLM; aggregates only. Don't show any concept whose base is under 5.
2. **The server is authoritative**: answers go through the server with a server timestamp. Scoring runs on the server. Show "ส่งคำตอบแล้ว" only after the server acks. Clients never write answers straight to the DB and never broadcast them.
3. **Approval gate**: a game can't open while any main question is pending or while the approved review bank has fewer than 3 items. Editing an approved item resets it to "รอตรวจ".
4. **No AI during class**: review-round selection is deterministic (`docs/03` §3.3). All AI generation happens before class.
5. **Terminology**: the UI says "ทบทวน" and never "ซ่อม" (`docs/03` §2).
6. **Integrity**: never invent users, metrics, testimonials, or evidence in the UI, README, or seed data. Label sample data as sample. Export only real session data.
7. **Accessibility**: each option shows letter, shape, color, and text, never color alone. Tap targets are ≥ 48px. Contrast meets WCAG AA. The host can drive the game from the keyboard. Respect `prefers-reduced-motion`.
8. **Realtime budget**: don't fan out every answer to every player. The host gets throttled answer counts. Load-test against Supabase plan limits (`docs/01` §9).

## How to work

- Small commits, one per checklist group. Each phase ends with `typecheck`, `lint`, `test` (and `test:e2e` from P4 on) passing.
- Separate **tested** from **not tested** in every report. Never claim a deploy, publish, or production change. Grape deploys; you prepare the config and the steps.
- Secrets go in `.env.local` only and are never committed. Keep `.env.example` current.
- Record non-trivial decisions in `docs/decision-log.md` (date · topic · decision · reason).
- Code and comments are in English. UI copy is Thai. Talk to Grape in Thai. Any Thai message you draft for Grape ends with "ครับ".

## Commands

Fill this in during P0 (`dev`, `build`, `test`, `test:e2e`, `typecheck`, `lint`, `db:*`).
