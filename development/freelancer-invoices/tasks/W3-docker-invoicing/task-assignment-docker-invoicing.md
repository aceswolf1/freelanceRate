# task-assignment-docker-invoicing

## Your Role
You are **worker-3, Backend Engineer** — handling containerization first, then the invoicing engine.
Prioritize reproducible, least-privilege containers; then correct money math (integer cents), pure well-tested business logic, clean MRSC layering, and validated inputs.

## Project Context
Task slug: freelancer-invoices · Worker 3 of 3 in wave 1 (worker-1 backend core + API contract, worker-2 frontend).
Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`. worker-1 is creating `backend/` and worker-2 `frontend/` in parallel right now.

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

## Your Task (two phases)

### Phase A — T7: Docker (3 pts) — start now, no dependencies
Target: TrueNAS SCALE (Docker). Use the script/env/port contract in team-plan §Shared Conventions — do not wait for the apps to exist; write against the contract.
- `backend/Dockerfile`: multi-stage node:22-alpine; `npm ci` → `npm run build` → runtime stage with prod deps only, non-root `node` user, `NODE_ENV=production`; entrypoint runs migrations (`node dist/db/migrate.js`) then `node dist/server.js`; HEALTHCHECK hitting `/api/health`. `backend/.dockerignore`.
- `frontend/Dockerfile`: multi-stage; `nuxt build` → copy `.output` → `node .output/server/index.mjs`, non-root, `PORT=3000`. `frontend/.dockerignore`. NOTE: `NUXT_PUBLIC_API_BASE` is read at runtime by Nuxt (runtimeConfig) — document that it must be the browser-reachable URL (e.g. `http://truenas.local:4000/api`).
- `docker-compose.yml` (root): services `db` (postgres:17-alpine, named volume `pgdata`, healthcheck pg_isready, host port `${DB_PORT:-5433}:5432`), `backend` (depends_on db healthy, port 4000), `frontend` (depends_on backend, port 3000). All config from `.env`. Restart `unless-stopped`.
- `.env.example` (root) with every var + comments; root `.gitignore` (node_modules, .env, dist, .output, coverage, playwright artifacts).
- Root `README.md`: overview, stack, local dev (local Postgres or `docker compose up db`), scripts, Docker/TrueNAS deployment section (build, env, volumes, backups via `pg_dump`). Keep sections other workers can append to.
- Do NOT run `docker compose up` for the full stack until both apps exist; validate with `docker compose config`. Full build verification happens in Phase B end (see below).
When Phase A is done: if you have NOT received `GO:` from team-lead, send `SendMessage(to: "team-lead", message: "WAITING: docker done, waiting for CONTRACT-READY GO", summary: "W3 waiting for contract")` and end your turn.

