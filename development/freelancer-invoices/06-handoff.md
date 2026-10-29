# Handoff: freelancer-invoices

**Last updated**: 28-10-2026 · **Status**: live on the NAS at `http://192.168.18.10:3010` (release `v0.1.6`). R1–R15 all PASS; all 10 QA gaps closed (9 fixed, 1 accepted deviation). Quality follow-up complete (`development/quality-followup/`): E2E isolated on its own DB and extended, frontend coverage enforced.

## What was built
A single-user time-tracking and invoicing app (design codename "BillFlow"):
- **Weekly timesheet** (Mon–Sun, Sat/Sun muted but insertable), quick-add/edit drawer, below-40h warning (target configurable), close/reopen week.
- **Clients, Projects, Payment Platforms, Settings** CRUD. Rate fallback is project rate → client rate. Platform fee is percent + optional flat amount. Clients have an optional **contact name**.
- **Invoice Generator**: closed weeks only, one invoice per client plus a "No client" bucket for standalone projects. Rates, names and the contact name are snapshotted at generation; generating twice returns the same invoices. PDF per invoice (with "Attn: {contact}"), zip of all, `mailto:` email text, and "Copy formatted" (HTML tables).
- **Email content options** (Settings → Email Content): Show rate / Show gross / Show fee, all **off by default**. Hours, line totals and Net due are always shown. The email greets the contact by name when set.
- **Earnings** by project and by client (gross / fees / net / hours, plus an unbilled block).
- **Light/dark theme** (dark default), persisted without a flash on load. **Favicon** (receipt-on-violet).

### Added after the first handoff (23-10-2026 → 25-10-2026)
| Commit | Change |
|---|---|
| `6103734` | Email content options; client contact name (email greeting + PDF "Attn"); migration `0001_natural_wong.sql` (additive) |
| `9ff3b05` | NAS deployment: same-origin `/api` proxy in the frontend, `HOST=0.0.0.0` backend image, registry compose, GHCR publish workflow, Watchtower |
| `1cd4774` | NAS frontend published on port **3010** (3002 was taken) |
| `ba4dd53` | Copy formatted works on plain-http (fallback to `execCommand('copy')`); sidebar/theme icons render (missing `pi` base class) |
| `f514707` | CI builds each platform on a native runner + merge job (QEMU crashed with exit 132) |
| `eaaadf7` | Favicon (SVG + PNG/ICO fallbacks + apple-touch-icon) |
| `2e92695`, `738831b` | Timezone/date-dependent tests pinned (CI runs in UTC) |

## Stack (as shipped)
| Layer | Tech |
|---|---|
| Backend `backend/` | Express 5 + TypeScript + Drizzle (node-postgres) + Zod, Model → Repository → Service → Controller in feature folders; pdfmake (PDF), archiver (zip). Binds `127.0.0.1` by default (`HOST` overrides; the image sets `0.0.0.0`). |
| Frontend `frontend/` | Nuxt 4 + **PrimeVue 4.5.5** (Material preset, DESIGN.md tokens; MIT) + Tailwind 4. Same-origin `/api` proxy route → backend (`NUXT_API_INTERNAL_BASE`). |
| DB | PostgreSQL (local 18 for dev; `postgres:17-alpine` in Docker) |
| E2E `e2e/` | Playwright (Chromium) |
| Deploy | GHCR images (amd64 + arm64) → TrueNAS Custom App (`docker-compose.registry.yml`) → Watchtower auto-update |

## Who delivered what
| Worker | Delivered |
|---|---|
| worker-1 (backend) | Scaffold, full schema + migrations + idempotent seed, API contract (`orchestration-ctx/decisions/api-contract.md`), CRUD/weeks/records modules |
| worker-2 (frontend) | Nuxt shell + themes, Clients/Projects/Platforms/Settings, Weekly Timesheet; fixes for GAP-001/002/004/006/007/009/010; PrimeVue 4 downgrade |
| worker-3 (backend/devops) | Dockerfiles + compose + README; invoice engine, PDF, zip, email, earnings; backend stabilization (records router, test harness, 3 repository bugs); port 4400; TZ config |
| worker-4 (frontend) | Invoice Generator + Earnings pages; GAP-008 fix |
| worker-5 (QA) | Playwright suite (63 specs), 12 screenshots, R1–R15 traceability, gap report |
| team-lead | GAP-009 regression fix; email options + contact name; NAS deployment (proxy, compose, CI, Watchtower, guide); clipboard + icon fixes; native-runner CI; favicon |

## Verification (current)
| Check | Result |
|---|---|
| Backend `npm test` | 22 files / 327 tests passed (also in `TZ=UTC`) |
| Backend coverage | 97.09% lines (≥ 80% target) |
| Backend `tsc` | 0 errors |
| Frontend `npm test` | 39 files / 414 tests passed (also in `TZ=UTC`); typecheck 0 errors |
| Frontend coverage | **81.15% lines**, 82.27% statements, 79.22% functions, 71.54% branches; thresholds enforced (80/80/77/69), also in CI |
| E2E | **87/87** (63 + 24 new: DB guard, email options, contact name, `/api` proxy, clipboard fallback, icons/favicon), green in local TZ and `TZ=UTC`, on its own DB `freelancer_invoices_e2e`; real-DB checksum unchanged across runs |
| Release `v0.1.6` | test + 4 native builds + 2 merges green; images `0.1.6` = `latest`, amd64 + arm64 |
| NAS | running; favicon, icons and Copy formatted confirmed by the user |

