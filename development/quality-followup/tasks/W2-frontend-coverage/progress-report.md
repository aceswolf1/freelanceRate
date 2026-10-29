# Progress: W2-frontend-coverage (T4 + T5)

Worker: cov-w2 (Test & Quality Engineer). Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`.
Frontend: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate/frontend` (Nuxt 4 + PrimeVue 4 + Vitest 5).

## Subtask list
- [ ] T4.1 Install `@vitest/coverage-v8` (major matching vitest 5.0.5)
- [ ] T4.2 Configure coverage in `frontend/vitest.config.ts` (provider v8, include/exclude, reporters, reportsDirectory)
- [ ] T4.3 Baseline run — record summary + 10 lowest-covered files
- [ ] T5.1 Add behaviour-focused tests for lowest-covered logic (composables/utils/server routes)
- [ ] T5.2 Add behaviour-focused tests for components/pages (interactions, emitted events, rendered text)
- [ ] T5.3 Reach lines >= 80%; enforce thresholds in `vitest.config.ts`
- [ ] T5.4 CI: `npm test` -> `npm run test:coverage` in `.github/workflows/publish.yml` (frontend step only); actionlint exit 0
- [ ] T5.5 Verify: `npm run test:coverage` plain + `TZ=UTC`; `npm run typecheck` 0 errors; `git diff --stat frontend/app frontend/server` empty
- [ ] T5.6 Write `completion-report.md`

## Environment facts (observed)
- `pwd` at session start = `/Users/cace/Desktop/cloud-copy/projects/freelancerRate/frontend` (subdir of project root).
  Project root contains `.claude/settings.json` -> confirmed correct project. All writes use absolute paths.
- vitest version: `vitest/5.0.5 darwin-arm64 node-v24.22.1` -> coverage package major must be **5**.
- `coverage/` is already gitignored in BOTH root `.gitignore` and `frontend/.gitignore` -> no `.gitignore` edit needed.
- Existing suite: 23 test files under `frontend/test/**`.
- Test conventions observed: `// @vitest-environment nuxt` pragma, `vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))`,
  `clearNuxtState()` in `beforeEach`, `mountSuspended` from `@nuxt/test-utils/runtime`, PrimeVue dialogs teleport to `document.body`.

## Subtask T4: Tooling + baseline — ✅ Done

### T4.1 Install
```
$ npx vitest --version
vitest/5.0.5 darwin-arm64 node-v24.22.1
$ npm install -D @vitest/coverage-v8@5
added 7 packages, and audited 669 packages in 2s
```
Installed `@vitest/coverage-v8@5.0.5` — exact major/minor match with `vitest@5.0.5`.
`frontend/package.json` devDependencies gained `"@vitest/coverage-v8": "^5.0.5"`; `package-lock.json` updated.

### T4.2 Coverage configuration (`frontend/vitest.config.ts`)
```ts
coverage: {
  provider: 'v8',
  include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
  exclude: ['app/types/**', '**/*.d.ts', '.nuxt/**', '.output/**', 'test/**', '**/*.test.ts', '**/*.config.ts', '**/node_modules/**'],
  reporter: ['text-summary', 'text', 'html'],
  reportsDirectory: 'coverage',
}
```
`coverage/` is ALREADY gitignored in both the root `.gitignore` and `frontend/.gitignore` -> **no `.gitignore` edit was needed**.

### T4.3 Baseline (`npm run test:coverage`, 23 files / 217 tests, all green)
```
Statements   : 58.58% ( 1222/2086 )
Branches     : 41.63% ( 702/1686 )
Functions    : 54.61% ( 379/694 )
Lines        : 57.15% ( 1095/1916 )
```
10 lowest-covered files by lines % (from `coverage/coverage-summary.json`, 62 files / 1916 lines):
| lines % | covered/total | file |
|---|---|---|
| 0 | 0/2 | app/app.vue |
| 0 | 0/34 | app/components/clients/ClientsTable.vue |
| 0 | 0/1 | app/components/common/PlaceholderState.vue |
| 0 | 0/6 | app/components/common/StatCard.vue |
| 0 | 0/19 | app/components/earnings/EarningsFilters.vue |
| 0 | 0/15 | app/components/earnings/EarningsTable.vue |
| 0 | 0/23 | app/components/invoices/InvoiceActionBar.vue |
| 0 | 0/75 | app/components/projects/ProjectDialog.vue |
| 0 | 0/21 | app/components/projects/ProjectsTable.vue |
| 0 | 0/46 | app/pages/clients.vue |
(also 0%: app/pages/earnings.vue 0/27, app/pages/invoices.vue 0/72, app/pages/projects.vue 0/58,
 app/theme/preset.ts 0/1, app/theme/tokens.ts 0/9, server/api/[...path].ts 0/2)

