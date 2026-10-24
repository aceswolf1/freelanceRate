# Progress: W2-frontend (worker-2, Frontend Engineer)

Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`
Task dir: `development/freelancer-invoices/tasks/W2-frontend/`
Working dir note: session cwd = `.../development/freelancer-invoices` — all writes use absolute paths.

## Subtask list — ALL DONE
### Phase A — T4 Frontend shell
- [x] A1. Scaffold `frontend/`: Nuxt 4 + TS + `app/` dir
- [x] A2. PrimeVue preset from DESIGN.md tokens, dark + light
- [x] A3. `useTheme()` — `.app-dark`, localStorage, dark default, no-flash script
- [x] A4. `layouts/default.vue` — sidebar, active week card, nav, user card, header, responsive drawer
- [x] A5. `useApi.ts` — typed $fetch, envelope unwrap, `ApiError`, global toast
- [x] A6. `utils/format.ts` + unit tests
- [x] A7. Placeholder pages for every nav route
### Phase B — T5
- [x] B1. `app/types/api.ts` DTOs from the contract
- [x] B2. `/clients` + `useClients`
- [x] B3. `/projects` + `useProjects`
- [x] B4. `/settings` + payment platforms + `useSettings` / `usePaymentPlatforms`
### Phase C — T6 Weekly Timesheet
- [x] C1. Week header (prev/next, status, close/reopen, generate-invoices)
- [x] C2. Target banner + progress + projected value
- [x] C3. 7-day grid, weekend muted-but-insertable, today highlight, record cards
- [x] C4. Quick-add/edit drawer + delete
- [x] C5. Footer summary
### Verification
- [x] V1. `npm run build && npm run typecheck && npm test` — all pass
- [x] V2. Routes render live data in both themes (SSR-verified; screenshots deferred to QA per team-lead)
- [x] V3. Interaction tests per feature composable/component

---

## Stack
Nuxt 4.6.2 · **PrimeVue 4.5.5** (`@primeuix/themes` 1.2.5, `definePreset(Material)`) · Tailwind 4.3.3 via `@tailwindcss/vite` + `tailwindcss-primeui` · `@nuxt/fonts` (Geist + Geist Mono) · `@vueuse/nuxt` · `@nuxt/test-utils` + Vitest 5.
Backend base URL: `http://localhost:4400/api` (moved from `:4000`; `Local.app` owns `127.0.0.1:4000`).

**Deviations from the plan:** the only remaining one is Tailwind 4 via the Vite plugin rather than
`@nuxtjs/tailwindcss` (that module is Tailwind-3-only, and the assignment allowed either). The
notifier is named `useNotifier()` rather than `useToast()` because PrimeVue's Nuxt module
auto-imports its own `useToast`. The earlier "PrimeVue 5 instead of 4" deviation no longer applies —
see §PrimeVue 4 downgrade.

---

## Phase A — Frontend shell
Full detail is in the git history of this file's earlier revisions; summarised:
- `app/theme/tokens.ts` = single source of truth (violet/zinc/emerald/red/amber scales, radius `md = 8px` per DESIGN.md, 42 semantic tokens per scheme).
- `app/theme/preset.ts` = `definePreset(Material, …)` with `primitive.borderRadius`, `semantic.primary`, `semantic.focusRing` (2px violet, 2px offset) and full `colorScheme.light`/`dark`.
- `app/assets/css/main.css` re-exports the same 42 names as `--bf-*` and maps them into Tailwind via `@theme inline`, so the design HTML's classes work verbatim. `@custom-variant dark` binds to `.app-dark`, the same class PrimeVue's `darkModeSelector` uses.
- Light theme derived from DESIGN.md (dark-only): bg `#fafafa`, surfaces `#ffffff → #d4d4d8`, primary dropped to violet-600 `#7c3aed` for AA contrast.
- No theme flash: inline pre-paint script in `nuxt.config.ts` `app.head.script`.

