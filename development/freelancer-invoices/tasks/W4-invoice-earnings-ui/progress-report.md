# Progress: T9 — Invoice Generator `/invoices` + Earnings `/earnings`

**Worker:** worker-4 (Frontend Engineer)
**Started:** 2026-10-23
**Assignment:** `development/freelancer-invoices/tasks/W4-invoice-earnings-ui/task-assignment-invoice-earnings-ui.md`

## Subtask list

1. Recon — read assignment, plan, requirements, api-contract, existing frontend patterns, design
2. Extend `app/types/api.ts` with `EarningsUnbilledBlock` (§8.1 additive field) + test factories
3. `composables/useInvoices.ts` (preview / list / generate / email draft / download helpers)
4. `composables/useEarnings.ts` (date range, groupBy, presets, report fetch)
5. `components/invoices/*` (InvoiceCard, InvoiceLineTable, RateLogicStrip, preview card, summary)
6. `pages/invoices.vue` — week selection, open/closed flows, R8 warning + confirm, downloads
7. `components/earnings/*` + `pages/earnings.vue` — range picker, presets, toggle, stat cards, DataTable
8. Tests — composable + component interaction tests
9. Verify — build, typecheck, test; live-backend acceptance via curl/SSR HTML; re-seed DB
10. `completion-report.md` + `COMPLETE:`

## Recon findings (2026-10-23)

- Project root confirmed: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` (has `.claude/settings.json`).
- `frontend/` is Nuxt 4.6 + PrimeVue 5.0.4 + Tailwind 4. Tests: vitest + `@nuxt/test-utils`,
  `include: ['test/**/*.test.ts']`, environment `#vitest-environment nuxt`, `happy-dom`.
  **Consequence: new tests MUST live in `frontend/test/*.test.ts`.**
- Composable pattern: `useState` singletons keyed `bf:*`, `useApi()` for all HTTP, `useNotifier()` for toasts,
  `silent: true` + caller-handled errors, immutable list updates (`[...list, x].sort()`).
- `ApiError` exposes `.code`, `.status`, `.isConflict`, `.fieldErrors`.
- `nuxt.config.ts` `primevue.components.include` — **SelectButton is NOT in the include list**.
  `/earnings` needs a By Project / By Client toggle. Rather than edit worker-2's `nuxt.config.ts`,
  I will build the toggle from two `Button`s in a `role="group"` — same design language, no shared-file edit.
  (Log as a non-breaking decision; tell team-lead so worker-2 can add SelectButton if they prefer.)
- `nuxt.config.ts` includes `DatePicker` — usable for the earnings range picker.
- `format.ts` already has everything needed: `formatDate` (DD-MM-YYYY), `dayLongLabel`, `formatHours`,
  `formatMoney`, `formatMoneyCompact`, `formatRate`, `initials`, `toPercent`, `formatWeekTitle`.
- Design (`invoice_generator/screen.png`) read. Decorative bottom cards (Fallback Rate Engine /
  Audit-Proof Ledger / Platform Fee Engine) are explicitly out of scope per assignment.
  "Net 15"/"SLA Contract #44-B" chips in the design have **no data source** in the contract → dropped.
- `pages/index.vue` already links to `/invoices?weekId=<id>` via `generateInvoices()`.

## Log

