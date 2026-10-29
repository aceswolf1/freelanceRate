# Team Plan: quality-followup
## Context
- `quality-followup-plan.md`: approved 2026-10-27 (Q1–Q4).
- Prior project: `development/freelancer-invoices/` (API contract: `orchestration-ctx/decisions/api-contract.md`).
## Work Streams
| ID | Stream | Owner | Role | Pts | Deps |
|----|--------|-------|------|-----|------|
| T1 | Handoff refresh (Q1) | lead | — | 2 | — |
| T2 | E2E DB isolation + harness (Q2) | worker-1 | pt-test-quality | 5 | — |
| T3 | E2E re-run + new specs (Q3) | worker-1 | pt-test-quality | 5 | T2 |
| T4 | Frontend coverage tooling + baseline (Q4a) | worker-2 | pt-test-quality | 2 | — |
| T5 | Coverage to ≥80% lines + threshold + CI (Q4b) | worker-2 | pt-test-quality | 5 | T4 |
## Ownership (no overlap)
- worker-1: `e2e/**` only.
- worker-2: `frontend/test/**`, `frontend/vitest.config.ts`, `frontend/package.json` + `package-lock.json`, `.github/workflows/publish.yml` (frontend step only).
- Product code (`frontend/app/**`, `backend/src/**`): nobody. Bugs found → GAP report to lead.
## Fixed facts
- Real data: DB `freelancer_invoices`, backend :4400, frontend :3100 (lead's). NEVER touch.
- E2E: DB `freelancer_invoices_e2e`, backend :4410 (HOST=127.0.0.1), frontend :3300 with `NUXT_API_INTERNAL_BASE=http://127.0.0.1:4410`.
- Local Postgres 18: `postgres://cace@localhost:5432/<db>`, no password.
- CI runs `TZ=UTC`; run suites with `TZ=UTC` too.
## Communication
None between workers. All via team-lead.