## How to run

### Local development
```bash
# Postgres 18 on localhost:5432 (user cace). One-time:
createdb freelancer_invoices; createdb freelancer_invoices_test
cd backend && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed
npm run dev                      # API on http://localhost:4400/api
cd ../frontend && npm install
npm run build && PORT=3100 NUXT_API_INTERNAL_BASE=http://localhost:4400 node .output/server/index.mjs   # UI on http://localhost:3100
```
- The UI calls same-origin `/api`, which the frontend proxies to `NUXT_API_INTERNAL_BASE`, so no CORS setup is needed.
- **Use the production build for the frontend locally.** `npm run dev` crashes its Vite SSR worker ("IPC connection closed") on this machine.
- **Restart the backend after backend code changes.** `tsx watch` didn't reload reliably here.
- **Ports:** `127.0.0.1:4000` is Local.app (so the API uses 4400); 3000 is another local app (so the UI runs on 3100).
- `npm run db:seed` **replaces all data** with demo data. Never run it against a database holding real data.

### Tests
```bash
cd backend  && npm test && npm run test:coverage   # uses freelancer_invoices_test (tables truncated per test)
cd frontend && npm run test:coverage                # fails below the coverage thresholds
cd e2e      && npx playwright test                 # own stack: DB freelancer_invoices_e2e, API :4410, UI :3300
TZ=UTC npm test                                    # run the suites in UTC too before tagging (CI is UTC)
```
- E2E creates/migrates/seeds `freelancer_invoices_e2e` itself and starts and stops its own backend and frontend. A guard aborts if any command targets another database, so it can't reach the real data. Ports 4410 and 3300 must be free.
- `screenshots.spec.ts` rewrites `tasks/W5-qa/screens/*.png` on every run (known churn; see Deferred).

### Release → NAS
```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```
GitHub Actions: tests (backend with a Postgres service + frontend) → native amd64 + arm64 builds → merge to `ghcr.io/aceswolf1/freelancer-invoices-{backend,frontend}` tagged `X.Y.Z`, `X.Y`, `latest` → Watchtower (PixelPaladin's, label-enabled) recreates frontend + backend within ~5 min. Postgres is never auto-updated. If a release fails, fix forward with a new tag. Full guide, first-deploy steps and troubleshooting: `deploy/AUTOMATION.md`.

### NAS facts
- TrueNAS Custom App **`freelancer-invoices`**, YAML = `docker-compose.registry.yml` with the password, `TZ`, port and dataset path edited in place (Custom Apps don't read `.env`).
- URL `http://192.168.18.10:3010`; data at `/mnt/storage/freelancer-invoices/pgdata`; containers `ix-freelancer-invoices-{db,backend,frontend}-1`.
- Only the left side of `ports:` may change; the frontend's `PORT` stays `3000`.

### Docker locally (build from source)
```bash
cp .env.example .env              # set POSTGRES_PASSWORD (URL-safe) and TZ
docker compose up -d --build      # only the UI is published (APP_PORT, default 3000); API + DB internal
```

## Integration notes
- **Time zone:** "today" and Mon–Sun week boundaries use local time: the browser's for the UI and `TZ` for the containers (default UTC).
- **Plain-http NAS:** not a secure context, so browser APIs like `navigator.clipboard` are missing there; Copy formatted uses the `execCommand('copy')` fallback.
- **API contract:** `orchestration-ctx/decisions/api-contract.md` is authoritative. Accepted deviations are in §8 / §8.1 (incl. GAP-005), and the changelog records the email options and contact name.
- **Email amount:** the email asks for **Net due = gross − fee** (user decision 25-10-2026); with the fee line hidden, line totals sum to gross.
- **Single user, no auth.** LAN/NAS only; don't expose it to the internet without adding authentication.
- **Money** is computed in integer cents. Fees are rounded half-up per invoice and allocated to projects by largest remainder, so earnings always add up to the invoice totals.
- **Invoice numbers** are `{prefix}-{YYYY}-{NNN}`, where YYYY is the billing week's year. Issued invoices keep their snapshots (e.g. adding a contact name later doesn't change INV-2026-001).

## Deferred / out of scope
- Login/multi-user, SMTP sending, multi-currency, payment tracking.
- The design's Export CSV / Print Summary buttons; decorative widgets with no backing data.
- Quality follow-ups: `screenshots.spec.ts` should write under `e2e/` (gitignored) instead of `development/…/screens`; 14 frontend files are still below 80% individually (largest: `pages/index.vue`, `RecordDrawer.vue`); dead "Could not save" fallback in `ProjectDialog.vue`/`PlatformDialog.vue`; `useWeeks.load()` toast vs `silent` coupling.
- Local leftovers you may remove: Docker volume `freelancer-invoices_pgdata`; `proxy-ai/vercel-copilot-api-v2/.env.providers.local` (contains API keys; already applied to `.env`).

## Decision log
`orchestration-ctx/decisions/`: `stack-and-harness-decisions.md` (stack, user authorizations, port 4400, PrimeVue 4), `backend-stabilization-handoff.md`, `api-contract.md`. Deployment: `deploy/AUTOMATION.md`.
