# Team Plan: freelancer-invoices

## Context
- `freelancer-invoices-plan.md` — approved feature plan (2026-10-22): Express+TS+Drizzle backend, Nuxt 4 frontend, no auth, mailto+copy-HTML, docker-compose now.
- `00-intake-freelancer-invoices.md` — objective + assumptions (week Mon–Sun, rate fallback, closed-week invoicing).
- `01-requirements-freelancer-invoices.md` — R1–R15 + NFRs (authoritative acceptance criteria).
- No research phase (all questions resolved by user).

## Objective
Build the full app: `backend/` (API), `frontend/` (UI), `e2e/` (Playwright), docker-compose.

## Implementation Location (project root = /Users/cace/Desktop/cloud-copy/projects/freelancerRate)
- `backend/` — Express 5 + TypeScript (ESM, Node 22) + Drizzle ORM (node-postgres) + Zod + Vitest + Supertest
- `frontend/` — Nuxt 4 (`app/` dir) + PrimeVue 4 (`@primeuix/themes` Material preset) + Tailwind 4 + `tailwindcss-primeui`
- `e2e/` — Playwright
- root: `docker-compose.yml`, `.env.example`, `README.md`, `.gitignore`
- Design: `.claude/design/{weekly_timesheet,invoice_generator,clients_directory,projects_directory,settings_preferences}/code.html` (+ screen.png; settings screen.png is corrupt → use code.html), tokens in `.claude/design/DESIGN.md`.
- Package manager: **npm** (separate `package.json` in backend/ and frontend/; no workspaces).

## Work Streams
| ID | Stream | Worker | Role | Pts | Deps |
|----|--------|--------|------|-----|------|
| T1 | Backend scaffold, Drizzle schema, migrations, seed, shared libs | worker-1 | backend-eng | 5 | — |
| T2 | API contract doc (`decisions/api-contract.md`) | worker-1 | backend-eng | 2 | T1 |
| T3 | CRUD: platforms, clients, projects, settings, weeks, records + tests | worker-1 | backend-eng | 5 | T2 |
| T4 | Frontend shell: Nuxt+PrimeVue+Tailwind, dark/light theme, layout, useApi | worker-2 | frontend-eng | 3 | — |
| T5 | Clients, Projects, Payment Platforms, Settings views | worker-2 | frontend-eng | 5 | T2, T4 |
| T6 | Weekly Timesheet view | worker-2 | frontend-eng | 5 | T5 (and T3 live API) |
| T7 | Docker: Dockerfiles, compose, .env.example, README run section | worker-3 | backend-eng | 3 | — |
| T8 | Invoice engine, PDF, zip, email-text, earnings API + tests | worker-3 | backend-eng | 8 | T2 |
| T9 | Invoice Generator + Earnings views | worker-4 | frontend-eng | 5 | T5, T8 |
| T10 | QA: Playwright E2E critical flow, coverage, integration review | worker-5 | test-quality | 5 | all |

## Dependency Graph
```
T1 → T2 ─┬→ T3 (w1)
         ├→ T5 (w2, also after T4) → T6 (w2)
         └→ T8 (w3, after T7)  ─→ T9 (w4, after T5) ─→ T10 (w5)
T4 (w2, no deps)   T7 (w3, no deps)
```
Gate signal: worker-1 sends `CHECKPOINT: CONTRACT-READY` after T2; orchestrator relays `GO:` to worker-2/worker-3.

## Shared Conventions (binding for all workers)

### Ports & env (fixed — Docker, backend, frontend all use these names)
| Var | Default (local dev) | Used by |
|-----|---------------------|---------|
| `DATABASE_URL` | `postgres://cace@localhost:5432/freelancer_invoices` | backend |
| `DATABASE_URL_TEST` | `postgres://cace@localhost:5432/freelancer_invoices_test` | backend tests |
| `PORT` | `4000` | backend |
| `CORS_ORIGIN` | `http://localhost:3000` | backend |
| `NUXT_PUBLIC_API_BASE` | `http://localhost:4000/api` | frontend (runtimeConfig.public.apiBase) |
| `NUXT_PORT`/`PORT` | `3000` | frontend |
Local Postgres 18 already runs on localhost:5432 (user `cace`, no password). Compose's postgres publishes host port **5433** to avoid the clash.

### Backend scripts (backend/package.json — owned by worker-1)
`dev` (tsx watch src/server.ts) · `build` (tsc → dist/) · `start` (node dist/server.js) · `db:generate` (drizzle-kit generate) · `db:migrate` (node dist/db/migrate.js or tsx src/db/migrate.ts — must run migrations programmatically, usable in Docker) · `db:seed` · `test` (vitest run) · `test:coverage` · `lint`/`typecheck`.
`GET /api/health` → `{ success: true, data: { status: "ok" } }` (Docker healthcheck).

