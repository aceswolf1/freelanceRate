# Handoff: freelancer-invoices

**Date**: 24-10-2026 · **Status**: complete. R1–R15 all PASS (QA); all 10 QA gaps closed (9 fixed, 1 accepted deviation).

## What was built
A single-user time-tracking and invoicing app (design codename "BillFlow"):
- **Weekly timesheet** (Mon–Sun, Sat/Sun muted but insertable), quick-add/edit drawer, below-40h warning (target configurable), close/reopen week.
- **Clients, Projects, Payment Platforms, Settings** CRUD. Rate fallback is project rate → client rate. Platform fee is percent + optional flat amount.
- **Invoice Generator**: closed weeks only, one invoice per client plus a "No client" bucket for standalone projects. Rates and names are snapshotted at generation, and generating twice returns the same invoices. PDF per invoice, zip of all, `mailto:` email text, and "Copy formatted" (HTML tables).
- **Earnings** by project and by client (gross / fees / net / hours, plus an unbilled block).
- **Light/dark theme** (dark default), persisted without a flash on load.

## Stack (as shipped)
| Layer | Tech |
|---|---|
| Backend `backend/` | Express 5 + TypeScript + Drizzle (node-postgres) + Zod, Model → Repository → Service → Controller in feature folders; pdfmake (PDF), archiver (zip) |
| Frontend `frontend/` | Nuxt 4 + **PrimeVue 4.5.5** (Material preset, DESIGN.md tokens; MIT, downgraded from v5 by user decision) + Tailwind 4 |
| DB | PostgreSQL (local 18 for dev; `postgres:17-alpine` in Docker) |
| E2E `e2e/` | Playwright (Chromium) |
| Deploy | `docker-compose.yml` (db, backend, frontend), env-driven, TrueNAS-ready |

## Who delivered what
| Worker | Delivered |
|---|---|
| worker-1 (backend) | Scaffold, full schema + migrations + idempotent seed, API contract (`orchestration-ctx/decisions/api-contract.md`), CRUD/weeks/records modules, 217 unit tests |
| worker-2 (frontend) | Nuxt shell + themes, Clients/Projects/Platforms/Settings, Weekly Timesheet; fixes for GAP-001/002/004/006/007; PrimeVue 4 downgrade |
| worker-3 (backend/devops) | Dockerfiles + compose + README; invoice engine, PDF, zip, email, earnings; backend stabilization (records router, test harness, 3 repository bugs); port 4400 |
| worker-4 (frontend) | Invoice Generator + Earnings pages; GAP-008 fix |
| worker-5 (QA) | Playwright suite (63 specs), 12 screenshots, R1–R15 traceability, gap report |
| team-lead | Final GAP-009 regression fix (layout `watchEffect` reverted state changes) + regression test, final E2E run, after the user asked to close all workers |

## Verification (final)
| Check | Result |
|---|---|
| Backend `npm test` | 22 files / 310 tests passed |
| Backend coverage | 96.82% lines, 89.86% branches, 98.18% functions |
| Backend `tsc` | 0 errors |
| Frontend `npm test` | 20 files / 198 tests passed; typecheck 0 errors |
| E2E `npx playwright test` | 63 / 63 passed, no expected-failure markers (final run by lead after GAP-009/010) |
| Docker | all 3 containers healthy; `/api/health` OK; frontend 200; migrations applied in-container |

## How to run

### Local development
```bash
# Postgres 18 on localhost:5432 (user cace). One-time:
createdb freelancer_invoices; createdb freelancer_invoices_test
cd backend && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed
npm run dev                      # API on http://localhost:4400/api
cd ../frontend && npm install
npm run build && PORT=3000 node .output/server/index.mjs   # UI on http://localhost:3000
```
- **Use the production build for the frontend locally.** `npm run dev` crashes its Vite SSR worker ("IPC connection closed") on this machine.
- **Restart the backend after backend code changes.** `tsx watch` didn't reload reliably here.
- **Ports:** 127.0.0.1:4000 is used by Local.app, which is why the backend uses 4400. Port 3000 is currently used by another local app (Grand Valley Soccer Association). If you run on another port, also set backend `CORS_ORIGIN` to that origin.

### Tests
```bash
cd backend  && npm test && npm run test:coverage   # uses freelancer_invoices_test (tables truncated per test)
cd frontend && npm test
cd e2e      && npx playwright test                  # self-manages: seeds dev DB, starts :3300 + CORS proxy :4401, re-seeds after
```

### Docker / TrueNAS
```bash
cp .env.example .env              # set POSTGRES_PASSWORD (URL-safe), TZ (e.g. America/Chicago), NUXT_PUBLIC_API_BASE=http://<nas-host>:4400/api, CORS_ORIGIN=http://<nas-host>:3000
docker compose up -d --build      # db (host 5433), backend 4400, frontend 3000; migrations run on backend start
```
Host ports can be overridden with `DB_PORT`, `BACKEND_PORT` and `FRONTEND_PORT`. `NUXT_PUBLIC_API_BASE` must be the browser-reachable API URL. Data lives in the `pgdata` volume; back it up with `pg_dump` (see README §Deployment). A volume `freelancer-invoices_pgdata` from the verification run exists on this machine; remove it with `docker volume rm freelancer-invoices_pgdata` if you don't need it.

## Integration notes
- **Time zone**: "today" and Mon–Sun week boundaries use local time — the browser's for the UI and `TZ` for the containers (default UTC). Set `TZ` in `.env` on TrueNAS, or the week flips early in the evening.
- **API contract:** `orchestration-ctx/decisions/api-contract.md` is authoritative. Accepted deviations are in §8 / §8.1, including GAP-005: earnings `groupBy=project` lists each standalone project as its own row, and only `groupBy=client` uses the "No client" bucket.
- **Single user, no auth.** Intended for a LAN/NAS. Don't expose it to the internet without adding authentication.
- **Money** is computed in integer cents. Fees are rounded half-up per invoice and allocated to projects by largest remainder, so earnings always add up to the invoice totals.
- **Invoice numbers** are `{prefix}-{YYYY}-{NNN}`, where YYYY is the billing week's year.

## Deferred / out of scope
- Login/multi-user, SMTP sending, multi-currency, payment tracking.
- Decorative design widgets with no backing data (rate-distribution chart, compliance card, search, notifications, YTD tiles).
- A configurable list of allowed CORS origins (only one origin is supported today).

## Decision log
`orchestration-ctx/decisions/`: `stack-and-harness-decisions.md` (stack, user authorizations, port 4400, PrimeVue 4), `backend-stabilization-handoff.md`, `api-contract.md`.