## Phase B — Clients, Projects, Platforms, Settings
- `useClients` / `useProjects` / `usePaymentPlatforms` / `useSettings` — components stay presentational. Every list treats 404 as empty rather than an error, so the screens stay usable while a module is unmounted.
- Dialogs mirror the contract's validation client-side (name 1–120, email format, rate > 0 ≤ 10 000) and map backend errors onto fields.
- `ProjectDialog` mirrors the R2 rule: "Standalone" makes `billingHour` required; a sentinel id keeps the Select's `null` unambiguous and is stripped before it hits the wire.
- Deletes go through `ConfirmDialog`; a 409 becomes a calm warn toast carrying the backend's own message.
- Dropped from the design as out-of-scope (no endpoint backs them): clients' rate-distribution chart and "compliance" card, projects' "Total Billed YTD" and "Blended Realized Rate".

**Contract correction (accepted):** §1.5 says `VALIDATION_ERROR.details` is `Array<{path,message}>`, which my Phase A handler did not expect — inline form errors would have silently never rendered. `toFieldErrors()` now normalises the array form, takes the last segment of a nested Zod path, and keeps the first error per field. **Confirmed against the live backend**: `POST /api/clients` with a bad email returns exactly `details: [{path:"contactEmail", message:"Must be a valid email address"}]`.

## Phase C — Weekly Timesheet
- `useRecords` (create/update/delete + week refetch), `useWeekNavigation` (prev/next via `/weeks/by-date/:date`, close/reopen), `utils/records.ts` (per-client accent, override detection).
- `withRecord` / `withoutRecord` / `totalsFromDays` are pure and **immutable** — totals are always recomputed from the record list, so they cannot drift from what is displayed.
- Sat/Sun are muted with a dashed border and a grey header but keep their add button: weekend work is insertable (R6). `readOnly` (week closed) is the only thing that hides it (R7).
- Drawer clamps the date input to the week's Mon–Sun range, filters projects by the chosen client, and shows a rate badge that flags project overrides.
- Header "Add Time" and the per-day buttons raise one shared request via `useQuickAdd`.

**Bug caught by the new tests before it shipped:** `withRecord` replaced a record in place when only its *date* changed, leaving a stale copy in the original day column. Now it removes the record from every day and re-inserts into the day matching its date.

---

## Verification

