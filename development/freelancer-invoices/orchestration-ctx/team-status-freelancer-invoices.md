# Team Status: freelancer-invoices
**Workers active**: 0 — all 5 workers SHUTDOWN (user request; processes terminated by lead after shutdown_request could not be answered due to provider 429)
**Last updated**: 23-10-2026 (CONTRACT-READY, GO sent to worker-2/worker-3)

## Worker Roster
| Name | Role | State | Started | Last active | Prior tasks | Reuse eligible |
|------|------|-------|---------|-------------|-------------|----------------|
| worker-1 | pt-backend-eng | SHUTDOWN | wave1 | — | — | — |
| worker-2 | pt-frontend-eng | SHUTDOWN | wave1 | 23-10 | T4 shell, T5 CRUD views, T6 timesheet | ✅ | wave1 | — | — | — |
| worker-3 | pt-backend-eng | SHUTDOWN | wave1 | 23-10 | T7 docker, T8 invoicing+reports+pdf | ✅ (B7 docker verify pending user cp) |
| worker-4 | pt-frontend-eng | SHUTDOWN | 23-10 | 23-10 | T9 invoices+earnings UI | ✅ | 23-10 | — | — | — |
| worker-5 | pt-test-quality | SHUTDOWN | 23-10 | — | — | — |

## Tasks (authoritative ledger — no harness TaskList in this session)
| ID | Title | Owner | Status | Blocked By | Pts |
|----|-------|-------|--------|------------|-----|
| T1 | Backend scaffold/schema/seed | worker-1 | completed | — | 5 |
| T2 | API contract | worker-1 | completed | T1 | 2 |
| T3 | CRUD + weeks/records + tests | worker-1→worker-3 | completed | T2 | 5 |
| T4 | Frontend shell + themes | worker-2 | completed | — | 3 |
| T5 | Clients/Projects/Platforms/Settings views | worker-2 | completed | T2,T4 | 5 |
| T6 | Weekly Timesheet view | worker-2 | completed | T5,T3 | 5 |
| T7 | Docker/compose/README | worker-3 | completed | — | 3 |
| T8 | Invoicing/PDF/email/earnings API | worker-3 | completed | T2,T7 | 8 |
| T9 | Invoice Generator + Earnings views | worker-4 | completed | T5,T8 | 5 |
| T10 | QA E2E + coverage + integration review | worker-5 | completed | all | 5 |

## Decisions Made
- [22-10-2026] stack-and-harness-decisions.md — user stack choices + harness adaptations
- [23-10-2026] backend-stabilization-handoff.md — worker-1 blocked by classifier → worker-3 owns records fix + harness + full suite

## Watch items
- Frontend full suite green after port change (8 tests hardcoded :4000 → routed to worker-2) | verify at: worker-2 COMPLETE | how: `cd frontend && npm test` | expected: 0 failed
- VALIDATION_ERROR details shape = array of {path,message} (worker-2 normaliser) | verify at: worker-1 COMPLETE | how: `curl -s -XPOST localhost:4000/api/clients -H "content-type: application/json" -d "{}"` | expected: details is array
- worker-2 live E2E (AC-3/AC-4) unverified — all routes 404 at T5 time | verify at: worker-2 COMPLETE | how: worker report + curl /api/health
- Visual screenshot check deferred to QA wave (classifier blocks playwright script without user authorization)
- Contract deviations | verify at: each COMPLETE | how: read `## Deviations` in decisions/api-contract.md
- Full docker stack builds | verify at: worker-3 COMPLETE | how: `docker compose config` + worker report