### Subtask 2: `types/api.ts` — ✅ Done
Appended `EarningsUnbilled` + `EarningsReport.unbilled` per api-contract.md §8.1 (additive, endpoint #35).
Append-only; nothing existing was touched.

### Subtask 3: `composables/useInvoices.ts` — ✅ Done
- `useInvoices()` — `load` (preview + list in parallel), `generate`, `loadDrafts`, `draftFor`, `copyFormatted`.
- `useInvoiceDownloads()` — blob download with `Content-Disposition` parsing + contract fallback filename.
- Pure exports: `fromInvoice`, `fromPreviewRow`, `buildRateLogic`, `parseDownloadFilename`,
  `pdfFileName`, `zipFileName`, `copyEmailDraft`.
- **Rate-logic decision:** the invoice snapshots a rate but not its origin, so `buildRateLogic`
  compares each project's rate against the client's `billingHour` — equal ⇒ "Client default rate",
  different ⇒ "Project rate override"; `clientId === null` ⇒ always an override. Compare uses a
  0.005 tolerance because `2015 / 15.5 !== 130` exactly in float.

### Subtask 4: `composables/useEarnings.ts` — ✅ Done
`rangeForPreset` (week/month/year/all), `isoToLocalDate`/`localDateToIso` (local-midnight, drift-free),
`isRangeInvalid`, `useEarnings()` with `applyPreset`/`setRange`/`setGroupBy`/`pickerRange`.
- **"All time" sends no `from`/`to` at all**, so the API applies its contracted defaults (§4.8).
- Inverted ranges are rejected client-side (no doomed request) and surfaced inline.

### Subtask 5: invoice components — ✅ Done
`InvoiceCard` (identity, platform/fee, emails, gross/fee/net, PDF, mailto, copy, truncated hint),
`InvoiceLineTable` (accessible `<table>`, DD-MM-YYYY + weekday, `<tfoot>` total),
`RateLogicStrip`, `InvoiceActionBar` (status chip, count badge, Generate, zip).
- Badge says "N Preview Buckets" before generation and "N Invoices" after — an earlier version
  claimed "3 Invoices" during preview, which was untrue. Caught during the live pass.
- Both themes use only semantic tokens, so light/dark come for free (AC 4).

### Subtask 6: `pages/invoices.vue` — ✅ Done
`?weekId=` → else current week; prev/next/today reuse `useWeekNavigation` + `useWeeks` (not forked)
and `router.replace` the query. Open week → preview + disabled Generate + link back to `/`.
Below target → `InlineAlert` + `confirm.require` "Generate anyway", never blocks.

### Subtask 7: earnings page + components — ✅ Done
`EarningsFilters` (4 presets, `DatePicker` range, `SelectButton` By Project/By Client),
`EarningsTable` (sortable `DataTable` + totals footer), stat cards, §8.1 unbilled block, empty state.

### Non-breaking decisions (logged per assignment)
1. **`nuxt.config.ts` PrimeVue whitelist** — added `ColumnGroup`, `Row`, `SelectButton` on
   team-lead's explicit grant. My `EarningsTable` renders its totals footer as a strip rather than a
   `ColumnGroup`, so only `SelectButton` is strictly used; all three are now available to worker-2.
2. **SSR data loading** — both pages `await` their loader at top level instead of `onMounted`, so
   cards/rows render server-side and hydrate from the Nuxt payload (better first paint, and it is
   the authorized non-Playwright verification path).
3. **Server-side error logging** — `pages/invoices.vue` logs the raw error via `console.error` when
   `import.meta.server`, while the UI shows a friendly sentence. Found the NUXT_E1001 bug this way.

### Bug found & fixed during the live pass
**`NUXT_E1001` — Nuxt context lost after `await` (SSR).** `useInvoices`/`useEarnings` resolved the
client lazily via `const api = () => useApi()`. On the invoices page the composable's `load()` runs
*after* an `await`, so `useApi()` → `useRuntimeConfig()` → `useNuxtApp()` had no active context and the
whole page failed to load. Fixed by resolving the client **once at setup** (`const api = useApi()`),
with a comment explaining why. Same change applied to `useInvoiceDownloads`. Earnings worked before
only by accident — its loader touched `useApi()` before any await.

### Verification so far
| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm test` (full suite) | **14 files, 164 tests, all passing** |
| `npm run build` | Build complete |
| SSR `/invoices` (open week) | 3 preview cards, correct totals, Generate disabled, no mailto, below-target warning |
| SSR `/invoices?weekId=1` | same 3 cards via the explicit-id path |
| SSR `/earnings` | 4 rows, net `$4140.57`, unbilled block, totals footer, 4/4 presets, groupBy toggle |
| AC 3 (earnings == invoices) | earnings rows sum **exactly** to totals (4180 / 39.43 / 4140.57) and match the preview cards |

### Still blocked (permission classifier)
Closing week 1, generating invoices, and downloading PDFs/zip require DB writes that the classifier
denied mid-run. The assignment explicitly pre-authorizes these, so this is being escalated rather than
worked around. Details and the verbatim denial are in `completion-report.md`.

## GAP-008 fix

**Symptom:** `InvoiceLineTable.vue:53` rendered `{{ dayShortLabel(line.date) }}, {{ formatShortDate(line.date) }}`
→ `Mon, Mon 19-10`. The weekday appeared twice, and the date used the `DD-MM-YYYY` convention instead
of the design's `Mon, Oct 19` (the PDF and email body already use that format — contract §4.7).

**Fix:** no existing helper in worker-2's `format.ts` produces `Oct 19` — `formatShortDate` gives
`Mon 19-10` (the app-wide `DD-MM-YYYY` display convention), `formatDate` gives `19-10-2026`,
`formatLongDate` gives `Monday, 19-10-2026`. So I added **`formatLineDate`** to my own
`app/composables/useInvoices.ts` (worker-2's `format.ts` untouched) and used it in the cell.
`2026-10-19` → `Mon, Oct 19`; unparseable input → `—`, never a throw.

**Test:** `test/InvoiceCard.test.ts` — one rendering assertion (the date cell equals exactly
`Mon, Oct 19` and does not contain `Mon, Mon`) plus 4 unit tests of `formatLineDate`
(October, January/December labels, a Sunday, and the `—` fallback).

**Verification:**
```
typecheck: 0 errors
npm test  : 18 files, 189 tests, all passing   (was 164 — other workers added suites)
npm run build: Build complete in 7.61s
```