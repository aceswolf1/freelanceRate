# task-assignment-invoice-earnings-ui

## Your Role
You are **worker-4, Frontend Engineer** — UI implementer focused on components, state and UX.
Prioritize reusing the existing frontend patterns (composables + presentational components, `useApi`, `format.ts`, design tokens), accessibility (WCAG 2.1 AA), responsive layout, and interaction tests. Match the design closely.

## Project Context
Task slug: freelancer-invoices · Worker 4. Running in parallel: worker-1 (backend CRUD — finishing), worker-2 (frontend Weekly Timesheet `/`, owns the rest of `frontend/`).
Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`. `frontend/` exists (Nuxt 4.6 + PrimeVue 5.0.4 + Tailwind 4 via @tailwindcss/vite). Backend invoice/report endpoints are DONE (worker-3).

## Plan File
`development/freelancer-invoices/orchestration-ctx/team-plan-freelancer-invoices.md`

## Task Type
IMPLEMENTATION

## FIRST ACTION (before anything else)
0. Run `pwd`. Expected project root `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` (contains `.claude/settings.json`). If different, `cd` there; if writes still prompt for permission → `BLOCKED: spawned with cwd={pwd}` and STOP. Use absolute paths for all file writes.
1. Fresh session → no /compact needed. Read this assignment fully; it is your authoritative context.
2. Read `development/freelancer-invoices/orchestration-ctx/team-plan-freelancer-invoices.md` (§Shared Conventions is binding) and `development/freelancer-invoices/01-requirements-freelancer-invoices.md`.

## Worker Self-Check
Task Type is IMPLEMENTATION and Source Files list is non-empty → proceed.
3. Study the existing frontend patterns BEFORE writing: `frontend/app/composables/{useApi,useClients,useWeeks,useNotifier}.ts`, `frontend/app/utils/format.ts`, `frontend/app/types/api.ts`, `frontend/app/components/clients/*`, `frontend/app/pages/clients.vue`, `frontend/app/layouts/default.vue`, `frontend/nuxt.config.ts`, and one existing test file. Extend these patterns — never duplicate them.

## Your Task — T9: Invoice Generator `/invoices` + Earnings `/earnings` (5 pts)
Authoritative API: `development/freelancer-invoices/orchestration-ctx/decisions/api-contract.md` §2 (DTOs), §4.1–§4.8 (endpoints), §8.1 (accepted deviations — e.g. earnings has an extra `unbilled` block; "No client" fee = 0; no WEEK_NOT_CLOSED code, generate on open week → 409 CONFLICT). Do NOT read `backend/` source; ask team-lead if the contract is unclear.

### /invoices (match `.claude/design/invoice_generator/{screen.png,code.html}`)
- Week selection: reads `?weekId=` (the timesheet links here); without it, uses the current week (`/api/weeks/current`) with prev/next week navigation (reuse `useWeekNavigation`/`useWeeks` — do not fork them; if they need a change, it is worker-2's file → message team-lead).
- **Open week**: show `GET /api/weeks/:id/invoice-preview` — per-client preview cards, a clear notice "Close the week to generate invoices" + link back to `/`. Generate button disabled.
- **Below-target warning (R8)**: if `belowTarget`, show the warning banner ("34.5 / 40 hrs — 5.5 hrs below target") before generating, with confirm dialog "Generate anyway?"; never block.
- **Closed week**: "Generate invoices" → `POST /api/weeks/:id/invoices` (idempotent); if invoices already exist (`GET /api/weeks/:id/invoices`) render them directly.
- Header: title "Generate Invoices for Week 19-10-2026 – 25-10-2026", status chip, summary cards GROSS BILLED / FEES ABSORBED / NET REALIZED, "N Invoices" badge, "Download All PDFs (.zip)" (`GET /api/weeks/:id/invoices/zip`).
- One card per invoice (per client; "No client" bucket for standalone projects): initials avatar, client name, invoice number, payment platform + fee, emails, gross / fee / net, **Download PDF** (`GET /api/invoices/:id/pdf`), **Send as Email Text** = an `<a href={mailto}>` from `GET /api/invoices/:id/email`, plus **Copy formatted** button that writes `html` (and `text` fallback) to the clipboard via `ClipboardItem` (fallback `navigator.clipboard.writeText(text)`); toast on success; if `truncated` show hint "Email body shortened — use Copy formatted for full tables". Rate-logic strip (client default vs project override). Line table: date (DD-MM-YYYY / weekday), project, description, hours, rate, line total; per-project subtotals; footer totals.
- Downloads must work with `NUXT_PUBLIC_API_BASE` absolute URLs (use plain links/`window.open` to the API URL, or fetch blob + object URL — keep filename from `Content-Disposition`).
- The requirement example must hold visually: projects A,B (client A) + C (client B) → exactly two cards, two PDF buttons, two email links.
- Drop decorative design blocks not backed by data ("Fallback Rate Engine / Audit-Proof Ledger / Platform Fee Engine" marketing cards).

### /earnings (no design — follow the design language: stat cards + DataTable, as on clients_directory)
- `GET /api/reports/earnings?from&to&groupBy=project|client`: date-range picker (default: contract defaults; quick presets This week / This month / This year / All time), SelectButton toggle By Project / By Client, stat cards (hours, gross, fees, net, + unbilled block), sortable DataTable with totals footer. Empty state.

### Tests
Composable tests (`useInvoices`, `useEarnings`) with mocked `useApi`; component tests for the invoice card (renders mailto href, copy button calls clipboard, truncated hint), and the 2-clients-→-2-cards case.

## Source Files to Modify
- `frontend/app/pages/invoices.vue`, `frontend/app/pages/earnings.vue` (replace worker-2's placeholders)
- `frontend/app/components/invoices/*`, `frontend/app/components/earnings/*` (new)
- `frontend/app/composables/useInvoices.ts`, `frontend/app/composables/useEarnings.ts` (new)
- `frontend/app/types/api.ts` — ONLY if an invoice/earnings DTO is missing (append; add `unbilled` per §8.1); note it in progress-report
- tests colocated or under `frontend/test/` following the existing convention

## Acceptance Criteria
1. `cd frontend && npm run build && npm run typecheck && npm test` all pass (including worker-2's tests).
2. Against the live backend (`cd backend && npm run dev`; seeded DB): open week → preview + disabled generate; close the seeded week via `curl -XPOST localhost:4000/api/weeks/{id}/close` → generate → Acme Corp, Starlight Media, and "No client" cards with correct totals (Acme gross $2,275.00, fee $22.75; Starlight $1,667.50, fee $16.68); repeat generate returns same numbers; PDF + zip download; mailto opens with prefilled body; copy works.
3. Earnings by project and by client totals equal the sum of invoice totals.
4. Both themes readable (dark default, light via toggle).
5. At least one interaction test per new composable/component.

## Deliverables
1. `development/freelancer-invoices/tasks/W4-invoice-earnings-ui/completion-report.md`
2. Source + tests listed above

## Progress Reporting
`development/freelancer-invoices/tasks/W4-invoice-earnings-ui/progress-report.md`

## Pre-authorizations from the user (recorded in orchestration-ctx/decisions/stack-and-harness-decisions.md)
The user explicitly authorized writes to the local dev DB `freelancer_invoices` (close/reopen week, generate invoices, re-seed via `cd backend && npm run db:seed`) and the local test DB. Not authorized: dropping DBs, any other DB/host. If a permission classifier still denies something, do NOT work around it — send BLOCKED with the exact denial text.
Browser screenshots (Playwright) are NOT authorized — skip visual screenshot checks; verify via build, tests, curl, and SSR HTML.

## Boundaries
- Work ONLY in the files listed above + your task dir.
- Do NOT edit worker-2's files (layout, other pages, existing composables/components/utils, nuxt.config, package.json). If you need a shared change (e.g. a format helper, a new dependency), message team-lead with the exact change.
- Do NOT touch `backend/`.
- Backend may be restarted by worker-1 while you test — retry a transient failure once, then classify. If the dev DB week state was changed by you (closed/invoiced), re-run `cd backend && npm run db:seed` at the end so others see the open seeded week, and note it.

## Available Tools
file read/write, bash, playwright MCP, TODO list, SendMessage, WebFetch, context7 MCP (library docs — use it for Nuxt 4 / PrimeVue 4 / Drizzle / Express 5 APIs; do not guess APIs).
**No shared TaskList in this session**: `TaskCreate/TaskUpdate/TaskList` are NOT available — skip every TaskUpdate step in your role protocol; progress-report.md is the ledger instead. Do not try ToolSearch or probe sub-agents to find them.

> **DURABILITY**: write `progress-report.md` after EACH subtask. Before approving any shutdown, write completion-report + send `COMPLETE:` first. A worker that does correct work but reports nothing is a FAILURE.

> **ADDRESSING**: send every status message to `SendMessage(to: "team-lead", ...)`. If that send is rejected as an unknown recipient, resend the identical message to `"main"` (in this harness background workers reach the lead via `main`). Never end a turn with an undelivered status message.

> **MESSAGE FORMAT**: `message` is ALWAYS a plain string `"PREFIX: ..."` plus a `summary`. Never send object-form messages except a `shutdown_response` replying to a real `shutdown_request`.

## Turning Point Rules
Non-breaking (decide, log in progress-report): equivalent libraries/patterns, internal helpers, minor refactors.
Breaking (STOP, message, WAIT): changing the API contract or DB schema others depend on, scope +30%, security issue, cannot meet acceptance criteria.
`SendMessage(to: "team-lead", message: "TURNING-POINT-BREAKING: {situation}. Options: A) ... B) .... Awaiting decision.", summary: "Breaking turning point")`

## Context Management
Use a TODO list. Write state to progress-report.md before any `/compact`; after compacting, re-read this assignment.

## Completion Report Format
`completion-report.md` sections: Deliverables (table File | Description | Status) · Key Decisions Made · Issues Encountered · Known Issues NOT Fixed (with repro) · Integration Notes · Deferred Items · How to run/verify (exact commands + observed output summary).

## Reporting Protocol (follow exactly)
1. **On start**: create `progress-report.md` with header `# Progress: {task}` and the subtask list.
2. **During work**: append `## Subtask N: {name} — ✅ Done` + findings/command output after each subtask. No other `*-report.md` files.
3. **On error**: max 2 distinct fix attempts per error. Then append `## Strategy Request` (error, attempts, ruled-out hypotheses) and send `TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request`, then WAIT.
4. **Gate messages** (when this assignment says so): send `CHECKPOINT: ...` and continue, or `WAITING: ...` and end the turn.
5. **On completion** (ALL subtasks done, tests passing): write completion-report.md, then send `COMPLETE: {task} done. Deliverables: {list}. See tasks/{dir}/completion-report.md`.
6. **On blocking issue**: `BLOCKED: {what}. Attempted: {what}. Need: {what}` then WAIT.
7. **Every turn must end with one of**: COMPLETE / BLOCKED / WAITING / CHECKPOINT (only if continuing) / TURNING-POINT-*. Never idle silently.
8. After your final COMPLETE, ignore echo/idle/notice messages that carry no new assignment — end the turn silently.