### AC-1 — build + typecheck + test
```
$ npm run build      → Build complete in 8.24s!
$ npm run typecheck  → no TS errors
$ npm test           → Test Files 14 passed (14)   Tests 164 passed (164)
```
(14 files / 164 tests includes worker-4's suites. Mine: format, theme, api, nav, useTheme, ThemeToggle, clients, projects, settings, records, weekTransforms = 105.)

### AC-3 — Clients CRUD against the live API
```
POST /api/clients            → 201 (id=3)
POST /api/clients (bad email)→ 400 VALIDATION_ERROR
                                details: [{"path":"contactEmail","message":"Must be a valid email address"}]
PATCH /api/clients/3         → 200
DELETE /api/clients/1        → 409 CONFLICT
                                "Client cannot be deleted — still referenced by 2 projects"
                                details: {"projectCount":2}
DELETE /api/clients/3        → 200
GET  /api/clients            → ['Acme Corp', 'Starlight Media']  (no test residue)
```

### AC-4 — Timesheet against the live seeded week
```
GET /api/weeks/current → 200
  label    Week 43: 19-10-2026 – 25-10-2026   status open   isoWeek 43
  totals   34.5 hrs / 40 target | belowTarget=True by 5.5 | clients=2 records=12 gross=4180
  days     7   Mon 5.5h · Tue 7.0h · Wed 7.0h · Thu 6.0h · Fri 6.5h
                Sat 1.5h (weekend=True, 1 record)   Sun 1.0h (weekend=True, 1 record)
```
The seeded weekend entries prove weekend columns hold real records and are still insertable.

### AC-2 — every route renders live data (production build, real API)
```
$ npm run build && NITRO_PORT=3222 node .output/server/index.mjs
/          200   "Week 43: 19-10-2026 – 25-10-2026" · "34.5 / 40.0 hrs logged this week"
                  · "-5.5 hrs below target" · Acme Corp · Starlight Media · Standalone
/clients   200   #CLI-001 #CLI-002 · Acme Corp · Starlight Media · Payoneer · 130.00 · 100.00
/projects  200   #PRJ-001..004 · Internal Tools · Override ×2 · Inherited from ×2 · 95.00 · 115.00
/settings  200
```
The timesheet, clients and projects pages fetch during **SSR** (`useAsyncData` + `hydrate`), so the tables are populated on first paint instead of flashing an empty state.

### Test-suite note worth keeping
Composable tests must mock **`#build/fetch`** — `.nuxt/imports.d.ts` resolves the `$fetch` auto-import to that virtual module, so `vi.stubGlobal('$fetch')` or `vi.mock('ofetch')` silently lets real HTTP through to the live backend.

**Port changes must not touch tests.** When the backend moved to `:4400`, eight assertions that hardcoded `http://localhost:4000/api/...` failed. They now derive the base from `useRuntimeConfig().public.apiBase`:
```ts
let base: string
beforeEach(async () => {
  base = useRuntimeConfig().public.apiBase as string
  …
})
expect(fetchMock).toHaveBeenCalledWith(`${base}/clients`, …)
```
Proven port-independent: with the `nuxt.config.ts` default temporarily changed to `:9999`, `test/records.test.ts` still passes 6/6. Changing the port again requires no test edits.

---

## Known issues / NOT verified
1. **Record create/edit/delete in the live UI is NOT-VERIFIED.** The API-level contract is proven (and mocked end-to-end in `test/records.test.ts`), but exercising a write through the browser would mutate the shared seeded week, which my permission layer refused without explicit user consent. Repro to run when approved: open `/`, click *Add record* on a day, save, confirm the day column and totals update, then delete it.
2. **Closed-week read-only behaviour is NOT-VERIFIED live** for the same reason — closing the seeded week would block worker-3's invoice work. Covered by mocks (`isWeekClosedError`, drawer `readOnly`) only.
3. **Screenshots (AC-2/AC-5 visual check) deferred to QA** per team-lead; the Playwright block is being raised with the user. The script text is in §Deferred below so QA can reuse it.
4. `npm run dev` crashed its Vite SSR worker with `IPC connection closed` on this machine. The **production** build serves and SSRs correctly, and `npm run build` is clean, so this is a dev-server/Machine issue rather than an app defect — worth a look if another worker hits it.

## Deferred
- `frontend/scripts/screenshots.mjs` — written but **not committed** (permission block). QA can recreate it from this description: launch chromium, two contexts (dark/light) each seeding `localStorage['billflow:theme']`, visit `/`, `/clients`, `/projects`, `/settings` at 1440×960 @2x, `fullPage` screenshot each into `tasks/W2-frontend/screens/<slug>-<theme>.png`, and assert `document.documentElement.classList.contains('app-dark')` matches the requested theme.
- `pages/invoices.vue` and `pages/earnings.vue` are **worker-4's** — left untouched.

## Strategy Requests
- None outstanding. The screenshot block was escalated and is now resolved as "deferred to QA"; everything else cleared on plain retry.

---

## GAP-006/007 fix

### GAP-007 (HIGH) — the Settings form showed fallback values → saving overwrote real data
**Root cause (verified).** The layout's user card called `useProfile().load()` first, so `pending`
was already `true` when `settings.vue` issued its forced load. `useSettings.load()` began with
`if (pending.value || …) return settings.value` and therefore handed back the **fallback**
(`"Consultant"`) instead of awaiting the request already in flight. The form hydrated from that
fallback, and "Save All Changes" wrote "Consultant" over the stored "Alex Morgan" — silent data loss.

**Fix, in three layers:**
1. **A forced load awaits the in-flight request.** `useSettings` now keeps the in-flight promise and
   a forced load returns *that* promise instead of the current (fallback) state. It is module-scoped
   rather than `useState` because `useState` is serialised into the SSR payload and a Promise does
   not belong there; it is only shared on the client, where `load()` is called from lifecycle hooks,
   so concurrent SSR requests never share one.
2. **The form hydrates from the settings *state*, not from one snapshot.** A `watch` on `settings`
   re-hydrates whenever the real values arrive, and a pristine check (a snapshot of the last
   hydrated values) means a user edit is never clobbered.
3. **Save is disabled until the real settings have loaded** (`canSave = loaded`), with a defensive
   guard in `saveSettings()` that refuses to save a fallback-seeded form and warns instead.
4. **The settings are fetched during SSR** — in the layout *and* the page, sharing the key
   `bf:settings:ssr` so Nuxt dedupes the request. The form is hydrated *after* the fetch resolves,
   so the very first paint already shows the real values.

**Verified against the live backend (production build):**
```
GET /settings -> input renders  value="Alex Morgan"
                 sidebar card    data-testid="user-display-name">Alex Morgan
                 occurrences of  value="Consultant" : 0
```

### GAP-006 (MEDIUM) — literal template text in a column header
`PaymentPlatformsTable.vue` had `<Column header="Fee on {{formatMoney(1000, currencySymbol) }}" …>`,
a **static** attribute, so the braces rendered verbatim. Changed to
`:header="`Fee on ${formatMoney(1000, currencySymbol)}`"`.

I swept every `.vue` file for static attributes containing `{{`
(`grep -rnE '[a-zA-Z-]+="[^"]*\{\{' app/ --include="*.vue"`, excluding bound attributes) —
**that was the only occurrence**. The header now renders `Fee on $1000.00`.

### Regression tests — `frontend/test/settingsPage.test.ts` (5 tests)
- a forced load awaits an in-flight request: two concurrent `load()` calls both resolve with the
  **API** value, not the fallback
- the form shows the API value and Save is enabled once the settings load
- Save stays **disabled** when the real settings never load, so a fallback-seeded form can never be
  written back over the stored values
- pressing Save sends `displayName: "Alex Morgan"` — never "Consultant"
- the fee column header contains `Fee on $1000.00` and no `{{` / `}}`

### Verification
```
$ npm run typecheck   → no TS errors
$ npm test            → Test Files  18 passed (18)   Tests  184 passed (184)
$ npm run build       → ◆ ✨ Build complete in 7.54s!

$ NUXT_PUBLIC_API_BASE=http://localhost:4400/api PORT=3301 node .output/server/index.mjs
  GET /settings  -> input value="Alex Morgan"; sidebar "Alex Morgan"; value="Consultant" count 0
                    fee header "Fee on $1000.00"
  GET / /clients /projects /invoices /earnings -> all 200
  (server stopped afterwards; port 3301 free)
```

---

## GAP-004 fix — editing a record dropped its project (R5)

**Root cause (verified).** In `app/components/timesheet/RecordDrawer.vue` the open-watcher filled the
form with `Object.assign(form, { clientId, projectId, … })` and only *then* awaited
`refreshProjects()`. The `form.clientId` watcher fired in the gap, when `availableProjects` was
still empty, so `selectedProject` was `undefined` and it set `form.projectId = null`. Nothing re-ran
it once the projects arrived, so the drawer kept the null: "Pick a project for this entry.", a
$0.00 estimated total, and Save blocked until the user re-picked the project.

### Fix — belt-and-braces, order-independent
1. **`hydrating` flag.** Set while the form is populated from a record; the `form.clientId` watcher
   skips clearing during that window. It also compares old vs new client id, so a hand-made client
   change still drops an incompatible project.
2. **Re-apply after load.** Once `refreshProjects()` resolves, the record's `projectId` is re-applied
   if that project is still present, active and attached to the record's client — otherwise it is
   cleared (the project really is gone).
3. **Rate fallback.** `effectiveRate` falls back to the rate snapshotted on the record
   (`record.rate`) while the project is not yet in the list, so the rate badge and the estimated
   total are correct from the first paint instead of showing $0.00. The badge falls back the same
   way.
4. `refreshProjects({ force: true })` in the drawer, so the list it validates against is guaranteed
   to be the real one rather than a stale cache.

### Regression test — `frontend/test/recordDrawer.test.ts` (2 tests)
- **Timing-sensitive**: the project fetch is held back on a deferred promise, and the test asserts
  `projectId` is still `1` *while the list is still empty* — the exact window in which the old code
  dropped it. It then resolves the list and asserts the rate badge shows `130.00`, the estimated
  total shows `455.00` (3.5 h × $130), and no "Pick a project for this entry" text is present.
- **Existing behaviour preserved**: after the list loads, changing the client id by hand clears
  `projectId`, because the selected project no longer belongs to the new client.

### Verification
```
$ npm run typecheck   → no TS errors
$ npm test            → Test Files  17 passed (17)   Tests  179 passed (179)
$ npm run build       → ◆ ✨ Build complete in 7.50s!
```
No long-lived server was started for this fix.

---

## PrimeVue 4 downgrade (user decision 23-10-2026)

**Why.** PrimeVue 5 is PrimeUI-licensed and shows an "Invalid PrimeUI License" toast without a key
(QA GAP-003). The user chose PrimeVue 4 (MIT).

### Versions installed
| Package | Before | After |
|---|---|---|
| `primevue` | 5.0.4 | **4.5.5** |
| `@primevue/nuxt-module` | 5.0.4 | **4.5.5** |
| `@primeuix/themes` | 3.1.0 | **1.2.5** (the v1 line is the one paired with PrimeVue 4) |
| `primeicons` | 8.0.2 | 8.0.2 (unchanged — standalone CSS) |

`@primeuix/themes` was chosen by checking `primevue@4.5.5`'s dependency set
(`@primeuix/styled@^0.7.4`, `@primeuix/styles@^2.0.3`) and `@primevue/nuxt-module@4.5.5`'s own
deps, rather than guessing.

### API differences found and handled
- **No code changes were needed.** `npm run typecheck` passed with zero errors straight after the
  install, and the build succeeded unchanged.
- Verified by hand against the v4 sources: `Drawer`, `Select`, `SelectButton`, `Message`,
  `IconField`, `InputIcon`, `ToggleSwitch`, `DatePicker`, `ColumnGroup`, `Row` all exist in 4.5.5;
  `Button`/`Tag` still accept `severity="secondary"`; `InputNumber` still has `prefix`;
  `SelectButton`'s `#option` slot still provides `{ option, index }` (worker-4's earnings filter
  uses it unchanged).
