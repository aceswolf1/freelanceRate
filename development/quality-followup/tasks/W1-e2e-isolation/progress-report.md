# Progress: W1 — E2E isolation + new specs

Role: e2e-w1 (Test & Quality Engineer). Ownership: `e2e/**` only.
Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate`

## Subtask list
- [ ] T2.1 — One source of truth for DB/ports (`e2e/helpers/db.ts` + `paths.ts`)
- [ ] T2.2 — `assertE2eDatabase()` guard + proof it rejects the real DB names
- [ ] T2.3 — global-setup: create DB, migrate, seed (guarded), build+start backend :4410, start frontend :3300
- [ ] T2.4 — Remove the CORS proxy; api.ts points at BACKEND_URL (:4410)
- [ ] T2.5 — global-teardown: re-seed e2e DB (guarded), stop only our PIDs
- [ ] T2.6 — Update stale comments in `paths.ts` / `playwright.config.ts`
- [ ] T3.1 — Run the full suite against the isolated stack; fix harness issues
- [ ] T3.2 — New spec `email-options.spec.ts`
- [ ] T3.3 — New spec `contact-name.spec.ts`
- [ ] T3.4 — New spec `api-proxy.spec.ts`
- [ ] T3.5 — New spec `clipboard-fallback.spec.ts`
- [ ] T3.6 — New spec `icons-favicon.spec.ts`
- [ ] T3.7 — Suite green twice (local TZ + `TZ=UTC`)
- [ ] T3.8 — `npm test` alias in `e2e/package.json`

## Baseline facts (read-only survey, 2026-10-27)
- Lead's servers (MUST NOT touch): backend :4400 = pid 59857 (`tsx src/server.ts`), frontend :3100 = pid 53563 (`node .output/server/index.mjs`).
- Postgres 18 local, user `cace`, no password. Databases present: `freelancer_invoices` (REAL DATA — never write), `freelancer_invoices_test` (backend unit suite), plus unrelated DBs.
  `freelancer_invoices_e2e` **does not exist yet** → must be created.
- `backend/dist/` is stale (last built 2026-10-08, only `app.js`) → must rebuild before starting :4410.
- `frontend/.output/` exists (2026-10-22) with `server/index.mjs` + `public/` (favicon.svg, favicon-32.png, favicon.ico, apple-touch-icon.png).
- Playwright 1.64.1 installed in `e2e/node_modules`; chromium 1208 present in the browser cache.
- Backend `.env` holds the real `DATABASE_URL`; `dotenv` does **not** override an already-set env var, so passing `DATABASE_URL=` explicitly to the child process is sufficient (no need to read the file).

## Guardrails
- Only DB writes: `freelancer_invoices_e2e` (create/migrate/seed/truncate).
- Only processes stopped: those recorded in `e2e/.state/servers.json` by this suite.

---

## Subtask T2: Isolate the suite — ✅ Done

### What changed
| File | Change |
|---|---|
| `e2e/helpers/db.ts` (new) | `E2E_DB_NAME`, `E2E_DATABASE_URL`, `databaseNameFromUrl()`, **`assertE2eDatabase()`**, `ensureDatabaseExists()`, `assertServerIsE2eDatabase()`, `queryE2eDatabase()` |
| `e2e/helpers/paths.ts` | API now `http://127.0.0.1:4410`, frontend `http://127.0.0.1:3300`, `BROWSER_API_BASE = '/api'` (same origin). Proxy constants removed. |
| `e2e/helpers/servers.ts` | rewritten: guarded `npm run db:migrate` / `db:seed`, `assertBackendChildUsesE2eDatabase()`, `buildBackendIfStale()`, `startBackend()` (:4410, `DATABASE_URL` explicit), `startFrontend()` (:3300, `NUXT_API_INTERNAL_BASE`, **no** `NUXT_PUBLIC_API_BASE`), PID bookkeeping, strict "port taken by a foreign process ⇒ hard error". |
| `e2e/helpers/api.ts` | comment only — `API_BASE` now points at the suite's own backend :4410. |
| `e2e/global-setup.ts` | create DB → prove the backend child's effective `DATABASE_URL` → build backend → migrate → seed → start :4410 + :3300. |
| `e2e/global-teardown.ts` | re-seed the **E2E** DB, stop only the recorded PIDs. |
| `e2e/playwright.config.ts` | comment updated (isolated stack, same-origin `/api`). |
| `e2e/helpers/cors-proxy.mjs` | **deleted** (obsolete with the `/api` proxy). |
| `e2e/package.json` | `test` alias kept; added `test:utc`. |
| `e2e/tests/db-guard.spec.ts` (new) | 7 unit-style checks proving the guard accepts only the E2E DB. |

### Safety design (why the development DB cannot be reached)
1. `assertE2eDatabase(url)` throws unless the URL's database name is **exactly**
   `freelancer_invoices_e2e`. It is called in `runBackendScript()` (migrate +
   seed), in `startBackend()`, in `ensureDatabaseExists()`, in
   `assertServerIsE2eDatabase()` and in `queryE2eDatabase()`.
2. `backend/.env` points at the development DB, so the suite passes
   `DATABASE_URL` explicitly to every child process. `assertBackendChildUsesE2eDatabase()`
   **proves** at setup time that `dotenv` does not override the explicit value
   (it loads `backend/.env` in a child and prints the effective URL).