### Frontend scripts (frontend/package.json — owned by worker-2)
`dev` · `build` (nuxt build → `.output/server/index.mjs`) · `preview` · `test` (vitest, @nuxt/test-utils) · `typecheck`.

### Backend layering (MRSC, feature folders)
```
backend/src/
  server.ts            # listen
  app.ts               # express app, middleware, mounts /api/<feature> routers (worker-1)
  config/env.ts        # zod-validated env
  db/client.ts, db/migrate.ts, db/seed.ts
  db/schema/*.ts       # MODEL layer (Drizzle tables + inferred types)
  lib/http.ts          # envelope helpers, AppError(NotFound/Conflict/Validation), asyncHandler, error middleware
  lib/dates.ts         # ISO-week helpers: weekStart(date)=Monday, weekRange, isWithinWeek — pure, tested
  lib/money.ts         # cents helpers: toCents, fromCents, mulHoursRate, percentOf — pure, tested
  modules/<feature>/<feature>.{schemas,repository,service,controller,routes}.ts (+ .test.ts)
  modules/invoices/*, modules/reports/*  # OWNED BY worker-3 (worker-1 creates only stub index routers)
```
- Controllers: parse with Zod, call service, return envelope. No SQL outside repositories. Services take repositories via constructor/factory (testable).
- Envelope: `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details? } }`. Codes: `VALIDATION_ERROR`(400), `NOT_FOUND`(404), `CONFLICT`(409), `WEEK_CLOSED`(409), `INTERNAL`(500).
- Money: DB `numeric(12,2)`; services compute in integer cents; API returns numbers (e.g. `130.5`). Hours `numeric(5,2)`.
- Dates: `date` columns as `YYYY-MM-DD` strings end-to-end (no JS Date timezone shifting). UI displays `DD-MM-YYYY`.
- IDs: integer identity. Display IDs formatted in UI (`#CLI-001`).
- Immutability: no in-place mutation of inputs in services.

### Data model (worker-1 implements; contract doc is authoritative)
- `payment_platforms` (id, company, fee_percent numeric(5,2) default 0, fee_flat numeric(12,2) default 0, created_at)
- `clients` (id, name, contact_email, cc_email null, billing_hour numeric(12,2) NOT NULL, payment_platform_id FK null, notes null, created_at, updated_at)
- `projects` (id, name, client_id FK null, description null, billing_hour null, archived bool default false, created_at, updated_at) — CHECK: client_id IS NOT NULL OR billing_hour IS NOT NULL
- `weeks` (id, start_date date UNIQUE [Monday], status enum open|closed, closed_at null)
- `work_records` (id, week_id FK, project_id FK, client_id FK null [denormalized from project at write], description, hours numeric(5,2) CHECK >0 AND <=24, date, created_at, updated_at)
- `invoices` (id, number UNIQUE, week_id FK, client_id FK null, client_name_snapshot, contact_email_snapshot, cc_email_snapshot, platform_company_snapshot, fee_percent, fee_flat, total_hours, gross, fee_amount, net, created_at) UNIQUE(week_id, client_id) (treat null client as one bucket — use partial unique index)
- `invoice_lines` (id, invoice_id FK cascade, record_id FK null, date, project_id, project_name_snapshot, description, hours, rate, line_total)
- `settings` singleton (id=1, display_name, weekly_target_hours default 40, currency_symbol default '$', invoice_prefix default 'INV')

### Business rules
- Effective rate = project.billing_hour ?? client.billing_hour.
- Week auto-create: `GET /api/weeks/current` returns (creating if absent) the week containing today. `GET /api/weeks/by-date/:date` same for any date. Weeks also expose totals (hours, projected gross) and `belowTarget`.
- Records: create/update/delete → 409 `WEEK_CLOSED` if week closed; 400 if date outside week.
- Close/reopen week: reopen allowed only if no invoices exist for that week (409 otherwise).
- Invoices: `POST /api/weeks/:id/invoices` only for closed weeks; idempotent (returns existing); one invoice per client bucket; standalone projects → client_id null bucket "No client".
- Fee = round(gross * fee_percent/100) + fee_flat (cents); net = gross − fee. Fee shown as "absorbed".
- Invoice number: `{prefix}-{YYYY}-{NNN}` sequential per year.

## Interface Contracts
`orchestration-ctx/decisions/api-contract.md` — written by worker-1 in T2. **Authoritative** for every endpoint/DTO. Downstream workers must not read backend source to answer contract questions — ask team-lead.

## Communication Plan
- worker-1 → team-lead `CHECKPOINT: CONTRACT-READY` → team-lead relays `GO` to worker-2 and worker-3.
- worker-3 needs worker-1's schema for invoices tables: worker-1 creates ALL tables (incl. invoices, invoice_lines, settings) in T1. worker-3 must not edit `db/schema/*` — request changes via team-lead.
- worker-3 may add dependencies to backend/package.json via `npm install` only (pdfmake, archiver, types). No other package.json edits.
- No direct worker↔worker messages.
