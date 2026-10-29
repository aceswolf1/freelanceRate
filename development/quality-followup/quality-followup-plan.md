# Feature Plan: quality-followup

## Objective
Close the three gaps found in the post-delivery review of Freelancer Invoices (2026-10-26), in the user's order:
1. **Handoff refresh**: `development/freelancer-invoices/06-handoff.md` is stale since 2026-10-23.
2. **E2E isolation + refresh**: the Playwright suite must never touch the user's real dev DB; re-run it and cover everything shipped since its last run.
3. **Frontend coverage**: measure it (tooling missing) and reach ≥ 80% lines.

## Assumptions & Constraints
- The user's real data lives in local DB `freelancer_invoices` (backend on :4400, frontend on :3100). Nothing in this work may write to it.
- Worker model is MiniMax-M3 with a limited token plan → max 2 concurrent workers, concise briefs.
- Permission classifier blocks DB-destructive commands unless the user names the DB/tables → authorization requested at the approval gate.
- No product-code changes unless a test exposes a real bug (then: report as GAP → lead decides / routes).
- Run every suite with `TZ=UTC` as well as local TZ before declaring done (CI is UTC).

## Existing Patterns Used
- E2E: `e2e/` own package; `helpers/servers.ts` (start/stop servers it owns, PIDs in `.state/servers.json`), `helpers/paths.ts` (ports/URLs via env), `global-setup.ts`/`global-teardown.ts` (seed + start, re-seed + stop), specs in `e2e/tests/*.spec.ts`, roles/labels selectors, `gotoApp` waits for hydration.
- Frontend tests: Vitest 5 + `@nuxt/test-utils` (`// @vitest-environment nuxt`, `mountSuspended`), `vi.mock('#build/fetch')`, tests in `frontend/test/*.test.ts`.
- Backend: `npm run db:migrate` / `npm run db:seed` read `DATABASE_URL`; server reads `HOST`/`PORT`/`DATABASE_URL`.
- Frontend runtime: `NUXT_API_INTERNAL_BASE` = target of the same-origin `/api` proxy (no CORS needed).

## Requirements
| ID | Requirement | Acceptance |
|----|-------------|------------|
| Q1 | Handoff reflects current state | Deploy section = GHCR + registry compose + Watchtower + /api proxy + NAS port 3010 + TZ; features after 2026-10-23 listed; release flow; current test numbers; no stale `NUXT_PUBLIC_API_BASE`/`CORS_ORIGIN`/5433 instructions |
| Q2 | E2E uses only `freelancer_invoices_e2e` | Harness starts its own backend (:4410) on that DB and its frontend (:3300) proxying to it; hard guard aborts if the target DB name ≠ `freelancer_invoices_e2e`; CORS proxy removed; dev DB row counts unchanged before/after a full run |
| Q3 | E2E green and extended | Full suite passes; new specs for email content options, contact name (email greeting + PDF "Attn"), `/api` proxy (same-origin, non-API path 404), clipboard fallback with `navigator.clipboard` absent, sidebar/theme icons render (primeicons font, not fallback), favicon links + files |
| Q4 | Frontend coverage measured and ≥ 80% lines | `@vitest/coverage-v8` installed; `npm run test:coverage` reports; thresholds enforced (lines ≥ 80); CI test job runs coverage |

## Technical Approach
- **Q2:** new DB created by the harness setup (`createdb` if missing) → `db:migrate` + `db:seed` with `DATABASE_URL` pointing at it; backend started from `backend/` (`npm run build` + `node dist/server.js`, `PORT=4410 HOST=127.0.0.1`); frontend `.output` started with `NUXT_API_INTERNAL_BASE=http://127.0.0.1:4410` and no `NUXT_PUBLIC_API_BASE` (same-origin `/api`). A single `E2E_DATABASE_URL` constant + `assertE2eDatabase(url)` guard used by every DB-touching helper. Teardown stops only processes it started.
- **Q3:** clipboard fallback is tested by deleting `navigator.clipboard` via `page.addInitScript` (deterministic, no LAN IP), then pasting into a contenteditable to assert `<table>` HTML.
- **Q4:** coverage-v8 matching the vitest major; include `app/**`, exclude generated/types; baseline first, then tests for lowest-covered composables/components; `thresholds.lines: 80` in `vitest.config.ts`; `npm run test:coverage` in the CI frontend step.

## Risk & Unknowns
- Classifier may still block DB commands → explicit user authorization below; worker sends BLOCKED rather than working around.
- MiniMax quota exhaustion mid-task → resume protocol as before.
- Coverage may expose real bugs → reported as GAP, not silently fixed.

## Implementation Scope
Lead: Q1 (docs). worker-1 (pt-test-quality): Q2+Q3 in `e2e/` only. worker-2 (pt-test-quality): Q4 in `frontend/test/**`, `frontend/vitest.config.ts`, `frontend/package.json`(+lock), `.github/workflows/publish.yml` (frontend step only).

## New Artifacts Proposed
- Local DB `freelancer_invoices_e2e` (throwaway, owned by the e2e suite) — needed so the suite can never reach real data. Alternative considered: Docker Postgres per run (heavier, slower).
- Possibly a small `e2e/helpers/db.ts` (guard + DB setup). All else extends existing files.

## Open Items
None.