3. A raw socket check (`select current_database()` through `psql`) proves the
   URL really resolves to the E2E database on the server.
4. The suite refuses to reuse a port owned by a foreign process, so it can
   never point at somebody else's API.

### Verification
```
$ cd e2e && npx playwright test
  70 passed (1.8m)          # 63 pre-existing + 7 new guard tests
```
```
$ lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3100|3300|4400|4410)'
node  53563  *:3100          # lead's frontend — still running
node  59857  127.0.0.1:4400  # lead's API — still running
                            # :3300 / :4410 free → our processes were stopped
```
```
$ psql "postgres://cace@localhost:5432/freelancer_invoices_e2e" -tAc "select current_database(), (select count(*) from clients), (select count(*) from work_records), (select count(*) from invoices), (select count(*) from weeks)"
freelancer_invoices_e2e|2|12|0|1     # seeded, no invoices
```
`grep -rn "4400\|4401\|cors\|PROXY" e2e --include="*.ts" --include="*.mjs" --include="*.json"` → **no matches**.

### Note on the frontend build
`frontend/.output` (2026-10-25 22:34) is newer than every file under
`frontend/app`, `frontend/server` and `frontend/nuxt.config.ts`, so **no
rebuild was needed** — the lead's frontend on :3100 was never disturbed.
The baked runtime config was inspected: `apiBase: "/api"` and
`apiInternalBase: "http://localhost:4400"` (overridden at runtime by
`NUXT_API_INTERNAL_BASE`, which the Nitro build applies via `applyEnv`).

---

## Subtask T3: Run the suite and extend it — ✅ Done

### New specs (24 new tests)
| Spec | Tests | What it proves |
|---|---|---|
| `tests/db-guard.spec.ts` | 7 | `assertE2eDatabase()` accepts **only** the E2E database and rejects the development database, the backend unit-test database, near misses (`…_backup`, `…s`, `old_…`, upper case) and URLs without a database name. |
| `tests/email-options.spec.ts` | 4 | Settings → Email content shows exactly 3 switches, all off by default (UI **and** DB); with them off the email has no `Rate` column, no `Gross` line and no fee line but keeps `Net due`; with all three on the email shows Rate + Gross + `Payoneer fee` (plain text **and** HTML **and** the mailto body); the switches are restored afterwards. |
| `tests/contact-name.spec.ts` | 3 | The contact name set in the client dialog is persisted, greets the client (`Hi Jane Doe,`) in the email/mailto and is printed as `Attn: Jane Doe` in the PDF; without one the greeting falls back to `Hi Acme Corp team,` and the PDF has no attention line. |
| `tests/api-proxy.spec.ts` | 4 | `FRONTEND_URL/api/health` = 200 JSON with the API's envelope; a query string survives the proxy; `/api/../admin` and `/admin` are **not** proxied (404 HTML, no API envelope); the browser issues every API call to its own origin and never to `:4410`. |
| `tests/clipboard-fallback.spec.ts` | 2 | With `navigator.clipboard` removed, "Copy formatted" still reports "Invoice copied" and the fallback really writes the HTML table to the clipboard; pasting it into a contenteditable yields a `<table>`. |
| `tests/icons-favicon.spec.ts` | 4 | All 6 sidebar icons and the theme-toggle icon carry the `pi` class and compute `font-family: primeicons`; the head links `/favicon.svg` (+ 32px PNG + apple-touch-icon); all four favicon files are served with the right content type. |

New helper: `e2e/helpers/pdf.ts` — a dependency-free PDF text extractor
(inflates the Flate streams, decodes pdfkit's hex text strings). Needed
because the invoice PDF **compresses** its text — a naive byte search finds
nothing.

### Fixes to the existing suite (harness only)
* `helpers/api.ts` — `expectEnvelope()` / `expectError()` now accept both
  envelope annotations (`ApiEnvelope<T>` and `{ data: T }`) and infer the
  payload type; `InvoiceDto` gained the real `contactName` field.
* `tests/crud.spec.ts` — one `ApiEnvelope` annotation + `error!` on the
  optional error object.
* `e2e/package.json` — added `@types/node` (dev) and a `typecheck` script;
  `npx tsc --noEmit` now reports **0 errors** (it could not even start
  before, because `@types/node` was missing).

### Final runs
```
$ cd e2e && npx playwright test
  87 passed (2.1m)              # 63 pre-existing + 24 new

$ cd e2e && TZ=UTC npx playwright test
  87 passed (2.1m)

$ cd e2e && npx tsc --noEmit -p tsconfig.json
  (no output — 0 errors)
```
No `test.fail()` anywhere; no product code was touched.

### Post-run state
```
$ lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3100|3300|4400|4410)'
node  53563  *:3100          # lead's frontend — untouched, still running
node  59857  127.0.0.1:4400  # lead's API — untouched, still running
                            # :3300 / :4410 free → our processes were stopped
$ cat e2e/.state/servers.json
[]
$ psql "postgres://cace@localhost:5432/freelancer_invoices_e2e" -tAc "select current_database(), (select count(*) from clients), (select count(*) from invoices), (select count(*) from weeks), (select email_show_rate from settings)"
freelancer_invoices_e2e|2|0|1|f
```
The VS Code Playwright `test-server` (pid 69365) was never touched.