- worker-4's invoices/earnings components use only `Button`, `Column`, `DataTable`, `DatePicker`
  and `SelectButton` — all present in v4, so **no version-compat edits were needed in their files**.

### The preset is byte-for-byte equivalent
The theme output is unchanged, so the design tokens still hold:
```
--p-primary-color:          #7c3aed (light) / #a78bfa (dark)
--p-content-background:     #ffffff      / #18181b
--p-form-field-background:  #fafafa      / #0f0f12
--p-border-radius-md:       8px
--p-focus-ring-color:       var(--p-violet-400)
```

### `@primevue/forms`
It is a **hard dependency** of `@primevue/nuxt-module@4.5.5` (`"@primevue/forms": "4.5.5"`), so it
cannot be removed from the tree without breaking the module — and it was never in my
`package.json` to begin with. Functionally it is already neutralised: GAP-002 excludes PrimeVue's
`FormField` from registration, and `.nuxt/components.d.ts` now contains **only** `BfFormField` and
no `FormField` entry at all.

### Verification
```
$ npm run typecheck   → no TS errors
$ npm test            → Test Files  16 passed (16)   Tests  177 passed (177)
$ npm run build       → ◆ ✨ Build complete in 8.52s!

$ grep -r "PrimeUI License" .output        → (no output — PASS)
$ grep -rl "PrimeUI" .output               → only "@primeuix/*/package.json" descriptions
                                            ("PrimeUI Libraries"), not the licence notice

$ NUXT_PUBLIC_API_BASE=http://localhost:4400/api PORT=3301 node .output/server/index.mjs   (PID 66250)
  GET /           → 200      GET /invoices  → 200      GET /clients   → 200
  GET /projects   → 200      GET /earnings  → 200      GET /settings  → 200
  server log      → 1 line ("Listening on …"), i.e. NO "PrimeUI license is not configured"
                    warning on every request, which PrimeVue 5 emitted
  p-formfield occurrences in SSR: 0   (GAP-002 fix still holds)
  (server stopped afterwards; port 3301 free)
```

