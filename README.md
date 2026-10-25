# freelancer-invoices

Weekly timesheet → per-client invoices (PDF / email text) → earnings, for a single
freelancer. Self-hosted on a TrueNAS SCALE box or any Docker host; no accounts, no
SMTP, no third-party services.

Times are entered per week (Mon–Sun) against projects. When a week is closed the app
splits its hours into one invoice per client, applies the payment-platform fee, and
produces a PDF, a `mailto:` email body, and a downloadable `.zip`.

---

## Stack

| Layer | Technology |
|-------|------------|
| API | Express 5 · TypeScript (ESM, Node 22) · Drizzle ORM + `pg` · Zod |
| UI | Nuxt 4 (`app/` dir) · PrimeVue 4 (Material preset) · Tailwind 4 |
| Database | PostgreSQL 17 (image) |
| Documents | `pdfmake` (server-side PDF) · `archiver` (zip) |
| Tests | Vitest (unit) · Supertest (integration) · Playwright (E2E) |
| Orchestration | Docker Compose v2 |

Money is computed in **integer cents** in the services and stored as `numeric(12,2)`;
dates are `YYYY-MM-DD` strings end to end (no timezone drift).

## Layout

```
.
├── backend/            # Express API  (Dockerfile lives here)
├── frontend/           # Nuxt UI      (Dockerfile lives here)
├── e2e/                # Playwright specs
├── docker-compose.yml  # db + backend + frontend
├── .env.example        # every variable, documented
└── README.md
```

## Prerequisites

- Docker Desktop / Docker Engine with Compose v2 (24.0.5 + v2.20.2 verified), **or**
- Node.js 22 + npm 10 and a local PostgreSQL for non-Docker development.

> **Ports.** In Docker only the UI is published (**3000**, `APP_PORT`). The browser calls
> same-origin `/api` and the frontend proxies it to the API (4400) on the internal network,
> so the API and Postgres are never exposed. For local development the API runs on **4400**
> (rather than the usual 4000: `Local.app` owns `127.0.0.1:4000` on this machine).

## Quick start (Docker, built from source)

```bash
cp .env.example .env          # set POSTGRES_PASSWORD and TZ
docker compose up -d --build
docker compose ps             # wait until all three are "healthy"
curl http://localhost:3000/api/health   # API, through the frontend proxy
open http://localhost:3000
```

Shut down (data is kept): `docker compose down`
Shut down and **delete all data**: `docker compose down -v`

## Local development

Uses the local PostgreSQL already on this machine:

```bash
createdb freelancer_invoices
createdb freelancer_invoices_test
cd backend
cp .env.example .env        # DATABASE_URL=postgres://cace@localhost:5432/freelancer_invoices
npm install
npm run db:migrate && npm run db:seed
npm run dev                 # API on http://localhost:4400

cd ../frontend && npm install
npm run build && PORT=3100 node .output/server/index.mjs   # UI on http://localhost:3100
```

The UI proxies `/api` to `NUXT_API_INTERNAL_BASE` (default `http://localhost:4400`), so no
CORS setup is needed. (`npm run dev` for the frontend is unreliable on this machine, so prefer
the production build.)

The backend reads `DATABASE_URL`, `HOST`, `PORT`, `CORS_ORIGIN` and `NODE_ENV` through a
Zod-validated env module, and fails fast with a clear message if a required one is missing.
`HOST` defaults to `127.0.0.1`; the Docker image sets `0.0.0.0`.

### Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `backend` | `npm run dev` | API with watch reload (`tsx`) |
| | `npm run build` | TypeScript → `dist/` |
| | `npm start` | run the compiled server |
| | `npm run db:generate` | generate Drizzle migrations |
| | `npm run db:migrate` | apply migrations (also used by the Docker entrypoint) |
| | `npm run db:seed` | idempotent demo seed |
| | `npm test` | Vitest: unit + Supertest integration |
| | `npm run test:coverage` | coverage report (80%+ target) |
| | `npm run lint` / `npm run typecheck` | static checks |
| `frontend` | `npm run build` | `.output/` production build |
| | `npm run preview` | serve the production build locally |
| | `npm test` / `npm run typecheck` | Vitest / vue-tsc |

