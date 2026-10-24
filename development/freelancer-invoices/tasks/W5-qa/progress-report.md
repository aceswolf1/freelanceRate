# Progress: W5-qa (T10 — QA: Playwright E2E, coverage, integration review)

Worker: worker-5 (Test & Quality Engineer). Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`.
Task folder: `development/freelancer-invoices/tasks/W5-qa/`.

## Subtask list
1. ✅ Environment recon (ports, CORS, DB, seeds)
2. ✅ `e2e/` harness (package.json, playwright.config, global setup/teardown, helpers)
3. ✅ `timesheet.spec.ts` (R4/R5/R6/R8)
4. ✅ `close-week.spec.ts` (R7)
5. ✅ `invoices.spec.ts` (R9–R12, PDF/zip/mailto/clipboard)
6. ✅ `crud.spec.ts` (R1/R2/R3/R15)
7. ✅ `earnings.spec.ts` (R13)
8. ✅ `theme.spec.ts` (R14)
9. ✅ `ssr.spec.ts` (hard reload of every route, NUXT_E1001 net)
10. ✅ `screenshots.spec.ts` → 12 PNGs in `tasks/W5-qa/screens/`
11. ✅ Coverage (backend via worker-3, frontend by me) + R1–R15 traceability
12. ✅ Restore (re-seed) + stop the servers I started
13. ✅ `completion-report.md` (Gaps table + traceability)

## Environment findings (2026-10-23)
- Backend :4400 — RUNNING (lead-owned; restarted by the lead mid-session). Never started/stopped by me.
- Frontend :3000 — **occupied by an unrelated app** (Next.js "Grand Valley Soccer Association"). Not ours → not killed.
  ⇒ the E2E frontend runs on **:3300** (`frontend/.output/server/index.mjs`).
- Backend CORS allows only `http://localhost:3000` ⇒ a browser on :3300 is CORS-blocked.
  ⇒ `e2e/helpers/cors-proxy.mjs` forwards `/api/*` :4401 → :4400 and adds the matching
  `Access-Control-Allow-Origin` (+ preflight + `Access-Control-Expose-Headers: Content-Disposition`).
  All backend logic still runs on the lead's :4400; no product code is touched.
- `tsx watch` on this machine does **not** pick up source changes → the live API ran 09:00 code
  (missing the `mergeParams` fix) until the lead restarted it. Reported to the lead (ENV-001).

## Findings

| ID | Severity | Area | Status | Summary |
|----|----------|------|--------|---------|
| GAP-001 | high | frontend timesheet & CRUD | **RESOLVED (worker-2)** | Opening the quick-add drawer put the page into an infinite reactive loop (`watch(() => request.value.token)` → `openDrawer()` → `open()` bumps the token) → the browser tab froze, so records could not be added/edited at all. Found by this suite; fixed by worker-2; re-verified green. |
| GAP-002 | high | frontend CRUD & settings | **RESOLVED (worker-2)** | PrimeVue's auto-imported `FormField` shadowed `app/components/common/FormField.vue` → no field labels and **no inline validation errors** anywhere. Found by this suite; fixed by worker-2; re-verified green. |
| GAP-003 | medium | frontend dependencies | **RESOLVED** | "Invalid PrimeUI License" toast on every page (PrimeVue 5 is commercially licensed) → PrimeVue downgraded to 4.5.5. |
| GAP-004 | medium-high | frontend timesheet & CRUD | **RESOLVED (worker-2)** | The edit drawer dropped the record's project (empty select, `$0.00` total, save blocked). Re-verified green by "the edit drawer prefills the project and saves the change". |
| GAP-005 | low | backend invoicing / reports | **ACCEPTED DEVIATION** | `GET /api/reports/earnings?groupBy=project` returns the standalone bucket as `{id: 4, name: "Internal Tools"}`; contract §4.8 says `{id: null, name: "No client"}`. Totals are correct; the lead accepts it and records it in §8.1. |
| GAP-006 | medium | frontend settings | **RESOLVED (worker-2)** | The payment-platform table header printed the literal `Fee on {{formatMoney(1000, currencySymbol) }}`. Verified fixed in the new screenshot. |
| GAP-007 | high | frontend settings | **RESOLVED (worker-2)** | The Settings form was hydrated from the composable's fallback instead of the persisted row ("Consultant" instead of "Alex Morgan"); saving silently overwrote the stored display name. Re-verified green. |
| GAP-008 | low-medium | frontend invoices & earnings | **OPEN** | The invoice line table renders the weekday twice — `Mon, Mon 19-10` instead of `Mon, Oct 19` (`InvoiceLineTable.vue:53`). The PDF and the e-mail body are correct. |
| GAP-009 | low | frontend shell / timesheet | **OPEN** | `Hydration completed but contains mismatches.` on `/` and `/invoices`: the layout renders the sidebar's ActiveWeekCard before the page fetches the week, so SSR says "No active week" and the hydrated render says "Week 43 Active". |
| GAP-010 | low | frontend timesheet | **OPEN** | The "today" marker uses `new Date().toISOString()` — the UTC date — so in UTC-5 the wrong day column is highlighted in the evening. |
| ENV-001 | — | environment | **RESOLVED (lead)** | The API on :4400 ran pre-`mergeParams` code, so `POST /api/weeks/:weekId/records` answered 400 (`weekId: nan`). Fixed by the lead restarting the API. |

## Suite status (last full run: `npx playwright test`)
**63 specs · 63 passed · 0 failed · 2 expected failures** (GAP-009, GAP-010 — the corrected
behaviour is asserted in `test.fail()` specs). Every other gap found during this wave that was
routed to an owner came back fixed and is re-verified green; three cosmetic findings stay open
(GAP-008 invoice date, GAP-009 hydration mismatch, GAP-010 UTC "today").

The suite now waits for Nuxt's hydration flag before its first click: without that wait, nine specs
were flaky under load (the click landed on the not-yet-hydrated markup and was swallowed).

## Coverage
- backend (worker-3, relayed by the lead; identical to the figures I measured before the run was
  reassigned): 22 files / 310 tests passed · 96.82 % lines & statements · 89.86 % branches ·
  98.18 % functions (gate 80 %) · tsc 0 errors.
- frontend (mine): 16 files / 177 tests passed.

## Test-suite notes
- Deterministic: every expected value is derived from the run day (`helpers/dates.ts` mirrors
  `backend/src/lib/dates.ts`), never hard-coded; the DB is re-seeded before each test.
- PrimeVue `<InputNumber>` only commits from `keydown`/`keypress` → numbers are **typed**
  (`pressSequentially`), not `fill()`ed.
- Serial execution (`workers: 1`) because the specs share one dev database.