### Deviation note corrected
The T4 section recorded "PrimeVue 5.0.4" as a deviation from the plan's "PrimeVue 4". That
deviation no longer exists — the stack is now **exactly** what the plan specified
(`PrimeVue 4` + `@primeuix/themes` Material preset + Tailwind 4).

---

## GAP-002 fix — every form rendered without labels or inline errors (HIGH)

**Cause (verified).** `primevue: { autoImport: true }` registers PrimeVue's components from the
`primevue` package **and** from `@primevue/forms` — a *transitive* dependency of
`@primevue/nuxt-module`, so it is not in my `package.json` and cannot simply be removed without
breaking the module. PrimeVue's `FormField` and my `app/components/common/FormField.vue` therefore
registered the **same auto-import name**, and PrimeVue's won. My component received `label`,
`field-id` and `error` as fallthrough attributes and rendered as
`<div class="p-formfield p-component" label="Display Name" …>` — no `<label>`, no `for`, no
`role="alert"`.

### Fix (lead's option a, plus belt-and-braces)
1. **Renamed** `app/components/common/FormField.vue` → `app/components/common/BfFormField.vue`.
   A distinct name cannot be shadowed by anything PrimeVue ships. All 46 usages updated across
   `ClientDialog`, `ProjectDialog`, `PlatformDialog`, `RecordDrawer` and `pages/settings.vue`.
   (`pages/settings.vue` is mine; **worker-4's files did not use `FormField` at all** — verified, so
   nothing of theirs needed touching.)
