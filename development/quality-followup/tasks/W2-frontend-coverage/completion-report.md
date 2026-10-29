# Completion Report — W2-frontend-coverage (T4 tooling + T5 coverage)

Worker: **cov-w2** (Test & Quality Engineer) · Plan: `quality-followup` · Date: 2026-10-28
Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` · Frontend: `frontend/`

---

## 1. Deliverables

| File | Description | Status |
|---|---|---|
| `frontend/package.json` | added devDependency `"@vitest/coverage-v8": "^5.0.5"` | ✅ |
| `frontend/package-lock.json` | lockfile updated by `npm install -D @vitest/coverage-v8@5` | ✅ |
| `frontend/vitest.config.ts` | coverage provider/ include / exclude / reporters / reportsDirectory + thresholds | ✅ |
| `.github/workflows/publish.yml` | frontend test step `npm test` → `npm run test:coverage` (only that step) | ✅ |
| `frontend/test/recordsUtils.test.ts` | NEW — `app/utils/records.ts` | ✅ |
| `frontend/test/useNotifier.test.ts` | NEW — `app/composables/useNotifier.ts` | ✅ |
| `frontend/test/useWeeks.test.ts` | NEW — `app/composables/useWeeks.ts` | ✅ |
| `frontend/test/weekNavigation.test.ts` | NEW — `app/composables/useWeekNavigation.ts` | ✅ |
| `frontend/test/themeTokens.test.ts` | NEW — `app/theme/tokens.ts` + `app/theme/preset.ts` | ✅ |
| `frontend/test/serverProxy.test.ts` | NEW — `server/api/[...path].ts` | ✅ |
| `frontend/test/commonComponents.test.ts` | NEW — `common/StatCard.vue`, `common/PlaceholderState.vue` | ✅ |
| `frontend/test/earningsComponents.test.ts` | NEW — `earnings/EarningsFilters.vue`, `earnings/EarningsTable.vue` | ✅ |
| `frontend/test/invoiceActionBar.test.ts` | NEW — `invoices/InvoiceActionBar.vue` | ✅ |
| `frontend/test/clientsTable.test.ts` | NEW — `clients/ClientsTable.vue` | ✅ |
| `frontend/test/projectsComponents.test.ts` | NEW — `projects/ProjectsTable.vue`, `projects/ProjectDialog.vue` | ✅ |
| `frontend/test/timesheetComponents.test.ts` | NEW — `timesheet/RecordCard.vue`, `DayColumn.vue`, `TargetBanner.vue` | ✅ |
| `frontend/test/platformDialog.test.ts` | NEW — `settings/PlatformDialog.vue` | ✅ |
| `frontend/test/pageClients.test.ts` | NEW — `pages/clients.vue` | ✅ |
| `frontend/test/pageProjectsEarnings.test.ts` | NEW — `pages/projects.vue`, `pages/earnings.vue` | ✅ |
| `frontend/test/pageInvoices.test.ts` | NEW — `pages/invoices.vue` | ✅ |
| root `.gitignore` | **not modified** — `coverage/` was already ignored in both the root and `frontend/.gitignore` | ✅ (no-op) |

No file under `frontend/app/**` or `frontend/server/**` was touched.

---

## 2. Coverage: baseline → final

| metric | baseline (T4) | final (T5) | threshold enforced | headroom |
|---|---|---|---|---|
| **Lines** | 57.15 % (1095/1916) | **81.15 % (1568/1932)** | **80** | +1.15 |
| Statements | 58.58 % (1222/2086) | 82.27 % (1731/2104) | 80 | +2.27 |
| Functions | 54.61 % (379/694) | 79.22 % (549/693) | 77 | +2.22 |
| Branches | 41.63 % (702/1686) | 71.54 % (1267/1771) | 69 | +2.54 |

Suite size: **23 files / 217 tests → 39 files / 414 tests** (+16 files, +197 tests). No pre-existing test was modified or removed.

**Baseline — 10 lowest-covered files** (from `coverage/coverage-summary.json`):

| lines % | covered/total | file |
|---|---|---|
| 0 | 0/2 | `app/app.vue` |
| 0 | 0/34 | `app/components/clients/ClientsTable.vue` |
| 0 | 0/1 | `app/components/common/PlaceholderState.vue` |
| 0 | 0/6 | `app/components/common/StatCard.vue` |
| 0 | 0/19 | `app/components/earnings/EarningsFilters.vue` |
| 0 | 0/15 | `app/components/earnings/EarningsTable.vue` |
| 0 | 0/23 | `app/components/invoices/InvoiceActionBar.vue` |
| 0 | 0/75 | `app/components/projects/ProjectDialog.vue` |
| 0 | 0/21 | `app/components/projects/ProjectsTable.vue` |
| 0 | 0/46 | `app/pages/clients.vue` |

(also 0 % at baseline: `app/pages/earnings.vue`, `app/pages/invoices.vue`, `app/pages/projects.vue`,
`app/theme/preset.ts`, `app/theme/tokens.ts`, `server/api/[...path].ts`)

**Final — 10 lowest-covered files** (48 of 62 files are now ≥ 80 %):

| lines % | covered/total | file |
|---|---|---|
| 0 | 0/2 | `app/app.vue` |
| 48.48 | 32/66 | `app/pages/index.vue` |
| 50 | 9/18 | `app/components/settings/PaymentPlatformsTable.vue` |
| 51.09 | 70/137 | `app/components/timesheet/RecordDrawer.vue` |
| 61.11 | 44/72 | `app/pages/invoices.vue` |
| 67.85 | 76/112 | `app/pages/settings.vue` |
| 68.75 | 11/16 | `app/components/layout/AppHeader.vue` |
| 70 | 14/20 | `app/components/timesheet/WeekHeader.vue` |
| 76.19 | 48/63 | `app/pages/projects.vue` |
| 76.54 | 62/81 | `app/components/clients/ClientDialog.vue` |

---

## 3. Exclusions

`frontend/vitest.config.ts`:

```ts
coverage: {
  provider: 'v8',
  include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
  exclude: [
    'app/types/**',   // pure TypeScript type declarations — no runtime code
    '**/*.d.ts',
    '.nuxt/**',
    '.output/**',
    'test/**',        // the test suite itself is never part of the product
    '**/*.test.ts',
    '**/*.config.ts',
    '**/node_modules/**',
  ],
  reporter: ['text-summary', 'text', 'html'],
  reportsDirectory: 'coverage',
  thresholds: { lines: 80, statements: 80, functions: 77, branches: 69 },
}
```

**Effective exclusions of product code: exactly one — `app/types/api.ts`.** It contains only type
aliases and two `const` enumerations (`API_ERROR_CODES`, `EXPECTED_ERROR_STATUSES`) that are already
asserted through `app/composables/useApi.ts`, and the assignment requires `app/types/**` to be
excluded. Every other pattern in the list is a no-op against the `include` globs.

Verified mechanically — 63 source files exist under `app/` + `server/`, **62 appear in the coverage
report, 1 is excluded** (`app/types/api.ts`):

```
source files under app/ + server/: 63
present in coverage report : 62
excluded from coverage     : 1 ["app/types/api.ts"]
```

**No file was excluded because it was "hard to test".**

---

## 4. Key decisions made

1. **`@vitest/coverage-v8@5`** — matched to the installed `vitest@5.0.5` exactly (major mismatch is
   the documented failure mode). Installed with `npm install -D`, which the user explicitly
   authorised.
2. **No `.gitignore` edit** — `coverage/` is already ignored by the root `.gitignore` and by
   `frontend/.gitignore`; the assignment allows that one-line edit only "if needed", and it was not.
3. **Thresholds set 1.5–4 points below the measured values** (lines 80 / statements 80 / functions
   77 / branches 69) so a small coverage wobble does not turn CI red while a real regression does.
   `lines: 80` is the contract value.
4. **`vi.mock('primevue/useconfirm')`** for the three pages that delete through a confirmation
   dialog. The mock captures the confirmation *contract* (message text, accept/reject labels) so the
   test asserts what the user is actually asked, instead of driving PrimeVue's teleported
   `ConfirmDialog`.
5. **`vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))` everywhere**, per the established
   convention — stubbing `$fetch` keeps real HTTP out of the suite.
6. **Rejection paths need `flushPromises()`, not `nextTick()`** — the `useApi` error path adds
   microtask turns (the `catch` block rethrows), so `nextTick()` alone left the error assertion
   racing the render. Every error-path assertion now uses `flushPromises()` + `nextTick()`.
7. **Wrappers are unmounted in `afterEach` before the DOM is wiped** — clearing `document.body`
   while a teleported PrimeVue dialog was still mounted produced
   `TypeError: Cannot read properties of null (reading 'insertBefore')` on the *next* test.
8. **`server/api/[...path].ts` is exercised with `defineEventHandler` / `proxyRequest` stubbed** —
   they are Nitro/h3 auto-imports that do not exist in the unit-test environment. The real handler
   body (runtime config → `toBackendUrl` → proxy) still runs.

---

## 5. Issues encountered (all resolved)

| # | Issue | Classification | Resolution |
|---|---|---|---|
| 1 | `useNotifier`/`useWeeks` assertions failed on Vue's own `inject() can only be used inside setup()` warning, which also goes to `console.warn` | TEST-ENV | Assertions now filter the console output for the app's own `[toast:…]` prefix instead of asserting `console.warn` was never called. |
| 2 | `formatMoney` does not group thousands (`$2015.00`, not `$2,015.00`) | TEST (my expectation was wrong) | Expectations corrected to the formatter's real contract (already asserted in `test/format.test.ts`). |
| 3 | `InvoiceActionBar` tooltip: the "invoices already exist" branch precedes the "close the week" branch | TEST (my expectation was wrong) | Test props were corrected so each tooltip branch is reached with the state that actually produces it. |
| 4 | `ProjectsTable` override badge showed `$0.00` | TEST (my fixture was wrong) | The fixture used a `ProjectSummary` where the component reads `client.billingHour`; the fixture now uses a full `ClientSummary`. |
| 5 | `ProjectDialog` / `PlatformDialog` error assertions raced the render | TEST-ENV (timing) | Switched to `flushPromises()`; see decision 6. |
| 6 | `TypeError: Cannot read properties of null (reading 'insertBefore')` between tests | TEST-ENV (lifecycle) | See decision 7. |
| 7 | `PlatformDialog` "Could not save the payment platform." branch never rendered | BUG-adjacent (see §6, finding 2) | The test now asserts the behaviour that actually occurs (`useApi` wraps every failure in an `ApiError`). |
| 8 | Two follow-up `docker run … actionlint` invocations were refused by the Claude Code permission classifier ("executes the external `rhysd/actionlint:latest` Docker image") | PERMISSION | The first invocation of the assignment's exact command already completed clean (no output, exit 0). No workaround was attempted; the workflow was additionally validated with a local YAML parser. |

---

## 6. Known issues NOT fixed (GAPs)

**No product bug that changes observable behaviour was found.** The tests assert the shipped
contract throughout. Two code-level observations are reported for the lead to triage:

### GAP-1 — `ProjectDialog` has an unreachable error branch (dead code, not a defect)
* **File:** `frontend/app/components/projects/ProjectDialog.vue`, lines 151–159
* **Repro:** make `POST /api/projects` fail (any transport or HTTP error) and submit the dialog.
  `useApi.request()` always rethrows an `ApiError`, so `error instanceof ApiError` is always true
  and the `else { submitError.value = 'Could not save the project.' }` branch can never run.
  The user sees the raw API message (e.g. `socket hang up`) instead of the friendly sentence.
* **Impact:** cosmetic — the fallback copy exists but is unreachable. The same pattern is in
  `frontend/app/components/settings/PlatformDialog.vue` (line 109).
* **Evidence:** `test/projectsComponents.test.ts` → "shows the failure message when the API is
  unreachable" asserts the message that is actually shown.

### GAP-2 — `useWeeks.load()` couples two different "silent" switches
* **File:** `frontend/app/composables/useWeeks.ts`, lines 34 and 40
* **Repro:** call `load()` with no options against a down API. The request itself is sent with
  `silent: true` (line 34, `options.silent ?? true`) so `useApi` raises no global toast — but the
  catch block then raises its own "Could not load the current week" toast because
  `!options.silent` is true for `undefined`. `load({ silent: true })` suppresses both.
* **Impact:** one toast, not two — so no user-visible defect. It is worth knowing that `silent`
  controls two different things, because a future caller may expect `load()` to be quiet.
* **Evidence:** `test/useWeeks.test.ts` → "keeps the placeholder and tells the user when the API is
  down" / "suppresses the message when the caller asked for a silent load".

### Coverage still below 80 % on 14 files (not bugs — work not done)
`app/app.vue` (0/2, the Nuxt root shell), `app/pages/index.vue` (32/66, the timesheet page),
`app/components/settings/PaymentPlatformsTable.vue` (9/18),
`app/components/timesheet/RecordDrawer.vue` (70/137 — partially covered by the pre-existing
GAP-004 regression test), `app/pages/invoices.vue` (44/72),
`app/pages/settings.vue` (76/112), `app/components/layout/AppHeader.vue` (11/16),
`app/components/timesheet/WeekHeader.vue` (14/20), `app/pages/projects.vue` (48/63),
`app/components/clients/ClientDialog.vue` (62/81), `app/pages/earnings.vue` (23/30),
`app/pages/clients.vue` (37/47), `app/composables/useInvoices.ts` (124/157),
`app/layouts/default.vue` (31/39).
`app/app.vue` is the two-line Nuxt root shell with no logic — it is the only file at 0 %.

---

## 7. Integration notes

* **No product code changed.** `git diff --stat frontend/app frontend/server` is empty.
* **The only shared file I touched outside `frontend/` is `.github/workflows/publish.yml`** — the
  frontend test step only. The backend step, the `build` job and the `merge` job are untouched.
* Worker-1 owns `e2e/**`; none of my changes touch it. The `e2e/` modifications visible in
  `git status` are worker-1's, not mine.
* The frontend test step now enforces coverage in CI, so **any future frontend PR that drops below
  80 % lines will fail CI**. That is the intended effect.
* `frontend/package.json` gained one devDependency; `npm ci` in CI will pick it up from the
  committed `package-lock.json`.

---

## 8. Deferred items

* `app/pages/index.vue` (the timesheet page, 32/66) and `app/pages/settings.vue` (76/112) are the
  two largest remaining gaps; both are page-level compositions that are covered by the E2E suite in
  `e2e/`. Reaching them would need a dedicated page-test pass — out of scope for this task's
  budget, but they are the first place to look if the coverage target is raised.
* `RecordDrawer.vue` (70/137) is a 498-line component with a large amount of form logic; only the
  GAP-004 regression path is covered today.

---

## 9. How to run / verify

```bash
cd /Users/cace/Desktop/cloud-copy/projects/freelancerRate/frontend

# Full suite with coverage + threshold enforcement
npm run test:coverage
#   Test Files  39 passed (39)
#        Tests  414 passed (414)
#   Statements   : 82.27% ( 1731/2104 )
#   Branches     : 71.54% ( 1267/1771 )
#   Functions    : 79.22% ( 549/693 )
#   Lines        : 81.15% ( 1568/1932 )
#   exit code 0

# Same, in the timezone CI uses
TZ=UTC npm run test:coverage
#   identical numbers, exit code 0

# Types
npm run typecheck
#   0 "error TS" matches, exit code 0

# Product files untouched
git -C /Users/cace/Desktop/cloud-copy/projects/freelancerRate diff --stat frontend/app frontend/server
#   (empty output)

# CI workflow lint
cd /Users/cace/Desktop/cloud-copy/projects/freelancerRate
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -no-color .github/workflows/publish.yml
#   no output, exit code 0
```

**HTML coverage report:** `frontend/coverage/index.html` (gitignored).