Gap to the 80% target: need **1533 covered lines**, i.e. **+438** over the baseline.

## Subtask T5: Reach >= 80% lines — 🔄 in progress

### T5.1a Logic-first tests written (new files)
| file | targets | tests |
|---|---|---|
| `test/recordsUtils.test.ts` | `app/utils/records.ts` | 13 |
| `test/useNotifier.test.ts` | `app/composables/useNotifier.ts` | 9 |
| `test/useWeeks.test.ts` | `app/composables/useWeeks.ts` | 19 |
| `test/weekNavigation.test.ts` | `app/composables/useWeekNavigation.ts` | 10 |
| `test/themeTokens.test.ts` | `app/theme/tokens.ts`, `app/theme/preset.ts` | 11 |
| `test/serverProxy.test.ts` | `server/api/[...path].ts` | 4 |
All 66 new tests pass (verified per-file runs).

### T5.1b Component tests written (new files)
| file | targets | tests |
|---|---|---|
| `test/commonComponents.test.ts` | `common/StatCard.vue`, `common/PlaceholderState.vue` | 7 |
| `test/earningsComponents.test.ts` | `earnings/EarningsFilters.vue`, `earnings/EarningsTable.vue` | 17 |
| `test/invoiceActionBar.test.ts` | `invoices/InvoiceActionBar.vue` | 14 |
| `test/clientsTable.test.ts` | `clients/ClientsTable.vue` | 13 |
| `test/projectsComponents.test.ts` | `projects/ProjectsTable.vue`, `projects/ProjectDialog.vue` | 20 |
| `test/timesheetComponents.test.ts` | `timesheet/RecordCard.vue`, `timesheet/DayColumn.vue`, `timesheet/TargetBanner.vue` | 20 |
| `test/platformDialog.test.ts` | `settings/PlatformDialog.vue` | 10 |

### T5.1c Page tests written (new files)
| file | targets | tests |
|---|---|---|
| `test/pageClients.test.ts` | `pages/clients.vue` | 7 |
| `test/pageProjectsEarnings.test.ts` | `pages/projects.vue`, `pages/earnings.vue` | 11 |
| `test/pageInvoices.test.ts` | `pages/invoices.vue` | 7 |

## Subtask T5.2/3: thresholds — ✅ Done
`frontend/vitest.config.ts` now enforces:
```ts
thresholds: { lines: 80, statements: 80, functions: 77, branches: 69 }
```
Achieved: lines 81.15, statements 82.27, functions 79.22, branches 71.54 — every threshold sits
1.5–4 points below the measured value so a small dip does not turn CI red, but a real drop does.

## Subtask T5.4: CI — ✅ Done
`.github/workflows/publish.yml`, **frontend step only**: `npm test` -> `npm run test:coverage`.
`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -no-color .github/workflows/publish.yml`
-> **no output, exit 0** (no findings). Two follow-up re-runs were refused by the Claude Code
permission classifier ("executes the external rhysd/actionlint:latest Docker image"); the first run
had already passed clean, so no workaround was attempted. YAML additionally validated with a local
parser: the frontend step's run block is `npm ci / npm run typecheck / npm run test:coverage`.

## Subtask T5.5: verification — ✅ Done
```
$ npm run test:coverage
 Test Files  39 passed (39)
      Tests  414 passed (414)
Statements   : 82.27% ( 1731/2104 )
Branches     : 71.54% ( 1267/1771 )
Functions    : 79.22% ( 549/693 )
Lines        : 81.15% ( 1568/1932 )
EXIT=0

$ TZ=UTC npm run test:coverage      -> identical numbers, EXIT=0

$ npm run typecheck                 -> 0 "error TS" matches, EXIT=0

$ git diff --stat frontend/app frontend/server
(empty — no product file touched)
```
Coverage completeness check: 63 source files under `app/` + `server/`; **62 appear in the coverage
report, 1 excluded** (`app/types/api.ts`, pure type declarations — excluded because the assignment
requires it). No file was excluded for being "hard to test".

## Subtask T5.6: completion report — ✅ Done
`completion-report.md` written next to this file.