2. **Excluded PrimeVue's `FormField`** via `primevue.components.exclude: ['FormField']`. The app
   does not use PrimeVue's forms API, so the component is dead weight and its registration is now
   removed at the source rather than merely out-competed.
3. The PrimeVue version is **unchanged** — that licence decision is the user's.

### Two further real bugs surfaced while writing the test
- **`Intl` currency crash.** `InputNumber mode="currency"` was bound to the R15 currency *symbol*
  (`$` by default). `Intl.NumberFormat` requires an ISO 4217 code and throws
  `RangeError: Invalid currency code : $`. R15 stores a user-configurable *glyph*, not a currency
  code, so `mode="currency"` was semantically wrong. Switched the three affected inputs
  (`ClientDialog` rate, `ProjectDialog` rate, `PlatformDialog` flat fee) to `mode="decimal"` with
  `:prefix="currencySymbol"`.
- **Crashes on a cleared state.** `useClientsState` / `useProjectsState` / `usePaymentPlatformsState`
  / `useSettingsState` returned raw `useState` refs whose `.value` becomes `undefined` when the
  state is cleared — every downstream `.map` / `.filter` then threw
  `TypeError: Cannot read properties of undefined (reading 'map')`. They now return a writable
  computed that guarantees a usable value, so no consumer has to guard.

### Regression test — `frontend/test/BfFormField.test.ts` (6 tests)
Mounts the **real `ClientDialog`** (not the wrapper in isolation) so a shadowing regression is
caught where it bites. PrimeVue's `Dialog` teleports to `document.body`, so the assertions query
the document:
- a `<label for="client-name">` exists, names the field, and its target `#client-name` exists
- `.p-formfield` markup is **absent** (the shadow is gone)
- all six fields have labels, not just the first
- after a failed submit, a `[role="alert"]` element exists and names the offending field
- an invalid email produces a `role="alert"` message
- the error is wired to the control via `aria-describedby` → `#client-name-error`