## Configuration

Docker Compose reads `.env` at the repository root (see `.env.example`, which documents each
variable).

| Variable | Default | Used by | Notes |
|----------|---------|---------|-------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `freelancer` / `freelancer` / `freelancer_invoices` | db, backend | Keep the password URL-safe (no `@ : / #`): it is interpolated into `DATABASE_URL`. |
| `APP_PORT` | `3000` | frontend | The only published port. |
| `IMAGE_PREFIX` / `IMAGE_TAG` | `ghcr.io/aceswolf1` / `latest` | backend, frontend | Image names when pulling instead of building. |
| `RUN_MIGRATIONS` | `true` | backend | Run pending migrations before serving. |
| `LOG_LEVEL` | `info` | backend | pino level. |
| `TZ` | `UTC` | backend, frontend, db | IANA timezone of the user. It drives "today" and the Mon–Sun week boundaries; containers default to UTC, so set it (e.g. `America/Chicago`) or the current week flips early in the evening. |
| `NUXT_API_INTERNAL_BASE` | `http://localhost:4400` (image: `http://backend:4400`) | frontend | Server-side target of the `/api` proxy. |
| `NUXT_PUBLIC_API_BASE` | `/api` | frontend | Only set this to bypass the proxy and call an API URL directly (then also set the backend's `CORS_ORIGIN`). |
| `DATABASE_URL_TEST` | — | backend tests | Integration tests only. |

## Deployment on TrueNAS SCALE

Releases are automated: **`git tag vX.Y.Z && git push origin vX.Y.Z`** runs the tests, builds
multi-arch images to GHCR, and Watchtower on the NAS redeploys the frontend and backend.
Postgres is never auto-updated.

- Deploy-only compose to paste into **Apps → Custom App → Install via YAML**:
  [`docker-compose.registry.yml`](docker-compose.registry.yml). Edit the password, `TZ`, port
  and dataset path in the pasted YAML; Custom Apps don't read `.env`.
- Full setup, gotchas and rollback: [`deploy/AUTOMATION.md`](deploy/AUTOMATION.md).

**Security notes.**

- Both app containers run as the unprivileged `node` user (`USER node`), never root.
- Only the frontend port is published. The API and Postgres are reachable only on the app's
  internal network, and the `/api` proxy refuses any path outside `/api`.
- The app has no login. Keep it on your LAN or VPN; don't expose it to the internet.

**Backups.**

```bash
# Logical backup (recommended, version independent)
docker compose exec -T db pg_dump -U freelancer -d freelancer_invoices --format=custom > freelancer_invoices_$(date +%F).dump

# Restore into a fresh database
docker compose exec -T db createdb -U freelancer freelancer_invoices_restored
docker compose exec -T db pg_restore -U freelancer -d freelancer_invoices_restored --clean --if-exists < freelancer_invoices_YYYY-MM-DD.dump
```

On the NAS, also snapshot the dataset holding `pgdata`. Snapshots alone are not a substitute
for a `pg_dump` you can restore elsewhere.

**Upgrades.** Migrations run automatically at backend start (`RUN_MIGRATIONS=true`). Back up
before upgrades that change the schema, since Drizzle migrations are not automatically
reversible.

**Troubleshooting.**

| Symptom | Check |
|---------|-------|
| backend restarts / unhealthy | `docker compose logs backend`: usually a failed migration, or a password that differs between `db` and `DATABASE_URL` |
| UI loads, API calls fail with 502 | the frontend can't reach the backend: check `NUXT_API_INTERNAL_BASE` and that the backend is healthy |
| `npm ci` fails during build | `package-lock.json` is out of date: run `npm install` and commit it |

## API

Full request/response schemas live in
`development/freelancer-invoices/orchestration-ctx/decisions/api-contract.md`
(authoritative). Every response uses one envelope:

```json
{ "success": true,  "data": { }, "meta": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

`GET /api/health` → `{ "success": true, "data": { "status": "ok" } }`

---

<!-- Append new sections below this line. -->