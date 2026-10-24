# PROPOSED root `README.md` (worker-3 / T7)

**Why this file exists:** the `Write` of the repository-root `README.md` was denied by
the Claude Code auto-mode permission classifier ("[Create Public Surface] … the user did
not explicitly authorize this specific public exposure"), and per the reporting protocol
it was not retried through another tool. Once the root-level files are approved, install
it verbatim with:

```bash
cp development/freelancer-invoices/tasks/W3-docker-invoicing/README.proposed.md README.md
```

The path inside `docker-compose.proposed.yml` must stay `docker-compose.yml`; this file
is a README, so the copy above produces `README.md` at the repository root.

---

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

> **Ports.** The API listens on **4400** and the UI on **3000**. 4400 (rather than the
> more usual 4000) is a deliberate choice: `Local.app` already owns `127.0.0.1:4000` on
> this machine. The database is published on 5433 for the same reason — local PostgreSQL 18
> occupies 5432.

## Quick start (Docker)

```bash
cp .env.example .env          # edit if your host/ports differ
docker compose up -d --build
docker compose ps             # wait until db and backend are "healthy"
curl http://localhost:4400/api/health
open http://localhost:3000
```

Shut down (data is kept): `docker compose down`
Shut down and **delete all data**: `docker compose down -v`

> The database image is published on host port **5433**, not 5432, so a local
> PostgreSQL 18 dev instance can keep running on 5432 at the same time.

## Local development

Two supported setups.

**A — everything in Docker except your editor**

```bash
docker compose up -d db                       # postgres on localhost:5433
cd backend  && DATABASE_URL=postgres://freelancer:freelancer@localhost:5433/freelancer_invoices npm install && npm run db:migrate && npm run db:seed && npm run dev
cd frontend && npm install && npm run dev     # Nuxt dev server on :3000
```

**B — fully local PostgreSQL (already present on this machine)**

```bash
createdb freelancer_invoices
createdb freelancer_invoices_test
cd backend
cp .env.example .env        # DATABASE_URL=postgres://cace@localhost:5432/freelancer_invoices
npm install
npm run db:migrate && npm run db:seed
npm run dev                 # http://localhost:4400
```

The backend reads `DATABASE_URL`, `PORT`, `CORS_ORIGIN` and `NODE_ENV` through a
Zod-validated env module — it fails fast with a clear message if one is missing.

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
| `frontend` | `npm run dev` | Nuxt dev server (HMR) on :3000 |
| | `npm run build` | `.output/` production build |
| | `npm run preview` | serve the production build locally |
| | `npm test` / `npm run typecheck` | Vitest / vue-tsc |

## Configuration

All variables live in `.env` at the repository root (see `.env.example`, which documents
each one).

| Variable | Default | Used by | Notes |
|----------|---------|---------|-------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `freelancer` / `freelancer` / `freelancer_invoices` | db | Keep the password URL-safe (no `@ : / #`) — it is interpolated into `DATABASE_URL`. |
| `DB_PORT` | `5433` | db | Host port for Postgres. |
| `BACKEND_PORT` | `4400` | backend | API port. |
| `FRONTEND_PORT` | `3000` | frontend | UI port. |
| `CORS_ORIGIN` | `http://localhost:3000` | backend | **Browser origin** of the UI. |
| `RUN_MIGRATIONS` | `true` | backend | Run pending migrations before serving. |
| `LOG_LEVEL` | `info` | backend | pino level. |
| `NUXT_PUBLIC_API_BASE` | `http://localhost:4400/api` | frontend | **Browser-reachable** API base, `/api` included. |
| `NUXT_PORT` | `3000` | frontend | Container listen port. |
| `DATABASE_URL` | — | backend (local dev) | Ignored by Compose; the container uses the service name `db`. |
| `DATABASE_URL_TEST` | — | backend tests | Integration tests only. |

> ⚠️ `NUXT_PUBLIC_API_BASE` is a *public* runtimeConfig value read by the **browser**,
> not by the server. On TrueNAS set it to something the browser can resolve, e.g.
> `http://truenas.local:4400/api`. The Docker-internal name `backend` is **not**
> resolvable from a browser.

## Deployment on TrueNAS SCALE (Docker)

1. **Prepare the folder** — copy the repository onto a dataset, e.g.
   `/mnt/tank/apps/freelancer-invoices`. Keep `backend/` and `frontend/` in it; both
   images are built on the NAS.
2. **Create `.env`** from `.env.example` and adjust:

   ```dotenv
   POSTGRES_PASSWORD=<something-long-and-url-safe>
   CORS_ORIGIN=http://truenas.local:3000
   NUXT_PUBLIC_API_BASE=http://truenas.local:4400/api
   ```

3. **Start the app** — TrueNAS → Apps → Docker → "Add" → "Compose":
   * Compose Configuration → *Upload* or *Path* → `/mnt/tank/apps/freelancer-invoices/docker-compose.yml`
   * Environment → load `.env` from the same folder
   * Click **Deploy**. The backend reports `healthy` once migrations have run.
4. **Access** — UI `http://truenas.local:3000`, API `http://truenas.local:4400/api/health`.

**Images.** Both services build locally (`build.context: ./backend`, `./frontend`) and are
tagged `freelancer-invoices-{backend,frontend}:latest`. Pin tags or move to a registry if
you want rollbacks.

**Security notes.**

- Both containers run as the unprivileged `node` user (`USER node`), never root.
- Only the API port must be reachable from the browser; the Postgres port (`DB_PORT`) is
  published for convenience — set `DB_PORT` to an unused value or remove the `ports:`
  block if the NAS is untrusted.
- `.env` holds the database password. Restrict it (`chmod 600 .env`) and never commit it.

**Data & volumes.** All state lives in the named volume `pgdata`
(`/var/lib/postgresql/data` in the `db` container). `docker compose down` keeps it;
`docker compose down -v` destroys it.

**Backups.**

```bash
# Logical backup (recommended, version independent)
docker compose exec -T db pg_dump -U freelancer -d freelancer_invoices --format=custom > freelancer_invoices_$(date +%F).dump

# Restore into a fresh database
docker compose exec -T db createdb -U freelancer freelancer_invoices_restored
docker compose exec -T db pg_restore -U freelancer -d freelancer_invoices_restored --clean --if-exists < freelancer_invoices_YYYY-MM-DD.dump
```

Snapshot alternative: a TrueNAS dataset snapshot on the dataset holding `pgdata`.
Snapshots alone are not a substitute for a `pg_dump` you can restore elsewhere.

**Upgrades.** Pull new code, then `docker compose up -d --build`. Migrations run
automatically at backend start (`RUN_MIGRATIONS=true`); back up before upgrading, since
Drizzle migrations are not automatically reversible. To migrate outside the container,
run `docker compose run --rm backend node dist/db/migrate.js` and set
`RUN_MIGRATIONS=false`.

**Troubleshooting.**

| Symptom | Check |
|---------|-------|
| backend restarts | `docker compose logs backend` — usually a failed migration or a bad `POSTGRES_PASSWORD` |
| UI loads, API calls fail | browser console → CORS: set `CORS_ORIGIN` to the exact UI origin |
| UI loads, API "fetch failed" | `NUXT_PUBLIC_API_BASE` must be browser-reachable, not `http://backend:4400/api` |
| `npm ci` fails during build | `package-lock.json` is out of date — run `npm install` and commit it |

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