### Verification
```
$ npm run typecheck   → no TS errors
$ npm test            → Test Files  16 passed (16)   Tests  177 passed (177)
$ npm run build       → ◆ ✨ Build complete in 9.37s!

$ NUXT_PUBLIC_API_BASE=http://localhost:4400/api PORT=3301 node .output/server/index.mjs   (PID 63044)
  GET /settings -> HTTP 200
    <label for="settings-name" class="bf-label">
    <label for="settings-target" class="bf-label">
    <label for="settings-currency" class="bf-label">
    <label for="settings-prefix" class="bf-label">
    p-formfield occurrences: 0
  GET /          -> 200   labels=0  p-formfield=0   (timesheet: no form fields; drawer closed)
  GET /clients   -> 200   labels=0  p-formfield=0   (dialog closed)
  GET /projects  -> 200   labels=1  p-formfield=0
  GET /settings  -> 200   labels=4  p-formfield=0
  (server stopped afterwards; port 3301 free)
```
Before the fix, QA's SSR proof showed `<div class="p-formfield p-component" label="Display Name" …>`
on `/settings`; that markup is now gone and four real `<label for>` elements are present.

---

## GAP-001 fix — timesheet quick-add drawer froze the tab (HIGH)

**Root cause (verified by me, matches QA's analysis).** `app/pages/index.vue` watched the shared
quick-add signal's `token` and, on change, called `openDrawer()` → `open()`, which **bumps `token`
again**. The watcher therefore re-entered itself forever:
`token++ → watcher → openDrawer → open() → token++ → …`
Dev builds abort with "Maximum recursive updates exceeded"; the production build has no guard, so the
main thread spins and the tab freezes.

The **edit-record path had the same defect** and was broken independently of the freeze:
`editRecord()` called `open(record.date)`, which bumped `token`, which made the watcher fire and
reset `editing.value = null` — so the record being edited was discarded. (It also re-entered the
same loop.)

### Fix — structural, not a guard
The shared `useQuickAdd` request is now strictly a **one-way signal**; the drawer's visibility is
**local page state**:

| Before | After |
|---|---|
| `watch(request.token)` → `openDrawer()` → `close(); open(date)` | `watch(request.token)` → copies `request.date` into local state, sets `drawerVisible = true`. **Never calls `open()`.** |
| `openDrawer(date)` → `close(); open(date)` | `openDrawer(date)` → sets `drawerDate` + `drawerVisible` locally |
| `editRecord(record)` → `open(record.date)` | `editRecord(record)` → sets `editing` + `drawerDate` + `drawerVisible` locally |
| — | `onDrawerVisibleChange(value)` clears the signal on close, so returning to the page does not reopen the drawer |
| — | `onBeforeUnmount` clears the signal |

`useQuickAdd` gained a doc comment stating the contract: *"`open()` bumps `token`, and a consumer
MUST NOT call `open()` in response."* `close()` no longer changes `token`, so it cannot re-trigger a
watcher.

The header's "Add Time" (in the layout, outside the page) still raises the signal — that is exactly
what the signal is for — and the page consumes it. One click → one token bump → one watcher fire.
**No path from a watcher back to `open()` now exists**, so the loop is structurally impossible
rather than merely bounded.

**Delete path:** `confirmRemove` → `useRecords().remove()` never touches the signal. Checked, no
change needed.

### Latent SSR risk (worker-4's flag) — fixed
All six of my composables resolved `useApi()` lazily inside async functions:
`const api = () => useApi()` → `api().get(…)`. `useApi()` reads `useRuntimeConfig()`, which needs an
active Nuxt instance; resolving it after an `await` can lose that context. Now resolved **once at
setup** in `useClients`, `useProjects`, `usePaymentPlatforms`, `useSettings`, `useRecords`, `useWeeks`
(and in `useCurrentWeekAsync`, outside the `useAsyncData` handler) — the same pattern worker-4
already used in `useInvoices`/`useEarnings`.
`useApi()` itself also gained a `resolveApiBase()` fallback to `DEFAULT_API_BASE` so a lost Nuxt
context degrades instead of throwing.

### Defensive hardening found while testing
The regression test surfaced `TypeError: Cannot read properties of undefined (reading 'token')`:
`close()` read `request.value.token` and the page watcher read `request.value.token` while the state
could be momentarily undefined. Both now read defensively (`request.value?.token`,
`request.value?.token ?? 0`).

### Regression test — `frontend/test/quickAdd.test.ts` (7 tests)
The key assertion mounts the **real page**, raises the open signal, and asserts the token advanced
by **exactly one**:

```ts
const wrapper = await mountSuspended(TimesheetPage)
const before = request.value.token
open('2026-10-19')
await nextTick(); await nextTick()
expect(request.value.token).toBe(before + 1)   // buggy code: >+1, or infinite
```

I verified this assertion genuinely detects the bug. Mutating the live app file to reintroduce the
old pattern was refused by my permission layer, so instead I proved the mechanism in an isolated
throwaway test (since deleted) that reproduced both patterns in plain reactivity:

| Pattern | Watcher reactions | Token after one request |
|---|---|---|
| OLD — watcher re-raises the signal | > 1 | > 1 (climbs) |
| NEW — watcher only copies state | 1 | 1 |

Both proof cases passed, confirming the assertion distinguishes them. Other tests: the token advances
exactly once per `open()`; `close()` does not change the token; mounting + opening settles without
throwing; the signal records and clears the requested date.

### Verification (results pasted as required)
```
$ npm run typecheck   → no TS errors
$ npm test            → Test Files  15 passed (15)   Tests  171 passed (171)
$ npm run build       → ◆ ✨ Build complete in 8.60s!

$ NUXT_PUBLIC_API_BASE=http://localhost:4400/api PORT=3301 node .output/server/index.mjs   (PID 34970)
  GET /            → HTTP 200  bytes=399687
                     "Week 43: 19-10-2026 – 25-10-2026"
                     "34.5 / 40.0 hrs logged this week"
                     "-5.5 hrs below target" · "Acme Corp"
  GET /clients     → 200
  GET /projects    → 200
  GET /settings    → 200
  (server stopped afterwards; port 3301 free)
```

A browser click test is QA's (worker-5's) job — the backend's CORS allows only
`http://localhost:3000`, so clicking from :3301 is not possible without their proxy, as the
assignment noted. The regression test covers the loop deterministically.
## GAP-009/010 completion — finished by team-lead (24-10-2026)
worker-2 implemented GAP-010 (`todayLocalIso`, all calendar `toISOString()` uses replaced) and GAP-009 (layout SSR-fetches the current week), then stopped on a provider 429 while fixing its own test. The user asked the lead to close all workers and finish.
- E2E found a regression in the GAP-009 code: the layout's `watchEffect(() => { if (ssrWeek.value) useWeeks().set(ssrWeek.value) })` also tracked the shared useState (via `useState()` inside `useWeeks()`), so every later change was reverted to the SSR copy. 7 E2E specs failed (week navigation, close/reopen, add/edit/delete record totals). The settings `watchEffect` had the same shape.
- Fix (`app/layouts/default.vue`): composables resolved once at setup, plus `watch(ssrWeek | ssrSettings, ..., { immediate: true })`, so only the SSR result is tracked.
- Regression test `test/layoutWeek.test.ts` › "does not revert later changes to the shared week back to the SSR copy": proven to fail on the old code and pass on the fix.
- Verification: frontend 20 files / 198 tests passed; typecheck 0 errors; build OK; E2E 63/63 passed (GAP-009/010 `test.fail()` markers removed in e2e/tests/ssr.spec.ts and timesheet.spec.ts).
