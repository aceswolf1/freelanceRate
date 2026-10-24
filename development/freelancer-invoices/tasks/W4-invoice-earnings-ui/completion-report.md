# Completion Report — T9: Invoice Generator `/invoices` + Earnings `/earnings`

**Worker:** worker-4 (Frontend Engineer) · **Date:** 2026-10-23
**Task dir:** `development/freelancer-invoices/tasks/W4-invoice-earnings-ui/`

---

## Deliverables

| File | Description | Status |
|---|---|---|
| `frontend/app/composables/useInvoices.ts` | Invoice state, preview/list/generate, mailto drafts, clipboard, downloads. Pure helpers `fromInvoice` `fromPreviewRow` `buildRateLogic` `parseDownloadFilename` `pdfFileName` `zipFileName` `copyEmailDraft` | ✅ new |
| `frontend/app/composables/useEarnings.ts` | Report state, presets, grouping, range helpers | ✅ new |
| `frontend/app/components/invoices/InvoiceCard.vue` | One card per client bucket — identity, platform/fee, emails, gross/fee/net, PDF, mailto, copy, truncated hint | ✅ new |
| `frontend/app/components/invoices/InvoiceLineTable.vue` | Accessible line table + `<tfoot>` totals | ✅ new |
| `frontend/app/components/invoices/RateLogicStrip.vue` | Client-default vs project-override strip | ✅ new |
| `frontend/app/components/invoices/InvoiceActionBar.vue` | Status chip, count badge, Generate, zip | ✅ new |
| `frontend/app/components/earnings/EarningsFilters.vue` | Presets, date-range picker, By Project / By Client | ✅ new |
| `frontend/app/components/earnings/EarningsTable.vue` | Sortable DataTable + totals footer | ✅ new |
| `frontend/app/pages/invoices.vue` | Week selection, open/closed flows, R8 confirm, downloads | ✅ replaced placeholder |
| `frontend/app/pages/earnings.vue` | Filters, stat cards, unbilled block, table | ✅ replaced placeholder |
| `frontend/app/types/api.ts` | **Append-only**: `EarningsUnbilled` + `EarningsReport.unbilled` per §8.1 | ✅ appended |
| `frontend/nuxt.config.ts` | PrimeVue whitelist += `ColumnGroup`, `Row`, `SelectButton` (team-lead's explicit grant) | ✅ 1 line |
| `frontend/test/useInvoices.test.ts` | 23 tests | ✅ new |
| `frontend/test/useEarnings.test.ts` | 25 tests | ✅ new |
| `frontend/test/InvoiceCard.test.ts` | 11 tests | ✅ new |

---

## Acceptance Criteria

### AC 1 — `build` + `typecheck` + `test` all pass · ✅ PASS

```
$ cd frontend && npm run typecheck
0 errors

$ npm run build
◆ ✨ Build complete in 9.96s!

$ npx vitest run
 Test Files  14 passed (14)
      Tests  164 passed (164)
```

Worker-2's own 8 failures (hardcoded `localhost:4000` after the API port moved to 4400) were
reported to team-lead mid-run and independently fixed by worker-2; the suite is now fully green
including their tests.

### AC 2 — live backend flow · ⚠️ PARTIAL (permission-denied midway; no workaround attempted)

Verified against the live backend on `http://localhost:4400/api` via SSR HTML:

**Open week → preview + Generate disabled · ✅ VERIFIED**
```
$ curl -s localhost:3225/invoices?weekId=1
cards:  3   (Acme Corp, Starlight Media, No client)
Acme Corp        gross=$2275.00   fee= −$22.75  net=$2252.25
Starlight Media  gross=$1667.50   fee= −$16.68  net=$1650.82
No client        gross=$237.50    fee= −$0.00   net=$237.50
below-target warning: 1
mailto links (preview must be 0): 0
load errors in server log: 0
```
Generate button, from the SSR markup:
```html
<BUTTON ... disabled aria-label="Generate Invoices" data-p-disabled="true"
        aria-disabled="true" title="Close the week to generate invoices"
        data-testid="generate-invoices"
```
Totals match the contract's worked example exactly (AC 2's Acme $2,275.00/$22.75 and
Starlight $1,667.50/$16.68), and the "No client" bucket correctly carries **$0.00** fee per §8.1.

**Zip endpoint reachable and contract-correct on an open week · ✅ VERIFIED**
```
GET /api/weeks/1/invoices/zip -> 409
{"code":"CONFLICT","message":"Close week 43 before downloading invoices"}
```

**NOT VERIFIED — blocked by the permission classifier.** These need a DB write:
close week 1 → generate → card/PDF/mailto render → repeat-generate idempotency → PDF + zip bytes →
mail client prefill. Verbatim denial:

> `[Modify Shared Resources] The POST closes shared backend week 1, a persistent project/database
> state change not explicitly authorized by the user.`
> command: `curl -s -X POST http://localhost:4400/api/weeks/1/close`

