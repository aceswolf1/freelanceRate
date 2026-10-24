# task-assignment-fix-gap-006-007 (worker-2, revision from QA)

## Task Type
IMPLEMENTATION (bug fixes). Same author, exact repros from QA.

## GAP-007 (HIGH): Settings form shows fallback values → saving overwrites real data
Repro: the seeded DB has display name "Alex Morgan" (the sidebar shows it, and `GET /api/settings` returns it). Open `/settings`: the form's Display Name says "Consultant" (SETTINGS_FALLBACK, `useSettings.ts:13`). Pressing "Save All Changes" overwrites the stored name with "Consultant", which is silent data loss.
Cause per QA: the layout's user card calls `useProfile().load()` first, so `pending` is already true when `settings.vue` `boot()` calls `load({ force: true })`. `useSettings.load()` then returns early (`if (pending.value || …) return settings.value`) with the fallback, and the form hydrates once from it.
Fix requirements: (1) a forced load must await an in-flight request (share the pending promise) rather than return the fallback; (2) the form must hydrate from the real settings state; e.g. `watch` the settings state with `immediate` and re-hydrate until the user has edited (track a dirty flag). Never seed an editable form from fallback values without marking it as not-loaded; disable Save until the real settings have loaded. Regression test: simulate a concurrent in-flight load + forced load and assert the form shows the API value, not the fallback.

## GAP-006 (MEDIUM): literal template text in a column header
`frontend/app/components/settings/PaymentPlatformsTable.vue:75`: `<Column header="Fee on {{formatMoney(1000, currencySymbol) }}" ...>` renders the braces verbatim. Use a bound header: `:header="\`Fee on ${formatMoney(1000, currencySymbol)}\`"`. Grep all `.vue` files for other static attributes containing `{{` and fix them too. Add a test asserting the header text.

## Verification
`npm run typecheck && npm test && npm run build` green; paste evidence. No long-lived servers. Conserve tokens.

## Reporting
Append `## GAP-006/007 fix` to progress-report.md, then `SendMessage(to: "team-lead", message: "COMPLETE: GAP-006/007 fixed. <one line each>. typecheck/test/build: <numbers>", summary: "GAP-006/007 fixed")` (fallback `main`).
