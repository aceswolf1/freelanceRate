# task-assignment-fix-gap-009-010 (worker-2, revision from QA)

## Task Type
IMPLEMENTATION (bug fixes). Same author. QA has `test.fail()` specs asserting the correct behaviour (e2e/tests): they must pass after your fix (QA/lead will run them).

## GAP-010 (MEDIUM, correctness): "today" computed in UTC instead of local date
The timesheet "today" marker uses `new Date().toISOString()` (a UTC date). The backend and the user's clock use the local date, so on 2026-10-23 evening (local UTC-5) the app highlighted Saturday 24-10.
Fix: add/introduce a single `todayLocalIso()` (YYYY-MM-DD from local getFullYear/getMonth/getDate) in your utils, and replace EVERY `toISOString().slice(0, 10)` / `toISOString().split('T')[0]` used for calendar dates across `frontend/app` (grep it). This includes the quick-add default date and the week navigation "today", and worker-4's files if they have the pattern (granted for this one-line replacement; note it). Unit test: with fake timers at a local evening time where the UTC date differs, today is the local date.

## GAP-009 (LOW): hydration mismatch on `/` and `/invoices`
"Hydration completed but contains mismatches": the layout's ActiveWeekCard renders before the week is fetched, so SSR says "No active week" while the client render says "Week 43 Active". Fix: fetch the current week during SSR for the layout (useAsyncData with a shared key, as you did for settings in GAP-007), so the server and client render the same markup.

## Verification
`cd frontend && npm run typecheck && npm test && npm run build` green; paste evidence. No long-lived servers. Conserve tokens.

## Reporting
Append `## GAP-009/010 fix` to progress-report.md, then `SendMessage(to: "team-lead", message: "COMPLETE: GAP-009/010 fixed. <one line each>. typecheck/test/build: <numbers>", summary: "GAP-009/010 fixed")` (fallback `main`).
