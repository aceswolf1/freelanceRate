# task-assignment-qa

## Your Role
You are **worker-5, Test & Quality Engineer**: you write test suites and validate against acceptance criteria.
Cover happy paths, error paths, boundaries. Test real behavior (real backend + DB), not mocks. Document scenarios in plain language. You validate and report gaps. Do NOT fix product code (gaps are routed back to the original authors).

## Project Context
Task slug: freelancer-invoices · Final QA wave (T10). All implementation is done: backend (Express/Drizzle, :4400), frontend (Nuxt 4, :3000), invoicing, earnings, docker files.
Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`.

## Plan File
`development/freelancer-invoices/orchestration-ctx/team-plan-freelancer-invoices.md`

## Task Type
IMPLEMENTATION (test code) + ANALYSIS (gap report)

## FIRST ACTION (before anything else)
0. Run `pwd`. Expected project root `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` (contains `.claude/settings.json`). If different, `cd` there; if writes still prompt for permission → `BLOCKED: spawned with cwd={pwd}` and STOP. Use absolute paths for all file writes.
1. Fresh session → no /compact needed. Read this assignment fully; it is your authoritative context.
2. Read `development/freelancer-invoices/orchestration-ctx/team-plan-freelancer-invoices.md` (§Shared Conventions is binding) and `development/freelancer-invoices/01-requirements-freelancer-invoices.md`.

## Worker Self-Check
Task Type is IMPLEMENTATION and Source Files list is non-empty → proceed.
3. Read: `01-requirements-freelancer-invoices.md` (R1–R15 = what you validate), `orchestration-ctx/decisions/api-contract.md` §§1–5, §8 (authoritative API; deviations in §8/§8.1 are ACCEPTED, not bugs), all four `tasks/W*/completion-report.md` (sections "Known Issues NOT Fixed" + "NOT VERIFIED" are your priority checklist).

## User authorizations (explicit, recorded in orchestration-ctx/decisions/stack-and-harness-decisions.md §"User authorization — QA wave")
The user explicitly authorized you to: (1) install `@playwright/test` + Chromium in `e2e/` and run a headless browser against http://localhost:3000 and http://localhost:4400 ONLY, saving screenshots into your task folder; (2) write to the local dev DB `freelancer_invoices` (close/reopen the seeded week, add/edit/delete records, generate invoices) and restore it at the end with `cd backend && npm run db:seed`; (3) start the production frontend (`node .output/server/index.mjs`, PORT=3000) and stop ONLY servers you started. Not authorized: dropping DBs, other DBs/hosts, killing processes you didn't start.
If a permission classifier still denies one of these, do NOT work around it: send BLOCKED with the exact denial text.

## Environment facts
- Backend is ALREADY running on :4400 (`tsx watch`, started by the lead; log /tmp/fi-backend.log). Don't start/kill it.
- Frontend: `npm run dev` crashes on this machine (Vite SSR "IPC connection closed"). Use `cd frontend && npm run build && NUXT_PUBLIC_API_BASE=http://localhost:4400/api PORT=3000 node .output/server/index.mjs` (background, record its PID, stop it at the end).
- 127.0.0.1:4000 is an unrelated app (Local.app). Never use :4000.
- Backend full test suite (`npm test`) may still be blocked on a one-time test-DB cleanup (lead is handling it); don't run TRUNCATE yourself. Run `npm run test:coverage` once at the end; if it's still failing on `weeks_start_date_key` duplicates, report it as "blocked on test-DB cleanup" rather than a product bug.

