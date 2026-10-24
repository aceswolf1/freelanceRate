# task-assignment-primevue4 (worker-2, after GAP-002)

## Task Type
IMPLEMENTATION (dependency change). User decision 23-10-2026: downgrade PrimeVue 5 → 4 (MIT). PrimeVue 5 is PrimeUI-licensed and shows "Invalid PrimeUI License" without a key (QA GAP-003).

## Do (only AFTER your GAP-002 fix is complete and reported)
1. In `frontend/`: install PrimeVue 4.x latest (`primevue@^4.5.5`) with matching companions: `@primeuix/themes` major compatible with PrimeVue 4 (check its peer deps; use context7/npm view, don't guess), `@primevue/nuxt-module` 4.x. Remove `@primevue/forms` if GAP-002 didn't already.
2. Fix API differences between v5 and v4 in your files AND in worker-4's invoices/earnings components (granted for this task only: version-compat edits there, no behaviour changes). Keep the preset tokens (dark + light) identical in output.
3. Confirm no "PrimeUI License" string remains in the built output: `grep -r "PrimeUI License" .output` returns nothing.
4. Update the deviations note in your progress-report (T4 had recorded v5).

## Verification
`npm run typecheck && npm test && npm run build` all green (≥171 tests, plus the GAP-002 additions); SSR of `/`, `/invoices`, `/clients`, `/projects`, `/earnings`, `/settings` on `PORT=3301 NUXT_PUBLIC_API_BASE=http://localhost:4400/api node .output/server/index.mjs` returns 200 (stop the server afterwards). Paste evidence.

## Reporting
Append `## PrimeVue 4 downgrade` to progress-report.md, then `SendMessage(to: "team-lead", message: "COMPLETE: PrimeVue 4 downgrade done. <versions>. typecheck/test/build: <numbers>", summary: "PrimeVue 4 done")` (fallback `main`). Conserve tokens.