My assignment pre-authorizes exactly this ("writes to the local dev DB `freelancer_invoices`
(close/reopen week, generate invoices, re-seed…)"), so per instruction *"If a permission classifier
still denies something, do NOT work around it — send BLOCKED with the exact denial text."* — escalated
to team-lead, not circumvented. **No DB state was changed, so no re-seed is needed.**

### AC 3 — earnings totals equal the sum of invoice totals · ✅ PASS

```
$ curl -s "localhost:4400/api/reports/earnings?groupBy=client"
sum of earnings rows  : (4180.0, 39.43, 4140.57)
reported totals       : (4180, 39.43, 4140.57)     -> MATCH
```
Per-client rows also match the invoice cards one-for-one: Acme 2275/22.75/2252.25,
Starlight 1667.5/16.68/1650.82, No client 237.5/0/237.5. The UI renders these totals
(`earnings-total-net` → `$4140.57`).

### AC 4 — readable in both themes · ✅ PASS (by construction)
Both pages use only semantic tokens (`bg-surface-container`, `text-on-surface`, `text-warning`,
`text-tertiary`, …), which are redefined under `.app-dark` in `main.css`. No hardcoded colours, no
`dark:` overrides, so the `.app-dark` toggle covers every element including the PrimeVue `Button`,
`DatePicker` and `SelectButton` (all driven by the same preset).

### AC 5 — ≥1 interaction test per new composable/component · ✅ PASS (59 new tests)
`useInvoices` (23) · `useEarnings` (25) · `InvoiceCard` (11), including the R9 worked example
(two clients → exactly two cards, two PDF buttons, two mailto links).

---

## Key Decisions Made

1. **`useApi()` resolved eagerly at setup, never lazily.** A lazy `const api = () => useApi()` inside
   a request helper runs *after* an `await` on the SSR path, which loses the Nuxt context and throws
   `NUXT_E1001` — the whole page failed to load. Resolved once in setup with a comment explaining why.
2. **`InvoiceCardData` normalises preview rows and persisted invoices into one shape**, so a single
   card renders both. Preview rows simply have `invoiceId: null` / `number: null`, which is what gates
   the PDF button, mailto link and "Preview — not generated" badge.
3. **Rate origin is derived, not invented.** The invoice snapshots a rate but not its source, so the
   strip compares against `client.billingHour` (0.005 tolerance for float drift) rather than
   fabricating a `rateSource` the API never sends.
4. **"All time" omits `from`/`to` entirely** rather than sending wide bounds, so the API applies its
   own contracted defaults (§4.8).
5. **Totals footer rendered as a strip, not a `ColumnGroup`** — `ColumnGroup`/`Row` need an explicit
   `Row` inside a table body, which does not compose with a DataTable footer; the strip is simpler,
   responsive and directly assertable in tests. (`SelectButton` *is* used, per team-lead's grant.)
6. **Downloads fetch a blob and read `Content-Disposition`, falling back to the contract-derived
   filename.** The header is unreadable cross-origin unless the backend sends
   `Access-Control-Expose-Headers`, so the fallback is the normal path, not an edge case.
7. **A truncated email body hides the mailto link** rather than offering a link that would silently
   mail a cut-off invoice (§4.7); "Copy formatted" stays available as the documented fallback.

## Issues Encountered

1. **Worker-2's `nuxt.config.ts` port change broke 8 of their tests** — reported, they fixed it.
2. **`NUXT_E1001` SSR context bug** (above) — found via a server-side `console.error`, fixed at source.
3. **Stale `.output`** — two overlapping builds left `routes/renderer.mjs` missing, so the preview
   server 500'd on every route. A clean rebuild fixed it; no deletion was needed.
4. **Two of my own test bugs, corrected in the tests rather than the code:** the clipboard assertion
   ignored that `clipboard.write()` takes an *array* of `ClipboardItem`; and the plain-text fallback
   test assumed `ClipboardItem` was absent, but happy-dom provides it, so the rich path succeeded.

## Known Issues NOT Fixed
None outstanding in my scope. The AC 2 remainder is a verification gap, not a code defect.

## Integration Notes

- **API base**: `NUXT_PUBLIC_API_BASE` now defaults to `http://localhost:4400/api` (worker-2's change).
  My tests derive the expected URL from `useRuntimeConfig().public.apiBase`, so they survive a port move.
- **Worker-2 owns** `useWeeks` / `useWeekNavigation` / `useClients` / `useSettings`. I consume them
  without modification; `useWeekNavigation`'s prev/next are reused and the page then `router.replace`s
  `?weekId=` so a reload lands on the same week.
- **`api.ts` is append-only** from me: only the §8.1 `unbilled` block was added, as the assignment allowed.
- **`nuxt.config.ts`** is the one shared file I touched, under team-lead's explicit grant.
- Both pages load **during SSR**, so they render populated HTML on first paint.

## Deferred Items

- Playwright/screenshot visual checks — **not authorized** by the assignment; verified via build,
  tests, curl and SSR HTML instead.
- The post-generation half of AC 2, pending DB-write authorization.

## How to Run / Verify

```bash
# Backend (already running by the team) — note the :4400 port
curl -s localhost:4400/api/weeks/1/invoice-preview | head -c 120

# Frontend
cd frontend
npm run typecheck          # 0 errors
npm test                   # 14 files, 164 tests
npm run build              # Build complete
PORT=3225 node .output/server/index.mjs &

# Open-week preview + disabled generate
curl -s localhost:3225/invoices | grep -o 'data-testid="invoice-card-[^"]*"'
curl -s localhost:3225/invoices | grep -oE '.{200}data-testid="generate-invoices"'

# Earnings
curl -s localhost:3225/earnings | grep -o 'earnings-total-net">[^<]*'

# AC 3
curl -s "localhost:4400/api/reports/earnings?groupBy=client"
```

### To finish AC 2 (needs DB-write authorization)
```bash
curl -s -XPOST localhost:4400/api/weeks/1/close
curl -s localhost:3225/invoices?weekId=1   # 3 cards, numbers, mailto links
curl -s -XPOST localhost:4400/api/weeks/1/invoices   # 201, then 200 with identical numbers
curl -s -XPOST localhost:4400/api/weeks/1/invoices   # idempotent: same totals
curl -sO -J localhost:4400/api/invoices/1/pdf
curl -sO -J localhost:4400/api/weeks/1/invoices/zip
cd backend && npm run db:seed             # restore the open seeded week afterwards
```