## Your Task (T10, 5 pts)
1. **E2E suite** in `e2e/` (own package.json, `@playwright/test`, `playwright.config.ts` with baseURL http://localhost:3000, chromium only, `globalSetup` that runs `cd ../backend && npm run db:seed`, and a teardown that re-seeds). Specs (critical flows):
   - `timesheet.spec.ts`: current week title `Week NN: DD-MM-YYYY – DD-MM-YYYY`; 7 day columns, Sat/Sun visually muted but "Add record" works there; add record via drawer (client→project filter, rate badge, hours 5.5) → totals update; edit; delete; below-40h warning visible; prev/next week navigation.
   - `close-week.spec.ts`: close week → inputs/add buttons disabled, API write returns 409 WEEK_CLOSED; reopen works when no invoices exist.
   - `invoices.spec.ts`: open week → preview + generate disabled; close → generate → exactly 2 client cards (Acme Corp, Starlight Media) + "No client" card; totals Acme gross $2,275.00 fee $22.75 net $2,252.25, Starlight gross $1,667.50 fee $16.68; regenerate is idempotent; PDF download (`%PDF` magic bytes, filename `INV-YYYY-NNN-acme-corp.pdf`); zip download contains one PDF per invoice; "Send as Email Text" href starts with `mailto:` and includes the client email; Copy formatted shows a toast; reopen after invoicing is refused (409).
   - `crud.spec.ts`: create/edit/delete client (validation error inline for bad email; 409 friendly message on deleting a referenced client); project standalone requires rate; payment platform create with percent + flat fee; settings change of weekly target hours reflects in the timesheet banner.
   - `earnings.spec.ts`: after generating, By Project and By Client totals equal the invoice totals; unbilled block present.
   - `theme.spec.ts`: dark default; toggle to light persists across reload, no flash (html has class before first paint).
2. **Screenshots**: dark + light of `/`, `/invoices` (closed+generated week), `/clients`, `/projects`, `/settings`, `/earnings` → `development/freelancer-invoices/tasks/W5-qa/screens/`. Compare against `.claude/design/*/screen.png` (settings: use code.html) and list notable visual gaps in progress-report (severity: high = broken/unreadable, medium = clearly off-design, low = polish).
3. **Coverage + integration review**: run `cd backend && npm run test:coverage` (≥80% lines expected) and `cd frontend && npm test`. Paste the summary lines into progress-report. Check requirement traceability R1–R15: for each, mark PASS / FAIL / NOT-COVERED with evidence (spec name or command).
4. **Gap report**: in completion-report, section "Gaps" with one row per FAIL: requirement ID, exact repro (steps or curl), expected vs actual, suspected owner area (backend core / invoicing / frontend timesheet & CRUD / frontend invoices & earnings), severity. Do NOT fix product code. If an E2E spec fails because of a product bug, keep the spec asserting the CORRECT behavior and mark it with `test.fail()` + a `// GAP: <id>` comment.
5. Restore: re-seed the dev DB and stop the frontend server you started.

## Source Files to Modify
- `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/global-teardown.ts`, `e2e/tsconfig.json`, `e2e/.gitignore`, `e2e/tests/*.spec.ts`, `e2e/tests/helpers/*.ts`
- `development/freelancer-invoices/tasks/W5-qa/screens/*.png`

## Acceptance Criteria
1. `cd e2e && npx playwright test` runs all specs; every spec either passes or is `test.fail()` with a GAP id listed in the completion report.
2. R1–R15 traceability table complete with evidence.
3. Backend coverage % and frontend test totals reported (or the precise blocker).
4. Screenshots saved (12 files) + visual gap list.
5. Dev DB re-seeded and your frontend server stopped at the end.

## Deliverables
1. `development/freelancer-invoices/tasks/W5-qa/completion-report.md` (incl. Gaps table + traceability table)
2. `e2e/` suite (paths above) and screenshots

## Progress Reporting
`development/freelancer-invoices/tasks/W5-qa/progress-report.md`

## Boundaries
- Write ONLY in `e2e/` and your task folder. Do NOT edit `backend/` or `frontend/` (no product fixes; no adding test ids to components; use roles/labels/text selectors).
- Conserve tokens: the worker model has a usage quota. Concise tool use, don't re-read large files, don't paste full logs (summaries + failing lines only).

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

## Priority checklist from implementers (added by lead before spawn)
- worker-4 AC2 post-generation half NOT VERIFIED (classifier denied writes in their session): close week → generate → PDF/zip bytes → repeat-generate idempotency. Covered by your invoices.spec.ts. Make sure it actually runs.
- worker-2 NOT VERIFIED: record create/edit/delete via browser click path; closed-week read-only live. Covered by timesheet.spec.ts / close-week.spec.ts.
- Latent SSR risk reported by worker-4: composables that call `useApi()` lazily after an `await` lose the Nuxt context during SSR (`NUXT_E1001`). worker-2's composables use the lazy pattern but currently work. Check: hard-reload (SSR) every route incl. `/?` with prev/next week query state if any. Report any NUXT_E1001 / 500 as a GAP owned by "frontend timesheet & CRUD".