### Phase B — T8: Invoicing + earnings backend (8 pts) — after GO
Authoritative: `development/freelancer-invoices/orchestration-ctx/decisions/api-contract.md` (invoice/report endpoints were designed by worker-1). You may read worker-1's backend source to follow its patterns (lib/http, repositories, schema) but must NOT edit files outside your ownership; request schema/lib changes via `TURNING-POINT-BREAKING` / `BLOCKED` to team-lead.
Implement in `backend/src/modules/invoices/` and `backend/src/modules/reports/` (replace worker-1's stub `index.ts` routers; keep the export name so `app.ts` mounting works):
1. **Invoice engine (pure functions, TDD first)** `invoices.engine.ts`: input = week records with project/client/rates + platforms + settings → per-client-bucket drafts: lines sorted by date, per-project subtotals (hours, amount), rate = project ?? client, gross/fee(pct rounded half-up on cents + flat)/net in cents, totalHours, warnings `{ belowTarget, hoursBelowTarget }`. Standalone projects → bucket `clientId: null`, name "No client". Tests must include the spec example: projects A,B (client A) + C (client B) → exactly 2 drafts; rate override; flat+percent fee; empty week; rounding (e.g. 1% of $1,667.50 = $16.68).
2. **Service + repository**: preview (open or closed week, no persistence); generate (closed weeks only → 409 `WEEK_NOT_CLOSED` code — add to contract Deviations if not there; idempotent; transaction; snapshot names/emails/rates into invoices + invoice_lines; numbering `{prefix}-{YYYY}-{NNN}`); list by week; get by id.
3. **PDF** `backend/src/lib/pdf/invoice-pdf.ts` with `pdfmake` (server-side, no Chromium; embed a standard font — use Roboto/Helvetica that pdfmake supports on Node): header (your display name, invoice number, dates, bill-to, payment platform), table per project (date, description, hours, rate, total), project subtotals, gross/fee/net. Endpoint streams `application/pdf`, filename `INV-2026-001-acme-corp.pdf`. Zip of all week invoices via `archiver`.
4. **Email text** `invoices.email.ts`: `{ to, cc, subject, text, html, mailto, truncated }`. text = plain-text tables per project (aligned columns), html = styled tables (inline CSS, email-safe). `mailto:` URL-encoded; if > 1800 chars, use a shortened text with totals per project + "full breakdown in attached PDF / copy formatted" and set `truncated: true`.
5. **Earnings** `modules/reports`: `GET /api/reports/earnings?from&to&groupBy=project|client` — from invoiced data (invoice_lines) plus an `unbilled` figure from records of weeks without invoices; returns hours, gross, fees, net per group + totals. Fees per project = proportional allocation of the invoice fee by line amount (document it).
6. Tests: engine/email unit tests (≥90% on engine), Supertest integration for generate (idempotency, closed-only, 2-client split), pdf (content-type + `%PDF` magic bytes), zip, email, earnings — against `DATABASE_URL_TEST`.
7. **End-to-end Docker verification** (after your tests pass AND `frontend/` has a package.json): `docker compose build && docker compose up -d`, check `curl localhost:4000/api/health` and `curl -I localhost:3000`, then `docker compose down`. If frontend isn't buildable yet, verify backend+db only and note it.

## Source Files to Modify
- Phase A: `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`
- Phase B: `backend/src/modules/invoices/*`, `backend/src/modules/reports/*`, `backend/src/lib/pdf/*`, `backend/tests/integration/{invoices,reports}*.test.ts`, `backend/package.json` + lockfile (ONLY via `npm install pdfmake archiver` and their @types)
- `development/freelancer-invoices/orchestration-ctx/decisions/api-contract.md` — ONLY the `## Deviations` and `## Changelog` sections

## Acceptance Criteria
1. `docker compose config` valid; images build; stack serves `/api/health` and frontend root (or backend+db with note).
2. `cd backend && npm test` (all suites incl. worker-1's) passes; engine coverage ≥90%.
3. Seeded week, closed → `POST /api/weeks/:id/invoices` → 2 invoices (Acme Corp, Starlight Media) + 1 "No client" if standalone records exist; repeating returns the same ids.
4. PDF opens (valid `%PDF`), contains invoice number and totals; zip contains one PDF per invoice.
5. Email endpoint returns working `mailto:` (≤ ~1800 chars or truncated:true) and html with tables.
6. Earnings by project and by client sum to the invoice totals.

## Deliverables
1. `development/freelancer-invoices/tasks/W3-docker-invoicing/completion-report.md`
2. Docker/compose/env/README files and invoicing/reports/pdf source + tests (paths above)

## Progress Reporting
`development/freelancer-invoices/tasks/W3-docker-invoicing/progress-report.md`

## Key Files to Read First
- team-plan §Shared Conventions, §Data model, §Business rules · 01-requirements R9–R13
- `.claude/design/invoice_generator/code.html` + screen.png — what the invoice/email must contain
- (after GO) `orchestration-ctx/decisions/api-contract.md`

## Dependencies
⚠️ Phase B waits for `GO:` from team-lead (sent when worker-1's contract + schema are ready).

## Boundaries
- Do NOT edit worker-1-owned backend files (`app.ts`, `db/schema/*`, `lib/{http,dates,money}.ts`, other modules) or anything in `frontend/` except its Dockerfile/.dockerignore.
- worker-1 is migrating and running tests in parallel on the same local DBs — retry a transient DB failure once; if test isolation conflicts (truncation races) happen, run your integration suite in a separate schema/DB `freelancer_invoices_test_w3` (createdb it) and note it.

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