## Active Issues
- [23-10 user] Backend PORT → 4400 (Local.app owns 127.0.0.1:4000). Lead restarted backend: `PORT=4400 npm run dev` (tsx watch), log /tmp/fi-backend.log; stale PIDs 54911/61761 killed per user instruction. Pending on resume: worker-3 changes backend default + backend/.env(.example) + root .env.example + compose proposed + README proposed + contract; worker-2 changes frontend NUXT_PUBLIC_API_BASE default + frontend/.env.example.
- [23-10 lead] worker-4 allowed to add ColumnGroup/Row/SelectButton to PrimeVue component whitelist in frontend/nuxt.config.ts (one-line exception to worker-2 ownership).
- Permission classifier denies workers running `npm test` (TRUNCATE test DB) and launching servers despite relayed user authorization → user to run test suites via `!`. Stray worker-1 server PID 61761 on :4277 (kill denied).
- worker-1 revision 1: records router missing mergeParams (not applied after first relay). worker-3 revision 1: tsc errors in tests/integration/invoices.helpers.ts.
- worker-2: 429 at 02:09 at start of T5 (making notifier resilient for composable tests; building against contract shapes). worker-3: 429 at 02:09 in T8 — invoice engine/email done (13/13 tests, 100% cov on reports engine), next: reports repository/service/router. | Status: resumed
- worker-1: died 23-10-2026 02:09 with 429 "Token Plan usage limit reached" (teammate wrapper provider). Was mid-fix: validateBody/Query/Params helpers take req but controllers pass req.body/req.query — fix across all controllers incomplete. | Status: resumed
- worker-3: root docker-compose.yml + README.md writes denied by auto-mode classifier; staged in tasks/W3-docker-invoicing/*.proposed.*; awaiting user | Status: escalated

## Phase
Converged — handoff in 06-handoff.md

## Notes
- [23-10-2026] worker-2 T4 deviations accepted: PrimeVue 5.0.4 (current major), Tailwind 4 via @tailwindcss/vite, useNotifier() name. No playwright MCP in workers → screenshots via @playwright/test script.
- [23-10-2026] worker-3 T8 accepted: 84 tests, 98% cov, engine 100%. Contract §8.1 deviations accepted: no WEEK_NOT_CLOSED (409 CONFLICT per §4.1), earnings `unbilled` field added, "No client" bucket fee = 0 (no platform), mailto truncation at 2000 (§4.7), PDF filename keeps invoice number verbatim. Bug relayed to worker-1: records router missing mergeParams.
- [23-10-2026 10:xx] worker-3 stabilization verified by lead: records mergeParams in place, tsc 0 errors, PORT default 4400, /api/weeks/1/records 200. Rollback harness kept; full suite blocked on one-time TRUNCATE of freelancer_invoices_test (classifier requires user to name tables) → asked user to run it.
- [23-10-2026] worker-2 COMPLETE verified by lead: frontend 14 files / 164 tests green, apiBase default 4400. Live AC-3/AC-4 passed via API + SSR. NOT verified (→ QA wave T10): record create/edit/delete via browser click path; closed-week read-only live. Note: `npm run dev` Vite SSR worker crashes "IPC connection closed" on this machine; production build (`npm run build && node .output/server/index.mjs`) works. Contract §1.5 details-array confirmed live.
- [23-10-2026] worker-4 COMPLETE verified by lead: components/composables present, frontend 14 files/164 tests green, whitelist grant applied. Fixed SSR NUXT_E1001 (lazy useApi after await) in own composables; flagged same latent pattern in worker-2's → QA checklist. worker-2 hardened tests to derive apiBase from runtime config (port-independent, proven with :9999).
- [23-10-2026] QA GAP-001 (HIGH): timesheet drawer infinite reactive loop (watch on request.token → openDrawer → open() bumps token) freezes tab in prod build → routed to worker-2 (tasks/W2-frontend/task-assignment-fix-gap-001.md). QA env: :3000 occupied by another local Next.js app → QA runs frontend on :3300 + CORS proxy :4401 → :4400.
- [23-10-2026] User reported running TRUNCATE + cp, but lead verified neither landed (no root files; test DB still has 08:46 rows). Re-sent absolute-path commands.
- [23-10-2026] QA found :4400 backend stale (tsx watch never reloaded since 09:00; records mergeParams fix not live → POST records 400 weekId NaN). Lead restarted it; POST /weeks/1/records now validates body only. tsx watch unreliable on this machine → restart backend after backend edits. Root docker-compose.yml + README.md copied by user (verified). Test-DB TRUNCATE still pending.
- [23-10-2026] GAP-001 fixed by worker-2 (one-way quick-add signal, local drawer state; edit path fixed; composables resolve useApi at setup). Lead verified frontend 15 files/171 tests green. QA told to rebuild + re-verify.
- [23-10-2026] Stray Nuxt instances of this project on :3223/:3224/:3225 (started by earlier workers) — clean up at convergence.
- [23-10-2026] User TRUNCATEd test DB (verified 0 weeks) + copied root compose/README. worker-3 resumed: full suite/coverage + docker B7 with host-port overrides (4402/3302). worker-5 told not to run backend tests (collision).
- [23-10-2026] QA: GAP-001 VERIFIED fixed in browser. GAP-002 (HIGH): @primevue/forms FormField auto-import shadows app FormField → no labels/inline errors anywhere → routed to worker-2 (rename BfFormField). GAP-003 (MEDIUM): "Invalid PrimeUI License" toast — PrimeVue 5.0.4 is PrimeUI-licensed (Community free w/ key for eligible individuals/small orgs; Commercial paid); v4.5.5 is MIT. Plan had said v4; worker-2 chose v5 in T4. → user decision.
- [23-10-2026] GAP-002 fixed (BfFormField + exclude PrimeVue FormField; also fixed currency-mode RangeError on '$' symbol and undefined useState refs). Lead verified 16 files/177 tests. QA holds rebuild until FRONTEND-FINAL (after PrimeVue 4).
- [23-10-2026] PrimeVue 4.5.5 downgrade done by worker-2 (no code changes needed; lead verified 177 tests, no licence string in .output). GAP-003 (licence) RESOLVED.
- [23-10-2026] QA: 58/59 E2E green; GAP-001 + GAP-002 verified fixed in browser. New GAP-004 (QA's "GAP-003"): edit drawer drops project (RecordDrawer clientId watcher race) → worker-2. worker-5 hit MiniMax 429 at 21:34. worker-3: docker containers freelancer-invoices-{db,backend,frontend} up (B7 in progress).
- [23-10-2026 19:xx] worker-3 COMPLETE verified: backend 22 files/310 tests, coverage 96.82% lines / 89.86% branches / 98.18% functions, tsc 0; Docker B7 healthy (4402/3302), migrations in-container, compose down, pgdata volume kept. Fixed: records mergeParams, settings update silently discarded on fresh DB, clients enrich looked up platforms by client ids, backend Dockerfile tsconfig.build.json, frontend Dockerfile devDeps. Reverted rollback harness → truncation (Postgres no nested tx; invoice generation's COMMIT leaked).
- [24-10-2026] GAP-004 fixed by worker-2 (hydrating guard, re-apply projectId, rate fallback, force refresh). Lead verified 17 files/179 tests. FRONTEND-FINAL sent to QA.
- [24-10-2026] QA: GAP-005 (earnings groupBy=project standalone rows) accepted as contract deviation §8.1. GAP-006 (MEDIUM literal {{}} in PaymentPlatforms header) + GAP-007 (HIGH settings form hydrates fallback → save overwrites display name) → worker-2.
- [24-10-2026] GAP-006/007 fixed by worker-2 (forced load awaits in-flight, SSR-fetched settings, Save disabled until loaded, bound header). Lead verified 18 files/184 tests. FRONTEND-FINAL-2 sent.
- [24-10-2026] worker-5 QA COMPLETE: 61/61 E2E green, R1–R15 all PASS, 8 gaps (001–004, 006, 007 fixed+re-verified; 005 accepted deviation; 008 → worker-4). Lead verified dev DB restored (0 invoices, 12 records, week open) and QA servers stopped. Lead stopped stray frontend servers :3223/:3224/:3225 (this project's, started 10:23–10:28).
- [24-10-2026] GAP-008 fixed by worker-4 (formatLineDate "Mon, Oct 19"); lead verified 18 files/189 tests. worker-3 removed staging headers from root README.md + docker-compose.yml (compose config valid). 06-handoff.md written. All tasks T1–T10 completed.
- [24-10-2026] QA final report (63 specs; ran pre-GAP-008) added GAP-009 (LOW hydration mismatch ActiveWeekCard) + GAP-010 (MEDIUM today via toISOString UTC) → worker-2. Lead found related Docker risk: containers default UTC → backend todayIso wrong on TrueNAS evenings → worker-3 adds TZ env.
- [24-10-2026] User: close all workers, lead finishes. Lead completed GAP-009/010: found + fixed regression in layout watchEffect (state reverts), regression test proven; frontend 198 tests, E2E 63/63. Workers terminated. PROJECT COMPLETE.
