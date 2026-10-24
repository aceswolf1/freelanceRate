# Feature Plan: freelancer-invoices

## Objective
Greenfield single-user time-tracking + invoicing web app per `requirements.md` and `.claude/design/`.

## Assumptions & Constraints
See 00-intake (week Mon–Sun, rate fallback, closed-week invoicing, USD default). User decisions (2026-10-22):
Express+TS+Drizzle backend · no login · mailto + copy-HTML · Docker compose now.

## Existing Patterns Used
None — greenfield (project root contains only requirements.md and .claude/design). Patterns established here:
- Backend feature folders `backend/src/modules/{feature}/{feature}.{repository,service,controller,routes,schemas}.ts`,
  Drizzle models in `backend/src/db/schema/*.ts` (the "Model" layer), migrations via drizzle-kit.
- Frontend `frontend/app/{pages,components/{feature},composables,stores?}` (Nuxt 4 `app/` dir), `useApi()` composable over `$fetch`.
- Tests colocated `*.test.ts` (Vitest); integration in `backend/tests/integration`; E2E in `e2e/` (Playwright).

## Requirements
R1–R15 in 01-requirements-freelancer-invoices.md.

## Technical Approach
- **Layout**: `backend/`, `frontend/`, `e2e/`, `docker-compose.yml`, `.env.example`, root README.
- **DB tables**: payment_platforms, clients, projects, weeks(start_date unique Monday, status, closed_at),
  work_records, invoices(+ snapshot totals, fee, number, week_id, client_id nullable), invoice_lines (snapshot), settings (singleton row).
- **Rate snapshot at invoice generation** (not at record entry) so edits during the open week are reflected; invoices immutable after.
- **Invoice engine** (service, pure functions, heavily unit-tested): group records by client → project, resolve rate, cents math, fee, 40h check.
- **PDF**: pdfmake on backend (no Chromium → small Docker image); zip via archiver.
- **Email text**: backend endpoint returns `{ mailto, subject, text, html }`; frontend renders link + copy button (ClipboardItem text/html).
- **Theme**: PrimeVue Material preset with custom tokens from DESIGN.md (dark), derived zinc/violet light palette; `.dark` class strategy shared by Tailwind and PrimeVue `darkModeSelector`.
- **Contract-first**: wave 1 produces `orchestration-ctx/decisions/api-contract.md` (endpoints, DTO shapes, enums, errors). All downstream work cites it.

## Risk & Unknowns
- Week/date timezone bugs → store dates as `date` (no time), compute weeks with ISO Monday in UTC-agnostic helpers; unit tests on boundaries.
- mailto length limits (~2000 chars in some clients) → truncation fallback + copy button.
- PrimeVue Material + Tailwind layering conflicts → use `tailwindcss-primeui` and CSS layer ordering.
- Teammate harness wrapper may run non-Claude models → tight assignments with explicit acceptance criteria.

## Implementation Scope (waves)
1. W1 backend-core: scaffold, schema, migrations, seed, API contract  ‖  W2 frontend shell: Nuxt+PrimeVue+Tailwind+themes+layout  ‖  W3 devops: Dockerfiles, compose, env
2. W1 CRUD+weeks/records APIs + tests  ‖  W2 Clients/Projects/Settings views  ‖  W3 invoice engine, PDF, email text, earnings API + tests
3. W2 Weekly Timesheet view  ‖  W4 (reuse parked worker) Invoice Generator + Earnings views
4. W5 QA: E2E Playwright critical flow, coverage check, integration review

## New Artifacts Proposed
Everything (greenfield): `backend/` (Express/Drizzle app), `frontend/` (Nuxt 4 app), `e2e/` (Playwright),
`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.env.example`, `README.md`.
Alternatives considered: Nuxt server routes as backend (rejected: requirement says separate folders + MRSC), Puppeteer PDF (rejected: image size).

## Open Items
- settings_preferences/screen.png is corrupt — use its code.html.
- Earnings view has no design — will follow design language (cards + tables) in a new page.

## References
- 00-intake-freelancer-invoices.md · 01-requirements-freelancer-invoices.md · requirements.md · .claude/design/
