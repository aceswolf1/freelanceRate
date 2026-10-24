# task-assignment-fix-gap-001 (worker-2, revision from QA)

## Task Type
IMPLEMENTATION (bug fix). Same author, exact repro from QA (worker-5).

## GAP-001 (severity HIGH): timesheet quick-add drawer freezes the tab (R5, R6 unusable in browser)
Repro (headless Chromium, production build): open `/`, click any "Add record" / "Log Weekend" / header "Add Time" → main thread spins forever (click never completes; later evaluate() calls time out).
Root cause per QA (verify it yourself):
- `frontend/app/pages/index.vue:41-52`: `watch(() => request.value.token, () => { if (!request.value.open) return; editing.value = null; openDrawer(request.value.date) })`
- `openDrawer(date) { editing.value = null; close(); open(date) }`, and `open()` in `frontend/app/composables/useQuickAdd.ts:15-19` increments `token`. So the watcher re-enters itself forever. Dev builds stop it with "Maximum recursive updates exceeded"; production has no guard.

## Fix requirements
- Break the loop structurally: the watcher must not trigger a token bump. E.g. separate "request to open" (from layout "Add Time" / day buttons) from local drawer state; the watcher only copies `request.date` into local state and sets visible = true, never calling `open()`.
- Check edit-record and delete paths and the header "Add Time" (layout) for the same pattern.
- Also (latent SSR risk flagged by worker-4): any of your composables that resolve `useApi()` lazily after an `await` must resolve it once at setup.
- Add a regression test that mounts the page/drawer, triggers open twice, and asserts the open handler ran a bounded number of times (e.g. spy count ≤ 2) and the drawer is visible.

## Verification (must paste results in progress-report.md)
1. `cd frontend && npm run typecheck && npm test && npm run build` all green.
2. Production check: `cd frontend && NUXT_PUBLIC_API_BASE=http://localhost:4400/api PORT=3301 node .output/server/index.mjs` (background; record PID; stop it after), then confirm SSR of `/` returns 200. A browser click test is QA's job; QA (worker-5) will re-run its timesheet spec after you finish.
   Note: :3000 is occupied by another app on this machine; use 3301. Backend CORS allows only http://localhost:3000, so you cannot click-test from 3301 without QA's proxy; rely on the unit regression test.

## Boundaries
Only your files in `frontend/` (not pages/invoices.vue, pages/earnings.vue, components/invoices|earnings, useInvoices/useEarnings, which are worker-4's). No backend changes. Conserve tokens.

## Reporting
Append `## GAP-001 fix` to tasks/W2-frontend/progress-report.md, add a row to completion-report.md Deliverables, then:
`SendMessage(to: "team-lead", message: "COMPLETE: GAP-001 fixed. <one-line root cause + fix>. typecheck/test/build: <numbers>", summary: "GAP-001 fixed")` (fallback `main`).
