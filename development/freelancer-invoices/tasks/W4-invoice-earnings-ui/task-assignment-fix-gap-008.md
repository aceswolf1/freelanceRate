# task-assignment-fix-gap-008 (worker-4, revision from QA)

## Task Type
IMPLEMENTATION (small bug fix). Same author.

## GAP-008 (low-medium): invoice line table shows the weekday twice
`frontend/app/components/invoices/InvoiceLineTable.vue:53`: `{{ dayShortLabel(line.date) }}, {{ formatShortDate(line.date) }}` renders `Mon, Mon 19-10`. Expected, per the design (`.claude/design/invoice_generator/screen.png`): `Mon, Oct 19`. The PDF and email body are already correct; match their format.
Fix with an existing util from `app/utils/format.ts` if one produces "Oct 19"; otherwise add a small formatter to your own component or composable (don't edit worker-2's format.ts without a reason; if you must, add a function, don't change existing ones). Add or update a test in test/InvoiceCard.test.ts (or a new one) asserting the rendered text is `Mon, Oct 19` for 2026-10-19.

## Verification
`cd frontend && npm run typecheck && npm test && npm run build` green. No servers. Conserve tokens.

## Reporting
Append `## GAP-008 fix` to progress-report.md, then `SendMessage(to: "team-lead", message: "COMPLETE: GAP-008 fixed. typecheck/test/build: <numbers>", summary: "GAP-008 fixed")` (fallback `main`).
